import { action, mutation, query, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { requireTreeAdmin, requireUser } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";
import type { Id } from "./_generated/dataModel";

const clerkInvitationEndpoint = "https://api.clerk.com/v1/invitations";

const getClerkSecretKey = () => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
        throw new Error("Missing CLERK_SECRET_KEY in Convex environment variables");
    }
    return secretKey;
};

const createClerkInvitation = async (email: string, treeId: Id<"trees">, role: string) => {
    const response = await fetch(clerkInvitationEndpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getClerkSecretKey()}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email_address: email,
            public_metadata: {
                treeId,
                role
            }
        })
    });

    if (!response.ok) {
        let message = "Failed to create Clerk invitation";
        try {
            const data = await response.json();
            const clerkMessage = data?.errors?.[0]?.message;
            if (clerkMessage) {
                message = clerkMessage;
            }
        } catch (error) {
            console.error("Failed to read Clerk error response:", error);
        }
        throw new Error(message);
    }

    return await response.json() as { id: string };
};

const revokeClerkInvitation = async (invitationId: string) => {
    const response = await fetch(`${clerkInvitationEndpoint}/${invitationId}/revoke`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getClerkSecretKey()}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        let message = "Failed to revoke Clerk invitation";
        try {
            const data = await response.json();
            const clerkMessage = data?.errors?.[0]?.message;
            if (clerkMessage) {
                message = clerkMessage;
            }
        } catch (error) {
            console.error("Failed to read Clerk revoke error response:", error);
        }
        throw new Error(message);
    }
};

export const ensureAdmin = mutation({
    args: { treeId: v.id("trees") },
    handler: async (ctx: MutationCtx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        return userId;
    }
});

export const createInvitation = mutation({
    args: {
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
        clerkInvitationId: v.optional(v.string())
    },
    handler: async (ctx: MutationCtx, args) => {
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

export const invite = action({
    args: {
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user"))
    },
    handler: async (ctx: ActionCtx, args): Promise<{ invitationId: Id<"invitations">; token: string }> => {
        await ctx.runMutation(api.treesInvitations.ensureAdmin, { treeId: args.treeId });
        const clerkInvitation = await createClerkInvitation(args.email, args.treeId, args.role);
        return await ctx.runMutation(api.treesInvitations.createInvitation, {
            ...args,
            clerkInvitationId: clerkInvitation.id
        });
    }
});

export const acceptInvitation = mutation({
    args: { token: v.string() },
    handler: async (ctx: MutationCtx, args) => {
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

        await insertAuditLog(ctx, {
            treeId: invitation.treeId,
            userId: user._id,
            action: "invitation_accepted",
            entityType: "treeInvitation",
            entityId: invitation._id,
            timestamp: now,
        });

        return invitation.treeId;
    }
});

export const getInvitations = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAdmin(ctx, args.treeId);

        const invitations = await ctx.db
            .query("invitations")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .collect();

        const now = Date.now();
        return invitations.filter((inv) => !inv.acceptedAt && inv.expiresAt > now);
    }
});

export const getInvitationForCancel = query({
    args: {
        treeId: v.id("trees"),
        invitationId: v.id("invitations")
    },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAdmin(ctx, args.treeId);
        const invitation = await ctx.db.get(args.invitationId);
        if (!invitation || invitation.treeId !== args.treeId) {
            throw new Error("Invitation not found");
        }
        return invitation;
    }
});

export const deleteInvitation = mutation({
    args: {
        treeId: v.id("trees"),
        invitationId: v.id("invitations")
    },
    handler: async (ctx: MutationCtx, args) => {
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

export const cancelInvitation = action({
    args: {
        treeId: v.id("trees"),
        invitationId: v.id("invitations")
    },
    handler: async (ctx: ActionCtx, args): Promise<Id<"trees">> => {
        const invitation = await ctx.runQuery(api.treesInvitations.getInvitationForCancel, {
            treeId: args.treeId,
            invitationId: args.invitationId
        });

        if (invitation.clerkInvitationId) {
            await revokeClerkInvitation(invitation.clerkInvitationId);
        }

        return await ctx.runMutation(api.treesInvitations.deleteInvitation, {
            treeId: args.treeId,
            invitationId: args.invitationId
        });
    }
});
