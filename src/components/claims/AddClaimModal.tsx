import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { PlaceModal } from '../places/PlaceModal';
import { MediaUploadModal } from '../media/MediaUploadModal';
import { CreateSourceModal } from '../sources/CreateSourceModal';
import { FilterableMultiSelect, FilterableSelect, type FilterableOption } from '../ui/FilterableSelect';

type ClaimType =
    | "birth" | "death" | "marriage" | "divorce"
    | "residence" | "occupation" | "education"
    | "workplace" | "military_service" | "immigration" | "emigration"
    | "naturalization" | "religion" | "name_change" | "custom";

type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

export function AddClaimModal({
    treeId,
    subjectId,
    subjectType = "person",
    onClose,
    onSuccess,
    defaultClaimType,
    initialClaim
}: {
    treeId: Id<"trees">;
    subjectId: string;
    subjectType?: "person" | "relationship";
    onClose: () => void;
    onSuccess?: () => void;
    defaultClaimType?: ClaimType;
    initialClaim?: (Doc<"claims"> & { sources?: Doc<"sources">[] }) | null;
}) {
    const [claimType, setClaimType] = useState<ClaimType>(defaultClaimType ?? 'birth');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isCurrent, setIsCurrent] = useState(false);
    const [placeId, setPlaceId] = useState<Id<"places"> | "">("");
    const [description, setDescription] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [taggedPeople, setTaggedPeople] = useState<Id<"people">[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Id<"sources">[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<Id<"media">[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);

    const createClaim = useMutation(api.claims.create);
    const updateClaim = useMutation(api.claims.update);
    const addSource = useMutation(api.claims.addSource);
    const removeSource = useMutation(api.claims.removeSource);
    const updateMediaLinks = useMutation(api.media.updateLinks);
    const places = useQuery(api.places.list, { treeId, limit: 100 });
    const people = useQuery(api.people.list, { treeId, limit: 200 });
    const sources = useQuery(api.sources.list, { treeId, limit: 200 });
    const mediaList = useQuery(
        api.media.listByPerson,
        subjectType === 'person' ? { personId: subjectId as Id<"people"> } : "skip"
    ) as MediaWithUrl[] | undefined;
    const linkedMedia = useQuery(
        api.media.listByEntity,
        initialClaim ? { treeId, entityType: "claim", entityId: initialClaim._id } : "skip"
    ) as MediaWithUrl[] | undefined;

    const currentEligibleClaimTypes: ClaimType[] = ['residence', 'occupation', 'education', 'military_service'];
    const isCurrentEligible = currentEligibleClaimTypes.includes(claimType);

    useEffect(() => {
        if (initialClaim) {
            setClaimType(initialClaim.claimType as ClaimType);
            setDateFrom(initialClaim.value.date ?? '');
            setDateTo(initialClaim.value.dateEnd ?? '');
            setIsCurrent(Boolean(initialClaim.value.isCurrent));
            setPlaceId((initialClaim.value.placeId as Id<"places"> | undefined) ?? '');
            setDescription(initialClaim.value.description ?? '');
            const customFields = initialClaim.value.customFields as { title?: string } | undefined;
            setCustomTitle(customFields?.title ?? '');
            setTaggedPeople([]);
            setSelectedSourceIds(
                (initialClaim.sources ?? []).map((source: Doc<"sources">) => source._id)
            );
            return;
        }

        if (defaultClaimType) {
            setClaimType(defaultClaimType);
        }
        setDateFrom('');
        setDateTo('');
        setIsCurrent(false);
        setPlaceId('');
        setDescription('');
        setCustomTitle('');
        setTaggedPeople([]);
        setSelectedSourceIds([]);
        setSelectedMediaIds([]);
    }, [defaultClaimType, initialClaim]);

    useEffect(() => {
        if (initialClaim && linkedMedia) {
            setSelectedMediaIds(linkedMedia.map((item) => item._id));
        }
    }, [initialClaim, linkedMedia]);

    useEffect(() => {
        if (!isCurrentEligible) {
            setIsCurrent(false);
            setDateTo('');
        }
    }, [isCurrentEligible]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const customFields = claimType === 'custom' && customTitle.trim()
                ? { title: customTitle.trim() }
                : undefined;
            const isCurrentValue = isCurrentEligible && isCurrent ? true : undefined;
            const dateEndValue = isCurrentEligible && !isCurrent ? dateTo || undefined : undefined;

            if (initialClaim) {
                await updateClaim({
                    claimId: initialClaim._id,
                    claimType,
                    value: {
                        date: dateFrom || undefined,
                        dateEnd: dateEndValue,
                        isCurrent: isCurrentValue,
                        placeId: placeId || undefined,
                        description: description || undefined,
                        datePrecision: 'year',
                        customFields,
                    },
                });

                const existingSourceIds = new Set(
                    (initialClaim.sources ?? []).map((source: Doc<"sources">) => source._id)
                );
                const nextSourceIds = new Set(selectedSourceIds);

                const sourceAdds = selectedSourceIds.filter(
                    (sourceId) => !existingSourceIds.has(sourceId)
                );
                const sourceRemovals = Array.from(existingSourceIds).filter(
                    (sourceId) => !nextSourceIds.has(sourceId)
                );

                await Promise.all([
                    ...sourceAdds.map((sourceId) =>
                        addSource({ claimId: initialClaim._id, sourceId })
                    ),
                    ...sourceRemovals.map((sourceId) =>
                        removeSource({ claimId: initialClaim._id, sourceId })
                    ),
                ]);

                if (subjectType === 'person') {
                    await updateMediaLinks({
                        treeId,
                        entityType: "claim",
                        entityId: initialClaim._id,
                        mediaIds: selectedMediaIds
                    });
                }
            } else {
                const claimId = await createClaim({
                    treeId,
                    subjectType,
                    subjectId,
                    claimType,
                    value: {
                        date: dateFrom || undefined,
                        dateEnd: dateEndValue,
                        isCurrent: isCurrentValue,
                        placeId: placeId || undefined,
                        description: description || undefined,
                        datePrecision: 'year', // Default for MVP
                        customFields,
                    },
                    relatedPersonIds: taggedPeople.length ? taggedPeople : undefined,
                    status: 'accepted', // Default for direct add
                    confidence: 'high',
                }) as Id<"claims">;

                await Promise.all(
                    selectedSourceIds.map((sourceId) =>
                        addSource({ claimId, sourceId })
                    )
                );

                if (subjectType === 'person') {
                    await updateMediaLinks({
                        treeId,
                        entityType: "claim",
                        entityId: claimId,
                        mediaIds: selectedMediaIds
                    });
                }
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to add claim:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const claimTypes: { value: ClaimType, label: string }[] = [
        { value: 'birth', label: 'Birth' },
        { value: 'death', label: 'Death' },
        { value: 'marriage', label: 'Marriage' },
        { value: 'divorce', label: 'Divorce' },
        { value: 'residence', label: 'Residence' },
        { value: 'occupation', label: 'Occupation' },
        { value: 'workplace', label: 'Workplace' },
        { value: 'education', label: 'Education' },
        { value: 'military_service', label: 'Military Service' },
        { value: 'immigration', label: 'Immigration' },
        { value: 'emigration', label: 'Emigration' },
        { value: 'naturalization', label: 'Naturalization' },
        { value: 'religion', label: 'Religion' },
        { value: 'name_change', label: 'Name Change' },
        { value: 'custom', label: 'Other Event' },
    ];

    const singleTaggableClaimTypes: ClaimType[] = ['marriage'];
    const multiTaggableClaimTypes: ClaimType[] = ['divorce', 'custom'];
    const isSingleTaggable = singleTaggableClaimTypes.includes(claimType);
    const isMultiTaggable = multiTaggableClaimTypes.includes(claimType);
    const availablePeople = (people ?? []).filter(
        (person) => person._id !== (subjectId as Id<"people">)
    );
    const canAttachMedia = subjectType === 'person';

    const claimTypeOptions = useMemo<FilterableOption[]>(() => {
        return claimTypes.map((type) => ({
            id: type.value,
            label: type.label,
        }));
    }, [claimTypes]);

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

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">{initialClaim ? 'Edit Fact or Event' : 'Add Fact or Event'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Event Type</label>
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
                                <label className="input-label">Event Title</label>
                                <input
                                    className="input"
                                    placeholder="e.g., Moved to a new city"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {(isSingleTaggable || isMultiTaggable) && (
                            <div className="input-group">
                                <label className="input-label">
                                    {claimType === 'marriage' ? 'Partner' : 'Tag Other People'}
                                </label>
                                <p className="text-xs text-muted">
                                    {claimType === 'marriage'
                                        ? 'Select the spouse or partner for this event.'
                                        : 'They will see this event on their profile too.'}
                                </p>
                                {isSingleTaggable ? (
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group space-y-2">
                                <label className="input-label">Date</label>
                                {isCurrentEligible && (
                                    <label className="flex items-center gap-2 text-sm text-muted">
                                        <input
                                            type="checkbox"
                                            checked={isCurrent}
                                            onChange={(event) => setIsCurrent(event.target.checked)}
                                        />
                                        <span>Current</span>
                                    </label>
                                )}
                                <div className="grid grid-cols-1 gap-2">
                                    <input
                                        className="input"
                                        placeholder={isCurrentEligible ? 'From (YYYY-MM-DD or YYYY)' : 'YYYY-MM-DD or YYYY'}
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                    {isCurrentEligible && !isCurrent && (
                                        <input
                                            className="input"
                                            placeholder="To (YYYY-MM-DD or YYYY)"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                        />
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

                        <div className="input-group">
                            <label className="input-label">Description / Details</label>
                            <textarea
                                className="input"
                                rows={3}
                                placeholder="Additional details..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Sources</label>
                            <p className="text-xs text-muted">Optional. Link sources to this event.</p>
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
                        </div>

                        {canAttachMedia && (
                            <div className="input-group">
                                <label className="input-label">Media</label>
                                <p className="text-xs text-muted">Optional. Attach media to this event.</p>
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
                                            Add new media
                                        </button>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : initialClaim ? 'Save Changes' : 'Save Fact'}
                        </button>
                    </div>
                </form>
            </div>
            {showPlaceModal && (
                <PlaceModal
                    treeId={treeId}
                    onClose={() => setShowPlaceModal(false)}
                    onSuccess={(placeId) => {
                        setPlaceId(placeId);
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
                        setSelectedMediaIds((prev) => [...prev, mediaId]);
                        setShowMediaUpload(false);
                    }}
                />
            )}
            {showSourceModal && (
                <CreateSourceModal
                    treeId={treeId}
                    personId={subjectId as Id<"people">}
                    onClose={() => setShowSourceModal(false)}
                    onSuccess={(sourceId) => {
                        setSelectedSourceIds((prev) => [...prev, sourceId]);
                        setShowSourceModal(false);
                    }}
                />
            )}
        </>
    );
}
