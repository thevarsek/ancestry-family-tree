import { defineTable } from "convex/server";
import { v } from "convex/values";

export const placeTables = {
    places: defineTable({
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
        geocodePrecision: v.optional(v.union(
            v.literal("rooftop"),
            v.literal("street"),
            v.literal("locality"),
            v.literal("region"),
            v.literal("approximate"),
            v.literal("user_pin")
        )),
        geocodeMethod: v.optional(v.union(
            v.literal("google_maps"),
            v.literal("manual"),
            v.literal("imported")
        )),
        historicalNote: v.optional(v.string()),
        existsToday: v.optional(v.boolean()),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .searchIndex("search_places", {
            searchField: "displayName",
            filterFields: ["treeId"]
        })
};
