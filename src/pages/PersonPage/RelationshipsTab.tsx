import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { RelationshipCard } from "../../components/people/RelationshipCard";
import { RelationshipChart } from "../../components/people/RelationshipChart";
import type { PersonRelationships } from "./usePersonPageData";

type ProfilePhotoData = {
    storageUrl?: string | null;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
    mediaId: Id<"media">;
};

type RelationshipsTabProps = {
    person: Doc<"people">;
    profilePhoto?: {
        storageUrl?: string;
        zoomLevel?: number;
        focusX?: number;
        focusY?: number;
    };
    relationships: PersonRelationships;
    getRelationshipPhoto: (person?: Doc<"people"> | null) => ProfilePhotoData | undefined;
    onAddRelationship: () => void;
    onDeleteRelationship: (relId: Id<"relationships">) => void;
};

export function RelationshipsTab({
    person,
    profilePhoto,
    relationships,
    getRelationshipPhoto,
    onAddRelationship,
    onDeleteRelationship,
}: RelationshipsTabProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Family Connections</h3>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={onAddRelationship}
                >
                    + Add Relationship
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Relationship status:</span>
                <span className="badge badge-relationship badge-relationship-current">Current</span>
                <span className="badge badge-relationship badge-relationship-ended">Ended</span>
                <span>Shown for spouse/partner links.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(["Parents", "Spouses", "Siblings", "Children"] as const).map((category) => {
                    const list =
                        category === "Parents"
                            ? relationships.parents
                            : category === "Spouses"
                                ? relationships.spouses
                                : category === "Siblings"
                                    ? relationships.siblings
                                    : relationships.children;
                    const roleLabel =
                        category === "Parents"
                            ? "Parent"
                            : category === "Children"
                                ? "Child"
                                : undefined;

                    return (
                        <div key={category} className="space-y-2">
                            <h4 className="text-sm font-medium text-muted uppercase tracking-wider">
                                {category}
                            </h4>
                            {list.length === 0 ? (
                                <p className="text-sm text-muted italic">None recorded</p>
                            ) : (
                                list.map((r) => (
                                    <RelationshipCard
                                        key={r.relationship._id}
                                        relationship={r.relationship}
                                        person={r.person}
                                        profilePhoto={getRelationshipPhoto(r.person)}
                                        onDelete={onDeleteRelationship}
                                        roleLabel={roleLabel}
                                    />
                                ))
                            )}
                        </div>
                    );
                })}
            </div>

            <RelationshipChart
                person={person}
                profilePhoto={profilePhoto}
                relationships={relationships}
                getRelationshipPhoto={getRelationshipPhoto}
            />
        </div>
    );
}
