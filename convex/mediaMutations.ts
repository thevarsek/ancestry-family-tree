/**
 * Media mutation functions - write operations for media items
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { requireTreeAdmin, requireUser } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";
import {
    MAX_FILE_BYTES,
    linkInputValidator,
    ensureSupportedMime,
    validateEntityLink,
    persistDocumentExtraction,
} from "./lib/mediaHelpers";

// Import internal without triggering deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const internalApi = require("./_generated/api") as {
    internal: {
        lib: {
            mediaInternal: {
                getMedia: FunctionReference<"query", "internal">;
                updateDocumentProcessing: FunctionReference<"mutation", "internal">;
                processDocument: FunctionReference<"action", "internal">;
            };
        };
    };
};
const { internal } = internalApi;

/**
 * Generate an upload URL for file uploads
 */
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireUser(ctx);
        return ctx.storage.generateUploadUrl();
    }
});

/**
 * Create a new media item
 */
export const create = mutation({
    args: {
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
        zoomLevel: v.optional(v.number()),
        focusX: v.optional(v.number()),
        focusY: v.optional(v.number()),
        taggedPersonIds: v.optional(v.array(v.id("people"))),
        links: v.optional(v.array(linkInputValidator))
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);

        const owner = await ctx.db.get(args.ownerPersonId);
        if (!owner || owner.treeId !== args.treeId) {
            throw new Error("Owner must belong to the same tree");
        }

        if (args.storageKind === "convex_file") {
            if (!args.storageId || !args.mimeType) {
                throw new Error("Stored media requires a file and mime type");
            }
            ensureSupportedMime(args.mimeType, args.type);
            if (args.fileSizeBytes && args.fileSizeBytes > MAX_FILE_BYTES) {
                throw new Error("File is too large");
            }
        }

        if (args.storageKind === "external_link" && !args.canonicalUrl) {
            throw new Error("External media requires a URL");
        }

        if (args.taggedPersonIds?.length) {
            const taggedPeople = await Promise.all(
                args.taggedPersonIds.map((personId) => ctx.db.get(personId))
            );
            taggedPeople.forEach((person) => {
                if (!person || person.treeId !== args.treeId) {
                    throw new Error("Tagged person not found in tree");
                }
            });
        }

        if (args.links?.length) {
            await Promise.all(args.links.map((link) =>
                validateEntityLink(ctx as never, args.treeId, link)
            ));
        }

        const now = Date.now();
        const mediaId = await ctx.db.insert("media", {
            treeId: args.treeId,
            ownerPersonId: args.ownerPersonId,
            storageKind: args.storageKind,
            storageId: args.storageId,
            canonicalUrl: args.canonicalUrl,
            embedUrl: args.embedUrl,
            provider: args.provider,
            type: args.type,
            title: args.title,
            description: args.description,
            role: args.role,
            mimeType: args.mimeType,
            fileSizeBytes: args.fileSizeBytes,
            durationMs: args.durationMs,
            width: args.width,
            height: args.height,
            zoomLevel: args.zoomLevel,
            focusX: args.focusX,
            focusY: args.focusY,
            sourceUrl: args.canonicalUrl,
            ocrStatus: args.type === "document" ? "pending" : undefined,
            createdBy: userId,
            createdAt: now
        });

        if (args.taggedPersonIds?.length) {
            await Promise.all(
                args.taggedPersonIds.map(async (personId) => {
                    const existing = await ctx.db
                        .query("mediaPeople")
                        .withIndex("by_media_person", (q) =>
                            q.eq("mediaId", mediaId).eq("personId", personId)
                        )
                        .unique();
                    if (existing) return;
                    await ctx.db.insert("mediaPeople", {
                        treeId: args.treeId,
                        mediaId,
                        personId,
                        createdBy: userId,
                        createdAt: now
                    });
                })
            );
        }

        if (args.links?.length) {
            await Promise.all(
                args.links.map(async (link) => {
                    const existing = await ctx.db
                        .query("mediaLinks")
                        .withIndex("by_media_entity", (q) =>
                            q.eq("mediaId", mediaId)
                                .eq("entityType", link.entityType)
                                .eq("entityId", link.entityId)
                        )
                        .unique();
                    if (existing) return;
                    await ctx.db.insert("mediaLinks", {
                        treeId: args.treeId,
                        mediaId,
                        entityType: link.entityType,
                        entityId: link.entityId,
                        createdBy: userId,
                        createdAt: now
                    });
                })
            );
        }

        if (args.type === "document" && args.storageKind === "convex_file" && args.storageId && args.mimeType) {
            await ctx.db.patch(mediaId, { ocrStatus: "processing" });
            await ctx.scheduler.runAfter(0, internal.lib.mediaInternal.processDocument, {
                mediaId,
                storageId: args.storageId,
                mimeType: args.mimeType
            });
        }

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId,
            action: "media_created",
            entityType: "media",
            entityId: mediaId,
            timestamp: now,
        });

        return mediaId;
    }
});

/**
 * Update a media item's metadata, tags, and links
 */
export const update = mutation({
    args: {
        mediaId: v.id("media"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        zoomLevel: v.optional(v.number()),
        focusX: v.optional(v.number()),
        focusY: v.optional(v.number()),
        taggedPersonIds: v.optional(v.array(v.id("people"))),
        links: v.optional(v.array(linkInputValidator)),
    },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) {
            throw new Error("Media not found");
        }

        const { userId } = await requireTreeAdmin(ctx, media.treeId);
        const now = Date.now();

        // Update basic fields
        const updates: Partial<typeof media> = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.zoomLevel !== undefined) updates.zoomLevel = args.zoomLevel;
        if (args.focusX !== undefined) updates.focusX = args.focusX;
        if (args.focusY !== undefined) updates.focusY = args.focusY;

        if (Object.keys(updates).length > 0) {
            await ctx.db.patch(args.mediaId, updates);
        }

        // Update tagged people
        if (args.taggedPersonIds !== undefined) {
            const existingTags = await ctx.db
                .query("mediaPeople")
                .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
                .collect();

            const existingIds = new Set(existingTags.map(t => t.personId));
            const nextIds = new Set(args.taggedPersonIds);

            // Add new tags
            for (const personId of args.taggedPersonIds) {
                if (!existingIds.has(personId)) {
                    const person = await ctx.db.get(personId);
                    if (!person || person.treeId !== media.treeId) {
                        throw new Error("Tagged person not found in tree");
                    }
                    await ctx.db.insert("mediaPeople", {
                        treeId: media.treeId,
                        mediaId: args.mediaId,
                        personId,
                        createdBy: userId,
                        createdAt: now
                    });
                }
            }

            // Remove old tags
            for (const tag of existingTags) {
                if (!nextIds.has(tag.personId)) {
                    await ctx.db.delete(tag._id);
                }
            }
        }

        // Update links
        if (args.links !== undefined) {
            // Validate all links first
            await Promise.all(args.links.map((link) =>
                validateEntityLink(ctx as never, media.treeId, link)
            ));

            const existingLinks = await ctx.db
                .query("mediaLinks")
                .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
                .collect();

            const existingLinkKeys = new Set(
                existingLinks.map(l => `${l.entityType}:${l.entityId}`)
            );
            const nextLinkKeys = new Set(
                args.links.map(l => `${l.entityType}:${l.entityId}`)
            );

            // Add new links
            for (const link of args.links) {
                const key = `${link.entityType}:${link.entityId}`;
                if (!existingLinkKeys.has(key)) {
                    await ctx.db.insert("mediaLinks", {
                        treeId: media.treeId,
                        mediaId: args.mediaId,
                        entityType: link.entityType,
                        entityId: link.entityId,
                        createdBy: userId,
                        createdAt: now
                    });
                }
            }

            // Remove old links
            for (const link of existingLinks) {
                const key = `${link.entityType}:${link.entityId}`;
                if (!nextLinkKeys.has(key)) {
                    await ctx.db.delete(link._id);
                }
            }
        }

        await insertAuditLog(ctx, {
            treeId: media.treeId,
            userId,
            action: "media_updated",
            entityType: "media",
            entityId: args.mediaId,
            timestamp: now,
        });

        return args.mediaId;
    }
});

/**
 * Remove a media item and all related data
 */
export const remove = mutation({
    args: { mediaId: v.id("media") },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) {
            throw new Error("Media not found");
        }

        const { userId } = await requireTreeAdmin(ctx, media.treeId);
        const now = Date.now();

        const owner = await ctx.db.get(media.ownerPersonId);
        if (owner?.profilePhotoId === args.mediaId) {
            await ctx.db.patch(owner._id, { profilePhotoId: undefined, updatedAt: now });
        }

        const mediaPeople = await ctx.db
            .query("mediaPeople")
            .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
            .collect();

        const mediaLinks = await ctx.db
            .query("mediaLinks")
            .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
            .collect();

        await Promise.all(mediaPeople.map((link) => ctx.db.delete(link._id)));
        await Promise.all(mediaLinks.map((link) => ctx.db.delete(link._id)));

        const documents = await ctx.db
            .query("documents")
            .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
            .collect();

        for (const document of documents) {
            const chunks = await ctx.db
                .query("documentChunks")
                .withIndex("by_document", (q) => q.eq("documentId", document._id))
                .collect();

            for (const chunk of chunks) {
                const searchEntries = await ctx.db
                    .query("searchableContent")
                    .withIndex("by_entity", (q) =>
                        q.eq("entityType", "document_chunk").eq("entityId", chunk._id)
                    )
                    .collect();

                await Promise.all(searchEntries.map((entry) => ctx.db.delete(entry._id)));
                await ctx.db.delete(chunk._id);
            }

            await ctx.db.delete(document._id);
        }

        if (media.storageKind === "convex_file" && media.storageId) {
            await ctx.storage.delete(media.storageId);
        }

        await ctx.db.delete(args.mediaId);

        await insertAuditLog(ctx, {
            treeId: media.treeId,
            userId,
            action: "media_deleted",
            entityType: "media",
            entityId: args.mediaId,
            timestamp: now,
        });

        return args.mediaId;
    }
});

/**
 * Update document processing status after OCR
 */
export const updateDocumentProcessing = mutation({
    args: {
        mediaId: v.id("media"),
        text: v.string(),
        status: v.union(v.literal("completed"), v.literal("failed")),
        ocrMethod: v.union(
            v.literal("tesseract"),
            v.literal("browser_ocr"),
            v.literal("mistral_ocr"),
            v.literal("imported")
        )
    },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) return;

        await persistDocumentExtraction(ctx, args.mediaId, args.text, args.status, args.ocrMethod);
    }
});
