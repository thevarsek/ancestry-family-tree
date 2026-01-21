import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import { AddRelationshipModal } from './AddRelationshipModal';
import { Doc, Id } from '../../../convex/_generated/dataModel';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const currentPersonId = 'person_current' as Id<'people'>;
const people: Doc<'people'>[] = [
    {
        _id: 'person_1' as Id<'people'>,
        _creationTime: 0,
        treeId,
        givenNames: 'Jane',
        surnames: 'Doe',
        isLiving: true,
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
        updatedAt: 0,
    },
    {
        _id: 'person_2' as Id<'people'>,
        _creationTime: 0,
        treeId,
        givenNames: 'John',
        surnames: 'Doe',
        isLiving: true,
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
        updatedAt: 0,
    },
];

const createRelationship = vi.fn().mockResolvedValue('relationship_1');
const mockMutation = createRelationship as unknown as ReturnType<typeof useMutation>;

describe('AddRelationshipModal', () => {
    beforeEach(() => {
        vi.mocked(useQuery).mockReturnValue(people);
        vi.mocked(useMutation).mockReturnValue(mockMutation);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('creates relationships for multiple selected people', async () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        const user = userEvent.setup();

        render(
            <AddRelationshipModal
                treeId={treeId}
                personId={currentPersonId}
                personName="Alex Smith"
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );

        await user.click(screen.getAllByRole('button', { name: /parent/i })[0]);
        await user.click(screen.getByRole('button', { name: /next: select person/i }));

        await user.click(screen.getByText('Jane Doe'));
        await user.click(screen.getByText('John Doe'));
        await user.click(screen.getByRole('button', { name: /add relationships/i }));

        await waitFor(() => {
            expect(createRelationship).toHaveBeenCalledTimes(2);
        });

        expect(createRelationship).toHaveBeenCalledWith({
            treeId,
            personId1: people[0]._id,
            personId2: currentPersonId,
            type: 'parent_child',
            status: undefined,
        });

        expect(createRelationship).toHaveBeenCalledWith({
            treeId,
            personId1: people[1]._id,
            personId2: currentPersonId,
            type: 'parent_child',
            status: undefined,
        });

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
