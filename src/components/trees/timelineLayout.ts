import type { Doc, Id } from '../../../convex/_generated/dataModel';

// Claim types that can be displayed as life events
export type ClaimType = 
    | "birth" 
    | "death" 
    | "marriage" 
    | "divorce" 
    | "residence" 
    | "workplace" 
    | "occupation" 
    | "education" 
    | "military_service" 
    | "immigration" 
    | "emigration" 
    | "naturalization" 
    | "religion" 
    | "name_change" 
    | "custom";

// Types for timeline data coming from the Convex query
export interface PersonWithDates extends Doc<"people"> {
    birthDate?: string;
    deathDate?: string;
    isOngoing?: boolean;
}

export interface LifeEventClaim extends Doc<"claims"> {
    personName: string;
    personId: Id<"people">;
}

// Processed items for display
export interface TimelinePersonBar {
    id: Id<"people">;
    person: PersonWithDates;
    fullName: string;
    startYear: number;
    endYear: number;
    isOngoing: boolean;
    hasBirthDate: boolean;
    row: number; // Y position row for layout
}

export interface TimelineEventBar {
    id: Id<"claims">;
    claim: LifeEventClaim;
    title: string;
    description?: string;
    startYear: number;
    endYear: number | null; // null for point-in-time events
    isOngoing: boolean;
    row: number; // Y position row for layout
    personId: Id<"people">;
    personName: string;
    claimType: ClaimType;
}

export interface TimelineLayout {
    events: TimelineEventBar[];
    people: TimelinePersonBar[];
    minYear: number;
    maxYear: number;
    eventRowCount: number;
    personRowCount: number;
    // For highlighting connections
    relationships: Doc<"relationships">[];
}

export interface TimelineLayoutInput {
    lifeEvents: LifeEventClaim[];
    people: PersonWithDates[];
    relationships: Doc<"relationships">[];
    visibleEventTypes: Set<string>;
    visiblePersonIds: Set<Id<"people">>;
}

/**
 * Format claim type for display
 */
export function formatClaimType(claimType: string): string {
    return claimType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Parse a date string (ISO format or year-only) to extract year
 */
function parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    
    // Try ISO date format (YYYY-MM-DD or YYYY)
    const yearMatch = dateStr.match(/^(\d{4})/);
    if (yearMatch) {
        return parseInt(yearMatch[1], 10);
    }
    
    return null;
}

/**
 * Pack items into rows to avoid overlaps.
 * Returns a row assignment for each item (0-indexed).
 */
function packIntoRows<T extends { startYear: number; endYear: number | null }>(
    items: T[],
    gap: number = 1 // Minimum gap in years between items on the same row
): Map<number, number> {
    const rowAssignments = new Map<number, number>();
    const rows: Array<{ end: number }[]> = [];
    
    // Sort by start year
    const sortedIndices = items
        .map((_, i) => i)
        .sort((a, b) => items[a].startYear - items[b].startYear);
    
    for (const idx of sortedIndices) {
        const item = items[idx];
        const itemEnd = item.endYear ?? item.startYear;
        
        // Find the first row where this item fits
        let assignedRow = -1;
        for (let r = 0; r < rows.length; r++) {
            const rowItems = rows[r];
            // Find row where we don't overlap with any existing item
            const maxEndInRow = Math.max(...rowItems.map(ri => ri.end), -Infinity);
            if (item.startYear > maxEndInRow + gap) {
                assignedRow = r;
                break;
            }
        }
        
        if (assignedRow === -1) {
            // Need a new row
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
 * Accounts for the text label width that extends beyond the marker.
 */
function packEventsIntoRows(events: TimelineEventBar[]): Map<number, number> {
    const rowAssignments = new Map<number, number>();
    const rows: Array<{ end: number }[]> = [];
    
    // Sort by start year
    const sortedIndices = events
        .map((_, i) => i)
        .sort((a, b) => events[a].startYear - events[b].startYear);
    
    // Estimate years needed for text label
    // At typical zoom (8px per year), 11px font is ~6.5px per character
    // We need to account for the description text that follows the title
    const DESCRIPTION_MAX_CHARS = 50;
    const estimateLabelWidth = (title: string, description?: string): number => {
        let totalChars = title.length;
        if (description) {
            // Add " - " separator (3 chars) plus truncated description
            const descLength = Math.min(description.length, DESCRIPTION_MAX_CHARS);
            totalChars += 3 + descLength;
        }
        // Use a conservative ratio: ~3 characters per year to prevent overlapping
        return Math.ceil(totalChars / 3);
    };
    
    for (const idx of sortedIndices) {
        const event = events[idx];
        const isPointEvent = event.endYear === null || event.endYear === event.startYear;
        
        // For point events, the label extends to the right, so add label width
        // For range events, the label also extends beyond the bar, so account for it
        const labelWidth = estimateLabelWidth(event.title, event.description);
        let itemEnd: number;
        
        if (isPointEvent) {
            // Point events: label starts right after the diamond marker
            itemEnd = event.startYear + labelWidth;
        } else {
            // Range events: label may extend beyond the bar
            const barEnd = event.endYear ?? event.startYear;
            itemEnd = Math.max(barEnd, event.startYear + labelWidth);
        }
        
        // Find the first row where this item fits
        let assignedRow = -1;
        const gap = 3; // Minimum gap in years (increased for better spacing)
        
        for (let r = 0; r < rows.length; r++) {
            const rowItems = rows[r];
            const maxEndInRow = Math.max(...rowItems.map(ri => ri.end), -Infinity);
            if (event.startYear > maxEndInRow + gap) {
                assignedRow = r;
                break;
            }
        }
        
        if (assignedRow === -1) {
            // Need a new row
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
    
    // Process life events (claims)
    const processedEvents: TimelineEventBar[] = [];
    
    for (const claim of lifeEvents) {
        // Skip if event type is not visible
        if (!visibleEventTypes.has(claim.claimType)) continue;
        
        // Skip if the person is not visible
        if (!visiblePersonIds.has(claim.personId)) continue;
        
        const startYear = parseYear(claim.value.date);
        if (startYear === null) continue; // Skip events without a date
        
        const endYear = parseYear(claim.value.dateEnd);
        const isOngoing = claim.value.isCurrent ?? false;
        
        // Build title from claim type and person name
        const title = `${formatClaimType(claim.claimType)} - ${claim.personName}`;
        
        processedEvents.push({
            id: claim._id,
            claim,
            title,
            description: claim.value.description,
            startYear,
            endYear: endYear ?? (isOngoing ? currentYear : null),
            isOngoing,
            row: 0, // Will be assigned later
            personId: claim.personId,
            personName: claim.personName,
            claimType: claim.claimType as ClaimType,
        });
    }
    
    // Add birth and death events from people to the events section
    for (const person of people) {
        // Skip if person is not visible
        if (!visiblePersonIds.has(person._id)) continue;
        
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        // Add birth event
        const birthYear = parseYear(person.birthDate);
        if (birthYear !== null && visibleEventTypes.has('birth')) {
            processedEvents.push({
                id: `${person._id}-birth` as Id<"claims">,
                claim: null as unknown as LifeEventClaim, // Not from a claim
                title: `Birth - ${fullName}`,
                description: undefined,
                startYear: birthYear,
                endYear: null, // Point event
                isOngoing: false,
                row: 0,
                personId: person._id,
                personName: fullName,
                claimType: 'birth',
            });
        }
        
        // Add death event
        const deathYear = parseYear(person.deathDate);
        if (deathYear !== null && visibleEventTypes.has('death')) {
            processedEvents.push({
                id: `${person._id}-death` as Id<"claims">,
                claim: null as unknown as LifeEventClaim, // Not from a claim
                title: `Death - ${fullName}`,
                description: undefined,
                startYear: deathYear,
                endYear: null, // Point event
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
        // Skip if person is not visible
        if (!visiblePersonIds.has(person._id)) continue;
        
        const birthYear = parseYear(person.birthDate);
        const hasBirthDate = birthYear !== null;
        
        // Skip people without birth dates (they can't be placed on timeline)
        if (!hasBirthDate) continue;
        
        const deathYear = parseYear(person.deathDate);
        const isOngoing = person.isLiving || person.isOngoing || (!deathYear && !person.deathDate);
        
        const fullName = [person.givenNames, person.surnames].filter(Boolean).join(' ') || 'Unknown';
        
        processedPeople.push({
            id: person._id,
            person,
            fullName,
            startYear: birthYear,
            endYear: deathYear ?? (isOngoing ? currentYear : birthYear), // If no death and not living, just show birth point
            isOngoing,
            hasBirthDate: true,
            row: 0, // Will be assigned later
        });
    }
    
    // Calculate initial time range for packing events with label considerations
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
    
    // Pack events into rows (accounting for text label width)
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
    
    // Add 25 years to the future for better readability of names at the edge
    const futureBuffer = 25;
    
    return {
        events: processedEvents,
        people: processedPeople,
        minYear: Math.floor(initialMinYear / 10) * 10, // Round down to decade
        maxYear: Math.ceil((initialMaxYear + futureBuffer) / 10) * 10, // Round up to decade, add buffer
        eventRowCount,
        personRowCount,
        relationships,
    };
}

/**
 * Get parent, children, and spouse IDs for a focused person
 */
export function getFocusedConnections(
    focusedPersonId: Id<"people"> | null,
    relationships: Doc<"relationships">[]
): { parentIds: Set<Id<"people">>; childIds: Set<Id<"people">>; spouseIds: Set<Id<"people">> } {
    const parentIds = new Set<Id<"people">>();
    const childIds = new Set<Id<"people">>();
    const spouseIds = new Set<Id<"people">>();
    
    if (!focusedPersonId) {
        return { parentIds, childIds, spouseIds };
    }
    
    for (const rel of relationships) {
        if (rel.type === 'parent_child') {
            // rel.personId1 is parent, rel.personId2 is child
            if (rel.personId2 === focusedPersonId) {
                // This person is the child, so personId1 is their parent
                parentIds.add(rel.personId1);
            } else if (rel.personId1 === focusedPersonId) {
                // This person is the parent, so personId2 is their child
                childIds.add(rel.personId2);
            }
        } else if (rel.type === 'spouse') {
            // Spouse relationship - either direction
            if (rel.personId1 === focusedPersonId) {
                spouseIds.add(rel.personId2);
            } else if (rel.personId2 === focusedPersonId) {
                spouseIds.add(rel.personId1);
            }
        }
    }
    
    return { parentIds, childIds, spouseIds };
}

/**
 * Convert year to X position in pixels
 */
export function yearToX(
    year: number,
    minYear: number,
    maxYear: number,
    chartWidth: number,
    padding: number = 60
): number {
    const availableWidth = chartWidth - padding * 2;
    const yearRange = maxYear - minYear || 1;
    return padding + ((year - minYear) / yearRange) * availableWidth;
}

/**
 * Convert X position to year
 */
export function xToYear(
    x: number,
    minYear: number,
    maxYear: number,
    chartWidth: number,
    padding: number = 60
): number {
    const availableWidth = chartWidth - padding * 2;
    const yearRange = maxYear - minYear || 1;
    return minYear + ((x - padding) / availableWidth) * yearRange;
}

/**
 * Generate tick marks for the timeline axis
 */
export function generateTimeTicks(
    minYear: number,
    maxYear: number,
    targetTickCount: number = 10
): number[] {
    const range = maxYear - minYear;
    
    // Determine a nice interval
    const rawInterval = range / targetTickCount;
    
    // Round to nice intervals: 1, 2, 5, 10, 20, 25, 50, 100, etc.
    const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const interval = niceIntervals.find(i => i >= rawInterval) ?? rawInterval;
    
    // Start at a nice round number
    const start = Math.ceil(minYear / interval) * interval;
    const ticks: number[] = [];
    
    for (let year = start; year <= maxYear; year += interval) {
        ticks.push(year);
    }
    
    return ticks;
}
