import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { WizardModal, type WizardStep } from '../ui/WizardModal';
import { FilterableMultiSelect, type FilterableOption } from '../ui/FilterableSelect';
import { useProfilePhotoCrop } from '../../hooks/useProfilePhotoCrop';
import { MAX_FILE_BYTES, supportedMimeTypes, inferMediaType, type MediaUploadLink } from './mediaUploadConstants';
import { formatClaimDate } from '../../utils/claimDates';
import { useErrorHandler } from '../../hooks/useErrorHandler';

type ClaimWithPerson = Doc<"claims"> & { personName: string | null };
type MediaWithUrl = Doc<"media"> & {
    storageUrl?: string | null;
    taggedPersonIds?: Id<"people">[];
    links?: Array<{ entityType: string; entityId: string }>;
};

interface MediaModalProps {
    treeId: Id<"trees">;
    ownerPersonId: Id<"people">;
    /** If provided, this is edit mode */
    initialMedia?: MediaWithUrl;
    /** Whether this is for setting a profile photo */
    setAsProfilePhoto?: boolean;
    onClose: () => void;
    onSuccess?: (mediaId: Id<"media">) => void;
}

/**
 * Unified modal for creating and editing media.
 * Uses a wizard pattern with steps for upload, info, tags, and links.
 */
export function MediaModal({
    treeId,
    ownerPersonId,
    initialMedia,
    setAsProfilePhoto,
    onClose,
    onSuccess,
}: MediaModalProps) {
    const isEditMode = !!initialMedia;
    const { handleErrorWithToast, showSuccess } = useErrorHandler();

    // Form state
    const [currentStep, setCurrentStep] = useState(0);
    const [title, setTitle] = useState(initialMedia?.title ?? (setAsProfilePhoto ? 'Profile Photo' : ''));
    const [description, setDescription] = useState(initialMedia?.description ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [taggedPersonIds, setTaggedPersonIds] = useState<string[]>(
        (initialMedia?.taggedPersonIds ?? []).map(id => id.toString())
    );
    const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>(
        (initialMedia?.links ?? []).filter(l => l.entityType === 'claim').map(l => l.entityId)
    );
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
        (initialMedia?.links ?? []).filter(l => l.entityType === 'source').map(l => l.entityId)
    );
    const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>(
        (initialMedia?.links ?? []).filter(l => l.entityType === 'place').map(l => l.entityId)
    );
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Profile photo crop hook for pan/zoom functionality
    const crop = useProfilePhotoCrop();

    // Queries
    const people = useQuery(api.people.list, { treeId, limit: 200 }) as Doc<"people">[] | undefined;
    const allClaims = useQuery(api.claims.queries.listByTree, { treeId, limit: 500 }) as ClaimWithPerson[] | undefined;
    const sources = useQuery(api.sources.list, { treeId, limit: 200 }) as Doc<"sources">[] | undefined;
    const places = useQuery(api.places.list, { treeId, limit: 200 }) as Doc<"places">[] | undefined;

    // Mutations
    const generateUploadUrl = useMutation(api.media.generateUploadUrl);
    const createMedia = useMutation(api.media.create);
    const updateMedia = useMutation(api.media.update);
    const setProfilePhoto = useMutation(api.people.setProfilePhoto);

    // Set initial image size from existing media for edit mode
    useEffect(() => {
        if (initialMedia?.width && initialMedia?.height) {
            crop.setImageSize({
                width: initialMedia.width,
                height: initialMedia.height
            });
        }
        if (initialMedia?.zoomLevel !== undefined) {
            crop.setZoomLevel(initialMedia.zoomLevel);
        }
    }, [initialMedia, crop]);

    // Build options for selects
    const personOptions: FilterableOption[] = useMemo(() => {
        return (people ?? []).map((person) => ({
            id: person._id,
            label: `${person.givenNames ?? ''} ${person.surnames ?? ''}`.trim(),
            description: person.isLiving ? 'Living' : 'Deceased',
        }));
    }, [people]);

    const claimOptions: FilterableOption[] = useMemo(() => {
        if (!allClaims) return [];
        return allClaims.map((claim) => {
            const customFields = claim.value.customFields as { title?: string } | undefined;
            const rawTitle = claim.claimType === 'custom'
                ? customFields?.title || 'Custom event'
                : claim.claimType.replace('_', ' ');
            const titleLabel = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const dateLabel = formatClaimDate(claim.value);
            const personLabel = claim.personName ? ` - ${claim.personName}` : '';
            return {
                id: claim._id,
                label: `${titleLabel}${personLabel}`,
                description: dateLabel || undefined,
            };
        });
    }, [allClaims]);

    const sourceOptions: FilterableOption[] = useMemo(() => {
        return (sources ?? []).map((source) => ({
            id: source._id,
            label: source.title,
            description: source.author || source.url || undefined,
        }));
    }, [sources]);

    const placeOptions: FilterableOption[] = useMemo(() => {
        return (places ?? []).map((place) => ({
            id: place._id,
            label: place.displayName,
        }));
    }, [places]);

    const handleFileChange = (nextFile: File | null) => {
        if (!nextFile) {
            setFile(null);
            setFileError(null);
            return;
        }
        if (nextFile.size > MAX_FILE_BYTES) {
            setFileError('File is too large (max 25MB).');
            return;
        }
        if (!supportedMimeTypes.has(nextFile.type)) {
            setFileError('Unsupported file type.');
            return;
        }
        setFileError(null);
        setFile(nextFile);
    };

    const canSave = isEditMode
        ? title.trim().length > 0
        : title.trim().length > 0 && file !== null;

    const handleSave = async () => {
        if (!canSave) return;

        setIsSaving(true);
        setError(null);

        try {
            const links: MediaUploadLink[] = [
                ...selectedClaimIds.map(id => ({ entityType: 'claim' as const, entityId: id })),
                ...selectedSourceIds.map(id => ({ entityType: 'source' as const, entityId: id })),
                ...selectedPlaceIds.map(id => ({ entityType: 'place' as const, entityId: id })),
            ];

            if (isEditMode && initialMedia) {
                // Update existing media
                await updateMedia({
                    mediaId: initialMedia._id,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    taggedPersonIds: taggedPersonIds as Id<"people">[],
                    links: links.length ? links : undefined,
                    zoomLevel: setAsProfilePhoto ? crop.zoomLevel : undefined,
                    focusX: setAsProfilePhoto ? crop.focusX : undefined,
                    focusY: setAsProfilePhoto ? crop.focusY : undefined,
                });
                showSuccess('Media updated successfully');
                onSuccess?.(initialMedia._id);
            } else if (file) {
                // Upload and create new media
                const uploadUrl = await generateUploadUrl({});
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    body: file
                });
                if (!uploadResponse.ok) {
                    throw new Error('Upload failed');
                }
                const { storageId } = await uploadResponse.json() as { storageId: Id<'_storage'> };
                const mimeType = file.type;
                const mediaType = inferMediaType(mimeType);
                const width = crop.imageSize.width || undefined;
                const height = crop.imageSize.height || undefined;

                const mediaId = await createMedia({
                    treeId,
                    ownerPersonId,
                    storageKind: 'convex_file',
                    storageId,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    type: mediaType,
                    role: setAsProfilePhoto ? 'profile_photo' : 'attachment',
                    mimeType,
                    fileSizeBytes: file.size,
                    width: mediaType === 'photo' ? width : undefined,
                    height: mediaType === 'photo' ? height : undefined,
                    zoomLevel: setAsProfilePhoto ? crop.zoomLevel : undefined,
                    focusX: setAsProfilePhoto ? crop.focusX : undefined,
                    focusY: setAsProfilePhoto ? crop.focusY : undefined,
                    taggedPersonIds: taggedPersonIds.length ? taggedPersonIds as Id<"people">[] : undefined,
                    links: links.length ? links : undefined,
                });

                if (setAsProfilePhoto) {
                    await setProfilePhoto({ personId: ownerPersonId, mediaId });
                }

                showSuccess('Media uploaded successfully');
                onSuccess?.(mediaId);
            }
            onClose();
        } catch (err) {
            handleErrorWithToast(err, { operation: isEditMode ? 'update media' : 'upload media' });
            setError('Failed to save media. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Show crop UI when we have an image file or existing media
    const showCropUI = setAsProfilePhoto && (
        (file && file.type.startsWith('image/')) ||
        (isEditMode && initialMedia?.type === 'photo')
    );

    // Build wizard steps
    const steps: WizardStep[] = [];

    // Step 1: Upload & Info (combined for simplicity)
    steps.push({
        id: 'upload',
        label: isEditMode ? 'Info' : 'Upload & Info',
        content: (
            <div className="space-y-4">
                {!isEditMode && (
                    <div className="input-group">
                        <label className="input-label">Upload File *</label>
                        <input
                            type="file"
                            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                            accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*"
                        />
                        <p className="text-xs text-muted">Images, PDFs, DOCX, and audio files up to 25MB.</p>
                        {fileError && <p className="text-sm text-error">{fileError}</p>}
                    </div>
                )}

                <div className="input-group">
                    <label className="input-label">Title *</label>
                    <input
                        className="input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Wedding photo, Birth certificate"
                        autoFocus={isEditMode}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Description</label>
                    <textarea
                        className="input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional notes about this media..."
                        rows={3}
                    />
                </div>

                {showCropUI && (
                    <div className="input-group">
                        <label className="input-label">Profile Photo Crop</label>
                        <div className="space-y-4">
                            <div
                                ref={crop.previewRef}
                                className="profile-photo-preview relative mx-auto border border-border rounded-md overflow-hidden bg-gray-100 cursor-move select-none"
                                style={{ width: '256px', height: '256px', touchAction: 'none' }}
                                onPointerDown={crop.handlePointerDown}
                                onPointerUp={crop.handlePointerUp}
                            >
                                <img
                                    src={file ? URL.createObjectURL(file) : initialMedia?.storageUrl ?? ''}
                                    alt="Preview"
                                    className="absolute top-0 left-0 pointer-events-none"
                                    style={{
                                        width: `${crop.coverSize.width}px`,
                                        height: `${crop.coverSize.height}px`,
                                        transform: `translate(${crop.translateX}px, ${crop.translateY}px) scale(${crop.zoomLevel})`,
                                        transformOrigin: 'top left',
                                    }}
                                    onLoad={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        crop.setImageSize({
                                            width: target.naturalWidth,
                                            height: target.naturalHeight
                                        });
                                        if (file) {
                                            URL.revokeObjectURL(target.src);
                                        }
                                    }}
                                />
                                <div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                        borderRadius: '50%',
                                        width: '256px',
                                        height: '256px',
                                        border: '2px solid white',
                                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium">Zoom: {crop.zoomLevel.toFixed(2)}x</label>
                                    <button
                                        type="button"
                                        className="text-xs text-accent hover:underline"
                                        onClick={crop.reset}
                                    >
                                        Reset
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.01"
                                    value={crop.zoomLevel}
                                    onChange={(e) => crop.setZoomLevel(parseFloat(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ),
    });

    // Step 2: Tag People
    steps.push({
        id: 'people',
        label: 'Tag People',
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Tag people who appear in this media. They will see it on their profile.
                </p>
                {people === undefined ? (
                    <div className="spinner mx-auto" />
                ) : personOptions.length === 0 ? (
                    <p className="text-sm text-muted">No people in this tree yet.</p>
                ) : (
                    <FilterableMultiSelect
                        label="People"
                        placeholder="Select people..."
                        options={personOptions}
                        value={taggedPersonIds}
                        onChange={setTaggedPersonIds}
                        className="filterable-select-wide"
                    />
                )}
                {taggedPersonIds.length > 0 && (
                    <p className="text-xs text-muted">
                        {taggedPersonIds.length} {taggedPersonIds.length === 1 ? 'person' : 'people'} tagged
                    </p>
                )}
            </div>
        ),
    });

    // Step 3: Link to Life Events
    steps.push({
        id: 'events',
        label: 'Life Events',
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Link this media to life events it documents or relates to.
                </p>
                {allClaims === undefined ? (
                    <div className="spinner mx-auto" />
                ) : claimOptions.length === 0 ? (
                    <p className="text-sm text-muted">No life events in this tree yet.</p>
                ) : (
                    <FilterableMultiSelect
                        label="Life Events"
                        placeholder="Select life events..."
                        options={claimOptions}
                        value={selectedClaimIds}
                        onChange={setSelectedClaimIds}
                        className="filterable-select-wide"
                    />
                )}
                {selectedClaimIds.length > 0 && (
                    <p className="text-xs text-muted">
                        {selectedClaimIds.length} event{selectedClaimIds.length !== 1 ? 's' : ''} linked
                    </p>
                )}
            </div>
        ),
    });

    // Step 4: Link to Sources
    steps.push({
        id: 'sources',
        label: 'Sources',
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Link this media to sources it supports or came from.
                </p>
                {sources === undefined ? (
                    <div className="spinner mx-auto" />
                ) : sourceOptions.length === 0 ? (
                    <p className="text-sm text-muted">No sources in this tree yet.</p>
                ) : (
                    <FilterableMultiSelect
                        label="Sources"
                        placeholder="Select sources..."
                        options={sourceOptions}
                        value={selectedSourceIds}
                        onChange={setSelectedSourceIds}
                        className="filterable-select-wide"
                    />
                )}
                {selectedSourceIds.length > 0 && (
                    <p className="text-xs text-muted">
                        {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? 's' : ''} linked
                    </p>
                )}
            </div>
        ),
    });

    // Step 5: Link to Places
    steps.push({
        id: 'places',
        label: 'Places',
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Link this media to places it was taken or relates to.
                </p>
                {places === undefined ? (
                    <div className="spinner mx-auto" />
                ) : placeOptions.length === 0 ? (
                    <p className="text-sm text-muted">No places in this tree yet.</p>
                ) : (
                    <FilterableMultiSelect
                        label="Places"
                        placeholder="Select places..."
                        options={placeOptions}
                        value={selectedPlaceIds}
                        onChange={setSelectedPlaceIds}
                        className="filterable-select-wide"
                    />
                )}
                {selectedPlaceIds.length > 0 && (
                    <p className="text-xs text-muted">
                        {selectedPlaceIds.length} place{selectedPlaceIds.length !== 1 ? 's' : ''} linked
                    </p>
                )}
            </div>
        ),
    });

    return (
        <WizardModal
            title={isEditMode ? 'Edit Media' : 'Add Media'}
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onClose={onClose}
            onSave={handleSave}
            isSaving={isSaving}
            canSave={canSave}
            saveLabel={isEditMode ? 'Save Changes' : 'Upload Media'}
            savingLabel={isEditMode ? 'Saving...' : 'Uploading...'}
            error={error}
        />
    );
}
