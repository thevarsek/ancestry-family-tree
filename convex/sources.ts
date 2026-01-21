import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";

// List sources for a tree
export const list = query({
    args: { treeId: v.id("trees"), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const sources = await ctx.db
            .query("sources")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .order("desc")
            .take(args.limit || 100);

        return sources;
    },
});

// Create a new source
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        title: v.string(),
        url: v.optional(v.string()),
        author: v.optional(v.string()),
        publisher: v.optional(v.string()),
        publicationDate: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);

        const sourceId = await ctx.db.insert("sources", {
            ...args,
            createdBy: userId,
            createdAt: Date.now(),
        });

        // Add to searchable content
        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "source",
            entityId: sourceId,
            content: `${args.title} ${args.author || ''} ${args.notes || ''}`,
            updatedAt: Date.now(),
        });

        return sourceId;
    },
});
