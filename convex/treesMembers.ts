import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";

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
                        joinedAt: m.joinedAt
                    }
                    : null;
            })
        );

        return members.filter(Boolean);
    }
});

export const updateMemberRole = mutation({
    args: {
        treeId: v.id("trees"),
        userId: v.id("users"),
        role: v.union(v.literal("admin"), v.literal("user"))
    },
    handler: async (ctx, args) => {
        const { userId: adminId } = await requireTreeAdmin(ctx, args.treeId);

        if (args.userId === adminId) {
            throw new Error("You cannot change your own role");
        }

        const membership = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree_user", (q) =>
                q.eq("treeId", args.treeId).eq("userId", args.userId)
            )
            .unique();

        if (!membership) {
            throw new Error("User is not a member of this tree");
        }

        await ctx.db.patch(membership._id, { role: args.role });

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId: adminId,
            action: "member_role_updated",
            entityType: "treeMembership",
            entityId: membership._id,
            changes: { role: args.role },
        });

        return membership._id;
    }
});

export const removeMember = mutation({
    args: {
        treeId: v.id("trees"),
        userId: v.id("users")
    },
    handler: async (ctx, args) => {
        const { userId: adminId } = await requireTreeAdmin(ctx, args.treeId);

        if (args.userId === adminId) {
            throw new Error("You cannot remove yourself from the tree");
        }

        const membership = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree_user", (q) =>
                q.eq("treeId", args.treeId).eq("userId", args.userId)
            )
            .unique();

        if (!membership) {
            throw new Error("User is not a member of this tree");
        }

        await ctx.db.delete(membership._id);

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId: adminId,
            action: "member_removed",
            entityType: "treeMembership",
            entityId: membership._id,
        });

        return args.treeId;
    }
});
