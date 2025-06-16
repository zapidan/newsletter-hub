import React, { FC, memo } from "react";
import { Archive, Filter, Clock, Building2 } from "lucide-react";

export type FilterType = "all" | "unread" | "liked" | "archived";
export type TimeRange = "all" | "day" | "2days" | "week" | "month";

export interface NewsletterSource {
  id: string;
  name: string;
  count?: number;
}

interface InboxFiltersProps {
  filter: FilterType;
  sourceFilter: string | null;
  timeRange: TimeRange;
  newsletterSources: NewsletterSource[];
  onFilterChange: (filter: FilterType) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  isLoading?: boolean;
  isLoadingSources?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  showTimeFilter?: boolean;
  showSourceFilter?: boolean;
  showFilterCounts?: boolean;
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
  sources: NewsletterSource[];
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
    return (
      <div className="relative">
        <select
          value={selectedSourceId || ""}
          onChange={(e) => onSourceSelect(e.target.value || null)}
          disabled={disabled || isLoading}
          className={`
          appearance-none bg-white border border-gray-200 rounded-lg
          ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}
          text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2
          focus:ring-primary-500 focus:border-primary-500 transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${disabled || isLoading ? "bg-gray-50" : "hover:bg-gray-50"}
        `}
          aria-label="Filter by newsletter source"
        >
          <option value="">All Sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
              {showCounts && source.count !== undefined
                ? ` (${source.count})`
                : ""}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {isLoading ? (
            <div
              className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${compact ? "h-3 w-3" : "h-4 w-4"}`}
            />
          ) : (
            <Building2
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-gray-400`}
            />
          )}
        </div>
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
        ${
          isActive
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

export const InboxFilters: FC<InboxFiltersProps> = memo(
  ({
    filter,
    sourceFilter,
    timeRange,
    newsletterSources,
    onFilterChange,
    onSourceFilterChange,
    onTimeRangeChange,
    isLoading = false,
    isLoadingSources = false,
    disabled = false,
    className = "",
    compact = false,
    showTimeFilter = true,
    showSourceFilter = true,
    showFilterCounts = false,
  }) => {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Time Filter */}
          {showTimeFilter && (
            <TimeFilterDropdown
              selectedRange={timeRange}
              onChange={onTimeRangeChange}
              disabled={disabled || isLoading}
              compact={compact}
            />
          )}

          {/* Status Filter Buttons */}
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Status filters"
          >
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

          {/* Source Filter */}
          {showSourceFilter && (
            <SourceFilterDropdown
              sources={newsletterSources}
              selectedSourceId={sourceFilter}
              onSourceSelect={onSourceFilterChange}
              isLoading={isLoadingSources}
              disabled={disabled || isLoading}
              compact={compact}
              showCounts={showFilterCounts}
            />
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <div
                className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${compact ? "h-3 w-3" : "h-4 w-4"}`}
              />
              <span className={compact ? "text-xs" : "text-sm"}>
                Updating...
              </span>
            </div>
          )}
        </div>
      </div>
    );
  },
);

InboxFilters.displayName = "InboxFilters";
