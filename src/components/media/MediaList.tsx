import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { MediaCard } from './MediaCard';
import { MediaModal } from './MediaModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { handleError } from '../../utils/errorHandling';

type MediaWithRelations = Doc<"media"> & {
    storageUrl?: string | null;
    taggedPersonIds?: Id<"people">[];
    links?: Array<{ entityType: string; entityId: string }>;
};

export function MediaList({
    treeId,
    personId,
}: {
    treeId: Id<"trees">;
    personId: Id<"people">;
}) {
    const media = useQuery(api.media.listByPerson, { personId }) as MediaWithRelations[] | undefined;
    const people = useQuery(api.people.list, { treeId, limit: 200 }) as Doc<"people">[] | undefined;
    const removeMedia = useMutation(api.media.remove);
    const [showAddMedia, setShowAddMedia] = useState(false);
    const [editingMedia, setEditingMedia] = useState<MediaWithRelations | null>(null);
    const [pendingDelete, setPendingDelete] = useState<MediaWithRelations | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const peopleMap = useMemo(() => {
        return new Map((people ?? []).map((person) => [person._id, person]));
    }, [people]);

    if (media === undefined || people === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-8" />;
    }

    const handleRequestDelete = (item: MediaWithRelations) => {
        setDeleteError(null);
        setPendingDelete(item);
    };

    const handleCloseDelete = () => {
        setPendingDelete(null);
        setDeleteError(null);
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await removeMedia({ mediaId: pendingDelete._id });
            setPendingDelete(null);
        } catch (error) {
            handleError(error, { operation: 'remove media' });
            setDeleteError('Unable to remove this media right now. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Media</h2>
                    <p className="text-muted text-sm">{media.length} items attached</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddMedia(true)}>
                    + Add Media
                </button>
            </div>

            {media.length === 0 ? (
                <div className="card p-6 text-center text-muted">
                    No media added yet. Upload photos, documents, or recordings to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {media.map((item: MediaWithRelations) => (
                        <div key={item._id} className="space-y-2">
                            <MediaCard
                                media={item}
                                onEdit={() => setEditingMedia(item)}
                                onDelete={() => handleRequestDelete(item)}
                            />
                            {(item.taggedPersonIds?.length ?? 0) > 0 && (
                                <div className="text-xs text-muted">
                                    Tagged: {item.taggedPersonIds
                                        ?.map((id: Id<"people">) => {
                                            const person = peopleMap.get(id);
                                            if (!person) return 'Unknown';
                                            return `${person.givenNames ?? ''} ${person.surnames ?? ''}`.trim();
                                        })
                                        .join(', ')}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showAddMedia && (
                <MediaModal
                    treeId={treeId}
                    ownerPersonId={personId}
                    onClose={() => setShowAddMedia(false)}
                    onSuccess={() => setShowAddMedia(false)}
                />
            )}
            {pendingDelete && (
                <ConfirmModal
                    title="Remove Media"
                    description={`Removing "${pendingDelete.title}" will delete it from this tree and any linked events or sources. This action cannot be undone.`}
                    confirmLabel="Remove Media"
                    busyLabel="Removing..."
                    isBusy={isDeleting}
                    errorMessage={deleteError}
                    onClose={handleCloseDelete}
                    onConfirm={handleConfirmDelete}
                />
            )}
            {editingMedia && (
                <MediaModal
                    treeId={treeId}
                    ownerPersonId={personId}
                    initialMedia={editingMedia}
                    onClose={() => setEditingMedia(null)}
                    onSuccess={() => setEditingMedia(null)}
                />
            )}
        </div>
    );
}
