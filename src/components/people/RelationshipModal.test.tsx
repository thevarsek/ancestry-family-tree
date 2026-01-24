import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { RelationshipModal } from './RelationshipModal';
import { ToastProvider } from '../ui/Toast';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;
const userId = 'user_1' as Id<'users'>;

const person: Doc<'people'> = {
    _id: 'person_2' as Id<'people'>,
    _creationTime: 0,
    treeId,
    givenNames: 'Jane',
    surnames: 'Doe',
    isLiving: true,
    createdBy: userId,
    createdAt: 0,
    updatedAt: 0,
};

const createRelationship = vi.fn().mockResolvedValue('rel_1');

describe('RelationshipModal', () => {
    beforeEach(() => {
        // Mock people query
        vi.mocked(useQuery).mockReturnValue([person]);

        // Mock mutations
        vi.mocked(useMutation).mockReturnValue(createRelationship as unknown as ReturnType<typeof useMutation>);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the wizard modal with steps', () => {
        render(
            <ToastProvider>
                <RelationshipModal
                    treeId={treeId}
                    personId={personId}
                    personName="John Doe"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Add Relationship')).toBeInTheDocument();
        expect(screen.getByText('Relationship Type')).toBeInTheDocument();
        expect(screen.getByText('Select People')).toBeInTheDocument();
    });

    it('shows relationship type options', () => {
        render(
            <ToastProvider>
                <RelationshipModal
                    treeId={treeId}
                    personId={personId}
                    personName="John Doe"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Parent')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
        expect(screen.getByText('Spouse')).toBeInTheDocument();
        expect(screen.getByText('Sibling')).toBeInTheDocument();
        expect(screen.getByText('Partner')).toBeInTheDocument();
        expect(screen.getByText('Half Sibling')).toBeInTheDocument();
    });

    it('displays the person name in context', () => {
        render(
            <ToastProvider>
                <RelationshipModal
                    treeId={treeId}
                    personId={personId}
                    personName="John Doe"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });
});
