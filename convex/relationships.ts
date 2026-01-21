import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "./lib/auth";

/**
 * Create a new relationship
 */
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        personId1: v.id("people"),
        personId2: v.id("people"),
        type: v.union(
            v.literal("parent_child"),
            v.literal("spouse"),
            v.literal("sibling"),
            v.literal("half_sibling"),
            v.literal("partner")
        ),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        status: v.optional(
            v.union(
                v.literal("current"),
                v.literal("divorced"),
                v.literal("separated"),
                v.literal("widowed"),
                v.literal("ended")
            )
        ),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        // Validate persons exist and belong to tree
        const [p1, p2] = await Promise.all([
            ctx.db.get(args.personId1),
            ctx.db.get(args.personId2),
        ]);

        if (!p1 || !p2) throw new Error("One or both persons not found");
        if (p1.treeId !== args.treeId || p2.treeId !== args.treeId) {
            throw new Error("Persons must belong to the same tree");
        }
        if (args.personId1 === args.personId2) {
            throw new Error("Cannot create relationship with self");
        }

        // Check for existing relationship of same type
        // This is a simple check; complex graphs might allow multiple (e.g. 2 marriages), 
        // but typically we don't want duplicate active ones.
        // For MVP, just creating it.

        const relationshipId = await ctx.db.insert("relationships", {
            treeId: args.treeId,
            personId1: args.personId1,
            personId2: args.personId2,
            type: args.type,
            startDate: args.startDate,
            endDate: args.endDate,
            status: args.status,
            createdBy: userId,
            createdAt: now,
        });

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "relationship_created",
            entityType: "relationship",
            entityId: relationshipId,
            changes: { type: args.type, p1: args.personId1, p2: args.personId2 },
            timestamp: now,
        });

        return relationshipId;
    },
});

/**
 * Remove a relationship
 */
export const remove = mutation({
    args: { relationshipId: v.id("relationships") },
    handler: async (ctx, args) => {
        const relationship = await ctx.db.get(args.relationshipId);
        if (!relationship) {
            throw new Error("Relationship not found");
        }

        const { userId } = await requireTreeAdmin(ctx, relationship.treeId);

        await ctx.db.delete(args.relationshipId);

        await ctx.db.insert("auditLog", {
            treeId: relationship.treeId,
            userId,
            action: "relationship_deleted",
            entityType: "relationship",
            entityId: args.relationshipId,
            changes: {
                type: relationship.type,
                p1: relationship.personId1,
                p2: relationship.personId2,
            },
            timestamp: Date.now(),
        });

        return args.relationshipId;
    },
});
