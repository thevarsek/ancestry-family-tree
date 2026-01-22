import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { sortClaimsForTimeline } from "../../utils/claimSorting";
import type { PersonClaim } from "../../types/claims";

// Re-export PersonClaim from shared types for backward compatibility
export type { PersonClaim } from "../../types/claims";

export type PersonRelationships = {
    parents: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }[];
    spouses: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }[];
    siblings: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }[];
    children: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }[];
};

export type ProfilePhotoData = {
    storageUrl?: string | null;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
    mediaId: Id<"media">;
};

export type EnrichedMedia = Doc<"media"> & {
    storageUrl?: string | null;
};

export type UsePersonPageDataResult = {
    person: (Doc<"people"> & { claims: PersonClaim[] }) | undefined;
    relationships: PersonRelationships | undefined;
    profilePhoto: EnrichedMedia | undefined | null;
    isLoading: boolean;
    sortedClaims: PersonClaim[];
    residenceClaims: PersonClaim[];
    placeClaims: PersonClaim[];
    placeGroups: { place: PersonClaim["place"]; claims: PersonClaim[] }[];
    mapPlaces: Doc<"places">[];
    mapCenter: [number, number];
    getRelationshipPhoto: (person?: Doc<"people"> | null) => ProfilePhotoData | undefined;
};

/**
 * Custom hook that fetches and processes all data needed for the PersonPage
 */
export function usePersonPageData(personId: string | undefined): UsePersonPageDataResult {
    const person = useQuery(
        api.people.getWithClaims,
        personId ? { personId: personId as Id<"people"> } : "skip"
    ) as (Doc<"people"> & { claims: PersonClaim[] }) | undefined;

    const relationships = useQuery(
        api.people.getRelationships,
        personId ? { personId: personId as Id<"people"> } : "skip"
    ) as PersonRelationships | undefined;

    const profilePhoto = useQuery(
        api.media.get,
        person?.profilePhotoId ? { mediaId: person.profilePhotoId } : "skip"
    ) as EnrichedMedia | undefined | null;

    // Collect all relationship people for batch photo fetching
    const relationshipPeople = useMemo(() => {
        if (!relationships) return [];
        return relationships.parents
            .concat(relationships.spouses)
            .concat(relationships.siblings)
            .concat(relationships.children)
            .map((relation: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }) => relation.person)
            .filter((p): p is Doc<"people"> => Boolean(p));
    }, [relationships]);

    const relationshipPhotoIds = useMemo(() => {
        const ids = relationshipPeople
            .map((p: Doc<"people">) => p.profilePhotoId)
            .filter((id): id is Id<"media"> => Boolean(id));
        return Array.from(new Set(ids));
    }, [relationshipPeople]);

    const relationshipPhotos = useQuery(
        api.media.getUrls,
        relationshipPhotoIds.length ? { mediaIds: relationshipPhotoIds } : "skip"
    ) as ProfilePhotoData[] | undefined;

    const relationshipPhotoMap = useMemo(() => {
        return new Map((relationshipPhotos ?? []).map((item: ProfilePhotoData) => [item.mediaId, item]));
    }, [relationshipPhotos]);

    const getRelationshipPhoto = useMemo(() => {
        return (relationPerson?: Doc<"people"> | null): ProfilePhotoData | undefined => {
            if (!relationPerson?.profilePhotoId) return undefined;
            return relationshipPhotoMap.get(relationPerson.profilePhotoId);
        };
    }, [relationshipPhotoMap]);

    // Sorted claims for timeline display
    const sortedClaims = useMemo(() => {
        if (!person) return [];
        return sortClaimsForTimeline(person.claims as PersonClaim[]);
    }, [person]);

    // Residence claims for sidebar
    const residenceClaims = useMemo(() => {
        if (!person) return [];
        return (person.claims as PersonClaim[]).filter(
            (claim) => claim.claimType === "residence" && Boolean(claim.place)
        );
    }, [person]);

    // All claims with places
    const placeClaims = useMemo(() => {
        if (!person) return [];
        return (person.claims as PersonClaim[]).filter((claim) => Boolean(claim.place));
    }, [person]);

    // Group claims by place for Places tab
    const placeGroups = useMemo(() => {
        const grouped = new Map<string, { place: PersonClaim["place"]; claims: PersonClaim[] }>();
        placeClaims.forEach((claim) => {
            const placeId = claim.place?._id;
            if (!placeId) return;
            const entry = grouped.get(placeId) ?? { place: claim.place, claims: [] };
            entry.claims.push(claim);
            grouped.set(placeId, entry);
        });
        return Array.from(grouped.values()).sort((a, b) =>
            (a.place?.displayName ?? "").localeCompare(b.place?.displayName ?? "")
        );
    }, [placeClaims]);

    // Places with coordinates for map
    const mapPlaces = useMemo(
        () =>
            placeGroups
                .map((group) => group.place)
                .filter((place): place is Doc<"places"> => Boolean(place?.latitude && place?.longitude)),
        [placeGroups]
    );

    // Calculate map center from places
    const mapCenter = useMemo((): [number, number] => {
        if (mapPlaces.length === 0) return [20, 0];
        const sum = mapPlaces.reduce(
            (acc, place) => {
                acc.lat += place.latitude ?? 0;
                acc.lng += place.longitude ?? 0;
                return acc;
            },
            { lat: 0, lng: 0 }
        );
        return [sum.lat / mapPlaces.length, sum.lng / mapPlaces.length];
    }, [mapPlaces]);

    return {
        person: person as (Doc<"people"> & { claims: PersonClaim[] }) | undefined,
        relationships: relationships as PersonRelationships | undefined,
        profilePhoto,
        isLoading: !person || !relationships,
        sortedClaims,
        residenceClaims,
        placeClaims,
        placeGroups,
        mapPlaces,
        mapCenter,
        getRelationshipPhoto,
    };
}
