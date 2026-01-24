import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { WizardModal, type WizardStep } from '../ui/WizardModal';
import { PersonModal } from './PersonList';
import { useErrorHandler } from '../../hooks/useErrorHandler';

type RelationshipType = "parent_child" | "spouse" | "sibling" | "half_sibling" | "partner";
type RelationshipRole = 'parent' | 'child';
type RelationshipStatus = 'current' | 'divorced' | 'separated' | 'widowed' | 'ended';

interface RelationshipOption {
    type: RelationshipType;
    role?: RelationshipRole;
    emoji: string;
    label: string;
    description: string;
}

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
    { type: 'parent_child', role: 'parent', emoji: '👨‍👩‍👧', label: 'Parent', description: 'They are a parent of this person.' },
    { type: 'parent_child', role: 'child', emoji: '👶', label: 'Child', description: 'They are a child of this person.' },
    { type: 'spouse', emoji: '💍', label: 'Spouse', description: 'They are married to this person.' },
    { type: 'partner', emoji: '❤️', label: 'Partner', description: 'They are partnered with this person.' },
    { type: 'sibling', emoji: '👥', label: 'Sibling', description: 'They share parents with this person.' },
    { type: 'half_sibling', emoji: '🤝', label: 'Half Sibling', description: 'They share one parent with this person.' },
];

interface RelationshipModalProps {
    treeId: Id<"trees">;
    personId: Id<"people">;
    personName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

/**
 * Wizard modal for creating relationships between people.
 * Steps: Relationship Type -> Select People
 */
export function RelationshipModal({
    treeId,
    personId,
    personName,
    onClose,
    onSuccess,
}: RelationshipModalProps) {
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Wizard state
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [selectedOption, setSelectedOption] = useState<RelationshipOption | null>(null);
    const [selectedPersonIds, setSelectedPersonIds] = useState<Id<"people">[]>([]);
    const [relStatus, setRelStatus] = useState<RelationshipStatus>('current');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Nested modal state
    const [showCreatePerson, setShowCreatePerson] = useState(false);

    // Data queries
    const people = useQuery(api.people.list, { treeId, limit: 100 }) as Doc<"people">[] | undefined;
    const createRelationship = useMutation(api.relationships.create);

    // Filter people for selection
    const filteredPeople = useMemo(() => {
        return (people ?? []).filter((p) => {
            if (p._id === personId) return false; // Exclude self
            const name = `${p.givenNames ?? ''} ${p.surnames ?? ''}`.toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        });
    }, [people, personId, searchQuery]);

    const canSave = selectedPersonIds.length > 0 && selectedOption !== null;

    const handleSave = async () => {
        if (!canSave || !selectedOption) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            await Promise.all(selectedPersonIds.map(async (selectedPersonId) => {
                // Determine p1 and p2 based on type and role.
                // For parent_child: personId1 is parent, personId2 is child.
                let p1 = personId;
                let p2 = selectedPersonId;

                if (selectedOption.type === 'parent_child') {
                    if (selectedOption.role === 'parent') {
                        // Selected person is parent OF current person
                        p1 = selectedPersonId; // parent
                        p2 = personId;         // child
                    } else {
                        // Selected person is child OF current person
                        p1 = personId;         // parent
                        p2 = selectedPersonId; // child
                    }
                }

                await createRelationship({
                    treeId,
                    personId1: p1,
                    personId2: p2,
                    type: selectedOption.type,
                    status: (selectedOption.type === 'spouse' || selectedOption.type === 'partner') 
                        ? relStatus 
                        : undefined,
                });
            }));

            showSuccess(`Relationship${selectedPersonIds.length > 1 ? 's' : ''} added successfully`);
            onSuccess?.();
            onClose();
        } catch (err) {
            handleErrorWithToast(err, { operation: 'create relationship' });
            setError('Failed to create relationship. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOptionSelect = (option: RelationshipOption) => {
        setSelectedOption(option);
        setSelectedPersonIds([]); // Reset selection when changing type
    };

    const handlePersonToggle = (pId: Id<"people">) => {
        setSelectedPersonIds((prev) => 
            prev.includes(pId) 
                ? prev.filter((id) => id !== pId)
                : [...prev, pId]
        );
    };

    // Wizard steps
    const steps: WizardStep[] = [
        {
            id: 'type',
            label: 'Relationship Type',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        How is the new person related to <strong>{personName}</strong>?
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {RELATIONSHIP_OPTIONS.map((option) => {
                            const isSelected = selectedOption?.type === option.type && 
                                selectedOption?.role === option.role;
                            return (
                                <button
                                    key={`${option.type}-${option.role ?? ''}`}
                                    type="button"
                                    className={`card p-4 text-left hover:border-accent transition-colors ${
                                        isSelected ? 'border-accent ring-1 ring-accent bg-primary/5' : ''
                                    }`}
                                    onClick={() => handleOptionSelect(option)}
                                >
                                    <span className="text-2xl block mb-2">{option.emoji}</span>
                                    <div className="font-medium">{option.label}</div>
                                    <div className="text-xs text-muted">{option.description}</div>
                                    {isSelected && (
                                        <span className="text-xs text-accent mt-2 inline-block">Selected</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ),
        },
        {
            id: 'people',
            label: 'Select People',
            content: (
                <div className="space-y-4">
                    {selectedOption && (
                        <div className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-muted">Relationship</div>
                                    <div className="font-medium">
                                        {selectedOption.emoji} {selectedOption.label} of {personName}
                                    </div>
                                </div>
                                {(selectedOption.type === 'spouse' || selectedOption.type === 'partner') && (
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
                                                onClick={() => setRelStatus(selectedOption.type === 'spouse' ? 'divorced' : 'ended')}
                                            >
                                                {selectedOption.type === 'spouse' ? 'Divorced' : 'Split'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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

                    <div className="h-64 overflow-y-auto border border-border rounded-md p-3 space-y-2">
                        {filteredPeople.length === 0 ? (
                            <p className="text-center text-muted py-4">No matching people found.</p>
                        ) : (
                            filteredPeople.map((person) => {
                                const isSelected = selectedPersonIds.includes(person._id);
                                return (
                                    <div
                                        key={person._id}
                                        className={`p-3 rounded cursor-pointer flex items-center gap-3 border transition-colors ${
                                            isSelected 
                                                ? 'bg-primary/10 border-primary' 
                                                : 'border-transparent hover:bg-surface-hover'
                                        }`}
                                        onClick={() => handlePersonToggle(person._id)}
                                    >
                                        <div className="avatar avatar-sm">
                                            <span>{(person.givenNames?.[0] || '?')}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">
                                                {person.givenNames} {person.surnames}
                                            </div>
                                            <div className="text-xs text-muted">
                                                {person.isLiving ? 'Living' : 'Deceased'}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="text-xs text-accent">Selected</div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {selectedPersonIds.length > 0 && (
                        <p className="text-sm text-muted">
                            {selectedPersonIds.length} person{selectedPersonIds.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <WizardModal
                title="Add Relationship"
                steps={steps}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                onClose={onClose}
                onSave={handleSave}
                isSaving={isSubmitting}
                canSave={canSave}
                saveLabel="Add Relationship"
                savingLabel="Adding..."
                error={error}
            />

            {/* Nested Modal: Create Person */}
            {showCreatePerson && (
                <PersonModal
                    treeId={treeId}
                    onClose={() => setShowCreatePerson(false)}
                    onSuccess={(newPersonId: Id<"people">) => {
                        setSelectedPersonIds((prev) => [...prev, newPersonId]);
                        setShowCreatePerson(false);
                    }}
                />
            )}
        </>
    );
}
