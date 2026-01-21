import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { CreatePersonModal } from './PersonList';

type RelationshipType = "parent_child" | "spouse" | "sibling" | "partner";

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
    const [relType, setRelType] = useState<RelationshipType>('parent_child');
    const [role, setRole] = useState<'parent' | 'child'>('parent'); // For parent_child disambiguation
    const [selectedPersonId, setSelectedPersonId] = useState<Id<"people"> | null>(null);
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

    const handleTypeSelect = (type: RelationshipType, nextRole?: 'parent' | 'child') => {
        setRelType(type);
        if (nextRole) {
            setRole(nextRole);
        }
        setSelectedPersonId(null);
        setStep('select_person');
    };

    const handleSubmit = async () => {
        if (!selectedPersonId) return;
        setIsSubmitting(true);

        try {
            // Determine p1 and p2 based on type and role
            // For parent_child: p1 is parent, p2 is child
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
                status: relType === 'spouse' ? 'current' : undefined,
            });

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
                        <div className="space-y-4">
                            <p className="text-muted">How is the new person related to <strong>{personName}</strong>?</p>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className={`card p-4 text-center hover:border-accent ${relType === 'parent_child' && role === 'parent' ? 'border-accent ring-1 ring-accent' : ''}`}
                                    onClick={() => handleTypeSelect('parent_child', 'parent')}
                                >
                                    <span className="text-2xl block mb-2">👨‍👩‍👧</span>
                                    Parent
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-center hover:border-accent ${relType === 'parent_child' && role === 'child' ? 'border-accent ring-1 ring-accent' : ''}`}
                                    onClick={() => handleTypeSelect('parent_child', 'child')}
                                >
                                    <span className="text-2xl block mb-2">👶</span>
                                    Child
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-center hover:border-accent ${relType === 'spouse' ? 'border-accent ring-1 ring-accent' : ''}`}
                                    onClick={() => handleTypeSelect('spouse')}
                                >
                                    <span className="text-2xl block mb-2">💍</span>
                                    Spouse
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-center hover:border-accent ${relType === 'sibling' ? 'border-accent ring-1 ring-accent' : ''}`}
                                    onClick={() => handleTypeSelect('sibling')}
                                >
                                    <span className="text-2xl block mb-2">👥</span>
                                    Sibling
                                </button>
                                <button
                                    type="button"
                                    className={`card p-4 text-center hover:border-accent ${relType === 'partner' ? 'border-accent ring-1 ring-accent' : ''}`}
                                    onClick={() => handleTypeSelect('partner')}
                                >
                                    <span className="text-2xl block mb-2">❤️</span>
                                    Partner
                                </button>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    type="button"
                                    className="btn btn-primary w-full"
                                    onClick={() => setStep('select_person')}
                                >
                                    Next: Select Person
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm px-2"
                                    onClick={() => setStep('type')}
                                >
                                    ←
                                </button>
                                <p>
                                    Select <strong>
                                        {relType === 'parent_child' ? role : relType}
                                    </strong> for {personName}
                                </p>
                            </div>

                            <input
                                className="input mb-4"
                                placeholder="Search existing people..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />

                            <div className="h-64 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                                {filteredPeople?.map(person => (
                                    <div
                                        key={person._id}
                                        className={`p-2 rounded cursor-pointer flex items-center gap-3 ${selectedPersonId === person._id ? 'bg-primary/10 border-primary' : 'hover:bg-surface-hover'}`}
                                        onClick={() => setSelectedPersonId(person._id)}
                                    >
                                        <div className="avatar avatar-sm">
                                            <span>{(person.givenNames?.[0] || '')}</span>
                                        </div>
                                        <div>
                                            <div className="font-medium">{person.givenNames} {person.surnames}</div>
                                            <div className="text-xs text-muted">{person.isLiving ? 'Living' : 'Deceased'}</div>
                                        </div>
                                    </div>
                                ))}
                                {filteredPeople?.length === 0 && (
                                    <p className="text-center text-muted py-4">No matching people found.</p>
                                )}
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary w-full"
                                onClick={() => setShowCreatePerson(true)}
                            >
                                Create New Person
                            </button>

                            <div className="modal-footer px-0 pb-0">
                                <button
                                    type="button"
                                    className="btn btn-primary w-full"
                                    disabled={!selectedPersonId || isSubmitting}
                                    onClick={handleSubmit}
                                >
                                    {isSubmitting ? 'Linking...' : 'Add Relationship'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showCreatePerson && (
                <CreatePersonModal
                    treeId={treeId}
                    onClose={() => setShowCreatePerson(false)}
                    onSuccess={(newPersonId) => {
                        setSelectedPersonId(newPersonId);
                        setShowCreatePerson(false);
                    }}
                />
            )}
        </>
    );
}
