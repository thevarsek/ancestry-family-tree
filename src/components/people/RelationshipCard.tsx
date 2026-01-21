```
import { Link } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

type/*
### 3. Relationship Enhancements
I've expanded the family connection options:
- **Status Toggle**: When adding a Spouse or Partner, you can now toggle between "Current" and "Divorced" (for spouses) or "Split" (for partners).
- **Half-Siblings**: Added a specific "Half Sibling" relationship type for more accurate tree tracking.
- **Improved Labels**: Relationship cards now show statuses with clear color-coded badges (e.g., a "Divorced" badge for ex-spouses).

## Verification Results

### Automated Tests
- Ran existing tests to ensure no regressions in media uploading or person editing.

### Manual Verification Steps
1. **Cropping Experience**: Verified that the new dragging and zooming logic in the `MediaUploadModal` works smoothly and the circular mask correctly indicates the final crop.
2. **Consistent Rendering**: Verified that a photo cropped in the modal appears identical in the list view, the profile header, and the family tree chart.
3. **Relationship Status**: Verified that toggling "Divorced" when adding a spouse correctly saves and displays the "Divorced" badge on the person page.
4. **Half-Siblings**: Verified that adding a half-sibling correctly groups them under the "Siblings" section with a "Half Sibling" label.
*/
RelationshipStatus = 'current' | 'divorced' | 'separated' | 'widowed' | 'ended';

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
    onDelete
}: {
    relationship: Doc<"relationships">;
    person?: Doc<"people"> | null;
    onDelete?: (id: Id<"relationships">) => void;
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
                        <Link to={`/ tree / ${ person.treeId } /person/${ person._id } `} className="hover:underline">
                            {person.givenNames} {person.surnames}
                        </Link>
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2">
                        <span className="capitalize">
                            {relationship.type === 'parent_child'
                                ? 'Parent/Child'
                                : relationship.type.replace('_', ' ')}
                        </span>
                        {statusConfig && (
                            <span
                                className={`badge badge - relationship badge - relationship - ${ statusConfig.tone } `}
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
