/**
 * Event bar component for the Timeline Chart.
 * Renders individual life event bars with tooltips and click handling.
 */
import type { Id } from '../../../convex/_generated/dataModel';
import type { TimelineEventBar as TimelineEventBarData } from './timelineLayout';
import { yearToX } from './timelineLayout';
import {
    BAR_HEIGHT,
    EVENT_ROW_HEIGHT,
    EVENT_BAR_COLOR,
    DESCRIPTION_MAX_CHARS,
    type TooltipState,
} from './timelineConstants';

interface TimelineEventBarProps {
    eventBar: TimelineEventBarData;
    minYear: number;
    maxYear: number;
    chartWidth: number;
    paddingX: number;
    onPersonClick: (personId: Id<"people">) => void;
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
    onPersonClick,
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

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onTooltipShow({
            x: rect.left + rect.width / 2,
            y: rect.top,
            lines: tooltipLines,
        });
    };

    return (
        <g
            className="event-bar cursor-pointer"
            onClick={() => onPersonClick(eventBar.personId)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onTooltipHide}
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
}
