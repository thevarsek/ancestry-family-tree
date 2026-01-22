import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Id } from '../../../convex/_generated/dataModel';
import { usePanZoom } from '../../hooks/usePanZoom';
import { exportSvgChart, type ChartExportFormat } from './chartExport';
import { buildFanChartLayout } from './fanChartLayout';
import {
    polarToCartesian,
    buildArcPath,
    getDisplayName,
    wrapLabelText,
    getLabelFontSize,
    mixColors,
    lineagePalette,
    getLabelRotation,
    buildExportFileName,
} from './fanChartUtils';
import type { FanChartProps } from './fanChartUtils';

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
    const svgRef = useRef<SVGSVGElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [resizeTick, setResizeTick] = useState(0);
    const hasCenteredRef = useRef(false);

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

    // Pan/zoom via shared hook
    const {
        scale,
        containerRef,
        containerProps,
        svgStyle,
        scaledWidth,
        scaledHeight,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        fit: handleFit,
        center: handleCenter,
        wasRecentlyPanning,
    } = usePanZoom({
        contentWidth: chartSize,
        contentHeight: chartSize,
        minScale: 0.6,
        maxScale: 2.25,
        fitPadding: 80,
    });

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
    }, [chartSize, scale, rootPersonId, resizeTick, containerRef]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => {
            hasCenteredRef.current = false;
            setResizeTick((value) => value + 1);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [containerRef]);

    const handleNodeClick = (personId: Id<"people">) => {
        if (wasRecentlyPanning()) return;
        navigate(`/tree/${treeId}/person/${personId}`);
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
    // For percentage-based heights (like "100%"), we need flex to properly fill the space
    const useFlexGrow = height === '100%';

    return (
        <div 
            className="card p-4 flex flex-col" 
            style={{ 
                height: useFlexGrow ? undefined : chartHeight,
                flex: useFlexGrow ? 1 : undefined,
                minHeight: useFlexGrow ? 0 : undefined,
                overflow: 'hidden' 
            }}
        >
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
                data-testid="fan-chart-scroll"
                {...containerProps}
            >
                <div className="fan-chart-canvas">
                    <div
                        ref={contentRef}
                        style={{
                            width: scaledWidth,
                            height: scaledHeight,
                            display: 'inline-block',
                            overflow: 'hidden',
                        }}
                    >
                        <svg
                            ref={svgRef}
                            width={chartSize}
                            height={chartSize}
                            className="fan-chart-svg"
                            style={svgStyle}
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
