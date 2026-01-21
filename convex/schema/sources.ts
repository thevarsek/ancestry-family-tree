import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sourceTables = {
    sources: defineTable({
        treeId: v.id("trees"),
        title: v.string(),
        url: v.optional(v.string()),
        author: v.optional(v.string()),
        publisher: v.optional(v.string()),
        publicationDate: v.optional(v.string()),
        accessDate: v.optional(v.string()),
        repository: v.optional(v.string()),
        callNumber: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .searchIndex("search_sources", {
            searchField: "title",
            filterFields: ["treeId"]
        }),

    sourceClaims: defineTable({
        treeId: v.id("trees"),
        sourceId: v.id("sources"),
        claimId: v.id("claims"),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_source", ["sourceId"])
        .index("by_claim", ["claimId"])
        .index("by_claim_source", ["claimId", "sourceId"])
        .index("by_tree", ["treeId"]),

    sourceSnapshots: defineTable({
        sourceId: v.id("sources"),
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        capturedAt: v.number(),
        capturedBy: v.id("users"),
        pageUrl: v.optional(v.string()),
        notes: v.optional(v.string())
    }).index("by_source", ["sourceId"])
        .index("by_tree", ["treeId"]),

    sourceExcerpts: defineTable({
        sourceId: v.id("sources"),
        snapshotId: v.optional(v.id("sourceSnapshots")),
        treeId: v.id("trees"),
        quote: v.string(),
        mediaId: v.optional(v.id("media")),
        boundingBox: v.optional(v.object({
            x: v.number(),
            y: v.number(),
            w: v.number(),
            h: v.number()
        })),
        page: v.optional(v.number()),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_source", ["sourceId"])
        .index("by_snapshot", ["snapshotId"])
        .index("by_tree", ["treeId"])
};
