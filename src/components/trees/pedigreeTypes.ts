import type { Doc, Id } from '../../../convex/_generated/dataModel';

export interface PersonWithPhoto extends Doc<"people"> {
    profilePhotoUrl?: string;
    profilePhotoZoom?: number;
    profilePhotoFocusX?: number;
    profilePhotoFocusY?: number;
    profilePhotoWidth?: number;
    profilePhotoHeight?: number;
}

// Layout types
export type LinkType = 'parent' | 'spouse';

/** A positioned node in the pedigree layout */
export interface LayoutNode<TPerson extends Doc<"people">> {
    id: Id<"people">;
    person: TPerson;
    x: number;
    y: number;
    generation: number;
}

/** A link between two nodes */
export interface LayoutLink<TPerson extends Doc<"people">> {
    from: LayoutNode<TPerson>;
    to: LayoutNode<TPerson>;
    type: LinkType;
    isHighlighted: boolean;
}

/** A family unit (parents + children) */
export interface LayoutFamily {
    id: string;
    parents: Id<"people">[];
    children: Id<"people">[];
}

/** Input for building a pedigree layout */
export interface LayoutInput<TPerson extends Doc<"people">> {
    people: TPerson[];
    relationships: Doc<"relationships">[];
    rootPersonId: Id<"people">;
    nodeWidth: number;
    nodeHeight: number;
    horizontalGap: number;
}

/** Result of building a pedigree layout */
export interface LayoutResult<TPerson extends Doc<"people">> {
    nodes: LayoutNode<TPerson>[];
    links: LayoutLink<TPerson>[];
    width: number;
    height: number;
    families: Map<string, LayoutFamily>;
    familyByChild: Map<Id<"people">, string>;
    nodeById: Map<Id<"people">, LayoutNode<TPerson>>;
}

/** A block of nodes (single or couple) for positioning */
export interface Block<TPerson extends Doc<"people">> {
    nodes: LayoutNode<TPerson>[];
    desiredCenter: number | null;
    height: number;
    key: string;
}
