import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireTreeAccess, requireTreeAdmin, requireUser } from "./lib/auth";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const imageMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

const documentMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const audioMimeTypes = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg"
]);

type MediaType = "photo" | "document" | "audio" | "video";

const linkEntityValidator = v.union(
    v.literal("claim"),
    v.literal("source"),
    v.literal("place")
);

const linkInputValidator = v.object({
    entityType: linkEntityValidator,
    entityId: v.string()
});

function ensureSupportedMime(mimeType: string, mediaType: MediaType) {
    if (mediaType === "photo" && !imageMimeTypes.has(mimeType)) {
        throw new Error("Unsupported image type");
    }
    if (mediaType === "document" && !documentMimeTypes.has(mimeType)) {
        throw new Error("Unsupported document type");
    }
    if (mediaType === "audio" && !audioMimeTypes.has(mimeType)) {
        throw new Error("Unsupported audio type");
    }
}

async function validateEntityLink(
    ctx: { db: { get: (id: Id<"claims"> | Id<"sources"> | Id<"places">) => Promise<Doc<"claims"> | Doc<"sources"> | Doc<"places"> | null> } },
    treeId: Id<"trees">,
    link: { entityType: "claim" | "source" | "place"; entityId: string }
) {
    const entity = await ctx.db.get(link.entityId as Id<"claims"> | Id<"sources"> | Id<"places">);
    if (!entity || entity.treeId !== treeId) {
        throw new Error("Linked entity not found in tree");
    }
}

function chunkText(text: string, chunkSize = 1000, overlap = 200) {
    const chunks: string[] = [];
    const safeOverlap = Math.min(overlap, chunkSize - 1);
    let index = 0;
    while (index < text.length) {
        const end = Math.min(index + chunkSize, text.length);
        chunks.push(text.slice(index, end));
        index += chunkSize - safeOverlap;
    }
    return chunks.filter((chunk) => chunk.trim().length > 0);
}

export const processDocument = action({
    args: {
        mediaId: v.id("media"),
        storageId: v.id("_storage"),
        mimeType: v.string()
    },
    handler: async (ctx, args) => {
        const media = await ctx.runQuery(api.media.get, { mediaId: args.mediaId });
        if (!media) return;

        try {
            const fileUrl = await ctx.storage.getUrl(args.storageId);
            if (!fileUrl) {
                throw new Error("File not found in storage");
            }

            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error("Unable to download media file");
            }

            let text = "";
            if (args.mimeType === "application/pdf") {
                // For now, just mark as processed without actual OCR
                // OCR processing would require external services
                text = "PDF content extraction not implemented yet";
            } else if (args.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                // For now, just mark as processed without actual OCR
                text = "Word document content extraction not implemented yet";
            }

            await ctx.runMutation(api.media.updateDocumentProcessing, {
                mediaId: args.mediaId,
                text,
                status: "completed",
                ocrMethod: "imported"
            });
        } catch (error) {
            console.error("Failed to process document", error);
            await ctx.runMutation(api.media.updateDocumentProcessing, {
                mediaId: args.mediaId,
                text: "",
                status: "failed",
                ocrMethod: "imported"
            });
        }
    }
});

async function persistDocumentExtraction(
    ctx: MutationCtx,
    mediaId: Id<"media">,
    text: string,
    processingStatus: "completed" | "failed",
    ocrMethod: "tesseract" | "browser_ocr" | "mistral_ocr" | "imported"
) {
    const media = await ctx.db.get(mediaId);
    if (!media) return null;

    await ctx.db.patch(mediaId, {
        ocrStatus: processingStatus === "completed" ? "completed" : "failed",
        ocrText: processingStatus === "completed" ? text : undefined
    });

    const now = Date.now();
    const existingDoc = await ctx.db
        .query("documents")
        .withIndex("by_media", (q) => q.eq("mediaId", mediaId))
        .unique();

    const documentId = existingDoc
        ? existingDoc._id
        : await ctx.db.insert("documents", {
            treeId: media.treeId,
            mediaId,
            title: media.title,
            processingStatus,
            ocrMethod,
            createdAt: now
        });

    if (existingDoc) {
        await ctx.db.patch(existingDoc._id, {
            processingStatus,
            ocrMethod
        });
    }

    if (processingStatus === "failed" || !text.trim()) {
        return documentId;
    }

    const chunks = chunkText(text);
    for (let index = 0; index < chunks.length; index += 1) {
        const chunkId = await ctx.db.insert("documentChunks", {
            documentId,
            treeId: media.treeId,
            chunkIndex: index,
            content: chunks[index],
            createdAt: now
        });

        await ctx.db.insert("searchableContent", {
            treeId: media.treeId,
            entityType: "document_chunk",
            entityId: chunkId,
            content: chunks[index],
            updatedAt: now
        });
    }

    return documentId;
}

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireUser(ctx);
        return ctx.storage.generateUploadUrl();
    }
});

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
            // Start document processing asynchronously
            await ctx.scheduler.runAfter(0, api.media.processDocument, {
                mediaId,
                storageId: args.storageId,
                mimeType: args.mimeType
            });
        }

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "media_created",
            entityType: "media",
            entityId: mediaId,
            timestamp: now
        });

        return mediaId;
    }
});

export const listByPerson = query({
    args: { personId: v.id("people") },
    handler: async (ctx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return [];

        await requireTreeAccess(ctx, person.treeId);

        const owned = await ctx.db
            .query("media")
            .withIndex("by_owner_person", (q) => q.eq("ownerPersonId", args.personId))
            .collect();

        const taggedLinks = await ctx.db
            .query("mediaPeople")
            .withIndex("by_person", (q) => q.eq("personId", args.personId))
            .collect();

        const taggedMedia = await Promise.all(
            taggedLinks.map((link) => ctx.db.get(link.mediaId))
        );

        const mediaMap = new Map<string, Doc<"media">>();
        owned.forEach((item) => mediaMap.set(item._id, item));
        taggedMedia.filter(Boolean).forEach((item) => mediaMap.set(item!._id, item!));

        const media = Array.from(mediaMap.values())
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

        const tagLinks = await Promise.all(
            media.map(async (item) => ({
                mediaId: item._id,
                tags: await ctx.db
                    .query("mediaPeople")
                    .withIndex("by_media", (q) => q.eq("mediaId", item._id))
                    .collect()
            }))
        );

        const tagMap = new Map(
            tagLinks.map((entry) => [entry.mediaId, entry.tags.map((tag) => tag.personId)])
        );

        const linkInfo = await Promise.all(
            media.map(async (item) => ({
                mediaId: item._id,
                links: await ctx.db
                    .query("mediaLinks")
                    .withIndex("by_media", (q) => q.eq("mediaId", item._id))
                    .collect()
            }))
        );

        const linkMap = new Map(
            linkInfo.map((entry) => [
                entry.mediaId,
                entry.links.map((link) => ({
                    entityType: link.entityType,
                    entityId: link.entityId
                }))
            ])
        );

        return Promise.all(
            media.map(async (item) => ({
                ...item,
                storageUrl: item.storageId ? await ctx.storage.getUrl(item.storageId) : undefined,
                taggedPersonIds: tagMap.get(item._id) ?? [],
                links: linkMap.get(item._id) ?? []
            }))
        );
    }
});

export const listByEntity = query({
    args: {
        treeId: v.id("trees"),
        entityType: linkEntityValidator,
        entityId: v.string()
    },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const links = await ctx.db
            .query("mediaLinks")
            .withIndex("by_entity", (q) =>
                q.eq("entityType", args.entityType).eq("entityId", args.entityId)
            )
            .collect();

        const media = await Promise.all(links.map((link) => ctx.db.get(link.mediaId)));

        return Promise.all(
            media.filter(Boolean).map(async (item) => ({
                ...item!,
                storageUrl: item!.storageId ? await ctx.storage.getUrl(item!.storageId) : undefined
            }))
        );
    }
});

export const get = query({
    args: { mediaId: v.id("media") },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) return null;
        await requireTreeAccess(ctx, media.treeId);

        return {
            ...media,
            storageUrl: media.storageId ? await ctx.storage.getUrl(media.storageId) : undefined
        };
    }
});

export const getUrls = query({
    args: { mediaIds: v.array(v.id("media")) },
    handler: async (ctx, args) => {
        if (args.mediaIds.length === 0) return [];

        const mediaItems = await Promise.all(args.mediaIds.map((id) => ctx.db.get(id)));
        const filtered = mediaItems.filter(Boolean) as Doc<"media">[];

        if (filtered.length === 0) return [];

        await requireTreeAccess(ctx, filtered[0].treeId);

        return Promise.all(
            filtered.map(async (item) => ({
                mediaId: item._id,
                storageUrl: item.storageId ? await ctx.storage.getUrl(item.storageId) : undefined,
                zoomLevel: item.zoomLevel,
                focusX: item.focusX,
                focusY: item.focusY
            }))
        );
    }
});

export const updateLinks = mutation({
    args: {
        treeId: v.id("trees"),
        entityType: linkEntityValidator,
        entityId: v.string(),
        mediaIds: v.array(v.id("media"))
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        await validateEntityLink(ctx as never, args.treeId, {
            entityType: args.entityType,
            entityId: args.entityId
        });

        const existing = await ctx.db
            .query("mediaLinks")
            .withIndex("by_entity", (q) =>
                q.eq("entityType", args.entityType).eq("entityId", args.entityId)
            )
            .collect();

        const existingIds = new Set(existing.map((link) => link.mediaId));
        const nextIds = new Set(args.mediaIds);

        const toAdd = args.mediaIds.filter((id) => !existingIds.has(id));
        const toRemove = existing.filter((link) => !nextIds.has(link.mediaId));

        const now = Date.now();

        await Promise.all(
            toAdd.map(async (mediaId) => {
                await ctx.db.insert("mediaLinks", {
                    treeId: args.treeId,
                    mediaId,
                    entityType: args.entityType,
                    entityId: args.entityId,
                    createdBy: userId,
                    createdAt: now
                });
            })
        );

        await Promise.all(toRemove.map((link) => ctx.db.delete(link._id)));

        return { added: toAdd.length, removed: toRemove.length };
    }
});

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
