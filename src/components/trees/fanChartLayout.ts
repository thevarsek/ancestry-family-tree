import type { Doc, Id } from '../../../convex/_generated/dataModel';

type FanChartSide = 'ancestor' | 'descendant';

interface TreeNode {
    id: Id<"people">;
    depth: number;
    children: TreeNode[];
    leafCount: number;
    angleStart: number;
    angleEnd: number;
    lineageRootId: Id<"people"> | null;
}

export interface FanChartNode<TPerson extends Doc<"people">> {
    id: Id<"people">;
    person: TPerson;
    depth: number;
    side: FanChartSide;
    angleStart: number;
    angleEnd: number;
    lineageRootId: Id<"people">;
}

export interface FanChartLayout<TPerson extends Doc<"people">> {
    nodes: FanChartNode<TPerson>[];
    rootPerson: TPerson;
    maxDepth: number;
    rootRadius: number;
    ringWidth: number;
    lineageIds: Set<Id<"people">>;
    lineageOrder: Id<"people">[];
}

interface FanChartLayoutInput<TPerson extends Doc<"people">> {
    people: TPerson[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    rootRadius?: number;
    ringWidth?: number;
}

const normalizeName = (person?: Doc<"people">) => {
    if (!person) return '';
    return `${person.surnames ?? ''} ${person.givenNames ?? ''}`.trim();
};

const buildTree = (
    rootId: Id<"people">,
    getChildren: (id: Id<"people">) => Id<"people">[],
    peopleById: Map<Id<"people">, Doc<"people">>
): TreeNode => {
    const visited = new Set<Id<"people">>();

    const buildNode = (id: Id<"people">, depth: number, lineageRootId: Id<"people"> | null): TreeNode | null => {
        if (visited.has(id)) return null;
        visited.add(id);
        const sortedChildren = [...getChildren(id)].sort((a, b) => {
            const left = normalizeName(peopleById.get(a));
            const right = normalizeName(peopleById.get(b));
            if (left && right && left !== right) return left.localeCompare(right);
            return a.localeCompare(b);
        });
        const children = sortedChildren
            .map((childId) => {
                const nextLineageRoot = depth === 0 ? childId : (lineageRootId ?? childId);
                return buildNode(childId, depth + 1, nextLineageRoot);
            })
            .filter((child): child is TreeNode => Boolean(child));

        const leafCount = children.length
            ? children.reduce((sum, child) => sum + child.leafCount, 0)
            : 1;

        return {
            id,
            depth,
            children,
            leafCount,
            angleStart: 0,
            angleEnd: 0,
            lineageRootId,
        };
    };

    return buildNode(rootId, 0, null) ?? {
        id: rootId,
        depth: 0,
        children: [],
        leafCount: 1,
        angleStart: 0,
        angleEnd: 0,
        lineageRootId: null,
    };
};

const assignAngles = (node: TreeNode, startAngle: number, endAngle: number) => {
    node.angleStart = startAngle;
    node.angleEnd = endAngle;
    if (!node.children.length) return;

    let currentAngle = startAngle;
    node.children.forEach((child) => {
        const span = (endAngle - startAngle) * (child.leafCount / node.leafCount);
        assignAngles(child, currentAngle, currentAngle + span);
        currentAngle += span;
    });
};

const collectNodes = <TPerson extends Doc<"people">>(
    node: TreeNode,
    side: FanChartSide,
    peopleById: Map<Id<"people">, TPerson>,
    output: FanChartNode<TPerson>[]
) => {
    if (node.depth > 0) {
        const person = peopleById.get(node.id);
        if (person) {
            output.push({
                id: node.id,
                person,
                depth: node.depth,
                side,
                angleStart: node.angleStart,
                angleEnd: node.angleEnd,
                lineageRootId: node.lineageRootId ?? node.id,
            });
        }
    }

    node.children.forEach((child) => collectNodes(child, side, peopleById, output));
};

const findMaxDepth = (node: TreeNode): number => {
    if (!node.children.length) return node.depth;
    return Math.max(node.depth, ...node.children.map(findMaxDepth));
};

const collectLineageIds = (node: TreeNode, ids: Set<Id<"people">>) => {
    ids.add(node.id);
    node.children.forEach((child) => collectLineageIds(child, ids));
};

export const buildFanChartLayout = <TPerson extends Doc<"people">>(
    input: FanChartLayoutInput<TPerson>
): FanChartLayout<TPerson> => {
    const { people, relationships, rootPersonId } = input;
    const rootRadius = input.rootRadius ?? 70;
    const ringWidth = input.ringWidth ?? 78;
    const peopleById = new Map(people.map((person) => [person._id, person]));
    const rootPerson = peopleById.get(rootPersonId);
    if (!rootPerson) {
        throw new Error('Root person not found for fan chart layout.');
    }

    const parentsByChild = new Map<Id<"people">, Id<"people">[]>();
    const childrenByParent = new Map<Id<"people">, Id<"people">[]>();

    relationships.forEach((relationship) => {
        if (relationship.type !== 'parent_child') return;
        const parentList = parentsByChild.get(relationship.personId2) ?? [];
        parentList.push(relationship.personId1);
        parentsByChild.set(relationship.personId2, parentList);

        const childList = childrenByParent.get(relationship.personId1) ?? [];
        childList.push(relationship.personId2);
        childrenByParent.set(relationship.personId1, childList);
    });

    const ancestorTree = buildTree(rootPersonId, (id) => parentsByChild.get(id) ?? [], peopleById);
    const descendantTree = buildTree(rootPersonId, (id) => childrenByParent.get(id) ?? [], peopleById);

    assignAngles(ancestorTree, Math.PI, Math.PI * 2);
    assignAngles(descendantTree, 0, Math.PI);

    const nodes: FanChartNode<TPerson>[] = [];
    collectNodes(ancestorTree, 'ancestor', peopleById, nodes);
    collectNodes(descendantTree, 'descendant', peopleById, nodes);

    const maxDepth = Math.max(findMaxDepth(ancestorTree), findMaxDepth(descendantTree));
    const lineageIds = new Set<Id<"people">>();
    collectLineageIds(ancestorTree, lineageIds);
    collectLineageIds(descendantTree, lineageIds);
    const lineageOrder = [...ancestorTree.children.map((child) => child.id), ...descendantTree.children.map((child) => child.id)]
        .filter((value, index, array) => array.indexOf(value) === index);

    return {
        nodes,
        rootPerson,
        maxDepth,
        rootRadius,
        ringWidth,
        lineageIds,
        lineageOrder,
    };
};
