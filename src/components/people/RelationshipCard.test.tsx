import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { RelationshipCard } from './RelationshipCard';

const treeId = 'tree_1' as Id<'trees'>;
const userId = 'user_1' as Id<'users'>;
const now = Date.now();

describe('RelationshipCard', () => {
    it('renders a profile photo when provided', () => {
        const person: Doc<'people'> = {
            _id: 'person_1' as Id<'people'>,
            _creationTime: now,
            treeId,
            givenNames: 'Ada',
            surnames: 'Lovelace',
            isLiving: true,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        };

        const relationship: Doc<'relationships'> = {
            _id: 'relationship_1' as Id<'relationships'>,
            _creationTime: now,
            treeId,
            type: 'spouse',
            personId1: person._id,
            personId2: 'person_2' as Id<'people'>,
            createdBy: userId,
            createdAt: now,
        };

        render(
            <MemoryRouter>
                <RelationshipCard
                    relationship={relationship}
                    person={person}
                    profilePhoto={{
                        storageUrl: 'https://photos.local/profile.jpg',
                        zoomLevel: 1.5,
                        focusX: 0.25,
                        focusY: 0.75,
                    }}
                />
            </MemoryRouter>
        );

        expect(screen.getByAltText('Ada Lovelace')).toBeInTheDocument();
    });
});
