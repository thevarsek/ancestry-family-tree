/**
 * Shared claim type definitions used across the application.
 * Consolidates duplicate type definitions from AddClaimModal and timelineLayout.
 */

import type { Doc } from '../../convex/_generated/dataModel';

/**
 * A claim with its associated place data.
 * Used throughout the app when displaying claims with location information.
 */
export type PersonClaim = Doc<"claims"> & {
    place?: Doc<"places"> | null;
    sources?: Doc<"sources">[];
};

/**
 * All supported claim/life event types in the system.
 */
export type ClaimType =
    | "birth"
    | "death"
    | "marriage"
    | "divorce"
    | "residence"
    | "occupation"
    | "education"
    | "workplace"
    | "military_service"
    | "immigration"
    | "emigration"
    | "naturalization"
    | "religion"
    | "name_change"
    | "custom";

/**
 * Claim type metadata for UI display.
 */
export interface ClaimTypeOption {
    value: ClaimType;
    label: string;
}

/**
 * All available claim types with their display labels.
 */
export const CLAIM_TYPE_OPTIONS: ClaimTypeOption[] = [
    { value: 'birth', label: 'Birth' },
    { value: 'death', label: 'Death' },
    { value: 'marriage', label: 'Marriage' },
    { value: 'divorce', label: 'Divorce' },
    { value: 'residence', label: 'Residence' },
    { value: 'occupation', label: 'Occupation' },
    { value: 'workplace', label: 'Workplace' },
    { value: 'education', label: 'Education' },
    { value: 'military_service', label: 'Military Service' },
    { value: 'immigration', label: 'Immigration' },
    { value: 'emigration', label: 'Emigration' },
    { value: 'naturalization', label: 'Naturalization' },
    { value: 'religion', label: 'Religion' },
    { value: 'name_change', label: 'Name Change' },
    { value: 'custom', label: 'Other Event' },
];

/**
 * Claim types that support date ranges with "current" status.
 * These events can be marked as ongoing (e.g., current residence, current job).
 */
export const CURRENT_ELIGIBLE_CLAIM_TYPES: ClaimType[] = [
    'residence',
    'occupation',
    'education',
    'military_service',
];

/**
 * Claim types that require exactly one related person (e.g., marriage partner).
 */
export const SINGLE_TAGGABLE_CLAIM_TYPES: ClaimType[] = ['marriage'];

/**
 * Claim types that can have multiple related people.
 */
export const MULTI_TAGGABLE_CLAIM_TYPES: ClaimType[] = ['divorce', 'custom'];

/**
 * Check if a claim type supports the "current" status.
 */
export function isCurrentEligible(claimType: ClaimType): boolean {
    return CURRENT_ELIGIBLE_CLAIM_TYPES.includes(claimType);
}

/**
 * Check if a claim type requires tagging a single person.
 */
export function isSingleTaggable(claimType: ClaimType): boolean {
    return SINGLE_TAGGABLE_CLAIM_TYPES.includes(claimType);
}

/**
 * Check if a claim type supports tagging multiple people.
 */
export function isMultiTaggable(claimType: ClaimType): boolean {
    return MULTI_TAGGABLE_CLAIM_TYPES.includes(claimType);
}

/**
 * Get the label for a claim type.
 */
export function getClaimTypeLabel(claimType: ClaimType): string {
    const option = CLAIM_TYPE_OPTIONS.find((opt) => opt.value === claimType);
    return option?.label ?? claimType;
}
