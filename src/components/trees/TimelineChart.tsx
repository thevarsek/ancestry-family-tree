import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { usePanZoom } from '../../hooks/usePanZoom';
import { exportSvgChart, type ChartExportFormat } from './chartExport';
import {
    buildTimelineLayout,
    getFocusedConnections,
    yearToX,
    generateTimeTicks,
    type PersonWithDates,
    type LifeEventClaim,
} from './timelineLayout';
import {
    EVENT_ROW_HEIGHT,
    PERSON_ROW_HEIGHT,
    EVENT_SECTION_MIN_HEIGHT,
    AXIS_HEIGHT,
    LEGEND_HEIGHT,
    PADDING_X,
    buildExportFileName,
    type TooltipState,
} from './timelineConstants';
import {
    TimeAxis,
    TimelineLegend,
    SectionLabels,
    SectionDivider,
    TimeGrid,
} from './TimelineChartElements';
import { TimelineEventBar } from './TimelineEventBar';
import { TimelinePersonBar } from './TimelinePersonBar';
import { TimelineFocusConnections } from './TimelineFocusConnections';

interface TimelineChartProps {
    treeId: Id<"trees">;
    lifeEvents: LifeEventClaim[];
    people: PersonWithDates[];
    relationships: Doc<"relationships">[];
    // Filter state controlled by parent
    visibleEventTypes: Set<string>;
    visiblePersonIds: Set<Id<"people">>;
    focusedPersonId: Id<"people"> | null;
    height?: number | string;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

export function TimelineChart({
    treeId,
    lifeEvents,
    people,
    relationships,
    visibleEventTypes,
    visiblePersonIds,
    focusedPersonId,
    height = 600,
    isFullscreen = false,
    onToggleFullscreen,
}: TimelineChartProps) {
    const navigate = useNavigate();
    const svgRef = useRef<SVGSVGElement | null>(null);
    
    // Tooltip state
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    // Build layout
    const layout = useMemo(() => buildTimelineLayout({
        lifeEvents,
        people,
        relationships,
        visibleEventTypes,
        visiblePersonIds,
    }), [lifeEvents, people, relationships, visibleEventTypes, visiblePersonIds]);

    // Get focus connections
    const focusConnections = useMemo(() => 
        getFocusedConnections(focusedPersonId, relationships),
        [focusedPersonId, relationships]
    );

    // Calculate dimensions
    const eventSectionHeight = Math.max(
        EVENT_SECTION_MIN_HEIGHT,
        layout.eventRowCount * EVENT_ROW_HEIGHT + 20
    );
    const personSectionHeight = layout.personRowCount * PERSON_ROW_HEIGHT + 20;
    const totalContentHeight = eventSectionHeight + personSectionHeight + AXIS_HEIGHT + LEGEND_HEIGHT;
    
    // Base chart width (before zoom)
    const chartWidth = Math.max(800, (layout.maxYear - layout.minYear) * 8);

    // Pan/zoom via shared hook
    const {
        scale,
        containerRef,
        containerProps,
        svgStyle,
        scaledWidth,
        scaledHeight,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        fit: handleFit,
        centerOn,
        wasRecentlyPanning,
    } = usePanZoom({
        contentWidth: chartWidth,
        contentHeight: totalContentHeight,
        minScale: 0.5,
        maxScale: 3.0,
        fitPadding: 40,
    });

    // Time ticks
    const timeTicks = useMemo(() => 
        generateTimeTicks(layout.minYear, layout.maxYear, 15),
        [layout.minYear, layout.maxYear]
    );

    // Center on current year
    const handleCenter = () => {
        const currentYear = new Date().getFullYear();
        const targetX = yearToX(currentYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
        centerOn(targetX, totalContentHeight / 2);
    };

    // Click handlers
    const handlePersonClick = (personId: Id<"people">) => {
        if (wasRecentlyPanning()) return;
        navigate(`/tree/${treeId}/person/${personId}`);
    };

    // Export handler
    const handleExport = async (format: ChartExportFormat) => {
        if (!svgRef.current) return;
        const exportScale = Math.max(scale, 1);
        await exportSvgChart(format, {
            svg: svgRef.current,
            fileName: buildExportFileName('timeline-chart'),
            width: chartWidth,
            height: totalContentHeight,
            scale: exportScale,
        });
    };

    // Tooltip handlers
    const handleTooltipShow = (newTooltip: TooltipState) => setTooltip(newTooltip);
    const handleTooltipHide = () => setTooltip(null);

    const chartHeight = typeof height === 'number' ? `${height}px` : height;
    // For percentage-based heights (like "100%"), we need flex to properly fill the space
    const useFlexGrow = height === '100%';

    // No data message
    if (layout.people.length === 0 && layout.events.length === 0) {
        return (
            <div className="card p-8 text-center text-muted">
                <p>No timeline data available. Add birth dates to people to see them on the timeline.</p>
            </div>
        );
    }

    // Calculate axis and legend positions
    const axisY = eventSectionHeight + personSectionHeight;
    const legendY = eventSectionHeight + personSectionHeight + AXIS_HEIGHT + 15;

    return (
        <div 
            className="card p-4 flex flex-col" 
            style={{ 
                height: useFlexGrow ? undefined : chartHeight,
                flex: useFlexGrow ? 1 : undefined,
                minHeight: useFlexGrow ? 0 : undefined,
                overflow: 'hidden' 
            }}
        >
            {/* Control bar */}
            <div
                className="flex items-center justify-between mb-3 text-xs text-muted"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
            >
                <span>Drag to pan · Scrollbars for precise moves</span>
                <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('png')}>Export PNG</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('pdf')}>Export PDF</button>
                    {onToggleFullscreen && (
                        <button className="btn btn-secondary btn-sm" onClick={onToggleFullscreen}>
                            {isFullscreen ? 'Exit full screen' : 'Full screen'}
                        </button>
                    )}
                    <span className="text-muted">|</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomOut}>-</button>
                    <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomIn}>+</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleFit}>Fit</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCenter}>Now</button>
                </div>
            </div>

            {/* Chart container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto"
                {...containerProps}
            >
                <div style={{ 
                    width: scaledWidth, 
                    height: scaledHeight, 
                    display: 'inline-block', 
                    overflow: 'hidden' 
                }}>
                    <svg
                        ref={svgRef}
                        width={chartWidth}
                        height={totalContentHeight}
                        style={{ ...svgStyle, overflow: 'visible' }}
                    >
                        {/* Background grid lines */}
                        <TimeGrid
                            timeTicks={timeTicks}
                            minYear={layout.minYear}
                            maxYear={layout.maxYear}
                            chartWidth={chartWidth}
                            height={eventSectionHeight + personSectionHeight}
                        />

                        <SectionLabels
                            eventRowCount={layout.eventRowCount}
                            eventSectionHeight={eventSectionHeight}
                        />
                        <SectionDivider
                            chartWidth={chartWidth}
                            yPosition={eventSectionHeight}
                        />
                        <TimelineFocusConnections
                            focusedPersonId={focusedPersonId}
                            focusConnections={focusConnections}
                            people={layout.people}
                            minYear={layout.minYear}
                            maxYear={layout.maxYear}
                            chartWidth={chartWidth}
                            paddingX={PADDING_X}
                            eventSectionHeight={eventSectionHeight}
                        />

                        <g className="events-section">
                            {layout.events.map(eventBar => (
                                <TimelineEventBar
                                    key={eventBar.id}
                                    eventBar={eventBar}
                                    minYear={layout.minYear}
                                    maxYear={layout.maxYear}
                                    chartWidth={chartWidth}
                                    paddingX={PADDING_X}
                                    onPersonClick={handlePersonClick}
                                    onTooltipShow={handleTooltipShow}
                                    onTooltipHide={handleTooltipHide}
                                />
                            ))}
                        </g>

                        <g className="people-section">
                            {layout.people.map(personBar => (
                                <TimelinePersonBar
                                    key={personBar.id}
                                    personBar={personBar}
                                    minYear={layout.minYear}
                                    maxYear={layout.maxYear}
                                    chartWidth={chartWidth}
                                    paddingX={PADDING_X}
                                    eventSectionHeight={eventSectionHeight}
                                    focusedPersonId={focusedPersonId}
                                    focusConnections={focusConnections}
                                    onPersonClick={handlePersonClick}
                                    onTooltipShow={handleTooltipShow}
                                    onTooltipHide={handleTooltipHide}
                                />
                            ))}
                        </g>

                        <TimeAxis
                            timeTicks={timeTicks}
                            minYear={layout.minYear}
                            maxYear={layout.maxYear}
                            chartWidth={chartWidth}
                            yPosition={axisY}
                        />
                        <TimelineLegend
                            chartWidth={chartWidth}
                            yPosition={legendY}
                            hasFocusedPerson={focusedPersonId !== null}
                        />
                    </svg>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg p-3 max-w-xs"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 10,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    {tooltip.lines.map((line, i) => (
                        <div 
                            key={i} 
                            className={i === 0 ? 'font-semibold text-sm' : 'text-xs text-muted'}
                        >
                            {line}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
