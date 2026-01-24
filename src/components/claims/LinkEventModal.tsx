import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { Modal } from '../ui/Modal';
import { FilterableSelect, type FilterableOption } from '../ui/FilterableSelect';
import { formatClaimDate } from '../../utils/claimDates';

type ClaimWithPerson = Doc<"claims"> & { personName: string | null };

interface LinkEventModalProps {
    treeId: Id<"trees">;
    /** IDs of claims already linked (will be excluded from options) */
    excludeClaimIds?: Id<"claims">[];
    onClose: () => void;
    /** Called when user selects an existing event */
    onSelect: (claimId: Id<"claims">) => void;
    /** Called when user wants to create a new event */
    onCreateNew?: () => void;
}

/**
 * Modal for linking an existing life event to an entity.
 * Shows a searchable list of events with option to create new.
 */
export function LinkEventModal({
    treeId,
    excludeClaimIds = [],
    onClose,
    onSelect,
    onCreateNew,
}: LinkEventModalProps) {
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    
    const allClaims = useQuery(api.claims.queries.listByTree, { treeId, limit: 500 }) as ClaimWithPerson[] | undefined;
    
    const claimOptions: FilterableOption[] = useMemo(() => {
        if (!allClaims) return [];
        const excludeSet = new Set(excludeClaimIds);
        return allClaims
            .filter(c => !excludeSet.has(c._id))
            .map(c => {
                const customFields = c.value.customFields as { title?: string } | undefined;
                const rawTitle = c.claimType === 'custom'
                    ? customFields?.title || 'Custom event'
                    : c.claimType.replace('_', ' ');
                const titleLabel = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
                const personLabel = c.personName ? ` - ${c.personName}` : '';
                return {
                    id: c._id,
                    label: `${titleLabel}${personLabel}`,
                    description: formatClaimDate(c.value) || undefined,
                };
            });
    }, [allClaims, excludeClaimIds]);

    const handleLink = () => {
        if (selectedClaimId) {
            onSelect(selectedClaimId as Id<"claims">);
            onClose();
        }
    };

    const handleCreateNew = () => {
        if (onCreateNew) {
            onCreateNew();
            onClose();
        }
    };

    return (
        <Modal
            isOpen
            title="Link Life Event"
            onClose={onClose}
            size="md"
            footer={
                <>
                    {onCreateNew && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCreateNew}
                        >
                            Create New Event
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleLink}
                            disabled={!selectedClaimId}
                        >
                            Link Event
                        </button>
                    </div>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Select a life event to link to this source.
                </p>
                
                {allClaims === undefined ? (
                    <div className="spinner mx-auto" />
                ) : claimOptions.length === 0 ? (
                    <p className="text-sm text-muted">
                        No available events to link. All events are already linked or none exist.
                    </p>
                ) : (
                    <FilterableSelect
                        label="Life Event"
                        placeholder="Select an event..."
                        options={claimOptions}
                        value={selectedClaimId}
                        onChange={setSelectedClaimId}
                        className="filterable-select-wide filterable-select-multiline"
                    />
                )}
            </div>
        </Modal>
    );
}
