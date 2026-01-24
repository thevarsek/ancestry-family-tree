/**
 * Media link mutation functions - operations for linking media to entities
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";
import { linkEntityValidator, validateEntityLink } from "./lib/mediaHelpers";

/**
 * Update all media links for a specific entity (batch operation)
 */
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

/**
 * Link a media item to a specific entity (claim, source, or place)
 */
export const linkToEntity = mutation({
    args: {
        mediaId: v.id("media"),
        entityType: linkEntityValidator,
        entityId: v.string(),
    },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) {
            throw new Error("Media not found");
        }

        const { userId } = await requireTreeAdmin(ctx, media.treeId);

        // Validate the entity exists
        await validateEntityLink(ctx as never, media.treeId, {
            entityType: args.entityType,
            entityId: args.entityId,
        });

        // Check if link already exists
        const existing = await ctx.db
            .query("mediaLinks")
            .withIndex("by_media_entity", (q) =>
                q.eq("mediaId", args.mediaId)
                    .eq("entityType", args.entityType)
                    .eq("entityId", args.entityId)
            )
            .unique();

        if (existing) return existing._id;

        const now = Date.now();
        const linkId = await ctx.db.insert("mediaLinks", {
            treeId: media.treeId,
            mediaId: args.mediaId,
            entityType: args.entityType,
            entityId: args.entityId,
            createdBy: userId,
            createdAt: now,
        });

        await insertAuditLog(ctx, {
            treeId: media.treeId,
            userId,
            action: "media_linked",
            entityType: "mediaLink",
            entityId: linkId,
            timestamp: now,
        });

        return linkId;
    }
});

/**
 * Unlink a media item from a specific entity
 */
export const unlinkFromEntity = mutation({
    args: {
        mediaId: v.id("media"),
        entityType: linkEntityValidator,
        entityId: v.string(),
    },
    handler: async (ctx, args) => {
        const media = await ctx.db.get(args.mediaId);
        if (!media) {
            throw new Error("Media not found");
        }

        const { userId } = await requireTreeAdmin(ctx, media.treeId);
        const now = Date.now();

        const link = await ctx.db
            .query("mediaLinks")
            .withIndex("by_media_entity", (q) =>
                q.eq("mediaId", args.mediaId)
                    .eq("entityType", args.entityType)
                    .eq("entityId", args.entityId)
            )
            .unique();

        if (!link) return null;

        await ctx.db.delete(link._id);

        await insertAuditLog(ctx, {
            treeId: media.treeId,
            userId,
            action: "media_unlinked",
            entityType: "mediaLink",
            entityId: link._id,
            timestamp: now,
        });

        return link._id;
    }
});
