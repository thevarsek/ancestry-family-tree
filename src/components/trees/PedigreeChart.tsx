import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { exportSvgChart, type ChartExportFormat } from './chartExport';
import { renderParentLinks } from './pedigreeLinks';
import { buildPedigreeLayout } from './pedigreeLayout';
import type { PersonWithPhoto } from './pedigreeTypes';

interface PedigreeChartProps {
    treeId: Id<"trees">;
    people: PersonWithPhoto[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    height?: number | string;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

const buildExportFileName = (value: string) => {
    const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return sanitized.length ? sanitized : 'family-tree';
};

export function PedigreeChart({
    treeId,
    people,
    relationships,
    rootPersonId,
    height = 600,
    isFullscreen = false,
    onToggleFullscreen,
}: PedigreeChartProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [scale, setScale] = useState(1);
    const panState = useRef({
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        moved: false,
        lastPanAt: 0,
        isPointerDown: false,
        isPanning: false
    });

    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 100;
    const HORIZONTAL_GAP = 80;

    const chartData = useMemo(() => buildPedigreeLayout({
        people,
        relationships,
        rootPersonId,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
        horizontalGap: HORIZONTAL_GAP
    }), [people, relationships, rootPersonId]);

    const rootPerson = people.find((person) => person._id === rootPersonId);

    if (!chartData.nodes.length) {
        return <div className="p-8 text-center text-muted">No data available for this person.</div>;
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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
            isPanning: false
        };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
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
        if (Date.now() - panState.current.lastPanAt < 200) {
            return;
        }
        navigate(`/tree/${treeId}/person/${personId}`);
    };

    const clampScale = (nextScale: number) => Math.min(2.5, Math.max(0.5, nextScale));

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
        const padding = 80;
        const availableWidth = Math.max(container.clientWidth - padding, 1);
        const availableHeight = Math.max(container.clientHeight - padding, 1);
        const nextScale = clampScale(Math.min(availableWidth / chartData.width, availableHeight / chartData.height));
        setScale(nextScale);
        requestAnimationFrame(() => {
            container.scrollLeft = (chartData.width * nextScale - container.clientWidth) / 2;
            container.scrollTop = (chartData.height * nextScale - container.clientHeight) / 2;
        });
    };

    const handleCenter = () => {
        const container = containerRef.current;
        if (!container) return;
        const rootNode = chartData.nodes.find((node) => node.id === rootPersonId);
        if (!rootNode) return;
        const targetX = (rootNode.x + NODE_WIDTH / 2) * scale;
        const targetY = (rootNode.y + NODE_HEIGHT / 2) * scale;
        container.scrollLeft = targetX - container.clientWidth / 2;
        container.scrollTop = targetY - container.clientHeight / 2;
    };

    const handleExport = async (format: ChartExportFormat) => {
        if (!svgRef.current) return;
        const exportScale = Math.max(scale, 1);
        const fileNameBase = rootPerson
            ? `family-tree-${rootPerson.givenNames} ${rootPerson.surnames}`
            : 'family-tree';
        await exportSvgChart(format, {
            svg: svgRef.current,
            fileName: buildExportFileName(fileNameBase),
            width: chartData.width,
            height: chartData.height,
            scale: exportScale,
        });
    };

    const spouseLinks = chartData.links.filter(link => link.type === 'spouse');
    const parentLinks = chartData.links.filter(link => link.type === 'parent');
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
                className="flex-1 overflow-auto"
                style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none', minHeight: 0, userSelect: 'none' }}
                data-testid="pedigree-chart-scroll"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div style={{ width: chartData.width * scale, height: chartData.height * scale, display: 'inline-block', overflow: 'hidden' }}>
                    <svg
                        ref={svgRef}
                        width={chartData.width}
                        height={chartData.height}
                        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden' }}
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="0"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-border)" />
                            </marker>
                        </defs>

                        {spouseLinks.map((link, index) => {
                            const fromX = link.from.x + NODE_WIDTH / 2;
                            const fromY = link.from.y + NODE_HEIGHT / 2;
                            const toX = link.to.x + NODE_WIDTH / 2;
                            const toY = link.to.y + NODE_HEIGHT / 2;
                            const midX = (fromX + toX) / 2;
                            const midY = (fromY + toY) / 2;

                            return (
                                <g key={`spouse-link-${index}`}>
                                    <line
                                        x1={fromX}
                                        y1={fromY}
                                        x2={toX}
                                        y2={toY}
                                        stroke={link.isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
                                        strokeWidth={link.isHighlighted ? 3 : 2}
                                        opacity={link.isHighlighted ? 0.95 : 0.7}
                                        strokeDasharray={link.isHighlighted ? 'none' : '5,5'}
                                    />
                                    <circle
                                        cx={midX}
                                        cy={midY - 15}
                                        r="8"
                                        fill="var(--color-surface)"
                                        stroke={link.isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
                                        opacity={0.9}
                                        strokeDasharray="2,2"
                                    />
                                    <text
                                        x={midX}
                                        y={midY - 12}
                                        textAnchor="middle"
                                        fontSize="8"
                                        fill="var(--color-text-primary)"
                                        fontWeight="bold"
                                    >
                                        S
                                    </text>
                                </g>
                            );
                        })}

                        {renderParentLinks({
                            parentLinks,
                            families: chartData.families,
                            familyByChild: chartData.familyByChild,
                            nodeById: chartData.nodeById,
                            nodeWidth: NODE_WIDTH,
                            nodeHeight: NODE_HEIGHT,
                            horizontalGap: HORIZONTAL_GAP
                        })}

                        {chartData.nodes.map((node) => (
                            <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                className="cursor-pointer transition-transform"
                                data-person-id={node.id}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleNodeClick(node.id);
                                }}
                            >
                                <rect
                                    width={NODE_WIDTH}
                                    height={NODE_HEIGHT}
                                    rx="12"
                                    ry="12"
                                    fill="var(--color-surface)"
                                    stroke={node.id === rootPersonId ? 'var(--color-accent)' : 'var(--color-border)'}
                                    strokeWidth={node.id === rootPersonId ? '3' : '1'}
                                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                                />
                                {node.person.profilePhotoUrl ? (
                                    <image
                                        href={node.person.profilePhotoUrl}
                                        x={NODE_WIDTH / 2 - 16}
                                        y={8}
                                        width={32}
                                        height={32}
                                        style={{
                                            clipPath: 'circle(16px at center)',
                                            transformBox: 'fill-box',
                                            transformOrigin: '0 0',
                                            transform: node.person.profilePhotoZoom && node.person.profilePhotoFocusX !== undefined && node.person.profilePhotoFocusY !== undefined
                                                ? `translate(${(32 - 32 * node.person.profilePhotoZoom) * node.person.profilePhotoFocusX}px, ${(32 - 32 * node.person.profilePhotoZoom) * node.person.profilePhotoFocusY}px) scale(${node.person.profilePhotoZoom})`
                                                : undefined
                                        }}
                                        preserveAspectRatio="xMidYMid slice"
                                    />
                                ) : (
                                    <g>
                                        <circle
                                            cx={NODE_WIDTH / 2}
                                            cy={24}
                                            r="16"
                                            fill="var(--color-accent-subtle)"
                                            stroke="var(--color-border)"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={NODE_WIDTH / 2}
                                            y={29}
                                            textAnchor="middle"
                                            className="font-bold text-sm"
                                            fill="var(--color-text-primary)"
                                        >
                                            {(node.person.givenNames?.[0] || '') + (node.person.surnames?.[0] || '')}
                                        </text>
                                    </g>
                                )}
                                <text
                                    x={NODE_WIDTH / 2}
                                    y={node.person.profilePhotoUrl ? 60 : 55}
                                    textAnchor="middle"
                                    className="font-bold text-sm"
                                    fill="var(--color-text-primary)"
                                >
                                    {node.person.givenNames} {node.person.surnames}
                                </text>
                                <text
                                    x={NODE_WIDTH / 2}
                                    y={node.person.profilePhotoUrl ? 75 : 70}
                                    textAnchor="middle"
                                    className="text-xs"
                                    fill="var(--color-text-muted)"
                                >
                                    {node.person.isLiving ? 'Living' : 'Deceased'}
                                </text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
}
