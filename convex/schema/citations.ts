import { defineTable } from "convex/server";
import { v } from "convex/values";

export const citationTables = {
    citations: defineTable({
        treeId: v.id("trees"),
        kind: v.union(
            v.literal("source_url"),
            v.literal("source_snapshot"),
            v.literal("source_excerpt"),
            v.literal("uploaded_doc"),
            v.literal("doc_chunk"),
            v.literal("claim"),
            v.literal("media")
        ),
        title: v.optional(v.string()),
        url: v.optional(v.string()),
        sourceId: v.optional(v.id("sources")),
        snapshotId: v.optional(v.id("sourceSnapshots")),
        excerptId: v.optional(v.id("sourceExcerpts")),
        documentId: v.optional(v.id("documents")),
        chunkId: v.optional(v.id("documentChunks")),
        claimId: v.optional(v.id("claims")),
        mediaId: v.optional(v.id("media")),
        quote: v.optional(v.string()),
        boundingBox: v.optional(v.object({
            x: v.number(),
            y: v.number(),
            w: v.number(),
            h: v.number()
        })),
        page: v.optional(v.number()),
        timecode: v.optional(v.object({
            startMs: v.number(),
            endMs: v.number()
        })),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_source", ["sourceId"])
        .index("by_claim", ["claimId"])
        .index("by_document", ["documentId"]),

    claimCitations: defineTable({
        claimId: v.id("claims"),
        citationId: v.id("citations"),
        treeId: v.id("trees"),
        isPrimary: v.boolean(),
        createdAt: v.number()
    }).index("by_claim", ["claimId"])
        .index("by_citation", ["citationId"])
        .index("by_tree", ["treeId"])
};
