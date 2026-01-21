import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { PedigreeChart } from './PedigreeChart';

export function TreeVisualization({ treeId }: { treeId: Id<"trees"> }) {
    const treeData = useQuery(api.people.getTreeData, { treeId });
    const [rootPersonId, setRootPersonId] = useState<Id<"people"> | null>(null);

    // Get profile photos for all people in the tree
    const profilePhotoIds = treeData?.people
        .map((person) => person.profilePhotoId)
        .filter((id): id is Id<"media"> => Boolean(id)) ?? [];
    const profilePhotos = useQuery(
        api.media.getUrls,
        profilePhotoIds.length ? { mediaIds: profilePhotoIds } : "skip"
    );

    // Set initial root person to the first person found or someone with relationships
    useEffect(() => {
        if (treeData && treeData.people.length > 0 && !rootPersonId) {
            // Find someone who is a child (has parents) to show a better initial chart
            const someoneWithParents = treeData.relationships.find(
                (r: Doc<"relationships">) => r.type === 'parent_child'
            )?.personId2;
            setRootPersonId(someoneWithParents || treeData.people[0]._id);
        }
    }, [treeData, rootPersonId]);

    if (treeData === undefined) {
        return (
            <div className="flex justify-center py-20">
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    if (treeData.people.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">🌳</div>
                <h3 className="text-xl font-bold mb-2">No data yet</h3>
                <p className="text-muted max-w-md mx-auto">
                    Add some people and relationships to see your family tree chart here.
                </p>
            </div>
        );
    }

    const currentPerson = treeData.people.find((p: Doc<"people">) => p._id === rootPersonId);

    // Create profile photo map
    const profilePhotoMap = new Map(
        (profilePhotos ?? []).map((item) => [item.mediaId, item.storageUrl ?? undefined])
    );

    // Combine people data with profile photos
    const peopleWithPhotos = treeData.people.map((person) => ({
        ...person,
        profilePhotoUrl: person.profilePhotoId ? profilePhotoMap.get(person.profilePhotoId) : undefined
    }));

    return (
        <div className="space-y-6">
            <div className="card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold">Family Tree</h3>
                    <p className="text-sm text-muted">
                        Viewing ancestry and descendants for {currentPerson ? `${currentPerson.givenNames} ${currentPerson.surnames}` : 'selected person'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap">Focus on:</label>
                    <select
                        className="input text-sm h-9"
                        value={rootPersonId || ''}
                        onChange={(e) => setRootPersonId(e.target.value as Id<"people">)}
                    >
                        {treeData.people.map((p: Doc<"people">) => (
                            <option key={p._id} value={p._id}>
                                {p.givenNames} {p.surnames}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {rootPersonId && (
                <PedigreeChart
                    treeId={treeId}
                    people={peopleWithPhotos}
                    relationships={treeData.relationships}
                    rootPersonId={rootPersonId}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted px-2">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}></span>
                    <span>Selected Person</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-8 h-0.5 bg-border"></span>
                    <span>Direct Lineage</span>
                </div>
                <p className="md:text-right">Drag to pan, click a card to open profile</p>
            </div>
        </div>
    );
}
