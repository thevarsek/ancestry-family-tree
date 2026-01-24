import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { Modal } from '../ui/Modal';
import { FilterableSelect, type FilterableOption } from '../ui/FilterableSelect';

type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

interface LinkMediaModalProps {
    treeId: Id<"trees">;
    /** IDs of media already linked (will be excluded from options) */
    excludeMediaIds?: Id<"media">[];
    onClose: () => void;
    /** Called when user selects an existing media */
    onSelect: (mediaId: Id<"media">) => void;
    /** Called when user wants to create/upload new media */
    onCreateNew: () => void;
}

/**
 * Modal for linking existing media to an entity.
 * Shows a searchable list of media with option to upload new.
 */
export function LinkMediaModal({
    treeId,
    excludeMediaIds = [],
    onClose,
    onSelect,
    onCreateNew,
}: LinkMediaModalProps) {
    const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
    
    const allMedia = useQuery(api.media.listByTree, { treeId, limit: 200 }) as MediaWithUrl[] | undefined;
    
    const mediaOptions: FilterableOption[] = useMemo(() => {
        if (!allMedia) return [];
        const excludeSet = new Set(excludeMediaIds);
        return allMedia
            .filter(m => !excludeSet.has(m._id))
            .map(m => ({
                id: m._id,
                label: m.title,
                description: m.type,
                thumbnailUrl: m.storageUrl ?? null,
            }));
    }, [allMedia, excludeMediaIds]);

    const handleLink = () => {
        if (selectedMediaId) {
            onSelect(selectedMediaId as Id<"media">);
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
            title="Link Media"
            onClose={onClose}
            size="md"
            footer={
                <>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCreateNew}
                    >
                        Upload New Media
                    </button>
                    <div className="flex gap-3 ml-auto">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleLink}
                            disabled={!selectedMediaId}
                        >
                            Link Media
                        </button>
                    </div>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Select existing media to link, or upload new.
                </p>
                
                {allMedia === undefined ? (
                    <div className="spinner mx-auto" />
                ) : mediaOptions.length === 0 ? (
                    <p className="text-sm text-muted">
                        No available media to link. All media is already linked or none exists.
                    </p>
                ) : (
                    <FilterableSelect
                        label="Media"
                        placeholder="Select media..."
                        options={mediaOptions}
                        value={selectedMediaId}
                        onChange={setSelectedMediaId}
                        className="filterable-select-wide"
                    />
                )}
            </div>
        </Modal>
    );
}
