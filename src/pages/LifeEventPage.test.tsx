import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { LifeEventPage } from './LifeEventPage';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;
const claimId = 'claim_1' as Id<'claims'>;

const place: Doc<'places'> = {
    _id: 'place_1' as Id<'places'>,
    _creationTime: 0,
    treeId,
    displayName: 'London, England',
    city: 'London',
    country: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
};

const source: Doc<'sources'> = {
    _id: 'source_1' as Id<'sources'>,
    _creationTime: 0,
    treeId,
    title: 'Birth Register',
    author: 'Registrar',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
};

const claim: Doc<'claims'> & { place?: Doc<'places'>; sources?: Doc<'sources'>[] } = {
    _id: claimId,
    _creationTime: 0,
    treeId,
    subjectType: 'person',
    subjectId: personId,
    claimType: 'birth',
    value: {
        date: '1815',
        datePrecision: 'year',
        placeId: place._id,
        description: 'Born at home.',
    },
    status: 'accepted',
    confidence: 'high',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    updatedAt: 0,
    place,
    sources: [source],
};

const priorClaim: Doc<'claims'> = {
    _id: 'claim_0' as Id<'claims'>,
    _creationTime: 0,
    treeId,
    subjectType: 'person',
    subjectId: personId,
    claimType: 'custom',
    value: {
        date: '1814',
        datePrecision: 'year',
        customFields: { title: 'Family move' },
    },
    status: 'accepted',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    updatedAt: 0,
};

const nextClaim: Doc<'claims'> = {
    _id: 'claim_2' as Id<'claims'>,
    _creationTime: 0,
    treeId,
    subjectType: 'person',
    subjectId: personId,
    claimType: 'education',
    value: {
        date: '1830',
        datePrecision: 'year',
    },
    status: 'accepted',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    updatedAt: 0,
};

const person: Doc<'people'> & { claims: Array<typeof claim | Doc<'claims'>> } = {
    _id: personId,
    _creationTime: 0,
    treeId,
    givenNames: 'Ada',
    surnames: 'Lovelace',
    preferredName: undefined,
    gender: 'female',
    isLiving: false,
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    updatedAt: 0,
    claims: [priorClaim, claim, nextClaim],
};

const media: Array<Doc<'media'> & { storageUrl?: string }> = [
    {
        _id: 'media_1' as Id<'media'>,
        _creationTime: 0,
        treeId,
        ownerPersonId: personId,
        storageKind: 'external_link',
        canonicalUrl: 'https://example.com/photo.jpg',
        type: 'photo',
        title: 'Portrait',
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
        storageUrl: 'https://example.com/photo.jpg',
    },
];

const removeClaim = vi.fn();
const removeClaimMutation = removeClaim as unknown as ReturnType<typeof useMutation>;

describe('LifeEventPage', () => {
    beforeEach(() => {
        let queryCall = 0;
        const queryResults = [person, claim, media];

        vi.mocked(useQuery).mockImplementation(() => {
            const result = queryResults[queryCall % queryResults.length];
            queryCall += 1;
            return result;
        });

        vi.mocked(useMutation).mockReturnValue(removeClaimMutation);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows event details with sources and timeline links', () => {
        render(
            <MemoryRouter initialEntries={[`/tree/${treeId}/person/${personId}/event/${claimId}`]}>
                <Routes>
                    <Route
                        path="/tree/:treeId/person/:personId/event/:claimId"
                        element={<LifeEventPage />}
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: /birth/i })).toBeInTheDocument();
        expect(screen.getByText('Birth Register')).toBeInTheDocument();
        expect(screen.getByText('Previous', { selector: 'div' })).toBeInTheDocument();
        expect(screen.getByText('Next', { selector: 'div' })).toBeInTheDocument();
    });
});
