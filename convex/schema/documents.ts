import { defineTable } from "convex/server";
import { v } from "convex/values";

export const documentTables = {
    documents: defineTable({
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        title: v.string(),
        pageCount: v.optional(v.number()),
        processingStatus: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        ocrMethod: v.optional(v.union(
            v.literal("tesseract"),
            v.literal("browser_ocr"),
            v.literal("mistral_ocr"),
            v.literal("imported")
        )),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_media", ["mediaId"])
        .index("by_status", ["processingStatus"]),

    documentChunks: defineTable({
        documentId: v.id("documents"),
        treeId: v.id("trees"),
        chunkIndex: v.number(),
        pageNumber: v.optional(v.number()),
        content: v.string(),
        embedding: v.optional(v.array(v.float64())),
        createdAt: v.number()
    }).index("by_document", ["documentId"])
        .index("by_tree", ["treeId"])
        .vectorIndex("by_embedding", {
            vectorField: "embedding",
            dimensions: 1536,
            filterFields: ["treeId"]
        }),

    searchableContent: defineTable({
        treeId: v.id("trees"),
        entityType: v.union(
            v.literal("person"),
            v.literal("claim"),
            v.literal("place"),
            v.literal("source"),
            v.literal("note"),
            v.literal("document_chunk")
        ),
        entityId: v.string(),
        content: v.string(),
        embedding: v.optional(v.array(v.float64())),
        personId: v.optional(v.id("people")),
        placeId: v.optional(v.id("places")),
        claimType: v.optional(v.string()),
        dateRange: v.optional(v.object({
            start: v.optional(v.string()),
            end: v.optional(v.string())
        })),
        tags: v.optional(v.array(v.string())),
        updatedAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_person", ["personId"])
        .index("by_place", ["placeId"])
        .searchIndex("fulltext", {
            searchField: "content",
            filterFields: ["treeId", "entityType"]
        })
        .vectorIndex("semantic", {
            vectorField: "embedding",
            dimensions: 1536,
            filterFields: ["treeId", "entityType"]
        })
};
