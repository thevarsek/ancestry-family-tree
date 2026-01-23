import { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { TimelineEventBar, type PersonSelectionMenu } from './TimelineEventBar';
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
    
    // Person selection menu state (for merged events)
    const [personMenu, setPersonMenu] = useState<PersonSelectionMenu | null>(null);
    const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
    
    // Timeline scale state (stretches the timeline horizontally, 0.5x to 4x)
    const [timeScale, setTimeScale] = useState(1);
    
    // Close person menu when clicking outside or pressing Escape
    useEffect(() => {
        if (!personMenu) return;
        
        // Use requestAnimationFrame to skip the current event loop
        // This prevents the menu from closing immediately from the same click that opened it
        let frameId = requestAnimationFrame(() => {
            frameId = requestAnimationFrame(() => {
                // Now we're safely past the original click event
            });
        });
        
        const handleClickOutside = (e: MouseEvent) => {
            // Check if click is inside the menu
            const target = e.target as HTMLElement;
            if (target.closest('[data-person-menu]')) return;
            setPersonMenu(null);
        };
        
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    setPersonMenu(null);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setMenuSelectedIndex(prev => 
                        prev < personMenu.personIds.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setMenuSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
                    break;
                case 'Enter':
                    e.preventDefault();
                    {
                        const claimId = personMenu.claimIds[menuSelectedIndex];
                        if (claimId) {
                            navigate(`/tree/${treeId}/person/${personMenu.personIds[menuSelectedIndex]}/event/${claimId}`);
                        } else {
                            navigate(`/tree/${treeId}/person/${personMenu.personIds[menuSelectedIndex]}`);
                        }
                    }
                    setPersonMenu(null);
                    break;
            }
        };
        
        // Add listeners after a micro-delay to skip the opening click
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 10);
        
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            cancelAnimationFrame(frameId);
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [personMenu, menuSelectedIndex, navigate, treeId]);

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
    
    // Base chart width multiplied by timeScale for horizontal stretching
    const baseChartWidth = Math.max(800, (layout.maxYear - layout.minYear) * 8);
    const chartWidth = baseChartWidth * timeScale;

    // Zoom controls (without drag-to-pan - scrollbars handle navigation)
    const {
        scale,
        containerRef,
        svgStyle,
        scaledWidth,
        scaledHeight,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        fit: handleFit,
        centerOn,
    } = usePanZoom({
        contentWidth: chartWidth,
        contentHeight: totalContentHeight,
        minScale: 0.5,
        maxScale: 3.0,
        fitPadding: 40,
    });

    // Time ticks - adjust tick count based on timeScale for better density
    const timeTicks = useMemo(() => 
        generateTimeTicks(layout.minYear, layout.maxYear, Math.round(15 * timeScale)),
        [layout.minYear, layout.maxYear, timeScale]
    );

    // Center on current year
    const handleCenter = () => {
        const currentYear = new Date().getFullYear();
        const targetX = yearToX(currentYear, layout.minYear, layout.maxYear, chartWidth, PADDING_X);
        centerOn(targetX, totalContentHeight / 2);
    };

    // Click handlers - no need to check wasRecentlyPanning since we removed drag-to-pan
    const handleEventClick = (personId: Id<"people">, claimId: Id<"claims"> | null) => {
        if (claimId) {
            navigate(`/tree/${treeId}/person/${personId}/event/${claimId}`);
        } else {
            // Synthetic events (birth/death) navigate to person page
            navigate(`/tree/${treeId}/person/${personId}`);
        }
    };

    const handlePersonClick = (personId: Id<"people">) => {
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
    
    // Person menu handler (for merged events)
    const handleShowPersonMenu = (menu: PersonSelectionMenu) => {
        setPersonMenu(menu);
        setMenuSelectedIndex(0); // Reset selection when opening
        setTooltip(null); // Hide tooltip when showing menu
    };

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
                className="flex items-center justify-between mb-3 text-xs text-muted flex-wrap gap-2"
            >
                <span>Scroll to navigate · Hover for details</span>
                <div className="flex items-center gap-2 flex-wrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('png')}>Export PNG</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('pdf')}>Export PDF</button>
                    {onToggleFullscreen && (
                        <button className="btn btn-secondary btn-sm" onClick={onToggleFullscreen}>
                            {isFullscreen ? 'Exit full screen' : 'Full screen'}
                        </button>
                    )}
                    <span className="text-muted">|</span>
                    {/* Timeline scale slider - stretches timeline horizontally */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs whitespace-nowrap">Scale:</span>
                        <input
                            type="range"
                            min="0.5"
                            max="4"
                            step="0.25"
                            value={timeScale}
                            onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                            className="w-20 h-1 accent-accent cursor-pointer"
                            title={`Timeline scale: ${timeScale}x`}
                        />
                        <span className="text-xs w-8">{timeScale}x</span>
                    </div>
                    <span className="text-muted">|</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomOut}>-</button>
                    <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomIn}>+</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleFit}>Fit</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCenter}>Now</button>
                </div>
            </div>

            {/* Chart container - uses native scrollbars for navigation */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto"
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
                                    onEventClick={handleEventClick}
                                    onShowPersonMenu={handleShowPersonMenu}
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

            {/* Tooltip - rendered in portal to escape overflow constraints */}
            {tooltip && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: tooltip.x,
                        top: tooltip.y - 16,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 9999,
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        padding: '12px',
                        maxWidth: '280px',
                        pointerEvents: 'none',
                    }}
                >
                    {tooltip.lines.map((line, i) => (
                        <div 
                            key={i} 
                            style={{
                                fontWeight: i === 0 ? 600 : 400,
                                fontSize: i === 0 ? '14px' : '12px',
                                color: i === 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                marginTop: i > 0 ? '4px' : 0,
                            }}
                        >
                            {line}
                        </div>
                    ))}
                </div>,
                document.body
            )}
            
            {/* Person selection menu for merged events */}
            {personMenu && createPortal(
                <div
                    data-person-menu
                    style={{
                        position: 'fixed',
                        left: personMenu.x,
                        top: personMenu.y + 8,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        padding: '4px 0',
                        minWidth: '150px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        color: 'var(--color-text-muted)',
                        borderBottom: '1px solid var(--color-border)',
                    }}>
                        Select person (↑↓ Enter)
                    </div>
                    {personMenu.personIds.map((personId, i) => (
                        <button
                            key={personId}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                textAlign: 'left',
                                fontSize: '14px',
                                color: i === menuSelectedIndex ? 'var(--color-accent)' : 'var(--color-text-primary)',
                                backgroundColor: i === menuSelectedIndex ? 'var(--color-accent-light, rgba(139, 92, 246, 0.1))' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s',
                            }}
                            onClick={() => {
                                const claimId = personMenu.claimIds[i];
                                if (claimId) {
                                    navigate(`/tree/${treeId}/person/${personId}/event/${claimId}`);
                                } else {
                                    navigate(`/tree/${treeId}/person/${personId}`);
                                }
                                setPersonMenu(null);
                            }}
                            onMouseEnter={() => setMenuSelectedIndex(i)}
                        >
                            {personMenu.personNames[i]}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
