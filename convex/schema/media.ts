import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mediaTables = {
    media: defineTable({
        treeId: v.id("trees"),
        storageKind: v.union(
            v.literal("external_link"),
            v.literal("convex_file"),
            v.literal("future_media_service")
        ),
        storageId: v.optional(v.id("_storage")),
        canonicalUrl: v.optional(v.string()),
        embedUrl: v.optional(v.string()),
        provider: v.optional(v.union(
            v.literal("youtube"),
            v.literal("vimeo"),
            v.literal("google_drive"),
            v.literal("onedrive"),
            v.literal("other")
        )),
        type: v.union(
            v.literal("photo"),
            v.literal("document"),
            v.literal("audio"),
            v.literal("video")
        ),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        fileSizeBytes: v.optional(v.number()),
        durationMs: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        taggedPersonIds: v.optional(v.array(v.id("people"))),
        eventId: v.optional(v.id("events")),
        sourceId: v.optional(v.id("sources")),
        sourceUrl: v.optional(v.string()),
        ocrStatus: v.optional(v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("needs_premium_ocr")
        )),
        ocrText: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_tree_type", ["treeId", "type"])
        .index("by_storage", ["storageId"])
};
