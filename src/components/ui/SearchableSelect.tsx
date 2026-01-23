import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;  // For brand display
  groupLabel?: string;   // For master item grouping
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  allowAddNew?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  required,
  className = '',
  allowAddNew = false,
  onAddNew,
  addNewLabel = '+ Add New Item',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get the display value for the selected option
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption
    ? `${selectedOption.label}${selectedOption.description ? ` - ${selectedOption.description}` : ''}`
    : '';

  // Filter options based on search term
  const filteredOptions = options.filter(opt => {
    if (opt.disabled) return true; // Keep disabled/header items for structure
    const searchLower = searchTerm.toLowerCase();
    const labelMatch = opt.label.toLowerCase().includes(searchLower);
    const descMatch = opt.description?.toLowerCase().includes(searchLower) || false;
    const groupMatch = opt.groupLabel?.toLowerCase().includes(searchLower) || false;
    return labelMatch || descMatch || groupMatch;
  });

  // Group options by groupLabel
  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const group = opt.groupLabel || '__standalone__';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(opt);
    return acc;
  }, {} as Record<string, SearchableSelectOption[]>);

  // Flatten grouped options for keyboard navigation
  const flatOptions: (SearchableSelectOption | { isGroupHeader: true; label: string })[] = [];

  // Add "+ Add New" option at the top if enabled
  if (allowAddNew) {
    flatOptions.push({ value: '__add_new__', label: addNewLabel, disabled: false });
  }

  // Sort groups: named groups first (alphabetically), then standalone
  const sortedGroups = Object.keys(groupedOptions).sort((a, b) => {
    if (a === '__standalone__') return 1;
    if (b === '__standalone__') return -1;
    return a.localeCompare(b);
  });

  sortedGroups.forEach(group => {
    if (group !== '__standalone__') {
      flatOptions.push({ isGroupHeader: true, label: group });
    }
    groupedOptions[group].forEach(opt => {
      if (!opt.disabled) {
        flatOptions.push(opt);
      }
    });
  });

  // Get selectable options for keyboard navigation
  const selectableIndices = flatOptions
    .map((opt, idx) => ('isGroupHeader' in opt ? -1 : idx))
    .filter(idx => idx !== -1);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputClick = () => {
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = useCallback((optValue: string) => {
    if (optValue === '__add_new__') {
      onAddNew?.();
    } else {
      onChange(optValue);
    }
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange, onAddNew]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const currentIdx = selectableIndices.indexOf(highlightedIndex);
        const nextIdx = currentIdx < selectableIndices.length - 1 ? currentIdx + 1 : 0;
        setHighlightedIndex(selectableIndices[nextIdx] ?? -1);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const currentIdx = selectableIndices.indexOf(highlightedIndex);
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : selectableIndices.length - 1;
        setHighlightedIndex(selectableIndices[prevIdx] ?? -1);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (highlightedIndex >= 0 && flatOptions[highlightedIndex]) {
          const opt = flatOptions[highlightedIndex];
          if (!('isGroupHeader' in opt)) {
            handleSelect(opt.value);
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        setSearchTerm('');
        break;
      }
    }
  };

  const hasResults = flatOptions.some(opt => !('isGroupHeader' in opt));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required && !value}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {isOpen ? (
            <Search className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {!hasResults ? (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          ) : (
            flatOptions.map((opt, idx) => {
              if ('isGroupHeader' in opt) {
                return (
                  <div
                    key={`header-${opt.label}`}
                    className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider border-t border-gray-200 first:border-t-0"
                  >
                    {opt.label}
                  </div>
                );
              }

              const isAddNew = opt.value === '__add_new__';
              const isHighlighted = idx === highlightedIndex;
              const isSelected = opt.value === value;

              return (
                <div
                  key={opt.value}
                  data-index={idx}
                  onClick={() => handleSelect(opt.value)}
                  className={`
                    px-3 py-2 cursor-pointer text-sm
                    ${opt.groupLabel && opt.groupLabel !== '__standalone__' ? 'pl-6' : ''}
                    ${isHighlighted ? 'bg-blue-50' : ''}
                    ${isSelected ? 'bg-blue-100 font-medium' : ''}
                    ${isAddNew ? 'text-blue-600 font-medium border-b border-gray-200' : ''}
                    hover:bg-blue-50
                  `}
                >
                  {isAddNew ? (
                    <span className="flex items-center gap-1">
                      <Plus className="w-4 h-4" />
                      {opt.label}
                    </span>
                  ) : (
                    <span>
                      {opt.label}
                      {opt.description && (
                        <span className="text-gray-500 ml-1">- {opt.description}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
