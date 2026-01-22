import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "../lib/auth";
import { insertAuditLog } from "../lib/auditLog";
import { Id } from "../_generated/dataModel";
import {
    claimTypeValidator,
    claimValueValidator,
    subjectTypeValidator,
    claimStatusValidator,
    confidenceValidator,
} from "./validators";

/** Create a new claim */
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        subjectType: subjectTypeValidator,
        subjectId: v.string(),
        claimType: claimTypeValidator,
        value: claimValueValidator,
        status: v.optional(claimStatusValidator),
        confidence: v.optional(confidenceValidator),
        relatedPersonIds: v.optional(v.array(v.id("people"))),
    },
    handler: async (ctx: MutationCtx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();
        const claimId = await ctx.db.insert("claims", {
            treeId: args.treeId,
            subjectType: args.subjectType,
            subjectId: args.subjectId,
            claimType: args.claimType,
            value: {
                ...args.value,
                customFields: {
                    ...(args.value.customFields as Record<string, unknown> | undefined),
                    relatedPersonIds: args.relatedPersonIds,
                },
            },
            status: args.status ?? "draft",
            confidence: args.confidence,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        });
        const searchableText = [
            args.claimType,
            args.value.description,
            args.value.date,
        ]
            .filter(Boolean)
            .join(" ");

        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "claim",
            entityId: claimId,
            content: searchableText,
            claimType: args.claimType,
            placeId: args.value.placeId,
            dateRange:
                args.value.date || args.value.dateEnd
                    ? { start: args.value.date, end: args.value.dateEnd }
                    : undefined,
            updatedAt: now,
        });

        if (args.subjectType === "person" && args.relatedPersonIds?.length) {
            const uniqueRelatedIds = Array.from(new Set(args.relatedPersonIds))
                .filter((id) => id !== args.subjectId);

            await Promise.all(
                uniqueRelatedIds.map(async (relatedId) => {
                    const relatedClaimId = await ctx.db.insert("claims", {
                        treeId: args.treeId,
                        subjectType: "person",
                        subjectId: relatedId,
                        claimType: args.claimType,
                        value: {
                            ...args.value,
                            customFields: {
                                ...(args.value.customFields as Record<string, unknown> | undefined),
                                relatedPersonIds: uniqueRelatedIds,
                            },
                        },
                        status: args.status ?? "draft",
                        confidence: args.confidence,
                        createdBy: userId,
                        createdAt: now,
                        updatedAt: now,
                    });

                    const relatedText = [args.claimType, args.value.description, args.value.date]
                        .filter(Boolean)
                        .join(" ");

                    await ctx.db.insert("searchableContent", {
                        treeId: args.treeId,
                        entityType: "claim",
                        entityId: relatedClaimId,
                        content: relatedText,
                        claimType: args.claimType,
                        placeId: args.value.placeId,
                        dateRange:
                            args.value.date || args.value.dateEnd
                                ? { start: args.value.date, end: args.value.dateEnd }
                                : undefined,
                        updatedAt: now,
                    });
                })
            );
        }

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId,
            action: "claim_created",
            entityType: "claim",
            entityId: claimId,
            timestamp: now,
        });

        return claimId;
    },
});

/** Update a claim's details */
export const update = mutation({
    args: {
        claimId: v.id("claims"),
        claimType: claimTypeValidator,
        value: claimValueValidator,
        relatedPersonIds: v.optional(v.array(v.id("people"))),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);
        const now = Date.now();
        const customFields = args.value.customFields as Record<string, unknown> | undefined;
        const updatedValue = {
            ...args.value,
            customFields: {
                ...customFields,
                relatedPersonIds: args.relatedPersonIds,
            },
        };

        await ctx.db.patch(args.claimId, {
            claimType: args.claimType,
            value: updatedValue,
            updatedAt: now,
        });
        if (claim.subjectType === "person" && args.relatedPersonIds?.length) {
            const uniqueRelatedIds = Array.from(new Set(args.relatedPersonIds))
                .filter((id) => id !== claim.subjectId);

            // Find existing related claims
            const allClaimsOfType = await ctx.db
                .query("claims")
                .withIndex("by_tree_type", (q) => q.eq("treeId", claim.treeId).eq("claimType", args.claimType))
                .collect();

            const existingRelatedClaims = allClaimsOfType.filter(c => {
                if (c.subjectId === claim.subjectId) return false;
                const cf = c.value.customFields as { relatedPersonIds?: string[] } | undefined;
                return cf?.relatedPersonIds?.includes(claim.subjectId);
            });

            const existingRelatedIds = existingRelatedClaims.map(c => c.subjectId);
            const newRelatedIds = uniqueRelatedIds.filter(id => !existingRelatedIds.includes(id));
            const removedRelatedIds = existingRelatedIds.filter(id => !uniqueRelatedIds.includes(id as Id<"people">));
            await Promise.all(
                newRelatedIds.map(async (relatedId) => {
                    const relatedClaimId = await ctx.db.insert("claims", {
                        treeId: claim.treeId,
                        subjectType: "person",
                        subjectId: relatedId,
                        claimType: args.claimType,
                        value: updatedValue,
                        status: claim.status,
                        confidence: claim.confidence,
                        createdBy: userId,
                        createdAt: now,
                        updatedAt: now,
                    });

                    const relatedText = [args.claimType, args.value.description, args.value.date]
                        .filter(Boolean)
                        .join(" ");

                    await ctx.db.insert("searchableContent", {
                        treeId: claim.treeId,
                        entityType: "claim",
                        entityId: relatedClaimId,
                        content: relatedText,
                        claimType: args.claimType,
                        placeId: args.value.placeId,
                        dateRange:
                            args.value.date || args.value.dateEnd
                                ? { start: args.value.date, end: args.value.dateEnd }
                                : undefined,
                        updatedAt: now,
                    });
                })
            );
            await Promise.all(
                removedRelatedIds.map(async (relatedId) => {
                    const relatedClaim = existingRelatedClaims.find(c => c.subjectId === relatedId);
                    if (relatedClaim) {
                        await ctx.db.delete(relatedClaim._id);

                        const relatedSearchable = await ctx.db
                            .query("searchableContent")
                            .withIndex("by_entity", (q) => q.eq("entityType", "claim").eq("entityId", relatedClaim._id))
                            .unique();

                        if (relatedSearchable) {
                            await ctx.db.delete(relatedSearchable._id);
                        }
                    }
                })
            );
            await Promise.all(
                existingRelatedClaims
                    .filter(c => uniqueRelatedIds.includes(c.subjectId as Id<"people">))
                    .map(async (relatedClaim) => {
                        await ctx.db.patch(relatedClaim._id, {
                            value: updatedValue,
                            updatedAt: now,
                        });

                        const relatedSearchable = await ctx.db
                            .query("searchableContent")
                            .withIndex("by_entity", (q) => q.eq("entityType", "claim").eq("entityId", relatedClaim._id))
                            .unique();

                        if (relatedSearchable) {
                            const relatedText = [args.claimType, args.value.description, args.value.date]
                                .filter(Boolean)
                                .join(" ");

                            await ctx.db.patch(relatedSearchable._id, {
                                content: relatedText,
                                claimType: args.claimType,
                                placeId: args.value.placeId,
                                dateRange:
                                    args.value.date || args.value.dateEnd
                                        ? { start: args.value.date, end: args.value.dateEnd }
                                        : undefined,
                                updatedAt: now,
                            });
                        }
                    })
            );
        }

        const searchableText = [args.claimType, args.value.description, args.value.date]
            .filter(Boolean)
            .join(" ");

        const searchableEntry = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) => q.eq("entityType", "claim").eq("entityId", args.claimId))
            .unique();

        if (searchableEntry) {
            await ctx.db.patch(searchableEntry._id, {
                content: searchableText,
                claimType: args.claimType,
                placeId: args.value.placeId,
                dateRange:
                    args.value.date || args.value.dateEnd
                        ? { start: args.value.date, end: args.value.dateEnd }
                        : undefined,
                updatedAt: now,
            });
        } else {
            await ctx.db.insert("searchableContent", {
                treeId: claim.treeId,
                entityType: "claim",
                entityId: args.claimId,
                content: searchableText,
                claimType: args.claimType,
                placeId: args.value.placeId,
                dateRange:
                    args.value.date || args.value.dateEnd
                        ? { start: args.value.date, end: args.value.dateEnd }
                        : undefined,
                updatedAt: now,
            });
        }

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: "claim_updated",
            entityType: "claim",
            entityId: args.claimId,
            changes: { claimType: args.claimType, value: args.value },
            timestamp: now,
        });

        return args.claimId;
    },
});

/** Remove a claim */
export const remove = mutation({
    args: { claimId: v.id("claims") },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);

        const claimCitations = await ctx.db
            .query("claimCitations")
            .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
            .collect();

        await Promise.all(claimCitations.map((cc) => ctx.db.delete(cc._id)));

        const claimDisputes = await ctx.db
            .query("claimDisputes")
            .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
            .collect();

        await Promise.all(claimDisputes.map((dispute) => ctx.db.delete(dispute._id)));

        const searchableEntry = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) => q.eq("entityType", "claim").eq("entityId", args.claimId))
            .unique();

        if (searchableEntry) {
            await ctx.db.delete(searchableEntry._id);
        }

        await ctx.db.delete(args.claimId);

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: "claim_deleted",
            entityType: "claim",
            entityId: args.claimId,
        });

        return args.claimId;
    },
});

/** Update a claim's status (accept/dispute) */
export const updateStatus = mutation({
    args: {
        claimId: v.id("claims"),
        status: claimStatusValidator,
        resolutionNote: v.optional(v.string()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);
        const now = Date.now();

        await ctx.db.patch(args.claimId, {
            status: args.status,
            resolvedBy: userId,
            resolvedAt: now,
            resolutionNote: args.resolutionNote,
            updatedAt: now,
        });

        const actionMap = {
            draft: "claim_draft",
            disputed: "claim_disputed",
            accepted: "claim_accepted",
        } as const;

        await insertAuditLog(ctx, {
            treeId: claim.treeId,
            userId,
            action: actionMap[args.status],
            entityType: "claim",
            entityId: args.claimId,
            changes: { status: args.status, resolutionNote: args.resolutionNote },
            timestamp: now,
        });

        return args.claimId;
    },
});
