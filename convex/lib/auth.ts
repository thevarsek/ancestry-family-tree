import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Get the current user from Clerk auth identity
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return null;
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) =>
            q.eq("externalId", identity.subject)
        )
        .unique();

    return user;
}

/**
 * Require authenticated user - throws if not logged in
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
    const user = await getCurrentUser(ctx);
    if (!user) {
        throw new ConvexError("You must be logged in to perform this action");
    }
    return user;
}

/**
 * Check if user has access to a tree and return their role
 */
export async function getTreeMembership(
    ctx: QueryCtx | MutationCtx,
    treeId: Id<"trees">,
    userId: Id<"users">
) {
    const membership = await ctx.db
        .query("treeMemberships")
        .withIndex("by_tree_user", (q) =>
            q.eq("treeId", treeId).eq("userId", userId)
        )
        .unique();

    return membership;
}

/**
 * Require access to a tree - throws if user is not a member
 */
export async function requireTreeAccess(
    ctx: QueryCtx | MutationCtx,
    treeId: Id<"trees">,
    requiredRole?: "admin" | "user"
): Promise<{ userId: Id<"users">; role: "admin" | "user" }> {
    const user = await requireUser(ctx);

    const membership = await getTreeMembership(ctx, treeId, user._id);

    if (!membership) {
        throw new ConvexError("You do not have access to this tree");
    }

    if (requiredRole === "admin" && membership.role !== "admin") {
        throw new ConvexError("Admin access required for this action");
    }

    return { userId: user._id, role: membership.role };
}

/**
 * Require admin access to a tree
 */
export async function requireTreeAdmin(
    ctx: QueryCtx | MutationCtx,
    treeId: Id<"trees">
) {
    return requireTreeAccess(ctx, treeId, "admin");
}
