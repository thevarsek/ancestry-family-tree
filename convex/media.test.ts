import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { remove } from "./media";

type TableName =
    | "users"
    | "treeMemberships"
    | "media"
    | "mediaPeople"
    | "mediaLinks"
    | "documents"
    | "documentChunks"
    | "searchableContent"
    | "auditLog"
    | "people";

type TableIdMap = {
    users: Id<"users">;
    treeMemberships: Id<"treeMemberships">;
    media: Id<"media">;
    mediaPeople: Id<"mediaPeople">;
    mediaLinks: Id<"mediaLinks">;
    documents: Id<"documents">;
    documentChunks: Id<"documentChunks">;
    searchableContent: Id<"searchableContent">;
    auditLog: Id<"auditLog">;
    people: Id<"people">;
};

type TableStore = {
    [K in TableName]: Array<Record<string, unknown>>;
};

const createId = <T extends TableName>(table: T, tables: TableStore) =>
    `${table}_${tables[table].length + 1}` as TableIdMap[T];

const createContext = (
    tables: TableStore,
    identity: { subject: string; email: string; name: string },
    deletedStorage: Id<"_storage">[]
) => {
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
        delete: async (id: string) => {
            for (const table of Object.keys(tables) as TableName[]) {
                const index = tables[table].findIndex((item) => item._id === id);
                if (index !== -1) {
                    tables[table].splice(index, 1);
                    return;
                }
            }
        },
        get: async (id: string) => {
            for (const table of Object.keys(tables) as TableName[]) {
                const doc = tables[table].find((item) => item._id === id);
                if (doc) return doc;
            }
            return null;
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

    const storage = {
        delete: async (storageId: Id<"_storage">) => {
            deletedStorage.push(storageId);
        }
    };

    return { db, auth, storage } as unknown as MutationCtx;
};

describe("media.remove", () => {
    it("removes media and related records", async () => {
        const tables: TableStore = {
            users: [],
            treeMemberships: [],
            media: [],
            mediaPeople: [],
            mediaLinks: [],
            documents: [],
            documentChunks: [],
            searchableContent: [],
            auditLog: [],
            people: []
        };

        const treeId = "tree_1" as Id<"trees">;
        const userId = "user_1" as Id<"users">;
        const personId = "person_1" as Id<"people">;
        const mediaId = "media_1" as Id<"media">;
        const storageId = "storage_1" as Id<"_storage">;
        const documentId = "document_1" as Id<"documents">;
        const chunkId = "chunk_1" as Id<"documentChunks">;

        tables.users.push({
            _id: userId,
            _creationTime: 0,
            externalId: "clerk_1"
        });

        tables.treeMemberships.push({
            _id: "membership_1" as Id<"treeMemberships">,
            _creationTime: 0,
            treeId,
            userId,
            role: "admin"
        });

        tables.people.push({
            _id: personId,
            _creationTime: 0,
            treeId,
            isLiving: true,
            profilePhotoId: mediaId,
            createdBy: userId,
            createdAt: 0,
            updatedAt: 0
        });

        tables.media.push({
            _id: mediaId,
            _creationTime: 0,
            treeId,
            ownerPersonId: personId,
            storageKind: "convex_file",
            storageId,
            type: "photo",
            title: "Family Photo",
            createdBy: userId,
            createdAt: 0
        });

        tables.mediaPeople.push({
            _id: "media_person_1" as Id<"mediaPeople">,
            _creationTime: 0,
            treeId,
            mediaId,
            personId,
            createdBy: userId,
            createdAt: 0
        });

        tables.mediaLinks.push({
            _id: "media_link_1" as Id<"mediaLinks">,
            _creationTime: 0,
            treeId,
            mediaId,
            entityType: "claim",
            entityId: "claim_1",
            createdBy: userId,
            createdAt: 0
        });

        tables.documents.push({
            _id: documentId,
            _creationTime: 0,
            treeId,
            mediaId,
            title: "Document",
            processingStatus: "completed",
            createdAt: 0
        });

        tables.documentChunks.push({
            _id: chunkId,
            _creationTime: 0,
            documentId,
            treeId,
            chunkIndex: 0,
            content: "Example text",
            createdAt: 0
        });

        tables.searchableContent.push({
            _id: "search_1" as Id<"searchableContent">,
            _creationTime: 0,
            treeId,
            entityType: "document_chunk",
            entityId: chunkId,
            content: "Example text",
            updatedAt: 0
        });

        const deletedStorage: Id<"_storage">[] = [];
        const ctx = createContext(tables, {
            subject: "clerk_1",
            email: "admin@example.com",
            name: "Admin"
        }, deletedStorage);

        const removeHandler = (remove as unknown as {
            _handler: (innerCtx: MutationCtx, args: { mediaId: Id<"media"> }) => Promise<Id<"media">>;
        })._handler;

        await removeHandler(ctx, { mediaId });

        expect(tables.media).toHaveLength(0);
        expect(tables.mediaPeople).toHaveLength(0);
        expect(tables.mediaLinks).toHaveLength(0);
        expect(tables.documents).toHaveLength(0);
        expect(tables.documentChunks).toHaveLength(0);
        expect(tables.searchableContent).toHaveLength(0);
        expect(tables.auditLog).toHaveLength(1);
        expect(tables.people[0].profilePhotoId).toBeUndefined();
        expect(deletedStorage).toEqual([storageId]);
    });
});
