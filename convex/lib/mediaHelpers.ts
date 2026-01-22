/**
 * Shared constants, validators, and helper functions for media operations.
 */
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const imageMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

export const documentMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export const audioMimeTypes = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg"
]);

export type MediaType = "photo" | "document" | "audio" | "video";

// ============================================================================
// Validators
// ============================================================================

export const linkEntityValidator = v.union(
    v.literal("claim"),
    v.literal("source"),
    v.literal("place")
);

export const linkInputValidator = v.object({
    entityType: linkEntityValidator,
    entityId: v.string()
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates that a MIME type is supported for the given media type.
 * @throws Error if the MIME type is not supported
 */
export function ensureSupportedMime(mimeType: string, mediaType: MediaType): void {
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

/**
 * Validates that an entity link points to a valid entity in the tree.
 * @throws Error if the entity is not found or doesn't belong to the tree
 */
export async function validateEntityLink(
    ctx: { db: { get: (id: Id<"claims"> | Id<"sources"> | Id<"places">) => Promise<Doc<"claims"> | Doc<"sources"> | Doc<"places"> | null> } },
    treeId: Id<"trees">,
    link: { entityType: "claim" | "source" | "place"; entityId: string }
): Promise<void> {
    const entity = await ctx.db.get(link.entityId as Id<"claims"> | Id<"sources"> | Id<"places">);
    if (!entity || entity.treeId !== treeId) {
        throw new Error("Linked entity not found in tree");
    }
}

/**
 * Splits text into overlapping chunks for document indexing.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
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

/**
 * Persists document extraction results and creates searchable content chunks.
 */
export async function persistDocumentExtraction(
    ctx: MutationCtx,
    mediaId: Id<"media">,
    text: string,
    processingStatus: "completed" | "failed",
    ocrMethod: "tesseract" | "browser_ocr" | "mistral_ocr" | "imported"
): Promise<Id<"documents"> | null> {
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
