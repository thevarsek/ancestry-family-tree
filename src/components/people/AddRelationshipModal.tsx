import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { CreatePersonModal } from './PersonList';

type RelationshipType = "parent_child" | "spouse" | "sibling" | "half_sibling" | "partner";
type RelationshipRole = 'parent' | 'child';

export function AddRelationshipModal({
    treeId,
    personId,
    personName,
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    personId: Id<"people">;
    personName: string;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const [step, setStep] = useState<'type' | 'select_person'>('type');
    const [relType, setRelType] = useState<RelationshipType | null>(null);
    const [role, setRole] = useState<RelationshipRole>('parent');
    const [selectedPersonIds, setSelectedPersonIds] = useState<Id<"people">[]>([]);
    const [relStatus, setRelStatus] = useState<'current' | 'divorced' | 'separated' | 'widowed' | 'ended'>('current');
    const [showCreatePerson, setShowCreatePerson] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search people to link
    const people = useQuery(api.people.list, { treeId, limit: 100 });
    const createRelationship = useMutation(api.relationships.create);

    const filteredPeople = people?.filter(p => {
        if (p._id === personId) return false; // Exclude self
        const name = `${p.givenNames} ${p.surnames}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    const relationshipLabel = relType
        ? relType === 'parent_child'
            ? `${role} of ${personName}`
            : `${relType} of ${personName}`
        : 'relationship';

    const handleTypeSelect = (type: RelationshipType, nextRole?: RelationshipRole) => {
        setRelType(type);
        if (nextRole) {
            setRole(nextRole);
        }
        setSelectedPersonIds([]);
    };

    const handleContinue = () => {
        if (!relType) return;
        setStep('select_person');
    };

    const handleSubmit = async () => {
        if (selectedPersonIds.length === 0 || !relType) return;
        setIsSubmitting(true);

        try {
            await Promise.all(selectedPersonIds.map(async (selectedPersonId) => {
                // Determine p1 and p2 based on type and role.
                // For parent_child: personId1 is parent, personId2 is child.
                let p1 = personId;
                let p2 = selectedPersonId;

                if (relType === 'parent_child') {
                    if (role === 'parent') {
                        // Selected person is parent OF current person
                        p1 = selectedPersonId; // parent
                        p2 = personId;         // child
                    } else {
                        // Selected person is child OF current person
                        p1 = personId;         // parent
                        p2 = selectedPersonId; // child
                    }
                } else {
                    // Spouse/Sibling: order doesn't matter strictly, but let's keep consistent?
                    // Schema doesn't enforce order for symmetric, but let's stick to p1=current
                    p1 = personId;
                    p2 = selectedPersonId;
                }

                await createRelationship({
                    treeId,
                    personId1: p1,
                    personId2: p2,
                    type: relType,
                    status: (relType === 'spouse' || relType === 'partner') ? relStatus : undefined,
                });
            }));

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create relationship:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Add Relationship</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {step === 'type' ? (
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <p className="text-sm text-muted">Step 1 of 2</p>
                                <p className="text-muted">How is the new person related to <strong>{personName}</strong>?</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'parent_child' && role === 'parent' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('parent_child', 'parent')}
                                >
                                    <span className="text-2xl block mb-2">👨‍👩‍👧</span>
                                    <div className="font-medium">Parent</div>
                                    <div className="text-xs text-muted">They are a parent of {personName}.</div>
                                    {relType === 'parent_child' && role === 'parent' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'parent_child' && role === 'child' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('parent_child', 'child')}
                                >
                                    <span className="text-2xl block mb-2">👶</span>
                                    <div className="font-medium">Child</div>
                                    <div className="text-xs text-muted">They are a child of {personName}.</div>
                                    {relType === 'parent_child' && role === 'child' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'spouse' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('spouse')}
                                >
                                    <span className="text-2xl block mb-2">💍</span>
                                    <div className="font-medium">Spouse</div>
                                    <div className="text-xs text-muted">They are married to {personName}.</div>
                                    {relType === 'spouse' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'sibling' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('sibling')}
                                >
                                    <span className="text-2xl block mb-2">👥</span>
                                    <div className="font-medium">Sibling</div>
                                    <div className="text-xs text-muted">They share parents with {personName}.</div>
                                    {relType === 'sibling' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'partner' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('partner')}
                                >
                                    <span className="text-2xl block mb-2">❤️</span>
                                    <div className="font-medium">Partner</div>
                                    <div className="text-xs text-muted">They are partnered with {personName}.</div>
                                    {relType === 'partner' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent ${relType === 'half_sibling' ? 'border-accent ring-1 ring-accent bg-primary/5' : ''}`}
                                    onClick={() => handleTypeSelect('half_sibling')}
                                >
                                    <span className="text-2xl block mb-2">🤝</span>
                                    <div className="font-medium">Half Sibling</div>
                                    <div className="text-xs text-muted">They share one parent with {personName}.</div>
                                    {relType === 'half_sibling' && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted">Step 2 of 2</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm px-2"
                                        onClick={() => setStep('type')}
                                    >
                                        ←
                                    </button>
                                    <p className="font-medium">
                                        Select people to link
                                    </p>
                                </div>
                                <div className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-muted">Relationship</div>
                                            <div className="font-medium capitalize">
                                                {relationshipLabel}
                                            </div>
                                        </div>
                                        {(relType === 'spouse' || relType === 'partner') && (
                                            <div className="text-right">
                                                <div className="text-muted mb-1">Status</div>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        className={`btn btn-xs ${relStatus === 'current' ? 'btn-primary' : 'btn-ghost'}`}
                                                        onClick={() => setRelStatus('current')}
                                                    >
                                                        Current
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-xs ${relStatus !== 'current' ? 'btn-primary' : 'btn-ghost'}`}
                                                        onClick={() => setRelStatus(relType === 'spouse' ? 'divorced' : 'ended')}
                                                    >
                                                        {relType === 'spouse' ? 'Divorced' : 'Split'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted mt-2">
                                        You are linking people to {personName}. Select one or more existing people or create a new one.
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowCreatePerson(true)}
                            >
                                Create New Person
                            </button>

                            <input
                                className="input"
                                placeholder="Search existing people..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />

                            <div className="h-64 overflow-y-auto border border-border rounded-md p-3 space-y-3">
                                {filteredPeople?.map(person => {
                                    const isSelected = selectedPersonIds.includes(person._id);
                                    return (
                                        <div
                                            key={person._id}
                                            className={`p-3 rounded cursor-pointer flex items-center gap-3 border ${isSelected ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-surface-hover'}`}
                                            onClick={() => {
                                                setSelectedPersonIds((prev) => (
                                                    prev.includes(person._id)
                                                        ? prev.filter((id) => id !== person._id)
                                                        : [...prev, person._id]
                                                ));
                                            }}
                                        >
                                            <div className="avatar avatar-sm">
                                                <span>{(person.givenNames?.[0] || '')}</span>
                                            </div>
                                            <div>
                                                <div className="font-medium">{person.givenNames} {person.surnames}</div>
                                                <div className="text-xs text-muted">{person.isLiving ? 'Living' : 'Deceased'}</div>
                                            </div>
                                            {isSelected && (
                                                <div className="ml-auto text-xs text-accent">Selected</div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredPeople?.length === 0 && (
                                    <p className="text-center text-muted py-4">No matching people found.</p>
                                )}
                            </div>

                            <p className="text-xs text-muted">
                                Can&apos;t find someone? Create a new person and they&apos;ll be selected automatically.
                            </p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step === 'type' ? (
                        <button
                            type="button"
                            className="btn btn-primary w-full"
                            onClick={handleContinue}
                            disabled={!relType}
                        >
                            Next: Select Person
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-primary w-full"
                            disabled={selectedPersonIds.length === 0 || isSubmitting}
                            onClick={handleSubmit}
                        >
                            {isSubmitting ? 'Linking...' : 'Add Relationships'}
                        </button>
                    )}
                </div>
            </div>
            {showCreatePerson && (
                <CreatePersonModal
                    treeId={treeId}
                    onClose={() => setShowCreatePerson(false)}
                    onSuccess={(newPersonId) => {
                        setSelectedPersonIds((prev) => [...prev, newPersonId]);
                        setShowCreatePerson(false);
                    }}
                />
            )}
        </>
    );
}
