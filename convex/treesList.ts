import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";

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
    }
});
