import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { SourceModal } from './SourceModal';

export function SourceList({ treeId }: { treeId: Id<"trees"> }) {
    const sources = useQuery(api.sources.list, { treeId, limit: 100 }) as Doc<"sources">[] | undefined;
    const [showCreate, setShowCreate] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    if (sources === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-8" />;
    }

    const filteredSources = sources.filter((source: Doc<"sources">) => {
        const haystack = `${source.title} ${source.author ?? ''}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Sources</h2>
                    <p className="text-muted text-sm">{sources.length} sources recorded</p>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowCreate(true)}
                >
                    + Add Source
                </button>
            </div>

            <div className="input-group">
                <input
                    className="input"
                    placeholder="Filter sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 gap-3">
                {filteredSources.map((source: Doc<"sources">) => (
                    <div
                        key={source._id}
                        className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/tree/${treeId}/source/${source._id}`)}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-lg">{source.title}</h4>
                                {source.author && (
                                    <p className="text-sm text-muted">by {source.author}</p>
                                )}
                                {source.url && (
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline mt-1 block"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {source.url}
                                    </a>
                                )}
                            </div>
                            <span className="badge badge-neutral">Source</span>
                        </div>
                        {source.notes && (
                            <p className="text-sm text-muted mt-2 border-t border-border-subtle pt-2">
                                {source.notes}
                            </p>
                        )}
                    </div>
                ))}

                {filteredSources.length === 0 && (
                    <div className="text-center py-8 text-muted">
                        No sources found matching &quot;{searchQuery}&quot;
                    </div>
                )}
            </div>

            {showCreate && (
                <SourceModal
                    treeId={treeId}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}
