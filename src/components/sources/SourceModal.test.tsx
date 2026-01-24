import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { SourceModal } from './SourceModal';
import { ToastProvider } from '../ui/Toast';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const claimId = 'claim_1' as Id<'claims'>;
const userId = 'user_1' as Id<'users'>;
const sourceId = 'source_1' as Id<'sources'>;

const claim: Doc<'claims'> & { personName: string | null } = {
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
    personName: 'John Doe',
};

const createSource = vi.fn().mockResolvedValue(sourceId);
const updateSource = vi.fn().mockResolvedValue(undefined);
const addSourceToClaim = vi.fn().mockResolvedValue(undefined);
const removeSourceFromClaim = vi.fn().mockResolvedValue(undefined);
const updateMediaLinks = vi.fn().mockResolvedValue(undefined);

describe('SourceModal', () => {
    beforeEach(() => {
        // Mock queries: claims returns claims, media returns empty array
        vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
            // Check query name to return appropriate data
            const queryName = String(args[0]);
            if (queryName.includes('claims')) {
                return [claim];
            }
            // Media query returns empty array (no media items)
            return [];
        });

        // Mock mutations in order they're declared
        let mutationCall = 0;
        const mutations = [
            createSource,
            updateSource,
            addSourceToClaim,
            removeSourceFromClaim,
            updateMediaLinks,
        ];
        vi.mocked(useMutation).mockImplementation(() => {
            const result = mutations[mutationCall % mutations.length];
            mutationCall += 1;
            return result as unknown as ReturnType<typeof useMutation>;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the wizard modal with steps', () => {
        render(
            <ToastProvider>
                <SourceModal
                    treeId={treeId}
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Add Source')).toBeInTheDocument();
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
        expect(screen.getByText('Life Events')).toBeInTheDocument();
        expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('creates a source with basic info', async () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        const user = userEvent.setup();

        render(
            <ToastProvider>
                <SourceModal
                    treeId={treeId}
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </ToastProvider>
        );

        // Fill in title
        await user.type(
            screen.getByPlaceholderText('e.g. 1920 US Census, Birth Certificate, etc.'),
            'Birth Certificate'
        );

        // Click Save & Close
        await user.click(screen.getByRole('button', { name: /save & close/i }));

        await waitFor(() => {
            expect(createSource).toHaveBeenCalledWith({
                treeId,
                title: 'Birth Certificate',
                author: undefined,
                url: undefined,
                notes: undefined,
            });
        });
    });

    it('shows edit mode when initialSource is provided', () => {
        const source: Doc<'sources'> = {
            _id: sourceId,
            _creationTime: 0,
            treeId,
            title: 'Existing Source',
            author: 'Author Name',
            createdBy: userId,
            createdAt: 0,
        };

        render(
            <ToastProvider>
                <SourceModal
                    treeId={treeId}
                    initialSource={source}
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Edit Source')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing Source')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Author Name')).toBeInTheDocument();
    });
});
