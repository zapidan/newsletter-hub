import { useSourceSearch } from '@common/hooks';
import type { InboxFilterType } from "@common/hooks/useInboxFilters"; // Import the shared type
import type { NewsletterSource as NewsletterSourceType } from "@common/types";
import { Archive, ArrowUpDown, Building2, ChevronDown, Clock, Eye, EyeOff, Heart, Search } from "lucide-react";
import { FC, memo, useMemo, useState } from "react";

export type FilterType = InboxFilterType; // Use the shared type
export type TimeRange = "all" | "day" | "2days" | "week" | "month";

export interface NewsletterSourceWithCount extends NewsletterSourceType {
  count?: number;
}

interface InboxFiltersProps {
  filter: FilterType;
  sourceFilter: string | null;
  // Legacy single-select (kept for backward compatibility if callers still pass it)
  groupFilter?: string | null;
  // New multi-select groups
  groupFilters?: string[];
  timeRange: TimeRange;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  newsletterSources: NewsletterSourceWithCount[];
  newsletterGroups?: { id: string; name: string; count?: number }[];
  onFilterChange: (filter: FilterType) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  // Legacy single-select handler (optional)
  onGroupFilterChange?: (groupId: string | null) => void;
  // New multi-select handler
  onGroupFiltersChange?: (groupIds: string[]) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderChange: (sortOrder: 'asc' | 'desc') => void;
  isLoading?: boolean;
  isLoadingSources?: boolean;
  isLoadingGroups?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  showTimeFilter?: boolean;
  showSourceFilter?: boolean;
  showGroupFilter?: boolean;
  showFilterCounts?: boolean;
  onSelectClick?: () => void;
}

const TIME_RANGE_OPTIONS = [
  { value: "all" as const, label: "All Time" },
  { value: "day" as const, label: "Today" },
  { value: "2days" as const, label: "2 Days" },
  { value: "week" as const, label: "This Week" },
  { value: "month" as const, label: "This Month" },
];

const SORT_OPTIONS = [
  { value: "received_at" as const, label: "Date" },
  { value: "estimated_read_time" as const, label: "Reading Time" },
];

const FILTER_OPTIONS = [
  { value: "unread" as const, label: "Unread", icon: EyeOff },
  { value: "read" as const, label: "Read", icon: Eye },
  { value: "liked" as const, label: "Liked", icon: Heart },
  { value: "archived" as const, label: "Archived", icon: Archive },
];

// Time Filter Dropdown Component
const TimeFilterDropdown: FC<{
  selectedRange: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
  compact?: boolean;
}> = memo(({ selectedRange, onChange, disabled = false, compact = false }) => {
  return (
    <div className="relative flex items-center">
      <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
        <Clock className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400`} />
      </div>
      <select
        value={selectedRange}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        disabled={disabled}
        className={`
          appearance-none bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg
          ${compact ? "pl-6 pr-2 py-1 text-xs" : "pl-8 pr-3 py-1.5 text-sm"}
          text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-2
          focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${disabled ? "bg-gray-50 dark:bg-neutral-900" : "hover:bg-gray-50 dark:hover:bg-neutral-800/60"}
        `}
        aria-label="Filter by time range"
      >
        {TIME_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
});

// Sort Dropdown Component
const SortDropdown: FC<{
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortByChange: (sortBy: string) => void;
  onSortOrderChange: (sortOrder: 'asc' | 'desc') => void;
  disabled?: boolean;
  compact?: boolean;
}> = memo(({ sortBy, sortOrder, onSortByChange, onSortOrderChange, disabled = false, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSortOrderToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const getSortLabel = () => {
    const sortOption = SORT_OPTIONS.find(option => option.value === sortBy);
    return sortOption?.label || 'Date';
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          flex items-center gap-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg
          ${compact ? "px-2 py-1 text-xs min-w-[80px]" : "px-3 py-1.5 text-sm min-w-[100px]"}
          text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-2
          focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${disabled ? "bg-gray-50 dark:bg-neutral-900" : "hover:bg-gray-50 dark:hover:bg-neutral-800/60"}
        `}
        aria-label="Sort newsletters"
        aria-expanded={isOpen}
      >
        <ArrowUpDown className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400`} />
        <span className="truncate">{getSortLabel()}</span>
        <button
          type="button"
          onClick={handleSortOrderToggle}
          className={`
            ${compact ? "text-xs px-1" : "text-xs px-1.5"}
            py-0.5 rounded font-medium transition-colors
            ${sortOrder === 'desc'
              ? "bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-slate-200"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
            }
          `}
          aria-label={`Sort order: ${sortOrder === 'desc' ? 'newest first' : 'oldest first'}`}
        >
          {sortOrder === 'desc' ? '↓' : '↑'}
        </button>
        <ChevronDown
          className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "transform rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-neutral-900 rounded-md shadow-lg z-50 border border-gray-200 dark:border-neutral-800">
            <div className="py-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSortByChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-4 py-2 text-sm flex items-center justify-between
                    ${sortBy === option.value
                      ? "bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-medium"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                    }
                  `}
                >
                  <span>{option.label}</span>
                  {sortBy === option.value && (
                    <span className="text-blue-600">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

// Source Filter Dropdown Component
const SourceFilterDropdown: FC<{
  sources: NewsletterSourceWithCount[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  showCounts?: boolean;
}> = memo(
  ({
    sources,
    selectedSourceId,
    onSourceSelect,
    isLoading = false,
    disabled = false,
    compact = false,
    showCounts = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Global search hook
    const {
      searchResults,
      isSearching: _isSearching,
      setSearchQuery: setGlobalSearchQuery,
      clearSearch: clearGlobalSearch,
      searchError: _searchError,
    } = useSourceSearch({ debounceMs: 300, minQueryLength: 2 });

    // Combine loaded sources and search results
    const allSources = useMemo(() => {
      const sourceMap = new Map(sources.map(s => [s.id, s]));

      // Add search results (avoid duplicates)
      searchResults.forEach((result: NewsletterSourceType) => {
        if (!sourceMap.has(result.id)) {
          sourceMap.set(result.id, { ...result, count: undefined });
        }
      });

      return Array.from(sourceMap.values());
    }, [sources, searchResults]);

    // Filter and sort sources based on search query
    const filteredSources = useMemo(
      () => {
        const filtered = searchQuery.trim()
          ? allSources.filter(source =>
            source.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
          )
          : allSources;
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      },
      [allSources, searchQuery]
    );

    const selectedSource = selectedSourceId
      ? allSources.find((s) => s.id === selectedSourceId)
      : null;

    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) {
        setIsOpen(!isOpen);
      }
    };

    const handleSelect = (sourceId: string | null, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSourceSelect(sourceId);
      setIsOpen(false);
      setSearchQuery(''); // Clear search when selection is made
      setGlobalSearchQuery(''); // Clear global search
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      setGlobalSearchQuery(query);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
        setGlobalSearchQuery('');
        clearGlobalSearch();
      }
    };

    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isLoading}
          className={`
            flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg
            ${compact ? "px-2 py-1 text-xs min-w-[120px]" : "px-3 py-1.5 text-sm min-w-[140px]"}
            text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-2
            focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || isLoading ? "bg-gray-50 dark:bg-neutral-900" : "hover:bg-gray-50 dark:hover:bg-neutral-800/60"}
          `}
          aria-label="Filter by newsletter source"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isLoading ? (
              <div
                className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${compact ? "h-3 w-3" : "h-4 w-4"}`}
              />
            ) : (
              <Building2
                className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400 flex-shrink-0`}
              />
            )}
            <span className="truncate">
              {selectedSource ? selectedSource.name : "All Sources"}
            </span>
            {selectedSource &&
              showCounts &&
              selectedSource.count !== undefined &&
              selectedSource.count > 0 && (
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {selectedSource.count}
                </span>
              )}
          </div>
          <ChevronDown
            className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "transform rotate-180" : ""
              }`}
          />
        </button>

        {isOpen && (
          <>
            {/* Backdrop to close dropdown when clicking outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-neutral-900 rounded-md shadow-lg z-50 border border-gray-200 dark:border-neutral-800 max-h-80 overflow-hidden flex flex-col">
              {/* Search input */}
              <div className="p-3 border-b border-gray-200 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    placeholder={_isSearching ? "Searching all sources..." : "Search sources..."}
                    className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setGlobalSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      ×
                    </button>
                  )}
                  {_isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full border-t-transparent"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search results indicator */}
              {searchQuery.trim().length >= 2 && (
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Search className="h-3 w-3" />
                    <span>Searching all {searchResults.length} sources...</span>
                  </div>
                </div>
              )}

              {/* Scrollable source list */}
              <div className="flex-1 overflow-y-auto">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={(e) => handleSelect(null, e)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedSourceId
                      ? "bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-medium"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                      }`}
                  >
                    <span>All Sources</span>
                  </button>
                  {filteredSources.length === 0 && searchQuery.trim() && (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 text-center">
                      No sources found for "{searchQuery.trim()}"
                    </div>
                  )}
                  {filteredSources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={(e) => handleSelect(source.id, e)}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${selectedSourceId === source.id
                        ? "bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-medium"
                        : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                        }`}
                    >
                      <span className="truncate pr-2">{source.name}</span>
                      {showCounts &&
                        source.count !== undefined &&
                        source.count > 0 && (
                          <span className="bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {source.count}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

// Multi-Group Filter Dropdown Component (checkbox-style selection)
const MultiGroupFilterDropdown: FC<{
  groups: { id: string; name: string; count?: number }[];
  selectedGroupIds: string[];
  onGroupSelect: (groupIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  showCounts?: boolean;
}> = memo(
  ({
    groups,
    selectedGroupIds,
    onGroupSelect,
    isLoading = false,
    disabled = false,
    compact = false,
    showCounts = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) {
        setIsOpen(!isOpen);
      }
    };

    const toggleOne = (groupId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const next = selectedGroupIds.includes(groupId)
        ? selectedGroupIds.filter((id) => id !== groupId)
        : [...selectedGroupIds, groupId];
      onGroupSelect(next);
    };

    const clearAll = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onGroupSelect([]);
      setIsOpen(false);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
      }
    };

    // Filter and sort groups based on search query
    const filteredGroups = useMemo(
      () => {
        const filtered = searchQuery.trim()
          ? groups.filter(group =>
            group.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
          )
          : groups;
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      },
      [groups, searchQuery]
    );

    const label = (() => {
      if (selectedGroupIds.length === 0) return 'All Groups';
      if (selectedGroupIds.length === 1) {
        const g = groups.find((x) => x.id === selectedGroupIds[0]);
        return g?.name || '1 Group';
      }
      return `${selectedGroupIds.length} Groups`;
    })();

    const selectedUnreadTotal = useMemo(() => {
      if (!Array.isArray(groups) || groups.length === 0) return 0;
      const set = new Set(selectedGroupIds);
      return groups.reduce((sum, g) => sum + (set.has(g.id) ? (g.count || 0) : 0), 0);
    }, [groups, selectedGroupIds]);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isLoading}
          className={`
            flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg
            ${compact ? 'px-2 py-1 text-xs min-w-[120px]' : 'px-3 py-1.5 text-sm min-w-[140px]'}
            text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-2
            focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || isLoading ? 'bg-gray-50 dark:bg-neutral-900' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60'}
          `}
          aria-label="Filter by groups"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="truncate">{label}</span>
            {selectedGroupIds.length > 0 && (
              <span className="bg-white dark:bg-neutral-900 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-neutral-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                {selectedUnreadTotal}
              </span>
            )}
          </div>
          <ChevronDown
            className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-neutral-900 rounded-md shadow-lg z-50 border border-gray-200 dark:border-neutral-800 max-h-80 overflow-hidden flex flex-col">
              {/* Search input */}
              <div className="p-3 border-b border-gray-200 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Search groups..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable group list */}
              <div className="flex-1 overflow-y-auto">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={clearAll}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                  >
                    Clear All Groups
                  </button>
                  {filteredGroups.map((group) => {
                    const checked = selectedGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={(e) => toggleOne(group.id, e)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${checked ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-900 dark:text-slate-100 font-medium' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60'}`}
                      >
                        <span className="truncate pr-2">{group.name}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          {showCounts && group.count !== undefined && group.count > 0 && (
                            <span className="bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-slate-200 text-xs font-medium px-1.5 py-0.5 rounded-full">
                              {group.count}
                            </span>
                          )}
                          <span className={`inline-block w-4 text-blue-600 ${checked ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

// Group Filter Dropdown Component
const GroupFilterDropdown: FC<{
  groups: { id: string; name: string; count?: number }[];
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  showCounts?: boolean;
}> = memo(
  ({
    groups,
    selectedGroupId,
    onGroupSelect,
    isLoading = false,
    disabled = false,
    compact = false,
    showCounts = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedGroup = selectedGroupId
      ? groups.find((g) => g.id === selectedGroupId)
      : null;
    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) {
        setIsOpen(!isOpen);
      }
    };
    const handleSelect = (groupId: string | null, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onGroupSelect(groupId);
      setIsOpen(false);
    };
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isLoading}
          className={`
            flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg
            ${compact ? "px-2 py-1 text-xs min-w-[120px]" : "px-3 py-1.5 text-sm min-w-[140px]"}
            text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-2
            focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || isLoading ? "bg-gray-50 dark:bg-neutral-900" : "hover:bg-gray-50 dark:hover:bg-neutral-800/60"}
          `}
          aria-label="Filter by group"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="truncate">
              {selectedGroup ? selectedGroup.name : "All Groups"}
            </span>
            {selectedGroup &&
              showCounts &&
              selectedGroup.count !== undefined &&
              selectedGroup.count > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {selectedGroup.count}
                </span>
              )}
          </div>
          <ChevronDown
            className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "transform rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-neutral-900 rounded-md shadow-lg z-50 border border-gray-200 dark:border-neutral-800 max-h-60 overflow-y-auto">
              <div className="py-1">
                <button
                  type="button"
                  onClick={(e) => handleSelect(null, e)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedGroupId
                    ? "bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-medium"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                    }`}
                >
                  <span>All Groups</span>
                </button>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={(e) => handleSelect(group.id, e)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${selectedGroupId === group.id
                      ? "bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-medium"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                      }`}
                  >
                    <span className="truncate pr-2">{group.name}</span>
                    {showCounts && group.count !== undefined && group.count > 0 && (
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {group.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

// Filter Button Component
const FilterButton: FC<{
  option: (typeof FILTER_OPTIONS)[0];
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  count?: number;
  showCount?: boolean;
}> = memo(
  ({
    option,
    isActive,
    onClick,
    disabled = false,
    compact = false,
    count,
    showCount = false,
  }) => {
    const Icon = option.icon;

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
        ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}
        rounded-full transition-all duration-200 font-medium
        flex items-center gap-1.5 min-w-0 relative
        ${isActive
            ? "bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus:bg-primary-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100"
          }
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
        ${disabled ? "" : "active:scale-95"}
      `}
        aria-pressed={isActive}
        aria-label={`Filter by ${option.label.toLowerCase()} newsletters`}
      >
        <Icon
          className={compact ? "h-3 w-3" : "h-4 w-4"}
          aria-hidden="true"
        />
        <span className="truncate">{option.label}</span>
        {showCount && count !== undefined && count > 0 && (
          <span
            className={`
            ${compact ? "text-xs px-1" : "text-xs px-1.5"}
            py-0.5 rounded-full font-normal
            ${isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}
          `}
            aria-label={`${count} newsletters`}
          >
            {count > 999 ? "999+" : count}
          </span>
        )}
      </button>
    );
  },
);

// Utility to check if a filter is selected (not null, undefined, or empty string)
function isFilterSelected(val: string | null | undefined): boolean {
  return val !== null && val !== undefined && val !== '';
}

export const InboxFilters: FC<InboxFiltersProps> = memo(
  ({
    filter,
    sourceFilter,
    groupFilter = null,
    groupFilters = [],
    timeRange,
    sortBy,
    sortOrder,
    newsletterSources,
    newsletterGroups = [],
    onFilterChange,
    onSourceFilterChange,
    onGroupFilterChange = () => { },
    onGroupFiltersChange = () => { },
    onTimeRangeChange,
    onSortByChange,
    onSortOrderChange,
    isLoading = false,
    isLoadingSources = false,
    isLoadingGroups = false,
    disabled = false,
    className = "",
    compact = false,
    showTimeFilter = true,
    showSourceFilter = true,
    showGroupFilter = true,
    showFilterCounts = false,
    onSelectClick,
  }) => {
    // Only one of source or group can be selected at a time
    // If groupFilter is set, sourceFilter is ignored and vice versa
    // Prefer multi-select props if provided; fall back to legacy single-select
    const hasMulti = Array.isArray(groupFilters);
    const isAnyGroupSelected = hasMulti ? groupFilters.length > 0 : isFilterSelected(groupFilter);

    return (
      <div className={`w-full ${className}`}>
        {/* Mobile: Multi-row layout */}
        <div className="sm:hidden">
          {/* Row 1: Status filters (All, Unread, Liked, Archived) */}
          <div className="flex flex-wrap items-center gap-1 justify-center">
            {FILTER_OPTIONS.map((option) => {
              return (
                <FilterButton
                  key={option.value}
                  option={option}
                  isActive={filter === option.value}
                  onClick={() => onFilterChange(option.value)}
                  disabled={disabled || isLoading}
                  compact={compact}
                  showCount={showFilterCounts}
                />
              );
            })}
          </div>
          {/* Row 2: Time, Sort, Source, Group, Select (mobile only) */}
          <div className="flex flex-wrap items-center gap-2 justify-center mt-2">
            {showTimeFilter && (
              <TimeFilterDropdown
                selectedRange={timeRange}
                onChange={onTimeRangeChange}
                disabled={disabled || isLoading}
                compact={compact}
              />
            )}
            <SortDropdown
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortByChange={onSortByChange}
              onSortOrderChange={onSortOrderChange}
              disabled={disabled || isLoading}
              compact={compact}
            />
            {showSourceFilter && (
              <SourceFilterDropdown
                sources={newsletterSources}
                selectedSourceId={isAnyGroupSelected ? null : sourceFilter}
                onSourceSelect={onSourceFilterChange}
                isLoading={isLoadingSources}
                disabled={disabled || isLoading || isAnyGroupSelected}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && hasMulti && (
              <MultiGroupFilterDropdown
                groups={newsletterGroups}
                selectedGroupIds={groupFilters}
                onGroupSelect={onGroupFiltersChange}
                isLoading={isLoadingGroups}
                disabled={disabled || isLoading || isFilterSelected(sourceFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && !hasMulti && (
              <GroupFilterDropdown
                groups={newsletterGroups}
                selectedGroupId={groupFilter}
                onGroupSelect={onGroupFilterChange}
                isLoading={isLoadingGroups}
                disabled={disabled || isLoading || isFilterSelected(sourceFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              onClick={onSelectClick}
            >
              Select
            </button>
          </div>
        </div>

        {/* Desktop: Single row layout with all filters */}
        <div className="hidden sm:flex flex-row items-center justify-between w-full">
          {/* Left side: Status filters + Time filter + Sort */}
          <div className="flex items-center gap-x-1">
            {/* Time filter - at the left, before status filters */}
            {showTimeFilter && (
              <TimeFilterDropdown
                selectedRange={timeRange}
                onChange={onTimeRangeChange}
                disabled={disabled || isLoading}
                compact={compact}
              />
            )}
            {/* Sort dropdown */}
            <SortDropdown
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortByChange={onSortByChange}
              onSortOrderChange={onSortOrderChange}
              disabled={disabled || isLoading}
              compact={compact}
            />
            {/* Status filters */}
            {FILTER_OPTIONS.map((option) => (
              <FilterButton
                key={option.value}
                option={option}
                isActive={filter === option.value}
                onClick={() => onFilterChange(option.value)}
                disabled={disabled || isLoading}
                compact={compact}
                showCount={showFilterCounts}
              />
            ))}
          </div>

          {/* Right side: Source filter + Group filter + Select button */}
          <div className="flex items-center gap-x-1">
            {showSourceFilter && (
              <SourceFilterDropdown
                sources={newsletterSources}
                selectedSourceId={isAnyGroupSelected ? null : sourceFilter}
                onSourceSelect={onSourceFilterChange}
                isLoading={isLoadingSources}
                disabled={disabled || isLoading || isAnyGroupSelected}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && hasMulti && (
              <MultiGroupFilterDropdown
                groups={newsletterGroups}
                selectedGroupIds={groupFilters}
                onGroupSelect={onGroupFiltersChange}
                isLoading={isLoadingGroups}
                disabled={disabled || isLoading || isFilterSelected(sourceFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && !hasMulti && (
              <GroupFilterDropdown
                groups={newsletterGroups}
                selectedGroupId={groupFilter}
                onGroupSelect={onGroupFilterChange}
                isLoading={isLoadingGroups}
                disabled={disabled || isLoading || isFilterSelected(sourceFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              onClick={onSelectClick}
            >
              Select
            </button>
          </div>
        </div>
      </div>
    );
  },
);

InboxFilters.displayName = "InboxFilters";
