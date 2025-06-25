import { FC, memo, useState, useEffect, useRef } from "react";
import { Archive, Filter as FilterIconLucide, Clock, Building2, ChevronDown, X } from "lucide-react";
import type { NewsletterSource } from "@common/types";
import { AnimatePresence, motion } from "framer-motion";

export type FilterType = "all" | "unread" | "liked" | "archived";
export type TimeRange = "all" | "day" | "2days" | "week" | "month";

export interface NewsletterSourceWithCount extends NewsletterSource {
  count?: number;
}

interface InboxFiltersProps {
  filter: FilterType;
  sourceFilter: string | null;
  timeRange: TimeRange;
  newsletterSources: NewsletterSourceWithCount[];
  onFilterChange: (filter: FilterType) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  isLoading?: boolean;
  isLoadingSources?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean; // compact is useful for desktop, mobile will have its own layout
  showTimeFilter?: boolean;
  showSourceFilter?: boolean;
  showFilterCounts?: boolean;
}

const TIME_RANGE_OPTIONS = [
  { value: "all" as const, label: "All Time" },
  { value: "day" as const, label: "Today" },
  { value: "2days" as const, label: "Last 2 Days" },
  { value: "week" as const, label: "This Week" },
  { value: "month" as const, label: "This Month" },
];

const FILTER_OPTIONS = [
  { value: "all" as const, label: "All", icon: FilterIconLucide },
  { value: "unread" as const, label: "Unread", icon: FilterIconLucide },
  { value: "liked" as const, label: "Liked", icon: FilterIconLucide },
  { value: "archived" as const, label: "Archived", icon: Archive },
];

// Time Filter Dropdown Component
const TimeFilterDropdown: FC<{
  selectedRange: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
}> = memo(({ selectedRange, onChange, disabled = false }) => {
  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={selectedRange}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        disabled={disabled}
        className={`
          w-full sm:w-auto appearance-none bg-white border border-gray-200 rounded-lg
          px-3 py-2 text-sm
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
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <Clock className="h-4 w-4 text-gray-400" />
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
  showCounts?: boolean;
}> = memo(
  ({
    sources,
    selectedSourceId,
    onSourceSelect,
    isLoading = false,
    disabled = false,
    showCounts = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedSource = selectedSourceId
      ? sources.find((s) => s.id === selectedSourceId)
      : null;

    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) setIsOpen(!isOpen);
    };

    const handleSelect = (sourceId: string | null, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSourceSelect(sourceId);
      setIsOpen(false);
    };

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div className="relative w-full sm:w-auto" ref={dropdownRef}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isLoading}
          className={`
            w-full sm:w-auto flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg
            px-3 py-2 text-sm min-w-[140px]
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
              <div className="animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="truncate">
              {selectedSource ? selectedSource.name : "All Sources"}
            </span>
            {selectedSource && showCounts && selectedSource.count !== undefined && selectedSource.count > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                {selectedSource.count}
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "transform rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-full sm:w-64 bg-white rounded-md shadow-lg z-50 border border-gray-200 max-h-60 overflow-y-auto"
            >
              <div className="py-1">
                <button
                  type="button"
                  onClick={(e) => handleSelect(null, e)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                    !selectedSourceId ? "bg-blue-50 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>All Sources</span>
                </button>
                {sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={(e) => handleSelect(source.id, e)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                      selectedSourceId === source.id ? "bg-blue-50 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="truncate pr-2">{source.name}</span>
                    {showCounts && source.count !== undefined && source.count > 0 && (
                      <span className="bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {source.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

// Filter Button Component
const FilterButton: FC<{
  option: (typeof FILTER_OPTIONS)[0];
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  count?: number;
  showCount?: boolean;
  isMobile?: boolean;
}> = memo(({ option, isActive, onClick, disabled = false, count, showCount = false, isMobile = false }) => {
  const Icon = option.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-sm rounded-full transition-all duration-200 font-medium
        flex items-center justify-center gap-1.5 relative
        ${isMobile ? 'w-full' : 'min-w-0'}
        ${isActive
          ? "bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus:bg-primary-700"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100"}
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed ${disabled ? "" : "active:scale-95"}
      `}
      aria-pressed={isActive}
      aria-label={`Filter by ${option.label.toLowerCase()} newsletters`}
    >
      {(option.value === "archived" || isMobile) && Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span className="truncate">{option.label}</span>
      {showCount && count !== undefined && count > 0 && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-normal
            ${isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}
          aria-label={`${count} newsletters`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
});

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
    // compact prop is less relevant now with mobile-first approach
    showTimeFilter = true,
    showSourceFilter = true,
    showFilterCounts = false,
  }) => {
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    const commonProps = { disabled: disabled || isLoading, showCounts: showFilterCounts };

    // Mobile filter panel
    const MobileFilterPanel = () => (
      <AnimatePresence>
        {isMobileFiltersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsMobileFiltersOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-2xl shadow-2xl z-50 md:hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button onClick={() => setIsMobileFiltersOpen(false)} className="p-1 text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                {showTimeFilter && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
                    <TimeFilterDropdown selectedRange={timeRange} onChange={onTimeRangeChange} {...commonProps} />
                  </div>
                )}
                {showSourceFilter && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <SourceFilterDropdown
                      sources={newsletterSources}
                      selectedSourceId={sourceFilter}
                      onSourceSelect={onSourceFilterChange}
                      isLoading={isLoadingSources}
                      {...commonProps}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_OPTIONS.map((option) => (
                      <FilterButton
                        key={option.value}
                        option={option}
                        isActive={filter === option.value}
                        onClick={() => onFilterChange(option.value)}
                        {...commonProps}
                        isMobile={true}
                      />
                    ))}
                  </div>
                </div>
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-gray-500 pt-2">
                    <div className="animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 h-4 w-4" />
                    <span className="text-sm">Updating...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );

    return (
      <div className={` ${className}`}>
        {/* Mobile Filter Trigger Button */}
        <div className="md:hidden mb-3">
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={disabled || isLoading}
          >
            <FilterIconLucide size={16} />
            <span>Filters</span>
            {/* Optional: Add a badge for active filters */}
            {(filter !== 'all' || sourceFilter || timeRange !== 'all') && (
                <span className="w-2 h-2 bg-primary-500 rounded-full ml-1"></span>
            )}
          </button>
        </div>
         <MobileFilterPanel />

        {/* Desktop Filters */}
        <div className="hidden md:flex flex-col sm:flex-row items-center gap-2 flex-wrap">
          {showTimeFilter && <TimeFilterDropdown selectedRange={timeRange} onChange={onTimeRangeChange} {...commonProps} />}

          <div className="flex items-center gap-2" role="group" aria-label="Status filters">
            {FILTER_OPTIONS.map((option) => (
              <FilterButton
                key={option.value}
                option={option}
                isActive={filter === option.value}
                onClick={() => onFilterChange(option.value)}
                {...commonProps}
              />
            ))}
          </div>

          {showSourceFilter && (
            <SourceFilterDropdown
              sources={newsletterSources}
              selectedSourceId={sourceFilter}
              onSourceSelect={onSourceFilterChange}
              isLoading={isLoadingSources}
              {...commonProps}
            />
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 h-4 w-4" />
              <span className="text-sm">Updating...</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

InboxFilters.displayName = "InboxFilters";
