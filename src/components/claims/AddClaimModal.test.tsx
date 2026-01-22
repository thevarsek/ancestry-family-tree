import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { AddClaimModal } from './AddClaimModal';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;

const places: Doc<'places'>[] = [
    {
        _id: 'place_1' as Id<'places'>,
        _creationTime: 0,
        treeId,
        displayName: 'Rome, Italy',
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
    },
];

const people: Doc<'people'>[] = [];

const sources: Doc<'sources'>[] = [
    {
        _id: 'source_1' as Id<'sources'>,
        _creationTime: 0,
        treeId,
        title: '1900 Census',
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
    },
];

const createClaim = vi.fn().mockResolvedValue('claim_1');
const updateClaim = vi.fn();
const addSource = vi.fn().mockResolvedValue('link_1');
const removeSource = vi.fn();
const updateMediaLinks = vi.fn();

const createClaimMutation = createClaim as unknown as ReturnType<typeof useMutation>;
const updateClaimMutation = updateClaim as unknown as ReturnType<typeof useMutation>;
const addSourceMutation = addSource as unknown as ReturnType<typeof useMutation>;
const removeSourceMutation = removeSource as unknown as ReturnType<typeof useMutation>;
const updateMediaLinksMutation = updateMediaLinks as unknown as ReturnType<typeof useMutation>;

describe('AddClaimModal', () => {
    beforeEach(() => {
        let queryCall = 0;
        const queryResults = [places, people, sources, [], []];

        vi.mocked(useQuery).mockImplementation(() => {
            const result = queryResults[queryCall % queryResults.length];
            queryCall += 1;
            return result;
        });

        let mutationCall = 0;
        const mutationResults = [
            createClaimMutation,
            updateClaimMutation,
            addSourceMutation,
            removeSourceMutation,
            updateMediaLinksMutation,
        ];

        vi.mocked(useMutation).mockImplementation(() => {
            const result = mutationResults[mutationCall % mutationResults.length];
            mutationCall += 1;
            return result;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('links selected sources when creating a claim', async () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        const user = userEvent.setup();

        render(
            <AddClaimModal
                treeId={treeId}
                subjectId={personId}
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );

        await user.click(screen.getByRole('button', { name: /select sources/i }));
        await user.click(screen.getByRole('button', { name: /1900 census/i }));
        await user.click(screen.getByRole('button', { name: /save fact/i }));

        await waitFor(() => {
            expect(createClaim).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(addSource).toHaveBeenCalledWith({
                claimId: 'claim_1' as Id<'claims'>,
                sourceId: sources[0]._id,
            });
        });
    });

    it('toggles date range inputs for current claims', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        render(
            <AddClaimModal
                treeId={treeId}
                subjectId={personId}
                onClose={onClose}
                defaultClaimType="residence"
            />
        );

        expect(screen.getAllByPlaceholderText('From (YYYY-MM-DD or YYYY)').length).toBeGreaterThan(0);
        expect(screen.getByPlaceholderText('To (YYYY-MM-DD or YYYY)')).toBeInTheDocument();

        await user.click(screen.getByLabelText(/current/i));

        expect(screen.queryByPlaceholderText('To (YYYY-MM-DD or YYYY)')).not.toBeInTheDocument();
    });

    it('shows current date range controls for education claims', () => {
        const onClose = vi.fn();

        render(
            <AddClaimModal
                treeId={treeId}
                subjectId={personId}
                onClose={onClose}
                defaultClaimType="education"
            />
        );

        expect(screen.getAllByLabelText(/current/i).length).toBeGreaterThan(0);
        expect(screen.getAllByPlaceholderText('From (YYYY-MM-DD or YYYY)').length).toBeGreaterThan(0);
    });
});
