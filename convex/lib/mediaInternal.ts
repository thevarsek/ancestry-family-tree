import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { requireTreeAccess } from "./auth";

// Import internal without triggering deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const internalApi = require("../_generated/api") as {
    internal: {
        lib: {
            mediaInternal: {
                getMedia: FunctionReference<"query", "internal">;
                updateDocumentProcessing: FunctionReference<"mutation", "internal">;
            };
        };
    };
};
const { internal } = internalApi;

export const getMedia = internalQuery({
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

export const updateDocumentProcessing = internalMutation({
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
        if (!media) return null;

        await ctx.db.patch(args.mediaId, {
            ocrStatus: args.status === "completed" ? "completed" : "failed",
            ocrText: args.status === "completed" ? args.text : undefined
        });

        const now = Date.now();
        const existingDoc = await ctx.db
            .query("documents")
            .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
            .unique();

        const documentId = existingDoc
            ? existingDoc._id
            : await ctx.db.insert("documents", {
                treeId: media.treeId,
                mediaId: args.mediaId,
                title: media.title,
                processingStatus: args.status,
                ocrMethod: args.ocrMethod,
                createdAt: now
            });

        if (existingDoc) {
            await ctx.db.patch(existingDoc._id, {
                processingStatus: args.status,
                ocrMethod: args.ocrMethod
            });
        }

        if (args.status === "failed" || !args.text.trim()) {
            return documentId;
        }

        const chunks = chunkText(args.text);
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
});

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

export const processDocument = internalAction({
    args: {
        mediaId: v.id("media"),
        storageId: v.id("_storage"),
        mimeType: v.string()
    },
    handler: async (ctx, args) => {
        const media = await ctx.runQuery(internal.lib.mediaInternal.getMedia, { mediaId: args.mediaId });
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

            await ctx.runMutation(internal.lib.mediaInternal.updateDocumentProcessing, {
                mediaId: args.mediaId,
                text,
                status: "completed",
                ocrMethod: "imported"
            });
        } catch (error) {
            console.error("Failed to process document", error);
            await ctx.runMutation(internal.lib.mediaInternal.updateDocumentProcessing, {
                mediaId: args.mediaId,
                text: "",
                status: "failed",
                ocrMethod: "imported"
            });
        }
    }
});
