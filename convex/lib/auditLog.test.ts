import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertAuditLog, type InsertAuditLogParams } from "./auditLog";
import type { Id } from "../_generated/dataModel";

// Mock MutationCtx
const createMockCtx = () => {
    const insertedDocs: Array<Record<string, unknown>> = [];
    return {
        db: {
            insert: vi.fn().mockImplementation((table: string, doc: Record<string, unknown>) => {
                insertedDocs.push({ table, ...doc });
                return Promise.resolve("auditLog123" as Id<"auditLog">);
            }),
        },
        insertedDocs,
    };
};

describe("insertAuditLog", () => {
    let mockCtx: ReturnType<typeof createMockCtx>;

    beforeEach(() => {
        mockCtx = createMockCtx();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-22T12:00:00.000Z"));
    });

    it("should insert an audit log entry with auto-generated timestamp", async () => {
        const params: InsertAuditLogParams = {
            treeId: "tree123" as Id<"trees">,
            userId: "user456" as Id<"users">,
            action: "person_created",
            entityType: "person",
            entityId: "person789",
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await insertAuditLog(mockCtx as any, params);

        expect(result).toBe("auditLog123");
        expect(mockCtx.db.insert).toHaveBeenCalledWith("auditLog", {
            treeId: "tree123",
            userId: "user456",
            action: "person_created",
            entityType: "person",
            entityId: "person789",
            changes: undefined,
            timestamp: Date.now(),
        });
    });

    it("should use provided timestamp when specified", async () => {
        const customTimestamp = 1700000000000;
        const params: InsertAuditLogParams = {
            treeId: "tree123" as Id<"trees">,
            userId: "user456" as Id<"users">,
            action: "claim_updated",
            entityType: "claim",
            entityId: "claim123",
            timestamp: customTimestamp,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await insertAuditLog(mockCtx as any, params);

        expect(mockCtx.db.insert).toHaveBeenCalledWith("auditLog", {
            treeId: "tree123",
            userId: "user456",
            action: "claim_updated",
            entityType: "claim",
            entityId: "claim123",
            changes: undefined,
            timestamp: customTimestamp,
        });
    });

    it("should include changes when provided", async () => {
        const changes = {
            claimType: "birth",
            value: { date: "1990-01-01", location: "New York" },
        };
        const params: InsertAuditLogParams = {
            treeId: "tree123" as Id<"trees">,
            userId: "user456" as Id<"users">,
            action: "claim_updated",
            entityType: "claim",
            entityId: "claim123",
            changes,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await insertAuditLog(mockCtx as any, params);

        expect(mockCtx.db.insert).toHaveBeenCalledWith("auditLog", {
            treeId: "tree123",
            userId: "user456",
            action: "claim_updated",
            entityType: "claim",
            entityId: "claim123",
            changes,
            timestamp: expect.any(Number),
        });
    });

    it("should support all person actions", async () => {
        const personActions = ["person_created", "person_updated", "person_deleted", "person_merged"] as const;

        for (const action of personActions) {
            const params: InsertAuditLogParams = {
                treeId: "tree123" as Id<"trees">,
                userId: "user456" as Id<"users">,
                action,
                entityType: "person",
                entityId: "person789",
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await insertAuditLog(mockCtx as any, params);
        }

        expect(mockCtx.db.insert).toHaveBeenCalledTimes(personActions.length);
    });

    it("should support all claim actions", async () => {
        const claimActions = [
            "claim_created",
            "claim_updated",
            "claim_deleted",
            "claim_draft",
            "claim_disputed",
            "claim_accepted",
            "dispute_created",
            "dispute_accepted",
            "dispute_rejected",
            "citation_added",
            "citation_linked",
            "citation_removed",
        ] as const;

        for (const action of claimActions) {
            const params: InsertAuditLogParams = {
                treeId: "tree123" as Id<"trees">,
                userId: "user456" as Id<"users">,
                action,
                entityType: "claim",
                entityId: "claim123",
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await insertAuditLog(mockCtx as any, params);
        }

        expect(mockCtx.db.insert).toHaveBeenCalledTimes(claimActions.length);
    });

    it("should support all source actions", async () => {
        const sourceActions = ["source_created", "source_updated", "source_deleted", "source_linked"] as const;

        for (const action of sourceActions) {
            const params: InsertAuditLogParams = {
                treeId: "tree123" as Id<"trees">,
                userId: "user456" as Id<"users">,
                action,
                entityType: "source",
                entityId: "source123",
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await insertAuditLog(mockCtx as any, params);
        }

        expect(mockCtx.db.insert).toHaveBeenCalledTimes(sourceActions.length);
    });

    it("should support tree and member actions", async () => {
        const treeActions = [
            { action: "tree_created" as const, entityType: "tree" as const },
            { action: "tree_updated" as const, entityType: "tree" as const },
            { action: "member_added" as const, entityType: "treeMembership" as const },
            { action: "member_removed" as const, entityType: "treeMembership" as const },
            { action: "member_role_changed" as const, entityType: "treeMembership" as const },
        ];

        for (const { action, entityType } of treeActions) {
            const params: InsertAuditLogParams = {
                treeId: "tree123" as Id<"trees">,
                userId: "user456" as Id<"users">,
                action,
                entityType,
                entityId: "entity123",
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await insertAuditLog(mockCtx as any, params);
        }

        expect(mockCtx.db.insert).toHaveBeenCalledTimes(treeActions.length);
    });

    it("should return the audit log ID", async () => {
        const params: InsertAuditLogParams = {
            treeId: "tree123" as Id<"trees">,
            userId: "user456" as Id<"users">,
            action: "media_uploaded",
            entityType: "media",
            entityId: "media123",
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await insertAuditLog(mockCtx as any, params);

        expect(result).toBe("auditLog123");
    });
});
