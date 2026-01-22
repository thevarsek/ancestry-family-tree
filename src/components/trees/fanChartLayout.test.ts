import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { buildFanChartLayout } from './fanChartLayout';

const treeId = 'tree_1' as Id<"trees">;
const userId = 'user_1' as Id<"users">;
const now = Date.now();

const createPerson = (id: string, givenNames: string): Doc<"people"> => ({
    _id: id as Id<"people">,
    _creationTime: now,
    treeId,
    givenNames,
    surnames: 'Tester',
    isLiving: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
});

const createRelationship = (
    id: string,
    personId1: Id<"people">,
    personId2: Id<"people">
): Doc<"relationships"> => ({
    _id: id as Id<"relationships">,
    _creationTime: now,
    treeId,
    type: 'parent_child',
    personId1,
    personId2,
    createdBy: userId,
    createdAt: now,
});

describe('buildFanChartLayout', () => {
    it('assigns ancestor and descendant arcs in separate halves', () => {
        const root = createPerson('root', 'Root');
        const parent = createPerson('parent', 'Parent');
        const grandparent = createPerson('grandparent', 'Grand');
        const child = createPerson('child', 'Child');

        const layout = buildFanChartLayout({
            people: [root, parent, grandparent, child],
            relationships: [
                createRelationship('rel_parent_root', parent._id, root._id),
                createRelationship('rel_grand_parent', grandparent._id, parent._id),
                createRelationship('rel_root_child', root._id, child._id),
            ],
            rootPersonId: root._id,
        });

        const ancestorNodes = layout.nodes.filter((node) => node.side === 'ancestor');
        const descendantNodes = layout.nodes.filter((node) => node.side === 'descendant');

        expect(ancestorNodes).toHaveLength(2);
        expect(descendantNodes).toHaveLength(1);
        expect(layout.maxDepth).toBe(2);
        expect(layout.lineageOrder).toEqual([parent._id, child._id]);

        ancestorNodes.forEach((node) => {
            expect(node.angleStart).toBeGreaterThanOrEqual(Math.PI);
            expect(node.angleEnd).toBeLessThanOrEqual(Math.PI * 2);
        });

        descendantNodes.forEach((node) => {
            expect(node.angleStart).toBeGreaterThanOrEqual(0);
            expect(node.angleEnd).toBeLessThanOrEqual(Math.PI);
        });

        expect(ancestorNodes[0]?.lineageRootId).toBe(parent._id);
        expect(descendantNodes[0]?.lineageRootId).toBe(child._id);

        expect(layout.lineageIds.has(root._id)).toBe(true);
        expect(layout.lineageIds.has(parent._id)).toBe(true);
        expect(layout.lineageIds.has(child._id)).toBe(true);
    });
});
