/**
 * Utility functions for Timeline Chart coordinate conversions and tick generation
 */
import type { Doc, Id } from '../../../convex/_generated/dataModel';

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
            if (rel.personId2 === focusedPersonId) {
                parentIds.add(rel.personId1);
            } else if (rel.personId1 === focusedPersonId) {
                childIds.add(rel.personId2);
            }
        } else if (rel.type === 'spouse') {
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
    const rawInterval = range / targetTickCount;
    
    const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const interval = niceIntervals.find(i => i >= rawInterval) ?? rawInterval;
    
    const start = Math.ceil(minYear / interval) * interval;
    const ticks: number[] = [];
    
    for (let year = start; year <= maxYear; year += interval) {
        ticks.push(year);
    }
    
    return ticks;
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
export function parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    
    const yearMatch = dateStr.match(/^(\d{4})/);
    if (yearMatch) {
        return parseInt(yearMatch[1], 10);
    }
    
    return null;
}
