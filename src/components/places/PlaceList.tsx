import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

export function CreatePlaceModal({
    treeId,
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    onClose: () => void;
    onSuccess?: (placeId: Id<"places">) => void;
}) {
    const [formData, setFormData] = useState({
        displayName: '',
        city: '',
        state: '',
        country: '',
        historicalNote: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createPlace = useMutation(api.places.create);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.displayName) return;

        setIsSubmitting(true);
        try {
            const placeId = await createPlace({
                treeId,
                displayName: formData.displayName,
                city: formData.city || undefined,
                state: formData.state || undefined,
                country: formData.country || undefined,
                historicalNote: formData.historicalNote || undefined,
                geocodeMethod: 'manual',
                geocodePrecision: 'approximate',
            });
            if (onSuccess) onSuccess(placeId);
            onClose();
        } catch (error) {
            console.error("Failed to create place:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add New Place</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Display Name</label>
                            <input
                                className="input"
                                value={formData.displayName}
                                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                placeholder="e.g. Smith Family Homestead or Boston"
                                autoFocus
                            />
                            <p className="text-xs text-muted mt-1">This is how the place will appear in timelines.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group">
                                <label className="input-label">City/Town</label>
                                <input
                                    className="input"
                                    value={formData.city}
                                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                    placeholder="e.g. Springfield"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">State/Province</label>
                                <input
                                    className="input"
                                    value={formData.state}
                                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                                    placeholder="e.g. IL"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Country</label>
                            <input
                                className="input"
                                value={formData.country}
                                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                placeholder="e.g. USA"
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Historical Note</label>
                            <textarea
                                className="input"
                                value={formData.historicalNote}
                                onChange={(e) => setFormData(prev => ({ ...prev, historicalNote: e.target.value }))}
                                placeholder="Any historical context about this location..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!formData.displayName || isSubmitting}
                        >
                            {isSubmitting ? 'Adding...' : 'Add Place'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

export function PlaceList({ treeId }: { treeId: Id<"trees"> }) {
    const places = useQuery(api.places.list, { treeId, limit: 100 });
    const [showCreate, setShowCreate] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Client-side filtering
    const filteredPlaces = places?.filter(p => {
        const text = `${p.displayName} ${p.city || ''} ${p.state || ''}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase());
    });

    if (places === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-8" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Places</h2>
                    <p className="text-muted text-sm">{places.length} places recorded</p>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowCreate(true)}
                >
                    + Add Place
                </button>
            </div>

            <div className="input-group">
                <input
                    className="input"
                    placeholder="Filter places..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlaces?.map((place) => (
                    <div key={place._id} className="card card-interactive cursor-pointer p-4">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-1">📍</div>
                            <div>
                                <h4 className="font-semibold">{place.displayName}</h4>
                                <p className="text-sm text-muted">
                                    {[place.city, place.state, place.country].filter(Boolean).join(', ') || 'No address details'}
                                </p>
                                {place.historicalNote && (
                                    <p className="text-xs text-muted mt-2 border-t border-border-subtle pt-2">
                                        &quot;{place.historicalNote}&quot;
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredPlaces?.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted">
                        No places found matching &quot;{searchQuery}&quot;
                    </div>
                )}
            </div>

            {showCreate && (
                <CreatePlaceModal
                    treeId={treeId}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}
