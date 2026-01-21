import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiTables = {
    chatSessions: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        title: v.optional(v.string()),
        createdAt: v.number(),
        lastMessageAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_user", ["userId"]),

    chatMessages: defineTable({
        sessionId: v.id("chatSessions"),
        treeId: v.id("trees"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        citationIds: v.optional(v.array(v.id("citations"))),
        createdAt: v.number()
    }).index("by_session", ["sessionId"])
        .index("by_tree", ["treeId"]),

    researchSessions: defineTable({
        treeId: v.id("trees"),
        title: v.string(),
        objective: v.string(),
        status: v.union(
            v.literal("active"),
            v.literal("paused"),
            v.literal("completed")
        ),
        targetPersonIds: v.optional(v.array(v.id("people"))),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_status", ["status"]),

    researchFindings: defineTable({
        sessionId: v.id("researchSessions"),
        treeId: v.id("trees"),
        sourceUrl: v.string(),
        sourceTitle: v.string(),
        summary: v.string(),
        rawContent: v.optional(v.string()),
        relevanceScore: v.optional(v.number()),
        status: v.union(
            v.literal("pending_review"),
            v.literal("accepted"),
            v.literal("rejected"),
            v.literal("converted_to_claim")
        ),
        suggestedClaims: v.optional(v.any()),
        reviewedBy: v.optional(v.id("users")),
        reviewedAt: v.optional(v.number()),
        createdAt: v.number()
    }).index("by_session", ["sessionId"])
        .index("by_tree_status", ["treeId", "status"])
};
