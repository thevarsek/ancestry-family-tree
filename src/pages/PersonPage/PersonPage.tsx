import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { RelationshipModal } from "../../components/people/RelationshipModal";
import { PersonModal } from "../../components/people/PersonList";
import { ProfilePhoto } from "../../components/people/ProfilePhoto";
import { LifeEventModal } from "../../components/claims/LifeEventModal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PersonSourceList } from "../../components/sources/PersonSourceList";
import { MediaList } from "../../components/media/MediaList";
import { usePersonPageData, PersonClaim } from "./usePersonPageData";
import { OverviewTab } from "./OverviewTab";
import { RelationshipsTab } from "./RelationshipsTab";
import { PlacesTab } from "./PlacesTab";
import { handleError } from "../../utils/errorHandling";

type TabType = "overview" | "relationships" | "places" | "sources" | "media";
type ClaimType = "birth" | "death" | "marriage" | "divorce" | "residence" | "occupation" | "education" | "custom";

export function PersonPage() {
    const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
    const navigate = useNavigate();
    
    // UI state
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [showAddRel, setShowAddRel] = useState(false);
    const [showAddClaim, setShowAddClaim] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editingClaim, setEditingClaim] = useState<PersonClaim | null>(null);
    const [defaultClaimType, setDefaultClaimType] = useState<ClaimType>("birth");
    
    // Delete confirmation state
    const [pendingClaimDelete, setPendingClaimDelete] = useState<Id<"claims"> | null>(null);
    const [isDeletingClaim, setIsDeletingClaim] = useState(false);
    const [claimDeleteError, setClaimDeleteError] = useState<string | null>(null);
    const [pendingPersonDelete, setPendingPersonDelete] = useState(false);
    const [isDeletingPerson, setIsDeletingPerson] = useState(false);
    const [pendingRelationshipDelete, setPendingRelationshipDelete] = useState<Id<"relationships"> | null>(null);
    const [isDeletingRelationship, setIsDeletingRelationship] = useState(false);
    const [relationshipDeleteError, setRelationshipDeleteError] = useState<string | null>(null);

    // Mutations
    const deletePerson = useMutation(api.people.remove);
    const removeRelationship = useMutation(api.relationships.remove);
    const removeClaim = useMutation(api.claims.remove);

    // Data fetching
    const {
        person,
        relationships,
        profilePhoto,
        isLoading,
        sortedClaims,
        residenceClaims,
        placeGroups,
        mapPlaces,
        mapCenter,
        getRelationshipPhoto,
    } = usePersonPageData(personId);

    // Event handlers
    const handleAddClaim = (claimType: string) => {
        setDefaultClaimType(claimType as ClaimType);
        setEditingClaim(null);
        setShowAddClaim(true);
    };

    const handleEditClaim = (claim: PersonClaim) => {
        setEditingClaim(claim);
        setShowAddClaim(true);
    };

    const handleDeleteClaim = (claimId: Id<"claims">) => {
        setClaimDeleteError(null);
        setPendingClaimDelete(claimId);
    };

    const handleConfirmDeleteClaim = async () => {
        if (!pendingClaimDelete) return;
        setIsDeletingClaim(true);
        try {
            await removeClaim({ claimId: pendingClaimDelete });
            setPendingClaimDelete(null);
        } catch (error) {
            handleError(error, { operation: 'delete claim' });
            setClaimDeleteError("Unable to delete this event. Please try again.");
        } finally {
            setIsDeletingClaim(false);
        }
    };

    const handleAddRelationship = () => {
        setActiveTab("relationships");
        setShowAddRel(true);
    };

    const handleDeleteRelationship = (relId: Id<"relationships">) => {
        if (pendingRelationshipDelete) return;
        setRelationshipDeleteError(null);
        setPendingRelationshipDelete(relId);
    };

    const handleConfirmDeleteRelationship = async () => {
        if (!pendingRelationshipDelete) return;
        setIsDeletingRelationship(true);
        let didRemove = false;
        try {
            await removeRelationship({ relationshipId: pendingRelationshipDelete });
            didRemove = true;
        } catch (error) {
            handleError(error, { operation: 'remove relationship' });
            setRelationshipDeleteError("Unable to remove this relationship. Please try again.");
        } finally {
            setIsDeletingRelationship(false);
            if (didRemove) {
                setPendingRelationshipDelete(null);
            }
        }
    };

    const handleDeletePerson = () => {
        if (!personId || !treeId || pendingPersonDelete) return;
        setPendingPersonDelete(true);
    };

    const handleConfirmDeletePerson = async () => {
        if (!personId || !treeId) {
            setPendingPersonDelete(false);
            return;
        }
        setIsDeletingPerson(true);
        try {
            await deletePerson({ personId: personId as Id<"people"> });
            navigate(`/tree/${treeId}`);
        } finally {
            setIsDeletingPerson(false);
            setPendingPersonDelete(false);
        }
    };

    if (isLoading || !person || !relationships) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    return (
        <div className="container py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to={`/tree/${treeId}`} className="hover:text-accent">People</Link>
                    <span>/</span>
                    <span>{person.givenNames} {person.surnames}</span>
                </div>

                <div className="flex gap-6 items-start">
                    <div className="avatar avatar-xl text-3xl overflow-hidden">
                        {profilePhoto?.storageUrl ? (
                            <ProfilePhoto
                                src={profilePhoto.storageUrl}
                                alt={`${person.givenNames ?? ""} ${person.surnames ?? ""}`}
                                zoomLevel={profilePhoto.zoomLevel}
                                focusX={profilePhoto.focusX}
                                focusY={profilePhoto.focusY}
                            />
                        ) : (
                            <span>{(person.givenNames?.[0] || "") + (person.surnames?.[0] || "")}</span>
                        )}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold mb-1">
                            {person.givenNames} {person.surnames}
                        </h1>
                        <div className="text-muted flex gap-4 text-sm">
                            <span>{person.gender}</span>
                            <span>-</span>
                            <span>{person.isLiving ? "Living" : "Deceased"}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowEditProfile(true)}>
                            Edit Profile
                        </button>
                        <button className="btn btn-ghost text-error" onClick={handleDeletePerson}>
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs mb-6">
                {(["overview", "relationships", "places", "sources", "media"] as const).map((tab) => (
                    <button
                        key={tab}
                        className={`tab ${activeTab === tab ? "tab-active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {activeTab === "overview" && (
                    <OverviewTab
                        treeId={treeId!}
                        personId={personId!}
                        sortedClaims={sortedClaims}
                        residenceClaims={residenceClaims}
                        relationships={relationships}
                        getRelationshipPhoto={getRelationshipPhoto}
                        onAddClaim={handleAddClaim}
                        onEditClaim={handleEditClaim}
                        onDeleteClaim={handleDeleteClaim}
                        onAddRelationship={handleAddRelationship}
                    />
                )}

                {activeTab === "relationships" && (
                    <RelationshipsTab
                        person={person}
                        profilePhoto={
                            profilePhoto
                                ? {
                                    storageUrl: profilePhoto.storageUrl ?? undefined,
                                    zoomLevel: profilePhoto.zoomLevel,
                                    focusX: profilePhoto.focusX,
                                    focusY: profilePhoto.focusY,
                                }
                                : undefined
                        }
                        relationships={relationships}
                        getRelationshipPhoto={getRelationshipPhoto}
                        onAddRelationship={() => setShowAddRel(true)}
                        onDeleteRelationship={handleDeleteRelationship}
                    />
                )}

                {activeTab === "places" && (
                    <PlacesTab
                        treeId={treeId!}
                        personId={personId!}
                        placeGroups={placeGroups}
                        mapPlaces={mapPlaces}
                        mapCenter={mapCenter}
                        onAddPlace={() => handleAddClaim("residence")}
                        onEditClaim={handleEditClaim}
                    />
                )}

                {activeTab === "sources" && (
                    <PersonSourceList
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                    />
                )}

                {activeTab === "media" && (
                    <MediaList
                        treeId={treeId as Id<"trees">}
                        personId={personId as Id<"people">}
                    />
                )}
            </div>

            {/* Modals */}
            {showAddRel && (
                <RelationshipModal
                    treeId={treeId as Id<"trees">}
                    personId={personId as Id<"people">}
                    personName={`${person.givenNames} ${person.surnames}`}
                    onClose={() => setShowAddRel(false)}
                />
            )}

            {showEditProfile && (
                <PersonModal
                    treeId={treeId as Id<"trees">}
                    personId={personId as Id<"people">}
                    initialData={person}
                    onClose={() => setShowEditProfile(false)}
                />
            )}

            {showAddClaim && (
                <LifeEventModal
                    treeId={treeId as Id<"trees">}
                    subjectId={personId as string}
                    subjectType="person"
                    defaultClaimType={defaultClaimType}
                    initialClaim={editingClaim}
                    onClose={() => {
                        setShowAddClaim(false);
                        setEditingClaim(null);
                    }}
                />
            )}

            {pendingRelationshipDelete && (
                <ConfirmModal
                    title="Remove Relationship"
                    description="This will remove the relationship from the tree. This action cannot be undone."
                    confirmLabel="Remove Relationship"
                    busyLabel="Removing..."
                    isBusy={isDeletingRelationship}
                    errorMessage={relationshipDeleteError}
                    onClose={() => {
                        setPendingRelationshipDelete(null);
                        setRelationshipDeleteError(null);
                    }}
                    onConfirm={handleConfirmDeleteRelationship}
                />
            )}

            {pendingPersonDelete && (
                <ConfirmModal
                    title="Delete Person"
                    description={`Deleting ${person.givenNames} ${person.surnames} will also remove their relationships and claims. This action cannot be undone.`}
                    confirmLabel="Delete Person"
                    busyLabel="Deleting..."
                    isBusy={isDeletingPerson}
                    onClose={() => setPendingPersonDelete(false)}
                    onConfirm={handleConfirmDeletePerson}
                />
            )}

            {pendingClaimDelete && (
                <ConfirmModal
                    title="Delete Event"
                    description="This will permanently remove this life event from the record. This action cannot be undone."
                    confirmLabel="Delete Event"
                    busyLabel="Deleting..."
                    isBusy={isDeletingClaim}
                    errorMessage={claimDeleteError}
                    onClose={() => {
                        setPendingClaimDelete(null);
                        setClaimDeleteError(null);
                    }}
                    onConfirm={handleConfirmDeleteClaim}
                />
            )}
        </div>
    );
}
