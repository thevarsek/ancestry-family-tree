import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { PedigreeChart } from './PedigreeChart';
import { describe, expect, it } from 'vitest';

const treeId = 'tree_1' as Id<"trees">;
const userId = 'user_1' as Id<"users">;
const now = Date.now();

const createPerson = (id: string, givenNames: string): Doc<"people"> => ({
    _id: id as Id<"people">,
    _creationTime: now,
    treeId,
    givenNames,
    surnames: 'Tester',
    isLiving: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
});

const createRelationship = (
    id: string,
    type: Doc<"relationships">['type'],
    personId1: Id<"people">,
    personId2: Id<"people">
): Doc<"relationships"> => ({
    _id: id as Id<"relationships">,
    _creationTime: now,
    treeId,
    type,
    personId1,
    personId2,
    createdBy: userId,
    createdAt: now
});

const LocationDisplay = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
};

describe('PedigreeChart', () => {
    it('renders only spouse and parent-child links', () => {
        const parent = createPerson('person_parent', 'Parent');
        const root = createPerson('person_root', 'Root');
        const sibling = createPerson('person_sibling', 'Sibling');
        const spouse = createPerson('person_spouse', 'Spouse');

        const relationships: Doc<"relationships">[] = [
            createRelationship('rel_parent_root', 'parent_child', parent._id, root._id),
            createRelationship('rel_parent_sibling', 'parent_child', parent._id, sibling._id),
            createRelationship('rel_spouse', 'spouse', parent._id, spouse._id),
            createRelationship('rel_sibling', 'sibling', root._id, sibling._id)
        ];

        const { container } = render(
            <MemoryRouter>
                <PedigreeChart
                    treeId={treeId}
                    people={[parent, root, sibling, spouse]}
                    relationships={relationships}
                    rootPersonId={root._id}
                />
            </MemoryRouter>
        );

        const paths = container.querySelectorAll('svg path');
        expect(paths).toHaveLength(5);
    });

    it('pans the scroll container when dragged', () => {
        const root = createPerson('person_root', 'Root');

        const { container } = render(
            <MemoryRouter>
                <PedigreeChart
                    treeId={treeId}
                    people={[root]}
                    relationships={[]}
                    rootPersonId={root._id}
                />
            </MemoryRouter>
        );

        const scrollContainer = container.querySelector('[data-testid="pedigree-chart-scroll"]');
        expect(scrollContainer).not.toBeNull();
        const element = scrollContainer as HTMLDivElement;

        fireEvent.pointerDown(element, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
        fireEvent.pointerMove(element, { pointerId: 1, clientX: 40, clientY: 60 });
        fireEvent.pointerUp(element, { pointerId: 1, clientX: 40, clientY: 60 });

        expect(element.scrollLeft).toBe(60);
        expect(element.scrollTop).toBe(40);
    });

    it('navigates to the person detail route on node click', async () => {
        const root = createPerson('person_root', 'Root');
        const user = userEvent.setup();

        const { container } = render(
            <MemoryRouter initialEntries={[`/tree/${treeId}`]}>
                <Routes>
                    <Route
                        path="/tree/:treeId"
                        element={
                            <>
                                <PedigreeChart
                                    treeId={treeId}
                                    people={[root]}
                                    relationships={[]}
                                    rootPersonId={root._id}
                                />
                                <LocationDisplay />
                            </>
                        }
                    />
                    <Route path="/tree/:treeId/person/:personId" element={<LocationDisplay />} />
                </Routes>
            </MemoryRouter>
        );

        const node = container.querySelector(`g[data-person-id="${root._id}"]`);
        expect(node).not.toBeNull();
        await user.click(node as SVGElement);

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent(`/tree/${treeId}/person/${root._id}`);
        });
    });
});
