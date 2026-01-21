import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { MediaCard } from './MediaCard';
import { MediaUploadModal } from './MediaUploadModal';

type PersonClaim = Doc<"claims"> & { place?: Doc<"places"> | null };
type MediaWithRelations = Doc<"media"> & {
    storageUrl?: string | null;
    taggedPersonIds?: Id<"people">[];
    links?: Array<{ entityType: string; entityId: string }>;
};

export function MediaList({
    treeId,
    personId,
    claims
}: {
    treeId: Id<"trees">;
    personId: Id<"people">;
    claims: PersonClaim[];
}) {
    const media = useQuery(api.media.listByPerson, { personId }) as MediaWithRelations[] | undefined;
    const people = useQuery(api.people.list, { treeId, limit: 200 });
    const [showUpload, setShowUpload] = useState(false);

    const peopleMap = useMemo(() => {
        return new Map((people ?? []).map((person) => [person._id, person]));
    }, [people]);

    if (media === undefined || people === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-8" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Media</h2>
                    <p className="text-muted text-sm">{media.length} items attached</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>
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
                            <MediaCard media={item} />
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

            {showUpload && (
                <MediaUploadModal
                    treeId={treeId}
                    ownerPersonId={personId}
                    claims={claims}
                    onClose={() => setShowUpload(false)}
                    onSuccess={() => setShowUpload(false)}
                />
            )}
        </div>
    );
}
