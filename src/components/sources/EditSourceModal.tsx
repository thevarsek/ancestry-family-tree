import { useState, type FormEvent } from 'react';
import { useMutation } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { handleError } from '../../utils/errorHandling';

export function EditSourceModal({
    source,
    onClose,
    onSuccess,
}: {
    source: Doc<"sources">;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const [formData, setFormData] = useState({
        title: source.title ?? '',
        author: source.author ?? '',
        url: source.url ?? '',
        userNotes: source.notes ?? '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const updateSource = useMutation(api.sources.update);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!formData.title.trim()) return;

        setIsSubmitting(true);
        try {
            await updateSource({
                sourceId: source._id as Id<"sources">,
                title: formData.title.trim(),
                author: formData.author.trim() || undefined,
                url: formData.url.trim() || undefined,
                notes: formData.userNotes.trim() || undefined,
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            handleError(error, { operation: 'update source' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Edit Source</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Title</label>
                            <input
                                className="input"
                                value={formData.title}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, title: event.target.value }))
                                }
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
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, author: event.target.value }))
                                }
                                placeholder="e.g. US Census Bureau"
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">URL (Optional)</label>
                            <input
                                className="input"
                                value={formData.url}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, url: event.target.value }))
                                }
                                placeholder="https://..."
                                type="url"
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Notes</label>
                            <textarea
                                className="input"
                                value={formData.userNotes}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, userNotes: event.target.value }))
                                }
                                placeholder="Details about this source..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!formData.title.trim() || isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
