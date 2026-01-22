/**
 * Constants and helper functions for MediaUploadModal
 */

export type LinkEntityType = 'claim' | 'source' | 'place';

export type MediaUploadLink = {
    entityType: LinkEntityType;
    entityId: string;
};

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const supportedMimeTypes = new Set([
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

export function inferMediaType(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'photo' as const;
    if (mimeType.startsWith('audio/')) return 'audio' as const;
    if (mimeType.includes('pdf') || mimeType.includes('wordprocessingml')) return 'document' as const;
    return 'document' as const;
}
