import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { CreateSourceModal } from './CreateSourceModal';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const claimId = 'claim_1' as Id<'claims'>;
const userId = 'user_1' as Id<'users'>;

const claim: Doc<'claims'> = {
    _id: claimId,
    _creationTime: 0,
    treeId,
    subjectType: 'person',
    subjectId: 'person_1',
    claimType: 'birth',
    value: {
        date: '1990-01-01',
    },
    status: 'accepted',
    createdBy: userId,
    createdAt: 0,
    updatedAt: 0,
};

const createSource = vi.fn().mockResolvedValue('source_1');
const updateMediaLinks = vi.fn();
const createSourceMutation = createSource as unknown as ReturnType<typeof useMutation>;
const updateMediaLinksMutation = updateMediaLinks as unknown as ReturnType<typeof useMutation>;

describe('CreateSourceModal', () => {
    beforeEach(() => {
        let queryCall = 0;
        const queryResults: unknown[] = [[], []];

        vi.mocked(useQuery).mockImplementation(() => {
            const result = queryResults[queryCall % queryResults.length];
            queryCall += 1;
            return result;
        });

        let mutationCall = 0;
        const mutationResults = [createSourceMutation, updateMediaLinksMutation];

        vi.mocked(useMutation).mockImplementation(() => {
            const result = mutationResults[mutationCall % mutationResults.length];
            mutationCall += 1;
            return result;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('passes claimId when linking a source', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        render(
            <CreateSourceModal
                treeId={treeId}
                claims={[claim]}
                onClose={onClose}
            />
        );

        await user.type(
            screen.getByPlaceholderText('e.g. 1920 US Census, Birth Certificate, etc.'),
            'Birth Register'
        );
        await user.selectOptions(screen.getAllByRole('combobox')[0], claimId);
        await user.click(screen.getByRole('button', { name: /create source/i }));

        await waitFor(() => {
            expect(createSource).toHaveBeenCalledWith({
                treeId,
                title: 'Birth Register',
                author: undefined,
                url: undefined,
                notes: undefined,
                claimId,
            });
        });
    });
});
