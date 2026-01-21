import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";

/**
 * List all people in a tree
 */
export const list = query({
    args: {
        treeId: v.id("trees"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const people = await ctx.db
            .query("people")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .take(args.limit ?? 100);

        return people;
    },
});

/**
 * Get a single person by ID
 */
export const get = query({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return null;

        await requireTreeAccess(ctx, person.treeId);
        return person;
    },
});

/**
 * Get person with all their claims
 */
export const getWithClaims = query({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return null;

        await requireTreeAccess(ctx, person.treeId);

        const claims = await ctx.db
            .query("claims")
            .withIndex("by_subject", (q) =>
                q.eq("subjectType", "person").eq("subjectId", args.personId)
            )
            .collect();

        // Get places for claims that have them
        const placeIds = claims
            .map((c) => c.value.placeId)
            .filter((id): id is Id<"places"> => id !== undefined);

        const places = await Promise.all(
            [...new Set(placeIds)].map((id) => ctx.db.get(id))
        );
        const placesMap = new Map(
            places.filter(Boolean).map((p) => [p!._id, p])
        );

        return {
            ...person,
            claims: claims.map((c) => ({
                ...c,
                place: c.value.placeId ? placesMap.get(c.value.placeId) : undefined,
            })),
        };
    },
});

/**
 * Search people by name
 */
export const search = query({
    args: {
        treeId: v.id("trees"),
        query: v.string(),
    },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        if (!args.query.trim()) {
            return [];
        }

        const results = await ctx.db
            .query("people")
            .withSearchIndex("search_people", (q) =>
                q.search("givenNames", args.query).eq("treeId", args.treeId)
            )
            .take(20);

        return results;
    },
});

/**
 * Create a new person
 */
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        givenNames: v.optional(v.string()),
        surnames: v.optional(v.string()),
        preferredName: v.optional(v.string()),
        gender: v.optional(
            v.union(
                v.literal("male"),
                v.literal("female"),
                v.literal("other"),
                v.literal("unknown")
            )
        ),
        isLiving: v.boolean(),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        const personId = await ctx.db.insert("people", {
            treeId: args.treeId,
            givenNames: args.givenNames,
            surnames: args.surnames,
            preferredName: args.preferredName,
            gender: args.gender,
            isLiving: args.isLiving,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        });

        // Add to searchable content for RAG
        const displayName = [args.givenNames, args.surnames]
            .filter(Boolean)
            .join(" ");

        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "person",
            entityId: personId,
            content: displayName || "Unknown Person",
            personId,
            updatedAt: now,
        });

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "person_created",
            entityType: "person",
            entityId: personId,
            timestamp: now,
        });

        return personId;
    },
});

/**
 * Update a person
 */
export const update = mutation({
    args: {
        personId: v.id("people"),
        givenNames: v.optional(v.string()),
        surnames: v.optional(v.string()),
        preferredName: v.optional(v.string()),
        gender: v.optional(
            v.union(
                v.literal("male"),
                v.literal("female"),
                v.literal("other"),
                v.literal("unknown")
            )
        ),
        isLiving: v.optional(v.boolean()),
        socialLinks: v.optional(
            v.array(
                v.object({
                    platform: v.string(),
                    url: v.string(),
                    isVerified: v.optional(v.boolean()),
                })
            )
        ),
    },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) throw new Error("Person not found");

        const { userId } = await requireTreeAdmin(ctx, person.treeId);
        const now = Date.now();

        const { personId, ...updates } = args;

        await ctx.db.patch(personId, {
            ...updates,
            updatedAt: now,
        });

        // Update searchable content
        const displayName = [
            args.givenNames ?? person.givenNames,
            args.surnames ?? person.surnames,
        ]
            .filter(Boolean)
            .join(" ");

        const existingContent = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) =>
                q.eq("entityType", "person").eq("entityId", personId)
            )
            .unique();

        if (existingContent) {
            await ctx.db.patch(existingContent._id, {
                content: displayName || "Unknown Person",
                updatedAt: now,
            });
        }

        await ctx.db.insert("auditLog", {
            treeId: person.treeId,
            userId,
            action: "person_updated",
            entityType: "person",
            entityId: personId,
            changes: updates,
            timestamp: now,
        });

        return args.personId;
    },
});

/**
 * Delete a person (and related data)
 */
export const remove = mutation({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) throw new Error("Person not found");

        const { userId } = await requireTreeAdmin(ctx, person.treeId);
        const now = Date.now();

        // Delete related relationships
        const relationships1 = await ctx.db
            .query("relationships")
            .withIndex("by_person1", (q) => q.eq("personId1", args.personId))
            .collect();
        const relationships2 = await ctx.db
            .query("relationships")
            .withIndex("by_person2", (q) => q.eq("personId2", args.personId))
            .collect();

        for (const rel of [...relationships1, ...relationships2]) {
            await ctx.db.delete(rel._id);
        }

        // Delete claims about this person
        const claims = await ctx.db
            .query("claims")
            .withIndex("by_subject", (q) =>
                q.eq("subjectType", "person").eq("subjectId", args.personId)
            )
            .collect();

        for (const claim of claims) {
            await ctx.db.delete(claim._id);
        }

        // Delete searchable content
        const searchContent = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) =>
                q.eq("entityType", "person").eq("entityId", args.personId)
            )
            .unique();

        if (searchContent) {
            await ctx.db.delete(searchContent._id);
        }

        // Delete the person
        await ctx.db.delete(args.personId);

        await ctx.db.insert("auditLog", {
            treeId: person.treeId,
            userId,
            action: "person_deleted",
            entityType: "person",
            entityId: args.personId,
            timestamp: now,
        });

        return args.personId;
    },
});

/**
 * Get relationships for a person
 */
export const getRelationships = query({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return null;

        await requireTreeAccess(ctx, person.treeId);

        const asFirst = await ctx.db
            .query("relationships")
            .withIndex("by_person1", (q) => q.eq("personId1", args.personId))
            .collect();

        const asSecond = await ctx.db
            .query("relationships")
            .withIndex("by_person2", (q) => q.eq("personId2", args.personId))
            .collect();

        // Get related people
        const relatedIds = [
            ...asFirst.map((r) => r.personId2),
            ...asSecond.map((r) => r.personId1),
        ];

        const relatedPeople = await Promise.all(
            [...new Set(relatedIds)].map((id) => ctx.db.get(id))
        );
        const peopleMap = new Map(
            relatedPeople.filter(Boolean).map((p) => [p!._id, p])
        );

        return {
            parents: asSecond
                .filter((r) => r.type === "parent_child")
                .map((r) => ({ relationship: r, person: peopleMap.get(r.personId1) })),
            children: asFirst
                .filter((r) => r.type === "parent_child")
                .map((r) => ({ relationship: r, person: peopleMap.get(r.personId2) })),
            spouses: [...asFirst, ...asSecond]
                .filter((r) => r.type === "spouse" || r.type === "partner")
                .map((r) => ({
                    relationship: r,
                    person: peopleMap.get(
                        r.personId1 === args.personId ? r.personId2 : r.personId1
                    ),
                })),
            siblings: [...asFirst, ...asSecond]
                .filter((r) => r.type === "sibling")
                .map((r) => ({
                    relationship: r,
                    person: peopleMap.get(
                        r.personId1 === args.personId ? r.personId2 : r.personId1
                    ),
                })),
        };
    },
});
/**
 * Get all people and relationships in a tree for visualization
 */
export const getTreeData = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const people = await ctx.db
            .query("people")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        const relationships = await ctx.db
            .query("relationships")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        return {
            people,
            relationships,
        };
    },
});
