import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { defaultLeafletIcon } from "../../components/places/leafletIcon";
import { formatClaimDate } from "../../utils/claimDates";
import type { PersonClaim } from "./usePersonPageData";

type PlacesTabProps = {
    treeId: string;
    personId: string;
    placeGroups: { place: PersonClaim["place"]; claims: PersonClaim[] }[];
    mapPlaces: Doc<"places">[];
    mapCenter: [number, number];
    onAddPlace: () => void;
    onEditClaim: (claim: PersonClaim) => void;
};

export function PlacesTab({
    treeId,
    personId,
    placeGroups,
    mapPlaces,
    mapCenter,
    onAddPlace,
    onEditClaim,
}: PlacesTabProps) {
    const navigate = useNavigate();
    const [selectedPlaceId, setSelectedPlaceId] = useState<Id<"places"> | null>(null);

    // Get claims for the selected place
    const selectedPlaceClaims = selectedPlaceId
        ? placeGroups.find((g) => g.place?._id === selectedPlaceId)?.claims ?? []
        : [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Places & Events</h3>
                <button className="btn btn-secondary btn-sm" onClick={onAddPlace}>
                    + Add Place/Event
                </button>
            </div>

            {placeGroups.length === 0 ? (
                <div className="card p-6 text-center text-muted">
                    No places recorded yet. Add a life event with a place to populate this view.
                </div>
            ) : (
                <>
                    {/* Map + Events at Place panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="card p-0 overflow-hidden lg:col-span-2">
                            <div className="p-4 border-b border-border-subtle">
                                <h4 className="font-semibold">Map View</h4>
                                <p className="text-xs text-muted">Pins show places with coordinates.</p>
                            </div>
                            <div style={{ height: "420px" }}>
                                <MapContainer
                                    center={mapCenter}
                                    zoom={mapPlaces.length ? 4 : 2}
                                    style={{ height: "100%", width: "100%" }}
                                >
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
                                                        {[place.city, place.state, place.country]
                                                            .filter(Boolean)
                                                            .join(", ") || "No address details"}
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
                            <h4 className="font-semibold mb-2">Events at Place</h4>
                            {selectedPlaceId ? (
                                selectedPlaceClaims.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedPlaceClaims.map((claim) => (
                                            <div
                                                key={claim._id}
                                                className="border-b border-border-subtle pb-2 cursor-pointer hover:bg-surface-hover rounded px-2 -mx-2"
                                                onClick={() =>
                                                    navigate(`/tree/${treeId}/person/${personId}/event/${claim._id}`)
                                                }
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="text-sm font-medium capitalize">
                                                            {claim.claimType === "custom"
                                                                ? (
                                                                      claim.value.customFields as
                                                                          | { title?: string }
                                                                          | undefined
                                                                  )?.title || "Custom event"
                                                                : claim.claimType.replace("_", " ")}
                                                        </div>
                                                        <div className="text-xs text-muted">
                                                            {formatClaimDate(claim.value) || "Unknown date"}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-ghost btn-sm flex-shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditClaim(claim);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted">No events recorded for this place yet.</p>
                                )
                            ) : (
                                <p className="text-sm text-muted">Select a pin or place card to see events.</p>
                            )}
                        </div>
                    </div>

                    {/* Place cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {placeGroups.map((group) => (
                            <div
                                key={group.place?._id}
                                className={`card card-interactive cursor-pointer p-4 ${
                                    selectedPlaceId === group.place?._id ? "ring-2 ring-accent" : ""
                                }`}
                                onClick={() => setSelectedPlaceId(group.place?._id ?? null)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl mt-1">📍</div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold">{group.place?.displayName}</h4>
                                        <p className="text-sm text-muted">
                                            {[group.place?.city, group.place?.state, group.place?.country]
                                                .filter(Boolean)
                                                .join(", ") || "No address details"}
                                        </p>
                                        <p className="text-xs text-muted mt-1">
                                            {group.claims.length} event{group.claims.length !== 1 ? "s" : ""}
                                        </p>
                                        {group.place?.latitude && group.place?.longitude ? (
                                            <p className="text-xs text-muted mt-1">Pinned on map</p>
                                        ) : (
                                            <p className="text-xs text-muted mt-1">Not on map</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
