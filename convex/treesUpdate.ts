import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAdmin } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";

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
                )
            })
        )
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
                privacyMode: "configurable" as const
            };
            updates.settings = {
                isPublic: args.settings.isPublic ?? currentSettings.isPublic,
                allowMergeRequests: args.settings.allowMergeRequests ?? currentSettings.allowMergeRequests,
                privacyMode: args.settings.privacyMode ?? currentSettings.privacyMode
            };
        }

        await ctx.db.patch(args.treeId, updates);

        await insertAuditLog(ctx, {
            treeId: args.treeId,
            userId,
            action: "tree_updated",
            entityType: "tree",
            entityId: args.treeId,
            changes: updates,
        });

        return args.treeId;
    }
});
