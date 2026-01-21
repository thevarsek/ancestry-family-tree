import { useMemo, useState, type FormEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';

export function CreateSourceModal({
    treeId,
    onClose,
    onSuccess,
    claims,
}: {
    treeId: Id<"trees">;
    onClose: () => void;
    onSuccess?: (sourceId: Id<"sources">) => void;
    claims?: Doc<"claims">[];
}) {
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        url: '',
        userNotes: '',
    });
    const [selectedClaimId, setSelectedClaimId] = useState<Id<"claims"> | "">('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createSource = useMutation(api.sources.create);

    const claimOptions = useMemo(() => {
        if (!claims) return [];

        return claims.map((claim) => {
            const customFields = claim.value.customFields as { title?: string } | undefined;
            const rawTitle = claim.claimType === 'custom'
                ? customFields?.title || 'Custom event'
                : claim.claimType.replace('_', ' ');
            const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const dateLabel = claim.value.date ? ` - ${claim.value.date}` : '';
            return {
                id: claim._id,
                label: `${title}${dateLabel}`,
            };
        });
    }, [claims]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.title) return;

        setIsSubmitting(true);
        try {
            const sourceId = await createSource({
                treeId,
                title: formData.title,
                author: formData.author || undefined,
                url: formData.url || undefined,
                notes: formData.userNotes || undefined,
                claimId: selectedClaimId || undefined,
            });
            if (onSuccess) onSuccess(sourceId);
            onClose();
        } catch (error) {
            console.error("Failed to create source:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add New Source</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Title</label>
                            <input
                                className="input"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g. 1920 US Census, Birth Certificate, etc."
                                autoFocus
                                required
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
                            <label className="input-label">URL (Optional)</label>
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
                                value={formData.userNotes}
                                onChange={(e) => setFormData(prev => ({ ...prev, userNotes: e.target.value }))}
                                placeholder="Details about this source..."
                                rows={3}
                            />
                        </div>

                        {claimOptions.length > 0 && (
                            <div className="input-group">
                                <label className="input-label">Link to Life Event</label>
                                <select
                                    className="input"
                                    value={selectedClaimId}
                                    onChange={(e) =>
                                        setSelectedClaimId(e.target.value as Id<"claims"> | '')
                                    }
                                >
                                    <option value="">No event selected</option>
                                    {claimOptions.map((claim) => (
                                        <option key={claim.id} value={claim.id}>
                                            {claim.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted">Optional. Connect this source to a life event.</p>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!formData.title || isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Source'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
