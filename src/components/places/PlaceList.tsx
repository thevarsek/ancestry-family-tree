import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { PlaceModal } from './PlaceModal';
import { defaultLeafletIcon } from './leafletIcon';
import { formatClaimDate } from '../../utils/claimDates';

export function PlaceList({ treeId }: { treeId: Id<"trees"> }) {
    const navigate = useNavigate();
    const places = useQuery(api.places.list, { treeId, limit: 100 }) as Doc<"places">[] | undefined;
    const [selectedPlaceId, setSelectedPlaceId] = useState<Id<"places"> | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editingPlace, setEditingPlace] = useState<Doc<'places'> | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const selectedPlaceClaims = useQuery(
        api.places.getClaims,
        selectedPlaceId ? { placeId: selectedPlaceId } : 'skip'
    ) as Array<Doc<"claims"> & { person: Doc<"people"> | null }> | undefined;

    // Client-side filtering
    const filteredPlaces = places?.filter((p: Doc<"places">) => {
        const text = `${p.displayName} ${p.city || ''} ${p.state || ''}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase());
    });

    const mapPlaces = useMemo(
        () => (places ?? []).filter((place: Doc<"places">) => place.latitude && place.longitude),
        [places]
    );

    const mapCenter = useMemo(() => {
        if (mapPlaces.length === 0) return [20, 0] as [number, number];
        const sum = mapPlaces.reduce(
            (acc, place: Doc<"places">) => {
                acc.lat += place.latitude ?? 0;
                acc.lng += place.longitude ?? 0;
                return acc;
            },
            { lat: 0, lng: 0 }
        );
        return [sum.lat / mapPlaces.length, sum.lng / mapPlaces.length] as [number, number];
    }, [mapPlaces]);

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
                    onClick={() => {
                        setEditingPlace(null);
                        setShowCreate(true);
                    }}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card p-0 overflow-hidden lg:col-span-2">
                    <div className="p-4 border-b border-border-subtle">
                        <h3 className="font-semibold">Map View</h3>
                        <p className="text-xs text-muted">Pins show places with coordinates.</p>
                    </div>
                    <div style={{ height: '420px' }}>
                        <MapContainer center={mapCenter} zoom={mapPlaces.length ? 4 : 2} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />
                            {mapPlaces.map((place) => (
                                <Marker
                                    key={place._id}
                                    position={[place.latitude as number, place.longitude as number]}
                                    icon={defaultLeafletIcon}
                                    eventHandlers={{
                                        click: () => setSelectedPlaceId(place._id),
                                    }}
                                >
                                    <Popup>
                                        <div className="space-y-1">
                                            <div className="font-semibold">{place.displayName}</div>
                                            <div className="text-xs text-muted">
                                                {[place.city, place.state, place.country].filter(Boolean).join(', ') || 'No address details'}
                                            </div>
                                            <button
                                                className="btn btn-secondary btn-sm mt-2"
                                                onClick={() => setSelectedPlaceId(place._id)}
                                            >
                                                View Events
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>
                <div className="card p-4">
                    <h3 className="font-semibold mb-2">Events at Place</h3>
                    {selectedPlaceId ? (
                        selectedPlaceClaims ? (
                            selectedPlaceClaims.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedPlaceClaims.map((claim) => (
                                        <div
                                            key={claim._id}
                                            className={`border-b border-border-subtle pb-2 ${claim.person ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                                            onClick={claim.person ? () => navigate(`/tree/${treeId}/person/${claim.person!._id}/event/${claim._id}`) : undefined}
                                        >
                                            <div className="text-sm font-medium capitalize">
                                                {claim.claimType === 'custom'
                                                    ? (claim.value.customFields as { title?: string } | undefined)?.title || 'Custom event'
                                                    : claim.claimType.replace('_', ' ')}
                                            </div>
                                            <div className="text-xs text-muted">
                                                {formatClaimDate(claim.value) || 'Unknown date'}
                                                {claim.person ? ` · ${claim.person.givenNames} ${claim.person.surnames}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted">No events recorded for this place yet.</p>
                            )
                        ) : (
                            <div className="spinner" />
                        )
                    ) : (
                        <p className="text-sm text-muted">Select a pin to see events.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlaces?.map((place) => (
                    <div key={place._id} className="card card-interactive cursor-pointer p-4" onClick={() => setSelectedPlaceId(place._id)}>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-1">📍</div>
                            <div>
                                <h4 className="font-semibold">{place.displayName}</h4>
                                <p className="text-sm text-muted">
                                    {[place.city, place.state, place.country].filter(Boolean).join(', ') || 'No address details'}
                                </p>
                                <button
                                    className="btn btn-ghost btn-sm mt-2"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setEditingPlace(place);
                                        setShowCreate(true);
                                    }}
                                >
                                    Edit
                                </button>
                                {place.historicalNote && (
                                    <p className="text-xs text-muted mt-2 border-t border-border-subtle pt-2">
                                        &quot;{place.historicalNote}&quot;
                                    </p>
                                )}
                                {place.latitude && place.longitude ? (
                                    <p className="text-xs text-muted mt-2">Pinned on map</p>
                                ) : (
                                    <p className="text-xs text-muted mt-2">Add coordinates to show on map</p>
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
                <PlaceModal
                    treeId={treeId}
                    initialPlace={editingPlace}
                    onClose={() => {
                        setShowCreate(false);
                        setEditingPlace(null);
                    }}
                    onSuccess={(placeId) => {
                        setSelectedPlaceId(placeId);
                    }}
                />
            )}
        </div>
    );
}
