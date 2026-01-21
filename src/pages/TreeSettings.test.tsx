import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { TreeSettings } from './TreeSettings';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useAction: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const ownerId = 'user_owner' as Id<'users'>;
const memberId = 'user_member' as Id<'users'>;

const baseTree = {
    _id: treeId,
    _creationTime: 0,
    name: 'My Tree',
    description: 'Family history',
    createdBy: ownerId,
    createdAt: 0,
} satisfies Doc<'trees'>;

const members = [
    {
        userId: memberId,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: undefined,
        role: 'user' as const,
        joinedAt: 0,
    },
];

const invitations: Doc<'invitations'>[] = [];

const updateTree = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn().mockResolvedValue('membership_1');
const inviteMember = vi.fn().mockResolvedValue({ invitationId: 'inv_1', token: 'token_1' });
const cancelInvitation = vi.fn().mockResolvedValue(treeId);

const updateTreeMutation = updateTree as unknown as ReturnType<typeof useMutation>;
const updateMemberRoleMutation = updateMemberRole as unknown as ReturnType<typeof useMutation>;
const removeMemberMutation = removeMember as unknown as ReturnType<typeof useMutation>;
const inviteMemberAction = inviteMember as unknown as ReturnType<typeof useAction>;
const cancelInvitationAction = cancelInvitation as unknown as ReturnType<typeof useAction>;

const renderTreeSettings = () => {
    render(
        <MemoryRouter initialEntries={[`/tree/${treeId}/settings`]}>
            <Routes>
                <Route path="/tree/:treeId/settings" element={<TreeSettings />} />
            </Routes>
        </MemoryRouter>
    );
};

describe('TreeSettings', () => {
    beforeEach(() => {
        let queryCall = 0;
        const queryResults = [
            { ...baseTree, role: 'admin' as const },
            members,
            invitations,
        ];

        vi.mocked(useQuery).mockImplementation((...args) => {
            const queryArgs = args[1];
            if (queryArgs === 'skip') {
                return undefined;
            }

            const result = queryResults[queryCall % queryResults.length];
            queryCall += 1;
            return result;
        });

        let mutationCall = 0;
        const mutationResults = [
            updateTreeMutation,
            updateMemberRoleMutation,
            removeMemberMutation,
        ];

        vi.mocked(useMutation).mockImplementation(() => {
            const result = mutationResults[mutationCall % mutationResults.length];
            mutationCall += 1;
            return result;
        });

        let actionCall = 0;
        const actionResults = [inviteMemberAction, cancelInvitationAction];

        vi.mocked(useAction).mockImplementation(() => {
            const result = actionResults[actionCall % actionResults.length];
            actionCall += 1;
            return result;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('confirms member removal before deleting', async () => {
        const user = userEvent.setup();

        renderTreeSettings();

        await user.click(screen.getByRole('button', { name: 'Remove' }));
        expect(screen.getByRole('heading', { name: 'Remove Member' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove Member' }));

        await waitFor(() => {
            expect(removeMember).toHaveBeenCalledWith({
                treeId,
                userId: memberId,
            });
        });
    });

    it('skips invitation queries for non-admin users', () => {
        let queryCall = 0;
        const nonAdminTree = { ...baseTree, role: 'user' as const };

        vi.mocked(useQuery).mockImplementation((...args) => {
            const queryArgs = args[1];
            if (queryArgs === 'skip') {
                return undefined;
            }

            const results = [nonAdminTree, members];
            const result = results[queryCall % results.length];
            queryCall += 1;
            return result;
        });

        renderTreeSettings();

        expect(vi.mocked(useQuery).mock.calls[2][1]).toBe('skip');
    });

    it('sends invites through the Clerk-backed action', async () => {
        const user = userEvent.setup();

        renderTreeSettings();

        const emailInputs = screen.getAllByPlaceholderText(/user@example.com/i);
        await user.type(emailInputs[emailInputs.length - 1], 'newuser@example.com');
        const inviteButtons = screen.getAllByRole('button', { name: /send invitation/i });
        await user.click(inviteButtons[inviteButtons.length - 1]);

        await waitFor(() => {
            expect(inviteMember).toHaveBeenCalledWith({
                treeId,
                email: 'newuser@example.com',
                role: 'user',
            });
        });
    });
});
