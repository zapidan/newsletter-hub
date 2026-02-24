import { useFilters } from '@common/contexts/FilterContext';
import { useNewsletterSources } from '@common/hooks/useNewsletterSources';
import { useTags } from '@common/hooks/useTags';
import type { NewsletterSource, Tag } from '@common/types';
import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';
import { useLogger } from '@common/utils/logger/useLogger';
import type { TimeRange } from '@web/components/TimeFilter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  groupFilters: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
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
  setGroupFilters: (groupIds: string[]) => void;
  toggleGroup: (groupId: string) => void;
  addGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  clearGroups: () => void;
  setSortBy: (sortBy: string) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setVisibleTags: (tags: Set<string>) => void;
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
    _debounceMs = 300,
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
    groupFilters,
    sortBy,
    sortOrder,
    newsletterFilter,
    useLocalTagFiltering,
    setFilter,
    setSourceFilter,
    setTimeRange,
    setTagIds,
    setGroupFilters,
    setSortBy,
    setSortOrder,
    _resetFilters
  } = useFilters();

  // Get getTags function for validation (must be declared before useCallbackWithValidation)
  const { getTags } = useTags();

  // Create dependency validator for this hook
  const dependencyValidator = useMemo(() =>
    new DependencyValidator({
      errorPrefix: 'useInboxFilters dependency validation failed',
      rules: [
        ValidationRules.specificDependencies('memoizedGetTags', [getTags])
      ]
    }),
    [getTags]
  );

  // Local state for debounced tag updates
  const [pendingTagUpdates, setPendingTagUpdates] = useState<string[]>(tagIds);
  const [_debouncedTagIds, _setDebouncedTagIds] = useState<string[]>(tagIds);
  const [_visibleTags, _setVisibleTags] = useState<Set<string>>(new Set());
  const [_allTags, _setAllTags] = useState<Tag[]>([]);

  // Refs for debouncing
  const _debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const _lastFilterStateRef = useRef<string>('');

  // Hooks - memoize getTags to prevent infinite loops
  // IMPORTANT: This useCallback MUST have minimal dependencies [getTags] to prevent infinite re-renders.
  // DO NOT add other dependencies that could cause this function to be recreated.
  const memoizedGetTags = useCallback(getTags, [getTags]);
  // Validate dependencies to prevent infinite loops
  dependencyValidator.validate('memoizedGetTags', [getTags]);

  const { newsletterSources = [], isLoadingSources } = useNewsletterSources({
    includeCount: true,
    excludeArchived: false,
    limit: 1000, // Load all sources for dropdown with counts
    orderBy: 'name',
    orderDirection: 'asc',
  });

  // Load tags if enabled
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [hasLoadedTags, setHasLoadedTags] = useState(false);

  useEffect(() => {
    if (autoLoadTags && !hasLoadedTags && !isLoadingTags) {
      setIsLoadingTags(true);
      memoizedGetTags()
        .then((tags) => {
          if (tags && tags.length > 0) {
            _setAllTags(tags);
          } else {
            log.warn('No tags loaded for inbox filters', {
              action: 'load_tags',
              metadata: {
                autoLoadTags,
                tagCount: 0,
                impact: 'filter_functionality_affected',
              },
            });
            _setAllTags([]);
          }
          setHasLoadedTags(true);
        })
        .catch((error) => {
          log.error(
            'Failed to load tags for inbox filters',
            {
              action: 'load_tags',
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          );
          _setAllTags([]);
          setHasLoadedTags(true);
        })
        .finally(() => {
          setIsLoadingTags(false);
        });
    }
  }, [autoLoadTags, hasLoadedTags, isLoadingTags, memoizedGetTags, log]);

  // Enhanced filter actions that work with debounced tags
  const enhancedToggleTag = useCallback(
    (tagId: string) => {
      if (pendingTagUpdates.includes(tagId)) {
        setPendingTagUpdates(pendingTagUpdates.filter(id => id !== tagId));
      } else {
        setPendingTagUpdates([...pendingTagUpdates, tagId]);
      }
    },
    [pendingTagUpdates]
  );

  const enhancedAddTag = useCallback(
    (tagId: string) => {
      if (!pendingTagUpdates.includes(tagId)) {
        setPendingTagUpdates([...pendingTagUpdates, tagId]);
      }
    },
    [pendingTagUpdates]
  );

  const enhancedRemoveTag = useCallback(
    (tagId: string) => {
      setPendingTagUpdates(pendingTagUpdates.filter(id => id !== tagId));
    },
    [pendingTagUpdates]
  );

  const enhancedClearTags = useCallback(() => {
    setPendingTagUpdates([]);
  }, []);

  const enhancedResetFilters = useCallback(() => {
    setFilter('unread');
    setSourceFilter(null);
    setTimeRange('all');
    setPendingTagUpdates([]);
    setGroupFilters([]);
  }, [setFilter, setSourceFilter, setTimeRange, setGroupFilters]);

  const handleTagClick = useCallback(
    (tagId: string) => {
      if (pendingTagUpdates.includes(tagId)) {
        setPendingTagUpdates(pendingTagUpdates.filter(id => id !== tagId));
      } else {
        setPendingTagUpdates([...pendingTagUpdates, tagId]);
      }
    },
    [pendingTagUpdates]
  );

  const updateTagDebounced = useCallback(
    (newTagIds: string[]) => {
      setPendingTagUpdates(newTagIds);
    },
    []
  );

  // Group filter actions
  const toggleGroup = useCallback(
    (groupId: string) => {
      if (groupFilters.includes(groupId)) {
        setGroupFilters(groupFilters.filter(id => id !== groupId));
      } else {
        setGroupFilters([...groupFilters, groupId]);
      }
    },
    [groupFilters, setGroupFilters]
  );

  const addGroup = useCallback(
    (groupId: string) => {
      if (!groupFilters.includes(groupId)) {
        setGroupFilters([...groupFilters, groupId]);
      }
    },
    [groupFilters, setGroupFilters]
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      setGroupFilters(groupFilters.filter(id => id !== groupId));
    },
    [groupFilters, setGroupFilters]
  );

  const clearGroups = useCallback(() => {
    setGroupFilters([]);
  }, [setGroupFilters]);

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return (
      filter !== 'unread' ||
      sourceFilter !== null ||
      timeRange !== 'all' ||
      tagIds.length > 0 ||
      groupFilters.length > 0
    );
  }, [filter, sourceFilter, timeRange, tagIds, groupFilters]);

  const isFilterActive = useCallback(
    (filterName: keyof InboxFiltersState) => {
      switch (filterName) {
        case 'filter':
          return filter !== 'unread';
        case 'sourceFilter':
          return sourceFilter !== null;
        case 'timeRange':
          return timeRange !== 'all';
        case 'tagIds':
          return tagIds.length > 0;
        case 'debouncedTagIds':
          return _debouncedTagIds.length > 0;
        case 'pendingTagUpdates':
          return pendingTagUpdates.length > 0;
        case 'visibleTags':
          return _visibleTags.size > 0;
        case 'allTags':
          return _allTags.length > 0;
        case 'groupFilters':
          return groupFilters.length > 0;
        case 'sortBy':
          return sortBy !== 'received_at';
        case 'sortOrder':
          return sortOrder !== 'desc';
        default:
          return false;
      }
    },
    [filter, sourceFilter, timeRange, tagIds, _debouncedTagIds, pendingTagUpdates, _visibleTags, _allTags, groupFilters, sortBy, sortOrder]
  );

  // Return all state and actions
  return {
    // State
    filter,
    sourceFilter,
    timeRange,
    tagIds,
    debouncedTagIds: _debouncedTagIds,
    pendingTagUpdates,
    visibleTags: _visibleTags,
    allTags: _allTags,
    groupFilters,
    sortBy,
    sortOrder,
    newsletterFilter,
    useLocalTagFiltering,

    // Actions
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
    setGroupFilters,
    toggleGroup,
    addGroup,
    removeGroup,
    clearGroups,
    setSortBy,
    setSortOrder,
    setVisibleTags: _setVisibleTags,

    // Computed
    hasActiveFilters,
    isFilterActive,
    newsletterSources,
    isLoadingTags,
    isLoadingSources,
  };
};
