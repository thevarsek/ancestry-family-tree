import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const acceptPendingInvitations = async (
    ctx: MutationCtx,
    userId: Id<"users">,
    email: string | undefined
) => {
    if (!email) {
        return;
    }

    const normalizedEmail = email.toLowerCase();
    const invitations = await ctx.db
        .query("invitations")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .collect();

    const now = Date.now();
    const validInvitations = invitations.filter((invitation) =>
        !invitation.acceptedAt && invitation.expiresAt > now
    );

    for (const invitation of validInvitations) {
        const existingMembership = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree_user", (q) =>
                q.eq("treeId", invitation.treeId).eq("userId", userId)
            )
            .unique();

        if (!existingMembership) {
            await ctx.db.insert("treeMemberships", {
                treeId: invitation.treeId,
                userId,
                role: invitation.role,
                invitedBy: invitation.invitedBy,
                joinedAt: now
            });

            await ctx.db.insert("auditLog", {
                treeId: invitation.treeId,
                userId,
                action: "invitation_accepted",
                entityType: "invitation",
                entityId: invitation._id,
                timestamp: now
            });
        }

        await ctx.db.patch(invitation._id, { acceptedAt: now });
    }
};

/**
 * Get or create user from Clerk auth
 */
export const getOrCreate = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        // Check for existing user
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
            .unique();

        if (existingUser) {
            // Update user info if changed
            const updates: Record<string, string> = {};
            if (identity.email && identity.email !== existingUser.email) {
                updates.email = identity.email;
            }
            if (identity.name && identity.name !== existingUser.name) {
                updates.name = identity.name;
            }
            if (identity.pictureUrl && identity.pictureUrl !== existingUser.avatarUrl) {
                updates.avatarUrl = identity.pictureUrl;
            }

            if (Object.keys(updates).length > 0) {
                await ctx.db.patch(existingUser._id, updates);
            }

            await acceptPendingInvitations(ctx, existingUser._id, identity.email);
            return existingUser._id;
        }

        // Create new user
        const userId = await ctx.db.insert("users", {
            externalId: identity.subject,
            email: identity.email ?? "",
            name: identity.name ?? identity.email ?? "Anonymous",
            avatarUrl: identity.pictureUrl,
            createdAt: Date.now(),
        });

        await acceptPendingInvitations(ctx, userId, identity.email);
        return userId;
    },
});

/**
 * Get current user profile
 */
export const me = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUser(ctx);
    },
});

/**
 * Update current user profile
 */
export const updateProfile = mutation({
    args: {
        name: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);

        const updates: Record<string, string> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

        if (Object.keys(updates).length > 0) {
            await ctx.db.patch(user._id, updates);
        }

        return user._id;
    },
});
