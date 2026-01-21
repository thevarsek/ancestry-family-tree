import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

interface PedigreeChartProps {
    treeId: Id<"trees">;
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
}

type LinkType = 'parent' | 'spouse' | 'sibling';

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
    const panState = useRef({
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        moved: false
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

        const sortGeneration = (generation: number, neighborGeneration: number) => {
            const group = nodesByGeneration.get(generation);
            if (!group || group.length < 2) return;
            const originalOrder = new Map(group.map((node, index) => [node.id, index]));
            const sorted = [...group].sort((a, b) => {
                const aOrders = getNeighborOrders(a.id, neighborGeneration);
                const bOrders = getNeighborOrders(b.id, neighborGeneration);
                const aAvg = aOrders.length ? aOrders.reduce((sum, val) => sum + val, 0) / aOrders.length : null;
                const bAvg = bOrders.length ? bOrders.reduce((sum, val) => sum + val, 0) / bOrders.length : null;

                if (aAvg === null && bAvg === null) {
                    return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
                }
                if (aAvg === null) return 1;
                if (bAvg === null) return -1;
                if (aAvg === bAvg) {
                    return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
                }
                return aAvg - bAvg;
            });
            nodesByGeneration.set(generation, sorted);
            sorted.forEach((node, index) => {
                orderById.set(node.id, index);
            });
        };

        for (let i = 0; i < 2; i += 1) {
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
            }

            if (relationship.type === 'spouse' || relationship.type === 'partner') {
                links.push({ from, to, type: 'spouse' });
            }

            if (relationship.type === 'sibling') {
                links.push({ from, to, type: 'sibling' });
            }
        });

        if (!nodes.length) {
            return { nodes: [], links: [], width: 0, height: 0 };
        }

        const minX = Math.min(...nodes.map(node => node.x));
        const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH));
        const minY = Math.min(...nodes.map(node => node.y));
        const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT));
        const padding = 120;
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
        container.setPointerCapture(event.pointerId);
        panState.current = {
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            moved: false
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
    };

    const handleNodeClick = (personId: Id<"people">) => {
        if (panState.current.moved) {
            panState.current.moved = false;
            return;
        }
        navigate(`/tree/${treeId}/person/${personId}`);
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
            <svg width={chartData.width} height={chartData.height}>
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

                {/* Draw Links */}
                {chartData.links.map((link, i) => {
                    const fromX = link.type === 'parent' ? link.from.x + NODE_WIDTH : link.from.x + NODE_WIDTH / 2;
                    const toX = link.type === 'parent' ? link.to.x : link.to.x + NODE_WIDTH / 2;
                    const fromY = link.from.y + NODE_HEIGHT / 2;
                    const toY = link.to.y + NODE_HEIGHT / 2;
                    const midX = (fromX + toX) / 2;
                    const path = link.type === 'parent'
                        ? `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
                        : `M ${fromX} ${fromY} L ${toX} ${toY}`;

                    return (
                        <path
                            key={`link-${i}`}
                            d={path}
                            stroke={link.type === 'parent' ? 'var(--color-border)' : 'var(--color-border-subtle)'}
                            strokeWidth={link.type === 'parent' ? 2 : 1.5}
                            fill="none"
                            strokeDasharray={link.type === 'sibling' ? '4 4' : undefined}
                        />
                    );
                })}

                {/* Draw Nodes */}
                {chartData.nodes.map((node) => (
                    <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer transition-transform"
                        onClick={() => handleNodeClick(node.id)}
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
    );
}
