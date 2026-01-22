import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '../../../convex/_generated/dataModel';
import { MediaUploadModal } from './MediaUploadModal';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;

describe('MediaUploadModal', () => {
    const generateUploadUrl = vi.fn().mockResolvedValue('https://uploads.local');
    const createMedia = vi.fn().mockResolvedValue('media_1');
    const setProfilePhoto = vi.fn();
    const generateUploadUrlMutation = generateUploadUrl as unknown as ReturnType<typeof useMutation>;
    const createMediaMutation = createMedia as unknown as ReturnType<typeof useMutation>;
    const setProfilePhotoMutation = setProfilePhoto as unknown as ReturnType<typeof useMutation>;

    beforeEach(() => {
        vi.mocked(useQuery).mockReturnValue([]);

        if (!('createObjectURL' in URL)) {
            Object.defineProperty(URL, 'createObjectURL', {
                value: vi.fn(() => 'blob:preview'),
                writable: true,
            });
        } else {
            vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:preview');
        }
        if (!('revokeObjectURL' in URL)) {
            Object.defineProperty(URL, 'revokeObjectURL', {
                value: vi.fn(),
                writable: true,
            });
        } else {
            vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        }

        let mutationCall = 0;
        const mutationResults = [
            generateUploadUrlMutation,
            createMediaMutation,
            setProfilePhotoMutation,
        ];

        vi.mocked(useMutation).mockImplementation(() => {
            const result = mutationResults[mutationCall % mutationResults.length];
            mutationCall += 1;
            return result;
        });

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ storageId: 'storage_1' })
        })) as unknown as typeof fetch);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('uploads media and creates a record', async () => {
        const user = userEvent.setup();
        render(
            <MediaUploadModal
                treeId={treeId}
                ownerPersonId={personId}
                onClose={vi.fn()}
            />
        );

        await user.type(screen.getByLabelText(/media name/i), 'Family Photo');
        const file = new File(['photo'], 'photo.png', { type: 'image/png' });
        const input = screen.getByLabelText(/upload file/i);
        await user.upload(input, file);

        await user.click(screen.getByRole('button', { name: /save media/i }));

        await waitFor(() => {
            expect(generateUploadUrl).toHaveBeenCalled();
            expect(createMedia).toHaveBeenCalledWith(expect.objectContaining({
                treeId,
                ownerPersonId: personId,
                title: 'Family Photo',
                type: 'photo',
            }));
        });
    });

    it('updates focus when dragging horizontally', async () => {
        const user = userEvent.setup();
        render(
            <MediaUploadModal
                treeId={treeId}
                ownerPersonId={personId}
                setAsProfilePhoto
                onClose={vi.fn()}
            />
        );

        const file = new File(['photo'], 'photo.png', { type: 'image/png' });
        const input = screen.getByLabelText(/upload file/i);
        await user.upload(input, file);

        const image = await screen.findByAltText('Preview') as HTMLImageElement;
        const preview = image.closest('.profile-photo-preview') as HTMLElement;
        vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
            width: 256,
            height: 256,
            top: 0,
            left: 0,
            right: 256,
            bottom: 256,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        Object.defineProperty(image, 'naturalWidth', { value: 512, configurable: true });
        Object.defineProperty(image, 'naturalHeight', { value: 256, configurable: true });
        fireEvent.load(image);

        fireEvent.pointerDown(preview, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
        fireEvent.pointerMove(document, { clientX: 150, clientY: 100, pointerId: 1 });
        fireEvent.pointerUp(document, { clientX: 150, clientY: 100, pointerId: 1 });
        await waitFor(() => {
            expect(image.style.transform).toBe('translate(-78px, 0px) scale(1)');
        });
    });
});
