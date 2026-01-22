import { Link } from "react-router-dom";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { RelationshipCard } from "../../components/people/RelationshipCard";
import { formatClaimDate } from "../../utils/claimDates";
import { getClaimTitle } from "../../utils/claimSorting";
import type { PersonClaim, PersonRelationships } from "./usePersonPageData";

type ProfilePhotoData = {
    storageUrl?: string | null;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
    mediaId: Id<"media">;
};

type OverviewTabProps = {
    treeId: string;
    personId: string;
    sortedClaims: PersonClaim[];
    residenceClaims: PersonClaim[];
    relationships: PersonRelationships;
    getRelationshipPhoto: (person?: Doc<"people"> | null) => ProfilePhotoData | undefined;
    onAddClaim: (claimType: string) => void;
    onEditClaim: (claim: PersonClaim) => void;
    onDeleteClaim: (claimId: Id<"claims">) => void;
    onAddRelationship: () => void;
};

export function OverviewTab({
    treeId,
    personId,
    sortedClaims,
    residenceClaims,
    relationships,
    getRelationshipPhoto,
    onAddClaim,
    onEditClaim,
    onDeleteClaim,
    onAddRelationship,
}: OverviewTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <section className="card">
                    <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                        <h3 className="card-title text-base">Life Events</h3>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onAddClaim("birth")}
                        >
                            +
                        </button>
                    </div>
                    {sortedClaims.length === 0 ? (
                        <div className="text-center py-8 text-muted">
                            No events or claims recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedClaims.map((claim) => (
                                <div key={claim._id} className="flex gap-4">
                                    <div className="w-24 text-sm text-muted text-right pt-1">
                                        {formatClaimDate(claim.value) || "Unknown Date"}
                                    </div>
                                    <div className="flex-1 pb-4 border-l border-border-subtle pl-4 relative">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-border" />
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <Link
                                                    to={`/tree/${treeId}/person/${personId}/event/${claim._id}`}
                                                    className="font-medium capitalize hover:text-accent"
                                                >
                                                    {getClaimTitle(claim)}
                                                </Link>
                                                <p className="text-sm text-muted">
                                                    {claim.place?.displayName || claim.value.description || "No details yet"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => onEditClaim(claim)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm text-error"
                                                    onClick={() => onDeleteClaim(claim._id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className="space-y-6">
                <section className="card p-4">
                    <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                        <h3 className="card-title text-base">Immediate Family</h3>
                        <button className="btn btn-ghost btn-sm" onClick={onAddRelationship}>
                            +
                        </button>
                    </div>
                    <div className="space-y-3">
                        {relationships.parents.concat(relationships.spouses).concat(relationships.children).length === 0 ? (
                            <p className="text-center py-4 text-muted text-sm">None recorded</p>
                        ) : (
                            <>
                                {relationships.parents.map((r) => (
                                    <RelationshipCard
                                        key={r.relationship._id}
                                        relationship={r.relationship}
                                        person={r.person}
                                        profilePhoto={getRelationshipPhoto(r.person)}
                                    />
                                ))}
                                {relationships.spouses.map((r) => (
                                    <RelationshipCard
                                        key={r.relationship._id}
                                        relationship={r.relationship}
                                        person={r.person}
                                        profilePhoto={getRelationshipPhoto(r.person)}
                                    />
                                ))}
                                {relationships.children.map((r) => (
                                    <RelationshipCard
                                        key={r.relationship._id}
                                        relationship={r.relationship}
                                        person={r.person}
                                        profilePhoto={getRelationshipPhoto(r.person)}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                </section>

                <section className="card">
                    <div className="card-header border-b border-border-subtle pb-2 mb-4 flex justify-between items-center">
                        <h3 className="card-title text-base">Places Lived</h3>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onAddClaim("residence")}
                        >
                            +
                        </button>
                    </div>
                    {residenceClaims.length === 0 ? (
                        <div className="text-center py-6 text-muted">
                            No residence places recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {residenceClaims.map((claim) => (
                                <div key={claim._id} className="flex items-start justify-between gap-4">
                                    <div>
                                        <Link
                                            to={`/tree/${treeId}/person/${personId}/event/${claim._id}`}
                                            className="font-medium hover:text-accent"
                                        >
                                            {claim.place?.displayName}
                                        </Link>
                                        <div className="text-xs text-muted">
                                            {formatClaimDate(claim.value) || "Unknown date"}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => onEditClaim(claim)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm text-error"
                                            onClick={() => onDeleteClaim(claim._id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
