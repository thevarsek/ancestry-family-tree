import { defineTable } from "convex/server";
import { v } from "convex/values";

export const claimTables = {
    claims: defineTable({
        treeId: v.id("trees"),
        subjectType: v.union(
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event")
        ),
        subjectId: v.string(),
        claimType: v.union(
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
        ),
        value: v.object({
            date: v.optional(v.string()),
            dateEnd: v.optional(v.string()),
            datePrecision: v.optional(v.union(
                v.literal("exact"),
                v.literal("year"),
                v.literal("decade"),
                v.literal("approximate"),
                v.literal("before"),
                v.literal("after"),
                v.literal("between")
            )),
            placeId: v.optional(v.id("places")),
            description: v.optional(v.string()),
            customFields: v.optional(v.any())
        }),
        status: v.union(
            v.literal("draft"),
            v.literal("disputed"),
            v.literal("accepted")
        ),
        confidence: v.optional(v.union(
            v.literal("high"),
            v.literal("medium"),
            v.literal("low"),
            v.literal("uncertain")
        )),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
        resolvedBy: v.optional(v.id("users")),
        resolvedAt: v.optional(v.number()),
        resolutionNote: v.optional(v.string())
    }).index("by_tree", ["treeId"])
        .index("by_subject", ["subjectType", "subjectId"])
        .index("by_tree_type", ["treeId", "claimType"])
        .index("by_tree_status", ["treeId", "status"]),

    claimDisputes: defineTable({
        claimId: v.id("claims"),
        treeId: v.id("trees"),
        alternativeValue: v.any(),
        reason: v.string(),
        proposedBy: v.id("users"),
        proposedAt: v.number(),
        status: v.union(
            v.literal("open"),
            v.literal("accepted"),
            v.literal("rejected")
        ),
        resolvedBy: v.optional(v.id("users")),
        resolvedAt: v.optional(v.number()),
        resolutionNote: v.optional(v.string())
    }).index("by_claim", ["claimId"])
        .index("by_tree_status", ["treeId", "status"])
};
