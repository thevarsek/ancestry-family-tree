import { useState, useRef, useEffect } from 'react';

export interface QuickLinkOption {
    id: string;
    label: string;
    description?: string;
}

interface QuickLinkDropdownProps {
    /** Label shown on the trigger button */
    buttonLabel?: string;
    /** Items available to link */
    options: QuickLinkOption[];
    /** Callback when an existing item is selected */
    onSelect: (id: string) => void;
    /** Callback when "Create New" is clicked */
    onCreateNew?: () => void;
    /** Label for the create new button */
    createNewLabel?: string;
    /** Text shown when no options available */
    emptyLabel?: string;
    /** Whether to show loading state */
    isLoading?: boolean;
    /** Disable the dropdown */
    disabled?: boolean;
}

/**
 * A dropdown component for quickly linking existing items or creating new ones.
 * Used on detail pages for inline association management.
 */
export function QuickLinkDropdown({
    buttonLabel = '+ Add',
    options,
    onSelect,
    onCreateNew,
    createNewLabel = 'Create New',
    emptyLabel = 'No items available',
    isLoading = false,
    disabled = false,
}: QuickLinkDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleCreateNew = () => {
        if (onCreateNew) {
            onCreateNew();
            setIsOpen(false);
            setSearchQuery('');
        }
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled || isLoading}
            >
                {isLoading ? (
                    <span className="spinner spinner-sm" />
                ) : (
                    buttonLabel
                )}
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 right-0 w-72 bg-card border border-border rounded-md shadow-lg">
                    {/* Search input */}
                    <div className="p-2 border-b border-border">
                        <input
                            ref={inputRef}
                            type="text"
                            className="input input-sm w-full"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted">
                                {searchQuery ? 'No matches found' : emptyLabel}
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-hover transition-colors"
                                    onClick={() => handleSelect(option.id)}
                                >
                                    <div className="text-sm font-medium truncate">{option.label}</div>
                                    {option.description && (
                                        <div className="text-xs text-muted truncate">{option.description}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Create new option */}
                    {onCreateNew && (
                        <div className="border-t border-border p-2">
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm w-full"
                                onClick={handleCreateNew}
                            >
                                {createNewLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
