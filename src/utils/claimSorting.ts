export type TimelineClaim = {
    claimType: string;
    value: {
        date?: string;
        dateEnd?: string;
        customFields?: { title?: string };
    };
};

export const getClaimTitle = (claim: TimelineClaim): string => {
    if (claim.claimType === 'custom') {
        return claim.value.customFields?.title?.trim() || 'Custom event';
    }

    return claim.claimType.replace('_', ' ');
};

export const sortClaimsForTimeline = <T extends TimelineClaim>(claims: T[]): T[] => {
    return [...claims].sort((a, b) => {
        const aDate = a.value.date ?? a.value.dateEnd ?? '';
        const bDate = b.value.date ?? b.value.dateEnd ?? '';
        const aHasDate = aDate.length > 0;
        const bHasDate = bDate.length > 0;

        if (!aHasDate && !bHasDate) {
            return getClaimTitle(a).localeCompare(getClaimTitle(b));
        }
        if (!aHasDate) return -1;
        if (!bHasDate) return 1;

        const dateCompare = aDate.localeCompare(bDate);
        if (dateCompare !== 0) return dateCompare;

        return getClaimTitle(a).localeCompare(getClaimTitle(b));
    });
};
