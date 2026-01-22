import { v } from "convex/values";

/**
 * Validator for claim types (birth, death, marriage, etc.)
 */
export const claimTypeValidator = v.union(
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

/**
 * Validator for claim value object
 */
export const claimValueValidator = v.object({
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
 * Validator for subject type
 */
export const subjectTypeValidator = v.union(
    v.literal("person"),
    v.literal("relationship"),
    v.literal("event")
);

/**
 * Validator for claim status
 */
export const claimStatusValidator = v.union(
    v.literal("draft"),
    v.literal("disputed"),
    v.literal("accepted")
);

/**
 * Validator for confidence level
 */
export const confidenceValidator = v.union(
    v.literal("high"),
    v.literal("medium"),
    v.literal("low"),
    v.literal("uncertain")
);
