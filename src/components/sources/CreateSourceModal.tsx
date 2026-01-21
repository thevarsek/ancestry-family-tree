import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function CreateSourceModal({
    treeId,
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    onClose: () => void;
    onSuccess?: (sourceId: Id<"sources">) => void;
}) {
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        url: '',
        userNotes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createSource = useMutation(api.sources.create);

    const handleSubmit = async (e: React.FormEvent) => {
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
