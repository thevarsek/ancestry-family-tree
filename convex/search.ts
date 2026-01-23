import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireTreeAccess } from "./lib/auth";
import { Id } from "./_generated/dataModel";

export type SearchResultType = "person" | "claim" | "place" | "source";

export interface ProfilePhotoData {
    url: string;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
}

export interface SearchResult {
    type: SearchResultType;
    id: string;
    title: string;
    subtitle?: string;
    personId?: Id<"people">;
    profilePhoto?: ProfilePhotoData;
}

/**
 * Get profile photo data for a person (URL + crop settings)
 */
async function getProfilePhotoData(ctx: QueryCtx, profilePhotoId: Id<"media"> | undefined): Promise<ProfilePhotoData | undefined> {
    if (!profilePhotoId) return undefined;
    
    const media = await ctx.db.get(profilePhotoId);
    if (!media) return undefined;
    
    let url: string | undefined;
    
    // If it's an external link, use canonicalUrl
    if (media.storageKind === 'external_link' && media.canonicalUrl) {
        url = media.canonicalUrl;
    } else if (media.storageId) {
        // Otherwise try to get from storage
        url = await ctx.storage.getUrl(media.storageId) ?? undefined;
    }
    
    if (!url) return undefined;
    
    return {
        url,
        zoomLevel: media.zoomLevel,
        focusX: media.focusX,
        focusY: media.focusY,
    };
}

/**
 * Global search across people, claims, places, and sources
 */
export const global = query({
    args: {
        treeId: v.id("trees"),
        query: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx: QueryCtx, args): Promise<SearchResult[]> => {
        await requireTreeAccess(ctx, args.treeId);
        
        const searchQuery = args.query.trim();
        if (!searchQuery) return [];
        
        const limit = args.limit ?? 20;
        const results: SearchResult[] = [];
        
        // Search using the fulltext index on searchableContent
        const searchResults = await ctx.db
            .query("searchableContent")
            .withSearchIndex("fulltext", (q) =>
                q.search("content", searchQuery).eq("treeId", args.treeId)
            )
            .take(limit * 2); // Get extra to account for filtering
        
        // Process results and fetch entity details
        for (const result of searchResults) {
            if (results.length >= limit) break;
            
            // Skip document chunks - they're for semantic search
            if (result.entityType === "document_chunk" || result.entityType === "note") {
                continue;
            }
            
            const searchResult = await enrichSearchResult(ctx, result);
            if (searchResult) {
                results.push(searchResult);
            }
        }
        
        // Also search people by name directly for better name matching
        const peopleResults = await ctx.db
            .query("people")
            .withSearchIndex("search_people", (q) =>
                q.search("givenNames", searchQuery).eq("treeId", args.treeId)
            )
            .take(10);
        
        for (const person of peopleResults) {
            // Avoid duplicates
            if (results.some(r => r.type === "person" && r.id === person._id)) {
                continue;
            }
            if (results.length >= limit) break;
            
            const profilePhoto = await getProfilePhotoData(ctx, person.profilePhotoId);
            
            results.push({
                type: "person",
                id: person._id,
                title: `${person.givenNames || ''} ${person.surnames || ''}`.trim() || 'Unknown',
                subtitle: person.isLiving ? 'Living' : undefined,
                profilePhoto,
            });
        }
        
        // Search places by name directly
        const placeResults = await ctx.db
            .query("places")
            .withSearchIndex("search_places", (q) =>
                q.search("displayName", searchQuery).eq("treeId", args.treeId)
            )
            .take(10);
        
        for (const place of placeResults) {
            if (results.some(r => r.type === "place" && r.id === place._id)) {
                continue;
            }
            if (results.length >= limit) break;
            
            results.push({
                type: "place",
                id: place._id,
                title: place.displayName,
                subtitle: [place.city, place.state, place.country].filter(Boolean).join(', ') || undefined,
            });
        }
        
        // Search sources by title directly
        const sourceResults = await ctx.db
            .query("sources")
            .withSearchIndex("search_sources", (q) =>
                q.search("title", searchQuery).eq("treeId", args.treeId)
            )
            .take(10);
        
        for (const source of sourceResults) {
            if (results.some(r => r.type === "source" && r.id === source._id)) {
                continue;
            }
            if (results.length >= limit) break;
            
            results.push({
                type: "source",
                id: source._id,
                title: source.title,
                subtitle: source.author || undefined,
            });
        }
        
        return results.slice(0, limit);
    },
});

async function enrichSearchResult(
    ctx: QueryCtx,
    result: {
        entityType: string;
        entityId: string;
        personId?: Id<"people">;
        claimType?: string;
    }
): Promise<SearchResult | null> {
    switch (result.entityType) {
        case "person": {
            const person = await ctx.db.get(result.entityId as Id<"people">);
            if (!person) return null;
            
            const profilePhoto = await getProfilePhotoData(ctx, person.profilePhotoId);
            
            return {
                type: "person",
                id: person._id,
                title: `${person.givenNames || ''} ${person.surnames || ''}`.trim() || 'Unknown',
                subtitle: person.isLiving ? 'Living' : undefined,
                profilePhoto,
            };
        }
        case "claim": {
            const claim = await ctx.db.get(result.entityId as Id<"claims">);
            if (!claim) return null;
            
            // Get the person for this claim
            let personName = '';
            if (claim.subjectType === 'person') {
                const person = await ctx.db.get(claim.subjectId as Id<"people">);
                if (person) {
                    personName = `${person.givenNames || ''} ${person.surnames || ''}`.trim();
                }
            }
            
            const claimType = result.claimType || claim.claimType;
            const title = claimType.replace(/_/g, ' ');
            
            return {
                type: "claim",
                id: claim._id,
                title: title.charAt(0).toUpperCase() + title.slice(1),
                subtitle: personName || undefined,
                personId: claim.subjectType === 'person' ? claim.subjectId as Id<"people"> : undefined,
            };
        }
        case "place": {
            const place = await ctx.db.get(result.entityId as Id<"places">);
            if (!place) return null;
            return {
                type: "place",
                id: place._id,
                title: place.displayName,
                subtitle: [place.city, place.state, place.country].filter(Boolean).join(', ') || undefined,
            };
        }
        case "source": {
            const source = await ctx.db.get(result.entityId as Id<"sources">);
            if (!source) return null;
            return {
                type: "source",
                id: source._id,
                title: source.title,
                subtitle: source.author || undefined,
            };
        }
        default:
            return null;
    }
}
