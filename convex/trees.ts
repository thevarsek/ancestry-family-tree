import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireTreeAccess, requireTreeAdmin } from "./lib/auth";

/**
 * List all trees the current user has access to
 */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx);

        const memberships = await ctx.db
            .query("treeMemberships")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const trees = await Promise.all(
            memberships.map(async (m) => {
                const tree = await ctx.db.get(m.treeId);
                return tree ? { ...tree, role: m.role } : null;
            })
        );

        return trees.filter(Boolean);
    },
});

/**
 * Get a single tree by ID
 */
export const get = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        const { role } = await requireTreeAccess(ctx, args.treeId);
        const tree = await ctx.db.get(args.treeId);
        return tree ? { ...tree, role } : null;
    },
});

/**
 * Create a new tree
 */
export const create = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);
        const now = Date.now();

        // Create the tree
        const treeId = await ctx.db.insert("trees", {
            name: args.name,
            description: args.description,
            createdBy: user._id,
            createdAt: now,
            settings: {
                isPublic: false,
                allowMergeRequests: false,
                privacyMode: "configurable",
            },
        });

        // Add creator as admin
        await ctx.db.insert("treeMemberships", {
            treeId,
            userId: user._id,
            role: "admin",
            joinedAt: now,
        });

        // Log the action
        await ctx.db.insert("auditLog", {
            treeId,
            userId: user._id,
            action: "tree_created",
            entityType: "tree",
            entityId: treeId,
            timestamp: now,
        });

        return treeId;
    },
});

/**
 * Update tree settings
 */
export const update = mutation({
    args: {
        treeId: v.id("trees"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        settings: v.optional(
            v.object({
                isPublic: v.optional(v.boolean()),
                allowMergeRequests: v.optional(v.boolean()),
                privacyMode: v.optional(
                    v.union(
                        v.literal("hide_living_birth_year"),
                        v.literal("hide_living_full_date"),
                        v.literal("configurable")
                    )
                ),
            })
        ),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const tree = await ctx.db.get(args.treeId);
        if (!tree) {
            throw new Error("Tree not found");
        }

        const updates: Partial<typeof tree> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.description !== undefined) updates.description = args.description;
        if (args.settings !== undefined) {
            const currentSettings = tree.settings ?? {
                isPublic: false,
                allowMergeRequests: false,
                privacyMode: "configurable" as const,
            };
            updates.settings = {
                isPublic: args.settings.isPublic ?? currentSettings.isPublic,
                allowMergeRequests: args.settings.allowMergeRequests ?? currentSettings.allowMergeRequests,
                privacyMode: args.settings.privacyMode ?? currentSettings.privacyMode,
            };
        }

        await ctx.db.patch(args.treeId, updates);

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "tree_updated",
            entityType: "tree",
            entityId: args.treeId,
            changes: updates,
            timestamp: Date.now(),
        });

        return args.treeId;
    },
});

/**
 * Get tree members
 */
export const getMembers = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const memberships = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        const members = await Promise.all(
            memberships.map(async (m) => {
                const user = await ctx.db.get(m.userId);
                return user
                    ? {
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        avatarUrl: user.avatarUrl,
                        role: m.role,
                        joinedAt: m.joinedAt,
                    }
                    : null;
            })
        );

        return members.filter(Boolean);
    },
});

/**
 * Invite a user to a tree
 */
export const invite = mutation({
    args: {
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        // Generate invitation token
        const token = crypto.randomUUID();

        const invitationId = await ctx.db.insert("invitations", {
            treeId: args.treeId,
            email: args.email.toLowerCase(),
            role: args.role,
            token,
            invitedBy: userId,
            createdAt: now,
            expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "invitation_sent",
            entityType: "invitation",
            entityId: invitationId,
            changes: { email: args.email, role: args.role },
            timestamp: now,
        });

        return { invitationId, token };
    },
});

/**
 * Accept an invitation
 */
export const acceptInvitation = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);
        const now = Date.now();

        const invitation = await ctx.db
            .query("invitations")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();

        if (!invitation) {
            throw new Error("Invalid invitation");
        }

        if (invitation.expiresAt < now) {
            throw new Error("Invitation has expired");
        }

        if (invitation.acceptedAt) {
            throw new Error("Invitation has already been used");
        }

        // Check if already a member
        const existingMembership = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree_user", (q) =>
                q.eq("treeId", invitation.treeId).eq("userId", user._id)
            )
            .unique();

        if (existingMembership) {
            throw new Error("You are already a member of this tree");
        }

        // Create membership
        await ctx.db.insert("treeMemberships", {
            treeId: invitation.treeId,
            userId: user._id,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            joinedAt: now,
        });

        // Mark invitation as accepted
        await ctx.db.patch(invitation._id, { acceptedAt: now });

        await ctx.db.insert("auditLog", {
            treeId: invitation.treeId,
            userId: user._id,
            action: "invitation_accepted",
            entityType: "invitation",
            entityId: invitation._id,
            timestamp: now,
        });

        return invitation.treeId;
    },
});
