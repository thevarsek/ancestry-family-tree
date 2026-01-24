import { render, screen, cleanup } from '@testing-library/react';
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
        cleanup();
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

        expect(screen.getByRole('heading', { name: 'Add Relationship' })).toBeInTheDocument();
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

        // Use getAllByText since relationship types appear as both button labels and step content
        expect(screen.getAllByText('Parent').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Child').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Spouse').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Sibling').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Partner').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Half Sibling').length).toBeGreaterThan(0);
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

        // Use getAllByText since the name appears multiple times in the modal
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
    });
});
