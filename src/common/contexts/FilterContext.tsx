import { useInboxUrlParams } from '@common/hooks/useUrlParams';
import type { NewsletterFilter } from '@common/types/cache';
import type { TimeRange } from '@web/components/TimeFilter';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { InboxFilterType } from '../hooks/useInboxFilters'; // Import the shared type

export interface FilterState {
  filter: InboxFilterType;
  sourceFilter: string | null;
  timeRange: TimeRange;
  tagIds: string[];
}

export interface NavigationHealth {
  isHealthy: boolean;
  failureCount: number;
  lastFailureTime: number | null;
  avgResponseTime: number;
  shouldUseFallback: boolean;
}

export interface FilterActions {
  setFilter: (filter: FilterState['filter']) => void;
  setSourceFilter: (sourceId: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setTagIds: (tagIds: string[]) => void;
  toggleTag: (tagId: string) => void;
  addTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  clearTags: () => void;
  resetFilters: () => void;
  updateFilters: (updates: Partial<FilterState>) => void;
  reportNavigationHealth: (success: boolean, responseTime?: number) => void;
}

export interface FilterContextType extends FilterState, FilterActions {
  newsletterFilter: NewsletterFilter;
  hasActiveFilters: boolean;
  isFilterActive: (filterName: keyof FilterState) => boolean;
  navigationHealth: NavigationHealth;
  effectiveUseLocalTagFiltering: boolean;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

interface FilterProviderProps {
  children: React.ReactNode;
  onFilterChange?: (filters: FilterState, newsletterFilter: NewsletterFilter) => void;
  debounceTagsMs?: number;
  useLocalTagFiltering?: boolean;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({
  children,
  onFilterChange,
  useLocalTagFiltering = false,
}) => {
  const { params, updateParams, resetParams } = useInboxUrlParams();

  // Navigation health monitoring state
  const [navigationHealth, setNavigationHealth] = useState<NavigationHealth>({
    isHealthy: true,
    failureCount: 0,
    lastFailureTime: null,
    avgResponseTime: 0,
    shouldUseFallback: false,
  });

  // Track response times for health monitoring
  const responseTimesRef = useRef<number[]>([]);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track last filter state to prevent unnecessary updates
  const lastNewsletterFilterRef = useRef<string>('');

  // Extract filter state from URL params with explicit defaults
  const validFilters: InboxFilterType[] = ['unread', 'read', 'liked', 'archived'];
  const filterValue = params.filter as FilterState['filter'];
  const filter: FilterState['filter'] = validFilters.includes(filterValue) ? filterValue : 'unread';

  const filterState: FilterState = useMemo(
    () => ({
      filter,
      sourceFilter: (params.source as string) || null,
      timeRange: (params.time as TimeRange) || 'all',
      tagIds: (params.tags as string[]) || [],
    }),
    [filter, params.source, params.time, params.tags]
  );

  // Generate newsletter filter object with stable memoization
  const newsletterFilter = useMemo(() => {
    const filters: NewsletterFilter = {};

    // Handle status filter - 'unread' is the default inbox view
    switch (filterState.filter) {
      case 'unread':
      default: // 'unread' is the default - show unread, non-archived newsletters
        filters.isRead = false;
        filters.isArchived = false;
        break;
      case 'read':
        filters.isRead = true;
        filters.isArchived = false;
        break;
      case 'liked':
        filters.isLiked = true;
        // Show all liked newsletters, including archived ones
        break;
      case 'archived':
        filters.isArchived = true;
        // No isRead filter for archived, show all archived
        break;
    }

    // Handle source filter
    if (filterState.sourceFilter) {
      filters.sourceIds = [filterState.sourceFilter];
    }

    // Handle tag filter (only include in server filter if not using local filtering and navigation is healthy)
    if (!useLocalTagFiltering && !navigationHealth.shouldUseFallback && filterState.tagIds.length > 0) {      // For navigation stability, limit complex server-side tag queries
      if (filterState.tagIds.length > 4 && navigationHealth.failureCount > 1) {
        // Fall back to local filtering for complex queries
      } else {
        filters.tagIds = [...filterState.tagIds]; // Create a new array to ensure stability
      }
    }

    // Handle time range filter
    if (filterState.timeRange && filterState.timeRange !== 'all') {
      // Use local time for date calculations so 'Today' reflects the user's local day
      const now = new Date();
      let dateFrom: Date;

      switch (filterState.timeRange) {
        case 'day': {
          // Start of the local day (local midnight)
          const startOfLocalDay = new Date(now);
          startOfLocalDay.setHours(0, 0, 0, 0);
          dateFrom = startOfLocalDay;
          break;
        }
        case 'week': {
          // Start of the current week (Monday 00:00 local time)
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0, 0, 0, 0);
          const day = startOfWeek.getDay(); // 0=Sun,1=Mon,...6=Sat
          const diffSinceMonday = (day + 6) % 7; // days since Monday
          startOfWeek.setDate(startOfWeek.getDate() - diffSinceMonday);
          dateFrom = startOfWeek;
          break;
        }
        case 'month': {
          // Start of the current month at local midnight
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          startOfMonth.setHours(0, 0, 0, 0);
          dateFrom = startOfMonth;
          break;
        }
        case '2days': {
          // Rolling 2 days (48 hours) based on local time
          const twoDaysAgo = new Date(now);
          twoDaysAgo.setDate(now.getDate() - 2);
          dateFrom = twoDaysAgo;
          break;
        }
        case 'last7': {
          // Rolling 7 days based on local time
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          dateFrom = sevenDaysAgo;
          break;
        }
        case 'last30': {
          // Rolling 30 days based on local time
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          dateFrom = thirtyDaysAgo;
          break;
        }
        default: {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          dateFrom = sevenDaysAgo;
        }
      }

      filters.dateFrom = dateFrom.toISOString();
    }

    return filters;
  }, [
    filterState.filter,
    filterState.sourceFilter,
    filterState.timeRange,
    filterState.tagIds,
    useLocalTagFiltering,
    navigationHealth.failureCount,
    navigationHealth.shouldUseFallback,
  ]);

  // Check if any filters are active (non-default)
  const hasActiveFilters = useMemo(() => {
    // Compare against default values - any deviation means filters are active
    return (
      filterState.filter !== 'unread' ||
      filterState.sourceFilter !== null ||
      filterState.timeRange !== 'all' ||
      filterState.tagIds.length > 0
    );
  }, [filterState.filter, filterState.sourceFilter, filterState.timeRange, filterState.tagIds]);

  // Check if a specific filter is active
  const isFilterActive = useCallback(
    (filterName: keyof FilterState): boolean => {
      switch (filterName) {
        case 'filter':
          // Active if different from default filter
          return filterState.filter !== 'unread';
        case 'sourceFilter':
          return filterState.sourceFilter !== null;
        case 'timeRange':
          return filterState.timeRange !== 'all';
        case 'tagIds':
          return filterState.tagIds.length > 0;
        default:
          return false;
      }
    },
    [filterState.filter, filterState.sourceFilter, filterState.timeRange, filterState.tagIds]
  );

  // Only trigger onFilterChange when the newsletterFilter has actually changed
  useEffect(() => {
    if (onFilterChange) {
      const currentFilterString = JSON.stringify(newsletterFilter);
      if (lastNewsletterFilterRef.current !== currentFilterString) {
        lastNewsletterFilterRef.current = currentFilterString;
        onFilterChange(filterState, newsletterFilter);
      }
    }
  }, [newsletterFilter, filterState, onFilterChange]);

  // Action creators
  const setFilter = useCallback(
    (filter: FilterState['filter']) => {
      updateParams({ filter });
    },
    [updateParams]
  );

  const setSourceFilter = useCallback(
    (sourceId: string | null) => {
      updateParams({ source: sourceId });
    },
    [updateParams]
  );

  const setTimeRange = useCallback(
    (range: TimeRange) => {
      updateParams({ time: range });
    },
    [updateParams]
  );

  // Navigation health reporting
  const reportNavigationHealth = useCallback(
    (success: boolean, responseTime?: number) => {
      setNavigationHealth((prev) => {
        const now = Date.now();
        let newFailureCount = prev.failureCount;
        let newLastFailureTime = prev.lastFailureTime;
        let newAvgResponseTime = prev.avgResponseTime;

        if (!success) {
          newFailureCount = prev.failureCount + 1;
          newLastFailureTime = now;
        } else if (responseTime) {
          // Update response time tracking
          responseTimesRef.current.push(responseTime);
          if (responseTimesRef.current.length > 10) {
            responseTimesRef.current = responseTimesRef.current.slice(-10);
          }
          newAvgResponseTime =
            responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;

          // Reset failure count on successful operation
          if (newFailureCount > 0) {
            newFailureCount = Math.max(0, newFailureCount - 1);
          }
        }

        // Determine if we should use fallback mode
        const shouldUseFallback =
          newFailureCount >= 3 ||
          (newAvgResponseTime > 5000 && filterState.tagIds.length > 2) ||
          (newLastFailureTime && now - newLastFailureTime < 30000 && newFailureCount > 1);

        const isHealthy = newFailureCount < 2 && newAvgResponseTime < 3000;

        return {
          isHealthy,
          failureCount: newFailureCount,
          lastFailureTime: newLastFailureTime,
          avgResponseTime: newAvgResponseTime,
          shouldUseFallback,
        };
      });
    },
    [filterState.tagIds.length]
  );

  // Health recovery mechanism
  useEffect(() => {
    if (!navigationHealth.isHealthy) {
      // Clear health check interval if exists
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }

      // Set up recovery check every 30 seconds
      healthCheckIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLastFailure = navigationHealth.lastFailureTime
          ? now - navigationHealth.lastFailureTime
          : Infinity;

        // Gradually recover after 1 minute of no failures
        if (timeSinceLastFailure > 60000) {
          setNavigationHealth((prev) => ({
            ...prev,
            failureCount: Math.max(0, prev.failureCount - 1),
            shouldUseFallback: prev.failureCount > 1,
            isHealthy: prev.failureCount <= 1,
          }));
        }
      }, 30000);
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [navigationHealth.isHealthy, navigationHealth.lastFailureTime, navigationHealth.failureCount]);

  const setTagIds = useCallback(
    (tagIds: string[]) => {
      updateParams({ tags: tagIds });
    },
    [updateParams]
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      const currentTags = filterState.tagIds;
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter((id) => id !== tagId)
        : [...currentTags, tagId];
      setTagIds(newTags);
    },
    [filterState.tagIds, setTagIds]
  );

  const addTag = useCallback(
    (tagId: string) => {
      const currentTags = filterState.tagIds;
      if (!currentTags.includes(tagId)) {
        setTagIds([...currentTags, tagId]);
      }
    },
    [filterState.tagIds, setTagIds]
  );

  const removeTag = useCallback(
    (tagId: string) => {
      const currentTags = filterState.tagIds;
      setTagIds(currentTags.filter((id) => id !== tagId));
    },
    [filterState.tagIds, setTagIds]
  );

  const clearTags = useCallback(() => {
    setTagIds([]);
  }, [setTagIds]);

  const resetFilters = useCallback(() => {
    resetParams();
  }, [resetParams]);

  const updateFilters = useCallback(
    (updates: Partial<FilterState>) => {
      const urlUpdates: any = {};

      if ('filter' in updates) urlUpdates.filter = updates.filter;
      if ('sourceFilter' in updates) urlUpdates.source = updates.sourceFilter;
      if ('timeRange' in updates) urlUpdates.time = updates.timeRange;
      if ('tagIds' in updates) urlUpdates.tags = updates.tagIds;

      updateParams(urlUpdates);
    },
    [updateParams]
  );

  // Determine effective local tag filtering mode
  const effectiveUseLocalTagFiltering = useLocalTagFiltering || navigationHealth.shouldUseFallback;

  const contextValue: FilterContextType = {
    // State
    ...filterState,
    newsletterFilter,
    hasActiveFilters,
    navigationHealth,
    effectiveUseLocalTagFiltering,

    // Actions
    setFilter,
    setSourceFilter,
    setTimeRange,
    setTagIds,
    toggleTag,
    addTag,
    removeTag,
    clearTags,
    resetFilters,
    updateFilters,
    isFilterActive,
    reportNavigationHealth,
  };

  return <FilterContext.Provider value={contextValue}>{children}</FilterContext.Provider>;
};

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

// Convenience hooks for specific filter types
export const useStatusFilter = () => {
  const { filter, setFilter } = useFilters();
  return { filter, setFilter };
};

export const useSourceFilter = () => {
  const { sourceFilter, setSourceFilter } = useFilters();
  return { sourceFilter, setSourceFilter };
};

export const useTimeFilter = () => {
  const { timeRange, setTimeRange } = useFilters();
  return { timeRange, setTimeRange };
};

export const useTagFilter = () => {
  const { tagIds, setTagIds, toggleTag, addTag, removeTag, clearTags } = useFilters();
  return { tagIds, setTagIds, toggleTag, addTag, removeTag, clearTags };
};

export default FilterContext;
