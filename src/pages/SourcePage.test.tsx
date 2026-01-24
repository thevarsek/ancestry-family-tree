import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from 'convex/react';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { SourcePage } from './SourcePage';
import { ToastProvider } from '../components/ui/Toast';

vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const treeId = 'tree_1' as Id<'trees'>;
const personId = 'person_1' as Id<'people'>;
const sourceId = 'source_1' as Id<'sources'>;
const claimId = 'claim_1' as Id<'claims'>;

const person: Doc<'people'> = {
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
};

const claim: Doc<'claims'> & { person?: Doc<'people'> } = {
    _id: claimId,
    _creationTime: 0,
    treeId,
    subjectType: 'person',
    subjectId: personId,
    claimType: 'marriage',
    value: {
        date: '1835',
        datePrecision: 'year',
    },
    status: 'accepted',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    updatedAt: 0,
    person,
};

const source: Doc<'sources'> & { claims: Array<typeof claim> } = {
    _id: sourceId,
    _creationTime: 0,
    treeId,
    title: 'Marriage Certificate',
    author: 'Clerk Office',
    url: 'https://example.com/certificate',
    notes: 'Certified copy',
    createdBy: 'user_1' as Id<'users'>,
    createdAt: 0,
    claims: [claim],
};

const media: Array<Doc<'media'> & { storageUrl?: string }> = [
    {
        _id: 'media_1' as Id<'media'>,
        _creationTime: 0,
        treeId,
        ownerPersonId: personId,
        storageKind: 'external_link',
        canonicalUrl: 'https://example.com/certificate.jpg',
        type: 'photo',
        title: 'Certificate Scan',
        createdBy: 'user_1' as Id<'users'>,
        createdAt: 0,
        storageUrl: 'https://example.com/certificate.jpg',
    },
];

const removeSource = vi.fn();
const removeSourceMutation = removeSource as unknown as ReturnType<typeof useMutation>;

describe('SourcePage', () => {
    beforeEach(() => {
        let queryCall = 0;
        const queryResults = [source, person, media];

        vi.mocked(useQuery).mockImplementation(() => {
            const result = queryResults[queryCall % queryResults.length];
            queryCall += 1;
            return result;
        });

        vi.mocked(useMutation).mockReturnValue(removeSourceMutation);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders source details with linked events', () => {
        render(
            <ToastProvider>
                <MemoryRouter initialEntries={[`/tree/${treeId}/person/${personId}/source/${sourceId}`]}>
                    <Routes>
                        <Route
                            path="/tree/:treeId/person/:personId/source/:sourceId"
                            element={<SourcePage />}
                        />
                    </Routes>
                </MemoryRouter>
            </ToastProvider>
        );

        expect(screen.getByRole('heading', { name: /marriage certificate/i })).toBeInTheDocument();
        expect(screen.getByText(/linked events/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /marriage/i })).toBeInTheDocument();
    });
});
