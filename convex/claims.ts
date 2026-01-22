import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";

const claimTypeValidator = v.union(
    v.literal("birth"),
    v.literal("death"),
    v.literal("marriage"),
    v.literal("divorce"),
    v.literal("residence"),
    v.literal("workplace"),
    v.literal("occupation"),
    v.literal("education"),
    v.literal("military_service"),
    v.literal("immigration"),
    v.literal("emigration"),
    v.literal("naturalization"),
    v.literal("religion"),
    v.literal("name_change"),
    v.literal("custom")
);

const claimValueValidator = v.object({
    date: v.optional(v.string()),
    dateEnd: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    datePrecision: v.optional(
        v.union(
            v.literal("exact"),
            v.literal("year"),
            v.literal("decade"),
            v.literal("approximate"),
            v.literal("before"),
            v.literal("after"),
            v.literal("between")
        )
    ),
    placeId: v.optional(v.id("places")),
    description: v.optional(v.string()),
    customFields: v.optional(v.any()),
});

/**
 * List claims for a subject (person/relationship/event)
 */
export const listBySubject = query({
    args: {
        subjectType: v.union(
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event")
        ),
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

        return {
            ...claim,
            place,
            citations: citations.filter(Boolean),
            sources: sources.filter(Boolean),
        };
    },
});

/**
 * Create a new claim
 */
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        subjectType: v.union(
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event")
        ),
        subjectId: v.string(),
        claimType: claimTypeValidator,
        value: claimValueValidator,
        status: v.optional(
            v.union(v.literal("draft"), v.literal("disputed"), v.literal("accepted"))
        ),
        confidence: v.optional(
            v.union(
                v.literal("high"),
                v.literal("medium"),
                v.literal("low"),
                v.literal("uncertain")
            )
        ),
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

        // Add to searchable content
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

        await ctx.db.insert("auditLog", {
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

/**
 * Update a claim's details
 */
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

        // Update the main claim
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

        // Handle related people claims
        if (claim.subjectType === "person" && args.relatedPersonIds?.length) {
            const uniqueRelatedIds = Array.from(new Set(args.relatedPersonIds))
                .filter((id) => id !== claim.subjectId);

            // Find existing related claims by querying all claims of the same type in the tree
            // and checking if they have relatedPersonIds that include our subjectId
            const allClaimsOfType = await ctx.db
                .query("claims")
                .withIndex("by_tree_type", (q) => q.eq("treeId", claim.treeId).eq("claimType", args.claimType))
                .collect();

            // Filter to find related claims (those that have our subjectId in their relatedPersonIds)
            const existingRelatedClaims = allClaimsOfType.filter(c => {
                if (c.subjectId === claim.subjectId) return false; // Skip the main claim
                const customFields = c.value.customFields as { relatedPersonIds?: string[] } | undefined;
                return customFields?.relatedPersonIds?.includes(claim.subjectId);
            });

            const existingRelatedIds = existingRelatedClaims.map(c => c.subjectId);
            const newRelatedIds = uniqueRelatedIds.filter(id => !existingRelatedIds.includes(id as any));
            const removedRelatedIds = existingRelatedIds.filter(id => !uniqueRelatedIds.includes(id as Id<"people">));

            // Create new related claims
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

            // Remove old related claims
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

            // Update existing related claims
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

        await ctx.db.insert("auditLog", {
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

/**
 * Remove a claim
 */
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

        await ctx.db.insert("auditLog", {
            treeId: claim.treeId,
            userId,
            action: "claim_deleted",
            entityType: "claim",
            entityId: args.claimId,
            timestamp: Date.now(),
        });

        return args.claimId;
    },
});

/**
 * Update a claim's status (accept/dispute)
 */
export const updateStatus = mutation({
    args: {
        claimId: v.id("claims"),
        status: v.union(
            v.literal("draft"),
            v.literal("disputed"),
            v.literal("accepted")
        ),
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

        await ctx.db.insert("auditLog", {
            treeId: claim.treeId,
            userId,
            action: `claim_${args.status}`,
            entityType: "claim",
            entityId: args.claimId,
            changes: { status: args.status, resolutionNote: args.resolutionNote },
            timestamp: now,
        });

        return args.claimId;
    },
});

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

        await ctx.db.insert("auditLog", {
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

        await ctx.db.insert("auditLog", {
            treeId: dispute.treeId,
            userId,
            action: `dispute_${args.resolution}`,
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

/**
 * Link a citation to a claim
 */
export const addCitation = mutation({
    args: {
        claimId: v.id("claims"),
        citationId: v.id("citations"),
        isPrimary: v.optional(v.boolean()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const claim = await ctx.db.get(args.claimId);
        if (!claim) throw new Error("Claim not found");

        const { userId } = await requireTreeAdmin(ctx, claim.treeId);
        const now = Date.now();

        const linkId = await ctx.db.insert("claimCitations", {
            claimId: args.claimId,
            citationId: args.citationId,
            treeId: claim.treeId,
            isPrimary: args.isPrimary ?? false,
            createdAt: now,
        });

        await ctx.db.insert("auditLog", {
            treeId: claim.treeId,
            userId,
            action: "citation_linked",
            entityType: "claimCitation",
            entityId: linkId,
            timestamp: now,
        });

        return linkId;
    },
});

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

        await ctx.db.insert("auditLog", {
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

        await ctx.db.insert("auditLog", {
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

/**
 * Get timeline data: all claims with dates for visualization
 * Returns people with their birth/death dates, and all other life events
 */
export const getTimelineData = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        // Get all people in the tree
        const people = await ctx.db
            .query("people")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        // Get all relationships (for focus feature)
        const relationships = await ctx.db
            .query("relationships")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        // Get all claims in the tree
        const allClaims = await ctx.db
            .query("claims")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        // Filter to only person claims (life events)
        const personClaims = allClaims.filter(
            (claim) => claim.subjectType === "person"
        );

        // Separate birth/death claims from other life events
        const birthDeathClaims = personClaims.filter(
            (claim) => claim.claimType === "birth" || claim.claimType === "death"
        );

        // Life events are all non-birth/death claims that have dates
        const lifeEventClaims = personClaims.filter(
            (claim) =>
                claim.claimType !== "birth" &&
                claim.claimType !== "death" &&
                claim.value.date
        );

        // Build a map of person -> birth/death dates
        const personDatesMap = new Map<
            string,
            { birthDate?: string; deathDate?: string; isCurrent?: boolean }
        >();

        for (const claim of birthDeathClaims) {
            const existing = personDatesMap.get(claim.subjectId) ?? {};
            if (claim.claimType === "birth") {
                existing.birthDate = claim.value.date;
            } else if (claim.claimType === "death") {
                existing.deathDate = claim.value.date;
                existing.isCurrent = claim.value.isCurrent;
            }
            personDatesMap.set(claim.subjectId, existing);
        }

        // Combine people with their dates
        const peopleWithDates = people.map((person) => {
            const dates = personDatesMap.get(person._id) ?? {};
            return {
                ...person,
                birthDate: dates.birthDate,
                deathDate: dates.deathDate,
                isOngoing: person.isLiving || dates.isCurrent,
            };
        });

        // Get unique claim types for filtering (excluding birth/death)
        const eventTypes = [...new Set(lifeEventClaims.map((c) => c.claimType))];

        // Build person lookup for life events
        const personMap = new Map(people.map((p) => [p._id, p]));

        // Enrich life events with person info
        const lifeEvents = lifeEventClaims.map((claim) => {
            const person = personMap.get(claim.subjectId as Id<"people">);
            const personName = person
                ? [person.givenNames, person.surnames].filter(Boolean).join(" ")
                : "Unknown";
            return {
                ...claim,
                personName,
                personId: claim.subjectId as Id<"people">,
            };
        });

        return {
            people: peopleWithDates,
            relationships,
            lifeEvents,
            eventTypes,
        };
    },
});
