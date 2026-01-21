import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";

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

// List sources linked to a person
export const listByPerson = query({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return [];

        await requireTreeAccess(ctx, person.treeId);

        const claims = await ctx.db
            .query("claims")
            .withIndex("by_subject", (q) =>
                q.eq("subjectType", "person").eq("subjectId", args.personId)
            )
            .collect();

        if (claims.length === 0) return [];

        const sourceIdSet = new Set<Id<"sources">>();

        await Promise.all(
            claims.map(async (claim) => {
                const links = await ctx.db
                    .query("sourceClaims")
                    .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
                    .collect();
                links.forEach((link) => sourceIdSet.add(link.sourceId));
            })
        );

        const sources = await Promise.all(
            [...sourceIdSet].map((sourceId) => ctx.db.get(sourceId))
        );

        return sources
            .filter(Boolean)
            .sort((a, b) => (b!.createdAt ?? 0) - (a!.createdAt ?? 0));
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
        claimId: v.optional(v.id("claims")),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        if (args.claimId) {
            const claim = await ctx.db.get(args.claimId);
            if (!claim) throw new Error("Claim not found");
            if (claim.treeId !== args.treeId) {
                throw new Error("Claim belongs to a different tree");
            }
        }

        const { claimId, ...sourceData } = args;

        const sourceId = await ctx.db.insert("sources", {
            ...sourceData,
            createdBy: userId,
            createdAt: now,
        });

        // Add to searchable content
        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "source",
            entityId: sourceId,
            content: `${args.title} ${args.author || ''} ${args.notes || ''}`,
            updatedAt: now,
        });

        if (claimId) {
            const linkId = await ctx.db.insert("sourceClaims", {
                treeId: args.treeId,
                sourceId,
                claimId,
                createdBy: userId,
                createdAt: now,
            });

            await ctx.db.insert("auditLog", {
                treeId: args.treeId,
                userId,
                action: "source_linked",
                entityType: "sourceClaim",
                entityId: linkId,
                timestamp: now,
            });
        }

        return sourceId;
    },
});
