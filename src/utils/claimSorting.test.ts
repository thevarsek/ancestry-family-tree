import { describe, expect, it } from 'vitest';
import { getClaimTitle, sortClaimsForTimeline } from './claimSorting';

type TestClaim = {
    id: string;
    claimType: string;
    value: {
        date?: string;
        dateEnd?: string;
        customFields?: { title?: string };
    };
};

const createClaim = (data: Partial<TestClaim> & Pick<TestClaim, 'id' | 'claimType'>): TestClaim => ({
    id: data.id,
    claimType: data.claimType,
    value: data.value ?? {}
});

describe('claimSorting', () => {
    it('sorts unknown dates first and alphabetically', () => {
        const claims = [
            createClaim({ id: '1', claimType: 'death' }),
            createClaim({ id: '2', claimType: 'birth' }),
            createClaim({ id: '3', claimType: 'marriage', value: { date: '2001' } })
        ];

        const sorted = sortClaimsForTimeline(claims);

        expect(sorted.map((claim) => claim.id)).toEqual(['2', '1', '3']);
    });

    it('sorts by date ascending and uses title tiebreaker', () => {
        const claims = [
            createClaim({ id: '1', claimType: 'death', value: { date: '2005' } }),
            createClaim({ id: '2', claimType: 'birth', value: { date: '2001' } }),
            createClaim({ id: '3', claimType: 'custom', value: { date: '2005', customFields: { title: 'Anniversary' } } }),
            createClaim({ id: '4', claimType: 'custom', value: { date: '2005', customFields: { title: 'Birthday' } } })
        ];

        const sorted = sortClaimsForTimeline(claims);

        expect(sorted.map((claim) => claim.id)).toEqual(['2', '3', '4', '1']);
    });

    it('formats claim titles for sorting', () => {
        expect(getClaimTitle(createClaim({ id: '1', claimType: 'custom', value: { customFields: { title: ' Reunion ' } } })))
            .toBe('Reunion');
        expect(getClaimTitle(createClaim({ id: '2', claimType: 'military_service' }))).toBe('military service');
    });
});
