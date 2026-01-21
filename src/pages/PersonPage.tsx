import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { AddRelationshipModal } from '../components/people/AddRelationshipModal';
import { PersonModal } from '../components/people/PersonList';
import { RelationshipCard } from '../components/people/RelationshipCard';
import { AddClaimModal } from '../components/claims/AddClaimModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

type PersonClaim = Doc<"claims"> & { place?: Doc<"places"> | null };

export function PersonPage() {
    const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'timeline'>('overview');
    const [showAddRel, setShowAddRel] = useState(false);
    const [showAddClaim, setShowAddClaim] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
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

    const person = useQuery(api.people.getWithClaims,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    const relationships = useQuery(api.people.getRelationships,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    const residenceClaims = useMemo(() => {
        if (!person) return [];
        return (person.claims as PersonClaim[]).filter(
            (claim) => claim.claimType === 'residence' && Boolean(claim.place)
        );
    }, [person]);

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
                    <div className="avatar avatar-xl text-3xl">
                        <span>{(person.givenNames?.[0] || '') + (person.surnames?.[0] || '')}</span>
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
                                                    {claim.value.date || 'Unknown Date'}
                                                </div>
                                                <div className="flex-1 pb-4 border-l border-border-subtle pl-4 relative">
                                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border" />
                                                    <h4 className="font-medium capitalize">{claim.claimType}</h4>
                                                    <p className="text-sm text-muted">
                                                        {claim.place?.displayName}
                                                    </p>
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
                                            <div key={claim._id} className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-medium">
                                                        {claim.place?.displayName}
                                                    </div>
                                                    <div className="text-xs text-muted">
                                                        {claim.value.date || 'Unknown date'}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted">Residence</span>
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
                                                />
                                            ))
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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
                        onClose={() => setShowAddClaim(false)}
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
        </div>
    );
}
