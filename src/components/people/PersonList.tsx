import { useState, type FormEvent } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

type PersonGender = 'unknown' | 'male' | 'female' | 'other';

export function CreatePersonModal({
    treeId,
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    onClose: () => void;
    onSuccess?: (personId: Id<"people">) => void;
}) {
    const [formData, setFormData] = useState({
        givenNames: '',
        surnames: '',
        gender: 'unknown' as PersonGender,
        isLiving: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createPerson = useMutation(api.people.create);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const personId = await createPerson({
                treeId,
                ...formData,
            });
            if (onSuccess) onSuccess(personId);
            onClose();
        } catch (error) {
            console.error("Failed to create person:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add New Person</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="input-group">
                                <label className="input-label">Given Names</label>
                                <input
                                    className="input"
                                    value={formData.givenNames}
                                    onChange={(e) => setFormData(prev => ({ ...prev, givenNames: e.target.value }))}
                                    placeholder="e.g. John William"
                                    autoFocus
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Surnames</label>
                                <input
                                    className="input"
                                    value={formData.surnames}
                                    onChange={(e) => setFormData(prev => ({ ...prev, surnames: e.target.value }))}
                                    placeholder="e.g. Smith"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="input-group">
                                <label className="input-label">Gender</label>
                                <select
                                    className="input"
                                    value={formData.gender}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            gender: e.target.value as PersonGender,
                                        }))
                                    }
                                >
                                    <option value="unknown">Unknown</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Status</label>
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isLiving}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isLiving: e.target.checked }))}
                                        id="isLiving"
                                    />
                                    <label htmlFor="isLiving">Living Person</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting || (!formData.givenNames && !formData.surnames)}
                        >
                            {isSubmitting ? 'Adding...' : 'Add Person'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

export function PersonList({ treeId }: { treeId: Id<"trees"> }) {
    const people = useQuery(api.people.list, { treeId, limit: 100 });
    const [showCreate, setShowCreate] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Client-side filtering for MVP (backend search exists for scale)
    const filteredPeople = people?.filter(p => {
        const fullName = `${p.givenNames || ''} ${p.surnames || ''}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    if (people === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-8" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">People</h2>
                    <p className="text-muted text-sm">{people.length} people in tree</p>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowCreate(true)}
                >
                    + Add Person
                </button>
            </div>

            <div className="input-group">
                <input
                    className="input"
                    placeholder="Filter people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPeople?.map((person) => (
                    <Link
                        key={person._id}
                        to={`/tree/${treeId}/person/${person._id}`}
                        className="card card-interactive cursor-pointer flex items-center gap-3 p-3 text-inherit no-underline hover:no-underline"
                    >
                        <div className="avatar">
                            {person.profilePhotoId ? (
                                // TODO: Image component with Convex storage
                                <span>IMG</span>
                            ) : (
                                <span>{(person.givenNames?.[0] || '') + (person.surnames?.[0] || '')}</span>
                            )}
                        </div>
                        <div>
                            <h4 className="font-semibold">
                                {person.givenNames} {person.surnames}
                            </h4>
                            <p className="text-xs text-muted">
                                {person.isLiving ? 'Living' : 'Deceased'} • {person.gender}
                            </p>
                        </div>
                    </Link>
                ))}

                {filteredPeople?.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted">
                        No people found matching &quot;{searchQuery}&quot;
                    </div>
                )}
            </div>

            {showCreate && (
                <CreatePersonModal
                    treeId={treeId}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}
