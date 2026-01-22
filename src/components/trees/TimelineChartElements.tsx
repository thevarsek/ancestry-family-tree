/**
 * Static chart elements for the Timeline Chart: axis, legend, section labels, and dividers.
 */
import { yearToX } from './timelineLayout';
import {
    PADDING_X,
    getLegendItems,
} from './timelineConstants';

interface TimeAxisProps {
    timeTicks: number[];
    minYear: number;
    maxYear: number;
    chartWidth: number;
    yPosition: number;
}

/**
 * Renders the time axis with tick marks and year labels.
 */
export function TimeAxis({
    timeTicks,
    minYear,
    maxYear,
    chartWidth,
    yPosition,
}: TimeAxisProps) {
    return (
        <g className="time-axis">
            <line
                x1={PADDING_X}
                y1={yPosition}
                x2={chartWidth - PADDING_X}
                y2={yPosition}
                stroke="var(--color-border)"
                strokeWidth={1}
            />
            {timeTicks.map(year => {
                const x = yearToX(year, minYear, maxYear, chartWidth, PADDING_X);
                return (
                    <g key={year}>
                        <line
                            x1={x}
                            y1={yPosition - 5}
                            x2={x}
                            y2={yPosition + 5}
                            stroke="var(--color-border)"
                            strokeWidth={1}
                        />
                        <text
                            x={x}
                            y={yPosition + 20}
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
}

interface TimelineLegendProps {
    chartWidth: number;
    yPosition: number;
    hasFocusedPerson: boolean;
}

/**
 * Renders the chart legend showing color meanings.
 */
export function TimelineLegend({
    chartWidth,
    yPosition,
    hasFocusedPerson,
}: TimelineLegendProps) {
    const legendItems = getLegendItems(hasFocusedPerson);
    const centerX = chartWidth / 2;
    const itemWidth = 80;
    const totalWidth = legendItems.length * itemWidth;
    const startX = centerX - totalWidth / 2;

    return (
        <g className="legend">
            {legendItems.map((item, index) => {
                const x = startX + index * itemWidth;
                return (
                    <g key={item.label} transform={`translate(${x}, ${yPosition})`}>
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
}

interface SectionLabelsProps {
    eventRowCount: number;
    eventSectionHeight: number;
}

/**
 * Renders the section labels (LIFE EVENTS, PEOPLE).
 */
export function SectionLabels({
    eventRowCount,
    eventSectionHeight,
}: SectionLabelsProps) {
    return (
        <>
            {eventRowCount > 0 && (
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
}

interface SectionDividerProps {
    chartWidth: number;
    yPosition: number;
}

/**
 * Renders the dashed divider line between events and people sections.
 */
export function SectionDivider({
    chartWidth,
    yPosition,
}: SectionDividerProps) {
    return (
        <line
            x1={0}
            y1={yPosition}
            x2={chartWidth}
            y2={yPosition}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="4,4"
        />
    );
}

interface TimeGridProps {
    timeTicks: number[];
    minYear: number;
    maxYear: number;
    chartWidth: number;
    height: number;
}

/**
 * Renders vertical grid lines at each time tick.
 */
export function TimeGrid({
    timeTicks,
    minYear,
    maxYear,
    chartWidth,
    height,
}: TimeGridProps) {
    return (
        <g className="grid-lines" style={{ pointerEvents: 'none' }}>
            {timeTicks.map(year => {
                const x = yearToX(year, minYear, maxYear, chartWidth, PADDING_X);
                return (
                    <line
                        key={`grid-${year}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={height}
                        stroke="var(--color-border)"
                        strokeWidth={0.5}
                        opacity={0.3}
                    />
                );
            })}
        </g>
    );
}
