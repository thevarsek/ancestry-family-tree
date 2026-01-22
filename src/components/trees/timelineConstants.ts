/**
 * Constants and colors for the Timeline Chart component.
 */

// Re-export buildExportFileName from chartExport for backward compatibility
export { buildExportFileName } from './chartExport';

// Layout dimensions
export const EVENT_ROW_HEIGHT = 28;
export const PERSON_ROW_HEIGHT = 32;
export const BAR_HEIGHT = 20;
export const PERSON_BAR_HEIGHT = 24;
export const EVENT_SECTION_MIN_HEIGHT = 60;
export const AXIS_HEIGHT = 40;
export const LEGEND_HEIGHT = 30;
export const PADDING_X = 60;
export const DESCRIPTION_MAX_CHARS = 50;

// Colors - using fan chart palette style
export const EVENT_BAR_COLOR = '#ad8aff'; // Purple from lineage palette
export const PERSON_BAR_COLOR = '#18c8d8'; // Teal from lineage palette
export const FOCUS_COLOR = '#ff7c1e'; // Orange - focused person
export const PARENT_COLOR = '#f6b84a'; // Gold/Yellow - parents
export const SPOUSE_COLOR = '#ad8aff'; // Purple - spouse
export const CHILD_COLOR = '#8fd1a6'; // Green - children

/**
 * Tooltip state for timeline chart elements.
 */
export interface TooltipState {
    x: number;
    y: number;
    lines: string[];
}

/**
 * Legend item configuration.
 */
export interface LegendItem {
    color: string;
    label: string;
}

/**
 * Get legend items based on whether there's a focused person.
 */
export function getLegendItems(hasFocusedPerson: boolean): LegendItem[] {
    const items: LegendItem[] = [
        { color: EVENT_BAR_COLOR, label: 'Life Events' },
        { color: PERSON_BAR_COLOR, label: 'People' },
    ];
    
    if (hasFocusedPerson) {
        items.push(
            { color: FOCUS_COLOR, label: 'Focused' },
            { color: PARENT_COLOR, label: 'Parents' },
            { color: SPOUSE_COLOR, label: 'Spouse' },
            { color: CHILD_COLOR, label: 'Children' },
        );
    }
    
    return items;
}
