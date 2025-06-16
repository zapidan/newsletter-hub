import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFilters } from "@common/contexts/FilterContext";
import { useNewsletters } from "@common/hooks/useNewsletters";
import { useNewsletterSources } from "@common/hooks/useNewsletterSources";
import { useTags } from "@common/hooks/useTags";
import type { NewsletterWithRelations, Tag } from "@common/types";
import type { TimeRange } from "@web/components/TimeFilter";

export interface InboxFiltersState {
  filter: "all" | "unread" | "liked" | "archived";
  sourceFilter: string | null;
  timeRange: TimeRange;
  tagIds: string[];
  debouncedTagIds: string[];
  pendingTagUpdates: string[];
  visibleTags: Set<string>;
  allTags: Tag[];
}

export interface InboxFiltersActions {
  setFilter: (filter: "all" | "unread" | "liked" | "archived") => void;
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

export interface UseInboxFiltersReturn
  extends InboxFiltersState,
    InboxFiltersActions {
  newsletterFilter: ReturnType<typeof useFilters>["newsletterFilter"];
  hasActiveFilters: boolean;
  isFilterActive: (filterName: keyof InboxFiltersState) => boolean;
  newsletterSources: Array<{ id: string; name: string }>;
  isLoadingTags: boolean;
  isLoadingSources: boolean;
}

export const useInboxFilters = (
  options: UseInboxFiltersOptions = {},
): UseInboxFiltersReturn => {
  const {
    debounceMs = 300,
    autoLoadTags = true,
    preserveUrlOnActions = true,
  } = options;

  // Use filter context for core filter state
  const {
    filter,
    sourceFilter,
    timeRange,
    tagIds,
    newsletterFilter,
    hasActiveFilters,
    isFilterActive,
    setFilter,
    setSourceFilter,
    setTimeRange,
    setTagIds,
    toggleTag,
    addTag,
    removeTag,
    clearTags,
    resetFilters,
  } = useFilters();

  // Local state for debounced tag updates
  const [pendingTagUpdates, setPendingTagUpdates] = useState<string[]>(tagIds);
  const [debouncedTagIds, setDebouncedTagIds] = useState<string[]>(tagIds);
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Refs for debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Hooks
  const { getTags } = useTags();
  const { newsletterSources = [], isLoading: isLoadingSources } =
    useNewsletterSources();

  // Sync pendingTagUpdates with URL changes
  useEffect(() => {
    console.log("🏷️ [useInboxFilters] URL tagIds changed:", {
      tagIds,
      pendingTagUpdates,
    });
    setPendingTagUpdates(tagIds);
  }, [tagIds]);

  // Debounce tag updates
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      console.log("🏷️ [useInboxFilters] Debounce timeout fired:", {
        pendingTagUpdates,
        currentTagIds: tagIds,
        willUpdate: pendingTagUpdates.join(",") !== tagIds.join(","),
      });
      setDebouncedTagIds([...pendingTagUpdates]);
      // Update the actual filter state after debounce
      if (pendingTagUpdates.join(",") !== tagIds.join(",")) {
        setTagIds(pendingTagUpdates);
      }
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [pendingTagUpdates, debounceMs, tagIds, setTagIds]);

  // Load tags if enabled
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  useEffect(() => {
    if (autoLoadTags) {
      console.log("🏷️ [useInboxFilters] Loading tags...");
      setIsLoadingTags(true);
      getTags()
        .then((tags) => {
          console.log("🏷️ [useInboxFilters] Tags loaded:", {
            count: tags?.length || 0,
            tags: tags?.map((t) => ({ id: t.id, name: t.name })) || [],
          });
          setAllTags(tags || []);
        })
        .catch((error) => {
          console.error("Failed to load tags:", error);
          setAllTags([]);
        })
        .finally(() => {
          setIsLoadingTags(false);
        });
    }
  }, [autoLoadTags, getTags]);

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
  const updateTagDebounced = useCallback((newTagIds: string[]) => {
    setPendingTagUpdates(newTagIds);
  }, []);

  // Handle tag click with toggle logic
  const handleTagClick = useCallback(
    (tagId: string) => {
      console.log("🏷️ [useInboxFilters] Tag clicked:", {
        tagId,
        currentTags: pendingTagUpdates,
      });
      const currentTags = pendingTagUpdates;
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter((id) => id !== tagId)
        : [...currentTags, tagId];

      console.log("🏷️ [useInboxFilters] New tags after toggle:", newTags);
      updateTagDebounced(newTags);
    },
    [pendingTagUpdates, updateTagDebounced],
  );

  // Enhanced filter actions that work with debounced tags
  const enhancedToggleTag = useCallback(
    (tagId: string) => {
      handleTagClick(tagId);
    },
    [handleTagClick],
  );

  const enhancedAddTag = useCallback(
    (tagId: string) => {
      const currentTags = pendingTagUpdates;
      if (!currentTags.includes(tagId)) {
        updateTagDebounced([...currentTags, tagId]);
      }
    },
    [pendingTagUpdates, updateTagDebounced],
  );

  const enhancedRemoveTag = useCallback(
    (tagId: string) => {
      const currentTags = pendingTagUpdates;
      updateTagDebounced(currentTags.filter((id) => id !== tagId));
    },
    [pendingTagUpdates, updateTagDebounced],
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
        case "filter":
          return filter !== "all";
        case "sourceFilter":
          return sourceFilter !== null;
        case "timeRange":
          return timeRange !== "all";
        case "tagIds":
        case "debouncedTagIds":
        case "pendingTagUpdates":
          return debouncedTagIds.length > 0 || pendingTagUpdates.length > 0;
        default:
          return false;
      }
    },
    [filter, sourceFilter, timeRange, debouncedTagIds, pendingTagUpdates],
  );

  // Enhanced hasActiveFilters that considers debounced state
  const enhancedHasActiveFilters = useMemo(() => {
    return (
      filter !== "all" ||
      sourceFilter !== null ||
      timeRange !== "all" ||
      debouncedTagIds.length > 0 ||
      pendingTagUpdates.length > 0
    );
  }, [filter, sourceFilter, timeRange, debouncedTagIds, pendingTagUpdates]);

  // Create newsletter filter that uses debounced tag IDs
  const enhancedNewsletterFilter = useMemo(() => {
    return {
      ...newsletterFilter,
      ...(debouncedTagIds.length > 0 && { tagIds: debouncedTagIds }),
    };
  }, [newsletterFilter, debouncedTagIds]);

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
