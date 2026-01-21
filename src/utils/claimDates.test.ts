import { describe, expect, it } from 'vitest';
import { formatClaimDate } from './claimDates';

describe('formatClaimDate', () => {
    it('formats current claims with a start date', () => {
        expect(formatClaimDate({ date: '2001', isCurrent: true })).toBe('2001 - Present');
    });

    it('formats current claims without a start date', () => {
        expect(formatClaimDate({ isCurrent: true })).toBe('Current');
    });

    it('formats a full date range', () => {
        expect(formatClaimDate({ date: '1990', dateEnd: '1995' })).toBe('1990 - 1995');
    });

    it('formats end-only dates', () => {
        expect(formatClaimDate({ dateEnd: '1980' })).toBe('Until 1980');
    });

    it('returns an empty string when no dates are set', () => {
        expect(formatClaimDate({})).toBe('');
    });
});
