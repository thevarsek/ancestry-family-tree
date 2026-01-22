import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { FanChart } from './FanChart';
import { PedigreeChart } from './PedigreeChart';
import { FilterableSelect, type FilterableOption } from '../ui/FilterableSelect';

const chartOptions = [
    {
        id: 'family-tree',
        label: 'Family Tree',
        description: 'Explore ancestry and descendants for a single person.'
    },
    {
        id: 'fan-chart',
        label: 'Radial Fan',
        description: 'Fan layout to reveal lineage patterns without overlap.'
    }
] as const;

type ChartOptionId = typeof chartOptions[number]['id'];

export function TreeVisualization({ treeId }: { treeId: Id<"trees"> }) {
    const treeData = useQuery(api.people.getTreeData, { treeId });
    const [rootPersonId, setRootPersonId] = useState<Id<"people"> | null>(null);
    const [activeChart, setActiveChart] = useState<ChartOptionId>('family-tree');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Get profile photos for all people in the tree
    const profilePhotoIds = treeData?.people
        ?.map((person) => person.profilePhotoId)
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
    const chartConfig = chartOptions.find((option) => option.id === activeChart) ?? chartOptions[0];
    const chartDescription = activeChart === 'family-tree'
        ? `Viewing ancestry and descendants for ${currentPerson ? `${currentPerson.givenNames} ${currentPerson.surnames}` : 'selected person'}.`
        : activeChart === 'fan-chart'
            ? `Radial view focused on ${currentPerson ? `${currentPerson.givenNames} ${currentPerson.surnames}` : 'selected person'}.`
            : chartConfig.description;

    // Create profile photo map
    const profilePhotoMap = new Map(
        (profilePhotos ?? []).map((item) => [item.mediaId, item])
    );

    // Combine people data with profile photos
    const peopleWithPhotos = treeData.people.map((person) => {
        const photo = person.profilePhotoId ? profilePhotoMap.get(person.profilePhotoId) : undefined;
        return {
            ...person,
            profilePhotoUrl: photo?.storageUrl ?? undefined,
            profilePhotoZoom: photo?.zoomLevel,
            profilePhotoFocusX: photo?.focusX,
            profilePhotoFocusY: photo?.focusY,
            profilePhotoWidth: photo?.width,
            profilePhotoHeight: photo?.height,
        };
    });

    const chartTypeOptions: FilterableOption[] = chartOptions.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
    }));
    const personOptions: FilterableOption[] = treeData.people.map((person) => ({
        id: person._id,
        label: `${person.givenNames} ${person.surnames}`,
    }));

    const renderChartControls = () => (
        <div className="card p-4 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold">{chartConfig.label}</h3>
                    <p className="text-sm text-muted">{chartDescription}</p>
                </div>
                <div className="chart-controls-row">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium whitespace-nowrap">Chart type:</span>
                        <FilterableSelect
                            label="chart type"
                            options={chartTypeOptions}
                            value={activeChart}
                            onChange={(value) => setActiveChart(value as ChartOptionId)}
                            placeholder="Select chart"
                            className="filterable-select-wide filterable-select-multiline"
                        />
                    </div>
                    {(activeChart === 'family-tree' || activeChart === 'fan-chart') && (
                        <div className="chart-controls-right">
                            <span className="text-sm font-medium whitespace-nowrap">Focus on:</span>
                            <FilterableSelect
                                label="focus person"
                                options={personOptions}
                                value={rootPersonId}
                                onChange={(value) => setRootPersonId(value as Id<"people">)}
                                placeholder="Select person"
                                className="filterable-select-wide filterable-select-multiline"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const chartLegend = activeChart === 'family-tree' ? (
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
    ) : activeChart === 'fan-chart' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted px-2">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #ad8aff, #ff7c1e)' }}></span>
                <span>Lineage palette by branch</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-8 h-0.5 bg-border"></span>
                <span>Ancestor and descendant rings</span>
            </div>
            <p className="md:text-right">Zoom in for dense rings, click a name to open profile</p>
        </div>
    ) : null;

    const chartBody = rootPersonId && activeChart === 'family-tree' ? (
        <PedigreeChart
            treeId={treeId}
            people={peopleWithPhotos}
            relationships={treeData.relationships}
            rootPersonId={rootPersonId}
            onToggleFullscreen={() => setIsFullscreen(true)}
        />
    ) : rootPersonId && activeChart === 'fan-chart' ? (
        <FanChart
            treeId={treeId}
            people={treeData.people}
            relationships={treeData.relationships}
            rootPersonId={rootPersonId}
            onToggleFullscreen={() => setIsFullscreen(true)}
        />
    ) : null;

    return (
        <>
            <div className="space-y-6">
                {renderChartControls()}
                {chartBody}
                {chartLegend}
            </div>

            {isFullscreen && (
                <>
                    <div className="modal-backdrop" onClick={() => setIsFullscreen(false)} />
                    <div
                        className="modal"
                        style={{
                            maxWidth: 'calc(100vw - 64px)',
                            width: '100%',
                            height: 'calc(100vh - 64px)',
                            maxHeight: 'calc(100vh - 64px)'
                        }}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title">{chartConfig.label} Chart</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setIsFullscreen(false)}>Close</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: 'none', overflow: 'hidden' }}>
                            <div className="flex flex-col gap-4 h-full">
                                {renderChartControls()}
                                <div className="flex-1 min-h-0">
                                    {rootPersonId && activeChart === 'family-tree' && (
                                        <PedigreeChart
                                            treeId={treeId}
                                            people={peopleWithPhotos}
                                            relationships={treeData.relationships}
                                            rootPersonId={rootPersonId}
                                            height="100%"
                                            isFullscreen
                                            onToggleFullscreen={() => setIsFullscreen(false)}
                                        />
                                    )}
                                    {rootPersonId && activeChart === 'fan-chart' && (
                                        <FanChart
                                            treeId={treeId}
                                            people={treeData.people}
                                            relationships={treeData.relationships}
                                            rootPersonId={rootPersonId}
                                            height="100%"
                                            isFullscreen
                                            onToggleFullscreen={() => setIsFullscreen(false)}
                                        />
                                    )}
                                </div>
                                {chartLegend}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
