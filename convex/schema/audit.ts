import { defineTable } from "convex/server";
import { v } from "convex/values";

export const auditTables = {
    auditLog: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        action: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        changes: v.optional(v.any()),
        timestamp: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_user", ["userId"])
};
