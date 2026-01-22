import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from 'convex/react';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { FanChart } from './FanChart';
import { PedigreeChart } from './PedigreeChart';
import { TimelineChart } from './TimelineChart';
import { FilterableSelect, FilterableMultiSelect, type FilterableOption } from '../ui/FilterableSelect';
import type { PersonWithDates, LifeEventClaim } from './timelineLayout';

// Types for query results
type TreeDataResult = {
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
} | undefined;

type TimelineDataResult = {
    people: PersonWithDates[];
    relationships: Doc<"relationships">[];
    lifeEvents: LifeEventClaim[];
    eventTypes: string[];
} | undefined;

type ProfilePhotoResult = Array<{
    mediaId: Id<"media">;
    storageUrl?: string | null;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
    width?: number;
    height?: number;
}> | undefined;

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
    },
    {
        id: 'timeline',
        label: 'Timeline',
        description: 'Chronological view of life events and people lifespans.'
    }
] as const;

type ChartOptionId = typeof chartOptions[number]['id'];

export function TreeVisualization({ treeId }: { treeId: Id<"trees"> }) {
    const treeData = useQuery(api.people.getTreeData, { treeId }) as TreeDataResult;
    const timelineData = useQuery(api.claims.getTimelineData, { treeId }) as TimelineDataResult;
    const [rootPersonId, setRootPersonId] = useState<Id<"people"> | null>(null);
    const [activeChart, setActiveChart] = useState<ChartOptionId>('family-tree');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Timeline filter state
    const [timelineVisibleEventTypes, setTimelineVisibleEventTypes] = useState<string[]>([]);
    const [timelineVisiblePersonIds, setTimelineVisiblePersonIds] = useState<string[]>([]);
    const [timelineFocusedPersonId, setTimelineFocusedPersonId] = useState<Id<"people"> | null>(null);
    
    // Track if filters have been initialized (to allow user to deselect all)
    const filtersInitializedRef = useRef(false);

    // Get profile photos for all people in the tree
    const profilePhotoIds = treeData?.people
        ?.map((person: Doc<"people">) => person.profilePhotoId)
        .filter((id): id is Id<"media"> => Boolean(id)) ?? [];
    const profilePhotos = useQuery(
        api.media.getUrls,
        profilePhotoIds.length ? { mediaIds: profilePhotoIds } : "skip"
    ) as ProfilePhotoResult;

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

    // Initialize timeline filters when data loads (only once)
    useEffect(() => {
        if (timelineData && !filtersInitializedRef.current) {
            // Initialize with all event types visible
            const eventTypes = timelineData.eventTypes ?? [];
            if (eventTypes.length > 0) {
                setTimelineVisibleEventTypes(eventTypes);
            }
            // Initialize with all people with birth dates visible
            const people = timelineData.people ?? [];
            if (people.length > 0) {
                const peopleWithBirthDates = people
                    .filter((p) => p.birthDate)
                    .map((p) => p._id);
                setTimelineVisiblePersonIds(peopleWithBirthDates);
            }
            // Mark as initialized so user can deselect all without auto-reset
            filtersInitializedRef.current = true;
        }
    }, [timelineData]);

    // Convert filter arrays to Sets for TimelineChart
    const visibleEventTypesSet = useMemo(
        () => new Set(timelineVisibleEventTypes),
        [timelineVisibleEventTypes]
    );
    const visiblePersonIdsSet = useMemo(
        () => new Set(timelineVisiblePersonIds as Id<"people">[]),
        [timelineVisiblePersonIds]
    );

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
            : activeChart === 'timeline'
                ? 'View life events and people lifespans chronologically.'
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

    // Timeline-specific filter options
    const timelineEventTypeOptions: FilterableOption[] = (timelineData?.eventTypes ?? []).map((eventType) => ({
        id: eventType,
        label: eventType.charAt(0).toUpperCase() + eventType.slice(1).replace(/_/g, ' '),
    }));
    const timelinePersonOptions: FilterableOption[] = (timelineData?.people ?? []).map((person) => ({
        id: person._id,
        label: `${person.givenNames} ${person.surnames}`,
        description: person.birthDate ? undefined : 'No birth date',
    }));
    const timelineFocusOptions: FilterableOption[] = (timelineData?.people ?? [])
        .filter((p) => p.birthDate)
        .map((person) => ({
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
            {activeChart === 'timeline' && (
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium whitespace-nowrap">Events:</span>
                        <FilterableMultiSelect
                            label="event types"
                            options={timelineEventTypeOptions}
                            value={timelineVisibleEventTypes}
                            onChange={setTimelineVisibleEventTypes}
                            placeholder="Select events"
                            className="filterable-select-wide"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium whitespace-nowrap">People:</span>
                        <FilterableMultiSelect
                            label="people"
                            options={timelinePersonOptions}
                            value={timelineVisiblePersonIds}
                            onChange={setTimelineVisiblePersonIds}
                            placeholder="Select people"
                            className="filterable-select-wide"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium whitespace-nowrap">Focus on:</span>
                        <FilterableSelect
                            label="focus person"
                            options={timelineFocusOptions}
                            value={timelineFocusedPersonId}
                            onChange={(value) => setTimelineFocusedPersonId(value as Id<"people"> | null)}
                            placeholder="None"
                            className="filterable-select-wide"
                        />
                    </div>
                </div>
            )}
        </div>
    );

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
    ) : activeChart === 'timeline' && timelineData ? (
        <TimelineChart
            treeId={treeId}
            lifeEvents={timelineData.lifeEvents as LifeEventClaim[]}
            people={timelineData.people as PersonWithDates[]}
            relationships={timelineData.relationships}
            visibleEventTypes={visibleEventTypesSet}
            visiblePersonIds={visiblePersonIdsSet}
            focusedPersonId={timelineFocusedPersonId}
            onToggleFullscreen={() => setIsFullscreen(true)}
        />
    ) : null;

    return (
        <>
            {/* Hide background content when fullscreen to prevent event conflicts */}
            <div className="space-y-6" style={isFullscreen ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>
                {renderChartControls()}
                {chartBody}
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
                        <div className="modal-body" style={{ flex: 1, maxHeight: 'none', overflow: 'hidden', padding: 0, minHeight: 0 }}>
                            <div className="flex flex-col gap-4 p-6" style={{ height: '100%' }}>
                                {renderChartControls()}
                                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                                    {activeChart === 'timeline' && timelineData && (
                                        <TimelineChart
                                            treeId={treeId}
                                            lifeEvents={timelineData.lifeEvents as LifeEventClaim[]}
                                            people={timelineData.people as PersonWithDates[]}
                                            relationships={timelineData.relationships}
                                            visibleEventTypes={visibleEventTypesSet}
                                            visiblePersonIds={visiblePersonIdsSet}
                                            focusedPersonId={timelineFocusedPersonId}
                                            height="100%"
                                            isFullscreen
                                            onToggleFullscreen={() => setIsFullscreen(false)}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
