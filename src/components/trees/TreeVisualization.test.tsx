import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { TreeVisualization } from './TreeVisualization';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const userId = 'user_1' as Id<'users'>;
const now = Date.now();

const person = {
    _id: 'person_1' as Id<'people'>,
    _creationTime: now,
    treeId,
    givenNames: 'Ada',
    surnames: 'Lovelace',
    isLiving: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
} satisfies Doc<'people'>;

const treeData = {
    people: [person],
    relationships: [] as Doc<'relationships'>[],
};

const timelineData = {
    people: [person],
    relationships: [] as Doc<'relationships'>[],
    lifeEvents: [],
    eventTypes: [],
};

describe('TreeVisualization', () => {
    beforeEach(() => {
        // Track which call we're on to return appropriate data
        // Component calls: 1) getTreeData, 2) getTimelineData, 3) getUrls (skipped)
        let callCount = 0;
        (vi.mocked(useQuery) as ReturnType<typeof vi.fn>).mockImplementation((_queryFn, args) => {
            callCount++;
            if (args === 'skip') {
                return undefined;
            }
            if (args && typeof args === 'object' && 'mediaIds' in args) {
                return [];
            }
            // First call is getTreeData, second is getTimelineData
            if (callCount === 2) {
                return timelineData;
            }
            return treeData;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows the chart selector and focus options', async () => {
        render(
            <MemoryRouter>
                <TreeVisualization treeId={treeId} />
            </MemoryRouter>
        );

        const chartTypeButton = await screen.findByRole('button', { name: /select chart type/i });
        const focusButton = await screen.findByRole('button', { name: /select focus person/i });

        expect(chartTypeButton).toHaveTextContent('Family Tree');
        expect(focusButton).toHaveTextContent('Ada Lovelace');
    });

    it('opens the fullscreen chart modal', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <TreeVisualization treeId={treeId} />
            </MemoryRouter>
        );

        const fullScreenButtons = await screen.findAllByRole('button', { name: 'Full screen' });
        await user.click(fullScreenButtons[0]);
        expect(screen.getAllByRole('heading', { name: 'Family Tree Chart' })[0]).toBeInTheDocument();

        const exitButtons = await screen.findAllByRole('button', { name: 'Exit full screen' });
        await user.click(exitButtons[0]);
        expect(screen.queryByRole('heading', { name: 'Family Tree Chart' })).not.toBeInTheDocument();
    });
});
