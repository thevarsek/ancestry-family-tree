/**
 * Person bar component for the Timeline Chart.
 * Renders individual person lifespan bars with focus highlighting and tooltips.
 */
import type { Id } from '../../../convex/_generated/dataModel';
import type { TimelinePersonBar as TimelinePersonBarData } from './timelineLayout';
import { yearToX } from './timelineLayout';
import {
    PERSON_ROW_HEIGHT,
    PERSON_BAR_HEIGHT,
    PERSON_BAR_COLOR,
    FOCUS_COLOR,
    PARENT_COLOR,
    SPOUSE_COLOR,
    CHILD_COLOR,
    type TooltipState,
} from './timelineConstants';

export interface FocusConnections {
    parentIds: Set<Id<"people">>;
    spouseIds: Set<Id<"people">>;
    childIds: Set<Id<"people">>;
}

interface TimelinePersonBarProps {
    personBar: TimelinePersonBarData;
    minYear: number;
    maxYear: number;
    chartWidth: number;
    paddingX: number;
    eventSectionHeight: number;
    focusedPersonId: Id<"people"> | null;
    focusConnections: FocusConnections;
    onPersonClick: (personId: Id<"people">) => void;
    onTooltipShow: (tooltip: TooltipState) => void;
    onTooltipHide: () => void;
}

/**
 * Renders a single person bar on the timeline.
 */
export function TimelinePersonBar({
    personBar,
    minYear,
    maxYear,
    chartWidth,
    paddingX,
    eventSectionHeight,
    focusedPersonId,
    focusConnections,
    onPersonClick,
    onTooltipShow,
    onTooltipHide,
}: TimelinePersonBarProps) {
    const x1 = yearToX(personBar.startYear, minYear, maxYear, chartWidth, paddingX);
    const x2 = yearToX(personBar.endYear, minYear, maxYear, chartWidth, paddingX);
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

    // Build tooltip content with dates - use original date strings
    const tooltipLines = [personBar.fullName];
    let dateStr: string;
    if (personBar.isOngoing) {
        dateStr = personBar.birthDateDisplay 
            ? `${personBar.birthDateDisplay} - present`
            : 'present';
    } else if (personBar.deathDateDisplay) {
        dateStr = personBar.birthDateDisplay
            ? `${personBar.birthDateDisplay} - ${personBar.deathDateDisplay}`
            : personBar.deathDateDisplay;
    } else if (personBar.birthDateDisplay) {
        dateStr = `Born ${personBar.birthDateDisplay}`;
    } else {
        dateStr = '';
    }
    if (dateStr) {
        tooltipLines.push(dateStr);
    }
    if (isFocused) {
        tooltipLines.push('(Focused)');
    } else if (isParentOfFocused) {
        tooltipLines.push('(Parent of focused)');
    } else if (isSpouseOfFocused) {
        tooltipLines.push('(Spouse of focused)');
    } else if (isChildOfFocused) {
        tooltipLines.push('(Child of focused)');
    }

    // Check if text fits inside the bar (approximate ~7px per character)
    const nameWidth = personBar.fullName.length * 7;
    const textFitsInside = nameWidth + 12 < width;

    const handleMouseEnter = (e: React.MouseEvent) => {
        onTooltipShow({
            x: e.clientX,
            y: e.clientY,
            lines: tooltipLines,
        });
    };

    return (
        <g
            className="person-bar cursor-pointer"
            onClick={() => onPersonClick(personBar.id)}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseEnter}
            onMouseLeave={onTooltipHide}
        >
            {/* Invisible hit area for easier interaction */}
            <rect
                x={x1 - 4}
                y={y - 4}
                width={Math.max(width + 8, personBar.fullName.length * 7 + 20)}
                height={PERSON_BAR_HEIGHT + 8}
                fill="transparent"
            />
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
}
