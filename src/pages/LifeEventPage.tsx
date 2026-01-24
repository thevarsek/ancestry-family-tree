import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { LifeEventModal } from '../components/claims/LifeEventModal';
import { MediaCard } from '../components/media/MediaCard';
import { SourceModal } from '../components/sources/SourceModal';
import { LinkSourceModal } from '../components/sources/LinkSourceModal';
import { MediaUploadModal } from '../components/media/MediaUploadModal';
import { LinkMediaModal } from '../components/media/LinkMediaModal';
import { defaultLeafletIcon } from '../components/places/leafletIcon';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { formatClaimDate } from '../utils/claimDates';
import { getClaimTitle, sortClaimsForTimeline } from '../utils/claimSorting';
import { useErrorHandler } from '../hooks/useErrorHandler';

type ClaimWithDetails = Doc<"claims"> & {
    place?: Doc<"places"> | null;
    sources?: Doc<"sources">[];
    relatedPeople?: Doc<"people">[];
};

type MediaWithUrl = Doc<"media"> & { storageUrl?: string | null };

export function LifeEventPage() {
    const { treeId, personId, claimId } = useParams<{
        treeId: string;
        personId: string;
        claimId: string;
    }>();
    const navigate = useNavigate();
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Modal state
    const [showEdit, setShowEdit] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showLinkSourceModal, setShowLinkSourceModal] = useState(false);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const [showLinkMediaModal, setShowLinkMediaModal] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Mutations
    const removeClaim = useMutation(api.claims.remove);
    const addSourceToClaim = useMutation(api.claims.links.addSource);
    const removeSourceFromClaim = useMutation(api.claims.links.removeSource);
    const linkMedia = useMutation(api.media.linkToEntity);
    const unlinkMedia = useMutation(api.media.unlinkFromEntity);

    // Queries
    const person = useQuery(
        api.people.getWithClaims,
        personId ? { personId: personId as Id<"people"> } : 'skip'
    );

    const claim = useQuery(
        api.claims.get,
        claimId ? { claimId: claimId as Id<"claims"> } : 'skip'
    ) as ClaimWithDetails | null | undefined;

    const media = useQuery(
        api.media.listByEntity,
        treeId && claimId
            ? {
                treeId: treeId as Id<"trees">,
                entityType: 'claim',
                entityId: claimId,
            }
            : 'skip'
    ) as MediaWithUrl[] | undefined;

    const timelineClaims = useMemo(() => {
        if (!person) return [];
        return sortClaimsForTimeline(person.claims as ClaimWithDetails[]);
    }, [person]);

    const fallbackClaim = useMemo(() => {
        if (!person) return null;
        return (person.claims as ClaimWithDetails[]).find((item) => item._id === claimId) ?? null;
    }, [person, claimId]);

    const resolvedClaim = claim ?? fallbackClaim;

    const timelineIndex = useMemo(() => {
        return timelineClaims.findIndex((item) => item._id === claimId);
    }, [timelineClaims, claimId]);

    const previousClaim = timelineIndex > 0 ? timelineClaims[timelineIndex - 1] : null;
    const nextClaim =
        timelineIndex >= 0 && timelineIndex < timelineClaims.length - 1
            ? timelineClaims[timelineIndex + 1]
            : null;

    const place = resolvedClaim?.place;
    const mapCenter = useMemo<[number, number]>(() => {
        if (!place?.latitude || !place?.longitude) return [20, 0];
        return [place.latitude, place.longitude];
    }, [place]);

    // Handlers for linking/unlinking
    const handleLinkSource = async (sourceId: Id<"sources">) => {
        if (!claimId) return;
        try {
            await addSourceToClaim({
                claimId: claimId as Id<"claims">,
                sourceId,
            });
            showSuccess('Source linked');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'link source' });
        }
    };

    const handleUnlinkSource = async (sourceId: string) => {
        if (!claimId) return;
        try {
            await removeSourceFromClaim({
                claimId: claimId as Id<"claims">,
                sourceId: sourceId as Id<"sources">,
            });
            showSuccess('Source unlinked');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'unlink source' });
        }
    };

    const handleLinkMedia = async (mediaId: Id<"media">) => {
        if (!claimId) return;
        try {
            await linkMedia({
                mediaId,
                entityType: 'claim',
                entityId: claimId,
            });
            showSuccess('Media linked');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'link media' });
        }
    };

    const handleUnlinkMedia = async (mediaId: string) => {
        if (!claimId) return;
        try {
            await unlinkMedia({
                mediaId: mediaId as Id<"media">,
                entityType: 'claim',
                entityId: claimId,
            });
            showSuccess('Media unlinked');
        } catch (err) {
            handleErrorWithToast(err, { operation: 'unlink media' });
        }
    };

    if (person === undefined || claim === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    if (!person || !resolvedClaim || !treeId || !personId || !claimId) {
        return (
            <div className="container py-12 text-center">
                <h2 className="text-xl font-bold mb-2">Life Event Not Found</h2>
                <p className="text-muted mb-4">We couldn&apos;t find this event in the tree.</p>
                <Link to={`/tree/${treeId ?? ''}`} className="btn btn-primary">
                    Return to Tree
                </Link>
            </div>
        );
    }

    const eventTitle = getClaimTitle(resolvedClaim);
    const eventDate = formatClaimDate(resolvedClaim.value) || 'Unknown date';
    const sources = resolvedClaim.sources ?? [];

    return (
        <div className="container py-8 space-y-8">
            <div>
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to={`/tree/${treeId}`} className="hover:text-accent">People</Link>
                    <span>/</span>
                    <Link to={`/tree/${treeId}/person/${personId}`} className="hover:text-accent">
                        {person.givenNames} {person.surnames}
                    </Link>
                    <span>/</span>
                    <span>{eventTitle}</span>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold capitalize">{eventTitle}</h1>
                        <p className="text-muted text-sm">{eventDate}</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
                            Edit Event
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
                    <section className="card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Event Details</h2>
                            <span className="badge badge-neutral capitalize">{resolvedClaim.claimType.replace('_', ' ')}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-muted">Date</div>
                                <div className="font-medium">{eventDate}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-muted">Place</div>
                                <div className="font-medium">
                                    {place?.displayName ?? 'No place recorded'}
                                </div>
                            </div>
                            {(resolvedClaim.claimType === 'marriage' || resolvedClaim.claimType === 'divorce') && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-muted">
                                        {resolvedClaim.claimType === 'marriage' ? 'Partner' : 'Other People'}
                                    </div>
                                    <div className="font-medium">
                                        {resolvedClaim.relatedPeople && resolvedClaim.relatedPeople.length > 0 ? (
                                            resolvedClaim.relatedPeople.map((person, index) => (
                                                <span key={person._id}>
                                                    <Link
                                                        to={`/tree/${treeId}/person/${person._id}`}
                                                        className="hover:text-accent"
                                                    >
                                                        {person.givenNames} {person.surnames}
                                                    </Link>
                                                    {index < resolvedClaim.relatedPeople!.length - 1 && ', '}
                                                </span>
                                            ))
                                        ) : (
                                            'No partner recorded'
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-muted">Description</div>
                            <p className="text-sm text-muted">
                                {resolvedClaim.value.description || 'No details yet.'}
                            </p>
                        </div>
                    </section>

                    <section className="card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Sources</h2>
                                <span className="text-xs text-muted">{sources.length} linked</span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowLinkSourceModal(true)}
                            >
                                + Link Source
                            </button>
                        </div>
                        {sources.length === 0 ? (
                            <p className="text-sm text-muted">No sources linked yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {sources.map((source) => (
                                    <div key={source._id} className="flex gap-4 group">
                                        <div className="flex-1 pb-4 border-l border-border-subtle pl-4 relative">
                                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border" />
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <Link
                                                        to={`/tree/${treeId}/person/${personId}/source/${source._id}`}
                                                        className="font-medium hover:text-accent"
                                                    >
                                                        {source.title}
                                                    </Link>
                                                    {source.author && (
                                                        <p className="text-sm text-muted">by {source.author}</p>
                                                    )}
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleUnlinkSource(source._id)}
                                                    title="Unlink source"
                                                >
                                                    Unlink
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Media</h2>
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
                            <p className="text-sm text-muted">No media linked to this event yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-6">
                    <section className="card p-4 space-y-3">
                        <div>
                            <h2 className="text-base font-semibold">Location</h2>
                            <p className="text-xs text-muted">Map shows the event location when available.</p>
                        </div>
                        {place?.latitude && place?.longitude ? (
                            <div style={{ height: '240px' }} className="rounded-md overflow-hidden">
                                <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution="&copy; OpenStreetMap contributors"
                                    />
                                    <Marker
                                        position={[place.latitude, place.longitude]}
                                        icon={defaultLeafletIcon}
                                    >
                                        <Popup>
                                            <div className="space-y-1">
                                                <div className="font-semibold">{place.displayName}</div>
                                                <div className="text-xs text-muted">
                                                    {[place.city, place.state, place.country]
                                                        .filter(Boolean)
                                                        .join(', ') || 'No address details'}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </MapContainer>
                            </div>
                        ) : (
                            <div className="text-sm text-muted">No map coordinates available.</div>
                        )}
                    </section>

                    <section className="card p-4 space-y-3">
                        <div>
                            <h2 className="text-base font-semibold">Timeline Context</h2>
                            <p className="text-xs text-muted">Previous and next events for this person.</p>
                        </div>
                        <div className="space-y-3">
                            {previousClaim ? (
                                <Link
                                    to={`/tree/${treeId}/person/${personId}/event/${previousClaim._id}`}
                                    className="block rounded-md border border-border-subtle p-3 hover:border-accent"
                                >
                                    <div className="text-xs text-muted">Previous</div>
                                    <div className="font-semibold capitalize">{getClaimTitle(previousClaim)}</div>
                                    <div className="text-xs text-muted">{formatClaimDate(previousClaim.value) || 'Unknown date'}</div>
                                </Link>
                            ) : (
                                <div className="text-sm text-muted">No earlier events recorded.</div>
                            )}
                            {nextClaim ? (
                                <Link
                                    to={`/tree/${treeId}/person/${personId}/event/${nextClaim._id}`}
                                    className="block rounded-md border border-border-subtle p-3 hover:border-accent"
                                >
                                    <div className="text-xs text-muted">Next</div>
                                    <div className="font-semibold capitalize">{getClaimTitle(nextClaim)}</div>
                                    <div className="text-xs text-muted">{formatClaimDate(nextClaim.value) || 'Unknown date'}</div>
                                </Link>
                            ) : (
                                <div className="text-sm text-muted">No later events recorded.</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {showEdit && (
                <LifeEventModal
                    treeId={treeId as Id<"trees">}
                    subjectId={personId}
                    subjectType="person"
                    initialClaim={resolvedClaim}
                    onClose={() => setShowEdit(false)}
                />
            )}

            {showSourceModal && (
                <SourceModal
                    treeId={treeId as Id<"trees">}
                    initialClaimIds={[claimId as Id<"claims">]}
                    onClose={() => setShowSourceModal(false)}
                    onSuccess={() => setShowSourceModal(false)}
                />
            )}

            {showLinkSourceModal && treeId && (
                <LinkSourceModal
                    treeId={treeId as Id<"trees">}
                    excludeSourceIds={(resolvedClaim?.sources ?? []).map(s => s._id)}
                    onClose={() => setShowLinkSourceModal(false)}
                    onSelect={handleLinkSource}
                    onCreateNew={() => {
                        setShowLinkSourceModal(false);
                        setShowSourceModal(true);
                    }}
                />
            )}

            {showMediaUpload && (
                <MediaUploadModal
                    treeId={treeId as Id<"trees">}
                    ownerPersonId={personId as Id<"people">}
                    defaultLinks={[{ entityType: 'claim', entityId: claimId }]}
                    onClose={() => setShowMediaUpload(false)}
                    onSuccess={() => setShowMediaUpload(false)}
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

            {pendingDelete && (
                <ConfirmModal
                    title="Delete Event"
                    description="This will permanently remove this life event from the record. This action cannot be undone."
                    confirmLabel="Delete Event"
                    busyLabel="Deleting..."
                    isBusy={isDeleting}
                    errorMessage={deleteError}
                    onClose={() => setPendingDelete(false)}
                    onConfirm={async () => {
                        setIsDeleting(true);
                        try {
                            await removeClaim({ claimId: claimId as Id<"claims"> });
                            navigate(`/tree/${treeId}/person/${personId}`);
                        } catch (error) {
                            handleErrorWithToast(error, { operation: 'delete claim' });
                            setDeleteError('Unable to delete this event. Please try again.');
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
