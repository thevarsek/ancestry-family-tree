import type { Doc, Id } from '../../../convex/_generated/dataModel';

type LinkType = 'parent' | 'spouse';

export interface LayoutNode<TPerson extends Doc<"people">> {
    id: Id<"people">;
    person: TPerson;
    x: number;
    y: number;
    generation: number;
}

export interface LayoutLink<TPerson extends Doc<"people">> {
    from: LayoutNode<TPerson>;
    to: LayoutNode<TPerson>;
    type: LinkType;
    isHighlighted: boolean;
}

export interface LayoutFamily {
    id: string;
    parents: Id<"people">[];
    children: Id<"people">[];
}

interface LayoutInput<TPerson extends Doc<"people">> {
    people: TPerson[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    nodeWidth: number;
    nodeHeight: number;
    horizontalGap: number;
}

interface LayoutResult<TPerson extends Doc<"people">> {
    nodes: LayoutNode<TPerson>[];
    links: LayoutLink<TPerson>[];
    width: number;
    height: number;
    families: Map<string, LayoutFamily>;
    familyByChild: Map<Id<"people">, string>;
    nodeById: Map<Id<"people">, LayoutNode<TPerson>>;
}

interface Block<TPerson extends Doc<"people">> {
    nodes: LayoutNode<TPerson>[];
    desiredCenter: number | null;
    height: number;
    key: string;
}

const unique = <T,>(values: T[]) => [...new Set(values)];

export function buildPedigreeLayout<TPerson extends Doc<"people">>(
    input: LayoutInput<TPerson>
): LayoutResult<TPerson> {
    const { people, relationships, rootPersonId, nodeWidth, nodeHeight, horizontalGap } = input;
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

        return { parentId: a, childId: b, usedFallback: true };
    };

    const families = new Map<string, LayoutFamily>();
    const familyByChild = new Map<Id<"people">, string>();

    parentsByChild.forEach((parents, childId) => {
        if (!parents.length) return;
        const sortedParents = [...parents].sort();
        const familyId = sortedParents.length === 1
            ? `single-${sortedParents[0]}`
            : `parents-${sortedParents.join('-')}`;

        if (!families.has(familyId)) {
            families.set(familyId, {
                id: familyId,
                parents: sortedParents,
                children: []
            });
        }

        families.get(familyId)!.children.push(childId);
        familyByChild.set(childId, familyId);
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

    const minGen = Math.min(...generationById.values());
    generationById.forEach((gen, id) => {
        generationById.set(id, gen - minGen);
    });

    const nodes: LayoutNode<TPerson>[] = [];
    const nodeById = new Map<Id<"people">, LayoutNode<TPerson>>();

    generationById.forEach((generation, personId) => {
        const person = peopleById.get(personId);
        if (!person) return;
        const node: LayoutNode<TPerson> = {
            id: personId,
            person,
            x: generation * (nodeWidth + horizontalGap),
            y: 0,
            generation
        };
        nodes.push(node);
        nodeById.set(personId, node);
    });

    const stableName = (node: LayoutNode<TPerson>) =>
        `${node.person.surnames ?? ''} ${node.person.givenNames ?? ''}`.trim();

    const partnerGap = nodeHeight + 12;
    const rowGap = 18;

    const generations = unique([...generationById.values()]).sort((a, b) => b - a);
    const positioned = new Map<Id<"people">, number>();

    const assignGeneration = (generation: number) => {
        const genNodes = nodes.filter(n => n.generation === generation);
        if (!genNodes.length) return;

        const desiredCenterById = new Map<Id<"people">, number | null>();
        genNodes.forEach((node) => {
            const children = childrenByParent.get(node.id) ?? [];
            const childCenters = children
                .map((childId) => positioned.get(childId))
                .filter((y): y is number => typeof y === 'number')
                .map((y) => y + nodeHeight / 2);

            if (!childCenters.length) {
                desiredCenterById.set(node.id, null);
                return;
            }

            desiredCenterById.set(
                node.id,
                childCenters.reduce((a, b) => a + b, 0) / childCenters.length
            );
        });

        const blocks: Block<TPerson>[] = [];
        const used = new Set<Id<"people">>();

        genNodes.forEach((node) => {
            if (used.has(node.id)) return;

            const spouses = (spousesByPerson.get(node.id) ?? [])
                .filter(id => genNodes.some(candidate => candidate.id === id))
                .sort();

            let blockNodes = [node];
            if (spouses.length) {
                const spouseNode = genNodes.find(candidate => candidate.id === spouses[0]);
                if (spouseNode && !used.has(spouseNode.id)) {
                    blockNodes = node.id < spouseNode.id ? [node, spouseNode] : [spouseNode, node];
                }
            }

            blockNodes.forEach(member => used.add(member.id));

            const desiredCenters = blockNodes
                .map(member => desiredCenterById.get(member.id))
                .filter((value): value is number => typeof value === 'number');

            const desiredCenter = desiredCenters.length
                ? desiredCenters.reduce((a, b) => a + b, 0) / desiredCenters.length
                : null;

            const height = nodeHeight + (blockNodes.length - 1) * partnerGap;
            const key = blockNodes.map(member => member.id).join('-');

            blocks.push({ nodes: blockNodes, desiredCenter, height, key });
        });

        blocks.sort((a, b) => {
            if (a.desiredCenter !== null && b.desiredCenter !== null && a.desiredCenter !== b.desiredCenter) {
                return a.desiredCenter - b.desiredCenter;
            }
            if (a.desiredCenter !== null && b.desiredCenter === null) return -1;
            if (a.desiredCenter === null && b.desiredCenter !== null) return 1;

            const aName = stableName(a.nodes[0]);
            const bName = stableName(b.nodes[0]);
            if (aName !== bName) return aName.localeCompare(bName);
            return a.key.localeCompare(b.key);
        });

        const blockTops: number[] = [];

        blocks.forEach((block, index) => {
            const desiredTop = block.desiredCenter !== null
                ? block.desiredCenter - block.height / 2
                : (index === 0 ? 0 : blockTops[index - 1] + blocks[index - 1].height + rowGap);

            const prevTop = index === 0 ? null : blockTops[index - 1];
            const prevHeight = index === 0 ? 0 : blocks[index - 1].height;
            const minTop = prevTop === null ? desiredTop : prevTop + prevHeight + rowGap;

            blockTops[index] = Math.max(desiredTop, minTop);
        });

        for (let i = blocks.length - 2; i >= 0; i -= 1) {
            const nextTop = blockTops[i + 1];
            const maxTop = nextTop - blocks[i].height - rowGap;
            if (blockTops[i] > maxTop) {
                blockTops[i] = maxTop;
            }
        }

        blocks.forEach((block, index) => {
            const top = blockTops[index];
            block.nodes.forEach((member, memberIndex) => {
                const y = top + memberIndex * partnerGap;
                member.y = y;
                positioned.set(member.id, y);
            });
        });
    };

    generations.forEach(assignGeneration);

    const minY = Math.min(...nodes.map(node => node.y));
    if (minY < 0) {
        nodes.forEach(node => { node.y = node.y - minY; });
    }

    const links: LayoutLink<TPerson>[] = [];
    const seenParentEdges = new Set<string>();
    const parentEdgeKey = (p: Id<"people">, c: Id<"people">) => `${p}=>${c}`;

    relationships.forEach((relationship) => {
        if (relationship.type === 'parent_child') {
            const resolved = resolveParentChild(relationship);
            if (!resolved) return;
            const { parentId, childId, usedFallback } = resolved;

            if (usedFallback) {
                console.warn('Using parent_child fallback direction', relationship);
            }

            const key = parentEdgeKey(parentId, childId);
            if (seenParentEdges.has(key)) return;
            seenParentEdges.add(key);

            const from = nodeById.get(parentId);
            const to = nodeById.get(childId);
            if (!from || !to) return;

            links.push({
                from,
                to,
                type: 'parent',
                isHighlighted: relationship.personId1 === rootPersonId || relationship.personId2 === rootPersonId
            });
            return;
        }

        if (relationship.type === 'spouse' || relationship.type === 'partner') {
            const from = nodeById.get(relationship.personId1);
            const to = nodeById.get(relationship.personId2);
            if (!from || !to) return;

            links.push({
                from,
                to,
                type: 'spouse',
                isHighlighted: relationship.personId1 === rootPersonId || relationship.personId2 === rootPersonId
            });
        }
    });

    const minX = Math.min(...nodes.map(node => node.x));
    const maxX = Math.max(...nodes.map(node => node.x + nodeWidth));
    const finalMinY = Math.min(...nodes.map(node => node.y));
    const maxY = Math.max(...nodes.map(node => node.y + nodeHeight));
    const padding = 100;

    const positionedNodes = nodes.map(node => ({
        ...node,
        x: node.x - minX + padding,
        y: node.y - finalMinY + padding
    }));

    const positionedNodeById = new Map<Id<"people">, LayoutNode<TPerson>>();
    positionedNodes.forEach(node => positionedNodeById.set(node.id, node));

    const positionedLinks = links.map(link => ({
        ...link,
        from: positionedNodeById.get(link.from.id) ?? link.from,
        to: positionedNodeById.get(link.to.id) ?? link.to
    }));

    return {
        nodes: positionedNodes,
        links: positionedLinks,
        width: maxX - minX + 2 * padding,
        height: maxY - finalMinY + 2 * padding,
        families,
        familyByChild,
        nodeById: positionedNodeById
    };
}
