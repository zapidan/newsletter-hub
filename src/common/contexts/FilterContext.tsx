import { useInboxUrlParams } from '@common/hooks/useUrlParams';
import type { NewsletterFilter } from '@common/types/cache';
import type { TimeRange } from '@web/components/TimeFilter';
import React, { useCallback, useContext, useEffect, useMemo } from 'react'; // Removed createContext

export interface FilterState {
  filter: 'all' | 'unread' | 'liked' | 'archived';
  sourceFilter: string | null;
  timeRange: TimeRange;
  tagIds: string[];
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
}

export interface FilterContextType extends FilterState, FilterActions {
  newsletterFilter: NewsletterFilter;
  hasActiveFilters: boolean;
  isFilterActive: (filterName: keyof FilterState) => boolean;
}

// Removed: const FilterContext = createContext<FilterContextType | undefined>(undefined);
import { FilterContext } from './FilterContextValue'; // Added import

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

  // Extract filter state from URL params
  const filterState: FilterState = useMemo(
    () => ({
      filter: (params.filter as FilterState['filter']) || 'all',
      sourceFilter: (params.source as string) || null,
      timeRange: (params.time as TimeRange) || 'all',
      tagIds: (params.tags as string[]) || [],
    }),
    [params]
  );

  // Generate newsletter filter object
  const newsletterFilter = useMemo(() => {
    const filters: NewsletterFilter = {};

    // Handle status filter
    switch (filterState.filter) {
      case 'unread':
        filters.isRead = false;
        filters.isArchived = false;
        break;
      case 'liked':
        filters.isLiked = true;
        filters.isArchived = false;
        break;
      case 'archived':
        filters.isArchived = true;
        break;
      case 'all':
      default:
        filters.isArchived = false;
        break;
    }

    // Handle source filter
    if (filterState.sourceFilter) {
      filters.sourceIds = [filterState.sourceFilter];
    }

    // Handle tag filter (only include in server filter if not using local filtering)
    if (!useLocalTagFiltering && filterState.tagIds.length > 0) {
      filters.tagIds = filterState.tagIds;
    }

    // Handle time range filter
    if (filterState.timeRange && filterState.timeRange !== 'all') {
      // Create a date at the current time in UTC
      const now = new Date();
      const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
      let dateFrom: Date;

      switch (filterState.timeRange) {
        case 'day':
          dateFrom = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));
          break;
        case 'week':
          dateFrom = new Date(nowUTC);
          dateFrom.setUTCDate(nowUTC.getUTCDate() - 7);
          break;
        case 'month':
          dateFrom = new Date(nowUTC);
          dateFrom.setUTCMonth(nowUTC.getUTCMonth() - 1);
          break;
        case '2days':
          dateFrom = new Date(nowUTC);
          dateFrom.setUTCDate(nowUTC.getUTCDate() - 2);
          break;
        default:
          dateFrom = new Date(nowUTC);
          dateFrom.setUTCDate(nowUTC.getUTCDate() - 7);
      }

      filters.dateFrom = dateFrom.toISOString();
    }

    return filters;
  }, [filterState, useLocalTagFiltering]);

  // Check if any filters are active (non-default)
  const hasActiveFilters = useMemo(() => {
    return (
      filterState.filter !== 'all' ||
      filterState.sourceFilter !== null ||
      filterState.timeRange !== 'all' ||
      filterState.tagIds.length > 0
    );
  }, [filterState]);

  // Check if a specific filter is active
  const isFilterActive = useCallback(
    (filterName: keyof FilterState): boolean => {
      switch (filterName) {
        case 'filter':
          return filterState.filter !== 'all';
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
    [filterState]
  );

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

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filterState, newsletterFilter);
    }
  }, [filterState, newsletterFilter, onFilterChange]);

  const contextValue: FilterContextType = {
    // State
    ...filterState,
    newsletterFilter,
    hasActiveFilters,

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

export default FilterContext;
