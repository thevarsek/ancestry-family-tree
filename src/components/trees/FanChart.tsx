import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { exportSvgChart, type ChartExportFormat } from './chartExport';
import { buildFanChartLayout } from './fanChartLayout';

interface FanChartProps {
    treeId: Id<"trees">;
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    height?: number | string;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

const buildExportFileName = (value: string) => {
    const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return sanitized.length ? sanitized : 'fan-chart';
};

const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
});

const buildArcPath = (
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

const getDisplayName = (person: Doc<"people">) => {
    const name = `${person.givenNames ?? ''} ${person.surnames ?? ''}`.trim();
    return name.length ? name : 'Unknown';
};

const wrapLabelText = (value: string, maxChars: number, maxLines: number) => {
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

const getLabelFontSize = (arcLength: number) => {
    if (arcLength < 60) return 10;
    if (arcLength < 90) return 11;
    return 12;
};

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

const mixColors = (base: string, mix: string, weight: number) => {
    const baseRgb = hexToRgb(base);
    const mixRgb = hexToRgb(mix);
    const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    const r = clamp(baseRgb.r + (mixRgb.r - baseRgb.r) * weight);
    const g = clamp(baseRgb.g + (mixRgb.g - baseRgb.g) * weight);
    const b = clamp(baseRgb.b + (mixRgb.b - baseRgb.b) * weight);
    return `rgb(${r}, ${g}, ${b})`;
};

const lineagePalette = [
    '#ad8aff',
    '#ff7c1e',
    '#18c8d8',
    '#ff6f59',
    '#f6b84a',
    '#8fd1a6',
    '#c9b4ff',
];

const getLabelRotation = (angle: number) => {
    const angleDeg = (angle * 180) / Math.PI;
    const tangent = angleDeg + 90;
    const normalized = (tangent + 360) % 360;
    const flip = normalized > 90 && normalized < 270;
    return flip ? tangent + 180 : tangent;
};

export function FanChart({
    treeId,
    people,
    relationships,
    rootPersonId,
    height = 640,
    isFullscreen = false,
    onToggleFullscreen,
}: FanChartProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [resizeTick, setResizeTick] = useState(0);
    const hasCenteredRef = useRef(false);
    const panState = useRef({
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        moved: false,
        lastPanAt: 0,
        isPointerDown: false,
        isPanning: false,
    });

    const layout = useMemo(() => buildFanChartLayout({
        people,
        relationships,
        rootPersonId,
    }), [people, relationships, rootPersonId]);

    const lineageColors = useMemo(() => {
        const map = new Map<Id<"people">, string>();
        layout.lineageOrder.forEach((lineageId, index) => {
            const color = lineagePalette[index % lineagePalette.length];
            map.set(lineageId, color);
        });
        return map;
    }, [layout.lineageOrder]);

    const maxRadius = layout.rootRadius + layout.ringWidth * layout.maxDepth;
    const padding = 56;
    const chartSize = maxRadius * 2 + padding * 2;
    const center = maxRadius + padding;
    const rootLabel = getDisplayName(layout.rootPerson);
    const rootMaxChars = Math.max(Math.floor((layout.rootRadius * 1.2) / 6), 6);
    const rootLines = wrapLabelText(rootLabel, rootMaxChars, 2);
    const rootOffset = -((rootLines.length - 1) * 0.55);

    useLayoutEffect(() => {
        hasCenteredRef.current = false;
    }, [rootPersonId, chartSize]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;
        if (hasCenteredRef.current) return;

        const centerView = () => {
            const contentWidth = chartSize * scale;
            const contentHeight = chartSize * scale;
            if (contentWidth <= container.clientWidth && contentHeight <= container.clientHeight) {
                hasCenteredRef.current = true;
                return;
            }
            container.scrollLeft = Math.max((contentWidth - container.clientWidth) / 2, 0);
            container.scrollTop = Math.max((contentHeight - container.clientHeight) / 2, 0);
            hasCenteredRef.current = true;
        };

        requestAnimationFrame(centerView);
    }, [chartSize, scale, rootPersonId, resizeTick]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => {
            hasCenteredRef.current = false;
            setResizeTick((value) => value + 1);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const container = event.currentTarget;
        panState.current = {
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            moved: false,
            lastPanAt: panState.current.lastPanAt,
            isPointerDown: true,
            isPanning: false,
        };
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (!panState.current.isPointerDown) return;
        const deltaX = event.clientX - panState.current.startX;
        const deltaY = event.clientY - panState.current.startY;
        const movedEnough = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
        if (!panState.current.isPanning && movedEnough) {
            panState.current.moved = true;
            panState.current.isPanning = true;
            setIsPanning(true);
            container.setPointerCapture?.(event.pointerId);
        }
        if (!panState.current.isPanning) return;
        event.preventDefault();
        container.scrollLeft = panState.current.scrollLeft - deltaX;
        container.scrollTop = panState.current.scrollTop - deltaY;
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (panState.current.isPanning && container.hasPointerCapture?.(event.pointerId)) {
            container.releasePointerCapture(event.pointerId);
        }
        setIsPanning(false);
        panState.current.isPanning = false;
        panState.current.isPointerDown = false;
        if (panState.current.moved) {
            panState.current.lastPanAt = Date.now();
        }
        panState.current.moved = false;
    };

    const handleNodeClick = (personId: Id<"people">) => {
        if (Date.now() - panState.current.lastPanAt < 200) return;
        navigate(`/tree/${treeId}/person/${personId}`);
    };

    const clampScale = (nextScale: number) => Math.min(2.25, Math.max(0.6, nextScale));

    const applyScale = (nextScale: number) => {
        const container = containerRef.current;
        if (!container) return;
        const prevScale = scale;
        const centerX = container.scrollLeft + container.clientWidth / 2;
        const centerY = container.scrollTop + container.clientHeight / 2;
        const ratio = nextScale / prevScale;
        setScale(nextScale);
        requestAnimationFrame(() => {
            container.scrollLeft = centerX * ratio - container.clientWidth / 2;
            container.scrollTop = centerY * ratio - container.clientHeight / 2;
        });
    };

    const handleZoomIn = () => applyScale(clampScale(scale + 0.15));
    const handleZoomOut = () => applyScale(clampScale(scale - 0.15));

    const handleFit = () => {
        const container = containerRef.current;
        if (!container) return;
        const paddingSpace = 80;
        const availableWidth = Math.max(container.clientWidth - paddingSpace, 1);
        const availableHeight = Math.max(container.clientHeight - paddingSpace, 1);
        const nextScale = clampScale(Math.min(availableWidth / chartSize, availableHeight / chartSize));
        setScale(nextScale);
        requestAnimationFrame(() => {
            container.scrollLeft = (chartSize * nextScale - container.clientWidth) / 2;
            container.scrollTop = (chartSize * nextScale - container.clientHeight) / 2;
        });
    };

    const handleCenter = () => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollLeft = (chartSize * scale - container.clientWidth) / 2;
        container.scrollTop = (chartSize * scale - container.clientHeight) / 2;
    };

    const handleExport = async (format: ChartExportFormat) => {
        if (!svgRef.current) return;
        const fileNameBase = `fan-chart-${getDisplayName(layout.rootPerson)}`;
        const exportScale = Math.max(scale, 1);
        await exportSvgChart(format, {
            svg: svgRef.current,
            fileName: buildExportFileName(fileNameBase),
            width: chartSize,
            height: chartSize,
            scale: exportScale,
        });
    };

    const chartHeight = typeof height === 'number' ? `${height}px` : height;

    return (
        <div className="card p-4 flex flex-col" style={{ height: chartHeight, overflow: 'hidden' }}>
            <div
                className="flex items-center justify-between mb-3 text-xs text-muted"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={(event) => event.stopPropagation()}
            >
                <span>Drag to pan · Scrollbars for precise moves</span>
                <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('png')}>Export PNG</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport('pdf')}>Export PDF</button>
                    {onToggleFullscreen && (
                        <button className="btn btn-secondary btn-sm" onClick={onToggleFullscreen}>
                            {isFullscreen ? 'Exit full screen' : 'Full screen'}
                        </button>
                    )}
                    <span className="text-muted">|</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomOut}>-</button>
                    <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomIn}>+</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleFit}>Fit</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCenter}>Center</button>
                </div>
            </div>
            <div
                ref={containerRef}
                className="flex-1 overflow-auto fan-chart-scroll"
                style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none', minHeight: 0, userSelect: 'none' }}
                data-testid="fan-chart-scroll"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="fan-chart-canvas">
                    <div
                        ref={contentRef}
                        style={{
                            width: chartSize * scale,
                            height: chartSize * scale,
                            display: 'inline-block',
                            overflow: 'hidden',
                        }}
                    >
                        <svg
                            ref={svgRef}
                            width={chartSize}
                            height={chartSize}
                            className="fan-chart-svg"
                            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                        >
                        <defs>
                            <linearGradient id="fan-chart-root" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--color-accent)" />
                                <stop offset="100%" stopColor="var(--color-secondary)" />
                            </linearGradient>
                        </defs>

                        {layout.nodes.map((node) => {
                            const innerRadius = layout.rootRadius + layout.ringWidth * (node.depth - 1);
                            const outerRadius = layout.rootRadius + layout.ringWidth * node.depth;
                            const midAngle = (node.angleStart + node.angleEnd) / 2;
                            const midRadius = innerRadius + (outerRadius - innerRadius) * 0.52;
                            const labelPoint = polarToCartesian(center, center, midRadius, midAngle);
                            const arcLength = Math.max((node.angleEnd - node.angleStart) * midRadius - 24, 0);
                            const fontSize = getLabelFontSize(arcLength);
                            const maxChars = Math.max(Math.floor(arcLength / (fontSize * 0.6)), 4);
                            const labelLines = wrapLabelText(getDisplayName(node.person), maxChars, 2);
                            const rotation = getLabelRotation(midAngle);
                            const isHighlighted = layout.lineageIds.has(node.id);
                            const baseColor = lineageColors.get(node.lineageRootId) ?? '#ad8aff';
                            const depthMix = Math.min(0.5, node.depth * 0.12);
                            const fillColor = mixColors(baseColor, '#ffffff', depthMix);
                            const showStatus = arcLength > 42;
                            const nameOffset = -((labelLines.length - 1) * 0.6);

                            return (
                                <g
                                    key={node.id}
                                    data-person-id={node.id}
                                    className="fan-chart-node"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleNodeClick(node.id);
                                    }}
                                >
                                    <path
                                        d={buildArcPath(
                                            center,
                                            center,
                                            innerRadius,
                                            outerRadius,
                                            node.angleStart,
                                            node.angleEnd
                                        )}
                                        className={`fan-chart-segment ${isHighlighted ? 'is-highlighted' : 'is-dimmed'}`}
                                        style={{
                                            fill: fillColor,
                                            stroke: baseColor,
                                        }}
                                    />
                                    <text
                                        x={labelPoint.x}
                                        y={labelPoint.y}
                                        textAnchor="middle"
                                        className={`fan-chart-label ${isHighlighted ? 'is-highlighted' : 'is-dimmed'}`}
                                        transform={`rotate(${rotation} ${labelPoint.x} ${labelPoint.y})`}
                                        style={{ fontSize: `${fontSize}px` }}
                                    >
                                        {labelLines.map((line, index) => (
                                            <tspan
                                                key={`${node.id}-line-${index}`}
                                                x={labelPoint.x}
                                                dy={index === 0 ? `${nameOffset}em` : '1.1em'}
                                            >
                                                {line}
                                            </tspan>
                                        ))}
                                        {showStatus && (
                                            <tspan x={labelPoint.x} dy="1.1em" className="fan-chart-status">
                                                {node.person.isLiving ? 'Living' : 'Deceased'}
                                            </tspan>
                                        )}
                                    </text>
                                </g>
                            );
                        })}

                        <g
                            className="fan-chart-node"
                            data-person-id={layout.rootPerson._id}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleNodeClick(layout.rootPerson._id);
                            }}
                        >
                            <circle
                                cx={center}
                                cy={center}
                                r={layout.rootRadius - 4}
                                className="fan-chart-root"
                                fill="url(#fan-chart-root)"
                            />
                            <text
                                x={center}
                                y={center}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fan-chart-root-label"
                            >
                                {rootLines.map((line, index) => (
                                    <tspan key={`root-line-${index}`} x={center} dy={index === 0 ? `${rootOffset}em` : '1.1em'}>
                                        {line}
                                    </tspan>
                                ))}
                                <tspan x={center} dy="1.2em" className="fan-chart-status">
                                    {layout.rootPerson.isLiving ? 'Living' : 'Deceased'}
                                </tspan>
                            </text>
                        </g>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
