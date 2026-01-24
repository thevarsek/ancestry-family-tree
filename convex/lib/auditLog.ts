import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Audit log action types for type safety
 */
export type AuditAction =
    // Person actions
    | "person_created"
    | "person_updated"
    | "person_deleted"
    | "person_merged"
    | "person_profile_photo_set"
    // Claim actions
    | "claim_created"
    | "claim_updated"
    | "claim_deleted"
    | "claim_draft"
    | "claim_disputed"
    | "claim_accepted"
    // Dispute actions
    | "dispute_created"
    | "dispute_accepted"
    | "dispute_rejected"
    | "dispute_deleted"
    // Citation actions
    | "citation_added"
    | "citation_linked"
    | "citation_removed"
    // Source actions
    | "source_created"
    | "source_updated"
    | "source_deleted"
    | "source_linked"
    | "source_unlinked"
    // Media actions
    | "media_created"
    | "media_uploaded"
    | "media_updated"
    | "media_deleted"
    | "media_linked"
    | "media_unlinked"
    // Place actions
    | "place_created"
    | "place_updated"
    | "place_deleted"
    // Relationship actions
    | "relationship_created"
    | "relationship_deleted"
    // Tree actions
    | "tree_created"
    | "tree_updated"
    | "tree_settings_updated"
    // Member actions
    | "member_added"
    | "member_removed"
    | "member_role_changed"
    | "member_role_updated"
    // Invitation actions
    | "invitation_created"
    | "invitation_sent"
    | "invitation_accepted"
    | "invitation_revoked"
    | "invitation_cancelled";

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
    | "person"
    | "claim"
    | "claimDispute"
    | "claimCitation"
    | "source"
    | "sourceClaim"
    | "media"
    | "mediaLink"
    | "place"
    | "relationship"
    | "tree"
    | "treeMembership"
    | "treeInvitation"
    | "user";

/**
 * Parameters for inserting an audit log entry
 */
export interface InsertAuditLogParams {
    treeId: Id<"trees">;
    userId: Id<"users">;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    changes?: Record<string, unknown>;
    timestamp?: number;
}

/**
 * Insert an audit log entry with automatic timestamp
 *
 * @example
 * // Basic usage
 * await insertAuditLog(ctx, {
 *     treeId: args.treeId,
 *     userId,
 *     action: "person_created",
 *     entityType: "person",
 *     entityId: personId,
 * });
 *
 * @example
 * // With changes tracking
 * await insertAuditLog(ctx, {
 *     treeId: claim.treeId,
 *     userId,
 *     action: "claim_updated",
 *     entityType: "claim",
 *     entityId: args.claimId,
 *     changes: { claimType: args.claimType, value: args.value },
 * });
 *
 * @example
 * // With explicit timestamp (for consistency with other operations)
 * await insertAuditLog(ctx, {
 *     treeId: args.treeId,
 *     userId,
 *     action: "media_uploaded",
 *     entityType: "media",
 *     entityId: mediaId,
 *     timestamp: now, // Use same timestamp as the entity creation
 * });
 */
export async function insertAuditLog(
    ctx: MutationCtx,
    params: InsertAuditLogParams
): Promise<Id<"auditLog">> {
    const { treeId, userId, action, entityType, entityId, changes, timestamp } = params;

    return await ctx.db.insert("auditLog", {
        treeId,
        userId,
        action,
        entityType,
        entityId,
        changes,
        timestamp: timestamp ?? Date.now(),
    });
}
