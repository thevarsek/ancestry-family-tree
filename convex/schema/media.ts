import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mediaTables = {
    media: defineTable({
        treeId: v.id("trees"),
        ownerPersonId: v.id("people"),
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
        title: v.string(),
        description: v.optional(v.string()),
        role: v.optional(v.union(
            v.literal("profile_photo"),
            v.literal("attachment")
        )),
        mimeType: v.optional(v.string()),
        fileSizeBytes: v.optional(v.number()),
        durationMs: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        sourceUrl: v.optional(v.string()),
        ocrStatus: v.optional(v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("needs_premium_ocr")
        )),
        ocrText: v.optional(v.string()),
        // Profile photo customization
        zoomLevel: v.optional(v.number()),
        focusX: v.optional(v.number()),
        focusY: v.optional(v.number()),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_tree_type", ["treeId", "type"])
        .index("by_storage", ["storageId"])
        .index("by_owner_person", ["ownerPersonId"]),

    mediaPeople: defineTable({
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        personId: v.id("people"),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_media", ["mediaId"])
        .index("by_person", ["personId"])
        .index("by_media_person", ["mediaId", "personId"])
        .index("by_tree", ["treeId"]),

    mediaLinks: defineTable({
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        entityType: v.union(
            v.literal("claim"),
            v.literal("source"),
            v.literal("place")
        ),
        entityId: v.string(),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_media", ["mediaId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_media_entity", ["mediaId", "entityType", "entityId"])
        .index("by_tree", ["treeId"])
};
