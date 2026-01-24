import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { WizardModal, type WizardStep } from '../ui/WizardModal';
import { PlaceModal } from '../places';
import { MediaUploadModal } from '../media/MediaUploadModal';
import { SourceModal } from '../sources/SourceModal';
import { FilterableMultiSelect, FilterableSelect, type FilterableOption } from '../ui/FilterableSelect';
import { useClaimForm, type InitialClaimData } from '../../hooks/useClaimForm';
import {
    type ClaimType,
    CLAIM_TYPE_OPTIONS,
    isSingleTaggable,
    isMultiTaggable,
} from '../../types/claims';

type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

interface LifeEventModalProps {
    treeId: Id<"trees">;
    /** The person this life event belongs to */
    subjectId: string;
    subjectType?: "person" | "relationship";
    /** If provided, this is edit mode */
    initialClaim?: InitialClaimData | null;
    /** Default claim type when creating */
    defaultClaimType?: ClaimType;
    onClose: () => void;
    onSuccess?: () => void;
}

/**
 * Wizard modal for creating and editing life events (claims).
 * Steps: Event Type & Details -> Date & Place -> Sources & Media
 */
export function LifeEventModal({
    treeId,
    subjectId,
    subjectType = "person",
    initialClaim,
    defaultClaimType,
    onClose,
    onSuccess,
}: LifeEventModalProps) {
    const isEditMode = !!initialClaim;

    // Wizard state
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Nested modal state
    const [showPlaceModal, setShowPlaceModal] = useState(false);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);

    // Data queries
    const places = useQuery(api.places.list, { treeId, limit: 100 }) as Doc<"places">[] | undefined;
    const people = useQuery(api.people.list, { treeId, limit: 200 }) as Doc<"people">[] | undefined;
    const sources = useQuery(api.sources.list, { treeId, limit: 200 }) as Doc<"sources">[] | undefined;
    const mediaList = useQuery(
        api.media.listByPerson,
        subjectType === 'person' ? { personId: subjectId as Id<"people"> } : "skip"
    ) as MediaWithUrl[] | undefined;
    const linkedMedia = useQuery(
        api.media.listByEntity,
        initialClaim ? { treeId, entityType: "claim", entityId: initialClaim._id } : "skip"
    ) as MediaWithUrl[] | undefined;

    // Form state via custom hook
    const {
        formState,
        isSubmitting,
        setClaimType,
        setDateFrom,
        setDateTo,
        setIsCurrent,
        setPlaceId,
        setDescription,
        setCustomTitle,
        setTaggedPeople,
        setSelectedSourceIds,
        setSelectedMediaIds,
        handleSubmit,
        isCurrentEligible,
        isEditing,
    } = useClaimForm({
        treeId,
        subjectId,
        subjectType,
        defaultClaimType,
        initialClaim,
        linkedMedia,
        onSuccess,
        onClose,
    });

    const {
        claimType,
        dateFrom,
        dateTo,
        isCurrent,
        placeId,
        description,
        customTitle,
        taggedPeople,
        selectedSourceIds,
        selectedMediaIds,
    } = formState;

    // Computed values
    const singleTaggable = isSingleTaggable(claimType);
    const multiTaggable = isMultiTaggable(claimType);
    const availablePeople = (people ?? []).filter(
        (person) => person._id !== (subjectId as Id<"people">)
    );
    const canAttachMedia = subjectType === 'person';

    // Memoized options for selects
    const claimTypeOptions = useMemo<FilterableOption[]>(() => {
        return CLAIM_TYPE_OPTIONS.map((type) => ({
            id: type.value,
            label: type.label,
        }));
    }, []);

    const placeOptions = useMemo<FilterableOption[]>(() => {
        return (places ?? []).map((place) => ({
            id: place._id,
            label: place.displayName,
        }));
    }, [places]);

    const sourceOptions = useMemo<FilterableOption[]>(() => {
        return (sources ?? []).map((source) => ({
            id: source._id,
            label: source.title,
            description: source.author || source.url || undefined,
        }));
    }, [sources]);

    const mediaOptions = useMemo<FilterableOption[]>(() => {
        return (mediaList ?? []).map((item) => {
            const dateLabel = new Date(item.createdAt ?? item._creationTime ?? 0).toLocaleDateString();
            return {
                id: item._id,
                label: item.title,
                description: `${item.type} • ${dateLabel}`,
                thumbnailUrl: item.type === 'photo' ? item.storageUrl ?? undefined : undefined,
                thumbnailLabel: item.type === 'photo' ? undefined : item.type,
            };
        });
    }, [mediaList]);

    const peopleOptions = useMemo<FilterableOption[]>(() => {
        return availablePeople.map((person) => ({
            id: person._id,
            label: `${person.givenNames ?? ''} ${person.surnames ?? ''}`.trim(),
            description: person.isLiving ? 'Living' : 'Deceased',
        }));
    }, [availablePeople]);

    // Form submission wrapper
    const handleSave = async () => {
        setError(null);
        try {
            // Create a synthetic form event since useClaimForm expects FormEvent
            const syntheticEvent = {
                preventDefault: () => {},
            } as React.FormEvent;
            await handleSubmit(syntheticEvent);
        } catch (err) {
            setError('Failed to save. Please try again.');
        }
    };

    // Validation for save button
    const canSave = claimType !== 'custom' || customTitle.trim().length > 0;

    // Wizard steps
    const steps: WizardStep[] = [
        {
            id: 'type',
            label: 'Event Type',
            content: (
                <div className="space-y-4">
                    <div className="input-group">
                        <label className="input-label">Event Type *</label>
                        <FilterableSelect
                            label="event type"
                            placeholder="Select event type..."
                            options={claimTypeOptions}
                            value={claimType}
                            onChange={(value) => {
                                if (!value) return;
                                setClaimType(value as ClaimType);
                                if (value !== 'custom') {
                                    setCustomTitle('');
                                }
                            }}
                        />
                    </div>

                    {claimType === 'custom' && (
                        <div className="input-group">
                            <label className="input-label">Event Title *</label>
                            <input
                                className="input"
                                placeholder="e.g., Graduated from college"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                            />
                        </div>
                    )}

                    {(singleTaggable || multiTaggable) && (
                        <div className="input-group">
                            <label className="input-label">
                                {claimType === 'marriage' ? 'Partner' : 'Tag Other People'}
                            </label>
                            <p className="text-xs text-muted mb-2">
                                {claimType === 'marriage'
                                    ? 'Select the spouse or partner for this event.'
                                    : 'They will see this event on their profile too.'}
                            </p>
                            {singleTaggable ? (
                                <FilterableSelect
                                    label="people"
                                    placeholder="Select a person..."
                                    options={peopleOptions}
                                    value={taggedPeople[0] ?? null}
                                    onChange={(value) => {
                                        if (value) {
                                            setTaggedPeople([value as Id<"people">]);
                                        } else {
                                            setTaggedPeople([]);
                                        }
                                    }}
                                    emptyLabel="No other people in this tree yet."
                                />
                            ) : (
                                <FilterableMultiSelect
                                    label="people"
                                    placeholder="Select people..."
                                    options={peopleOptions}
                                    value={taggedPeople}
                                    onChange={(value) => setTaggedPeople(value as Id<"people">[])}
                                    emptyLabel="No other people in this tree yet."
                                />
                            )}
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">Description / Details</label>
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="Additional details about this event..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'datetime',
            label: 'Date & Place',
            content: (
                <div className="space-y-4">
                    <div className="input-group">
                        <label className="input-label">Date</label>
                        {isCurrentEligible && (
                            <label className="flex items-center gap-2 text-sm text-muted mb-2">
                                <input
                                    type="checkbox"
                                    checked={isCurrent}
                                    onChange={(event) => setIsCurrent(event.target.checked)}
                                />
                                <span>This is current / ongoing</span>
                            </label>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <input
                                    className="input"
                                    placeholder={isCurrentEligible ? 'From (YYYY-MM-DD or YYYY)' : 'YYYY-MM-DD or YYYY'}
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                                <p className="text-xs text-muted mt-1">
                                    {isCurrentEligible ? 'Start date' : 'Date of event'}
                                </p>
                            </div>
                            {isCurrentEligible && !isCurrent && (
                                <div>
                                    <input
                                        className="input"
                                        placeholder="To (YYYY-MM-DD or YYYY)"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                    <p className="text-xs text-muted mt-1">End date</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Place</label>
                        <FilterableSelect
                            label="place"
                            placeholder="Select a place..."
                            options={placeOptions}
                            value={placeId || null}
                            onChange={(value) => setPlaceId((value as Id<"places">) ?? '')}
                            emptyLabel="No matching places."
                            footer={(
                                <button
                                    type="button"
                                    className="btn btn-secondary w-full"
                                    onClick={() => setShowPlaceModal(true)}
                                >
                                    Add new place
                                </button>
                            )}
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'sources',
            label: 'Sources & Media',
            content: (
                <div className="space-y-6">
                    <div className="input-group">
                        <label className="input-label">Sources</label>
                        <p className="text-xs text-muted mb-2">
                            Link sources that document this event (certificates, records, etc.)
                        </p>
                        <FilterableMultiSelect
                            label="sources"
                            placeholder="Select sources..."
                            options={sourceOptions}
                            value={selectedSourceIds}
                            onChange={(value) => setSelectedSourceIds(value as Id<"sources">[])}
                            emptyLabel="No sources added yet."
                            footer={(
                                <button
                                    type="button"
                                    className="btn btn-secondary w-full"
                                    onClick={() => setShowSourceModal(true)}
                                >
                                    Add new source
                                </button>
                            )}
                        />
                        {selectedSourceIds.length > 0 && (
                            <p className="text-xs text-muted mt-1">
                                {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>

                    {canAttachMedia && (
                        <div className="input-group">
                            <label className="input-label">Media</label>
                            <p className="text-xs text-muted mb-2">
                                Attach photos, documents, or other media to this event.
                            </p>
                            <FilterableMultiSelect
                                label="media"
                                placeholder="Select media..."
                                options={mediaOptions}
                                value={selectedMediaIds}
                                onChange={(value) => setSelectedMediaIds(value as Id<"media">[])}
                                emptyLabel="No media added yet."
                                footer={(
                                    <button
                                        type="button"
                                        className="btn btn-secondary w-full"
                                        onClick={() => setShowMediaUpload(true)}
                                    >
                                        Upload new media
                                    </button>
                                )}
                            />
                            {selectedMediaIds.length > 0 && (
                                <p className="text-xs text-muted mt-1">
                                    {selectedMediaIds.length} item{selectedMediaIds.length !== 1 ? 's' : ''} selected
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <WizardModal
                title={isEditing ? 'Edit Life Event' : 'Add Life Event'}
                steps={steps}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                onClose={onClose}
                onSave={handleSave}
                isSaving={isSubmitting}
                canSave={canSave}
                saveLabel={isEditMode ? 'Save Changes' : 'Create Event'}
                savingLabel={isEditMode ? 'Saving...' : 'Creating...'}
                error={error}
            />

            {/* Nested Modals */}
            {showPlaceModal && (
                <PlaceModal
                    treeId={treeId}
                    onClose={() => setShowPlaceModal(false)}
                    onSuccess={(newPlaceId) => {
                        setPlaceId(newPlaceId);
                        setShowPlaceModal(false);
                    }}
                />
            )}
            {showMediaUpload && canAttachMedia && (
                <MediaUploadModal
                    treeId={treeId}
                    ownerPersonId={subjectId as Id<"people">}
                    defaultLinks={initialClaim ? [{ entityType: "claim", entityId: initialClaim._id }] : undefined}
                    onClose={() => setShowMediaUpload(false)}
                    onSuccess={(mediaId) => {
                        setSelectedMediaIds([...selectedMediaIds, mediaId]);
                        setShowMediaUpload(false);
                    }}
                />
            )}
            {showSourceModal && (
                <SourceModal
                    treeId={treeId}
                    onClose={() => setShowSourceModal(false)}
                    onSuccess={(sourceId: Id<"sources">) => {
                        setSelectedSourceIds([...selectedSourceIds, sourceId]);
                        setShowSourceModal(false);
                    }}
                />
            )}
        </>
    );
}
