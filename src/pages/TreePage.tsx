import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { PersonList } from '../components/people/PersonList';
import { PlaceList } from '../components/places/PlaceList';
import { TreeVisualization } from '../components/trees/TreeVisualization';
import { SourceList } from '../components/sources/SourceList';

export function TreePage() {
    const { treeId } = useParams<{ treeId: string }>();
    const [activeTab, setActiveTab] = useState<'people' | 'chart' | 'places' | 'sources'>('people');

    // Validate tree access
    const tree = useQuery(api.trees.get,
        treeId ? { treeId: treeId as Id<"trees"> } : "skip"
    ) as Doc<"trees"> | null | undefined;

    if (tree === undefined) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    if (tree === null) {
        return (
            <div className="container py-12 text-center">
                <h2 className="text-xl font-bold mb-2">Tree Not Found</h2>
                <p className="text-muted mb-4">This tree does not exist or you don&apos;t have access.</p>
                <Link to="/" className="btn btn-primary">Return Home</Link>
            </div>
        );
    }

    return (
        <div className="container py-8">
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to="/" className="hover:text-accent">Trees</Link>
                    <span>/</span>
                    <span>{tree.name}</span>
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">{tree.name}</h1>
                        <p className="text-muted">{tree.description}</p>
                    </div>
                    <div className="flex gap-2">
                        <Link to={`/tree/${tree._id}/settings`} className="btn btn-secondary">
                            Settings
                        </Link>
                    </div>
                </div>
            </div>

            <div className="tabs mb-6">
                <button
                    className={`tab ${activeTab === 'people' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('people')}
                >
                    People
                </button>
                <button
                    className={`tab ${activeTab === 'chart' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('chart')}
                >
                    Chart
                </button>
                <button
                    className={`tab ${activeTab === 'places' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('places')}
                >
                    Places
                </button>
                <button
                    className={`tab ${activeTab === 'sources' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('sources')}
                >
                    Sources
                </button>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'people' && (
                    <PersonList treeId={tree._id} />
                )}
                {activeTab === 'chart' && (
                    <TreeVisualization treeId={tree._id} />
                )}
                {activeTab === 'places' && (
                    <PlaceList treeId={tree._id} />
                )}
                {activeTab === 'sources' && (
                    <SourceList treeId={tree._id} />
                )}
            </div>
        </div>
    );
}
