import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

interface PedigreeChartProps {
    treeId: Id<"trees">;
    people: Doc<"people">[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
}

interface ChartNode {
    id: Id<"people">;
    person: Doc<"people">;
    x: number;
    y: number;
    generation: number;
    parents: ChartNode[];
}

export function PedigreeChart({ treeId, people, relationships, rootPersonId }: PedigreeChartProps) {
    const navigate = useNavigate();

    // Layout constants
    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 80;
    const HORIZONTAL_GAP = 100;
    const VERTICAL_GAP = 40;

    // Recursively build the pedigree tree (upwards)
    const chartData = useMemo(() => {
        const getParents = (personId: Id<"people">) => {
            return relationships
                .filter(r => r.type === 'parent_child' && r.personId2 === personId)
                .map(r => people.find(p => p._id === r.personId1))
                .filter((p): p is Doc<"people"> => !!p);
        };

        const buildNode = (personId: Id<"people">, generation: number, xOffset: number): ChartNode | null => {
            const person = people.find(p => p._id === personId);
            if (!person) return null;

            const parents = getParents(personId);
            const parentNodes: ChartNode[] = [];

            // Limit to 4 generations for MVP to avoid massive layout complexity
            if (generation < 4) {
                // Calculate span for this generation
                const siblingCount = Math.pow(2, 3 - generation);
                const span = siblingCount * (NODE_HEIGHT + VERTICAL_GAP);

                parents.forEach((parent, index) => {
                    // Position parents relative to child
                    // Mother is typically on top, Father on bottom in this vertical layout
                    // Or swapped. Let's do a standard pedigree layout: 
                    // Parents are to the LEFT of the child in a horizontal tree.
                    const parentNode = buildNode(
                        parent._id,
                        generation + 1,
                        xOffset - (NODE_WIDTH + HORIZONTAL_GAP)
                    );
                    if (parentNode) {
                        // Offset Y based on sibling position
                        const yOffset = (index === 0 ? -1 : 1) * (span / 4);
                        parentNode.y += yOffset;
                        parentNodes.push(parentNode);
                    }
                });
            }

            return {
                id: personId,
                person,
                x: xOffset,
                y: 0, // Will be adjusted relatively
                generation,
                parents: parentNodes
            };
        };

        const rootNode = buildNode(rootPersonId, 0, (NODE_WIDTH + HORIZONTAL_GAP) * 3);

        // Flatten nodes for rendering
        const allNodes: ChartNode[] = [];
        const allLinks: { from: ChartNode, to: ChartNode }[] = [];

        const traverse = (node: ChartNode) => {
            allNodes.push(node);
            node.parents.forEach(parent => {
                allLinks.push({ from: parent, to: node });
                traverse(parent);
            });
        };

        if (rootNode) traverse(rootNode);

        return { nodes: allNodes, links: allLinks };
    }, [people, relationships, rootPersonId]);

    if (!chartData.nodes.length) {
        return <div className="p-8 text-center text-muted">No data available for this person.</div>;
    }

    // Determine viewbox
    const minX = Math.min(...chartData.nodes.map(n => n.x)) - 50;
    const maxX = Math.max(...chartData.nodes.map(n => n.x)) + NODE_WIDTH + 50;
    const minY = Math.min(...chartData.nodes.map(n => n.y)) - 200;
    const maxY = Math.max(...chartData.nodes.map(n => n.y)) + 200;

    return (
        <div className="overflow-auto bg-card rounded-xl border border-border shadow-sm p-4" style={{ height: '600px' }}>
            <svg
                viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
                width={maxX - minX}
                height={maxY - minY}
                className="mx-auto"
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
                        <polygon points="0 0, 10 3.5, 0 7" fill="var(--muted)" />
                    </marker>
                </defs>

                {/* Draw Links */}
                {chartData.links.map((link, i) => (
                    <path
                        key={`link-${i}`}
                        d={`M ${link.from.x + NODE_WIDTH} ${link.from.y + NODE_HEIGHT / 2} 
                           L ${link.to.x} ${link.to.y + NODE_HEIGHT / 2}`}
                        stroke="var(--border)"
                        strokeWidth="2"
                        fill="none"
                    />
                ))}

                {/* Draw Nodes */}
                {chartData.nodes.map((node) => (
                    <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() => navigate(`/tree/${treeId}/person/${node.id}`)}
                    >
                        <rect
                            width={NODE_WIDTH}
                            height={NODE_HEIGHT}
                            rx="12"
                            ry="12"
                            fill="var(--background)"
                            stroke={node.id === rootPersonId ? "var(--accent)" : "var(--border)"}
                            strokeWidth={node.id === rootPersonId ? "3" : "1"}
                            className="shadow-sm"
                        />
                        <text
                            x={NODE_WIDTH / 2}
                            y={35}
                            textAnchor="middle"
                            className="font-bold text-sm"
                            fill="var(--foreground)"
                        >
                            {node.person.givenNames} {node.person.surnames}
                        </text>
                        <text
                            x={NODE_WIDTH / 2}
                            y={55}
                            textAnchor="middle"
                            className="text-xs opacity-60"
                            fill="var(--foreground)"
                        >
                            {node.person.gender === 'male' ? '♂' : node.person.gender === 'female' ? '♀' : ''}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
