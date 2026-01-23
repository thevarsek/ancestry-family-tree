import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { PersonList } from '../components/people/PersonList';
import { PlaceList } from '../components/places/PlaceList';
import { TreeVisualization } from '../components/trees/TreeVisualization';
import { SourceList } from '../components/sources/SourceList';

type TabType = 'people' | 'chart' | 'places' | 'sources';

const VALID_TABS: TabType[] = ['people', 'chart', 'places', 'sources'];

function isValidTab(tab: string | null): tab is TabType {
    return tab !== null && VALID_TABS.includes(tab as TabType);
}

export function TreePage() {
    const { treeId } = useParams<{ treeId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<TabType>(() => 
        isValidTab(tabParam) ? tabParam : 'people'
    );
    
    // Sync activeTab with URL param changes (e.g., when navigating from search)
    useEffect(() => {
        if (isValidTab(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [tabParam, activeTab]);
    
    // Update URL when tab changes via click
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        if (tab === 'people') {
            // Remove tab param for default tab
            searchParams.delete('tab');
        } else {
            searchParams.set('tab', tab);
        }
        setSearchParams(searchParams, { replace: true });
    };

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
                    onClick={() => handleTabChange('people')}
                >
                    People
                </button>
                <button
                    className={`tab ${activeTab === 'chart' ? 'tab-active' : ''}`}
                    onClick={() => handleTabChange('chart')}
                >
                    Chart
                </button>
                <button
                    className={`tab ${activeTab === 'places' ? 'tab-active' : ''}`}
                    onClick={() => handleTabChange('places')}
                >
                    Places
                </button>
                <button
                    className={`tab ${activeTab === 'sources' ? 'tab-active' : ''}`}
                    onClick={() => handleTabChange('sources')}
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
