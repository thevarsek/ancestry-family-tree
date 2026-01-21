import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

interface PedigreeChartProps {
    treeId: Id<"trees">;
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
}

type LinkType = 'parent' | 'spouse';

interface ChartNode {
    id: Id<"people">;
    person: Doc<"people">;
    x: number;
    y: number;
    generation: number;
}

interface ChartLink {
    from: ChartNode;
    to: ChartNode;
    type: LinkType;
}

export function PedigreeChart({ treeId, people, relationships, rootPersonId }: PedigreeChartProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [scale, setScale] = useState(1);
    const panState = useRef({
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        moved: false,
        lastPanAt: 0,
        targetPersonId: null as Id<"people"> | null
    });

    // Layout constants
    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 80;
    const HORIZONTAL_GAP = 100;
    const VERTICAL_GAP = 40;

    const chartData = useMemo(() => {
        const peopleById = new Map(people.map(person => [person._id, person]));
        const parentsByChild = new Map<Id<"people">, Id<"people">[]>();
        const childrenByParent = new Map<Id<"people">, Id<"people">[]>();
        const spousesByPerson = new Map<Id<"people">, Id<"people">[]>();

        relationships.forEach((relationship) => {
            if (relationship.type === 'parent_child') {
                const parentList = parentsByChild.get(relationship.personId2) ?? [];
                parentList.push(relationship.personId1);
                parentsByChild.set(relationship.personId2, parentList);

                const childList = childrenByParent.get(relationship.personId1) ?? [];
                childList.push(relationship.personId2);
                childrenByParent.set(relationship.personId1, childList);
            }

            if (relationship.type === 'spouse' || relationship.type === 'partner') {
                const left = spousesByPerson.get(relationship.personId1) ?? [];
                left.push(relationship.personId2);
                spousesByPerson.set(relationship.personId1, left);

                const right = spousesByPerson.get(relationship.personId2) ?? [];
                right.push(relationship.personId1);
                spousesByPerson.set(relationship.personId2, right);
            }

        });

        const generationById = new Map<Id<"people">, number>();
        const queue: Id<"people">[] = [rootPersonId];
        generationById.set(rootPersonId, 0);

        while (queue.length) {
            const currentId = queue.shift();
            if (!currentId) continue;
            const generation = generationById.get(currentId) ?? 0;

            const parents = parentsByChild.get(currentId) ?? [];
            parents.forEach((parentId) => {
                if (!generationById.has(parentId)) {
                    generationById.set(parentId, generation - 1);
                    queue.push(parentId);
                }
            });

            const children = childrenByParent.get(currentId) ?? [];
            children.forEach((childId) => {
                if (!generationById.has(childId)) {
                    generationById.set(childId, generation + 1);
                    queue.push(childId);
                }
            });

            const spouses = spousesByPerson.get(currentId) ?? [];
            spouses.forEach((spouseId) => {
                if (!generationById.has(spouseId)) {
                    generationById.set(spouseId, generation);
                    queue.push(spouseId);
                }
            });

        }

        const nodesByGeneration = new Map<number, ChartNode[]>();
        generationById.forEach((generation, personId) => {
            const person = peopleById.get(personId);
            if (!person) return;
            const node: ChartNode = {
                id: personId,
                person,
                x: generation * (NODE_WIDTH + HORIZONTAL_GAP),
                y: 0,
                generation
            };
            const list = nodesByGeneration.get(generation) ?? [];
            list.push(node);
            nodesByGeneration.set(generation, list);
        });

        const generationKeys = [...nodesByGeneration.keys()].sort((a, b) => a - b);
        const orderById = new Map<Id<"people">, number>();

        generationKeys.forEach((generation) => {
            const group = nodesByGeneration.get(generation) ?? [];
            group.sort((a, b) => {
                const aName = `${a.person.surnames ?? ''} ${a.person.givenNames ?? ''}`.trim();
                const bName = `${b.person.surnames ?? ''} ${b.person.givenNames ?? ''}`.trim();
                return aName.localeCompare(bName);
            });
            group.forEach((node, index) => {
                orderById.set(node.id, index);
            });
        });

        const getNeighborOrders = (personId: Id<"people">, targetGeneration: number) => {
            const neighbors: Id<"people">[] = [];
            const parents = parentsByChild.get(personId) ?? [];
            const children = childrenByParent.get(personId) ?? [];

            parents.forEach((parentId) => {
                if (generationById.get(parentId) === targetGeneration) {
                    neighbors.push(parentId);
                }
            });
            children.forEach((childId) => {
                if (generationById.get(childId) === targetGeneration) {
                    neighbors.push(childId);
                }
            });

            return neighbors
                .map((neighborId) => orderById.get(neighborId))
                .filter((order): order is number => order !== undefined);
        };

        const buildSpouseClusters = (generation: number): ChartNode[][] => {
            const group = nodesByGeneration.get(generation) ?? [];
            if (group.length < 2) return group.map((node) => [node]);
            const byId = new Map(group.map((node) => [node.id, node]));
            const visited = new Set<Id<"people">>();
            const clusters: ChartNode[][] = [];

            group.forEach((node) => {
                if (visited.has(node.id)) return;
                const stack = [node.id];
                const cluster: ChartNode[] = [];

                while (stack.length) {
                    const currentId = stack.pop();
                    if (!currentId || visited.has(currentId)) continue;
                    visited.add(currentId);
                    const currentNode = byId.get(currentId);
                    if (currentNode) cluster.push(currentNode);

                    const spouses = spousesByPerson.get(currentId) ?? [];
                    spouses.forEach((spouseId) => {
                        if (generationById.get(spouseId) === generation && byId.has(spouseId)) {
                            stack.push(spouseId);
                        }
                    });
                }

                clusters.push(cluster);
            });

            return clusters;
        };

        const sortGeneration = (generation: number, neighborGeneration: number) => {
            const group = nodesByGeneration.get(generation);
            if (!group || group.length < 2) return;
            const originalOrder = new Map(group.map((node, index) => [node.id, index]));

            const clusterOrderValue = (cluster: ChartNode[]) => {
                const orders = cluster.flatMap((node) => getNeighborOrders(node.id, neighborGeneration));
                if (!orders.length) return null;
                return orders.reduce((sum, val) => sum + val, 0) / orders.length;
            };

            const sortWithinCluster = (cluster: ChartNode[]) =>
                [...cluster].sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));

            const clusters = buildSpouseClusters(generation).map((cluster) => sortWithinCluster(cluster));
            const sortedClusters = [...clusters].sort((a, b) => {
                const aAvg = clusterOrderValue(a);
                const bAvg = clusterOrderValue(b);
                const aOriginal = Math.min(...a.map((node) => originalOrder.get(node.id) ?? 0));
                const bOriginal = Math.min(...b.map((node) => originalOrder.get(node.id) ?? 0));

                if (aAvg === null && bAvg === null) return aOriginal - bOriginal;
                if (aAvg === null) return 1;
                if (bAvg === null) return -1;
                if (aAvg === bAvg) return aOriginal - bOriginal;
                return aAvg - bAvg;
            });

            const sorted = sortedClusters.flatMap((cluster) => cluster);
            nodesByGeneration.set(generation, sorted);
            sorted.forEach((node, index) => {
                orderById.set(node.id, index);
            });
        };

        // Run extra sweeps to improve crossing minimization while keeping spouses together
        for (let i = 0; i < 6; i += 1) {
            generationKeys.forEach((generation) => {
                sortGeneration(generation, generation - 1);
            });
            [...generationKeys].reverse().forEach((generation) => {
                sortGeneration(generation, generation + 1);
            });
        }

        const nodes: ChartNode[] = [];
        generationKeys.forEach((generation) => {
            const group = nodesByGeneration.get(generation) ?? [];
            const groupHeight = (group.length - 1) * (NODE_HEIGHT + VERTICAL_GAP);
            group.forEach((node, index) => {
                node.y = index * (NODE_HEIGHT + VERTICAL_GAP) - groupHeight / 2;
                nodes.push(node);
            });
        });

        const nodeById = new Map(nodes.map(node => [node.id, node]));
        const links: ChartLink[] = [];

        relationships.forEach((relationship) => {
            const from = nodeById.get(relationship.personId1);
            const to = nodeById.get(relationship.personId2);
            if (!from || !to) return;

            if (relationship.type === 'parent_child') {
                links.push({ from, to, type: 'parent' });
            } else if (relationship.type === 'spouse' || relationship.type === 'partner') {
                links.push({ from, to, type: 'spouse' });
            }
        });

        if (!nodes.length) {
            return { nodes: [], links: [], width: 0, height: 0 };
        }

        const minX = Math.min(...nodes.map(node => node.x));
        const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH));
        const minY = Math.min(...nodes.map(node => node.y));
        const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT));
        const padding = 200; // Increased padding to prevent cutoff
        const offsetX = padding - minX;
        const offsetY = padding - minY;

        const positionedNodes = nodes.map(node => ({
            ...node,
            x: node.x + offsetX,
            y: node.y + offsetY
        }));

        const positionedLinks = links.map(link => ({
            ...link,
            from: {
                ...link.from,
                x: link.from.x + offsetX,
                y: link.from.y + offsetY
            },
            to: {
                ...link.to,
                x: link.to.x + offsetX,
                y: link.to.y + offsetY
            }
        }));

        return {
            nodes: positionedNodes,
            links: positionedLinks,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        };
    }, [people, relationships, rootPersonId]);

    if (!chartData.nodes.length) {
        return <div className="p-8 text-center text-muted">No data available for this person.</div>;
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;

        // Find if we clicked a node
        let target = event.target as HTMLElement;
        let personId: string | null = null;
        while (target && target !== container) {
            if (target.getAttribute('data-person-id')) {
                personId = target.getAttribute('data-person-id');
                break;
            }
            target = target.parentElement as HTMLElement;
        }

        container.setPointerCapture(event.pointerId);
        panState.current = {
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            moved: false,
            lastPanAt: panState.current.lastPanAt,
            targetPersonId: personId as Id<"people"> | null
        };
        setIsPanning(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container || !isPanning) return;
        const deltaX = event.clientX - panState.current.startX;
        const deltaY = event.clientY - panState.current.startY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            panState.current.moved = true;
        }
        container.scrollLeft = panState.current.scrollLeft - deltaX;
        container.scrollTop = panState.current.scrollTop - deltaY;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        container.releasePointerCapture(event.pointerId);
        setIsPanning(false);

        if (!panState.current.moved && panState.current.targetPersonId) {
            handleNodeClick(panState.current.targetPersonId);
        }

        if (panState.current.moved) {
            panState.current.lastPanAt = Date.now();
            panState.current.moved = false;
        }
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

    return (
        <div
            ref={containerRef}
            className="card p-4 overflow-auto"
            style={{ height: '600px', cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => setIsPanning(false)}
        >
            <div
                className="flex items-center justify-between mb-3 text-xs text-muted"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={(event) => event.stopPropagation()}
            >
                <span>Drag to pan · Scrollbars for precise moves</span>
                <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomOut}>-</button>
                    <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleZoomIn}>+</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleFit}>Fit</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCenter}>Center</button>
                </div>
            </div>
            <div style={{ width: chartData.width * scale, height: chartData.height * scale, display: 'inline-block' }}>
                <svg width={chartData.width} height={chartData.height} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'visible' }}>
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

                    {/* Draw Links - Spouse/Partner */}
                    {chartData.links.filter(l => l.type === 'spouse').map((link, i) => {
                        const fromX = link.from.x + NODE_WIDTH / 2;
                        const fromY = link.from.y + NODE_HEIGHT / 2;
                        const toX = link.to.x + NODE_WIDTH / 2;
                        const toY = link.to.y + NODE_HEIGHT / 2;

                        // Gentle curve for same-generation relationships (spouse/partner)
                        const midY = (fromY + toY) / 2;
                        const curveOffset = 90;
                        const path = `M ${fromX} ${fromY} C ${fromX + curveOffset} ${midY}, ${toX + curveOffset} ${midY}, ${toX} ${toY}`;

                        return (
                            <path
                                key={`other-link-${i}`}
                                d={path}
                                stroke="var(--color-accent)"
                                strokeWidth={2}
                                fill="none"
                                opacity={0.8}
                            />
                        );
                    })}

                    {/* Draw Links - Grouped by Child to merge parent lines */}
                    {Object.entries(
                        chartData.links.filter(l => l.type === 'parent').reduce((acc, link) => {
                            const childId = link.to.id;
                            if (!acc[childId]) acc[childId] = [];
                            acc[childId].push(link);
                            return acc;
                        }, {} as Record<string, ChartLink[]>)
                    ).map(([childId, childLinks]) => {
                        const toX = childLinks[0].to.x;
                        const toY = childLinks[0].to.y + NODE_HEIGHT / 2;

                        // Junction point where lines meet
                        const junctionX = toX - HORIZONTAL_GAP / 2;

                        return (
                            <g key={`links-to-${childId}`}>
                                {childLinks.map((link, i) => {
                                    const fromX = link.from.x + NODE_WIDTH;
                                    const fromY = link.from.y + NODE_HEIGHT / 2;

                                    // Line from parent to junction
                                    // Smooth bezier curve
                                    const path = `M ${fromX} ${fromY} C ${fromX + 40} ${fromY}, ${junctionX - 40} ${toY}, ${junctionX} ${toY}`;

                                    return (
                                        <path
                                            key={`link-${i}`}
                                            d={path}
                                            stroke="var(--color-border)"
                                            strokeWidth={2}
                                            fill="none"
                                        />
                                    );
                                })}
                                {/* Single horizontal line from junction to child */}
                                <path
                                    d={`M ${junctionX} ${toY} L ${toX} ${toY}`}
                                    stroke="var(--color-border)"
                                    strokeWidth={2}
                                    fill="none"
                                />
                            </g>
                        );
                    })}

                    {/* Draw Nodes */}
                    {chartData.nodes.map((node) => (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="cursor-pointer transition-transform"
                            data-person-id={node.id}
                        >
                            <rect
                                width={NODE_WIDTH}
                                height={NODE_HEIGHT}
                                rx="12"
                                ry="12"
                                fill="var(--color-surface)"
                                stroke={node.id === rootPersonId ? "var(--color-accent)" : "var(--color-border)"}
                                strokeWidth={node.id === rootPersonId ? "3" : "1"}
                                className="shadow-sm"
                            />
                            <text
                                x={NODE_WIDTH / 2}
                                y={35}
                                textAnchor="middle"
                                className="font-bold text-sm"
                                fill="var(--color-text-primary)"
                            >
                                {node.person.givenNames} {node.person.surnames}
                            </text>
                            <text
                                x={NODE_WIDTH / 2}
                                y={55}
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
    );
}
