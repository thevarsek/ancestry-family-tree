import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAccess } from "../lib/auth";
import { Id } from "../_generated/dataModel";

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
