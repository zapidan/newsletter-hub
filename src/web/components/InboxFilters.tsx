import type { NewsletterSource } from "@common/types";
import { Archive, Building2, ChevronDown, Clock, Filter } from "lucide-react";
import { FC, memo, useState } from "react";

export type FilterType = "all" | "unread" | "liked" | "archived";
export type TimeRange = "all" | "day" | "2days" | "week" | "month";

export interface NewsletterSourceWithCount extends NewsletterSource {
  count?: number;
}

interface InboxFiltersProps {
  filter: FilterType;
  sourceFilter: string | null;
  groupFilter?: string | null;
  timeRange: TimeRange;
  newsletterSources: NewsletterSourceWithCount[];
  newsletterGroups?: { id: string; name: string; count?: number }[];
  onFilterChange: (filter: FilterType) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onGroupFilterChange?: (groupId: string | null) => void;
  onTimeRangeChange: (range: TimeRange) => void;
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

const FILTER_OPTIONS = [
  { value: "all" as const, label: "All", icon: Filter },
  { value: "unread" as const, label: "Unread", icon: Filter },
  { value: "liked" as const, label: "Liked", icon: Filter },
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
    <div className="relative">
      <select
        value={selectedRange}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        disabled={disabled}
        className={`
          appearance-none bg-white border border-gray-200 rounded-lg
          ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}
          text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2
          focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${disabled ? "bg-gray-50" : "hover:bg-gray-50"}
        `}
        aria-label="Filter by time range"
      >
        {TIME_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <Clock className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400`} />
      </div>
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

    const selectedSource = selectedSourceId
      ? sources.find((s) => s.id === selectedSourceId)
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
    };

    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isLoading}
          className={`
            flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg
            ${compact ? "px-2 py-1 text-xs min-w-[120px]" : "px-3 py-1.5 text-sm min-w-[140px]"}
            text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2
            focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || isLoading ? "bg-gray-50" : "hover:bg-gray-50"}
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
                <span className="bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
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
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200 max-h-60 overflow-y-auto">
              <div className="py-1">
                <button
                  type="button"
                  onClick={(e) => handleSelect(null, e)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedSourceId
                    ? "bg-blue-50 text-blue-800 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  <span>All Sources</span>
                </button>
                {sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={(e) => handleSelect(source.id, e)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${selectedSourceId === source.id
                      ? "bg-blue-50 text-blue-800 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    <span className="truncate pr-2">{source.name}</span>
                    {showCounts &&
                      source.count !== undefined &&
                      source.count > 0 && (
                        <span className="bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {source.count}
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
            flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg
            ${compact ? "px-2 py-1 text-xs min-w-[120px]" : "px-3 py-1.5 text-sm min-w-[140px]"}
            text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2
            focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || isLoading ? "bg-gray-50" : "hover:bg-gray-50"}
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
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200 max-h-60 overflow-y-auto">
              <div className="py-1">
                <button
                  type="button"
                  onClick={(e) => handleSelect(null, e)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedGroupId
                    ? "bg-blue-50 text-blue-800 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
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
                      ? "bg-blue-50 text-blue-800 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    <span className="truncate pr-2">{group.name}</span>
                    {showCounts && group.count !== undefined && group.count > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
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
        {option.value === "archived" && (
          <Icon
            className={compact ? "h-3 w-3" : "h-4 w-4"}
            aria-hidden="true"
          />
        )}
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
    timeRange,
    newsletterSources,
    newsletterGroups = [],
    onFilterChange,
    onSourceFilterChange,
    onGroupFilterChange = () => { },
    onTimeRangeChange,
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
    return (
      <div className={`w-full ${className}`}>
        {/* Mobile: Multi-row layout */}
        <div className="sm:hidden">
          {/* Row 1: Status filters (All, Unread, Liked, Archived) */}
          <div className="flex flex-wrap items-center gap-1 justify-center">
            {FILTER_OPTIONS.filter(opt => opt.value !== 'archived').map((option) => (
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
            {/* Archived at the end of row 1 on mobile */}
            <FilterButton
              key="archived"
              option={FILTER_OPTIONS.find(opt => opt.value === 'archived')!}
              isActive={filter === 'archived'}
              onClick={() => onFilterChange('archived')}
              disabled={disabled || isLoading}
              compact={compact}
              showCount={showFilterCounts}
            />
          </div>
          {/* Row 2: Time, Source, Group, Select (mobile only) */}
          <div className="flex flex-wrap items-center gap-2 justify-center mt-2">
            {showTimeFilter && (
              <TimeFilterDropdown
                selectedRange={timeRange}
                onChange={onTimeRangeChange}
                disabled={disabled || isLoading}
                compact={compact}
              />
            )}
            {showSourceFilter && (
              <SourceFilterDropdown
                sources={newsletterSources}
                selectedSourceId={isFilterSelected(groupFilter) ? null : sourceFilter}
                onSourceSelect={onSourceFilterChange}
                isLoading={isLoadingSources}
                disabled={disabled || isLoading || isFilterSelected(groupFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && (
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
        <div className="hidden sm:flex flex-row items-center gap-x-3 w-full justify-between">
          {/* Left side: Status filters + Time filter */}
          <div className="flex items-center gap-x-3">
            {/* Time filter - at the left, before status filters */}
            {showTimeFilter && (
              <TimeFilterDropdown
                selectedRange={timeRange}
                onChange={onTimeRangeChange}
                disabled={disabled || isLoading}
                compact={compact}
              />
            )}
            {/* Status filters */}
            {FILTER_OPTIONS.filter(opt => opt.value !== 'archived').map((option) => (
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
            {/* Archived filter */}
            <FilterButton
              key="archived"
              option={FILTER_OPTIONS.find(opt => opt.value === 'archived')!}
              isActive={filter === 'archived'}
              onClick={() => onFilterChange('archived')}
              disabled={disabled || isLoading}
              compact={compact}
              showCount={showFilterCounts}
            />
          </div>

          {/* Right side: Source filter + Group filter + Select button */}
          <div className="flex items-center gap-x-3">
            {showSourceFilter && (
              <SourceFilterDropdown
                sources={newsletterSources}
                selectedSourceId={isFilterSelected(groupFilter) ? null : sourceFilter}
                onSourceSelect={onSourceFilterChange}
                isLoading={isLoadingSources}
                disabled={disabled || isLoading || isFilterSelected(groupFilter)}
                compact={compact}
                showCounts={showFilterCounts}
              />
            )}
            {showGroupFilter && (
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
