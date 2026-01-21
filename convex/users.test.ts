import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { acceptPendingInvitations } from "./users";

type TableName = "users" | "invitations" | "treeMemberships" | "auditLog";

type TableIdMap = {
    users: Id<"users">;
    invitations: Id<"invitations">;
    treeMemberships: Id<"treeMemberships">;
    auditLog: Id<"auditLog">;
};

type TableStore = {
    [K in TableName]: Array<Record<string, unknown>>;
};

const createId = <T extends TableName>(table: T, tables: TableStore) =>
    `${table}_${tables[table].length + 1}` as TableIdMap[T];

const createContext = (tables: TableStore, identity: { subject: string; email: string; name: string }) => {
    const db = {
        insert: async <T extends TableName>(table: T, value: Record<string, unknown>) => {
            const _id = createId(table, tables);
            const doc = { _id, _creationTime: 0, ...value };
            tables[table].push(doc);
            return _id;
        },
        patch: async (id: string, updates: Record<string, unknown>) => {
            for (const table of Object.keys(tables) as TableName[]) {
                const doc = tables[table].find((item) => item._id === id);
                if (doc) {
                    Object.assign(doc, updates);
                    return;
                }
            }
        },
        query: (table: TableName) => ({
            withIndex: (_index: string, callback: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
                const filters: Array<{ field: string; value: unknown }> = [];
                const q = {
                    eq: (field: string, value: unknown) => {
                        filters.push({ field, value });
                        return q;
                    }
                };
                callback(q);
                return {
                    unique: async () =>
                        tables[table].find((item) =>
                            filters.every((filter) => item[filter.field] === filter.value)
                        ) ?? null,
                    collect: async () =>
                        tables[table].filter((item) =>
                            filters.every((filter) => item[filter.field] === filter.value)
                        )
                };
            }
        })
    };

    const auth = {
        getUserIdentity: async () => ({
            subject: identity.subject,
            email: identity.email,
            name: identity.name,
            pictureUrl: undefined
        })
    };

    return { db, auth } as unknown as MutationCtx;
};


describe("acceptPendingInvitations", () => {
    it("accepts pending invitations on first sign in", async () => {
        const tables: TableStore = {
            users: [],
            invitations: [],
            treeMemberships: [],
            auditLog: []
        };

        const treeId = "tree_1" as Id<"trees">;
        const invitedBy = "user_admin" as Id<"users">;

        tables.invitations.push({
            _id: "inv_1" as Id<"invitations">,
            _creationTime: 0,
            treeId,
            email: "invitee@example.com",
            role: "user",
            token: "token_1",
            clerkInvitationId: "clerk_1",
            invitedBy,
            createdAt: 0,
            expiresAt: Date.now() + 10_000,
            acceptedAt: undefined
        });

        const ctx = createContext(tables, {
            subject: "clerk_user_1",
            email: "invitee@example.com",
            name: "Invitee"
        });

        const userId = "user_1" as Id<"users">;
        await acceptPendingInvitations(ctx, userId, "invitee@example.com");

        expect(tables.treeMemberships).toHaveLength(1);
        expect(tables.treeMemberships[0]).toMatchObject({
            treeId,
            userId,
            role: "user",
            invitedBy
        });
        expect(tables.invitations[0].acceptedAt).toBeTypeOf("number");
        expect(tables.auditLog).toHaveLength(1);
    });
});
