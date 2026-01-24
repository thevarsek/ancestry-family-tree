/**
 * Media query functions - read operations for media items
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireTreeAccess } from "./lib/auth";
import { linkEntityValidator } from "./lib/mediaHelpers";

/**
 * List all media in a tree
 */
export const listByTree = query({
    args: {
        treeId: v.id("trees"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const media = await ctx.db
            .query("media")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .take(args.limit ?? 200);

        return Promise.all(
            media.map(async (item) => ({
                ...item,
                storageUrl: item.storageId ? await ctx.storage.getUrl(item.storageId) : undefined,
            }))
        );
    },
});

/**
 * List all media for a person (owned + tagged)
 */
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

/**
 * List media linked to a specific entity (claim, source, or place)
 */
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

/**
 * Get a single media item by ID
 */
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

/**
 * Get storage URLs and crop info for multiple media items
 */
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
                focusY: item.focusY,
                width: item.width,
                height: item.height
            }))
        );
    }
});
