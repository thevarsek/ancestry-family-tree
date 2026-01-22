/**
 * Block positioning utilities for pedigree layout
 */
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type { LayoutNode, Block } from './pedigreeTypes';

const unique = <T,>(values: T[]) => [...new Set(values)];

/**
 * Create blocks from generation nodes (grouping spouses together)
 */
export function createBlocks<TPerson extends Doc<"people">>(
    genNodes: LayoutNode<TPerson>[],
    spousesByPerson: Map<Id<"people">, Id<"people">[]>,
    desiredCenterById: Map<Id<"people">, number | null>,
    nodeHeight: number,
    partnerGap: number
): Block<TPerson>[] {
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

    return blocks;
}

/**
 * Sort blocks by desired center, then by name
 */
export function sortBlocksByDesiredCenter<TPerson extends Doc<"people">>(
    blocks: Block<TPerson>[],
    stableName: (node: LayoutNode<TPerson>) => string
): void {
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
}

/**
 * Sort blocks by their current position
 */
export function sortBlocksByPosition<TPerson extends Doc<"people">>(
    blocks: Block<TPerson>[],
    positioned: Map<Id<"people">, number>
): void {
    blocks.sort((a, b) => {
        const aTop = Math.min(...a.nodes.map(node => positioned.get(node.id) ?? 0));
        const bTop = Math.min(...b.nodes.map(node => positioned.get(node.id) ?? 0));
        if (aTop !== bTop) return aTop - bTop;
        return a.key.localeCompare(b.key);
    });
}

/**
 * Calculate block top positions, respecting desired centers and gaps
 */
export function calculateBlockTops<TPerson extends Doc<"people">>(
    blocks: Block<TPerson>[],
    rowGap: number,
    getDesiredTop: (block: Block<TPerson>, index: number) => number
): number[] {
    const blockTops: number[] = [];

    blocks.forEach((block, index) => {
        const desiredTop = getDesiredTop(block, index);
        const prevTop = index === 0 ? null : blockTops[index - 1];
        const prevHeight = index === 0 ? 0 : blocks[index - 1].height;
        const minTop = prevTop === null ? desiredTop : prevTop + prevHeight + rowGap;

        blockTops[index] = Math.max(desiredTop, minTop);
    });

    // Backward pass to resolve overlaps
    for (let i = blocks.length - 2; i >= 0; i -= 1) {
        const nextTop = blockTops[i + 1];
        const maxTop = nextTop - blocks[i].height - rowGap;
        if (blockTops[i] > maxTop) {
            blockTops[i] = maxTop;
        }
    }

    return blockTops;
}

/**
 * Apply block positions to nodes
 */
export function applyBlockPositions<TPerson extends Doc<"people">>(
    blocks: Block<TPerson>[],
    blockTops: number[],
    partnerGap: number,
    positioned: Map<Id<"people">, number>
): void {
    blocks.forEach((block, index) => {
        const top = blockTops[index];
        block.nodes.forEach((member, memberIndex) => {
            const y = top + memberIndex * partnerGap;
            member.y = y;
            positioned.set(member.id, y);
        });
    });
}

export { unique };
