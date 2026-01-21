import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { PersonModal } from '../people/PersonList';

type LinkEntityType = 'claim' | 'source' | 'place';

type PersonClaim = Doc<"claims"> & { place?: Doc<"places"> | null };

type MediaUploadLink = {
    entityType: LinkEntityType;
    entityId: string;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const supportedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg'
]);

function inferMediaType(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'photo' as const;
    if (mimeType.startsWith('audio/')) return 'audio' as const;
    if (mimeType.includes('pdf') || mimeType.includes('wordprocessingml')) return 'document' as const;
    return 'document' as const;
}

export function MediaUploadModal({
    treeId,
    ownerPersonId,
    claims,
    defaultLinks,
    setAsProfilePhoto,
    onClose,
    onSuccess
}: {
    treeId: Id<"trees">;
    ownerPersonId: Id<"people">;
    claims?: PersonClaim[];
    defaultLinks?: MediaUploadLink[];
    setAsProfilePhoto?: boolean;
    onClose: () => void;
    onSuccess?: (mediaId: Id<"media">) => void;
}) {
    const [title, setTitle] = useState(setAsProfilePhoto ? 'Profile Photo' : '');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [taggedPersonIds, setTaggedPersonIds] = useState<Id<"people">[]>([]);
    const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPersonModal, setShowPersonModal] = useState(false);

    const people = useQuery(api.people.list, { treeId, limit: 200 });
    const sources = useQuery(api.sources.list, { treeId, limit: 200 });
    const places = useQuery(api.places.list, { treeId, limit: 200 });

    const generateUploadUrl = useMutation(api.media.generateUploadUrl);
    const createMedia = useMutation(api.media.create);
    const setProfilePhoto = useMutation(api.people.setProfilePhoto);

    useEffect(() => {
        if (defaultLinks) {
            setSelectedClaimIds(defaultLinks.filter((link) => link.entityType === 'claim').map((link) => link.entityId));
            setSelectedSourceIds(defaultLinks.filter((link) => link.entityType === 'source').map((link) => link.entityId));
            setSelectedPlaceIds(defaultLinks.filter((link) => link.entityType === 'place').map((link) => link.entityId));
        }
    }, [defaultLinks]);

    const claimOptions = useMemo(() => {
        return (claims ?? []).map((claim) => {
            const customFields = claim.value.customFields as { title?: string } | undefined;
            const rawTitle = claim.claimType === 'custom'
                ? customFields?.title || 'Custom event'
                : claim.claimType.replace('_', ' ');
            const titleLabel = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const dateLabel = claim.value.date ? ` - ${claim.value.date}` : '';
            return { id: claim._id, label: `${titleLabel}${dateLabel}` };
        });
    }, [claims]);

    const handleFileChange = (nextFile: File | null) => {
        if (!nextFile) {
            setFile(null);
            setError(null);
            return;
        }
        if (nextFile.size > MAX_FILE_BYTES) {
            setError('File is too large (max 25MB).');
            return;
        }
        if (!supportedMimeTypes.has(nextFile.type)) {
            setError('Unsupported file type.');
            return;
        }
        setError(null);
        setFile(nextFile);
    };

    const selectedLinks = useMemo<MediaUploadLink[]>(() => {
        return [
            ...selectedClaimIds.map((id) => ({ entityType: 'claim' as const, entityId: id })),
            ...selectedSourceIds.map((id) => ({ entityType: 'source' as const, entityId: id })),
            ...selectedPlaceIds.map((id) => ({ entityType: 'place' as const, entityId: id }))
        ];
    }, [selectedClaimIds, selectedSourceIds, selectedPlaceIds]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!file || !title.trim()) {
            setError('A file and name are required.');
            return;
        }
        setIsSubmitting(true);
        setError(null);

        try {
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
                taggedPersonIds: taggedPersonIds.length ? taggedPersonIds : undefined,
                links: selectedLinks.length ? selectedLinks : undefined
            });

            if (setAsProfilePhoto) {
                await setProfilePhoto({ personId: ownerPersonId, mediaId });
            }

            onSuccess?.(mediaId);
            onClose();
        } catch (submitError) {
            console.error('Failed to upload media:', submitError);
            setError('Unable to upload media. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Add Media</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        <div className="input-group">
                            <label className="input-label" htmlFor="media-title">Media Name</label>
                            <input
                                id="media-title"
                                className="input"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="e.g. Wedding photo"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="media-description">Description</label>
                            <textarea
                                id="media-description"
                                className="input"
                                rows={3}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Optional notes"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="media-file">Upload File</label>
                            <input
                                id="media-file"
                                type="file"
                                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                                accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*"
                            />
                            <p className="text-xs text-muted">Images, PDFs, DOCX, and audio files up to 25MB.</p>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Tag People</label>
                            <p className="text-xs text-muted">Tagged people will see this media on their profile.</p>
                            <div className="border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                {(people ?? []).map((person) => (
                                    <label key={person._id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={taggedPersonIds.includes(person._id)}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setTaggedPersonIds((prev) => [...prev, person._id]);
                                                } else {
                                                    setTaggedPersonIds((prev) => prev.filter((id) => id !== person._id));
                                                }
                                            }}
                                        />
                                        <span>{person.givenNames} {person.surnames}</span>
                                    </label>
                                ))}
                                {(people ?? []).length === 0 && (
                                    <p className="text-xs text-muted">No other people in this tree yet.</p>
                                )}
                            </div>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowPersonModal(true)}>
                                Add new person
                            </button>
                        </div>

                        {claimOptions.length > 0 && (
                            <div className="input-group">
                                <label className="input-label">Link to Life Events</label>
                                <div className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {claimOptions.map((claim) => (
                                        <label key={claim.id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedClaimIds.includes(claim.id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedClaimIds((prev) => [...prev, claim.id]);
                                                    } else {
                                                        setSelectedClaimIds((prev) => prev.filter((id) => id !== claim.id));
                                                    }
                                                }}
                                            />
                                            <span>{claim.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(sources ?? []).length > 0 && (
                            <div className="input-group">
                                <label className="input-label">Link to Sources</label>
                                <div className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {(sources ?? []).map((source) => (
                                        <label key={source._id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedSourceIds.includes(source._id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedSourceIds((prev) => [...prev, source._id]);
                                                    } else {
                                                        setSelectedSourceIds((prev) => prev.filter((id) => id !== source._id));
                                                    }
                                                }}
                                            />
                                            <span>{source.title}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(places ?? []).length > 0 && (
                            <div className="input-group">
                                <label className="input-label">Link to Places</label>
                                <div className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {(places ?? []).map((place) => (
                                        <label key={place._id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedPlaceIds.includes(place._id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedPlaceIds((prev) => [...prev, place._id]);
                                                    } else {
                                                        setSelectedPlaceIds((prev) => prev.filter((id) => id !== place._id));
                                                    }
                                                }}
                                            />
                                            <span>{place.displayName}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && <p className="text-sm text-error">{error}</p>}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Uploading...' : 'Save Media'}
                        </button>
                    </div>
                </form>
            </div>
            {showPersonModal && (
                <PersonModal
                    treeId={treeId}
                    onClose={() => setShowPersonModal(false)}
                    onSuccess={(personId) => {
                        setTaggedPersonIds((prev) => [...prev, personId]);
                        setShowPersonModal(false);
                    }}
                />
            )}
        </>
    );
}
