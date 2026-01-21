import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventTables = {
    events: defineTable({
        treeId: v.id("trees"),
        type: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.optional(v.string()),
        dateEnd: v.optional(v.string()),
        placeId: v.optional(v.id("places")),
        participantIds: v.array(v.id("people")),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_place", ["placeId"])
};
