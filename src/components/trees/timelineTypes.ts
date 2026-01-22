/**
 * Types for Timeline Chart layout and data structures
 */
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type { ClaimType } from '../../types/claims';

// Re-export ClaimType for consumers that import from here
export type { ClaimType };

/** Person data with birth/death dates for timeline display */
export interface PersonWithDates extends Doc<"people"> {
    birthDate?: string;
    deathDate?: string;
    isOngoing?: boolean;
}

/** Life event claim with person info */
export interface LifeEventClaim extends Doc<"claims"> {
    personName: string;
    personId: Id<"people">;
}

/** Processed person bar for timeline display */
export interface TimelinePersonBar {
    id: Id<"people">;
    person: PersonWithDates;
    fullName: string;
    startYear: number;
    endYear: number;
    /** Original birth date string for display */
    birthDateDisplay?: string;
    /** Original death date string for display */
    deathDateDisplay?: string;
    isOngoing: boolean;
    hasBirthDate: boolean;
    row: number;
}

/** Processed event bar for timeline display */
export interface TimelineEventBar {
    id: Id<"claims">;
    claim: LifeEventClaim;
    title: string;
    description?: string;
    startYear: number;
    endYear: number | null;
    /** Original start date string for display (e.g., "2015-09-14" or "2015-09" or "2015") */
    startDateDisplay?: string;
    /** Original end date string for display */
    endDateDisplay?: string;
    isOngoing: boolean;
    row: number;
    personId: Id<"people">;
    personName: string;
    claimType: ClaimType;
    /** For merged events: all person IDs involved */
    personIds: Id<"people">[];
    /** For merged events: all person names involved */
    personNames: string[];
    /** Number of merged events (1 if not merged) */
    mergedCount: number;
}

/** Complete timeline layout result */
export interface TimelineLayout {
    events: TimelineEventBar[];
    people: TimelinePersonBar[];
    minYear: number;
    maxYear: number;
    eventRowCount: number;
    personRowCount: number;
    relationships: Doc<"relationships">[];
}

/** Input data for building timeline layout */
export interface TimelineLayoutInput {
    lifeEvents: LifeEventClaim[];
    people: PersonWithDates[];
    relationships: Doc<"relationships">[];
    visibleEventTypes: Set<string>;
    visiblePersonIds: Set<Id<"people">>;
}
