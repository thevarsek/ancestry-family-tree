/**
 * Utility functions for FanChart rendering
 */
import type { Doc, Id } from '../../../convex/_generated/dataModel';

/** Props for the FanChart component */
export interface FanChartProps {
    treeId: Id<"trees">;
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    height?: number | string;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

/** Convert polar coordinates to cartesian */
export const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
});

/** Build an SVG arc path for a fan segment */
export const buildArcPath = (
    cx: number,
    cy: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
) => {
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
    const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
        'Z',
    ].join(' ');
};

/** Get display name for a person */
export const getDisplayName = (person: Doc<"people">) => {
    const name = `${person.givenNames ?? ''} ${person.surnames ?? ''}`.trim();
    return name.length ? name : 'Unknown';
};

/** Wrap label text to fit within arc */
export const wrapLabelText = (value: string, maxChars: number, maxLines: number) => {
    const words = value.split(' ').filter(Boolean);
    if (!words.length) return ['Unknown'];
    const lines: string[] = [];
    let current = '';

    const pushLine = (line: string) => {
        if (line) lines.push(line);
    };

    words.forEach((word, index) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
            current = candidate;
            return;
        }

        if (!current) {
            const sliced = word.match(new RegExp(`.{1,${Math.max(maxChars - 1, 3)}}`, 'g')) ?? [word];
            sliced.forEach((segment) => {
                if (lines.length < maxLines - 1) {
                    lines.push(segment);
                } else {
                    current = segment;
                }
            });
            return;
        }

        pushLine(current);
        current = word;

        if (lines.length >= maxLines - 1 && index < words.length - 1) {
            current = `${current} ${words.slice(index + 1).join(' ')}`;
        }
    });

    pushLine(current);

    if (lines.length > maxLines) {
        return lines.slice(0, maxLines);
    }

    if (lines.length === maxLines && lines[maxLines - 1].length > maxChars) {
        lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(maxChars - 3, 3))}...`;
    }

    return lines;
};

/** Get font size based on arc length */
export const getLabelFontSize = (arcLength: number) => {
    if (arcLength < 60) return 10;
    if (arcLength < 90) return 11;
    return 12;
};

/** Convert hex color to RGB object */
const hexToRgb = (hex: string) => {
    const sanitized = hex.replace('#', '');
    const expanded = sanitized.length === 3
        ? sanitized.split('').map((char) => char + char).join('')
        : sanitized;
    const value = Number.parseInt(expanded, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

/** Mix two colors with a weight */
export const mixColors = (base: string, mix: string, weight: number) => {
    const baseRgb = hexToRgb(base);
    const mixRgb = hexToRgb(mix);
    const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    const r = clamp(baseRgb.r + (mixRgb.r - baseRgb.r) * weight);
    const g = clamp(baseRgb.g + (mixRgb.g - baseRgb.g) * weight);
    const b = clamp(baseRgb.b + (mixRgb.b - baseRgb.b) * weight);
    return `rgb(${r}, ${g}, ${b})`;
};

/** Color palette for lineages */
export const lineagePalette = [
    '#ad8aff',
    '#ff7c1e',
    '#18c8d8',
    '#ff6f59',
    '#f6b84a',
    '#8fd1a6',
    '#c9b4ff',
];

/** Calculate label rotation angle */
export const getLabelRotation = (angle: number) => {
    const angleDeg = (angle * 180) / Math.PI;
    const tangent = angleDeg + 90;
    const normalized = (tangent + 360) % 360;
    const flip = normalized > 90 && normalized < 270;
    return flip ? tangent + 180 : tangent;
};

// Re-export buildExportFileName from chartExport for backward compatibility
export { buildExportFileName } from './chartExport';
