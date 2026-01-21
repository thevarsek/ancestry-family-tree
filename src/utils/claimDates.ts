type ClaimDateValue = {
    date?: string;
    dateEnd?: string;
    isCurrent?: boolean;
};

export const formatClaimDate = ({ date, dateEnd, isCurrent }: ClaimDateValue): string => {
    if (isCurrent) {
        if (date) return `${date} - Present`;
        return 'Current';
    }

    if (date && dateEnd) {
        return `${date} - ${dateEnd}`;
    }

    if (date) return date;
    if (dateEnd) return `Until ${dateEnd}`;

    return '';
};
