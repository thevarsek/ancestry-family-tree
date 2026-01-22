import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { MediaUploadModal } from '../media/MediaUploadModal';
import { formatClaimDate } from '../../utils/claimDates';
import { useErrorHandler } from '../../hooks/useErrorHandler';

export function CreateSourceModal({
    treeId,
    onClose,
    onSuccess,
    claims,
    personId,
}: {
    treeId: Id<"trees">;
    onClose: () => void;
    onSuccess?: (sourceId: Id<"sources">) => void;
    claims?: Doc<"claims">[];
    personId?: Id<"people">;
}) {
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        url: '',
        userNotes: '',
    });
    const [selectedClaimId, setSelectedClaimId] = useState<Id<"claims"> | "">('');
    const [mediaOwnerPersonId, setMediaOwnerPersonId] = useState<Id<"people"> | "">(personId ?? '');
    const [selectedMediaIds, setSelectedMediaIds] = useState<Id<"media">[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const createSource = useMutation(api.sources.create);
    const updateMediaLinks = useMutation(api.media.updateLinks);
    const people = useQuery(api.people.list, { treeId, limit: 200 });
    const mediaList = useQuery(
        api.media.listByPerson,
        mediaOwnerPersonId ? { personId: mediaOwnerPersonId as Id<"people"> } : "skip"
    ) as Array<Doc<"media"> & { storageUrl?: string | null }> | undefined;
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    const claimOptions = useMemo(() => {
        if (!claims) return [];

        return claims.map((claim) => {
            const customFields = claim.value.customFields as { title?: string } | undefined;
            const rawTitle = claim.claimType === 'custom'
                ? customFields?.title || 'Custom event'
                : claim.claimType.replace('_', ' ');
            const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const dateLabel = formatClaimDate(claim.value);
            const dateSuffix = dateLabel ? ` - ${dateLabel}` : '';
            return {
                id: claim._id,
                label: `${title}${dateSuffix}`,
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
            if (mediaOwnerPersonId) {
                await updateMediaLinks({
                    treeId,
                    entityType: "source",
                    entityId: sourceId,
                    mediaIds: selectedMediaIds
                });
            }
            showSuccess('Source created successfully');
            if (onSuccess) onSuccess(sourceId);
            onClose();
        } catch (error) {
            handleErrorWithToast(error, { operation: 'create source' });
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

                        <div className="input-group">
                            <label className="input-label">Media</label>
                            <p className="text-xs text-muted">Optional. Attach media to this source.</p>
                            {!personId && (
                                <select
                                    className="input"
                                    value={mediaOwnerPersonId}
                                    onChange={(event) => {
                                        setMediaOwnerPersonId(event.target.value as Id<"people"> | '');
                                        setSelectedMediaIds([]);
                                    }}
                                >
                                    <option value="">Select a person to own media...</option>
                                    {(people ?? []).map((person: Doc<"people">) => (
                                        <option key={person._id} value={person._id}>
                                            {person.givenNames} {person.surnames}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {mediaOwnerPersonId && (
                                <div className="border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {(mediaList ?? []).map((item) => (
                                        <label key={item._id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedMediaIds.includes(item._id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedMediaIds((prev) => [...prev, item._id]);
                                                    } else {
                                                        setSelectedMediaIds((prev) => prev.filter((id) => id !== item._id));
                                                    }
                                                }}
                                            />
                                            <span>{item.title}</span>
                                        </label>
                                    ))}
                                    {(mediaList?.length ?? 0) === 0 && (
                                        <p className="text-xs text-muted">No media added yet.</p>
                                    )}
                                </div>
                            )}
                            {mediaOwnerPersonId && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowMediaUpload(true)}
                                >
                                    Add new media
                                </button>
                            )}
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
            {showMediaUpload && mediaOwnerPersonId && (
                <MediaUploadModal
                    treeId={treeId}
                    ownerPersonId={mediaOwnerPersonId as Id<"people">}
                    onClose={() => setShowMediaUpload(false)}
                    onSuccess={(mediaId) => {
                        setSelectedMediaIds((prev) => [...prev, mediaId]);
                        setShowMediaUpload(false);
                    }}
                />
            )}
        </>
    );
}
