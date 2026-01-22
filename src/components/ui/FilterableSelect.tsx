import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type FilterableOption = {
    id: string;
    label: string;
    description?: string;
    thumbnailUrl?: string | null;
    thumbnailLabel?: string;
};

type BaseSelectProps = {
    label?: string;
    placeholder?: string;
    emptyLabel?: string;
    options: FilterableOption[];
    footer?: ReactNode;
    className?: string;
};

type FilterableSelectProps = BaseSelectProps & {
    value: string | null;
    onChange: (value: string | null) => void;
};

type FilterableMultiSelectProps = BaseSelectProps & {
    value: string[];
    onChange: (value: string[]) => void;
};

function useOutsideClose(isOpen: boolean, onClose: () => void) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (!containerRef.current?.contains(target)) {
                onClose();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen, onClose]);

    return containerRef;
}

function useFilteredOptions(options: FilterableOption[], query: string) {
    return useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return options;
        return options.filter((option) => {
            const searchText = `${option.label} ${option.description ?? ''}`.toLowerCase();
            return searchText.includes(normalizedQuery);
        });
    }, [options, query]);
}

function OptionRow({
    option,
    isSelected,
    onSelect,
    showCheckbox,
}: {
    option: FilterableOption;
    isSelected: boolean;
    onSelect: () => void;
    showCheckbox: boolean;
}) {
    return (
        <button
            type="button"
            className={`filterable-select-option ${isSelected ? 'filterable-select-option-selected' : ''}`}
            onClick={onSelect}
        >
            {showCheckbox && (
                <input type="checkbox" readOnly checked={isSelected} className="checkbox" />
            )}
            {option.thumbnailUrl ? (
                <img
                    src={option.thumbnailUrl}
                    alt={option.label}
                    className="filterable-select-thumb"
                    loading="lazy"
                />
            ) : option.thumbnailLabel ? (
                <div className="filterable-select-thumb filterable-select-thumb-fallback">
                    <span className="filterable-select-thumb-label">{option.thumbnailLabel}</span>
                </div>
            ) : null}
            <div className="filterable-select-option-body">
                <div className="filterable-select-option-title">{option.label}</div>
                {option.description && (
                    <div className="filterable-select-option-description">{option.description}</div>
                )}
            </div>
            {!showCheckbox && isSelected && (
                <span className="filterable-select-option-status">Selected</span>
            )}
        </button>
    );
}

export function FilterableSelect({
    label,
    placeholder,
    emptyLabel = 'No matches found.',
    options,
    footer,
    className,
    value,
    onChange,
}: FilterableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useOutsideClose(isOpen, () => setIsOpen(false));
    const filteredOptions = useFilteredOptions(options, query);
    const selectedOption = options.find((option) => option.id === value) ?? null;
    const buttonLabel = selectedOption?.label ?? placeholder ?? 'Select...';

    return (
        <div ref={containerRef} className={`filterable-select ${className ?? ''}`}>
            <button
                type="button"
                className="input filterable-select-trigger"
                aria-label={label ? `Select ${label}` : 'Select option'}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className={selectedOption ? '' : 'text-muted'}>{buttonLabel}</span>
                <span className="filterable-select-caret">v</span>
            </button>
            {isOpen && (
                <div className="filterable-select-panel">
                    <input
                        className="input filterable-select-search"
                        placeholder={label ? `Search ${label.toLowerCase()}...` : 'Search...'}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        autoFocus
                    />
                    <div className="filterable-select-options">
                        {filteredOptions.map((option) => (
                            <OptionRow
                                key={option.id}
                                option={option}
                                isSelected={option.id === value}
                                onSelect={() => {
                                    onChange(option.id === value ? null : option.id);
                                    setIsOpen(false);
                                    setQuery('');
                                }}
                                showCheckbox={false}
                            />
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="filterable-select-empty">{emptyLabel}</div>
                        )}
                    </div>
                    {footer && <div className="filterable-select-footer">{footer}</div>}
                </div>
            )}
        </div>
    );
}

export function FilterableMultiSelect({
    label,
    placeholder,
    emptyLabel = 'No matches found.',
    options,
    footer,
    className,
    value,
    onChange,
}: FilterableMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useOutsideClose(isOpen, () => setIsOpen(false));
    const filteredOptions = useFilteredOptions(options, query);
    const selectedLabels = options
        .filter((option) => value.includes(option.id))
        .map((option) => option.label);
    const selectedSummary = selectedLabels.length === 0
        ? placeholder ?? 'Select...'
        : selectedLabels.length <= 2
            ? selectedLabels.join(', ')
            : `${selectedLabels.length} selected`;

    return (
        <div ref={containerRef} className={`filterable-select ${className ?? ''}`}>
            <button
                type="button"
                className="input filterable-select-trigger"
                aria-label={label ? `Select ${label}` : 'Select options'}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className={selectedLabels.length ? '' : 'text-muted'}>{selectedSummary}</span>
                <span className="filterable-select-caret">v</span>
            </button>
            {isOpen && (
                <div className="filterable-select-panel">
                    <input
                        className="input filterable-select-search"
                        placeholder={label ? `Search ${label.toLowerCase()}...` : 'Search...'}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        autoFocus
                    />
                    <div className="filterable-select-options">
                        {filteredOptions.map((option) => (
                            <OptionRow
                                key={option.id}
                                option={option}
                                isSelected={value.includes(option.id)}
                                onSelect={() => {
                                    if (value.includes(option.id)) {
                                        onChange(value.filter((id) => id !== option.id));
                                    } else {
                                        onChange([...value, option.id]);
                                    }
                                }}
                                showCheckbox
                            />
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="filterable-select-empty">{emptyLabel}</div>
                        )}
                    </div>
                    {footer && <div className="filterable-select-footer">{footer}</div>}
                </div>
            )}
        </div>
    );
}
