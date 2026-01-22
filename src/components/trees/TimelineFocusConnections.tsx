/**
 * Focus connection lines for the Timeline Chart.
 * Renders dashed lines connecting the focused person to their relatives.
 */
import type { Id } from '../../../convex/_generated/dataModel';
import type { TimelinePersonBar } from './timelineLayout';
import { yearToX } from './timelineLayout';
import {
    PERSON_ROW_HEIGHT,
    PERSON_BAR_HEIGHT,
    PARENT_COLOR,
    SPOUSE_COLOR,
    CHILD_COLOR,
} from './timelineConstants';
import type { FocusConnections } from './TimelinePersonBar';

interface TimelineFocusConnectionsProps {
    focusedPersonId: Id<"people"> | null;
    focusConnections: FocusConnections;
    people: TimelinePersonBar[];
    minYear: number;
    maxYear: number;
    chartWidth: number;
    paddingX: number;
    eventSectionHeight: number;
}

/**
 * Calculates the center position for a person bar.
 */
function getPersonCenter(
    person: TimelinePersonBar,
    eventSectionHeight: number,
    minYear: number,
    maxYear: number,
    chartWidth: number,
    paddingX: number,
): { x: number; y: number } {
    const y = eventSectionHeight + person.row * PERSON_ROW_HEIGHT + 10 + PERSON_BAR_HEIGHT / 2;
    const x = yearToX(
        (person.startYear + person.endYear) / 2,
        minYear,
        maxYear,
        chartWidth,
        paddingX
    );
    return { x, y };
}

/**
 * Renders connection lines from the focused person to their relatives.
 */
export function TimelineFocusConnections({
    focusedPersonId,
    focusConnections,
    people,
    minYear,
    maxYear,
    chartWidth,
    paddingX,
    eventSectionHeight,
}: TimelineFocusConnectionsProps) {
    if (!focusedPersonId) return null;

    const focusedPerson = people.find(p => p.id === focusedPersonId);
    if (!focusedPerson) return null;

    const { x: focusedX, y: focusedY } = getPersonCenter(
        focusedPerson,
        eventSectionHeight,
        minYear,
        maxYear,
        chartWidth,
        paddingX
    );

    const connections: React.ReactNode[] = [];

    // Parent connections
    for (const parentId of focusConnections.parentIds) {
        const parent = people.find(p => p.id === parentId);
        if (!parent) continue;

        const { x: parentX, y: parentY } = getPersonCenter(
            parent,
            eventSectionHeight,
            minYear,
            maxYear,
            chartWidth,
            paddingX
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

    // Spouse connections
    for (const spouseId of focusConnections.spouseIds) {
        const spouse = people.find(p => p.id === spouseId);
        if (!spouse) continue;

        const { x: spouseX, y: spouseY } = getPersonCenter(
            spouse,
            eventSectionHeight,
            minYear,
            maxYear,
            chartWidth,
            paddingX
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

    // Child connections
    for (const childId of focusConnections.childIds) {
        const child = people.find(p => p.id === childId);
        if (!child) continue;

        const { x: childX, y: childY } = getPersonCenter(
            child,
            eventSectionHeight,
            minYear,
            maxYear,
            chartWidth,
            paddingX
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

    return <g className="focus-connections" style={{ pointerEvents: 'none' }}>{connections}</g>;
}
