import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Doc } from "../../../convex/_generated/dataModel";
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                                    >
                                        <Popup>
                                            <div className="space-y-1">
                                                <div className="font-semibold">{place.displayName}</div>
                                                <div className="text-xs text-muted">
                                                    {[place.city, place.state, place.country].filter(Boolean).join(", ") ||
                                                        "No address details"}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {placeGroups.map((group) => (
                            <div key={group.place?._id} className="card p-4 space-y-3">
                                <div>
                                    <h4 className="font-semibold">{group.place?.displayName}</h4>
                                    <p className="text-sm text-muted">
                                        {[group.place?.city, group.place?.state, group.place?.country]
                                            .filter(Boolean)
                                            .join(", ") || "No address details"}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {group.claims.map((claim) => (
                                        <div key={claim._id} className="flex items-start justify-between gap-3">
                                            <div>
                                                <Link
                                                    to={`/tree/${treeId}/person/${personId}/event/${claim._id}`}
                                                    className="text-sm font-medium capitalize hover:text-accent"
                                                >
                                                    {claim.claimType === "custom"
                                                        ? (claim.value.customFields as { title?: string } | undefined)?.title ||
                                                          "Custom event"
                                                        : claim.claimType.replace("_", " ")}
                                                </Link>
                                                <div className="text-xs text-muted">
                                                    {formatClaimDate(claim.value) || "Unknown date"}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => onEditClaim(claim)}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
