import { Link } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

type RelationshipStatus = 'current' | 'divorced' | 'separated' | 'widowed' | 'ended';

const relationshipStatusConfig: Record<RelationshipStatus, { label: string; tone: 'current' | 'ended' }> = {
    current: { label: 'Current', tone: 'current' },
    divorced: { label: 'Divorced', tone: 'ended' },
    separated: { label: 'Separated', tone: 'ended' },
    widowed: { label: 'Widowed', tone: 'ended' },
    ended: { label: 'Ended', tone: 'ended' }
};

export function RelationshipCard({
    relationship,
    person,
    onDelete,
    roleLabel
}: {
    relationship: Doc<"relationships">;
    person?: Doc<"people"> | null;
    onDelete?: (id: Id<"relationships">) => void;
    roleLabel?: string;
}) {
    if (!person) {
        return null;
    }

    const statusConfig = relationship.status
        ? relationshipStatusConfig[relationship.status as RelationshipStatus]
        : null;

    return (
        <div className="card p-3 flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className="avatar">
                    <span>{(person.givenNames?.[0] || '') + (person.surnames?.[0] || '')}</span>
                </div>
                <div>
                    <div className="font-semibold">
                        <Link to={`/tree/${person.treeId}/person/${person._id}`} className="hover:underline">
                            {person.givenNames} {person.surnames}
                        </Link>
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2">
                        <span className="capitalize">
                            {relationship.type === 'parent_child'
                                ? (roleLabel ?? 'Parent/Child')
                                : relationship.type.replace('_', ' ')}
                        </span>
                        {statusConfig && (
                            <span
                                className={`badge badge-relationship badge-relationship-${statusConfig.tone}`}
                            >
                                {statusConfig.label}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {onDelete && (
                <button
                    className="btn btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100 transition-opacity text-error"
                    onClick={() => onDelete(relationship._id)}
                    title="Remove Relationship"
                >
                    ×
                </button>
            )}
        </div>
    );
}
