import { Link } from 'react-router-dom';
import type { Doc } from '../../../convex/_generated/dataModel';
import { ProfilePhoto } from './ProfilePhoto';

type RelationshipEntry = {
    relationship: Doc<'relationships'>;
    person?: Doc<'people'> | null;
};

type RelationshipGroups = {
    parents: RelationshipEntry[];
    spouses: RelationshipEntry[];
    siblings: RelationshipEntry[];
    children: RelationshipEntry[];
};

type ProfilePhotoData = {
    storageUrl?: string | null;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
};

type RelationshipChartProps = {
    person: Doc<'people'>;
    profilePhoto?: ProfilePhotoData;
    relationships: RelationshipGroups;
    getRelationshipPhoto: (relationPerson?: Doc<'people'> | null) => ProfilePhotoData | undefined;
};

const formatRelationshipLabel = (relationship: Doc<'relationships'>, fallback: string) => {
    if (relationship.type === 'parent_child') {
        return fallback;
    }
    if (relationship.type === 'partner') {
        return 'Partner';
    }
    if (relationship.type === 'spouse') {
        return 'Spouse';
    }
    if (relationship.type === 'half_sibling') {
        return 'Half sibling';
    }
    const formatted = relationship.type.replace('_', ' ');
    return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
};

const hasPerson = (
    entry: RelationshipEntry
): entry is RelationshipEntry & { person: Doc<'people'> } => Boolean(entry.person);

const RelationshipChartNode = ({
    person,
    profilePhoto,
    label,
    isCenter,
}: {
    person: Doc<'people'>;
    profilePhoto?: ProfilePhotoData;
    label?: string;
    isCenter?: boolean;
}) => {
    const initials = `${person.givenNames?.[0] ?? ''}${person.surnames?.[0] ?? ''}`;
    return (
        <div className={`relationship-chart-node${isCenter ? ' is-center' : ''}`}>
            <Link to={`/tree/${person.treeId}/person/${person._id}`} className="relationship-chart-node-card">
                <div className="avatar avatar-sm overflow-hidden">
                    {profilePhoto?.storageUrl ? (
                        <ProfilePhoto
                            src={profilePhoto.storageUrl}
                            alt={`${person.givenNames ?? ''} ${person.surnames ?? ''}`}
                            zoomLevel={profilePhoto.zoomLevel}
                            focusX={profilePhoto.focusX}
                            focusY={profilePhoto.focusY}
                        />
                    ) : (
                        <span>{initials}</span>
                    )}
                </div>
                <div className="relationship-chart-node-text">
                    <div className="relationship-chart-node-name">
                        {person.givenNames} {person.surnames}
                    </div>
                    {label && <div className="relationship-chart-node-role">{label}</div>}
                </div>
            </Link>
        </div>
    );
};

export function RelationshipChart({
    person,
    profilePhoto,
    relationships,
    getRelationshipPhoto,
}: RelationshipChartProps) {
    const parents = relationships.parents.filter(hasPerson);
    const spouses = relationships.spouses.filter(hasPerson);
    const siblings = relationships.siblings.filter(hasPerson);
    const children = relationships.children.filter(hasPerson);

    const totalRelationships =
        relationships.parents.length +
        relationships.spouses.length +
        relationships.siblings.length +
        relationships.children.length;
    const hasRelationships = totalRelationships > 0;
    const siblingSplitIndex = Math.ceil(siblings.length / 2);
    const siblingLeft = siblings.slice(0, siblingSplitIndex);
    const siblingRight = siblings.slice(siblingSplitIndex);
    const showParents = parents.length > 0;
    const showPartners = spouses.length > 0;
    const showChildren = children.length > 0;
    const showParentConnector = showParents;
    const showMiddleConnector = showPartners || showChildren;
    const showPartnerConnector = showPartners && showChildren;
    const middleLabel = siblings.length > 0 ? 'Siblings' : 'Selected';

    return (
        <section className="card relationship-chart">
            <div className="relationship-chart-header">
                <div>
                    <h4 className="relationship-chart-title">Relationship Map</h4>
                    <p className="relationship-chart-subtitle">Immediate family, one level up or down.</p>
                </div>
            </div>

            {!hasRelationships ? (
                <div className="relationship-chart-empty">
                    <RelationshipChartNode person={person} profilePhoto={profilePhoto} isCenter />
                    <p className="text-sm text-muted">No relationships recorded yet.</p>
                </div>
            ) : (
                <div className="relationship-chart-body relationship-chart-scroll">
                    <div className="relationship-chart-canvas">
                        <div className="relationship-chart-tree">
                            {showParents ? (
                                <div className="relationship-chart-row">
                                    <span className="relationship-chart-label">Parents</span>
                                    <div className="relationship-chart-line-row relationship-chart-line-row-bottom">
                                        <div className="relationship-chart-node-row">
                                            {parents.map((entry) => (
                                                <div
                                                    key={entry.relationship._id}
                                                    className="relationship-chart-line-node relationship-chart-line-node-down"
                                                >
                                                    <RelationshipChartNode
                                                        person={entry.person}
                                                        profilePhoto={getRelationshipPhoto(entry.person)}
                                                        label={formatRelationshipLabel(entry.relationship, 'Parent')}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {showParentConnector ? (
                                <div className="relationship-chart-connector" aria-hidden="true" />
                            ) : null}

                            <div className="relationship-chart-row">
                                <span className="relationship-chart-label">{middleLabel}</span>
                                <div className="relationship-chart-line-row relationship-chart-line-row-top">
                                    <div className="relationship-chart-siblings-grid">
                                        <div className="relationship-chart-siblings-group">
                                            <div className="relationship-chart-node-row">
                                                {siblingLeft.map((entry) => (
                                                    <div
                                                        key={entry.relationship._id}
                                                        className="relationship-chart-line-node relationship-chart-line-node-up"
                                                    >
                                                        <RelationshipChartNode
                                                            person={entry.person}
                                                            profilePhoto={getRelationshipPhoto(entry.person)}
                                                            label={formatRelationshipLabel(entry.relationship, 'Sibling')}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="relationship-chart-siblings-group relationship-chart-siblings-group-center">
                                            <div className="relationship-chart-line-node relationship-chart-line-node-up relationship-chart-line-node-down">
                                                <RelationshipChartNode
                                                    person={person}
                                                    profilePhoto={profilePhoto}
                                                    isCenter
                                                />
                                            </div>
                                        </div>

                                        <div className="relationship-chart-siblings-group">
                                            <div className="relationship-chart-node-row">
                                                {siblingRight.map((entry) => (
                                                    <div
                                                        key={entry.relationship._id}
                                                        className="relationship-chart-line-node relationship-chart-line-node-up"
                                                    >
                                                        <RelationshipChartNode
                                                            person={entry.person}
                                                            profilePhoto={getRelationshipPhoto(entry.person)}
                                                            label={formatRelationshipLabel(entry.relationship, 'Sibling')}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {showMiddleConnector ? (
                                <div className="relationship-chart-connector" aria-hidden="true" />
                            ) : null}

                            {showPartners ? (
                                <div className="relationship-chart-row">
                                    <span className="relationship-chart-label">Partners</span>
                                    <div className="relationship-chart-line-row relationship-chart-line-row-top">
                                        <div className="relationship-chart-node-row">
                                            {spouses.map((entry) => (
                                                <div
                                                    key={entry.relationship._id}
                                                    className="relationship-chart-line-node relationship-chart-line-node-up"
                                                >
                                                    <RelationshipChartNode
                                                        person={entry.person}
                                                        profilePhoto={getRelationshipPhoto(entry.person)}
                                                        label={formatRelationshipLabel(entry.relationship, 'Partner')}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {showPartnerConnector ? (
                                <div className="relationship-chart-connector" aria-hidden="true" />
                            ) : null}

                            {showChildren ? (
                                <div className="relationship-chart-row">
                                    <span className="relationship-chart-label">Children</span>
                                    <div className="relationship-chart-line-row relationship-chart-line-row-top">
                                        <div className="relationship-chart-node-row">
                                            {children.map((entry) => (
                                                <div
                                                    key={entry.relationship._id}
                                                    className="relationship-chart-line-node relationship-chart-line-node-up"
                                                >
                                                    <RelationshipChartNode
                                                        person={entry.person}
                                                        profilePhoto={getRelationshipPhoto(entry.person)}
                                                        label={formatRelationshipLabel(entry.relationship, 'Child')}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
