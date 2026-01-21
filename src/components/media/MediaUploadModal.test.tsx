import { render, screen, waitFor } from '@testing-library/react';
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
        vi.clearAllMocks();
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
});
