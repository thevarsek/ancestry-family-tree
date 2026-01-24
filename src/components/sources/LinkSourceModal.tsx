import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { Modal } from '../ui/Modal';
import { FilterableSelect } from '../ui/FilterableSelect';

interface LinkSourceModalProps {
    treeId: Id<"trees">;
    /** IDs of sources already linked (will be excluded from options) */
    excludeSourceIds?: Id<"sources">[];
    onClose: () => void;
    /** Called when user selects an existing source */
    onSelect: (sourceId: Id<"sources">) => void;
    /** Called when user wants to create a new source */
    onCreateNew: () => void;
}

/**
 * Modal for linking an existing source to an entity.
 * Shows a searchable list of sources with option to create new.
 */
export function LinkSourceModal({
    treeId,
    excludeSourceIds = [],
    onClose,
    onSelect,
    onCreateNew,
}: LinkSourceModalProps) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    
    const allSources = useQuery(api.sources.list, { treeId, limit: 200 }) as Doc<"sources">[] | undefined;
    
    const sourceOptions = useMemo(() => {
        if (!allSources) return [];
        const excludeSet = new Set(excludeSourceIds);
        return allSources
            .filter(s => !excludeSet.has(s._id))
            .map(s => ({
                id: s._id,
                label: s.title,
                description: s.author || s.url || undefined,
            }));
    }, [allSources, excludeSourceIds]);

    const handleLink = () => {
        if (selectedSourceId) {
            onSelect(selectedSourceId as Id<"sources">);
            onClose();
        }
    };

    const handleCreateNew = () => {
        onCreateNew();
        onClose();
    };

    return (
        <Modal
            isOpen
            title="Link Source"
            onClose={onClose}
            size="md"
            footer={
                <>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCreateNew}
                    >
                        Create New Source
                    </button>
                    <div className="flex gap-3 ml-auto">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleLink}
                            disabled={!selectedSourceId}
                        >
                            Link Source
                        </button>
                    </div>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Select an existing source to link, or create a new one.
                </p>
                
                {allSources === undefined ? (
                    <div className="spinner mx-auto" />
                ) : sourceOptions.length === 0 ? (
                    <p className="text-sm text-muted">
                        No available sources to link. All sources are already linked or none exist.
                    </p>
                ) : (
                    <FilterableSelect
                        label="Source"
                        placeholder="Select a source..."
                        options={sourceOptions}
                        value={selectedSourceId}
                        onChange={setSelectedSourceId}
                        className="filterable-select-wide"
                    />
                )}
            </div>
        </Modal>
    );
}
