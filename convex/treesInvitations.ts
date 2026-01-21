import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin, requireUser } from "./lib/auth";

export const invite = mutation({
    args: {
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user"))
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        const token = crypto.randomUUID();

        const invitationId = await ctx.db.insert("invitations", {
            treeId: args.treeId,
            email: args.email.toLowerCase(),
            role: args.role,
            token,
            invitedBy: userId,
            createdAt: now,
            expiresAt: now + 7 * 24 * 60 * 60 * 1000
        });

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "invitation_sent",
            entityType: "invitation",
            entityId: invitationId,
            changes: { email: args.email, role: args.role },
            timestamp: now
        });

        return { invitationId, token };
    }
});

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

        const existingMembership = await ctx.db
            .query("treeMemberships")
            .withIndex("by_tree_user", (q) =>
                q.eq("treeId", invitation.treeId).eq("userId", user._id)
            )
            .unique();

        if (existingMembership) {
            throw new Error("You are already a member of this tree");
        }

        await ctx.db.insert("treeMemberships", {
            treeId: invitation.treeId,
            userId: user._id,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            joinedAt: now
        });

        await ctx.db.patch(invitation._id, { acceptedAt: now });

        await ctx.db.insert("auditLog", {
            treeId: invitation.treeId,
            userId: user._id,
            action: "invitation_accepted",
            entityType: "invitation",
            entityId: invitation._id,
            timestamp: now
        });

        return invitation.treeId;
    }
});

export const getInvitations = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        await requireTreeAdmin(ctx, args.treeId);

        const invitations = await ctx.db
            .query("invitations")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        const now = Date.now();
        return invitations.filter((inv) => !inv.acceptedAt && inv.expiresAt > now);
    }
});

export const cancelInvitation = mutation({
    args: {
        treeId: v.id("trees"),
        invitationId: v.id("invitations")
    },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);

        const invitation = await ctx.db.get(args.invitationId);
        if (!invitation || invitation.treeId !== args.treeId) {
            throw new Error("Invitation not found");
        }

        await ctx.db.delete(args.invitationId);

        await ctx.db.insert("auditLog", {
            treeId: args.treeId,
            userId,
            action: "invitation_cancelled",
            entityType: "invitation",
            entityId: args.invitationId,
            timestamp: Date.now()
        });

        return args.treeId;
    }
});
