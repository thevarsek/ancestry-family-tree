import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { WizardModal, type WizardStep } from '../ui/WizardModal';
import { FilterableMultiSelect, type FilterableOption } from '../ui/FilterableSelect';
import { formatClaimDate } from '../../utils/claimDates';
import { useErrorHandler } from '../../hooks/useErrorHandler';

type ClaimWithPerson = Doc<"claims"> & { personName: string | null };
type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

interface SourceModalProps {
    treeId: Id<"trees">;
    /** If provided, this is edit mode */
    initialSource?: Doc<"sources">;
    /** Pre-selected claim IDs (for edit mode or when opening from a claim) */
    initialClaimIds?: Id<"claims">[];
    /** Pre-selected media IDs (for edit mode) */
    initialMediaIds?: Id<"media">[];
    onClose: () => void;
    onSuccess?: (sourceId: Id<"sources">) => void;
}

/**
 * Unified modal for creating and editing sources.
 * Uses a wizard pattern with steps for basic info, life events, and media.
 */
export function SourceModal({
    treeId,
    initialSource,
    initialClaimIds = [],
    initialMediaIds = [],
    onClose,
    onSuccess,
}: SourceModalProps) {
    const isEditMode = !!initialSource;
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Form state
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        title: initialSource?.title ?? '',
        author: initialSource?.author ?? '',
        url: initialSource?.url ?? '',
        notes: initialSource?.notes ?? '',
    });
    const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>(
        initialClaimIds.map(id => id.toString())
    );
    const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(
        initialMediaIds.map(id => id.toString())
    );
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Queries
    const allClaims = useQuery(api.claims.queries.listByTree, { treeId, limit: 500 }) as ClaimWithPerson[] | undefined;
    const allMedia = useQuery(api.media.listByTree, { treeId, limit: 200 }) as MediaWithUrl[] | undefined;

    // Mutations
    const createSource = useMutation(api.sources.create);
    const updateSource = useMutation(api.sources.update);
    const addSourceToClaim = useMutation(api.claims.links.addSource);
    const removeSourceFromClaim = useMutation(api.claims.links.removeSource);
    const updateMediaLinks = useMutation(api.media.updateLinks);

    // Build claim options for FilterableMultiSelect
    const claimOptions: FilterableOption[] = useMemo(() => {
        if (!allClaims) return [];
        return allClaims.map((claim) => {
            const customFields = claim.value.customFields as { title?: string } | undefined;
            const rawTitle = claim.claimType === 'custom'
                ? customFields?.title || 'Custom event'
                : claim.claimType.replace('_', ' ');
            const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const dateLabel = formatClaimDate(claim.value);
            const personLabel = claim.personName ? ` - ${claim.personName}` : '';
            return {
                id: claim._id,
                label: `${title}${personLabel}`,
                description: dateLabel || undefined,
            };
        });
    }, [allClaims]);

    // Build media options for FilterableMultiSelect
    const mediaOptions: FilterableOption[] = useMemo(() => {
        if (!allMedia) return [];
        return allMedia.map((media) => ({
            id: media._id,
            label: media.title,
            description: media.type,
            thumbnailUrl: media.storageUrl,
            thumbnailLabel: media.type?.charAt(0).toUpperCase() ?? 'M',
        }));
    }, [allMedia]);

    const canSave = formData.title.trim().length > 0;

    const handleSave = async () => {
        if (!canSave) return;

        setIsSaving(true);
        setError(null);

        try {
            let sourceId: Id<"sources">;

            if (isEditMode && initialSource) {
                // Update existing source
                await updateSource({
                    sourceId: initialSource._id,
                    title: formData.title.trim(),
                    author: formData.author.trim() || undefined,
                    url: formData.url.trim() || undefined,
                    notes: formData.notes.trim() || undefined,
                });
                sourceId = initialSource._id;

                // Handle claim link changes
                const previousClaimIds = new Set(initialClaimIds.map(id => id.toString()));
                const currentClaimIds = new Set(selectedClaimIds);

                // Remove links that were unchecked
                for (const claimId of previousClaimIds) {
                    if (!currentClaimIds.has(claimId)) {
                        await removeSourceFromClaim({
                            claimId: claimId as Id<"claims">,
                            sourceId,
                        });
                    }
                }

                // Add new links
                for (const claimId of currentClaimIds) {
                    if (!previousClaimIds.has(claimId)) {
                        await addSourceToClaim({
                            claimId: claimId as Id<"claims">,
                            sourceId,
                        });
                    }
                }
            } else {
                // Create new source
                sourceId = await createSource({
                    treeId,
                    title: formData.title.trim(),
                    author: formData.author.trim() || undefined,
                    url: formData.url.trim() || undefined,
                    notes: formData.notes.trim() || undefined,
                });

                // Link to selected claims
                for (const claimId of selectedClaimIds) {
                    await addSourceToClaim({
                        claimId: claimId as Id<"claims">,
                        sourceId,
                    });
                }
            }

            // Update media links (works for both create and edit)
            await updateMediaLinks({
                treeId,
                entityType: 'source',
                entityId: sourceId,
                mediaIds: selectedMediaIds as Id<"media">[],
            });

            showSuccess(isEditMode ? 'Source updated successfully' : 'Source created successfully');
            onSuccess?.(sourceId);
            onClose();
        } catch (err) {
            handleErrorWithToast(err, { operation: isEditMode ? 'update source' : 'create source' });
            setError('Failed to save source. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Wizard steps
    const steps: WizardStep[] = [
        {
            id: 'basic',
            label: 'Basic Info',
            content: (
                <div className="space-y-4">
                    <div className="input-group">
                        <label className="input-label">Title *</label>
                        <input
                            className="input"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g. 1920 US Census, Birth Certificate, etc."
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Author / Creator</label>
                        <input
                            className="input"
                            value={formData.author}
                            onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                            placeholder="e.g. US Census Bureau"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">URL</label>
                        <input
                            className="input"
                            value={formData.url}
                            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                            placeholder="https://..."
                            type="url"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Notes</label>
                        <textarea
                            className="input"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Additional details about this source..."
                            rows={3}
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'events',
            label: 'Life Events',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        Link this source to one or more life events. This helps document where information came from.
                    </p>
                    {allClaims === undefined ? (
                        <div className="spinner mx-auto" />
                    ) : claimOptions.length === 0 ? (
                        <p className="text-sm text-muted">No life events in this tree yet.</p>
                    ) : (
                        <FilterableMultiSelect
                            label="Life Events"
                            placeholder="Select life events..."
                            options={claimOptions}
                            value={selectedClaimIds}
                            onChange={setSelectedClaimIds}
                            className="filterable-select-wide"
                        />
                    )}
                    {selectedClaimIds.length > 0 && (
                        <p className="text-xs text-muted">
                            {selectedClaimIds.length} event{selectedClaimIds.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>
            ),
        },
        {
            id: 'media',
            label: 'Media',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        Attach photos, documents, or other media to this source.
                    </p>
                    {allMedia === undefined ? (
                        <div className="spinner mx-auto" />
                    ) : mediaOptions.length === 0 ? (
                        <p className="text-sm text-muted">No media in this tree yet.</p>
                    ) : (
                        <FilterableMultiSelect
                            label="Media"
                            placeholder="Select media..."
                            options={mediaOptions}
                            value={selectedMediaIds}
                            onChange={setSelectedMediaIds}
                            className="filterable-select-wide"
                        />
                    )}
                    {selectedMediaIds.length > 0 && (
                        <p className="text-xs text-muted">
                            {selectedMediaIds.length} item{selectedMediaIds.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>
            ),
        },
    ];

    return (
        <WizardModal
            title={isEditMode ? 'Edit Source' : 'Add Source'}
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onClose={onClose}
            onSave={handleSave}
            isSaving={isSaving}
            canSave={canSave}
            saveLabel={isEditMode ? 'Save Changes' : 'Create Source'}
            savingLabel={isEditMode ? 'Saving...' : 'Creating...'}
            error={error}
        />
    );
}
