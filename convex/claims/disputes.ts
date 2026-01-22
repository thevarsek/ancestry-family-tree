import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "../lib/auth";
import { insertAuditLog } from "../lib/auditLog";

/**
 * Create a dispute for a claim
 */
export const dispute = mutation({
    args: {
        claimId: v.id("claims"),
        alternativeValue: v.any(),
        reason: v.string(),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAccess(ctx, claim.treeId);
        const now = Date.now();

        // Create the dispute
        const disputeId = await ctx.db.insert("claimDisputes", {
            claimId: args.claimId,
            treeId: claim.treeId,
            alternativeValue: args.alternativeValue,
            reason: args.reason,
            proposedBy: userId,
            proposedAt: now,
            status: "open",
        });

        // Update claim status to disputed
        await ctx.db.patch(args.claimId, {
            status: "disputed",
            updatedAt: now,
        });

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: "dispute_created",
            entityType: "claimDispute",
            entityId: disputeId,
            timestamp: now,
        });

        return disputeId;
    },
});

/**
 * Resolve a dispute
 */
export const resolveDispute = mutation({
    args: {
        disputeId: v.id("claimDisputes"),
        resolution: v.union(v.literal("accepted"), v.literal("rejected")),
        note: v.optional(v.string()),
        applyAlternativeValue: v.optional(v.boolean()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const dispute = await ctx.db.get(args.disputeId);
        if (!dispute) throw new Error("Dispute not found");

        const { userId } = await requireTreeAdmin(ctx, dispute.treeId);
        const now = Date.now();

        // Update dispute
        await ctx.db.patch(args.disputeId, {
            status: args.resolution,
            resolvedBy: userId,
            resolvedAt: now,
            resolutionNote: args.note,
        });

        // Get the claim
        const claim = await ctx.db.get(dispute.claimId);
        if (!claim) throw new Error("Claim not found");

        // If accepted and applying alternative value, update the claim
        if (args.resolution === "accepted" && args.applyAlternativeValue) {
            await ctx.db.patch(dispute.claimId, {
                value: dispute.alternativeValue,
                status: "accepted",
                resolvedBy: userId,
                resolvedAt: now,
                resolutionNote: args.note,
                updatedAt: now,
            });
        } else {
            // Just mark claim as accepted with original value
            await ctx.db.patch(dispute.claimId, {
                status: "accepted",
                resolvedBy: userId,
                resolvedAt: now,
                resolutionNote: args.note,
                updatedAt: now,
            });
        }

        const disputeActionMap = {
            accepted: "dispute_accepted",
            rejected: "dispute_rejected",
        } as const;

        await insertAuditLog(ctx, {
            treeId: dispute.treeId,
            userId,
            action: disputeActionMap[args.resolution],
            entityType: "claimDispute",
            entityId: args.disputeId,
            changes: {
                resolution: args.resolution,
                applyAlternativeValue: args.applyAlternativeValue,
            },
            timestamp: now,
        });

        return args.disputeId;
    },
});
