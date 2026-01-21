import { defineTable } from "convex/server";
import { v } from "convex/values";

export const noteTables = {
    notes: defineTable({
        treeId: v.id("trees"),
        attachedToType: v.union(
            v.literal("tree"),
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event"),
            v.literal("claim"),
            v.literal("place"),
            v.literal("source"),
            v.literal("media")
        ),
        attachedToId: v.string(),
        title: v.optional(v.string()),
        content: v.string(),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_attachment", ["attachedToType", "attachedToId"])
        .searchIndex("search_notes", {
            searchField: "content",
            filterFields: ["treeId"]
        })
};
