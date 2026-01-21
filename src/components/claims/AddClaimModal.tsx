import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { PlaceModal } from '../places/PlaceModal';

type ClaimType =
    | "birth" | "death" | "marriage" | "divorce"
    | "residence" | "occupation" | "education"
    | "workplace" | "military_service" | "immigration" | "emigration"
    | "naturalization" | "religion" | "name_change" | "custom";

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
    const [date, setDate] = useState('');
    const [placeId, setPlaceId] = useState<Id<"places"> | "">("");
    const [description, setDescription] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [taggedPeople, setTaggedPeople] = useState<Id<"people">[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Id<"sources">[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);

    const createClaim = useMutation(api.claims.create);
    const updateClaim = useMutation(api.claims.update);
    const addSource = useMutation(api.claims.addSource);
    const removeSource = useMutation(api.claims.removeSource);
    const places = useQuery(api.places.list, { treeId, limit: 100 });
    const people = useQuery(api.people.list, { treeId, limit: 200 });
    const sources = useQuery(api.sources.list, { treeId, limit: 200 });

    useEffect(() => {
        if (initialClaim) {
            setClaimType(initialClaim.claimType as ClaimType);
            setDate(initialClaim.value.date ?? '');
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
        setDate('');
        setPlaceId('');
        setDescription('');
        setCustomTitle('');
        setTaggedPeople([]);
        setSelectedSourceIds([]);
    }, [defaultClaimType, initialClaim]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const customFields = claimType === 'custom' && customTitle.trim()
                ? { title: customTitle.trim() }
                : undefined;

            if (initialClaim) {
                await updateClaim({
                    claimId: initialClaim._id,
                    claimType,
                    value: {
                        date: date || undefined,
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
            } else {
                const claimId = await createClaim({
                    treeId,
                    subjectType,
                    subjectId,
                    claimType,
                    value: {
                        date: date || undefined,
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

    const taggableClaimTypes: ClaimType[] = ['marriage', 'divorce', 'custom'];
    const availablePeople = (people ?? []).filter(
        (person) => person._id !== (subjectId as Id<"people">)
    );

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
                            <select
                                className="input"
                                value={claimType}
                                onChange={(e) => {
                                    setClaimType(e.target.value as ClaimType);
                                    if (e.target.value !== 'custom') {
                                        setCustomTitle('');
                                    }
                                }}
                            >
                                {claimTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
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

                        {taggableClaimTypes.includes(claimType) && (
                            <div className="input-group">
                                <label className="input-label">Tag Other People</label>
                                <p className="text-xs text-muted">They will see this event on their profile too.</p>
                                <div className="border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {availablePeople.map((person) => (
                                        <label key={person._id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={taggedPeople.includes(person._id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setTaggedPeople((prev) => [...prev, person._id]);
                                                    } else {
                                                        setTaggedPeople((prev) => prev.filter((id) => id !== person._id));
                                                    }
                                                }}
                                            />
                                            <span>{person.givenNames} {person.surnames}</span>
                                        </label>
                                    ))}
                                    {availablePeople.length === 0 && (
                                        <p className="text-xs text-muted">No other people in this tree yet.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group">
                                <label className="input-label">Date</label>
                                <input
                                    className="input"
                                    placeholder="YYYY-MM-DD or YYYY"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Place</label>
                                <select
                                    className="input"
                                    value={placeId}
                                    onChange={(e) => setPlaceId(e.target.value as Id<"places">)}
                                >
                                    <option value="">Select a place...</option>
                                    {places?.map(p => (
                                        <option key={p._id} value={p._id}>{p.displayName}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowPlaceModal(true)}
                                >
                                    Add new place
                                </button>
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
                            <div className="border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                {sources?.map((source) => (
                                    <label key={source._id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedSourceIds.includes(source._id)}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedSourceIds((prev) => [...prev, source._id]);
                                                } else {
                                                    setSelectedSourceIds((prev) =>
                                                        prev.filter((id) => id !== source._id)
                                                    );
                                                }
                                            }}
                                        />
                                        <span>{source.title}</span>
                                    </label>
                                ))}
                                {(sources?.length ?? 0) === 0 && (
                                    <p className="text-xs text-muted">No sources added yet.</p>
                                )}
                            </div>
                        </div>
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
        </>
    );
}
