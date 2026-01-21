import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

interface PersonWithPhoto extends Doc<"people"> {
    profilePhotoUrl?: string;
}

interface PedigreeChartProps {
    treeId: Id<"trees">;
    people: PersonWithPhoto[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
}

type LinkType = 'parent' | 'spouse';

interface ChartNode {
    id: Id<"people">;
    person: PersonWithPhoto;
    x: number;
    y: number;
    generation: number;
}

interface ChartLink {
    from: ChartNode;
    to: ChartNode;
    type: LinkType;
    isHighlighted: boolean;
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
        isPointerDown: false,
        isPanning: false
    });

    // Layout constants
    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 100;
    const HORIZONTAL_GAP = 100;
    const VERTICAL_GAP = 40;
    const GROUP_GAP = 40;

    const chartData = useMemo(() => {
        const peopleById = new Map(people.map(person => [person._id, person]));
        const parentsByChild = new Map<Id<"people">, Id<"people">[]>();
        const childrenByParent = new Map<Id<"people">, Id<"people">[]>();
        const spousesByPerson = new Map<Id<"people">, Id<"people">[]>();
        const siblingsByPerson = new Map<Id<"people">, Id<"people">[]>();

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

            if (relationship.type === 'sibling') {
                const left = siblingsByPerson.get(relationship.personId1) ?? [];
                left.push(relationship.personId2);
                siblingsByPerson.set(relationship.personId1, left);

                const right = siblingsByPerson.get(relationship.personId2) ?? [];
                right.push(relationship.personId1);
                siblingsByPerson.set(relationship.personId2, right);
            }

        });

        childrenByParent.forEach((children) => {
            children.forEach((childId) => {
                const siblings = siblingsByPerson.get(childId) ?? [];
                children.forEach((siblingId) => {
                    if (siblingId !== childId && !siblings.includes(siblingId)) {
                        siblings.push(siblingId);
                    }
                });
                if (siblings.length) {
                    siblingsByPerson.set(childId, siblings);
                }
            });
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

            const siblings = siblingsByPerson.get(currentId) ?? [];
            siblings.forEach((siblingId) => {
                if (!generationById.has(siblingId)) {
                    generationById.set(siblingId, generation);
                    queue.push(siblingId);
                }
            });

        }

        const nodesByGeneration = new Map<number, ChartNode[]>();
        const groupIndexById = new Map<Id<"people">, number>();
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

        const buildSiblingClusters = (generation: number): ChartNode[][] => {
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

                    const siblings = siblingsByPerson.get(currentId) ?? [];
                    siblings.forEach((siblingId) => {
                        if (generationById.get(siblingId) === generation && byId.has(siblingId)) {
                            stack.push(siblingId);
                        }
                    });
                }

                clusters.push(cluster);
            });

            return clusters;
        };

        const medianOrder = (orders: number[]) => {
            if (!orders.length) return null;
            const sorted = [...orders].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 0) {
                return (sorted[mid - 1] + sorted[mid]) / 2;
            }
            return sorted[mid];
        };

        const sortGeneration = (generation: number, neighborGeneration: number) => {
            const group = nodesByGeneration.get(generation);
            if (!group || group.length < 2) return;
            const originalOrder = new Map(group.map((node, index) => [node.id, index]));

            const clusterOrderValue = (cluster: ChartNode[]) => {
                const orders = cluster.flatMap((node) => getNeighborOrders(node.id, neighborGeneration));
                return medianOrder(orders);
            };

            const sortWithinCluster = (cluster: ChartNode[]) =>
                [...cluster].sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));

            const clusters = buildSiblingClusters(generation).map((cluster) => sortWithinCluster(cluster));
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

            const placedIds = new Set<Id<"people">>();
            const sorted: ChartNode[] = [];
            let groupIndex = 0;

            sortedClusters.forEach((cluster) => {
                cluster.forEach((node) => {
                    if (!placedIds.has(node.id)) {
                        placedIds.add(node.id);
                        groupIndexById.set(node.id, groupIndex);
                        sorted.push(node);
                    }
                });

                const spouseSet = new Set<Id<"people">>();
                cluster.forEach((node) => {
                    const spouses = spousesByPerson.get(node.id) ?? [];
                    spouses.forEach((spouseId) => {
                        if (generationById.get(spouseId) === generation && !placedIds.has(spouseId)) {
                            spouseSet.add(spouseId);
                        }
                    });
                });

                const spouses = [...spouseSet]
                    .map((spouseId) => nodesByGeneration.get(generation)?.find((node) => node.id === spouseId))
                    .filter((node): node is ChartNode => Boolean(node))
                    .sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));

                spouses.forEach((node) => {
                    if (!placedIds.has(node.id)) {
                        placedIds.add(node.id);
                        groupIndexById.set(node.id, groupIndex);
                        sorted.push(node);
                    }
                });

                groupIndex += 1;
            });
            nodesByGeneration.set(generation, sorted);
            sorted.forEach((node, index) => {
                orderById.set(node.id, index);
            });
        };

        // Run extra sweeps to improve crossing minimization while keeping spouses together
        for (let i = 0; i < 8; i += 1) {
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
            let cursorY = 0;
            let previousGroupIndex: number | null = null;

            const positioned = group.map((node, index) => {
                const currentGroupIndex = groupIndexById.get(node.id) ?? 0;
                if (index > 0) {
                    cursorY += NODE_HEIGHT + VERTICAL_GAP;
                    if (previousGroupIndex !== null && currentGroupIndex !== previousGroupIndex) {
                        cursorY += GROUP_GAP;
                    }
                }
                previousGroupIndex = currentGroupIndex;
                return { node, y: cursorY };
            });

            const totalHeight = positioned.length ? cursorY + NODE_HEIGHT : 0;
            positioned.forEach(({ node, y }) => {
                node.y = y - totalHeight / 2;
                nodes.push(node);
            });
        });

        const nodeById = new Map(nodes.map(node => [node.id, node]));
        const links: ChartLink[] = [];

        relationships.forEach((relationship) => {
            const from = nodeById.get(relationship.personId1);
            const to = nodeById.get(relationship.personId2);
            if (!from || !to) return;
            const isHighlighted =
                (relationship.type === 'parent_child' || relationship.type === 'spouse' || relationship.type === 'partner') &&
                (relationship.personId1 === rootPersonId || relationship.personId2 === rootPersonId);

            if (relationship.type === 'parent_child') {
                links.push({ from, to, type: 'parent', isHighlighted });
            } else if (relationship.type === 'spouse' || relationship.type === 'partner') {
                links.push({ from, to, type: 'spouse', isHighlighted });
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

    return (
        <div
            className="card p-4 flex flex-col"
            style={{ height: '600px', overflow: 'hidden' }}
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
                    <svg width={chartData.width} height={chartData.height} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden' }}>
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
                        const fromY = link.from.y + NODE_HEIGHT / 2;
                        const toY = link.to.y + NODE_HEIGHT / 2;
                        const isLeftToRight = link.from.x <= link.to.x;
                        const fromX = isLeftToRight ? link.from.x + NODE_WIDTH : link.from.x;
                        const toX = isLeftToRight ? link.to.x : link.to.x + NODE_WIDTH;
                        const midX = (fromX + toX) / 2;
                        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;

                        return (
                            <path
                                key={`other-link-${i}`}
                                d={path}
                                stroke={link.isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
                                strokeWidth={link.isHighlighted ? 3 : 2}
                                fill="none"
                                opacity={link.isHighlighted ? 0.95 : 0.7}
                            />
                        );
                    })}

                    {/* Draw Links - Grouped by Child to merge parent lines */}
                    {chartData.links.filter((link) => link.type === 'parent').map((link, i) => {
                        const fromX = link.from.x + NODE_WIDTH;
                        const fromY = link.from.y + NODE_HEIGHT / 2;
                        const toX = link.to.x;
                        const toY = link.to.y + NODE_HEIGHT / 2;
                        const midX = (fromX + toX) / 2;
                        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;

                        return (
                            <path
                                key={`parent-link-${i}`}
                                d={path}
                                stroke={link.isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
                                strokeWidth={link.isHighlighted ? 3 : 2}
                                fill="none"
                                opacity={link.isHighlighted ? 0.95 : 0.7}
                            />
                        );
                    })}

                    {/* Draw Nodes */}
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
                                stroke={node.id === rootPersonId ? "var(--color-accent)" : "var(--color-border)"}
                                strokeWidth={node.id === rootPersonId ? "3" : "1"}
                                className="shadow-sm"
                            />
                            {/* Profile picture or initials */}
                            {node.person.profilePhotoUrl ? (
                                <image
                                    href={node.person.profilePhotoUrl}
                                    x={NODE_WIDTH / 2 - 16}
                                    y={8}
                                    width={32}
                                    height={32}
                                    clipPath="circle(16px at center)"
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
