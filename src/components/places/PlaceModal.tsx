import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { handleError } from '../../utils/errorHandling';

type PlaceFormState = {
    displayName: string;
    city: string;
    state: string;
    country: string;
    historicalNote: string;
    latitude: string;
    longitude: string;
};

type NominatimResult = {
    display_name: string;
    lat: string;
    lon: string;
    address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
    };
};

const emptyForm: PlaceFormState = {
    displayName: '',
    city: '',
    state: '',
    country: '',
    historicalNote: '',
    latitude: '',
    longitude: '',
};

export function PlaceModal({
    treeId,
    initialPlace,
    onClose,
    onSuccess,
}: {
    treeId: Id<'trees'>;
    initialPlace?: Doc<'places'> | null;
    onClose: () => void;
    onSuccess?: (placeId: Id<'places'>) => void;
}) {
    const [formData, setFormData] = useState<PlaceFormState>(emptyForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pickedLocation, setPickedLocation] = useState(false);

    const createPlace = useMutation(api.places.create);
    const updatePlace = useMutation(api.places.update);

    useEffect(() => {
        if (initialPlace) {
            setFormData({
                displayName: initialPlace.displayName ?? '',
                city: initialPlace.city ?? '',
                state: initialPlace.state ?? '',
                country: initialPlace.country ?? '',
                historicalNote: initialPlace.historicalNote ?? '',
                latitude: initialPlace.latitude?.toString() ?? '',
                longitude: initialPlace.longitude?.toString() ?? '',
            });
            setPickedLocation(false);
            return;
        }
        setFormData(emptyForm);
        setPickedLocation(false);
    }, [initialPlace]);

    useEffect(() => {
        if (initialPlace) return;
        if (!formData.displayName.trim() && searchQuery.trim()) {
            setFormData((prev) => ({ ...prev, displayName: searchQuery.trim() }));
        }
    }, [formData.displayName, initialPlace, searchQuery]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!formData.displayName.trim()) return;

        setIsSubmitting(true);
        try {
            const latitude = formData.latitude ? Number(formData.latitude) : undefined;
            const longitude = formData.longitude ? Number(formData.longitude) : undefined;
            const geocodePrecision = latitude && longitude ? 'user_pin' : 'approximate';

            if (initialPlace) {
                await updatePlace({
                    placeId: initialPlace._id,
                    displayName: formData.displayName.trim(),
                    city: formData.city || undefined,
                    state: formData.state || undefined,
                    country: formData.country || undefined,
                    historicalNote: formData.historicalNote || undefined,
                    latitude,
                    longitude,
                    geocodePrecision,
                });
                onSuccess?.(initialPlace._id);
            } else {
                const placeId = await createPlace({
                    treeId,
                    displayName: formData.displayName.trim(),
                    city: formData.city || undefined,
                    state: formData.state || undefined,
                    country: formData.country || undefined,
                    historicalNote: formData.historicalNote || undefined,
                    latitude,
                    longitude,
                    geocodeMethod: pickedLocation ? 'imported' : 'manual',
                    geocodePrecision,
                });
                onSuccess?.(placeId);
            }
            onClose();
        } catch (error) {
            handleError(error, { operation: 'save place' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
                    searchQuery.trim()
                )}`
            );
            const results = (await response.json()) as NominatimResult[];
            setSearchResults(results);
        } catch (error) {
            handleError(error, { operation: 'search locations' });
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handlePickResult = (result: NominatimResult) => {
        const city = result.address?.city || result.address?.town || result.address?.village || '';
        setFormData((prev) => ({
            ...prev,
            displayName: result.display_name,
            city,
            state: result.address?.state ?? prev.state,
            country: result.address?.country ?? prev.country,
            latitude: result.lat,
            longitude: result.lon,
        }));
        setPickedLocation(true);
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">{initialPlace ? 'Edit Place' : 'Add New Place'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label">Search Location</label>
                            <div className="flex gap-2">
                                <input
                                    className="input"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search city, region, or landmark"
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleSearch}
                                    disabled={isSearching || !searchQuery.trim()}
                                >
                                    {isSearching ? 'Searching...' : 'Search'}
                                </button>
                            </div>
                            {searchResults.length > 0 && (
                                <div className="border border-border rounded-md p-2 space-y-2">
                                    {searchResults.map((result) => (
                                        <button
                                            key={`${result.lat}-${result.lon}`}
                                            type="button"
                                            className="w-full text-left text-sm px-2 py-2 rounded hover:bg-surface-hover"
                                            onClick={() => handlePickResult(result)}
                                        >
                                            {result.display_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group">
                                <label className="input-label">Latitude</label>
                                <input
                                    className="input"
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                                    placeholder="e.g. 42.3601"
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Longitude</label>
                                <input
                                    className="input"
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                                    placeholder="e.g. -71.0589"
                                />
                            </div>
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
                            {isSubmitting ? 'Saving...' : initialPlace ? 'Save Changes' : 'Add Place'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
