import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
});
