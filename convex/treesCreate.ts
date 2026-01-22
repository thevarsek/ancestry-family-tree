import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";

export const create = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);
        const now = Date.now();

        const treeId = await ctx.db.insert("trees", {
            name: args.name,
            description: args.description,
            createdBy: user._id,
            createdAt: now,
            settings: {
                isPublic: false,
                allowMergeRequests: false,
                privacyMode: "configurable"
            }
        });

        await ctx.db.insert("treeMemberships", {
            treeId,
            userId: user._id,
            role: "admin",
            joinedAt: now
        });

        await insertAuditLog(ctx, {
            treeId,
            userId: user._id,
            action: "tree_created",
            entityType: "tree",
            entityId: treeId,
            timestamp: now,
        });

        return treeId;
    }
});
