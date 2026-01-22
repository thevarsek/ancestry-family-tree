import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "./auth";
import { insertAuditLog } from "./auditLog";

export const ensureAdmin = internalMutation({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        return userId;
    }
});

export const createInvitation = internalMutation({
    args: {
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
        clerkInvitationId: v.optional(v.string())
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
            clerkInvitationId: args.clerkInvitationId,
            invitedBy: userId,
            createdAt: now,
            expiresAt: now + 7 * 24 * 60 * 60 * 1000
        });

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId,
            action: "invitation_sent",
            entityType: "treeInvitation",
            entityId: invitationId,
            changes: { email: args.email, role: args.role },
            timestamp: now,
        });

        return { invitationId, token };
    }
});

export const getInvitationForCancelInternal = internalQuery({
    args: {
        treeId: v.id("trees"),
        invitationId: v.id("invitations")
    },
    handler: async (ctx, args) => {
        await requireTreeAdmin(ctx, args.treeId);
        const invitation = await ctx.db.get(args.invitationId);
        if (!invitation || invitation.treeId !== args.treeId) {
            throw new Error("Invitation not found");
        }
        return invitation;
    }
});

export const deleteInvitation = internalMutation({
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

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId,
            action: "invitation_cancelled",
            entityType: "treeInvitation",
            entityId: args.invitationId,
        });

        return args.treeId;
    }
});
