import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Audit log changes track what was modified in an action.
 * Since different actions track different data (person updates, place changes,
 * role changes, etc.), we use v.any() to accommodate all possible change shapes.
 * 
 * Common patterns include:
 * - Entity updates: { fieldName: newValue, ... } (any entity field)
 * - Status changes: { status, resolution, resolutionNote, applyAlternativeValue }
 * - Role changes: { role, previousRole, email }
 * - Relationship changes: { p1, p2, type }
 * - Place changes: { city, country, state, displayName, latitude, longitude, geocodePrecision }
 * - Person changes: { givenNames, surnames, profilePhotoId, ... }
 * - Claim changes: { claimType, value, ... }
 */
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
