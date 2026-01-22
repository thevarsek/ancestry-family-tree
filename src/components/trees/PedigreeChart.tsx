import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

interface PersonWithPhoto extends Doc<"people"> {
    profilePhotoUrl?: string;
    profilePhotoZoom?: number;
    profilePhotoFocusX?: number;
    profilePhotoFocusY?: number;
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

interface FamilyUnit {
    id: string;
    parents: Id<"people">[];
    children: Id<"people">[];
    laneId: number;
}

interface ChartLink {
    from: ChartNode;
    to: ChartNode;
    type: LinkType;
    isHighlighted: boolean;
    familyId?: string;
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
    const HORIZONTAL_GAP = 80;


    const chartData = useMemo(() => {
        const peopleById = new Map(people.map(person => [person._id, person]));
        const parentsByChild = new Map<Id<"people">, Id<"people">[]>();
        const childrenByParent = new Map<Id<"people">, Id<"people">[]>();
        const spousesByPerson = new Map<Id<"people">, Id<"people">[]>();

        // Build relationship maps
        // parent_child is directional: personId1 is parent, personId2 is child.
        // We keep a fallback later for any legacy data that might be reversed.
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

        // Step A: Build family units
        const families = new Map<string, FamilyUnit>();
        const familyByChild = new Map<Id<"people">, string>();

        // Create families from parent-child relationships
        parentsByChild.forEach((parents, childId) => {
            if (parents.length === 1) {
                // Single parent family
                const familyId = `single-${parents[0]}`;
                if (!families.has(familyId)) {
                    families.set(familyId, {
                        id: familyId,
                        parents: [parents[0]],
                        children: [],
                        laneId: 0
                    });
                }
                families.get(familyId)!.children.push(childId);
                familyByChild.set(childId, familyId);
            } else if (parents.length === 2) {
                // Two-parent family - sort parents for consistent ID
                const sortedParents = [...parents].sort();
                const familyId = `couple-${sortedParents[0]}-${sortedParents[1]}`;
                if (!families.has(familyId)) {
                    families.set(familyId, {
                        id: familyId,
                        parents: sortedParents,
                        children: [],
                        laneId: 0
                    });
                }
                families.get(familyId)!.children.push(childId);
                familyByChild.set(childId, familyId);
            }
        });

        // Create spouse-only families (no children) so partners can be co-located even without kids
        spousesByPerson.forEach((spouses, p1) => {
            spouses.forEach((p2) => {
                // ensure deterministic and avoid double-adding
                if (p1 > p2) return;

                // if they already have a couple family via children, skip
                const existing = [...families.values()].some(f =>
                    f.parents.length === 2 &&
                    ((f.parents[0] === p1 && f.parents[1] === p2) || (f.parents[0] === p2 && f.parents[1] === p1))
                );
                if (existing) return;

                const sorted = [p1, p2].sort();
                const famId = `spouse-${sorted[0]}-${sorted[1]}`;

                if (!families.has(famId)) {
                    families.set(famId, {
                        id: famId,
                        parents: sorted as Id<"people">[],
                        children: [],
                        laneId: 0
                    });
                }
            });
        });

        // Build missing indexes
        const familyAsChildByPerson = new Map<Id<"people">, string>();
        familyByChild.forEach((famId, childId) => familyAsChildByPerson.set(childId, famId));

        const resolveParentChild = (relationship: Doc<"relationships">): {
            parentId: Id<"people">;
            childId: Id<"people">;
            usedFallback: boolean;
        } | null => {
            if (relationship.type !== 'parent_child') return null;
            const a = relationship.personId1;
            const b = relationship.personId2;

            const bParents = parentsByChild.get(b) ?? [];
            const aParents = parentsByChild.get(a) ?? [];

            if (bParents.includes(a)) return { parentId: a, childId: b, usedFallback: false };
            if (aParents.includes(b)) return { parentId: b, childId: a, usedFallback: false };

            // Legacy fallback: honor stored direction if maps are inconsistent.
            return { parentId: a, childId: b, usedFallback: true };
        };

        const familiesAsParentByPerson = new Map<Id<"people">, string[]>();
        families.forEach((fam, famId) => {
            fam.parents.forEach(p => {
                const list = familiesAsParentByPerson.get(p) ?? [];
                list.push(famId);
                familiesAsParentByPerson.set(p, list);
            });
        });

        // Helper: find couple family for a person
        const findCoupleFamilyId = (personId: Id<"people">): string | undefined => {
            const spouseIds = spousesByPerson.get(personId) ?? [];
            const parentFamilies = familiesAsParentByPerson.get(personId) ?? [];

            for (const famId of parentFamilies) {
                const fam = families.get(famId);
                if (!fam) continue;
                if (fam.parents.length < 2) continue;

                const otherParent = fam.parents[0] === personId ? fam.parents[1] : fam.parents[0];
                if (spouseIds.includes(otherParent)) {
                    return famId; // this is the couple family
                }
            }
            return undefined;
        };

        // Step B: Assign generations
        const generationById = new Map<Id<"people">, number>();
        const queue: Id<"people">[] = [rootPersonId];
        generationById.set(rootPersonId, 0);

        while (queue.length) {
            const currentId = queue.shift();
            if (!currentId) continue;
            const generation = generationById.get(currentId) ?? 0;

            // Parents get lower generation
            const parents = parentsByChild.get(currentId) ?? [];
            parents.forEach((parentId) => {
                if (!generationById.has(parentId)) {
                    generationById.set(parentId, generation - 1);
                    queue.push(parentId);
                }
            });

            // Children get higher generation
            const children = childrenByParent.get(currentId) ?? [];
            children.forEach((childId) => {
                if (!generationById.has(childId)) {
                    generationById.set(childId, generation + 1);
                    queue.push(childId);
                }
            });

            // Spouses get same generation
            const spouses = spousesByPerson.get(currentId) ?? [];
            spouses.forEach((spouseId) => {
                if (!generationById.has(spouseId)) {
                    generationById.set(spouseId, generation);
                    queue.push(spouseId);
                }
            });
        }

        // Normalize generations so root is at 0
        const minGen = Math.min(...generationById.values());
        generationById.forEach((gen, id) => {
            generationById.set(id, gen - minGen);
        });

        // Enforce couple same-generation constraint
        spousesByPerson.forEach((spouses, personId) => {
            spouses.forEach((spouseId) => {
                const gen1 = generationById.get(personId);
                const gen2 = generationById.get(spouseId);
                if (gen1 !== undefined && gen2 !== undefined && gen1 !== gen2) {
                    const minGen = Math.min(gen1, gen2);
                    generationById.set(personId, minGen);
                    generationById.set(spouseId, minGen);
                    // TODO: Propagate to descendants if needed
                }
            });
        });

        // Guard: ensure parent generations are always less than child generations
        relationships.forEach(r => {
            if (r.type !== "parent_child") return;
            const resolved = resolveParentChild(r);
            if (!resolved) return;
            const { parentId, childId } = resolved;

            const gp = generationById.get(parentId);
            const gc = generationById.get(childId);
            if (gp === undefined || gc === undefined) return;

            if (gp >= gc) {
                // Force child to be at least one generation to the right
                generationById.set(childId, gp + 1);
            }
        });

        // Step C: Assign lanes to families
        const laneAssignments = new Map<string, number>();

        const used = new Set<number>();
        const allocateLaneNear = (preferred: number) => {
            if (!used.has(preferred)) { used.add(preferred); return preferred; }
            for (let d = 1; d < 50; d++) {
                if (!used.has(preferred + d)) { used.add(preferred + d); return preferred + d; }
                if (!used.has(preferred - d)) { used.add(preferred - d); return preferred - d; }
            }
            used.add(preferred);
            return preferred;
        };

        const rootFam = familyAsChildByPerson.get(rootPersonId);
        if (rootFam) {
            laneAssignments.set(rootFam, 0);
            used.add(0);
        }

        const assignLane = (famId: string, preferred: number) => {
            if (laneAssignments.has(famId)) return laneAssignments.get(famId)!;
            const lane = allocateLaneNear(preferred);
            laneAssignments.set(famId, lane);
            return lane;
        };

        const enqueueIfNew = (famId?: string, lane?: number) => {
            if (!famId) return;
            if (laneAssignments.has(famId)) return;
            assignLane(famId, lane ?? 0);
            famQueue.push(famId);
        };

        // BFS over families
        const famQueue: string[] = rootFam ? [rootFam] : [];
        while (famQueue.length) {
            const famId = famQueue.shift()!;
            const fam = families.get(famId);
            if (!fam) continue;

            const lane = laneAssignments.get(famId) ?? 0;

            // --- existing downward walk (children -> their parent-families)
            fam.children.forEach(childId => {
                const childParentFamilies = familiesAsParentByPerson.get(childId) ?? [];
                childParentFamilies.forEach((childFamId, idx) => {
                    if (!laneAssignments.has(childFamId)) {
                        laneAssignments.set(childFamId, idx === 0 ? allocateLaneNear(lane) : allocateLaneNear(lane + idx));
                        famQueue.push(childFamId);
                    }
                });
            });

            // --- NEW: pull in ancestors of everyone in this family (and spouses)
            const allPeopleInFamily = [...fam.parents, ...fam.children];

            for (const personId of allPeopleInFamily) {
                // 1) birth family of this person (their parents)
                enqueueIfNew(familyAsChildByPerson.get(personId), lane);

                // 2) spouses' birth families too (this is what pulls Valeria/Daniele parents near them)
                const spouseIds = spousesByPerson.get(personId) ?? [];
                for (const sid of spouseIds) {
                    enqueueIfNew(familyAsChildByPerson.get(sid as Id<"people">), lane);
                }
            }
        }

        // Fallback: unvisited families go to new lanes, stable
        [...families.keys()].sort().forEach(famId => {
            if (!laneAssignments.has(famId)) {
                laneAssignments.set(famId, allocateLaneNear(0));
            }
        });

        families.forEach((f, id) => { f.laneId = laneAssignments.get(id)!; });

        // Compress lane IDs to eliminate gaps
        const unique = [...new Set([...families.values()].map(f => f.laneId))].sort((a,b)=>a-b);
        const remap = new Map<number, number>();
        unique.forEach((lane, idx) => remap.set(lane, idx));

        families.forEach(f => { f.laneId = remap.get(f.laneId)!; });

        // Step D: Create nodes and position them
        const nodesByGeneration = new Map<number, ChartNode[]>();
        generationById.forEach((generation, personId) => {
            const person = peopleById.get(personId);
            if (!person) return;
            const node: ChartNode = {
                id: personId,
                person,
                x: generation * (NODE_WIDTH + HORIZONTAL_GAP), // Strict generation-based X
                y: 0, // Will be set based on family lane
                generation
            };
            const list = nodesByGeneration.get(generation) ?? [];
            list.push(node);
            nodesByGeneration.set(generation, list);
        });

        // Step E: Position nodes with family block ordering
        const getLaneIdForPerson = (personId: Id<"people">) => {
            // Prioritize couple family if person is in one
            const coupleFam = findCoupleFamilyId(personId);
            if (coupleFam) {
                return families.get(coupleFam)?.laneId ?? 0;
            }

            // Otherwise prefer the family where they are a parent,
            // so parents stay near their children before their birth family.
            const famId = familiesAsParentByPerson.get(personId)?.[0]
                ?? familyAsChildByPerson.get(personId);

            return famId ? (families.get(famId)?.laneId ?? 0) : 0;
        };

        const getPrimaryFamilyId = (personId: Id<"people">) => {
            // If person is in a couple family (co-parenting with spouse), anchor to that first
            const coupleFam = findCoupleFamilyId(personId);
            if (coupleFam) return coupleFam;

            // Otherwise prioritize the family where they are a parent,
            // and fall back to their birth family for sibling grouping.
            return familiesAsParentByPerson.get(personId)?.[0]
                ?? familyAsChildByPerson.get(personId)
                ?? `solo-${personId}`;
        };

        const stableName = (n: ChartNode) =>
            `${n.person.surnames ?? ""} ${n.person.givenNames ?? ""}`.trim();

        const LANE_HEIGHT = 260;
        const ROW_HEIGHT = NODE_HEIGHT + 12;

        const nodes: ChartNode[] = [];
        const nodeById = new Map<Id<"people">, ChartNode>();

        const getFamilyAnchorY = (familyId: string) => {
            const fam = families.get(familyId);
            if (!fam || !fam.children.length) return null;
            const ys = fam.children
                .map(cid => nodeById.get(cid)?.y)
                .filter((y): y is number => typeof y === "number");

            if (!ys.length) return null;
            return ys.reduce((a, b) => a + b, 0) / ys.length;
        };

        const getBlockAnchor = (block: ChartNode[]) => {
            const anchors: number[] = [];
            block.forEach((node) => {
                const parentFamilies = familiesAsParentByPerson.get(node.id) ?? [];
                parentFamilies.forEach((famId) => {
                    const anchor = getFamilyAnchorY(famId);
                    if (anchor !== null) anchors.push(anchor);
                });
            });
            if (!anchors.length) return null;
            return anchors.reduce((a, b) => a + b, 0) / anchors.length;
        };

        const getBlockLane = (block: ChartNode[]) => {
            const laneCandidates: number[] = [];
            block.forEach((node) => {
                const parentFamilies = familiesAsParentByPerson.get(node.id) ?? [];
                parentFamilies.forEach((famId) => {
                    const laneId = families.get(famId)?.laneId;
                    if (typeof laneId === "number") laneCandidates.push(laneId);
                });
            });
            if (laneCandidates.length) return Math.min(...laneCandidates);
            return Math.min(...block.map((node) => getLaneIdForPerson(node.id)));
        };

        // Position youngest generations first so parents can align to child anchors.
        const generationKeys = [...generationById.values()].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);

        generationKeys.forEach((generation) => {
            const genNodes = nodesByGeneration.get(generation) ?? [];

            const nodesByLane = new Map<number, ChartNode[]>();
            genNodes.forEach(node => {
                const laneId = getLaneIdForPerson(node.id);
                const list = nodesByLane.get(laneId) ?? [];
                list.push(node);
                nodesByLane.set(laneId, list);
            });

            [...nodesByLane.keys()].sort((a,b)=>a-b).forEach(laneId => {
                const laneNodes = nodesByLane.get(laneId)!;

                // Build blocks: each block is either [a,b] couple or [a] solo
                const blocks: ChartNode[][] = [];
                const used = new Set<Id<"people">>();

                for (const n of laneNodes) {
                    if (used.has(n.id)) continue;

                    const spouses = (spousesByPerson.get(n.id) ?? [])
                        .filter(sid => laneNodes.some(x => x.id === sid)) as Id<"people">[];

                    if (spouses.length) {
                        // choose one spouse deterministically (lowest id)
                        const sid = [...spouses].sort()[0];
                        const spouseNode = laneNodes.find(x => x.id === sid);
                        if (spouseNode && !used.has(spouseNode.id)) {
                            used.add(n.id);
                            used.add(spouseNode.id);

                            // deterministic within-block order
                            const pair = n.id < spouseNode.id ? [n, spouseNode] : [spouseNode, n];
                            blocks.push(pair);
                            continue;
                        }
                    }

                    used.add(n.id);
                    blocks.push([n]);
                }

                // Sort blocks using stable family-based ordering
                const blockKey = (b: ChartNode[]) => {
                    const fams = b.map(x => getPrimaryFamilyId(x.id)).sort();
                    return fams[0] ?? "";
                };

                blocks.sort((A, B) => {
                    const anchorA = getBlockAnchor(A);
                    const anchorB = getBlockAnchor(B);
                    if (anchorA !== null && anchorB !== null && anchorA !== anchorB) return anchorA - anchorB;
                    if (anchorA !== null && anchorB === null) return -1;
                    if (anchorA === null && anchorB !== null) return 1;

                    const laneA = getBlockLane(A);
                    const laneB = getBlockLane(B);
                    if (laneA !== laneB) return laneA - laneB;

                    const fa = blockKey(A);
                    const fb = blockKey(B);
                    if (fa !== fb) return fa.localeCompare(fb);
                    return stableName(A[0]).localeCompare(stableName(B[0]));
                });

                // Expand blocks back to laneNodes and position
                const ordered = blocks.flat();
                const baseY = laneId * LANE_HEIGHT;
                ordered.forEach((node, idx) => {
                    node.y = baseY + idx * ROW_HEIGHT;
                    nodeById.set(node.id, node);
                });
            });

            nodes.push(...genNodes);
        });

        // Anchoring constants
        const PARTNER_GAP_Y = NODE_HEIGHT + 12;
        // Allow parents to move across lanes to align with children,
        // then pack within each generation to prevent overlaps.
        const MAX_SHIFT = LANE_HEIGHT * 4;

        // Deterministic couple ordering
        const orderParents = (p1: Id<"people">, p2: Id<"people">) => {
            // Use ID sort for stability
            return p1 < p2 ? [p1, p2] : [p2, p1];
        };

        // More iterations to allow full anchoring
        for (let iter = 0; iter < 3; iter++) {
            families.forEach((fam) => {
                if (fam.parents.length === 0) return;

                // Only anchor if children are rendered and have positions
                const childYs = fam.children
                    .map(cid => nodeById.get(cid)?.y)
                    .filter((y): y is number => typeof y === "number");

                if (childYs.length === 0) return;

                const childAnchorY = childYs.reduce((a,b)=>a+b,0) / childYs.length;

                if (fam.parents.length === 1) {
                    const p = fam.parents[0];
                    const pn = nodeById.get(p);
                    if (!pn) return;
                    const delta = childAnchorY - pn.y;
                    pn.y += Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, delta));
                    return;
                }

                // Two parents: keep midpoint near childAnchorY
                const [pa, pb] = orderParents(fam.parents[0], fam.parents[1]);
                const na = nodeById.get(pa);
                const nb = nodeById.get(pb);
                if (!na || !nb) return;

                const mid = (na.y + nb.y) / 2;
                const deltaMid = childAnchorY - mid;
                const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, deltaMid));

                na.y += shift;
                nb.y += shift;

                // Enforce consistent spacing
                if (Math.abs(nb.y - na.y) < PARTNER_GAP_Y) {
                    nb.y = na.y + PARTNER_GAP_Y;
                }
            });
        }

        // Third pass: local collision resolution within generations
        const packGeneration = (gen: number) => {
            const genNodes = nodes.filter(n => n.generation === gen).sort((a,b)=>a.y-b.y);
            for (let i = 1; i < genNodes.length; i++) {
                const prev = genNodes[i-1];
                const cur = genNodes[i];
                const minY = prev.y + NODE_HEIGHT + 12;
                if (cur.y < minY) cur.y = minY;
            }
        };

        const gens = [...new Set(nodes.map(n => n.generation))].sort((a,b)=>a-b);
        gens.forEach(packGeneration);

        // Create links based on relationships
        const links: ChartLink[] = [];

        // Deduplicate parent-child links
        const parentEdgeKey = (p: Id<"people">, c: Id<"people">) => `${p}=>${c}`;
        const seenParentEdges = new Set<string>();

        relationships.forEach((relationship) => {
            if (relationship.type === 'parent_child') {
                const resolved = resolveParentChild(relationship);
                if (!resolved) return;
                const { parentId, childId, usedFallback } = resolved;

                if (usedFallback) {
                    console.warn("Using parent_child fallback direction", relationship);
                }

                const key = parentEdgeKey(parentId, childId);
                if (seenParentEdges.has(key)) return;
                seenParentEdges.add(key);

                const from = nodeById.get(parentId);
                const to = nodeById.get(childId);
                if (!from || !to) return;

                // Guard against same-generation parent edges
                const gp = generationById.get(parentId);
                const gc = generationById.get(childId);
                if (gp === undefined || gc === undefined) return;
                if (gp >= gc) {
                    console.warn("Skipping invalid parent edge (gen)", { parentId, childId, gp, gc });
                    return;
                }

                const isHighlighted = (relationship.personId1 === rootPersonId || relationship.personId2 === rootPersonId);

                links.push({ from, to, type: 'parent', isHighlighted });
            } else if (relationship.type === 'spouse' || relationship.type === 'partner') {
                const from = nodeById.get(relationship.personId1);
                const to = nodeById.get(relationship.personId2);
                if (!from || !to) return;

                const isHighlighted = (relationship.personId1 === rootPersonId || relationship.personId2 === rootPersonId);

                links.push({ from, to, type: 'spouse', isHighlighted });
            }
        });

        // Calculate chart bounds
        const minX = Math.min(...nodes.map(node => node.x));
        const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH));
        const minY = Math.min(...nodes.map(node => node.y));
        const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT));
        const padding = 100;

        const positionedNodes = nodes.map(node => ({
            ...node,
            x: node.x - minX + padding,
            y: node.y - minY + padding
        }));

        const positionedLinks = links.map(link => ({
            ...link,
            from: {
                ...link.from,
                x: link.from.x - minX + padding,
                y: link.from.y - minY + padding
            },
            to: {
                ...link.to,
                x: link.to.x - minX + padding,
                y: link.to.y - minY + padding
            }
        }));

        return {
            nodes: positionedNodes,
            links: positionedLinks,
            width: maxX - minX + 2 * padding,
            height: maxY - minY + 2 * padding,
            families,
            familyByChild,
            nodeById
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
                            // Draw straight line from center of each card
                            const fromX = link.from.x + NODE_WIDTH / 2;
                            const fromY = link.from.y + NODE_HEIGHT / 2;
                            const toX = link.to.x + NODE_WIDTH / 2;
                            const toY = link.to.y + NODE_HEIGHT / 2;
                            const midX = (fromX + toX) / 2;
                            const midY = (fromY + toY) / 2;

                            return (
                                <g key={`spouse-link-${i}`}>
                                    <line
                                        x1={fromX}
                                        y1={fromY}
                                        x2={toX}
                                        y2={toY}
                                        stroke={link.isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
                                        strokeWidth={link.isHighlighted ? 3 : 2}
                                        opacity={link.isHighlighted ? 0.95 : 0.7}
                                        strokeDasharray={link.isHighlighted ? "none" : "5,5"}
                                    />
                                    {/* Relationship label */}
                                    <circle
                                        cx={midX}
                                        cy={midY - 15}
                                        r="8"
                                        fill="var(--color-surface)"
                                        stroke={link.isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
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

                        {/* Draw Parent-Child Links with Single Family Union Junctions */}
                        {(() => {
                            // Group links by family to draw one union per family
                            const familyLinks = new Map<string, ChartLink[]>();

                            chartData.links.filter((link) => link.type === 'parent').forEach((link) => {
                                const familyId = chartData.familyByChild.get(link.to.id);
                                if (!familyId) return;

                                const links = familyLinks.get(familyId) ?? [];
                                links.push(link);
                                familyLinks.set(familyId, links);
                            });

                            return Array.from(familyLinks.entries()).map(([familyId, links]) => {
                                const fam = chartData.families.get(familyId);
                                if (!fam) return null;

                                const parentNodes = fam.parents
                                    .map((pid: Id<"people">) => chartData.nodeById.get(pid))
                                    .filter((n): n is ChartNode => Boolean(n));

                                if (parentNodes.length === 0) return null;

                                // Compute single union point Y as average of parent midpoints
                                const unionY = parentNodes.reduce((sum: number, p: ChartNode) => sum + (p.y + NODE_HEIGHT / 2), 0) / parentNodes.length;

                                // Use the leftmost parent's X for gutter calculation
                                const leftmostParent = parentNodes.reduce((left, p) => p.x < left.x ? p : left);
                                const gutterX = leftmostParent.x + NODE_WIDTH + HORIZONTAL_GAP / 2;

                                const child = links[0].to; // All links in family go to same child
                                const toX = child.x;
                                const toY = child.y + NODE_HEIGHT / 2;

                                return (
                                    <g key={`family-${familyId}`}>
                                        {/* Draw parent-to-union lines */}
                                        {links.map((link, i) => {
                                            const fromX = link.from.x + NODE_WIDTH;
                                            const fromY = link.from.y + NODE_HEIGHT / 2;
                                            const parentToUnion = `M ${fromX} ${fromY} L ${gutterX} ${fromY} L ${gutterX} ${unionY}`;

                                            return (
                                                <path
                                                    key={`parent-${i}`}
                                                    d={parentToUnion}
                                                    stroke={link.isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
                                                    strokeWidth={link.isHighlighted ? 3 : 2}
                                                    fill="none"
                                                    opacity={link.isHighlighted ? 0.95 : 0.7}
                                                />
                                            );
                                        })}

                                        {/* Draw single union-to-child line */}
                                        {links.length > 0 && (
                                            <path
                                                d={`M ${gutterX} ${unionY} L ${gutterX} ${toY} L ${toX} ${toY}`}
                                                stroke={links[0].isHighlighted ? "var(--color-accent)" : "var(--color-border)"}
                                                strokeWidth={links[0].isHighlighted ? 3 : 2}
                                                fill="none"
                                                opacity={links[0].isHighlighted ? 0.95 : 0.7}
                                            />
                                        )}
                                    </g>
                                );
                            });
                        })()}

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
                                     filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                                 />
                                {/* Profile picture or initials */}
                                {node.person.profilePhotoUrl ? (
                                    <image
                                        href={node.person.profilePhotoUrl}
                                        x={NODE_WIDTH / 2 - 16}
                                        y={8}
                                        width={32}
                                        height={32}
                                        style={{
                                            clipPath: 'circle(16px at center)',
                                            transformOrigin: `${NODE_WIDTH / 2}px ${24}px`,
                                            transform: node.person.profilePhotoZoom && node.person.profilePhotoFocusX !== undefined && node.person.profilePhotoFocusY !== undefined
                                                ? `scale(${node.person.profilePhotoZoom}) translate(${(0.5 - node.person.profilePhotoFocusX) * 32}px, ${(0.5 - node.person.profilePhotoFocusY) * 32}px)`
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
