import { describe, it, expect } from 'vitest';
import {
    ClaimType,
    CLAIM_TYPE_OPTIONS,
    CURRENT_ELIGIBLE_CLAIM_TYPES,
    SINGLE_TAGGABLE_CLAIM_TYPES,
    MULTI_TAGGABLE_CLAIM_TYPES,
    isCurrentEligible,
    isSingleTaggable,
    isMultiTaggable,
    getClaimTypeLabel,
} from './claims';

describe('claims types', () => {
    describe('CLAIM_TYPE_OPTIONS', () => {
        it('contains all expected claim types', () => {
            const expectedTypes: ClaimType[] = [
                'birth', 'death', 'marriage', 'divorce',
                'residence', 'occupation', 'workplace', 'education',
                'military_service', 'immigration', 'emigration',
                'naturalization', 'religion', 'name_change', 'custom'
            ];

            const actualTypes = CLAIM_TYPE_OPTIONS.map(opt => opt.value);
            expect(actualTypes).toEqual(expectedTypes);
        });

        it('has labels for all claim types', () => {
            CLAIM_TYPE_OPTIONS.forEach(option => {
                expect(option.label).toBeTruthy();
                expect(typeof option.label).toBe('string');
            });
        });
    });

    describe('isCurrentEligible', () => {
        it('returns true for residence', () => {
            expect(isCurrentEligible('residence')).toBe(true);
        });

        it('returns true for occupation', () => {
            expect(isCurrentEligible('occupation')).toBe(true);
        });

        it('returns true for education', () => {
            expect(isCurrentEligible('education')).toBe(true);
        });

        it('returns true for military_service', () => {
            expect(isCurrentEligible('military_service')).toBe(true);
        });

        it('returns false for birth', () => {
            expect(isCurrentEligible('birth')).toBe(false);
        });

        it('returns false for death', () => {
            expect(isCurrentEligible('death')).toBe(false);
        });

        it('returns false for marriage', () => {
            expect(isCurrentEligible('marriage')).toBe(false);
        });

        it('matches CURRENT_ELIGIBLE_CLAIM_TYPES array', () => {
            CURRENT_ELIGIBLE_CLAIM_TYPES.forEach(type => {
                expect(isCurrentEligible(type)).toBe(true);
            });
        });
    });

    describe('isSingleTaggable', () => {
        it('returns true for marriage', () => {
            expect(isSingleTaggable('marriage')).toBe(true);
        });

        it('returns false for divorce', () => {
            expect(isSingleTaggable('divorce')).toBe(false);
        });

        it('returns false for birth', () => {
            expect(isSingleTaggable('birth')).toBe(false);
        });

        it('matches SINGLE_TAGGABLE_CLAIM_TYPES array', () => {
            SINGLE_TAGGABLE_CLAIM_TYPES.forEach(type => {
                expect(isSingleTaggable(type)).toBe(true);
            });
        });
    });

    describe('isMultiTaggable', () => {
        it('returns true for divorce', () => {
            expect(isMultiTaggable('divorce')).toBe(true);
        });

        it('returns true for custom', () => {
            expect(isMultiTaggable('custom')).toBe(true);
        });

        it('returns false for marriage', () => {
            expect(isMultiTaggable('marriage')).toBe(false);
        });

        it('returns false for birth', () => {
            expect(isMultiTaggable('birth')).toBe(false);
        });

        it('matches MULTI_TAGGABLE_CLAIM_TYPES array', () => {
            MULTI_TAGGABLE_CLAIM_TYPES.forEach(type => {
                expect(isMultiTaggable(type)).toBe(true);
            });
        });
    });

    describe('getClaimTypeLabel', () => {
        it('returns correct label for birth', () => {
            expect(getClaimTypeLabel('birth')).toBe('Birth');
        });

        it('returns correct label for military_service', () => {
            expect(getClaimTypeLabel('military_service')).toBe('Military Service');
        });

        it('returns correct label for custom', () => {
            expect(getClaimTypeLabel('custom')).toBe('Other Event');
        });

        it('returns all labels correctly', () => {
            CLAIM_TYPE_OPTIONS.forEach(option => {
                expect(getClaimTypeLabel(option.value)).toBe(option.label);
            });
        });
    });
});
