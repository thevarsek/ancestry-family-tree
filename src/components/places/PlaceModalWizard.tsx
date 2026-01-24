import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { WizardModal, type WizardStep } from '../ui/WizardModal';
import { useErrorHandler } from '../../hooks/useErrorHandler';

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

interface PlaceModalWizardProps {
    treeId: Id<"trees">;
    initialPlace?: Doc<"places"> | null;
    onClose: () => void;
    onSuccess?: (placeId: Id<"places">) => void;
}

/**
 * Wizard modal for creating and editing places.
 * Steps: Location Search -> Place Details
 */
export function PlaceModalWizard({
    treeId,
    initialPlace,
    onClose,
    onSuccess,
}: PlaceModalWizardProps) {
    const isEditMode = !!initialPlace;
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Wizard state
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<PlaceFormState>(emptyForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pickedLocation, setPickedLocation] = useState(false);

    // Mutations
    const createPlace = useMutation(api.places.create);
    const updatePlace = useMutation(api.places.update);

    // Initialize form when editing
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
        } else {
            setFormData(emptyForm);
            setPickedLocation(false);
        }
    }, [initialPlace]);

    // Auto-fill display name from search query if empty
    useEffect(() => {
        if (initialPlace) return;
        if (!formData.displayName.trim() && searchQuery.trim()) {
            setFormData((prev) => ({ ...prev, displayName: searchQuery.trim() }));
        }
    }, [formData.displayName, initialPlace, searchQuery]);

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
        } catch (err) {
            handleErrorWithToast(err, { operation: 'search locations' });
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
        setSearchResults([]); // Clear results after selection
    };

    const handleSave = async () => {
        if (!formData.displayName.trim()) return;

        setIsSubmitting(true);
        setError(null);

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
                showSuccess('Place updated successfully');
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
                showSuccess('Place created successfully');
                onSuccess?.(placeId);
            }
            onClose();
        } catch (err) {
            handleErrorWithToast(err, { operation: 'save place' });
            setError('Failed to save place. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSave = formData.displayName.trim().length > 0;

    // Wizard steps
    const steps: WizardStep[] = [
        {
            id: 'search',
            label: 'Location',
            content: (
                <div className="space-y-4">
                    <div className="input-group">
                        <label className="input-label">Search for a Location</label>
                        <p className="text-xs text-muted mb-2">
                            Search for a city, address, or landmark to auto-fill details.
                        </p>
                        <div className="flex gap-2">
                            <input
                                className="input flex-1"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search city, region, or landmark"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearch();
                                    }
                                }}
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
                    </div>

                    {searchResults.length > 0 && (
                        <div className="input-group">
                            <label className="input-label">Search Results</label>
                            <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                                {searchResults.map((result, index) => (
                                    <button
                                        key={`${result.lat}-${result.lon}-${index}`}
                                        type="button"
                                        className="w-full text-left text-sm px-3 py-2 hover:bg-surface-hover border-b border-border last:border-b-0"
                                        onClick={() => handlePickResult(result)}
                                    >
                                        {result.display_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {pickedLocation && (
                        <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
                            <div className="font-medium text-accent mb-1">Location Selected</div>
                            <div className="text-muted">{formData.displayName}</div>
                        </div>
                    )}

                    <p className="text-xs text-muted">
                        Or skip this step and enter details manually on the next screen.
                    </p>
                </div>
            ),
        },
        {
            id: 'details',
            label: 'Details',
            content: (
                <div className="space-y-4">
                    <div className="input-group">
                        <label className="input-label">Display Name *</label>
                        <input
                            className="input"
                            value={formData.displayName}
                            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                            placeholder="e.g. Smith Family Homestead or Boston"
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
            ),
        },
    ];

    return (
        <WizardModal
            title={isEditMode ? 'Edit Place' : 'Add Place'}
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onClose={onClose}
            onSave={handleSave}
            isSaving={isSubmitting}
            canSave={canSave}
            saveLabel={isEditMode ? 'Save Changes' : 'Create Place'}
            savingLabel={isEditMode ? 'Saving...' : 'Creating...'}
            error={error}
        />
    );
}


