import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "../lib/auth";
import { insertAuditLog } from "../lib/auditLog";

/**
 * Link a source to a claim
 */
export const addSource = mutation({
    args: {
        claimId: v.id("claims"),
        sourceId: v.id("sources"),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const source = await ctx.db.get(args.sourceId);
        if (!source) throw new Error("Source not found");

        if (source.treeId !== claim.treeId) {
            throw new Error("Source belongs to a different tree");
        }

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);
        const now = Date.now();

        const existingLink = await ctx.db
            .query("sourceClaims")
            .withIndex("by_claim_source", (q) =>
                q.eq("claimId", args.claimId).eq("sourceId", args.sourceId)
            )
            .unique();

        if (existingLink) return existingLink._id;

        const linkId = await ctx.db.insert("sourceClaims", {
            treeId: claim.treeId,
            claimId: args.claimId,
            sourceId: args.sourceId,
            createdBy: userId,
            createdAt: now,
        });

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: "source_linked",
            entityType: "sourceClaim",
            entityId: linkId,
            timestamp: now,
        });

        return linkId;
    },
});

/**
 * Unlink a source from a claim
 */
export const removeSource = mutation({
    args: {
        claimId: v.id("claims"),
        sourceId: v.id("sources"),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);
        const now = Date.now();

        const link = await ctx.db
            .query("sourceClaims")
            .withIndex("by_claim_source", (q) =>
                q.eq("claimId", args.claimId).eq("sourceId", args.sourceId)
            )
            .unique();

        if (!link) return null;

        await ctx.db.delete(link._id);

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: "source_unlinked",
            entityType: "sourceClaim",
            entityId: link._id,
            timestamp: now,
        });

        return link._id;
    },
});
