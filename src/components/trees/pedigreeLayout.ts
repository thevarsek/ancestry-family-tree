/**
 * Pedigree chart layout algorithm
 */
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type {
    LayoutNode,
    LayoutLink,
    LayoutFamily,
    LayoutInput,
    LayoutResult,
} from './pedigreeTypes';
import {
    unique,
    createBlocks,
    sortBlocksByDesiredCenter,
    sortBlocksByPosition,
    calculateBlockTops,
    applyBlockPositions,
} from './pedigreeBlockUtils';

// Re-export types for backward compatibility
export type { LayoutNode, LayoutLink, LayoutFamily } from './pedigreeTypes';

export function buildPedigreeLayout<TPerson extends Doc<"people">>(
    input: LayoutInput<TPerson>
): LayoutResult<TPerson> {
    const { people, relationships, rootPersonId, nodeWidth, nodeHeight, horizontalGap } = input;
    const peopleById = new Map(people.map(person => [person._id, person]));

    // Build relationship maps
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

    // Build families map
    const families = new Map<string, LayoutFamily>();
    const familyByChild = new Map<Id<"people">, string>();

    parentsByChild.forEach((parents, childId) => {
        if (!parents.length) return;
        const sortedParents = [...parents].sort();
        const familyId = sortedParents.length === 1
            ? `single-${sortedParents[0]}`
            : `parents-${sortedParents.join('-')}`;

        if (!families.has(familyId)) {
            families.set(familyId, { id: familyId, parents: sortedParents, children: [] });
        }
        families.get(familyId)!.children.push(childId);
        familyByChild.set(childId, familyId);
    });

    // Assign generations via BFS
    const generationById = new Map<Id<"people">, number>();
    const queue: Id<"people">[] = [rootPersonId];
    generationById.set(rootPersonId, 0);

    while (queue.length) {
        const currentId = queue.shift();
        if (!currentId) continue;
        const generation = generationById.get(currentId) ?? 0;

        (parentsByChild.get(currentId) ?? []).forEach((parentId) => {
            if (!generationById.has(parentId)) {
                generationById.set(parentId, generation - 1);
                queue.push(parentId);
            }
        });

        (childrenByParent.get(currentId) ?? []).forEach((childId) => {
            if (!generationById.has(childId)) {
                generationById.set(childId, generation + 1);
                queue.push(childId);
            }
        });

        (spousesByPerson.get(currentId) ?? []).forEach((spouseId) => {
            if (!generationById.has(spouseId)) {
                generationById.set(spouseId, generation);
                queue.push(spouseId);
            }
        });
    }

    // Normalize generations to start at 0
    const minGen = Math.min(...generationById.values());
    generationById.forEach((gen, id) => generationById.set(id, gen - minGen));

    // Create initial nodes
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

    // First pass: position by children (descending generations)
    generations.forEach((generation) => {
        const genNodes = nodes.filter(n => n.generation === generation);
        if (!genNodes.length) return;

        const desiredCenterById = new Map<Id<"people">, number | null>();
        genNodes.forEach((node) => {
            const children = childrenByParent.get(node.id) ?? [];
            const childCenters = children
                .map(childId => positioned.get(childId))
                .filter((y): y is number => typeof y === 'number')
                .map(y => y + nodeHeight / 2);

            desiredCenterById.set(node.id, childCenters.length
                ? childCenters.reduce((a, b) => a + b, 0) / childCenters.length
                : null);
        });

        const blocks = createBlocks(genNodes, spousesByPerson, desiredCenterById, nodeHeight, partnerGap);
        sortBlocksByDesiredCenter(blocks, stableName);

        const blockTops = calculateBlockTops(blocks, rowGap, (block, index) =>
            block.desiredCenter !== null
                ? block.desiredCenter - block.height / 2
                : (index === 0 ? 0 : 0) // Will be calculated by min constraint
        );

        applyBlockPositions(blocks, blockTops, partnerGap, positioned);
    });

    // Second pass: adjust toward parents (ascending generations)
    const ascendingGens = unique([...generationById.values()]).sort((a, b) => a - b);
    const blend = 0.65;

    ascendingGens.forEach((generation) => {
        const genNodes = nodes.filter(n => n.generation === generation);
        if (!genNodes.length) return;

        const desiredCenterById = new Map<Id<"people">, number | null>();
        genNodes.forEach((node) => {
            const parents = parentsByChild.get(node.id) ?? [];
            const parentCenters = parents
                .map(parentId => positioned.get(parentId))
                .filter((y): y is number => typeof y === 'number')
                .map(y => y + nodeHeight / 2);

            desiredCenterById.set(node.id, parentCenters.length
                ? parentCenters.reduce((a, b) => a + b, 0) / parentCenters.length
                : null);
        });

        const blocks = createBlocks(genNodes, spousesByPerson, desiredCenterById, nodeHeight, partnerGap);
        sortBlocksByPosition(blocks, positioned);

        const blockTops = calculateBlockTops(blocks, rowGap, (block) => {
            const currentTop = Math.min(...block.nodes.map(n => positioned.get(n.id) ?? 0));
            const desiredTop = block.desiredCenter !== null
                ? block.desiredCenter - block.height / 2
                : currentTop;
            return currentTop + (desiredTop - currentTop) * blend;
        });

        applyBlockPositions(blocks, blockTops, partnerGap, positioned);
    });

    // Normalize Y positions
    const minY = Math.min(...nodes.map(node => node.y));
    if (minY < 0) nodes.forEach(node => { node.y -= minY; });

    // Build links
    const links: LayoutLink<TPerson>[] = [];
    const seenParentEdges = new Set<string>();

    relationships.forEach((rel) => {
        if (rel.type === 'parent_child') {
            const key = `${rel.personId1}=>${rel.personId2}`;
            if (seenParentEdges.has(key)) return;
            seenParentEdges.add(key);

            const from = nodeById.get(rel.personId1);
            const to = nodeById.get(rel.personId2);
            if (!from || !to) return;

            links.push({
                from, to, type: 'parent',
                isHighlighted: rel.personId1 === rootPersonId || rel.personId2 === rootPersonId
            });
        } else if (rel.type === 'spouse' || rel.type === 'partner') {
            const from = nodeById.get(rel.personId1);
            const to = nodeById.get(rel.personId2);
            if (!from || !to) return;

            links.push({
                from, to, type: 'spouse',
                isHighlighted: rel.personId1 === rootPersonId || rel.personId2 === rootPersonId
            });
        }
    });

    // Apply padding and calculate final dimensions
    const padding = 100;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + nodeWidth));
    const finalMinY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + nodeHeight));

    const positionedNodes = nodes.map(n => ({ ...n, x: n.x - minX + padding, y: n.y - finalMinY + padding }));
    const positionedNodeById = new Map(positionedNodes.map(n => [n.id, n]));
    const positionedLinks = links.map(l => ({
        ...l,
        from: positionedNodeById.get(l.from.id) ?? l.from,
        to: positionedNodeById.get(l.to.id) ?? l.to
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
