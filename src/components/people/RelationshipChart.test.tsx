import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { RelationshipChart } from './RelationshipChart';

const treeId = 'tree_1' as Id<'trees'>;
const userId = 'user_1' as Id<'users'>;
const now = Date.now();

const makePerson = (id: string, givenNames: string, surnames: string): Doc<'people'> => ({
    _id: id as Id<'people'>,
    _creationTime: now,
    treeId,
    givenNames,
    surnames,
    isLiving: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
});

const makeRelationship = (
    id: string,
    type: Doc<'relationships'>['type'],
    personId1: Id<'people'>,
    personId2: Id<'people'>
): Doc<'relationships'> => ({
    _id: id as Id<'relationships'>,
    _creationTime: now,
    treeId,
    type,
    personId1,
    personId2,
    createdBy: userId,
    createdAt: now,
});

describe('RelationshipChart', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders relationship nodes for each group', () => {
        const center = makePerson('person_center', 'Ada', 'Lovelace');
        const parent = makePerson('person_parent', 'Byron', 'Lovelace');
        const spouse = makePerson('person_spouse', 'Charles', 'Babbage');
        const sibling = makePerson('person_sibling', 'Ann', 'Lovelace');
        const child = makePerson('person_child', 'Ada', 'King');

        render(
            <MemoryRouter>
                <RelationshipChart
                    person={center}
                    relationships={{
                        parents: [
                            {
                                relationship: makeRelationship('rel_parent', 'parent_child', parent._id, center._id),
                                person: parent,
                            },
                        ],
                        spouses: [
                            {
                                relationship: makeRelationship('rel_spouse', 'spouse', center._id, spouse._id),
                                person: spouse,
                            },
                        ],
                        siblings: [
                            {
                                relationship: makeRelationship('rel_sibling', 'sibling', center._id, sibling._id),
                                person: sibling,
                            },
                        ],
                        children: [
                            {
                                relationship: makeRelationship('rel_child', 'parent_child', center._id, child._id),
                                person: child,
                            },
                        ],
                    }}
                    getRelationshipPhoto={() => undefined}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('Relationship Map')).toBeInTheDocument();
        expect(screen.getByText('Parents')).toBeInTheDocument();
        expect(screen.getByText('Siblings')).toBeInTheDocument();
        expect(screen.getByText('Partners')).toBeInTheDocument();
        expect(screen.getByText('Children')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Byron Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Charles Babbage')).toBeInTheDocument();
        expect(screen.getByText('Ann Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Ada King')).toBeInTheDocument();
    });

    it('renders an empty state when no relationships exist', () => {
        const center = makePerson('person_center', 'Ada', 'Lovelace');

        render(
            <MemoryRouter>
                <RelationshipChart
                    person={center}
                    relationships={{
                        parents: [],
                        spouses: [],
                        siblings: [],
                        children: [],
                    }}
                    getRelationshipPhoto={() => undefined}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('No relationships recorded yet.')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('labels the middle row as selected when no siblings exist', () => {
        const center = makePerson('person_center', 'Ada', 'Lovelace');
        const spouse = makePerson('person_spouse', 'Charles', 'Babbage');

        render(
            <MemoryRouter>
                <RelationshipChart
                    person={center}
                    relationships={{
                        parents: [],
                        spouses: [
                            {
                                relationship: makeRelationship('rel_spouse', 'spouse', center._id, spouse._id),
                                person: spouse,
                            },
                        ],
                        siblings: [],
                        children: [],
                    }}
                    getRelationshipPhoto={() => undefined}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('Selected')).toBeInTheDocument();
        expect(screen.getByText('Partners')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Charles Babbage')).toBeInTheDocument();
    });
});
