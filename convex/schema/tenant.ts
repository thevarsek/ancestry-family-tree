import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tenantTables = {
    trees: defineTable({
        name: v.string(),
        description: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
        settings: v.optional(v.object({
            isPublic: v.boolean(),
            allowMergeRequests: v.boolean(),
            privacyMode: v.optional(v.union(
                v.literal("hide_living_birth_year"),
                v.literal("hide_living_full_date"),
                v.literal("configurable")
            ))
        }))
    }).index("by_creator", ["createdBy"]),

    users: defineTable({
        externalId: v.string(),
        email: v.string(),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        createdAt: v.number()
    }).index("by_external_id", ["externalId"])
        .index("by_email", ["email"]),

    treeMemberships: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        role: v.union(v.literal("admin"), v.literal("user")),
        invitedBy: v.optional(v.id("users")),
        joinedAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_user", ["userId"])
        .index("by_tree_user", ["treeId", "userId"]),

    invitations: defineTable({
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
        token: v.string(),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        expiresAt: v.number(),
        acceptedAt: v.optional(v.number())
    }).index("by_tree", ["treeId"])
        .index("by_email", ["email"])
        .index("by_token", ["token"])
};
