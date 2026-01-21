import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./lib/auth";

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
