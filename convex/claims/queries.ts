import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAccess } from "../lib/auth";
import { Id } from "../_generated/dataModel";
import { subjectTypeValidator } from "./validators";

/**
 * List all claims in a tree (for linking sources to events)
 */
export const listByTree = query({
    args: {
        treeId: v.id("trees"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const claims = await ctx.db
            .query("claims")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .take(args.limit ?? 500);

        // Enrich with person/relationship names for display
        const enrichedClaims = await Promise.all(
            claims.map(async (claim) => {
                let personName: string | null = null;
                
                if (claim.subjectType === "person") {
                    const person = await ctx.db.get(claim.subjectId as Id<"people">);
                    if (person) {
                        personName = [person.givenNames, person.surnames].filter(Boolean).join(" ") || "Unknown";
                    }
                }

                return {
                    ...claim,
                    personName,
                };
            })
        );

        return enrichedClaims;
    },
});

/**
 * List claims for a subject (person/relationship/event)
 */
export const listBySubject = query({
    args: {
        subjectType: subjectTypeValidator,
        subjectId: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        const claims = await ctx.db
            .query("claims")
            .withIndex("by_subject", (q) =>
                q.eq("subjectType", args.subjectType).eq("subjectId", args.subjectId)
            )
            .collect();

        if (claims.length === 0) return [];

        // Check access via first claim's tree
        await requireTreeAccess(ctx, claims[0].treeId);

        return claims;
    },
});

/**
 * Get a single claim with its citations
 */
export const get = query({
    args: { claimId: v.id("claims") },
    handler: async (ctx: QueryCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) return null;

        await requireTreeAccess(ctx, claim.treeId);

        // Get citations linked to this claim
        const claimCitations = await ctx.db
            .query("claimCitations")
            .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
            .collect();

        const citations = await Promise.all(
            claimCitations.map((cc) => ctx.db.get(cc.citationId))
        );

        const sourceLinks = await ctx.db
            .query("sourceClaims")
            .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
            .collect();

        const sources = await Promise.all(
            sourceLinks.map((link) => ctx.db.get(link.sourceId))
        );

        // Get place if exists
        const place = claim.value.placeId
            ? await ctx.db.get(claim.value.placeId)
            : null;

        // Get related people if they exist in customFields
        const customFields = claim.value.customFields as { relatedPersonIds?: Id<"people">[] } | undefined;
        const relatedPeopleIds = customFields?.relatedPersonIds ?? [];
        const relatedPeople = await Promise.all(
            relatedPeopleIds.map((personId) => ctx.db.get(personId))
        );

        return {
            ...claim,
            place,
            citations: citations.filter(Boolean),
            sources: sources.filter(Boolean),
            relatedPeople: relatedPeople.filter(Boolean),
        };
    },
});
