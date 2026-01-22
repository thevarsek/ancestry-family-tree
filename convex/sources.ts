import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess, requireTreeAdmin } from "./lib/auth";
import { insertAuditLog } from "./lib/auditLog";
import { Id } from "./_generated/dataModel";

// List sources for a tree
export const list = query({
    args: { treeId: v.id("trees"), limit: v.optional(v.number()) },
    handler: async (ctx: QueryCtx, args) => {
        await requireTreeAccess(ctx, args.treeId);

        const sources = await ctx.db
            .query("sources")
            .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
            .order("desc")
            .take(args.limit || 100);

        return sources;
    },
});

// Get a single source with linked claims
export const getWithClaims = query({
    args: { sourceId: v.id("sources") },
    handler: async (ctx: QueryCtx, args) => {
        const source = await ctx.db.get(args.sourceId);
        if (!source) return null;

        await requireTreeAccess(ctx, source.treeId);

        const links = await ctx.db
            .query("sourceClaims")
            .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
            .collect();

        const claims = (await Promise.all(
            links.map((link) => ctx.db.get(link.claimId))
        )).filter(Boolean);

        const placeIds = claims
            .map((claim) => claim?.value.placeId)
            .filter((id): id is Id<"places"> => Boolean(id));

        const places = await Promise.all(
            [...new Set(placeIds)].map((placeId) => ctx.db.get(placeId))
        );
        const placeMap = new Map(
            places.filter(Boolean).map((place) => [place!._id, place])
        );

        const personIds = claims
            .filter((claim) => claim?.subjectType === "person")
            .map((claim) => claim?.subjectId as Id<"people">);

        const people = await Promise.all(
            [...new Set(personIds)].map((personId) => ctx.db.get(personId))
        );
        const peopleMap = new Map(
            people.filter(Boolean).map((person) => [person!._id, person])
        );

        return {
            ...source,
            claims: claims.map((claim) => ({
                ...claim!,
                place: claim?.value.placeId ? placeMap.get(claim.value.placeId) : undefined,
                person: claim?.subjectType === "person"
                    ? peopleMap.get(claim.subjectId as Id<"people">)
                    : undefined,
            })),
        };
    },
});

// List sources linked to a person
export const listByPerson = query({
    args: { personId: v.id("people") },
    handler: async (ctx: QueryCtx, args) => {
        const person = await ctx.db.get(args.personId);
        if (!person) return [];

        await requireTreeAccess(ctx, person.treeId);

        const claims = await ctx.db
            .query("claims")
            .withIndex("by_subject", (q) =>
                q.eq("subjectType", "person").eq("subjectId", args.personId)
            )
            .collect();

        if (claims.length === 0) return [];

        const sourceIdSet = new Set<Id<"sources">>();

        await Promise.all(
            claims.map(async (claim) => {
                const links = await ctx.db
                    .query("sourceClaims")
                    .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
                    .collect();
                links.forEach((link) => sourceIdSet.add(link.sourceId));
            })
        );

        const sources = await Promise.all(
            [...sourceIdSet].map((sourceId) => ctx.db.get(sourceId))
        );

        return sources
            .filter(Boolean)
            .sort((a, b) => (b!.createdAt ?? 0) - (a!.createdAt ?? 0));
    },
});

// Create a new source
export const create = mutation({
    args: {
        treeId: v.id("trees"),
        title: v.string(),
        url: v.optional(v.string()),
        author: v.optional(v.string()),
        publisher: v.optional(v.string()),
        publicationDate: v.optional(v.string()),
        notes: v.optional(v.string()),
        claimId: v.optional(v.id("claims")),
    },
    handler: async (ctx: MutationCtx, args) => {
        const { userId } = await requireTreeAdmin(ctx, args.treeId);
        const now = Date.now();

        if (args.claimId) {
            const claim = await ctx.db.get(args.claimId);
            if (!claim) throw new Error("Claim not found");
            if (claim.treeId !== args.treeId) {
                throw new Error("Claim belongs to a different tree");
            }
        }

        const { claimId, ...sourceData } = args;

        const sourceId = await ctx.db.insert("sources", {
            ...sourceData,
            createdBy: userId,
            createdAt: now,
        });

        // Add to searchable content
        await ctx.db.insert("searchableContent", {
            treeId: args.treeId,
            entityType: "source",
            entityId: sourceId,
            content: `${args.title} ${args.author || ''} ${args.notes || ''}`,
            updatedAt: now,
        });

        if (claimId) {
            const linkId = await ctx.db.insert("sourceClaims", {
                treeId: args.treeId,
                sourceId,
                claimId,
                createdBy: userId,
                createdAt: now,
            });

            await insertAuditLog(ctx, {
                treeId: args.treeId,
                userId,
                action: "source_linked",
                entityType: "sourceClaim",
                entityId: linkId,
                timestamp: now,
            });
        }

        return sourceId;
    },
});

// Update source metadata
export const update = mutation({
    args: {
        sourceId: v.id("sources"),
        title: v.string(),
        url: v.optional(v.string()),
        author: v.optional(v.string()),
        publisher: v.optional(v.string()),
        publicationDate: v.optional(v.string()),
        accessDate: v.optional(v.string()),
        repository: v.optional(v.string()),
        callNumber: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const source = await ctx.db.get(args.sourceId);
        if (!source) throw new Error("Source not found");

        const { userId } = await requireTreeAdmin(ctx, source.treeId);
        const now = Date.now();

        await ctx.db.patch(args.sourceId, {
            title: args.title,
            url: args.url,
            author: args.author,
            publisher: args.publisher,
            publicationDate: args.publicationDate,
            accessDate: args.accessDate,
            repository: args.repository,
            callNumber: args.callNumber,
            notes: args.notes,
        });

        const searchableEntry = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) => q.eq("entityType", "source").eq("entityId", args.sourceId))
            .unique();

        const searchableText = `${args.title} ${args.author || ''} ${args.notes || ''}`.trim();

        if (searchableEntry) {
            await ctx.db.patch(searchableEntry._id, {
                content: searchableText,
                updatedAt: now,
            });
        } else {
            await ctx.db.insert("searchableContent", {
                treeId: source.treeId,
                entityType: "source",
                entityId: args.sourceId,
                content: searchableText,
                updatedAt: now,
            });
        }

        await insertAuditLog(ctx, {
            treeId: source.treeId,
            userId,
            action: "source_updated",
            entityType: "source",
            entityId: args.sourceId,
            changes: {
                title: args.title,
                url: args.url,
                author: args.author,
                notes: args.notes,
            },
            timestamp: now,
        });

        return args.sourceId;
    },
});

// Delete a source and related links
export const remove = mutation({
    args: { sourceId: v.id("sources") },
    handler: async (ctx: MutationCtx, args) => {
        const source = await ctx.db.get(args.sourceId);
        if (!source) throw new Error("Source not found");

        const { userId } = await requireTreeAdmin(ctx, source.treeId);
        const now = Date.now();

        const sourceClaims = await ctx.db
            .query("sourceClaims")
            .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
            .collect();

        const sourceSnapshots = await ctx.db
            .query("sourceSnapshots")
            .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
            .collect();

        const sourceExcerpts = await ctx.db
            .query("sourceExcerpts")
            .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
            .collect();

        const mediaLinks = await ctx.db
            .query("mediaLinks")
            .withIndex("by_entity", (q) => q.eq("entityType", "source").eq("entityId", args.sourceId))
            .collect();

        await Promise.all(sourceClaims.map((link) => ctx.db.delete(link._id)));
        await Promise.all(sourceSnapshots.map((snapshot) => ctx.db.delete(snapshot._id)));
        await Promise.all(sourceExcerpts.map((excerpt) => ctx.db.delete(excerpt._id)));
        await Promise.all(mediaLinks.map((link) => ctx.db.delete(link._id)));

        const searchableEntry = await ctx.db
            .query("searchableContent")
            .withIndex("by_entity", (q) => q.eq("entityType", "source").eq("entityId", args.sourceId))
            .unique();

        if (searchableEntry) {
            await ctx.db.delete(searchableEntry._id);
        }

        await ctx.db.delete(args.sourceId);

        await insertAuditLog(ctx, {
            treeId: source.treeId,
            userId,
            action: "source_deleted",
            entityType: "source",
            entityId: args.sourceId,
            timestamp: now,
        });

        return args.sourceId;
    },
});
