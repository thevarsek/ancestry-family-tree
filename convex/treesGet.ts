import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess } from "./lib/auth";

export const get = query({
    args: { treeId: v.id("trees") },
    handler: async (ctx, args) => {
        const { role } = await requireTreeAccess(ctx, args.treeId);
        const tree = await ctx.db.get(args.treeId);
        return tree ? { ...tree, role } : null;
    }
});
