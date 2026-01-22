/**
 * People query functions - read operations for people
 */
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess } from "./lib/auth";
import { Id } from "./_generated/dataModel";

/**
 * List all people in a tree
 */
export const list = query({
    args: {
        treeId: v.id("trees"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);
        return ctx.db
            .query("people")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .take(args.limit ?? 100);
    },
});

/**
 * Get a single person by ID
 */
export const get = query({
    args: { personId: v.id("people") },
    handler: async (ctx: QueryCtx, args) => {
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
    handler: async (ctx: QueryCtx, args) => {
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

        const claimSourceLinks = await Promise.all(
            claims.map(async (claim) => ({
                claimId: claim._id,
                links: await ctx.db
                    .query("sourceClaims")
                    .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
                    .collect(),
            }))
        );

        const sourceIdSet = new Set<Id<"sources">>();
        const claimSourceIds = new Map<Id<"claims">, Id<"sources">[]>();

        claimSourceLinks.forEach(({ claimId, links }) => {
            const sourceIds = links.map((link) => link.sourceId);
            claimSourceIds.set(claimId, sourceIds);
            sourceIds.forEach((sourceId) => sourceIdSet.add(sourceId));
        });

        const sources = await Promise.all(
            [...sourceIdSet].map((id) => ctx.db.get(id))
        );
        const sourcesMap = new Map(
            sources.filter(Boolean).map((source) => [source!._id, source])
        );

        return {
            ...person,
            claims: claims.map((c) => ({
                ...c,
                place: c.value.placeId ? placesMap.get(c.value.placeId) : undefined,
                sources: (claimSourceIds.get(c._id) ?? [])
                    .map((sourceId) => sourcesMap.get(sourceId))
                    .filter((source): source is Exclude<typeof source, null | undefined> =>
                        Boolean(source)
                    ),
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
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);
        if (!args.query.trim()) return [];

        return ctx.db
            .query("people")
            .withSearchIndex("search_people", (q) =>
                q.search("givenNames", args.query).eq("treeId", args.treeId)
            )
            .take(20);
    },
});

/**
 * Get relationships for a person
 */
export const getRelationships = query({
    args: { personId: v.id("people") },
    handler: async (ctx: QueryCtx, args) => {
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
                .filter((r) => r.type === "sibling" || r.type === "half_sibling")
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
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const [people, relationships] = await Promise.all([
            ctx.db
                .query("people")
                .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
                .collect(),
            ctx.db
                .query("relationships")
                .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
                .collect(),
        ]);

        return { people, relationships };
    },
});
