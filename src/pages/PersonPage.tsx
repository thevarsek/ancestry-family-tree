import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { AddRelationshipModal } from '../components/people/AddRelationshipModal';
import { AddClaimModal } from '../components/claims/AddClaimModal';

function RelationshipCard({
    relationship,
    person
}: {
    relationship: Doc<"relationships">;
    person?: Doc<"people"> | null;
}) {
    if (!person) {
        return null;
    }

    return (
        <div className="card p-3 flex items-center justify-between">
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
        </div>
    );
}

export function PersonPage() {
    const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
    const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'timeline'>('overview');
    const [showAddRel, setShowAddRel] = useState(false);
    const [showAddClaim, setShowAddClaim] = useState(false);

    const person = useQuery(api.people.getWithClaims,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    const relationships = useQuery(api.people.getRelationships,
        personId ? { personId: personId as Id<"people"> } : "skip"
    );

    if (!person || !relationships) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

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
                    <button className="btn btn-secondary">Edit Profile</button>
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
                                        onClick={() => setShowAddClaim(true)}
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
                                        {person.claims.map((claim) => (
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
                                            list.map((r) => (
                                                <RelationshipCard
                                                    key={r.relationship._id}
                                                    relationship={r.relationship}
                                                    person={r.person}
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

                {showAddClaim && (
                    <AddClaimModal
                        treeId={treeId as Id<"trees">}
                        subjectId={personId as string}
                        subjectType="person"
                        onClose={() => setShowAddClaim(false)}
                    />
                )}
            </div>
        </div>
    );
}
