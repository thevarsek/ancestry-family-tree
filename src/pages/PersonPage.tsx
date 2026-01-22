import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { AddRelationshipModal } from '../components/people/AddRelationshipModal';
import { PersonModal } from '../components/people/PersonList';
import { RelationshipCard } from '../components/people/RelationshipCard';
import { AddClaimModal } from '../components/claims/AddClaimModal';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { defaultLeafletIcon } from '../components/places/leafletIcon';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PersonSourceList } from '../components/sources/PersonSourceList';
import { MediaList } from '../components/media/MediaList';
import { formatClaimDate } from '../utils/claimDates';

type PersonClaim = Doc<"claims"> & {
    place?: Doc<"places"> | null;
    sources?: Doc<"sources">[];
};

export function PersonPage() {
    const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'places' | 'sources' | 'media'>('overview');
    const [showAddRel, setShowAddRel] = useState(false);
    const [showAddClaim, setShowAddClaim] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editingClaim, setEditingClaim] = useState<PersonClaim | null>(null);
    const [pendingClaimDelete, setPendingClaimDelete] = useState<Id<"claims"> | null>(null);
    const [isDeletingClaim, setIsDeletingClaim] = useState(false);
    const [claimDeleteError, setClaimDeleteError] = useState<string | null>(null);
    const [pendingPersonDelete, setPendingPersonDelete] = useState(false);
    const [isDeletingPerson, setIsDeletingPerson] = useState(false);
    const [pendingRelationshipDelete, setPendingRelationshipDelete] = useState<Id<"relationships"> | null>(null);
    const [isDeletingRelationship, setIsDeletingRelationship] = useState(false);
    const [relationshipDeleteError, setRelationshipDeleteError] = useState<string | null>(null);
    const [defaultClaimType, setDefaultClaimType] = useState<
        'birth' | 'death' | 'marriage' | 'divorce' | 'residence' | 'occupation' | 'education' | 'custom'
    >('birth');

    const deletePerson = useMutation(api.people.remove);
    const removeRelationship = useMutation(api.relationships.remove);
    const removeClaim = useMutation(api.claims.remove);

    const person = useQuery(api.people.getWithClaims,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    const relationships = useQuery(api.people.getRelationships,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    const profilePhoto = useQuery(api.media.get,
        person?.profilePhotoId ? { mediaId: person.profilePhotoId } : "skip"
    );

    const residenceClaims = useMemo(() => {
        if (!person) return [];
        return (person.claims as PersonClaim[]).filter(
            (claim) => claim.claimType === 'residence' && Boolean(claim.place)
        );
    }, [person]);

    const placeClaims = useMemo(() => {
        if (!person) return [];
        return (person.claims as PersonClaim[]).filter((claim) => Boolean(claim.place));
    }, [person]);

    const placeGroups = useMemo(() => {
        const grouped = new Map<string, { place: PersonClaim['place']; claims: PersonClaim[] }>();
        placeClaims.forEach((claim) => {
            const placeId = claim.place?._id;
            if (!placeId) return;
            const entry = grouped.get(placeId) ?? { place: claim.place, claims: [] };
            entry.claims.push(claim);
            grouped.set(placeId, entry);
        });
        return Array.from(grouped.values()).sort((a, b) =>
            (a.place?.displayName ?? '').localeCompare(b.place?.displayName ?? '')
        );
    }, [placeClaims]);

    const mapPlaces = useMemo(
        () => placeGroups
            .map((group) => group.place)
            .filter((place): place is Doc<"places"> => Boolean(place?.latitude && place?.longitude)),
        [placeGroups]
    );

    const mapCenter = useMemo(() => {
        if (mapPlaces.length === 0) return [20, 0] as [number, number];
        const sum = mapPlaces.reduce(
            (acc, place) => {
                acc.lat += place.latitude ?? 0;
                acc.lng += place.longitude ?? 0;
                return acc;
            },
            { lat: 0, lng: 0 }
        );
        return [sum.lat / mapPlaces.length, sum.lng / mapPlaces.length] as [number, number];
    }, [mapPlaces]);

    if (!person || !relationships) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    const handleDelete = () => {
        if (!personId || !treeId || pendingPersonDelete) {
            return;
        }
        setPendingPersonDelete(true);
    };

    const handleClosePersonDelete = () => {
        setPendingPersonDelete(false);
    };

    const handleConfirmDeletePerson = async () => {
        if (!personId || !treeId) {
            setPendingPersonDelete(false);
            return;
        }
        setIsDeletingPerson(true);
        try {
            await deletePerson({ personId: personId as Id<"people"> });
            navigate(`/tree/${treeId}`);
        } finally {
            setIsDeletingPerson(false);
            setPendingPersonDelete(false);
        }
    };

    const handleDeleteRelationship = (relId: Id<"relationships">) => {
        if (pendingRelationshipDelete) return;
        setRelationshipDeleteError(null);
        setPendingRelationshipDelete(relId);
    };

    const handleCloseRelationshipDelete = () => {
        setPendingRelationshipDelete(null);
        setRelationshipDeleteError(null);
    };

    const handleConfirmDeleteRelationship = async () => {
        if (!pendingRelationshipDelete) return;
        setIsDeletingRelationship(true);
        let didRemove = false;
        try {
            await removeRelationship({ relationshipId: pendingRelationshipDelete });
            didRemove = true;
        } catch (error) {
            console.error("Failed to remove relationship:", error);
            setRelationshipDeleteError('Unable to remove this relationship. Please try again.');
        } finally {
            setIsDeletingRelationship(false);
            if (didRemove) {
                setPendingRelationshipDelete(null);
            }
        }
    };

    return (
        <div className="container py-8">
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to={`/tree/${treeId}`} className="hover:text-accent">People</Link>
                    <span>/</span>
                    <span>{person.givenNames} {person.surnames}</span>
                </div>

                <div className="flex gap-6 items-start">
                    <div className="avatar avatar-xl text-3xl overflow-hidden">
                        {profilePhoto?.storageUrl ? (
                            <img
                                src={profilePhoto.storageUrl}
                                alt={`${person.givenNames ?? ''} ${person.surnames ?? ''}`}
                                className="w-full h-full object-cover"
                                data-zoom={profilePhoto.zoomLevel ? 'true' : undefined}
                                style={
                                    profilePhoto.zoomLevel && profilePhoto.focusX !== undefined && profilePhoto.focusY !== undefined
                                        ? {
                                            objectPosition: `${profilePhoto.focusX * 100}% ${profilePhoto.focusY * 100}%`,
                                            transform: `scale(${profilePhoto.zoomLevel})`,
                                        }
                                        : undefined
                                }
                            />
                        ) : (
                            <span>{(person.givenNames?.[0] || '') + (person.surnames?.[0] || '')}</span>
                        )}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold mb-1">
                            {person.givenNames} {person.surnames}
                        </h1>
                        <div className="text-muted flex gap-4 text-sm">
                            <span>{person.gender}</span>
                            <span>•</span>
                            <span>{person.isLiving ? 'Living' : 'Deceased'}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowEditProfile(true)}>Edit Profile</button>
                        <button className="btn btn-ghost text-error" onClick={handleDelete}>
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            <div className="tabs mb-6">
                <button
                    className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab ${activeTab === 'relationships' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('relationships')}
                >
                    Relationships
                </button>
                <button
                    className={`tab ${activeTab === 'places' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('places')}
                >
                    Places
                </button>
                <button
                    className={`tab ${activeTab === 'sources' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('sources')}
                >
                    Sources
                </button>
                <button
                    className={`tab ${activeTab === 'media' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('media')}
                >
                    Media
                </button>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <section className="card">
                                <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                                    <h3 className="card-title text-base">Life Events</h3>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            setDefaultClaimType('birth');
                                            setEditingClaim(null);
                                            setShowAddClaim(true);
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                {person.claims.length === 0 ? (
                                    <div className="text-center py-8 text-muted">
                                        No events or claims recorded yet.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {person.claims.map((claim: PersonClaim) => (
                                            <div key={claim._id} className="flex gap-4">
                                                <div className="w-24 text-sm text-muted text-right pt-1">
                                                    {formatClaimDate(claim.value) || 'Unknown Date'}
                                                </div>
                                                <div className="flex-1 pb-4 border-l border-border-subtle pl-4 relative">
                                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border" />
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h4 className="font-medium capitalize">
                                                                {claim.claimType === 'custom'
                                                                    ? (claim.value.customFields as { title?: string } | undefined)?.title || 'Custom event'
                                                                    : claim.claimType.replace('_', ' ')}
                                                            </h4>
                                                            <p className="text-sm text-muted">
                                                                {claim.place?.displayName || claim.value.description || 'No details yet'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => {
                                                                    setEditingClaim(claim);
                                                                    setShowAddClaim(true);
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="btn btn-ghost btn-sm text-error"
                                                                onClick={() => {
                                                                    setClaimDeleteError(null);
                                                                    setPendingClaimDelete(claim._id);
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="space-y-6">
                            <section className="card p-4">
                                <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                                    <h3 className="card-title text-base">Immediate Family</h3>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setActiveTab('relationships'); setShowAddRel(true); }}>
                                        +
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {relationships.parents.concat(relationships.spouses).concat(relationships.children).length === 0 ? (
                                        <p className="text-center py-4 text-muted text-sm">None recorded</p>
                                    ) : (
                                        <>
                                            {relationships.parents.map((r) => (
                                                <RelationshipCard key={r.relationship._id} relationship={r.relationship} person={r.person} />
                                            ))}
                                            {relationships.spouses.map((r) => (
                                                <RelationshipCard key={r.relationship._id} relationship={r.relationship} person={r.person} />
                                            ))}
                                            {relationships.children.map((r) => (
                                                <RelationshipCard key={r.relationship._id} relationship={r.relationship} person={r.person} />
                                            ))}
                                        </>
                                    )}
                                </div>
                            </section>

                            <section className="card">
                                <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                                    <h3 className="card-title text-base">Places Lived</h3>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            setDefaultClaimType('residence');
                                            setEditingClaim(null);
                                            setShowAddClaim(true);
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                {residenceClaims.length === 0 ? (
                                    <div className="text-center py-6 text-muted">
                                        No residence places recorded yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {residenceClaims.map((claim) => (
                                            <div key={claim._id} className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="font-medium">
                                                        {claim.place?.displayName}
                                                    </div>
                                                    <div className="text-xs text-muted">
                                                        {formatClaimDate(claim.value) || 'Unknown date'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            setEditingClaim(claim);
                                                            setShowAddClaim(true);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm text-error"
                                                        onClick={() => {
                                                            setClaimDeleteError(null);
                                                            setPendingClaimDelete(claim._id);
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'relationships' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Family Connections</h3>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowAddRel(true)}
                            >
                                + Add Relationship
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span>Relationship status:</span>
                            <span className="badge badge-relationship badge-relationship-current">Current</span>
                            <span className="badge badge-relationship badge-relationship-ended">Ended</span>
                            <span>Shown for spouse/partner links.</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {['Parents', 'Spouses', 'Siblings', 'Children'].map((category) => {
                                const list = category === 'Parents' ? relationships.parents
                                    : category === 'Spouses' ? relationships.spouses
                                        : category === 'Siblings' ? relationships.siblings
                                            : relationships.children;
                                const roleLabel = category === 'Parents'
                                    ? 'Parent'
                                    : category === 'Children'
                                        ? 'Child'
                                        : undefined;

                                return (
                                    <div key={category} className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted uppercase tracking-wider">{category}</h4>
                                        {list.length === 0 ? (
                                            <p className="text-sm text-muted italic">None recorded</p>
                                        ) : (
                                                list.map((r: { relationship: Doc<"relationships">; person?: Doc<"people"> | null }) => (
                                                    <RelationshipCard
                                                        key={r.relationship._id}
                                                        relationship={r.relationship}
                                                        person={r.person}
                                                        onDelete={handleDeleteRelationship}
                                                        roleLabel={roleLabel}
                                                    />
                                                ))
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'places' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Places & Events</h3>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setDefaultClaimType('residence');
                                    setEditingClaim(null);
                                    setShowAddClaim(true);
                                }}
                            >
                                + Add Place/Event
                            </button>
                        </div>

                        {placeGroups.length === 0 ? (
                            <div className="card p-6 text-center text-muted">
                                No places recorded yet. Add a life event with a place to populate this view.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                <div className="card p-0 overflow-hidden lg:col-span-2">
                                    <div className="p-4 border-b border-border-subtle">
                                        <h4 className="font-semibold">Map View</h4>
                                        <p className="text-xs text-muted">Pins show places with coordinates.</p>
                                    </div>
                                    <div style={{ height: '420px' }}>
                                        <MapContainer center={mapCenter} zoom={mapPlaces.length ? 4 : 2} style={{ height: '100%', width: '100%' }}>
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution="&copy; OpenStreetMap contributors"
                                            />
                                            {mapPlaces.map((place) => (
                                                <Marker
                                                    key={place._id}
                                                    position={[place.latitude as number, place.longitude as number]}
                                                    icon={defaultLeafletIcon}
                                                >
                                                    <Popup>
                                                        <div className="space-y-1">
                                                            <div className="font-semibold">{place.displayName}</div>
                                                            <div className="text-xs text-muted">
                                                                {[place.city, place.state, place.country].filter(Boolean).join(', ') || 'No address details'}
                                                            </div>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            ))}
                                        </MapContainer>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {placeGroups.map((group) => (
                                        <div key={group.place?._id} className="card p-4 space-y-3">
                                            <div>
                                                <h4 className="font-semibold">{group.place?.displayName}</h4>
                                                <p className="text-sm text-muted">
                                                    {[group.place?.city, group.place?.state, group.place?.country]
                                                        .filter(Boolean)
                                                        .join(', ') || 'No address details'}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                {group.claims.map((claim) => (
                                                    <div key={claim._id} className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-medium capitalize">
                                                                {claim.claimType === 'custom'
                                                                    ? (claim.value.customFields as { title?: string } | undefined)?.title || 'Custom event'
                                                                    : claim.claimType.replace('_', ' ')}
                                                            </div>
                                                            <div className="text-xs text-muted">
                                                                {formatClaimDate(claim.value) || 'Unknown date'}
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => {
                                                                setEditingClaim(claim);
                                                                setShowAddClaim(true);
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'sources' && (
                    <PersonSourceList
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                        claims={person.claims as PersonClaim[]}
                    />
                )}

                {activeTab === 'media' && (
                    <MediaList
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                        claims={person.claims as PersonClaim[]}
                    />
                )}

                {showAddRel && (
                    <AddRelationshipModal
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                        personName={`${person.givenNames} ${person.surnames}`}
                        onClose={() => setShowAddRel(false)}
                    />
                )}

                {showEditProfile && (
                    <PersonModal
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                        initialData={person}
                        onClose={() => setShowEditProfile(false)}
                    />
                )}

                {showAddClaim && (
                    <AddClaimModal
                        treeId={treeId as Id<"trees">}
                        subjectId={personId as string}
                        subjectType="person"
                        defaultClaimType={defaultClaimType}
                        initialClaim={editingClaim}
                        onClose={() => {
                            setShowAddClaim(false);
                            setEditingClaim(null);
                        }}
                    />
                )}
            </div>
            {pendingRelationshipDelete && (
                <ConfirmModal
                    title="Remove Relationship"
                    description="This will remove the relationship from the tree. This action cannot be undone."
                    confirmLabel="Remove Relationship"
                    busyLabel="Removing..."
                    isBusy={isDeletingRelationship}
                    errorMessage={relationshipDeleteError}
                    onClose={handleCloseRelationshipDelete}
                    onConfirm={handleConfirmDeleteRelationship}
                />
            )}
            {pendingPersonDelete && (
                <ConfirmModal
                    title="Delete Person"
                    description={`Deleting ${person.givenNames} ${person.surnames} will also remove their relationships and claims. This action cannot be undone.`}
                    confirmLabel="Delete Person"
                    busyLabel="Deleting..."
                    isBusy={isDeletingPerson}
                    onClose={handleClosePersonDelete}
                    onConfirm={handleConfirmDeletePerson}
                />
            )}
            {pendingClaimDelete && (
                <ConfirmModal
                    title="Delete Event"
                    description="This will permanently remove this life event from the record. This action cannot be undone."
                    confirmLabel="Delete Event"
                    busyLabel="Deleting..."
                    isBusy={isDeletingClaim}
                    errorMessage={claimDeleteError}
                    onClose={() => {
                        setPendingClaimDelete(null);
                        setClaimDeleteError(null);
                    }}
                    onConfirm={async () => {
                        if (!pendingClaimDelete) return;
                        setIsDeletingClaim(true);
                        try {
                            await removeClaim({ claimId: pendingClaimDelete });
                            setPendingClaimDelete(null);
                        } catch (error) {
                            console.error('Failed to delete claim:', error);
                            setClaimDeleteError('Unable to delete this event. Please try again.');
                        } finally {
                            setIsDeletingClaim(false);
                        }
                    }}
                />
            )}
        </div>
    );
}
