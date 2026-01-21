import type { Id } from '../../../convex/_generated/dataModel';

export function TreeVisualization({ treeId }: { treeId: Id<"trees"> }) {
    void treeId;
    // For MVP, we'll just list people in a hierarchical way or maybe just a list for now
    // A true visualizer is complex. Let's do a "Generations" view ?
    // Or actually, just fetching all people and doing a rudimentary graph check logic might be heavy.
    // Let's stick to a "Pedigree View" starting from a root person?
    // We need a way to pick a "root".

    // For now, let's just show a placeholder or a very simple list grouped by surname?
    // Actually, users typically want to see a chart.
    // MVP: Just show all people card grid. We already have a list.
    // Let's make a "Family Diagram" placeholder that explains this feature is coming.

    return (
        <div className="text-center py-12">
            <div className="text-6xl mb-4">🌳</div>
            <h3 className="text-xl font-bold mb-2">Interactive Family Tree</h3>
            <p className="text-muted max-w-md mx-auto">
                Visual pedigree and descendant charts are currently under development.
                Please use the &quot;People&quot; tab to browse individual profiles and relationships.
            </p>
        </div>
    );
}
