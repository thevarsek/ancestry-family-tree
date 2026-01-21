import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export function CreateTreeModal({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createTree = useMutation(api.trees.create);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await createTree({ name, description });
            onClose();
        } catch (error) {
            console.error("Failed to create tree:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Create New Tree</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="input-group mb-4">
                            <label className="input-label">Tree Name</label>
                            <input
                                className="input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Smith Family Tree"
                                autoFocus
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Description (optional)</label>
                            <input
                                className="input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of this tree"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!name.trim() || isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Tree'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

export function TreeList() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const trees = useQuery(api.trees.list, isAuthenticated ? {} : 'skip');
    const visibleTrees = (trees ?? []).filter(
        (tree): tree is NonNullable<typeof tree> => tree !== null
    );
    const [showCreate, setShowCreate] = useState(false);

    if (isLoading) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    if (!isAuthenticated) {
        return null;
    }
    const { user } = useUser();

    // Handle user sync on first load
    const syncUser = useMutation(api.users.getOrCreate);
    useState(() => {
        if (user) {
            syncUser();
        }
    });

    if (trees === undefined) {
        return (
            <div className="py-12 text-center">
                <div className="spinner spinner-lg mx-auto mb-4" />
                <p className="text-muted">Loading your trees...</p>
            </div>
        );
    }

    return (
        <div className="container py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Your Trees</h1>
                    <p className="text-muted">Manage your family trees and invites</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreate(true)}
                >
                    <span className="text-lg">+</span> New Tree
                </button>
            </div>

            {visibleTrees.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-state-icon">🌳</div>
                    <h3 className="empty-state-title">No trees yet</h3>
                    <p className="empty-state-description">
                        Create your first family tree to start documenting your history.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreate(true)}
                    >
                        Create Tree
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleTrees.map((tree) => (
                        <div
                            key={tree._id}
                            className="card card-interactive cursor-pointer hover:border-accent"
                            onClick={() => navigate(`/tree/${tree._id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    navigate(`/tree/${tree._id}`);
                                }
                            }}
                        >
                            <div className="card-header">
                                <span className="text-2xl">🌳</span>
                                {tree.role === 'admin' && (
                                    <span className="badge badge-info text-xs">Admin</span>
                                )}
                            </div>
                            <h3 className="card-title mb-2">{tree.name}</h3>
                            <p className="text-sm text-muted line-clamp-2">
                                {tree.description || "No description"}
                            </p>
                            <div className="mt-4 pt-4 border-t border-border-subtle flex justify-between text-xs text-muted">
                                <span>Created {new Date(tree.createdAt).toLocaleDateString()}</span>
                                {tree.role === 'admin' ? (
                                    <button
                                        className="text-accent hover:underline"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/tree/${tree._id}`);
                                        }}
                                    >
                                        Manage
                                    </button>
                                ) : (
                                    <span>View Only</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateTreeModal onClose={() => setShowCreate(false)} />
            )}
        </div>
    );
}
