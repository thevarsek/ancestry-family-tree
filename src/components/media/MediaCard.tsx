import type { Doc } from '../../../convex/_generated/dataModel';

type MediaWithUrl = Doc<"media"> & {
    storageUrl?: string | null;
    taggedPersonIds?: string[];
    links?: Array<{ entityType: string; entityId: string }>;
};

export function MediaCard({ media, onDelete }: { media: MediaWithUrl; onDelete?: () => void }) {
    const isImage = media.type === 'photo' && media.storageUrl;
    const isAudio = media.type === 'audio' && media.storageUrl;
    const ocrStatus = media.ocrStatus ? media.ocrStatus.replace('_', ' ') : null;

    return (
        <div className="card overflow-hidden">
            <div className="aspect-video bg-surface-muted flex items-center justify-center">
                {isImage && (
                    <img
                        src={media.storageUrl ?? undefined}
                        alt={media.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                )}
                {!isImage && (
                    <div className="text-sm text-muted text-center px-4">
                        <div className="font-semibold capitalize">{media.type}</div>
                        <div className="text-xs">{media.mimeType ?? 'Unknown format'}</div>
                    </div>
                )}
            </div>
            <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h4 className="font-semibold">{media.title}</h4>
                        {media.description && (
                            <p className="text-xs text-muted">{media.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="badge badge-neutral capitalize">{media.type}</span>
                        {onDelete && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={onDelete}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>
                {media.role === 'profile_photo' && (
                    <span className="badge badge-accent">Profile Photo</span>
                )}
                {isAudio && (
                    <audio controls className="w-full">
                        <source src={media.storageUrl ?? undefined} type={media.mimeType ?? undefined} />
                    </audio>
                )}
                {ocrStatus && (
                    <div className="text-xs text-muted">Text extraction: {ocrStatus}</div>
                )}
            </div>
        </div>
    );
}
