/**
 * Timeline layout building functions
 */
import type { Id } from '../../../convex/_generated/dataModel';
import type { ClaimType } from '../../types/claims';
import type {
    TimelinePersonBar,
    TimelineEventBar,
    TimelineLayout,
    TimelineLayoutInput,
    LifeEventClaim,
} from './timelineTypes';
import { formatClaimType, parseYear } from './timelineUtils';

// Re-export types for backward compatibility
export type { ClaimType } from '../../types/claims';
export type {
    PersonWithDates,
    LifeEventClaim,
    TimelinePersonBar,
    TimelineEventBar,
    TimelineLayout,
    TimelineLayoutInput,
} from './timelineTypes';

// Re-export utilities for backward compatibility
export {
    formatClaimType,
    getFocusedConnections,
    yearToX,
    xToYear,
    generateTimeTicks,
    parseYear,
} from './timelineUtils';

/**
 * Pack items into rows to avoid overlaps.
 * Returns a row assignment for each item (0-indexed).
 */
function packIntoRows<T extends { startYear: number; endYear: number | null }>(
    items: T[],
    gap: number = 1
): Map<number, number> {
    const rowAssignments = new Map<number, number>();
    const rows: Array<{ end: number }[]> = [];
    
    const sortedIndices = items
        .map((_, i) => i)
        .sort((a, b) => items[a].startYear - items[b].startYear);
    
    for (const idx of sortedIndices) {
        const item = items[idx];
        const itemEnd = item.endYear ?? item.startYear;
        
        let assignedRow = -1;
        for (let r = 0; r < rows.length; r++) {
            const rowItems = rows[r];
            const maxEndInRow = Math.max(...rowItems.map(ri => ri.end), -Infinity);
            if (item.startYear > maxEndInRow + gap) {
                assignedRow = r;
                break;
            }
        }
        
        if (assignedRow === -1) {
            assignedRow = rows.length;
            rows.push([]);
        }
        
        rows[assignedRow].push({ end: itemEnd });
        rowAssignments.set(idx, assignedRow);
    }
    
    return rowAssignments;
}

/**
 * Pack event items with text labels into rows to avoid overlaps.
 */
function packEventsIntoRows(events: TimelineEventBar[]): Map<number, number> {
    const rowAssignments = new Map<number, number>();
    const rows: Array<{ end: number }[]> = [];
    
    const sortedIndices = events
        .map((_, i) => i)
        .sort((a, b) => events[a].startYear - events[b].startYear);
    
    const DESCRIPTION_MAX_CHARS = 50;
    const estimateLabelWidth = (title: string, description?: string): number => {
        let totalChars = title.length;
        if (description) {
            const descLength = Math.min(description.length, DESCRIPTION_MAX_CHARS);
            totalChars += 3 + descLength;
        }
        return Math.ceil(totalChars / 3);
    };
    
    for (const idx of sortedIndices) {
        const event = events[idx];
        const isPointEvent = event.endYear === null || event.endYear === event.startYear;
        
        const labelWidth = estimateLabelWidth(event.title, event.description);
        let itemEnd: number;
        
        if (isPointEvent) {
            itemEnd = event.startYear + labelWidth;
        } else {
            const barEnd = event.endYear ?? event.startYear;
            itemEnd = Math.max(barEnd, event.startYear + labelWidth);
        }
        
        let assignedRow = -1;
        const gap = 3;
        
        for (let r = 0; r < rows.length; r++) {
            const rowItems = rows[r];
            const maxEndInRow = Math.max(...rowItems.map(ri => ri.end), -Infinity);
            if (event.startYear > maxEndInRow + gap) {
                assignedRow = r;
                break;
            }
        }
        
        if (assignedRow === -1) {
            assignedRow = rows.length;
            rows.push([]);
        }
        
        rows[assignedRow].push({ end: itemEnd });
        rowAssignments.set(idx, assignedRow);
    }
    
    return rowAssignments;
}

/**
 * Build the timeline layout from input data
 */
export function buildTimelineLayout(input: TimelineLayoutInput): TimelineLayout {
    const { lifeEvents, people, relationships, visibleEventTypes, visiblePersonIds } = input;
    const currentYear = new Date().getFullYear();
    
    const processedEvents: TimelineEventBar[] = [];
    
    // Process life events (claims)
    for (const claim of lifeEvents) {
        if (!visibleEventTypes.has(claim.claimType)) continue;
        if (!visiblePersonIds.has(claim.personId)) continue;
        
        const startYear = parseYear(claim.value.date);
        if (startYear === null) continue;
        
        const endYear = parseYear(claim.value.dateEnd);
        const isOngoing = claim.value.isCurrent ?? false;
        const title = `${formatClaimType(claim.claimType)} - ${claim.personName}`;
        
        processedEvents.push({
            id: claim._id,
            claim,
            title,
            description: claim.value.description,
            startYear,
            endYear: endYear ?? (isOngoing ? currentYear : null),
            isOngoing,
            row: 0,
            personId: claim.personId,
            personName: claim.personName,
            claimType: claim.claimType as ClaimType,
        });
    }
    
    // Add birth and death events from people
    for (const person of people) {
        if (!visiblePersonIds.has(person._id)) continue;
        
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        const birthYear = parseYear(person.birthDate);
        if (birthYear !== null && visibleEventTypes.has('birth')) {
            processedEvents.push({
                id: `${person._id}-birth` as Id<"claims">,
                claim: null as unknown as LifeEventClaim,
                title: `Birth - ${fullName}`,
                description: undefined,
                startYear: birthYear,
                endYear: null,
                isOngoing: false,
                row: 0,
                personId: person._id,
                personName: fullName,
                claimType: 'birth',
            });
        }
        
        const deathYear = parseYear(person.deathDate);
        if (deathYear !== null && visibleEventTypes.has('death')) {
            processedEvents.push({
                id: `${person._id}-death` as Id<"claims">,
                claim: null as unknown as LifeEventClaim,
                title: `Death - ${fullName}`,
                description: undefined,
                startYear: deathYear,
                endYear: null,
                isOngoing: false,
                row: 0,
                personId: person._id,
                personName: fullName,
                claimType: 'death',
            });
        }
    }
    
    // Process people
    const processedPeople: TimelinePersonBar[] = [];
    
    for (const person of people) {
        if (!visiblePersonIds.has(person._id)) continue;
        
        const birthYear = parseYear(person.birthDate);
        if (birthYear === null) continue;
        
        const deathYear = parseYear(person.deathDate);
        const isOngoing = person.isLiving || person.isOngoing || (!deathYear && !person.deathDate);
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        processedPeople.push({
            id: person._id,
            person,
            fullName,
            startYear: birthYear,
            endYear: deathYear ?? (isOngoing ? currentYear : birthYear),
            isOngoing,
            hasBirthDate: true,
            row: 0,
        });
    }
    
    // Calculate time range
    const allStartYears = [
        ...processedEvents.map(e => e.startYear),
        ...processedPeople.map(p => p.startYear),
    ];
    const allEndYears = [
        ...processedEvents.map(e => e.endYear ?? e.startYear),
        ...processedPeople.map(p => p.endYear),
    ];
    
    const initialMinYear = allStartYears.length > 0 
        ? Math.min(...allStartYears) 
        : currentYear - 100;
    const initialMaxYear = allEndYears.length > 0 
        ? Math.max(...allEndYears, currentYear) 
        : currentYear;
    
    // Pack events into rows
    const eventRowMap = packEventsIntoRows(processedEvents);
    for (let i = 0; i < processedEvents.length; i++) {
        processedEvents[i].row = eventRowMap.get(i) ?? 0;
    }
    const eventRowCount = eventRowMap.size > 0 
        ? Math.max(...Array.from(eventRowMap.values())) + 1 
        : 0;
    
    // Pack people into rows
    const personRowMap = packIntoRows(processedPeople, 2);
    for (let i = 0; i < processedPeople.length; i++) {
        processedPeople[i].row = personRowMap.get(i) ?? 0;
    }
    const personRowCount = personRowMap.size > 0 
        ? Math.max(...Array.from(personRowMap.values())) + 1 
        : 0;
    
    const futureBuffer = 25;
    
    return {
        events: processedEvents,
        people: processedPeople,
        minYear: Math.floor(initialMinYear / 10) * 10,
        maxYear: Math.ceil((initialMaxYear + futureBuffer) / 10) * 10,
        eventRowCount,
        personRowCount,
        relationships,
    };
}
