import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════
// Ancestry Tracker - Convex Schema
// Multi-tenant family tree with claims, evidence, and citations
// ═══════════════════════════════════════════════════════════

export default defineSchema({
    // ═══════════════════════════════════════════════════════════
    // TENANT & AUTH
    // ═══════════════════════════════════════════════════════════

    trees: defineTable({
        name: v.string(),
        description: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
        settings: v.optional(v.object({
            isPublic: v.boolean(),
            allowMergeRequests: v.boolean(),
            privacyMode: v.optional(v.union(
                v.literal("hide_living_birth_year"),
                v.literal("hide_living_full_date"),
                v.literal("configurable")
            )),
        })),
    }).index("by_creator", ["createdBy"]),

    users: defineTable({
        externalId: v.string(), // from Clerk
        email: v.string(),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_external_id", ["externalId"])
        .index("by_email", ["email"]),

    treeMemberships: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        role: v.union(v.literal("admin"), v.literal("user")),
        invitedBy: v.optional(v.id("users")),
        joinedAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_user", ["userId"])
        .index("by_tree_user", ["treeId", "userId"]),

    invitations: defineTable({
        treeId: v.id("trees"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
        token: v.string(),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        expiresAt: v.number(),
        acceptedAt: v.optional(v.number()),
    }).index("by_tree", ["treeId"])
        .index("by_email", ["email"])
        .index("by_token", ["token"]),

    // ═══════════════════════════════════════════════════════════
    // PEOPLE & RELATIONSHIPS
    // ═══════════════════════════════════════════════════════════

    people: defineTable({
        treeId: v.id("trees"),
        givenNames: v.optional(v.string()),
        surnames: v.optional(v.string()),
        preferredName: v.optional(v.string()),
        gender: v.optional(v.union(
            v.literal("male"),
            v.literal("female"),
            v.literal("other"),
            v.literal("unknown")
        )),
        isLiving: v.boolean(),
        profilePhotoId: v.optional(v.id("media")),
        socialLinks: v.optional(v.array(v.object({
            platform: v.string(),
            url: v.string(),
            isVerified: v.optional(v.boolean()),
        }))),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_tree_surname", ["treeId", "surnames"])
        .searchIndex("search_people", {
            searchField: "givenNames",
            filterFields: ["treeId"],
        }),

    relationships: defineTable({
        treeId: v.id("trees"),
        type: v.union(
            v.literal("parent_child"),
            v.literal("spouse"),
            v.literal("sibling"),
            v.literal("partner")
        ),
        personId1: v.id("people"),
        personId2: v.id("people"),
        // For parent_child: personId1=parent, personId2=child
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("current"),
            v.literal("divorced"),
            v.literal("separated"),
            v.literal("widowed"),
            v.literal("ended")
        )),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_person1", ["personId1"])
        .index("by_person2", ["personId2"])
        .index("by_tree_type", ["treeId", "type"]),

    // ═══════════════════════════════════════════════════════════
    // CLAIMS (CRITICAL - Evidence-based assertions)
    // ═══════════════════════════════════════════════════════════

    claims: defineTable({
        treeId: v.id("trees"),

        // What this claim is about
        subjectType: v.union(
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event")
        ),
        subjectId: v.string(),

        // Claim type determines value schema
        claimType: v.union(
            v.literal("birth"),
            v.literal("death"),
            v.literal("marriage"),
            v.literal("divorce"),
            v.literal("residence"),
            v.literal("workplace"),
            v.literal("occupation"),
            v.literal("education"),
            v.literal("military_service"),
            v.literal("immigration"),
            v.literal("emigration"),
            v.literal("naturalization"),
            v.literal("religion"),
            v.literal("name_change"),
            v.literal("custom")
        ),

        // Structured value
        value: v.object({
            date: v.optional(v.string()),
            dateEnd: v.optional(v.string()),
            datePrecision: v.optional(v.union(
                v.literal("exact"),
                v.literal("year"),
                v.literal("decade"),
                v.literal("approximate"),
                v.literal("before"),
                v.literal("after"),
                v.literal("between")
            )),
            placeId: v.optional(v.id("places")),
            description: v.optional(v.string()),
            customFields: v.optional(v.any()),
        }),

        // Status workflow
        status: v.union(
            v.literal("draft"),
            v.literal("disputed"),
            v.literal("accepted")
        ),

        // Optional confidence
        confidence: v.optional(v.union(
            v.literal("high"),
            v.literal("medium"),
            v.literal("low"),
            v.literal("uncertain")
        )),

        // Provenance
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
        resolvedBy: v.optional(v.id("users")),
        resolvedAt: v.optional(v.number()),
        resolutionNote: v.optional(v.string()),
    }).index("by_tree", ["treeId"])
        .index("by_subject", ["subjectType", "subjectId"])
        .index("by_tree_type", ["treeId", "claimType"])
        .index("by_tree_status", ["treeId", "status"]),

    claimDisputes: defineTable({
        claimId: v.id("claims"),
        treeId: v.id("trees"),
        alternativeValue: v.any(),
        reason: v.string(),
        proposedBy: v.id("users"),
        proposedAt: v.number(),
        status: v.union(
            v.literal("open"),
            v.literal("accepted"),
            v.literal("rejected")
        ),
        resolvedBy: v.optional(v.id("users")),
        resolvedAt: v.optional(v.number()),
        resolutionNote: v.optional(v.string()),
    }).index("by_claim", ["claimId"])
        .index("by_tree_status", ["treeId", "status"]),

    // ═══════════════════════════════════════════════════════════
    // PLACES (First-class entities)
    // ═══════════════════════════════════════════════════════════

    places: defineTable({
        treeId: v.id("trees"),

        // Human-readable
        displayName: v.string(),
        addressLine1: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
        postalCode: v.optional(v.string()),

        // Coordinates
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),

        // Geocoding metadata
        geocodePrecision: v.optional(v.union(
            v.literal("rooftop"),
            v.literal("street"),
            v.literal("locality"),
            v.literal("region"),
            v.literal("approximate"),
            v.literal("user_pin")
        )),
        geocodeMethod: v.optional(v.union(
            v.literal("google_maps"),
            v.literal("manual"),
            v.literal("imported")
        )),

        // Historical context
        historicalNote: v.optional(v.string()),
        existsToday: v.optional(v.boolean()),

        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .searchIndex("search_places", {
            searchField: "displayName",
            filterFields: ["treeId"],
        }),

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    events: defineTable({
        treeId: v.id("trees"),
        type: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.optional(v.string()),
        dateEnd: v.optional(v.string()),
        placeId: v.optional(v.id("places")),
        participantIds: v.array(v.id("people")),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_place", ["placeId"]),

    // ═══════════════════════════════════════════════════════════
    // SOURCES & EVIDENCE
    // ═══════════════════════════════════════════════════════════

    sources: defineTable({
        treeId: v.id("trees"),
        title: v.string(),
        url: v.optional(v.string()),
        author: v.optional(v.string()),
        publisher: v.optional(v.string()),
        publicationDate: v.optional(v.string()),
        accessDate: v.optional(v.string()),
        repository: v.optional(v.string()),
        callNumber: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .searchIndex("search_sources", {
            searchField: "title",
            filterFields: ["treeId"],
        }),

    sourceSnapshots: defineTable({
        sourceId: v.id("sources"),
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        capturedAt: v.number(),
        capturedBy: v.id("users"),
        pageUrl: v.optional(v.string()),
        notes: v.optional(v.string()),
    }).index("by_source", ["sourceId"])
        .index("by_tree", ["treeId"]),

    sourceExcerpts: defineTable({
        sourceId: v.id("sources"),
        snapshotId: v.optional(v.id("sourceSnapshots")),
        treeId: v.id("trees"),
        quote: v.string(),
        mediaId: v.optional(v.id("media")),
        boundingBox: v.optional(v.object({
            x: v.number(),
            y: v.number(),
            w: v.number(),
            h: v.number(),
        })),
        page: v.optional(v.number()),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_source", ["sourceId"])
        .index("by_snapshot", ["snapshotId"])
        .index("by_tree", ["treeId"]),

    // ═══════════════════════════════════════════════════════════
    // CITATIONS (Canonical - used everywhere)
    // ═══════════════════════════════════════════════════════════

    citations: defineTable({
        treeId: v.id("trees"),

        kind: v.union(
            v.literal("source_url"),
            v.literal("source_snapshot"),
            v.literal("source_excerpt"),
            v.literal("uploaded_doc"),
            v.literal("doc_chunk"),
            v.literal("claim"),
            v.literal("media")
        ),

        title: v.optional(v.string()),
        url: v.optional(v.string()),

        // Reference IDs (one set based on kind)
        sourceId: v.optional(v.id("sources")),
        snapshotId: v.optional(v.id("sourceSnapshots")),
        excerptId: v.optional(v.id("sourceExcerpts")),
        documentId: v.optional(v.id("documents")),
        chunkId: v.optional(v.id("documentChunks")),
        claimId: v.optional(v.id("claims")),
        mediaId: v.optional(v.id("media")),

        // Location within source
        quote: v.optional(v.string()),
        boundingBox: v.optional(v.object({
            x: v.number(),
            y: v.number(),
            w: v.number(),
            h: v.number(),
        })),
        page: v.optional(v.number()),
        timecode: v.optional(v.object({
            startMs: v.number(),
            endMs: v.number(),
        })),

        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_source", ["sourceId"])
        .index("by_claim", ["claimId"])
        .index("by_document", ["documentId"]),

    // Link claims to citations
    claimCitations: defineTable({
        claimId: v.id("claims"),
        citationId: v.id("citations"),
        treeId: v.id("trees"),
        isPrimary: v.boolean(),
        createdAt: v.number(),
    }).index("by_claim", ["claimId"])
        .index("by_citation", ["citationId"])
        .index("by_tree", ["treeId"]),

    // ═══════════════════════════════════════════════════════════
    // MEDIA
    // ═══════════════════════════════════════════════════════════

    media: defineTable({
        treeId: v.id("trees"),

        // Storage type
        storageKind: v.union(
            v.literal("external_link"),
            v.literal("convex_file"),
            v.literal("future_media_service")
        ),

        // For convex_file
        storageId: v.optional(v.id("_storage")),

        // For external_link
        canonicalUrl: v.optional(v.string()),
        embedUrl: v.optional(v.string()),
        provider: v.optional(v.union(
            v.literal("youtube"),
            v.literal("vimeo"),
            v.literal("google_drive"),
            v.literal("onedrive"),
            v.literal("other")
        )),

        // Metadata
        type: v.union(
            v.literal("photo"),
            v.literal("document"),
            v.literal("audio"),
            v.literal("video")
        ),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        fileSizeBytes: v.optional(v.number()),
        durationMs: v.optional(v.number()),

        // Dimensions for images
        width: v.optional(v.number()),
        height: v.optional(v.number()),

        // Links to people/events
        taggedPersonIds: v.optional(v.array(v.id("people"))),
        eventId: v.optional(v.id("events")),

        // Source attribution
        sourceId: v.optional(v.id("sources")),
        sourceUrl: v.optional(v.string()),

        // OCR
        ocrStatus: v.optional(v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("needs_premium_ocr")
        )),
        ocrText: v.optional(v.string()),

        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_tree_type", ["treeId", "type"])
        .index("by_storage", ["storageId"]),

    // ═══════════════════════════════════════════════════════════
    // DOCUMENTS & RAG
    // ═══════════════════════════════════════════════════════════

    documents: defineTable({
        treeId: v.id("trees"),
        mediaId: v.id("media"),
        title: v.string(),
        pageCount: v.optional(v.number()),
        processingStatus: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        ocrMethod: v.optional(v.union(
            v.literal("tesseract"),
            v.literal("browser_ocr"),
            v.literal("mistral_ocr"),
            v.literal("imported")
        )),
        createdAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_media", ["mediaId"])
        .index("by_status", ["processingStatus"]),

    documentChunks: defineTable({
        documentId: v.id("documents"),
        treeId: v.id("trees"),
        chunkIndex: v.number(),
        pageNumber: v.optional(v.number()),
        content: v.string(),
        embedding: v.optional(v.array(v.float64())),
        createdAt: v.number(),
    }).index("by_document", ["documentId"])
        .index("by_tree", ["treeId"])
        .vectorIndex("by_embedding", {
            vectorField: "embedding",
            dimensions: 1536,
            filterFields: ["treeId"],
        }),

    // Searchable content for hybrid RAG retrieval
    searchableContent: defineTable({
        treeId: v.id("trees"),

        entityType: v.union(
            v.literal("person"),
            v.literal("claim"),
            v.literal("place"),
            v.literal("source"),
            v.literal("note"),
            v.literal("document_chunk")
        ),
        entityId: v.string(),

        content: v.string(),
        embedding: v.optional(v.array(v.float64())),

        // Metadata for filtering
        personId: v.optional(v.id("people")),
        placeId: v.optional(v.id("places")),
        claimType: v.optional(v.string()),
        dateRange: v.optional(v.object({
            start: v.optional(v.string()),
            end: v.optional(v.string()),
        })),
        tags: v.optional(v.array(v.string())),

        updatedAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_person", ["personId"])
        .index("by_place", ["placeId"])
        .searchIndex("fulltext", {
            searchField: "content",
            filterFields: ["treeId", "entityType"],
        })
        .vectorIndex("semantic", {
            vectorField: "embedding",
            dimensions: 1536,
            filterFields: ["treeId", "entityType"],
        }),

    // ═══════════════════════════════════════════════════════════
    // NOTES
    // ═══════════════════════════════════════════════════════════

    notes: defineTable({
        treeId: v.id("trees"),

        attachedToType: v.union(
            v.literal("tree"),
            v.literal("person"),
            v.literal("relationship"),
            v.literal("event"),
            v.literal("claim"),
            v.literal("place"),
            v.literal("source"),
            v.literal("media")
        ),
        attachedToId: v.string(),

        title: v.optional(v.string()),
        content: v.string(),

        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_attachment", ["attachedToType", "attachedToId"])
        .searchIndex("search_notes", {
            searchField: "content",
            filterFields: ["treeId"],
        }),

    // ═══════════════════════════════════════════════════════════
    // AI FEATURES (Future - schemas ready)
    // ═══════════════════════════════════════════════════════════

    chatSessions: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        title: v.optional(v.string()),
        createdAt: v.number(),
        lastMessageAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_user", ["userId"]),

    chatMessages: defineTable({
        sessionId: v.id("chatSessions"),
        treeId: v.id("trees"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        citationIds: v.optional(v.array(v.id("citations"))),
        createdAt: v.number(),
    }).index("by_session", ["sessionId"])
        .index("by_tree", ["treeId"]),

    researchSessions: defineTable({
        treeId: v.id("trees"),
        title: v.string(),
        objective: v.string(),
        status: v.union(
            v.literal("active"),
            v.literal("paused"),
            v.literal("completed")
        ),
        targetPersonIds: v.optional(v.array(v.id("people"))),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_status", ["status"]),

    researchFindings: defineTable({
        sessionId: v.id("researchSessions"),
        treeId: v.id("trees"),
        sourceUrl: v.string(),
        sourceTitle: v.string(),
        summary: v.string(),
        rawContent: v.optional(v.string()),
        relevanceScore: v.optional(v.number()),
        status: v.union(
            v.literal("pending_review"),
            v.literal("accepted"),
            v.literal("rejected"),
            v.literal("converted_to_claim")
        ),
        suggestedClaims: v.optional(v.any()),
        reviewedBy: v.optional(v.id("users")),
        reviewedAt: v.optional(v.number()),
        createdAt: v.number(),
    }).index("by_session", ["sessionId"])
        .index("by_tree_status", ["treeId", "status"]),

    // ═══════════════════════════════════════════════════════════
    // AUDIT LOG
    // ═══════════════════════════════════════════════════════════

    auditLog: defineTable({
        treeId: v.id("trees"),
        userId: v.id("users"),
        action: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        changes: v.optional(v.any()),
        timestamp: v.number(),
    }).index("by_tree", ["treeId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_user", ["userId"]),
});
