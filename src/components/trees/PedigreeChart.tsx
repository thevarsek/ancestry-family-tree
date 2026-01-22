import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { usePanZoom } from '../../hooks/usePanZoom';
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
    const svgRef = useRef<SVGSVGElement | null>(null);

    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 100;
    const HORIZONTAL_GAP = 80;
    const PHOTO_SIZE = 32;
    const PHOTO_RADIUS = PHOTO_SIZE / 2;

    const chartData = useMemo(() => buildPedigreeLayout({
        people,
        relationships,
        rootPersonId,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
        horizontalGap: HORIZONTAL_GAP
    }), [people, relationships, rootPersonId]);

    const rootPerson = people.find((person) => person._id === rootPersonId);

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
        centerOn,
        wasRecentlyPanning,
    } = usePanZoom({
        contentWidth: chartData.width,
        contentHeight: chartData.height,
        minScale: 0.5,
        maxScale: 2.5,
        fitPadding: 80,
    });

    if (!chartData.nodes.length) {
        return <div className="p-8 text-center text-muted">No data available for this person.</div>;
    }

    const handleNodeClick = (personId: Id<"people">) => {
        if (wasRecentlyPanning()) return;
        navigate(`/tree/${treeId}/person/${personId}`);
    };

    const getPhotoSizing = (person: PersonWithPhoto) => {
        const hasFocus =
            person.profilePhotoZoom !== undefined &&
            person.profilePhotoFocusX !== undefined &&
            person.profilePhotoFocusY !== undefined;

        if (!hasFocus) {
            return {
                coverWidth: PHOTO_SIZE,
                coverHeight: PHOTO_SIZE,
                translateX: 0,
                translateY: 0,
                zoom: 1
            };
        }

        const imageWidth = person.profilePhotoWidth && person.profilePhotoWidth > 0
            ? person.profilePhotoWidth
            : PHOTO_SIZE;
        const imageHeight = person.profilePhotoHeight && person.profilePhotoHeight > 0
            ? person.profilePhotoHeight
            : PHOTO_SIZE;
        const zoom = person.profilePhotoZoom ?? 1;
        const focusX = person.profilePhotoFocusX ?? 0.5;
        const focusY = person.profilePhotoFocusY ?? 0.5;

        const coverScale = Math.max(PHOTO_SIZE / imageWidth, PHOTO_SIZE / imageHeight);
        const coverWidth = imageWidth * coverScale;
        const coverHeight = imageHeight * coverScale;
        const scaledWidth = coverWidth * zoom;
        const scaledHeight = coverHeight * zoom;
        const maxTranslateX = PHOTO_SIZE - scaledWidth;
        const maxTranslateY = PHOTO_SIZE - scaledHeight;
        const canPanX = maxTranslateX < 0;
        const canPanY = maxTranslateY < 0;
        const translateX = canPanX ? maxTranslateX * focusX : (PHOTO_SIZE - scaledWidth) / 2;
        const translateY = canPanY ? maxTranslateY * focusY : (PHOTO_SIZE - scaledHeight) / 2;

        return {
            coverWidth,
            coverHeight,
            translateX,
            translateY,
            zoom
        };
    };

    const handleCenter = () => {
        const rootNode = chartData.nodes.find((node) => node.id === rootPersonId);
        if (!rootNode) return;
        const targetX = rootNode.x + NODE_WIDTH / 2;
        const targetY = rootNode.y + NODE_HEIGHT / 2;
        centerOn(targetX, targetY);
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
                data-testid="pedigree-chart-scroll"
                {...containerProps}
            >
                <div style={{ width: scaledWidth, height: scaledHeight, display: 'inline-block', overflow: 'hidden' }}>
                    <svg
                        ref={svgRef}
                        width={chartData.width}
                        height={chartData.height}
                        style={{ ...svgStyle, overflow: 'hidden' }}
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
                                    (() => {
                                        const photoSizing = getPhotoSizing(node.person);
                                        const photoX = NODE_WIDTH / 2 - PHOTO_RADIUS;
                                        const photoY = 8;
                                        const clipId = `photo-clip-${node.id}`;
                                        return (
                                            <>
                                                <defs>
                                                    <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                                                        <circle
                                                            cx={photoX + PHOTO_RADIUS}
                                                            cy={photoY + PHOTO_RADIUS}
                                                            r={PHOTO_RADIUS}
                                                        />
                                                    </clipPath>
                                                </defs>
                                                <image
                                                    href={node.person.profilePhotoUrl}
                                                    x={photoX}
                                                    y={photoY}
                                                    width={photoSizing.coverWidth}
                                                    height={photoSizing.coverHeight}
                                                    clipPath={`url(#${clipId})`}
                                                    preserveAspectRatio="xMidYMid slice"
                                                    style={photoSizing.zoom !== 1 || photoSizing.translateX !== 0 || photoSizing.translateY !== 0
                                                        ? {
                                                            transformBox: 'fill-box',
                                                            transformOrigin: '0 0',
                                                            transform: `translate(${photoSizing.translateX}px, ${photoSizing.translateY}px) scale(${photoSizing.zoom})`
                                                        }
                                                        : undefined}
                                                />
                                            </>
                                        );
                                    })()
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
