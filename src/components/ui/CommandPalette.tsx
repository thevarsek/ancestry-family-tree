import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { SearchResult } from '../../../convex/search';
import { ProfilePhoto } from '../people/ProfilePhoto';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const ICONS: Record<string, string> = {
    person: '👤',
    claim: '📅',
    place: '📍',
    source: '📄',
};

const TYPE_LABELS: Record<string, string> = {
    person: 'Person',
    claim: 'Event',
    place: 'Place',
    source: 'Source',
};

// Extract treeId from URL path like /tree/abc123/...
function extractTreeId(pathname: string): string | null {
    const match = pathname.match(/\/tree\/([^/]+)/);
    return match ? match[1] : null;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const treeId = extractTreeId(location.pathname);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const searchResults = useQuery(
        api.search.global,
        treeId && query.trim()
            ? { treeId: treeId as Id<"trees">, query: query.trim(), limit: 15 }
            : 'skip'
    ) as SearchResult[] | undefined;

    const results = useMemo(() => searchResults ?? [], [searchResults]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results.length]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && results.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            selectedElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, results.length]);

    const navigateToResult = useCallback((result: SearchResult) => {
        if (!treeId) return;

        switch (result.type) {
            case 'person':
                navigate(`/tree/${treeId}/person/${result.id}`);
                break;
            case 'claim':
                if (result.personId) {
                    navigate(`/tree/${treeId}/person/${result.personId}/event/${result.id}`);
                }
                break;
            case 'place':
                // Navigate to tree page with places tab
                navigate(`/tree/${treeId}?tab=places`);
                break;
            case 'source':
                navigate(`/tree/${treeId}/source/${result.id}`);
                break;
        }
        onClose();
    }, [treeId, navigate, onClose]);

    // Handle all keyboard shortcuts globally when modal is open
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl+K to toggle
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            // ESC to close
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            // Arrow navigation and Enter - only when input is focused
            if (document.activeElement === inputRef.current) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && results[selectedIndex]) {
                    e.preventDefault();
                    navigateToResult(results[selectedIndex]);
                }
            }
        };

        // Use capture phase to intercept before browser handles ESC
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose, results, selectedIndex, navigateToResult]);

    if (!isOpen) return null;

    const showNoTreeMessage = !treeId;
    const showEmptyState = treeId && query.trim() && results.length === 0 && searchResults !== undefined;
    const showHint = treeId && !query.trim();

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div 
                className="command-palette"
                role="dialog"
                aria-modal="true"
                aria-label="Search"
            >
                <div className="command-palette-input-wrapper">
                    <svg 
                        className="command-palette-search-icon" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder={treeId ? "Search people, events, places, sources..." : "Select a tree first"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={!treeId}
                    />
                    <kbd className="command-palette-shortcut">ESC</kbd>
                </div>

                <div className="command-palette-results" ref={listRef}>
                    {showNoTreeMessage && (
                        <div className="command-palette-empty">
                            <p>Open a family tree to search</p>
                        </div>
                    )}

                    {showHint && (
                        <div className="command-palette-hint">
                            <p>Start typing to search across your family tree</p>
                        </div>
                    )}

                    {showEmptyState && (
                        <div className="command-palette-empty">
                            <p>No results found for &ldquo;{query}&rdquo;</p>
                        </div>
                    )}

                        {results.map((result, index) => (
                            <button
                                key={`${result.type}-${result.id}`}
                                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => navigateToResult(result)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                {result.type === 'person' && result.profilePhoto ? (
                                    <div className="command-palette-item-photo">
                                        <ProfilePhoto
                                            src={result.profilePhoto.url}
                                            alt=""
                                            zoomLevel={result.profilePhoto.zoomLevel}
                                            focusX={result.profilePhoto.focusX}
                                            focusY={result.profilePhoto.focusY}
                                        />
                                    </div>
                                ) : (
                                    <span className="command-palette-item-icon">
                                        {ICONS[result.type]}
                                    </span>
                                )}
                                <div className="command-palette-item-content">
                                    <span className="command-palette-item-title">{result.title}</span>
                                    {result.subtitle && (
                                        <span className="command-palette-item-subtitle">{result.subtitle}</span>
                                    )}
                                </div>
                                <span className="command-palette-item-type">
                                    {TYPE_LABELS[result.type]}
                                </span>
                            </button>
                        ))}
                </div>

                <div className="command-palette-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                    <span><kbd>↵</kbd> select</span>
                    <span><kbd>esc</kbd> close</span>
                    <span className="command-palette-footer-tip"><kbd>⌘</kbd><kbd>K</kbd> to open anytime</span>
                </div>
            </div>
        </>
    );
}
