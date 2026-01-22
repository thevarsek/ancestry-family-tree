import type { Id } from '../../../convex/_generated/dataModel';
import type { LayoutLink, LayoutNode } from './pedigreeLayout';
import type { PersonWithPhoto } from './pedigreeTypes';

export function renderParentLinks({
    parentLinks,
    families,
    familyByChild,
    nodeById,
    nodeWidth,
    nodeHeight,
    horizontalGap
}: {
    parentLinks: LayoutLink<PersonWithPhoto>[];
    families: Map<string, { parents: Id<"people">[]; children: Id<"people">[] }>;
    familyByChild: Map<Id<"people">, string>;
    nodeById: Map<Id<"people">, LayoutNode<PersonWithPhoto>>;
    nodeWidth: number;
    nodeHeight: number;
    horizontalGap: number;
}) {
    const familyLinks = new Map<string, LayoutLink<PersonWithPhoto>[]>();

    parentLinks.forEach((link) => {
        const familyId = familyByChild.get(link.to.id);
        if (!familyId) return;
        const links = familyLinks.get(familyId) ?? [];
        links.push(link);
        familyLinks.set(familyId, links);
    });

    return Array.from(familyLinks.entries()).map(([familyId, links]) => {
        const fam = families.get(familyId);
        if (!fam) return null;

        const parentNodes = fam.parents
            .map((pid) => nodeById.get(pid))
            .filter((node): node is LayoutNode<PersonWithPhoto> => Boolean(node));

        if (!parentNodes.length) return null;

        const unionY = parentNodes.reduce((sum, parent) => sum + (parent.y + nodeHeight / 2), 0) / parentNodes.length;
        const leftmostParent = parentNodes.reduce((left, parent) => (parent.x < left.x ? parent : left));
        const gutterX = leftmostParent.x + nodeWidth + horizontalGap / 2;

        return (
            <g key={`family-${familyId}`}>
                {parentNodes.map((parent, index) => {
                    const fromX = parent.x + nodeWidth;
                    const fromY = parent.y + nodeHeight / 2;
                    const parentToUnion = `M ${fromX} ${fromY} L ${gutterX} ${fromY} L ${gutterX} ${unionY}`;
                    const familyHighlight = links.some((link) => link.isHighlighted);

                    return (
                        <path
                            key={`parent-${index}`}
                            d={parentToUnion}
                            stroke={familyHighlight ? 'var(--color-accent)' : 'var(--color-border)'}
                            strokeWidth={familyHighlight ? 3 : 2}
                            fill="none"
                            opacity={familyHighlight ? 0.95 : 0.7}
                        />
                    );
                })}
                {links.map((link, index) => {
                    const toX = link.to.x;
                    const toY = link.to.y + nodeHeight / 2;
                    const unionToChild = `M ${gutterX} ${unionY} L ${gutterX} ${toY} L ${toX} ${toY}`;

                    return (
                        <path
                            key={`child-${index}`}
                            d={unionToChild}
                            stroke={link.isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
                            strokeWidth={link.isHighlighted ? 3 : 2}
                            fill="none"
                            opacity={link.isHighlighted ? 0.95 : 0.7}
                        />
                    );
                })}
            </g>
        );
    });
}
