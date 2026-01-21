import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

type ClaimType =
    | "birth" | "death" | "marriage" | "divorce"
    | "residence" | "occupation" | "education" | "custom";

export function AddClaimModal({
    treeId,
    subjectId,
    subjectType = "person",
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    subjectId: string;
    subjectType?: "person" | "relationship";
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const [claimType, setClaimType] = useState<ClaimType>('birth');
    const [date, setDate] = useState('');
    const [placeId, setPlaceId] = useState<Id<"places"> | "">("");
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const createClaim = useMutation(api.claims.create);
    const places = useQuery(api.places.list, { treeId, limit: 100 });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
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
                },
                status: 'accepted', // Default for direct add
                confidence: 'high',
            });

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
        { value: 'residence', label: 'Residence' },
        { value: 'occupation', label: 'Occupation' },
        { value: 'education', label: 'Education' },
        { value: 'custom', label: 'Other Event' },
    ];

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add Fact or Event</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Event Type</label>
                            <select
                                className="input"
                                value={claimType}
                                onChange={(e) => setClaimType(e.target.value as ClaimType)}
                            >
                                {claimTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

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
                            {isSubmitting ? 'Saving...' : 'Save Fact'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
