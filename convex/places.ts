import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";

/**
 * List all places in a tree
 */
export const list = query({
    args: {
        treeId: v.id("trees"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const places = await ctx.db
            .query("places")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .take(args.limit ?? 100);

        return places;
    },
});

/**
 * Get a single place
 */
export const get = query({
    args: { placeId: v.id("places") },
    handler: async (ctx: QueryCtx, args) => {
        const place = await ctx.db.get(args.placeId);
        if (!place) return null;

        await requireTreeAccess(ctx, place.treeId);
        return place;
    },
});

/**
 * Search places by name
 */
export const search = query({
    args: {
        treeId: v.id("trees"),
        query: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        if (!args.query.trim()) {
            return [];
        }

        const results = await ctx.db
            .query("places")
            .withSearchIndex("search_places", (q) =>
                q.search("displayName", args.query).eq("treeId", args.treeId)
            )
            .take(20);

        return results;
    },
});

/**
 * Create a new place (supports map-driven creation with user_pin)
 */
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        displayName: v.string(),
        addressLine1: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        geocodePrecision: v.optional(
            v.union(
                v.literal("rooftop"),
                v.literal("street"),
                v.literal("locality"),
                v.literal("region"),
                v.literal("approximate"),
                v.literal("user_pin")
            )
        ),
        geocodeMethod: v.optional(
            v.union(
                v.literal("google_maps"),
                v.literal("manual"),
                v.literal("imported")
            )
        ),
        historicalNote: v.optional(v.string()),
        existsToday: v.optional(v.boolean()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        const placeId = await ctx.db.insert("places", {
            ...args,
            createdBy: userId,
            createdAt: now,
        });

        // Add to searchable content
        const searchableText = [
            args.displayName,
            args.addressLine1,
            args.city,
            args.state,
            args.country,
            args.historicalNote,
        ]
            .filter(Boolean)
            .join(" ");

        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "place",
            entityId: placeId,
            content: searchableText,
            placeId,
            updatedAt: now,
        });

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "place_created",
            entityType: "place",
            entityId: placeId,
            timestamp: now,
        });

        return placeId;
    },
});

/**
 * Update a place
 */
export const update = mutation({
    args: {
        placeId: v.id("places"),
        displayName: v.optional(v.string()),
        addressLine1: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        geocodePrecision: v.optional(
            v.union(
                v.literal("rooftop"),
                v.literal("street"),
                v.literal("locality"),
                v.literal("region"),
                v.literal("approximate"),
                v.literal("user_pin")
            )
        ),
        historicalNote: v.optional(v.string()),
        existsToday: v.optional(v.boolean()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const place = await ctx.db.get(args.placeId);
        if (!place) throw new Error("Place not found");

        const { userId } = await requireTreeAdmin(ctx, place.treeId);
        const now = Date.now();

        const { placeId, ...updates } = args;
        await ctx.db.patch(placeId, updates);

        // Update searchable content
        const updatedPlace = { ...place, ...updates };
        const searchableText = [
            updatedPlace.displayName,
            updatedPlace.addressLine1,
            updatedPlace.city,
            updatedPlace.state,
            updatedPlace.country,
            updatedPlace.historicalNote,
        ]
            .filter(Boolean)
            .join(" ");

        const existingContent = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) =>
                q.eq("entityType", "place").eq("entityId", placeId)
            )
            .unique();

        if (existingContent) {
            await ctx.db.patch(existingContent._id, {
                content: searchableText,
                updatedAt: now,
            });
        }

        await ctx.db.insert("auditLog", {
            treeId: place.treeId,
            userId,
            action: "place_updated",
            entityType: "place",
            entityId: placeId,
            changes: updates,
            timestamp: now,
        });

        return placeId;
    },
});

/**
 * Get all claims linked to a place
 */
export const getClaims = query({
    args: { placeId: v.id("places") },
    handler: async (ctx: QueryCtx, args) => {
        const place = await ctx.db.get(args.placeId);
        if (!place) return null;

        await requireTreeAccess(ctx, place.treeId);

        // Get all claims with this place
        const claims = await ctx.db
            .query("claims")
            .withIndex("by_tree", (q) => q.eq("treeId", place.treeId))
            .collect();

        // Filter to claims with this place
        const placeClaims = claims.filter(
            (claim) => claim.value.placeId === args.placeId
        );

        // Get related people
        const personClaims = placeClaims.filter(
            (claim) => claim.subjectType === "person"
        );
        const personIds = personClaims.map(
            (claim) => claim.subjectId as Id<"people">
        );

        const people = await Promise.all(
            [...new Set(personIds)].map((id) => ctx.db.get(id))
        );
        const peopleMap = new Map(
            people.filter(Boolean).map((p) => [p!._id, p])
        );

        return placeClaims.map((c) => ({
            ...c,
            person:
                c.subjectType === "person"
                    ? peopleMap.get(c.subjectId as Id<"people">)
                    : undefined,
        }));
    },
});
