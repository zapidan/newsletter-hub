import { useFilters } from '@common/contexts/FilterContext';
import { useTags } from '@common/hooks/useTags';
import type { NewsletterSource, Tag } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import type { TimeRange } from '@web/components/TimeFilter';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNewsletterSources } from './useNewsletterSources';

export type InboxFilterType = 'unread' | 'read' | 'liked' | 'archived';

export interface InboxFiltersState {
  filter: InboxFilterType;
  sourceFilter: string | null;
  timeRange: TimeRange;
  tagIds: string[];
  debouncedTagIds: string[];
  pendingTagUpdates: string[];
  visibleTags: Set<string>;
  allTags: Tag[];
}

export interface InboxFiltersActions {
  setFilter: (filter: InboxFilterType) => void;
  setSourceFilter: (sourceId: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setTagIds: (tagIds: string[]) => void;
  setPendingTagUpdates: (tagIds: string[]) => void;
  toggleTag: (tagId: string) => void;
  addTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  clearTags: () => void;
  resetFilters: () => void;
  updateTagDebounced: (tagIds: string[]) => void;
  handleTagClick: (tagId: string) => void;
}

export interface UseInboxFiltersOptions {
  debounceMs?: number;
  autoLoadTags?: boolean;
  preserveUrlOnActions?: boolean;
}

export interface UseInboxFiltersReturn extends InboxFiltersState, InboxFiltersActions {
  newsletterFilter: ReturnType<typeof useFilters>['newsletterFilter'];
  hasActiveFilters: boolean;
  isFilterActive: (filterName: keyof InboxFiltersState) => boolean;
  newsletterSources: NewsletterSource[];
  isLoadingTags: boolean;
  isLoadingSources: boolean;
  useLocalTagFiltering: boolean;
}

export const useInboxFilters = (options: UseInboxFiltersOptions = {}): UseInboxFiltersReturn => {
  const {
    debounceMs = 300,
    autoLoadTags = true,
    // preserveUrlOnActions = true, // Commented out unused parameter
  } = options;

  const log = useLogger();

  // Use filter context for core filter state
  const {
    filter,
    sourceFilter,
    timeRange,
    tagIds,
    newsletterFilter,
    useLocalTagFiltering,
    setFilter,
    setSourceFilter,
    setTimeRange,
    setTagIds,
    resetFilters,
  } = useFilters();

  // Local state for debounced tag updates
  const [pendingTagUpdates, setPendingTagUpdates] = useState<string[]>(tagIds);
  const [debouncedTagIds, setDebouncedTagIds] = useState<string[]>(tagIds);
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Refs for debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFilterStateRef = useRef<string>('');

  // Hooks - memoize getTags to prevent infinite loops
  const { getTags } = useTags();
  const memoizedGetTags = useCallback(getTags, [getTags]);
  const { newsletterSources = [], isLoadingSources } = useNewsletterSources({
    includeCount: true,
  });

  // Sync pendingTagUpdates with URL changes - only if they actually differ
  const prevTagIds = useRef<string>('');
  const prevPendingTagUpdates = useRef<string>('');

  useEffect(() => {
    const tagIdsStr = tagIds.join(',');
    const pendingStr = pendingTagUpdates.join(',');

    // Only update if tagIds changed and they're different from pending
    if (prevTagIds.current !== tagIdsStr && tagIdsStr !== pendingStr) {
      setPendingTagUpdates(tagIds);
    }
    prevTagIds.current = tagIdsStr;
    prevPendingTagUpdates.current = pendingStr;
  }, [tagIds, pendingTagUpdates]);

  // Debounce tag updates
  const isUpdatingTagsRef = useRef(false);
  const stableSetTagIds = useCallback(setTagIds, [setTagIds]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedTagIds([...pendingTagUpdates]);

      // Only update the actual filter state if there's a real change and we're not in a circular update
      const pendingStr = pendingTagUpdates.join(',');
      const currentStr = tagIds.join(',');
      const currentFilterState = JSON.stringify({ filter, sourceFilter, timeRange, tagIds });

      // Check if the filter state has actually changed
      if (
        pendingStr !== currentStr &&
        !isUpdatingTagsRef.current &&
        lastFilterStateRef.current !== currentFilterState
      ) {
        isUpdatingTagsRef.current = true;
        lastFilterStateRef.current = currentFilterState;
        stableSetTagIds(pendingTagUpdates);
        // Reset flag after a longer delay to prevent rapid updates
        setTimeout(() => {
          isUpdatingTagsRef.current = false;
        }, 500);
      }
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [pendingTagUpdates, debounceMs, tagIds, stableSetTagIds, filter, sourceFilter, timeRange]);

  // Load tags if enabled
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [hasLoadedTags, setHasLoadedTags] = useState(false);

  useEffect(() => {
    if (autoLoadTags && !hasLoadedTags && !isLoadingTags) {
      setIsLoadingTags(true);
      memoizedGetTags()
        .then((tags) => {
          if (tags && tags.length > 0) {
            setAllTags(tags);
          } else {
            log.warn('No tags loaded for inbox filters', {
              action: 'load_tags',
              metadata: {
                autoLoadTags,
                tagCount: 0,
                impact: 'filter_functionality_affected',
              },
            });
            setAllTags([]);
          }
          setHasLoadedTags(true);
        })
        .catch((error) => {
          log.error(
            'Failed to load tags for inbox filters',
            {
              action: 'load_tags',
              metadata: { autoLoadTags },
            },
            error
          );
          // Show error to user if needed
          setAllTags([]);
          setHasLoadedTags(true);
        })
        .finally(() => {
          setIsLoadingTags(false);
        });
    }
  }, [autoLoadTags, memoizedGetTags, log, hasLoadedTags, isLoadingTags]);

  // Update visible tags based on current tag selection
  useEffect(() => {
    const visible = new Set<string>();

    // Add currently selected tags
    debouncedTagIds.forEach((tagId) => visible.add(tagId));

    // Add tags from pending updates
    pendingTagUpdates.forEach((tagId) => visible.add(tagId));

    setVisibleTags(visible);
  }, [debouncedTagIds, pendingTagUpdates]);

  // Enhanced tag update function with debouncing
  const updateTagDebounced = useCallback(
    (newTagIds: string[]) => {
      // Don't update if the arrays are the same
      if (newTagIds.join(',') === pendingTagUpdates.join(',')) {
        return;
      }

      // Validate tag IDs exist in allTags if we have tags loaded
      if (allTags.length > 0) {
        const validTagIds = newTagIds.filter((tagId) => allTags.some((tag) => tag.id === tagId));
        if (validTagIds.length !== newTagIds.length) {
          log.warn('Some tag IDs not found in available tags', {
            action: 'validate_tags',
            metadata: {
              requested: newTagIds,
              valid: validTagIds,
              available: allTags.map((t) => t.id),
              invalidCount: newTagIds.length - validTagIds.length,
            },
          });
        }
        setPendingTagUpdates(validTagIds);
      } else {
        // If tags aren't loaded yet, accept all tag IDs
        setPendingTagUpdates(newTagIds);
      }
    },
    [allTags, log, pendingTagUpdates]
  );

  // Internal function for handling tag clicks with Tag object
  const handleTagClickInternal = useCallback(
    (tag: Tag, e?: React.MouseEvent) => {
      log.debug('Tag clicked in inbox filters', {
        action: 'tag_click',
        metadata: {
          tagId: tag.id,
          tagName: tag.name,
          eventType: e?.type,
          currentPendingTags: pendingTagUpdates,
          allTagsLoaded: allTags.length,
        },
      });

      e?.stopPropagation();
      const tagId = tag.id;
      const currentTags = pendingTagUpdates;
      const isCurrentlySelected = currentTags.includes(tagId);
      const newTags = isCurrentlySelected
        ? currentTags.filter((id) => id !== tagId)
        : [...currentTags, tagId];

      log.debug('Tag toggle result in inbox filters', {
        action: 'tag_toggle',
        metadata: {
          tagId: tag.id,
          wasSelected: isCurrentlySelected,
          operation: isCurrentlySelected ? 'REMOVE' : 'ADD',
          oldTags: currentTags,
          newTags: newTags,
          changeCount: Math.abs(newTags.length - currentTags.length),
        },
      });

      updateTagDebounced(newTags);
    },
    [pendingTagUpdates, updateTagDebounced, allTags.length, log]
  );

  // Handle tag click with toggle logic - matches interface signature
  const handleTagClick = useCallback(
    (tagId: string) => {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        handleTagClickInternal(tag);
      }
    },
    [allTags, handleTagClickInternal]
  );

  // Enhanced filter actions that work with debounced tags
  const enhancedToggleTag = useCallback(
    (tagId: string) => {
      handleTagClick(tagId);
    },
    [handleTagClick]
  );

  const enhancedAddTag = useCallback(
    (tagId: string) => {
      const currentTags = pendingTagUpdates;
      if (!currentTags.includes(tagId)) {
        updateTagDebounced([...currentTags, tagId]);
      }
    },
    [pendingTagUpdates, updateTagDebounced]
  );

  const enhancedRemoveTag = useCallback(
    (tagId: string) => {
      const currentTags = pendingTagUpdates;
      updateTagDebounced(currentTags.filter((id) => id !== tagId));
    },
    [pendingTagUpdates, updateTagDebounced]
  );

  const enhancedClearTags = useCallback(() => {
    updateTagDebounced([]);
  }, [updateTagDebounced]);

  const enhancedResetFilters = useCallback(() => {
    setPendingTagUpdates([]);
    setDebouncedTagIds([]);
    resetFilters();
  }, [resetFilters]);

  // Custom isFilterActive that considers debounced state
  const enhancedIsFilterActive = useCallback(
    (filterName: keyof InboxFiltersState): boolean => {
      switch (filterName) {
        case 'filter':
          // 'unread' is the default. Active if filter is 'liked' or 'archived'.
          return filter !== 'unread';
        case 'sourceFilter':
          return sourceFilter !== null;
        case 'timeRange':
          return timeRange !== 'all';
        case 'tagIds':
        case 'debouncedTagIds':
        case 'pendingTagUpdates':
          return debouncedTagIds.length > 0 || pendingTagUpdates.length > 0;
        default:
          return false;
      }
    },
    [filter, sourceFilter, timeRange, debouncedTagIds, pendingTagUpdates]
  );

  // Enhanced hasActiveFilters that considers debounced state
  const enhancedHasActiveFilters = useMemo(() => {
    // 'unread' is the default. A filter is active if it's not 'unread' OR if other filters are set.
    // Or, more simply, if any filter is different from its default state.
    // Default for filter is 'unread', sourceFilter is null, timeRange is 'all', tags are empty.
    return (
      filter !== 'unread' || // Active if status filter is not 'unread'
      sourceFilter !== null ||
      timeRange !== 'all' ||
      debouncedTagIds.length > 0 ||
      pendingTagUpdates.length > 0
    );
  }, [filter, sourceFilter, timeRange, debouncedTagIds, pendingTagUpdates]);

  // Create newsletter filter that conditionally excludes tagIds based on useLocalTagFiltering
  const enhancedNewsletterFilter = useMemo(() => {
    // Only exclude tagIds from server filter when useLocalTagFiltering is true
    if (!useLocalTagFiltering || !newsletterFilter.tagIds || newsletterFilter.tagIds.length === 0) {
      return newsletterFilter; // Keep tagIds for server filtering or if no tagIds exist
    }

    // Remove tagIds from the filter for client-side filtering
    const { tagIds: _tagIds, ...filterWithoutTags } = newsletterFilter;
    return filterWithoutTags;
  }, [
    useLocalTagFiltering,
    newsletterFilter.isRead,
    newsletterFilter.isArchived,
    newsletterFilter.isLiked,
    newsletterFilter.sourceIds,
    newsletterFilter.dateFrom,
    newsletterFilter.dateTo,
    newsletterFilter.orderBy,
    newsletterFilter.ascending,
    newsletterFilter.tagIds,
  ]);

  const state: InboxFiltersState = {
    filter,
    sourceFilter,
    timeRange,
    tagIds,
    debouncedTagIds,
    pendingTagUpdates,
    visibleTags,
    allTags,
  };

  const actions: InboxFiltersActions = {
    setFilter,
    setSourceFilter,
    setTimeRange,
    setTagIds,
    setPendingTagUpdates,
    toggleTag: enhancedToggleTag,
    addTag: enhancedAddTag,
    removeTag: enhancedRemoveTag,
    clearTags: enhancedClearTags,
    resetFilters: enhancedResetFilters,
    updateTagDebounced,
    handleTagClick,
  };

  return {
    ...state,
    ...actions,
    newsletterFilter: enhancedNewsletterFilter,
    hasActiveFilters: enhancedHasActiveFilters,
    isFilterActive: enhancedIsFilterActive,
    newsletterSources,
    isLoadingTags,
    isLoadingSources,
    useLocalTagFiltering,
  };
};

// Helper hook for just the filter state without actions
export const useInboxFilterState = (options?: UseInboxFiltersOptions) => {
  const filters = useInboxFilters(options);

  return {
    filter: filters.filter,
    sourceFilter: filters.sourceFilter,
    timeRange: filters.timeRange,
    tagIds: filters.tagIds,
    debouncedTagIds: filters.debouncedTagIds,
    pendingTagUpdates: filters.pendingTagUpdates,
    newsletterFilter: filters.newsletterFilter,
    hasActiveFilters: filters.hasActiveFilters,
    isFilterActive: filters.isFilterActive,
    newsletterSources: filters.newsletterSources,
    visibleTags: filters.visibleTags,
    allTags: filters.allTags,
    isLoadingTags: filters.isLoadingTags,
    isLoadingSources: filters.isLoadingSources,
  };
};

// Helper hook for just the filter actions
export const useInboxFilterActions = (options?: UseInboxFiltersOptions) => {
  const filters = useInboxFilters(options);

  return {
    setFilter: filters.setFilter,
    setSourceFilter: filters.setSourceFilter,
    setTimeRange: filters.setTimeRange,
    setTagIds: filters.setTagIds,
    setPendingTagUpdates: filters.setPendingTagUpdates,
    toggleTag: filters.toggleTag,
    addTag: filters.addTag,
    removeTag: filters.removeTag,
    clearTags: filters.clearTags,
    resetFilters: filters.resetFilters,
    updateTagDebounced: filters.updateTagDebounced,
    handleTagClick: filters.handleTagClick,
  };
};
