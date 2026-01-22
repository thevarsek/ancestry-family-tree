/**
 * People mutations - write operations for people
 */
import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";

// Re-export queries for backward compatibility
export { list, get, getWithClaims, search, getRelationships, getTreeData } from "./peopleQueries";

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
    handler: async (ctx: MutationCtx, args) => {
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

        const displayName = [args.givenNames, args.surnames].filter(Boolean).join(" ");

        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "person",
            entityId: personId,
            content: displayName || "Unknown Person",
            personId,
            updatedAt: now,
        });

        await insertAuditLog(ctx, {
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
    handler: async (ctx: MutationCtx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) throw new Error("Person not found");

        const { userId } = await requireTreeAdmin(ctx, person.treeId);
        const now = Date.now();
        const { personId, ...updates } = args;

        await ctx.db.patch(personId, { ...updates, updatedAt: now });

        const displayName = [
            args.givenNames ?? person.givenNames,
            args.surnames ?? person.surnames,
        ].filter(Boolean).join(" ");

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

        await insertAuditLog(ctx, {
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
 * Set a person's profile photo
 */
export const setProfilePhoto = mutation({
    args: {
        personId: v.id("people"),
        mediaId: v.id("media")
    },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) throw new Error("Person not found");

        const media = await ctx.db.get(args.mediaId);
        if (!media) throw new Error("Media not found");

        if (media.ownerPersonId !== args.personId) {
            throw new Error("Profile photos must be owned by the person");
        }
        if (media.treeId !== person.treeId) {
            throw new Error("Media belongs to a different tree");
        }

        const { userId } = await requireTreeAdmin(ctx, person.treeId);
        const now = Date.now();

        await ctx.db.patch(args.personId, { profilePhotoId: args.mediaId, updatedAt: now });

        await insertAuditLog(ctx, {
            treeId: person.treeId,
            userId,
            action: "person_profile_photo_set",
            entityType: "person",
            entityId: args.personId,
            changes: { profilePhotoId: args.mediaId },
            timestamp: now,
        });

        return args.personId;
    }
});

/**
 * Delete a person (and related data)
 */
export const remove = mutation({
    args: { personId: v.id("people") },
    handler: async (ctx: MutationCtx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) throw new Error("Person not found");

        const { userId } = await requireTreeAdmin(ctx, person.treeId);
        const now = Date.now();

        // Delete related relationships
        const [relationships1, relationships2] = await Promise.all([
            ctx.db.query("relationships")
                .withIndex("by_person1", (q) => q.eq("personId1", args.personId))
                .collect(),
            ctx.db.query("relationships")
                .withIndex("by_person2", (q) => q.eq("personId2", args.personId))
                .collect(),
        ]);

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

        await ctx.db.delete(args.personId);

        await insertAuditLog(ctx, {
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
