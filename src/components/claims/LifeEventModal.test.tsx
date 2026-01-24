import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '../../../convex/_generated/dataModel';
import { LifeEventModal } from './LifeEventModal';
import { ToastProvider } from '../ui/Toast';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;

const createClaim = vi.fn().mockResolvedValue('claim_1');
const updateClaim = vi.fn().mockResolvedValue(undefined);
const addSource = vi.fn().mockResolvedValue(undefined);
const removeSource = vi.fn().mockResolvedValue(undefined);
const updateMediaLinks = vi.fn().mockResolvedValue(undefined);

describe('LifeEventModal', () => {
    beforeEach(() => {
        // Mock queries: places, people, sources, media
        vi.mocked(useQuery).mockImplementation(() => []);

        // Mock mutations
        let mutationCall = 0;
        const mutations = [
            createClaim,
            updateClaim,
            addSource,
            removeSource,
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
                <LifeEventModal
                    treeId={treeId}
                    subjectId={personId}
                    subjectType="person"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Add Life Event')).toBeInTheDocument();
        expect(screen.getByText('Event Type')).toBeInTheDocument();
        expect(screen.getByText('Date & Place')).toBeInTheDocument();
        expect(screen.getByText('Sources & Media')).toBeInTheDocument();
    });

    it('shows event type selector on first step', () => {
        render(
            <ToastProvider>
                <LifeEventModal
                    treeId={treeId}
                    subjectId={personId}
                    subjectType="person"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Event Type *')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Select event type...')).toBeInTheDocument();
    });

    it('shows edit mode when initialClaim is provided', () => {
        const initialClaim = {
            _id: 'claim_1' as Id<'claims'>,
            _creationTime: 0,
            treeId,
            subjectType: 'person' as const,
            subjectId: personId,
            claimType: 'birth' as const,
            value: { date: '1990-01-01' },
            status: 'accepted' as const,
            createdBy: 'user_1' as Id<'users'>,
            createdAt: 0,
            updatedAt: 0,
        };

        render(
            <ToastProvider>
                <LifeEventModal
                    treeId={treeId}
                    subjectId={personId}
                    subjectType="person"
                    initialClaim={initialClaim}
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        expect(screen.getByText('Edit Life Event')).toBeInTheDocument();
    });
});
