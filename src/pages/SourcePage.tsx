import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { SourceModal } from '../components/sources/SourceModal';
import { MediaCard } from '../components/media/MediaCard';
import { MediaUploadModal } from '../components/media/MediaUploadModal';
import { LinkMediaModal } from '../components/media/LinkMediaModal';
import { LinkEventModal } from '../components/claims/LinkEventModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { formatClaimDate } from '../utils/claimDates';
import { getClaimTitle } from '../utils/claimSorting';
import { useErrorHandler } from '../hooks/useErrorHandler';

type SourceClaim = Doc<"claims"> & {
    place?: Doc<"places"> | null;
    person?: Doc<"people"> | null;
};

type SourceWithClaims = Doc<"sources"> & {
    claims: SourceClaim[];
};

type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

export function SourcePage() {
    const { treeId, sourceId, personId } = useParams<{
        treeId: string;
        sourceId: string;
        personId?: string;
    }>();
    const navigate = useNavigate();
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Modal state
    const [showEdit, setShowEdit] = useState(false);
    const [showLinkEventModal, setShowLinkEventModal] = useState(false);
    const [showLinkMediaModal, setShowLinkMediaModal] = useState(false);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Mutations
    const addSourceToClaim = useMutation(api.claims.links.addSource);
    const removeSourceFromClaim = useMutation(api.claims.links.removeSource);
    const linkMediaToSource = useMutation(api.media.linkToEntity);
    const unlinkMediaFromSource = useMutation(api.media.unlinkFromEntity);
    const removeSource = useMutation(api.sources.remove);

    const source = useQuery(
        api.sources.getWithClaims,
        sourceId ? { sourceId: sourceId as Id<"sources"> } : 'skip'
    ) as SourceWithClaims | null | undefined;

    const person = useQuery(
        api.people.get,
        personId ? { personId: personId as Id<"people"> } : 'skip'
    );

    const media = useQuery(
        api.media.listByEntity,
        treeId && sourceId
            ? {
                treeId: treeId as Id<"trees">,
                entityType: 'source',
                entityId: sourceId,
            }
            : 'skip'
    ) as MediaWithUrl[] | undefined;

    const sortedClaims = useMemo(() => {
        return (source?.claims ?? []).slice().sort((a, b) => {
            const aDate = a.value.date ?? a.value.dateEnd ?? '';
            const bDate = b.value.date ?? b.value.dateEnd ?? '';
            return aDate.localeCompare(bDate);
        });
    }, [source]);

    // Handlers for linking/unlinking events
    const handleLinkEvent = async (claimId: Id<"claims">) => {
        if (!sourceId) return;
        try {
            await addSourceToClaim({
                claimId,
                sourceId: sourceId as Id<"sources">,
            });
            showSuccess('Event linked to source');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'link event' });
        }
    };

    const handleUnlinkEvent = async (claimId: string) => {
        if (!sourceId) return;
        try {
            await removeSourceFromClaim({
                claimId: claimId as Id<"claims">,
                sourceId: sourceId as Id<"sources">,
            });
            showSuccess('Event unlinked from source');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'unlink event' });
        }
    };

    // Handlers for linking/unlinking media
    const handleLinkMedia = async (mediaId: Id<"media">) => {
        if (!sourceId) return;
        try {
            await linkMediaToSource({
                mediaId,
                entityType: 'source',
                entityId: sourceId,
            });
            showSuccess('Media linked to source');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'link media' });
        }
    };

    const handleUnlinkMedia = async (mediaId: string) => {
        if (!sourceId) return;
        try {
            await unlinkMediaFromSource({
                mediaId: mediaId as Id<"media">,
                entityType: 'source',
                entityId: sourceId,
            });
            showSuccess('Media unlinked from source');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'unlink media' });
        }
    };

    if (source === undefined || (personId && person === undefined)) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    if (!source || !treeId || !sourceId) {
        return (
            <div className="container py-12 text-center">
                <h2 className="text-xl font-bold mb-2">Source Not Found</h2>
                <p className="text-muted mb-4">We couldn&apos;t find this source in the tree.</p>
                <Link to={`/tree/${treeId ?? ''}`} className="btn btn-primary">
                    Return to Tree
                </Link>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-8">
            <div>
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to={`/tree/${treeId}`} className="hover:text-accent">Trees</Link>
                    {personId && person && (
                        <>
                            <span>/</span>
                            <Link to={`/tree/${treeId}/person/${personId}`} className="hover:text-accent">
                                {person.givenNames} {person.surnames}
                            </Link>
                        </>
                    )}
                    <span>/</span>
                    <span>{source.title}</span>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{source.title}</h1>
                        <p className="text-sm text-muted">
                            {source.author ? `by ${source.author}` : 'Source details'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
                            Edit Source
                        </button>
                        <button
                            className="btn btn-ghost text-error"
                            onClick={() => {
                                setDeleteError(null);
                                setPendingDelete(true);
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <section className="card p-6 space-y-3">
                        <h2 className="text-lg font-semibold">Source Details</h2>
                        <div className="space-y-2 text-sm">
                            {source.url && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-muted">URL</div>
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline break-all"
                                    >
                                        {source.url}
                                    </a>
                                </div>
                            )}
                            {source.notes && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-muted">Notes</div>
                                    <p className="text-muted">{source.notes}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Linked Events</h2>
                                <span className="text-xs text-muted">{sortedClaims.length} linked</span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowLinkEventModal(true)}
                            >
                                + Link Event
                            </button>
                        </div>
                        {sortedClaims.length === 0 ? (
                            <p className="text-sm text-muted">No events linked to this source yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {sortedClaims.map((claim) => {
                                    const claimTitle = getClaimTitle(claim);
                                    const claimDate = formatClaimDate(claim.value) || 'Unknown date';
                                    const claimPerson = claim.person;
                                    const linkTarget = claimPerson
                                        ? `/tree/${treeId}/person/${claimPerson._id}/event/${claim._id}`
                                        : undefined;

                                    return (
                                        <div key={claim._id} className="flex gap-4 group">
                                            <div className="flex-1 pb-4 border-l border-border-subtle pl-4 relative">
                                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border" />
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        {linkTarget ? (
                                                            <Link
                                                                to={linkTarget}
                                                                className="font-medium hover:text-accent capitalize"
                                                            >
                                                                {claimTitle}
                                                            </Link>
                                                        ) : (
                                                            <span className="font-medium capitalize">{claimTitle}</span>
                                                        )}
                                                        <p className="text-sm text-muted">{claimDate}</p>
                                                        {claimPerson && (
                                                            <p className="text-sm text-muted">
                                                                {claimPerson.givenNames} {claimPerson.surnames}
                                                            </p>
                                                        )}
                                                        {claim.place?.displayName && (
                                                            <p className="text-sm text-muted">{claim.place.displayName}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleUnlinkEvent(claim._id)}
                                                        title="Unlink event"
                                                    >
                                                        Unlink
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                <div className="space-y-6">
                    <section className="card p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold">Media</h2>
                                <span className="text-xs text-muted">{(media ?? []).length} items</span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowLinkMediaModal(true)}
                            >
                                + Link Media
                            </button>
                        </div>
                        {(media ?? []).length === 0 ? (
                            <p className="text-sm text-muted">No media linked to this source yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {(media ?? []).map((item) => (
                                    <div key={item._id} className="relative group">
                                        <MediaCard media={item} />
                                        <button
                                            className="absolute top-2 right-2 btn btn-ghost btn-sm text-error bg-card/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleUnlinkMedia(item._id)}
                                            title="Unlink media"
                                        >
                                            Unlink
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {showEdit && source && treeId && (
                <SourceModal
                    treeId={treeId as Id<"trees">}
                    initialSource={source}
                    initialClaimIds={sortedClaims.map(c => c._id)}
                    initialMediaIds={(media ?? []).map(m => m._id)}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => setShowEdit(false)}
                />
            )}

            {showLinkEventModal && treeId && (
                <LinkEventModal
                    treeId={treeId as Id<"trees">}
                    excludeClaimIds={sortedClaims.map(c => c._id)}
                    onClose={() => setShowLinkEventModal(false)}
                    onSelect={handleLinkEvent}
                />
            )}

            {showLinkMediaModal && treeId && (
                <LinkMediaModal
                    treeId={treeId as Id<"trees">}
                    excludeMediaIds={(media ?? []).map(m => m._id)}
                    onClose={() => setShowLinkMediaModal(false)}
                    onSelect={handleLinkMedia}
                    onCreateNew={() => {
                        setShowLinkMediaModal(false);
                        setShowMediaUpload(true);
                    }}
                />
            )}

            {showMediaUpload && treeId && personId && (
                <MediaUploadModal
                    treeId={treeId as Id<"trees">}
                    ownerPersonId={personId as Id<"people">}
                    defaultLinks={[{ entityType: 'source', entityId: sourceId }]}
                    onClose={() => setShowMediaUpload(false)}
                    onSuccess={() => setShowMediaUpload(false)}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Source"
                    description="Deleting this source will remove any linked citations and media references. This action cannot be undone."
                    confirmLabel="Delete Source"
                    busyLabel="Deleting..."
                    isBusy={isDeleting}
                    errorMessage={deleteError}
                    onClose={() => setPendingDelete(false)}
                    onConfirm={async () => {
                        setIsDeleting(true);
                        try {
                            await removeSource({ sourceId: sourceId as Id<"sources"> });
                            if (personId) {
                                navigate(`/tree/${treeId}/person/${personId}`);
                            } else {
                                navigate(`/tree/${treeId}`);
                            }
                        } catch (error) {
                            handleErrorWithToast(error, { operation: 'delete source' });
                            setDeleteError('Unable to delete this source. Please try again.');
                        } finally {
                            setIsDeleting(false);
                            setPendingDelete(false);
                        }
                    }}
                />
            )}
        </div>
    );
}
