/**
 * Event bar component for the Timeline Chart.
 * Renders individual life event bars with tooltips and click handling.
 * Supports merged events (multiple people) with person selection on click.
 */
import type { Id } from '../../../convex/_generated/dataModel';
import type { TimelineEventBar as TimelineEventBarData } from './timelineLayout';
import { yearToX, formatClaimType } from './timelineLayout';
import {
    BAR_HEIGHT,
    EVENT_ROW_HEIGHT,
    EVENT_BAR_COLOR,
    type TooltipState,
} from './timelineConstants';

/** Data for person selection menu on merged events */
export interface PersonSelectionMenu {
    x: number;
    y: number;
    personIds: Id<"people">[];
    personNames: string[];
    claimIds: Id<"claims">[];
}

interface TimelineEventBarProps {
    eventBar: TimelineEventBarData;
    minYear: number;
    maxYear: number;
    chartWidth: number;
    paddingX: number;
    onEventClick: (personId: Id<"people">, claimId: Id<"claims"> | null) => void;
    onShowPersonMenu: (menu: PersonSelectionMenu) => void;
    onTooltipShow: (tooltip: TooltipState) => void;
    onTooltipHide: () => void;
}

/**
 * Renders a single event bar on the timeline.
 */
export function TimelineEventBar({
    eventBar,
    minYear,
    maxYear,
    chartWidth,
    paddingX,
    onEventClick,
    onShowPersonMenu,
    onTooltipShow,
    onTooltipHide,
}: TimelineEventBarProps) {
    const x1 = yearToX(eventBar.startYear, minYear, maxYear, chartWidth, paddingX);
    const x2 = eventBar.endYear !== null
        ? yearToX(eventBar.endYear, minYear, maxYear, chartWidth, paddingX)
        : x1 + 10;
    const y = eventBar.row * EVENT_ROW_HEIGHT + 10;
    const width = Math.max(x2 - x1, 10);
    const isPointEvent = eventBar.endYear === null || eventBar.endYear === eventBar.startYear;
    const isMergedEvent = eventBar.mergedCount > 1;
    
    // Only show event type in label (simplified view)
    const displayLabel = formatClaimType(eventBar.claimType);

    // Build tooltip content with full details
    const tooltipLines: string[] = [];
    // First line: Event type with person name(s)
    tooltipLines.push(eventBar.title);
    // Second line: Date range - use original date strings, not fractional years
    if (eventBar.startDateDisplay) {
        const dateStr = eventBar.isOngoing 
            ? `${eventBar.startDateDisplay} - present`
            : eventBar.endDateDisplay
                ? `${eventBar.startDateDisplay} - ${eventBar.endDateDisplay}`
                : eventBar.startDateDisplay;
        tooltipLines.push(dateStr);
    }
    // Third line: Description/comments if present
    if (eventBar.description) {
        tooltipLines.push(eventBar.description);
    }
    // Hint for merged events
    if (isMergedEvent) {
        tooltipLines.push('Click to select person');
    }

    const handleMouseEnter = (e: React.MouseEvent) => {
        onTooltipShow({
            x: e.clientX,
            y: e.clientY,
            lines: tooltipLines,
        });
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isMergedEvent) {
            onShowPersonMenu({
                x: e.clientX,
                y: e.clientY,
                personIds: eventBar.personIds,
                personNames: eventBar.personNames,
                claimIds: eventBar.claimIds,
            });
        } else {
            // For non-merged events, pass the claimId (or null for synthetic birth/death events)
            const claimId = eventBar.claimIds.length > 0 ? eventBar.claimIds[0] : null;
            onEventClick(eventBar.personId, claimId);
        }
    };

    // Calculate the total interactive width including label and badge
    const labelWidth = displayLabel.length * 7;
    const badgeWidth = isMergedEvent ? 24 : 0; // Badge is 16px diameter + padding
    const totalInteractiveWidth = Math.max(width, labelWidth + badgeWidth + 16);

    return (
        <g
            className="event-bar"
            style={{ cursor: 'pointer' }}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseEnter}
            onMouseLeave={onTooltipHide}
        >
            {/* Invisible hit area for easier interaction - covers entire label and badge */}
            <rect
                x={x1 - 4}
                y={y - 4}
                width={totalInteractiveWidth + 8}
                height={BAR_HEIGHT + 8}
                fill="transparent"
                style={{ cursor: 'pointer' }}
            />
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
                {displayLabel}
            </text>
            {/* Badge showing number of people for merged events */}
            {isMergedEvent && (
                <g transform={`translate(${isPointEvent ? x1 + 12 + displayLabel.length * 6.5 + 4 : x1 + 6 + displayLabel.length * 6.5 + 4}, ${y + BAR_HEIGHT / 2})`}>
                    <circle
                        r={8}
                        fill="var(--color-accent)"
                        stroke="var(--color-surface)"
                        strokeWidth={1.5}
                    />
                    <text
                        x={0}
                        y={4}
                        fontSize="10"
                        fontWeight="600"
                        fill="white"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                    >
                        {eventBar.mergedCount}
                    </text>
                </g>
            )}
            {eventBar.isOngoing && !isPointEvent && (
                <polygon
                    points={`${x1 + width - 2},${y + 5} ${x1 + width + 6},${y + BAR_HEIGHT / 2} ${x1 + width - 2},${y + BAR_HEIGHT - 5}`}
                    fill={EVENT_BAR_COLOR}
                />
            )}
        </g>
    );
}
