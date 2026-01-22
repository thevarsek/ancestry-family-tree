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
    type TimelineEventBar,
    type TimelinePersonBar,
} from './timelineLayout';

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

const EVENT_ROW_HEIGHT = 28;
const PERSON_ROW_HEIGHT = 32;
const BAR_HEIGHT = 20;
const PERSON_BAR_HEIGHT = 24;
const EVENT_SECTION_MIN_HEIGHT = 60;
const AXIS_HEIGHT = 40;
const LEGEND_HEIGHT = 30;
const PADDING_X = 60;
const DESCRIPTION_MAX_CHARS = 50;

// Colors - using fan chart palette style
const EVENT_BAR_COLOR = '#ad8aff'; // Purple from lineage palette
const PERSON_BAR_COLOR = '#18c8d8'; // Teal from lineage palette
const FOCUS_COLOR = '#ff7c1e'; // Orange - focused person
const PARENT_COLOR = '#f6b84a'; // Gold/Yellow - parents
const SPOUSE_COLOR = '#ad8aff'; // Purple - spouse
const CHILD_COLOR = '#8fd1a6'; // Green - children

const buildExportFileName = (value: string) => {
    const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return sanitized.length ? sanitized : 'timeline';
};

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
    const [tooltip, setTooltip] = useState<{
        x: number;
        y: number;
        lines: string[];
    } | null>(null);

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

    // Render functions
    const renderTimeAxis = () => {
        const y = eventSectionHeight + personSectionHeight;
        return (
            <g className="time-axis">
                <line
                    x1={PADDING_X}
                    y1={y}
                    x2={chartWidth - PADDING_X}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                />
                {timeTicks.map(year => {
                    const x = yearToX(year, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
                    return (
                        <g key={year}>
                            <line
                                x1={x}
                                y1={y - 5}
                                x2={x}
                                y2={y + 5}
                                stroke="var(--color-border)"
                                strokeWidth={1}
                            />
                            <text
                                x={x}
                                y={y + 20}
                                textAnchor="middle"
                                fontSize="11"
                                fill="var(--color-text-muted)"
                            >
                                {year}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderEventBar = (eventBar: TimelineEventBar) => {
        const x1 = yearToX(eventBar.startYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
        const x2 = eventBar.endYear !== null
            ? yearToX(eventBar.endYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X)
            : x1 + 10;
        const y = eventBar.row * EVENT_ROW_HEIGHT + 10;
        const width = Math.max(x2 - x1, 10);
        const isPointEvent = eventBar.endYear === null || eventBar.endYear === eventBar.startYear;
        
        const truncatedDesc = eventBar.description
            ? eventBar.description.length > DESCRIPTION_MAX_CHARS
                ? eventBar.description.substring(0, DESCRIPTION_MAX_CHARS) + '...'
                : eventBar.description
            : '';

        // Build tooltip content
        const tooltipLines = [eventBar.title];
        if (eventBar.startYear) {
            const dateStr = eventBar.isOngoing 
                ? `${eventBar.startYear} - present`
                : eventBar.endYear && eventBar.endYear !== eventBar.startYear
                    ? `${eventBar.startYear} - ${eventBar.endYear}`
                    : `${eventBar.startYear}`;
            tooltipLines.push(dateStr);
        }
        if (eventBar.description) {
            tooltipLines.push(eventBar.description);
        }

        return (
            <g
                key={eventBar.id}
                className="event-bar cursor-pointer"
                onClick={() => handlePersonClick(eventBar.personId)}
                onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        lines: tooltipLines,
                    });
                }}
                onMouseLeave={() => setTooltip(null)}
            >
                {isPointEvent ? (
                    <g transform={`translate(${x1}, ${y + BAR_HEIGHT / 2})`}>
                        <polygon
                            points="0,-8 8,0 0,8 -8,0"
                            fill={EVENT_BAR_COLOR}
                        />
                    </g>
                ) : (
                    <rect
                        x={x1}
                        y={y}
                        width={width}
                        height={BAR_HEIGHT}
                        rx={4}
                        fill={EVENT_BAR_COLOR}
                    />
                )}
                <text
                    x={isPointEvent ? x1 + 12 : x1 + 6}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize="11"
                    fontWeight="500"
                    fill="var(--color-text-primary)"
                    style={{ pointerEvents: 'none' }}
                >
                    {eventBar.title}
                    {truncatedDesc && (
                        <tspan fill="var(--color-text-muted)" fontWeight="normal">
                            {' '}- {truncatedDesc}
                        </tspan>
                    )}
                </text>
                {eventBar.isOngoing && !isPointEvent && (
                    <polygon
                        points={`${x1 + width - 2},${y + 5} ${x1 + width + 6},${y + BAR_HEIGHT / 2} ${x1 + width - 2},${y + BAR_HEIGHT - 5}`}
                        fill={EVENT_BAR_COLOR}
                    />
                )}
            </g>
        );
    };

    const renderPersonBar = (personBar: TimelinePersonBar) => {
        const x1 = yearToX(personBar.startYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
        const x2 = yearToX(personBar.endYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
        const y = eventSectionHeight + personBar.row * PERSON_ROW_HEIGHT + 10;
        const width = Math.max(x2 - x1, 20);

        // Determine highlight state
        const isFocused = focusedPersonId === personBar.id;
        const isParentOfFocused = focusConnections.parentIds.has(personBar.id);
        const isSpouseOfFocused = focusConnections.spouseIds.has(personBar.id);
        const isChildOfFocused = focusConnections.childIds.has(personBar.id);

        // Select color based on highlight state
        let barColor = PERSON_BAR_COLOR;
        if (isFocused) {
            barColor = FOCUS_COLOR;
        } else if (isParentOfFocused) {
            barColor = PARENT_COLOR;
        } else if (isSpouseOfFocused) {
            barColor = SPOUSE_COLOR;
        } else if (isChildOfFocused) {
            barColor = CHILD_COLOR;
        }

        // Build tooltip content with dates
        const tooltipLines = [personBar.fullName];
        const dateStr = personBar.isOngoing 
            ? `${personBar.startYear} - present`
            : personBar.endYear !== personBar.startYear
                ? `${personBar.startYear} - ${personBar.endYear}`
                : `Born ${personBar.startYear}`;
        tooltipLines.push(dateStr);
        if (isFocused) {
            tooltipLines.push('(Focused)');
        } else if (isParentOfFocused) {
            tooltipLines.push('(Parent of focused)');
        } else if (isSpouseOfFocused) {
            tooltipLines.push('(Spouse of focused)');
        } else if (isChildOfFocused) {
            tooltipLines.push('(Child of focused)');
        }

        // Check if text fits inside the bar (approximate)
        // Assuming ~7px per character on average
        const nameWidth = personBar.fullName.length * 7;
        const textFitsInside = nameWidth + 12 < width; // 12px for padding

        return (
            <g
                key={personBar.id}
                className="person-bar cursor-pointer"
                onClick={() => handlePersonClick(personBar.id)}
                onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        lines: tooltipLines,
                    });
                }}
                onMouseLeave={() => setTooltip(null)}
            >
                <rect
                    x={x1}
                    y={y}
                    width={width}
                    height={PERSON_BAR_HEIGHT}
                    rx={4}
                    fill={barColor}
                    stroke={isFocused ? 'var(--color-text-primary)' : 'none'}
                    strokeWidth={isFocused ? 2 : 0}
                />
                <text
                    x={textFitsInside ? x1 + 6 : x1 + width + 6}
                    y={y + PERSON_BAR_HEIGHT / 2 + 4}
                    fontSize="12"
                    fontWeight="500"
                    fill={textFitsInside ? '#ffffff' : 'var(--color-text-primary)'}
                    style={{ pointerEvents: 'none' }}
                >
                    {personBar.fullName}
                </text>
                {personBar.isOngoing && (
                    <polygon
                        points={`${x1 + width - 2},${y + 5} ${x1 + width + 8},${y + PERSON_BAR_HEIGHT / 2} ${x1 + width - 2},${y + PERSON_BAR_HEIGHT - 5}`}
                        fill={barColor}
                    />
                )}
            </g>
        );
    };

    const renderFocusConnections = () => {
        if (!focusedPersonId) return null;

        const focusedPerson = layout.people.find(p => p.id === focusedPersonId);
        if (!focusedPerson) return null;

        const focusedY = eventSectionHeight + focusedPerson.row * PERSON_ROW_HEIGHT + 10 + PERSON_BAR_HEIGHT / 2;
        const focusedX = yearToX(
            (focusedPerson.startYear + focusedPerson.endYear) / 2,
            layout.minYear,
            layout.maxYear,
            chartWidth,
            PADDING_X
        );

        const connections: React.ReactNode[] = [];

        for (const parentId of focusConnections.parentIds) {
            const parent = layout.people.find(p => p.id === parentId);
            if (!parent) continue;

            const parentY = eventSectionHeight + parent.row * PERSON_ROW_HEIGHT + 10 + PERSON_BAR_HEIGHT / 2;
            const parentX = yearToX(
                (parent.startYear + parent.endYear) / 2,
                layout.minYear,
                layout.maxYear,
                chartWidth,
                PADDING_X
            );

            connections.push(
                <line
                    key={`parent-${parentId}`}
                    x1={focusedX}
                    y1={focusedY}
                    x2={parentX}
                    y2={parentY}
                    stroke={PARENT_COLOR}
                    strokeWidth={2}
                    strokeDasharray="6,3"
                    opacity={0.8}
                />
            );
        }

        for (const spouseId of focusConnections.spouseIds) {
            const spouse = layout.people.find(p => p.id === spouseId);
            if (!spouse) continue;

            const spouseY = eventSectionHeight + spouse.row * PERSON_ROW_HEIGHT + 10 + PERSON_BAR_HEIGHT / 2;
            const spouseX = yearToX(
                (spouse.startYear + spouse.endYear) / 2,
                layout.minYear,
                layout.maxYear,
                chartWidth,
                PADDING_X
            );

            connections.push(
                <line
                    key={`spouse-${spouseId}`}
                    x1={focusedX}
                    y1={focusedY}
                    x2={spouseX}
                    y2={spouseY}
                    stroke={SPOUSE_COLOR}
                    strokeWidth={2}
                    strokeDasharray="6,3"
                    opacity={0.8}
                />
            );
        }

        for (const childId of focusConnections.childIds) {
            const child = layout.people.find(p => p.id === childId);
            if (!child) continue;

            const childY = eventSectionHeight + child.row * PERSON_ROW_HEIGHT + 10 + PERSON_BAR_HEIGHT / 2;
            const childX = yearToX(
                (child.startYear + child.endYear) / 2,
                layout.minYear,
                layout.maxYear,
                chartWidth,
                PADDING_X
            );

            connections.push(
                <line
                    key={`child-${childId}`}
                    x1={focusedX}
                    y1={focusedY}
                    x2={childX}
                    y2={childY}
                    stroke={CHILD_COLOR}
                    strokeWidth={2}
                    strokeDasharray="6,3"
                    opacity={0.8}
                />
            );
        }

        return <g className="focus-connections">{connections}</g>;
    };

    const renderSectionDivider = () => {
        const y = eventSectionHeight;
        return (
            <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray="4,4"
            />
        );
    };

    const renderSectionLabels = () => (
        <>
            {layout.eventRowCount > 0 && (
                <text
                    x={10}
                    y={20}
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-text-muted)"
                >
                    LIFE EVENTS
                </text>
            )}
            <text
                x={10}
                y={eventSectionHeight + 20}
                fontSize="11"
                fontWeight="600"
                fill="var(--color-text-muted)"
            >
                PEOPLE
            </text>
        </>
    );

    const renderLegend = () => {
        const legendY = eventSectionHeight + personSectionHeight + AXIS_HEIGHT + 15;
        const centerX = chartWidth / 2;
        
        // Build legend items based on whether there's a focused person
        const legendItems: Array<{ color: string; label: string }> = [
            { color: EVENT_BAR_COLOR, label: 'Life Events' },
            { color: PERSON_BAR_COLOR, label: 'People' },
        ];
        
        if (focusedPersonId) {
            legendItems.push(
                { color: FOCUS_COLOR, label: 'Focused' },
                { color: PARENT_COLOR, label: 'Parents' },
                { color: SPOUSE_COLOR, label: 'Spouse' },
                { color: CHILD_COLOR, label: 'Children' },
            );
        }
        
        // Calculate total width to center the legend
        const itemWidth = 80; // approximate width per item
        const totalWidth = legendItems.length * itemWidth;
        const startX = centerX - totalWidth / 2;
        
        return (
            <g className="legend">
                {legendItems.map((item, index) => {
                    const x = startX + index * itemWidth;
                    return (
                        <g key={item.label} transform={`translate(${x}, ${legendY})`}>
                            <rect
                                x={0}
                                y={-6}
                                width={12}
                                height={12}
                                rx={2}
                                fill={item.color}
                            />
                            <text
                                x={16}
                                y={4}
                                fontSize="11"
                                fill="var(--color-text-muted)"
                            >
                                {item.label}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const chartHeight = typeof height === 'number' ? `${height}px` : height;

    // No data message
    if (layout.people.length === 0 && layout.events.length === 0) {
        return (
            <div className="card p-8 text-center text-muted">
                <p>No timeline data available. Add birth dates to people to see them on the timeline.</p>
            </div>
        );
    }

    return (
        <div className="card p-4 flex flex-col" style={{ height: chartHeight, overflow: 'hidden' }}>
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
                        <g className="grid-lines">
                            {timeTicks.map(year => {
                                const x = yearToX(year, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
                                return (
                                    <line
                                        key={`grid-${year}`}
                                        x1={x}
                                        y1={0}
                                        x2={x}
                                        y2={eventSectionHeight + personSectionHeight}
                                        stroke="var(--color-border)"
                                        strokeWidth={0.5}
                                        opacity={0.3}
                                    />
                                );
                            })}
                        </g>

                        {renderSectionLabels()}
                        {renderSectionDivider()}
                        {renderFocusConnections()}

                        <g className="events-section">
                            {layout.events.map(renderEventBar)}
                        </g>

                        <g className="people-section">
                            {layout.people.map(renderPersonBar)}
                        </g>

                        {renderTimeAxis()}
                        {renderLegend()}
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
