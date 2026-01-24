import type { Doc } from '../../../convex/_generated/dataModel';

type MediaWithUrl = Doc<"media"> & {
    storageUrl?: string | null;
    taggedPersonIds?: string[];
    links?: Array<{ entityType: string; entityId: string }>;
};

/**
 * Downloads a file from a URL by fetching it and creating a blob download.
 * This handles cross-origin URLs properly.
 */
async function downloadFile(url: string, filename: string) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        // Fallback: open in new tab
        window.open(url, '_blank');
    }
}

export function MediaCard({ 
    media, 
    onDelete,
    onEdit,
}: { 
    media: MediaWithUrl; 
    onDelete?: () => void;
    onEdit?: () => void;
}) {
    const isImage = media.type === 'photo' && media.storageUrl;
    const isAudio = media.type === 'audio' && media.storageUrl;
    const ocrStatus = media.ocrStatus ? media.ocrStatus.replace('_', ' ') : null;

    const handleDownload = () => {
        if (media.storageUrl) {
            // Create a filename from the title, sanitizing it for filesystem use
            const extension = media.mimeType?.split('/')[1] || 'file';
            const sanitizedTitle = media.title.replace(/[^a-zA-Z0-9-_]/g, '_');
            const filename = `${sanitizedTitle}.${extension}`;
            downloadFile(media.storageUrl, filename);
        }
    };

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
                    <div className="flex items-center gap-1">
                        <span className="badge badge-neutral capitalize">{media.type}</span>
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
                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                    {media.storageUrl && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={handleDownload}
                            title="Download"
                        >
                            Download
                        </button>
                    )}
                    {onEdit && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={onEdit}
                        >
                            Edit
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm text-error"
                            onClick={onDelete}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

