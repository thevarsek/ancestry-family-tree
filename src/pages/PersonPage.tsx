import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { AddRelationshipModal } from '../components/people/AddRelationshipModal';
import { PersonModal } from '../components/people/PersonList';
import { AddClaimModal } from '../components/claims/AddClaimModal';

type PersonClaim = Doc<"claims"> & { place?: Doc<"places"> | null };

export function RelationshipCard({
    relationship,
    person,
    onDelete
}: {
    relationship: Doc<"relationships">;
    person?: Doc<"people"> | null;
    onDelete?: (id: Id<"relationships">) => void;
}) {
    if (!person) {
        return null;
    }

    return (
        <div className="card p-3 flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className="avatar">
                    <span>{(person.givenNames?.[0] || '') + (person.surnames?.[0] || '')}</span>
                </div>
                <div>
                    <div className="font-semibold">
                        <Link to={`/tree/${person.treeId}/person/${person._id}`} className="hover:underline">
                            {person.givenNames} {person.surnames}
                        </Link>
                    </div>
                    <div className="text-xs text-muted capitalize">
                        {relationship.type.replace('_', ' ')}
                        {relationship.status !== 'current' && ` (${relationship.status})`}
                    </div>
                </div>
            </div>
            {onDelete && (
                <button
                    className="btn btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100 transition-opacity text-error"
                    onClick={() => onDelete(relationship._id)}
                    title="Remove Relationship"
                >
                    ×
                </button>
            )}
        </div>
    );
}

export function PersonPage() {
    const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'timeline'>('overview');
    const [showAddRel, setShowAddRel] = useState(false);
    const [showAddClaim, setShowAddClaim] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
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

    const handleDelete = async () => {
        if (!personId || !treeId) {
            return;
        }
        const confirmed = window.confirm(
            `Delete ${person.givenNames ?? ''} ${person.surnames ?? ''}? This will remove their relationships and claims.`
        );
        if (!confirmed) {
            return;
        }

        await deletePerson({ personId: personId as Id<"people"> });
        navigate(`/tree/${treeId}`);
    };

    const handleDeleteRelationship = async (relId: Id<"relationships">) => {
        if (!window.confirm("Remove this relationship?")) return;
        try {
            await removeRelationship({ relationshipId: relId });
        } catch (error) {
            console.error("Failed to remove relationship:", error);
            alert("Failed to remove relationship");
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
                            <section className="card">
                                <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                                    <h3 className="card-title text-base">Immediate Family</h3>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setActiveTab('relationships'); setShowAddRel(true); }}>
                                        +
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {relationships.parents.map((r) => (
                                        <div key={r.relationship._id} className="text-sm flex justify-between">
                                            <span className="text-muted">Parent</span>
                                            <Link to={`/tree/${treeId}/person/${r.person?._id}`} className="hover:underline">
                                                {r.person?.givenNames} {r.person?.surnames}
                                            </Link>
                                        </div>
                                    ))}
                                    {relationships.spouses.map((r) => (
                                        <div key={r.relationship._id} className="text-sm flex justify-between">
                                            <span className="text-muted">Spouse</span>
                                            <Link to={`/tree/${treeId}/person/${r.person?._id}`} className="hover:underline">
                                                {r.person?.givenNames} {r.person?.surnames}
                                            </Link>
                                        </div>
                                    ))}
                                    {relationships.children.map((r) => (
                                        <div key={r.relationship._id} className="text-sm flex justify-between">
                                            <span className="text-muted">Child</span>
                                            <Link to={`/tree/${treeId}/person/${r.person?._id}`} className="hover:underline">
                                                {r.person?.givenNames} {r.person?.surnames}
                                            </Link>
                                        </div>
                                    ))}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
    );
}
