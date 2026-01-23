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
import { formatClaimType, parseFractionalYear } from './timelineUtils';

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
    parseFractionalYear,
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
 * Now only considers the event type label width (not person name or description).
 */
function packEventsIntoRows(events: TimelineEventBar[]): Map<number, number> {
    const rowAssignments = new Map<number, number>();
    const rows: Array<{ end: number }[]> = [];
    
    const sortedIndices = events
        .map((_, i) => i)
        .sort((a, b) => events[a].startYear - events[b].startYear);
    
    // Only estimate width for the event type label (e.g., "Marriage", "Residence")
    const estimateLabelWidth = (claimType: string): number => {
        const formattedType = formatClaimType(claimType);
        // Approximate character width in years (smaller since labels are shorter now)
        return Math.ceil(formattedType.length / 2.5);
    };
    
    for (const idx of sortedIndices) {
        const event = events[idx];
        const isPointEvent = event.endYear === null || event.endYear === event.startYear;
        
        const labelWidth = estimateLabelWidth(event.claimType);
        let itemEnd: number;
        
        if (isPointEvent) {
            itemEnd = event.startYear + labelWidth;
        } else {
            const barEnd = event.endYear ?? event.startYear;
            itemEnd = Math.max(barEnd, event.startYear + labelWidth);
        }
        
        let assignedRow = -1;
        const gap = 2; // Reduced gap since labels are shorter
        
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
    
    const rawEvents: TimelineEventBar[] = [];
    
    // Process life events (claims)
    for (const claim of lifeEvents) {
        if (!visibleEventTypes.has(claim.claimType)) continue;
        if (!visiblePersonIds.has(claim.personId)) continue;
        
        // Use fractional year for precise positioning
        // yyyy → Jan 1, yyyy-mm → middle of month, yyyy-mm-dd → exact day
        const startYear = parseFractionalYear(claim.value.date);
        if (startYear === null) continue;
        
        const endYear = parseFractionalYear(claim.value.dateEnd);
        const isOngoing = claim.value.isCurrent ?? false;
        const title = `${formatClaimType(claim.claimType)} - ${claim.personName}`;
        
        rawEvents.push({
            id: claim._id,
            claim,
            title,
            description: claim.value.description,
            startYear,
            endYear: endYear ?? (isOngoing ? currentYear : null),
            startDateDisplay: claim.value.date,
            endDateDisplay: claim.value.dateEnd,
            isOngoing,
            row: 0,
            personId: claim.personId,
            personName: claim.personName,
            claimType: claim.claimType as ClaimType,
            personIds: [claim.personId],
            personNames: [claim.personName],
            mergedCount: 1,
            claimIds: [claim._id],
        });
    }
    
    // Add birth and death events from people
    for (const person of people) {
        if (!visiblePersonIds.has(person._id)) continue;
        
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        // Use fractional year for precise positioning of birth/death
        const birthYear = parseFractionalYear(person.birthDate);
        if (birthYear !== null && visibleEventTypes.has('birth')) {
            rawEvents.push({
                id: `${person._id}-birth` as Id<"claims">,
                claim: null as unknown as LifeEventClaim,
                title: `Birth - ${fullName}`,
                description: undefined,
                startYear: birthYear,
                endYear: null,
                startDateDisplay: person.birthDate,
                endDateDisplay: undefined,
                isOngoing: false,
                row: 0,
                personId: person._id,
                personName: fullName,
                claimType: 'birth',
                personIds: [person._id],
                personNames: [fullName],
                mergedCount: 1,
                claimIds: [], // Synthetic event - no real claim
            });
        }
        
        const deathYear = parseFractionalYear(person.deathDate);
        if (deathYear !== null && visibleEventTypes.has('death')) {
            rawEvents.push({
                id: `${person._id}-death` as Id<"claims">,
                claim: null as unknown as LifeEventClaim,
                title: `Death - ${fullName}`,
                description: undefined,
                startYear: deathYear,
                endYear: null,
                startDateDisplay: person.deathDate,
                endDateDisplay: undefined,
                isOngoing: false,
                row: 0,
                personId: person._id,
                personName: fullName,
                claimType: 'death',
                personIds: [person._id],
                personNames: [fullName],
                mergedCount: 1,
                claimIds: [], // Synthetic event - no real claim
            });
        }
    }
    
    // Merge events with same type and date range
    const processedEvents = mergeEvents(rawEvents);
    
    // Process people
    const processedPeople: TimelinePersonBar[] = [];
    
    for (const person of people) {
        if (!visiblePersonIds.has(person._id)) continue;
        
        // Use fractional year for precise positioning of person lifespans
        const birthYear = parseFractionalYear(person.birthDate);
        if (birthYear === null) continue;
        
        const deathYear = parseFractionalYear(person.deathDate);
        const isOngoing = person.isLiving || person.isOngoing || (!deathYear && !person.deathDate);
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        processedPeople.push({
            id: person._id,
            person,
            fullName,
            startYear: birthYear,
            endYear: deathYear ?? (isOngoing ? currentYear : birthYear),
            birthDateDisplay: person.birthDate,
            deathDateDisplay: person.deathDate,
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

/**
 * Merge events with the same type and date range into single entries.
 * For example, a Marriage event for two people on the same date becomes one entry.
 */
function mergeEvents(events: TimelineEventBar[]): TimelineEventBar[] {
    // Group events by claimType + startYear + endYear
    // Round years to 3 decimal places to handle floating-point precision issues
    const groups = new Map<string, TimelineEventBar[]>();
    
    for (const event of events) {
        const startRounded = Math.round(event.startYear * 1000) / 1000;
        const endRounded = event.endYear !== null 
            ? Math.round(event.endYear * 1000) / 1000 
            : 'null';
        const key = `${event.claimType}-${startRounded}-${endRounded}`;
        const existing = groups.get(key) ?? [];
        existing.push(event);
        groups.set(key, existing);
    }
    
    const merged: TimelineEventBar[] = [];
    
    for (const groupEvents of groups.values()) {
        if (groupEvents.length === 1) {
            // No merge needed, just use the event as-is
            merged.push(groupEvents[0]);
        } else {
            // Merge multiple events into one
            const first = groupEvents[0];
            const allPersonIds = groupEvents.map(e => e.personId);
            const allPersonNames = groupEvents.map(e => e.personName);
            const allClaimIds = groupEvents.flatMap(e => e.claimIds);
            
            // Create a combined title (e.g., "Marriage - Ferdinando & Valeria")
            const combinedNames = allPersonNames.join(' & ');
            const combinedTitle = `${formatClaimType(first.claimType)} - ${combinedNames}`;
            
            // Combine descriptions if any exist
            const descriptions = groupEvents
                .map(e => e.description)
                .filter((d): d is string => Boolean(d));
            const combinedDescription = descriptions.length > 0 
                ? descriptions.join('; ') 
                : undefined;
            
            merged.push({
                ...first,
                title: combinedTitle,
                description: combinedDescription,
                personIds: allPersonIds,
                personNames: allPersonNames,
                mergedCount: groupEvents.length,
                claimIds: allClaimIds,
            });
        }
    }
    
    return merged;
}
