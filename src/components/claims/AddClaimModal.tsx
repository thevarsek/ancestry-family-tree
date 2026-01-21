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
    initialClaim?: Doc<"claims"> | null;
}) {
    const [claimType, setClaimType] = useState<ClaimType>(defaultClaimType ?? 'birth');
    const [date, setDate] = useState('');
    const [placeId, setPlaceId] = useState<Id<"places"> | "">("");
    const [description, setDescription] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPlaceModal, setShowPlaceModal] = useState(false);

    const createClaim = useMutation(api.claims.create);
    const updateClaim = useMutation(api.claims.update);
    const places = useQuery(api.places.list, { treeId, limit: 100 });

    useEffect(() => {
        if (initialClaim) {
            setClaimType(initialClaim.claimType as ClaimType);
            setDate(initialClaim.value.date ?? '');
            setPlaceId((initialClaim.value.placeId as Id<"places"> | undefined) ?? '');
            setDescription(initialClaim.value.description ?? '');
            const customFields = initialClaim.value.customFields as { title?: string } | undefined;
            setCustomTitle(customFields?.title ?? '');
            return;
        }

        if (defaultClaimType) {
            setClaimType(defaultClaimType);
        }
        setDate('');
        setPlaceId('');
        setDescription('');
        setCustomTitle('');
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
            } else {
                await createClaim({
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
                    status: 'accepted', // Default for direct add
                    confidence: 'high',
                });
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
