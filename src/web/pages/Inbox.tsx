import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, X } from "lucide-react";
import { subDays, subWeeks, subMonths } from "date-fns";
import { InboxFilters } from "@web/components/InboxFilters";
import BulkSelectionActions from "@web/components/BulkSelectionActions";
import { useNewsletters } from "@common/hooks/useNewsletters";
import { useTags } from "@common/hooks/useTags";
import { useNewsletterSources } from "@common/hooks/useNewsletterSources";
import { useReadingQueue } from "@common/hooks/useReadingQueue";
import { useSharedNewsletterActions } from "@common/hooks/useSharedNewsletterActions";
import { toggleTagFilter, handleTagClick } from "@common/utils/tagUtils";
import type { NewsletterWithRelations, Tag } from "@common/types";
import type { NewsletterFilter } from "@common/types/cache";
import { tagApi } from "@common/api";
import LoadingScreen from "@common/components/common/LoadingScreen";
import NewsletterRow from "@web/components/NewsletterRow";
import { TimeRange } from "@web/components/TimeFilter";
import { useAuth } from "@common/contexts";
import {
  getCacheManager,
  invalidateNewsletterQueries,
} from "@common/utils/cacheUtils";
import {
  useComponentOptimizations,
  useDebouncedCallback,
  useExpensiveComputation,
} from "@common/hooks/usePerformanceOptimizations";

const Inbox: React.FC = memo(() => {
  // Performance monitoring
  const { optimizedCallback } = useComponentOptimizations("Inbox");

  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial values from URL
  const urlFilter = searchParams.get("filter") as
    | "all"
    | "unread"
    | "liked"
    | "archived"
    | null;
  const urlSource = searchParams.get("source");
  const urlTimeRange = (searchParams.get("time") as TimeRange) || "all";

  // Filter state
  const [filter, setFilter] = useState<"all" | "unread" | "liked" | "archived">(
    urlFilter || "all",
  );
  const [sourceFilter, setSourceFilter] = useState<string | null>(urlSource);
  const [timeRange, setTimeRange] = useState<TimeRange>(urlTimeRange);

  // Get tag IDs from URL
  const tagIds = useMemo(() => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Initialize pendingTagUpdates with tagIds from URL
  const [pendingTagUpdates, setPendingTagUpdates] = useState<string[]>(tagIds);

  // Remove debouncing for source filters to fix race conditions
  // Only debounce search/text input, not dropdown selections
  const [debouncedTagUpdates, setDebouncedTagUpdates] =
    useState(pendingTagUpdates);

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Simplified debounce effect only for tag updates
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedTagUpdates([...pendingTagUpdates]);
    }, 300); // 300ms debounce delay only for tags

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [pendingTagUpdates]);

  // Sync pendingTagUpdates with URL changes
  useEffect(() => {
    setPendingTagUpdates(tagIds);
  }, [tagIds]);

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Debounced selection state for batch processing
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(
    new Set(),
  );
  const selectionDebounceRef = useRef<NodeJS.Timeout>();
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Loading states derived from actual hook states
  const loadingStates = useMemo(() => {
    const states: Record<string, string> = {};
    // Add loading states for individual newsletters based on hook states
    return states;
  }, []);

  // Hooks
  const { getTags } = useTags();
  const { readingQueue, removeFromQueue } = useReadingQueue();
  const { newsletterSources = [] } = useNewsletterSources();

  // Build newsletter filter object with immediate updates for dropdowns
  const newsletterFilter = useMemo(() => {
    const filters: NewsletterFilter = {};

    // Handle status filter - immediate update
    switch (filter) {
      case "unread":
        filters.isRead = false;
        filters.isArchived = false;
        break;
      case "liked":
        filters.isLiked = true;
        filters.isArchived = false;
        break;
      case "archived":
        filters.isArchived = true;
        break;
      case "all":
      default:
        filters.isArchived = false;
        break;
    }

    // Handle source filter - immediate update
    if (sourceFilter) {
      filters.sourceIds = [sourceFilter];
    }

    // Handle tag filter - use debounced value
    if (debouncedTagUpdates.length > 0) {
      filters.tagIds = debouncedTagUpdates;
    }

    // Handle time range filter - immediate update
    if (timeRange && timeRange !== "all") {
      const now = new Date();
      let dateFrom: Date;

      switch (timeRange) {
        case "day":
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          dateFrom = subWeeks(now, 1);
          break;
        case "month":
          dateFrom = subMonths(now, 1);
          break;
        case "2days":
          dateFrom = subDays(now, 2);
          break;
        default:
          dateFrom = subDays(now, 7);
      }

      filters.dateFrom = dateFrom.toISOString();
    }

    console.log("📋 Newsletter filter computed (immediate):", {
      originalSourceFilter: sourceFilter,
      filters,
      immediate: {
        filter,
        sourceFilter,
        timeRange,
      },
      debounced: {
        debouncedTagUpdates,
      },
    });

    return filters;
  }, [filter, sourceFilter, timeRange, debouncedTagUpdates]);

  const {
    newsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    refetchNewsletters,
  } = useNewsletters(newsletterFilter, {
    debug: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Force fresh data on filter changes
  });

  // Debug newsletters data
  useEffect(() => {
    console.log("📰 Newsletters data updated:", {
      count: newsletters.length,
      sourceFilter,
      isLoading: isLoadingNewsletters,
      newsletters: newsletters.map((n) => ({
        id: n.id,
        title: n.title,
        sourceId: n.newsletter_source_id,
        sourceName: n.source?.name,
      })),
      filterMatch: sourceFilter
        ? newsletters.every((n) => n.newsletter_source_id === sourceFilter)
        : true,
    });
  }, [newsletters, sourceFilter, isLoadingNewsletters]);

  // Force refetch when filters change to ensure fresh data
  useEffect(() => {
    console.log("🔄 Filter changed, refetching newsletters...", {
      filter,
      sourceFilter,
      timeRange,
      debouncedTagUpdates,
      newsletterFilter: JSON.stringify(newsletterFilter),
    });
    // Add small delay to ensure state has settled
    const timeoutId = setTimeout(() => {
      refetchNewsletters();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [
    filter,
    sourceFilter,
    timeRange,
    debouncedTagUpdates,
    refetchNewsletters,
  ]);

  const { user } = useAuth();

  // Debug filter changes in detail
  useEffect(() => {
    console.group("📊 Inbox Filter State Debug");
    console.log("Current filter state:", {
      filter,
      sourceFilter,
      timeRange,
      debouncedTagUpdates,
    });
    console.log(
      "Computed newsletterFilter:",
      JSON.stringify(newsletterFilter, null, 2),
    );
    console.log("Query is enabled:", !!user);
    console.log("Is loading:", isLoadingNewsletters);
    console.log("Has error:", isErrorNewsletters);
    console.log("Error details:", errorNewsletters);
    console.log("Newsletter count:", newsletters.length);
    console.groupEnd();
  }, [
    filter,
    sourceFilter,
    timeRange,
    debouncedTagUpdates,
    newsletterFilter,
    user,
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    newsletters.length,
  ]);

  // Shared newsletter action handlers
  const {
    handleToggleLike,
    handleToggleBookmark,
    handleToggleArchive,
    handleToggleRead,
    handleDeleteNewsletter,
    handleToggleInQueue,
    handleBulkMarkAsRead,
    handleBulkMarkAsUnread,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkDelete,
    isDeletingNewsletter,
    isBulkMarkingAsRead,
    isBulkMarkingAsUnread,
    isBulkArchiving,
    isBulkUnarchiving,
    isBulkDeletingNewsletters,
    isTogglingLike,
    errorTogglingLike,
    errorTogglingBookmark,
  } = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
    onSuccess: () => {
      // Clear toast after successful action
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ type: "error", message: error.message });
    },
  });

  // Initialize cache manager for advanced operations
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      // Cache manager not initialized yet - will be available after first hook usage
      return null;
    }
  }, []);

  // Cache warming on component mount and filter changes
  useEffect(() => {
    if (cacheManager && user?.id) {
      // Warm up critical caches for better performance
      cacheManager.warmCache(user.id, "high");
    }
  }, [cacheManager, user?.id]);

  // Pre-warm cache for likely filter changes
  useEffect(() => {
    if (cacheManager && user?.id && newsletters.length > 0) {
      // Pre-warm common filter combinations
      const preWarmFilters: Array<{
        filter: string;
        priority: "high" | "medium" | "low";
      }> = [
        { filter: "unread", priority: "high" },
        { filter: "liked", priority: "medium" },
        { filter: "all", priority: "medium" },
      ];

      preWarmFilters.forEach(({ filter: filterType, priority }) => {
        if (filterType !== filter) {
          // Warm cache for other filters in background
          setTimeout(() => {
            cacheManager.warmCache(user.id, priority);
          }, 100);
        }
      });
    }
  }, [cacheManager, user?.id, newsletters.length, filter]);

  // Handle source filter change immediately without throttling
  const handleSourceFilterChange = useCallback(
    (sourceId: string | null) => {
      console.log("🔍 Source filter changing:", {
        from: sourceFilter,
        to: sourceId,
      });
      setSourceFilter(sourceId);
    },
    [sourceFilter],
  );

  // Update URL when filters change - immediate for dropdowns, debounced for tags
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (filter !== "all") newParams.set("filter", filter);
    if (sourceFilter) newParams.set("source", sourceFilter);
    if (timeRange !== "all") newParams.set("time", timeRange);
    if (debouncedTagUpdates.length > 0)
      newParams.set("tags", debouncedTagUpdates.join(","));
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [
    filter,
    sourceFilter,
    timeRange,
    debouncedTagUpdates,
    searchParams,
    setSearchParams,
  ]);

  // Handle URL updates when tag filters change
  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (pendingTagUpdates.length > 0) {
        newParams.set("tags", pendingTagUpdates.join(","));
      } else {
        newParams.delete("tags");
      }
      newParams.delete("page");
      return newParams;
    });
  }, [pendingTagUpdates, setSearchParams]);

  const showArchived = filter === "archived";

  // Handle clicking on a tag with debouncing
  const handleTagClickWrapper = useDebouncedCallback(
    optimizedCallback(
      (tag: Tag, e: React.MouseEvent) => {
        handleTagClick(tag, pendingTagUpdates, setPendingTagUpdates, e);
      },
      [pendingTagUpdates],
    ),
    200,
  );

  // Clear all filters (including tags) with optimization
  const clearAllFilters = optimizedCallback(() => {
    setFilter("all");
    setTimeRange("all");
    setSourceFilter(null);
    setPendingTagUpdates([]);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      const tags = await getTags();
      setAllTags(tags);
    };
    loadTags();
  }, [getTags]);

  // Newsletter row action handlers (using shared handlers) with memoization
  const handleToggleArchiveWrapper = optimizedCallback(
    async (id: string) => {
      const newsletter = newsletters.find((n) => n.id === id);
      if (!newsletter) return;
      await handleToggleArchive(newsletter);
    },
    [handleToggleArchive, newsletters],
  );

  const handleToggleReadWrapper = optimizedCallback(
    async (id: string) => {
      const newsletter = newsletters.find((n) => n.id === id);
      if (!newsletter) return;
      await handleToggleRead(newsletter);
    },
    [handleToggleRead, newsletters],
  );

  const handleTrash = optimizedCallback(
    async (id: string) => {
      await handleDeleteNewsletter(id);
    },
    [handleDeleteNewsletter],
  );

  const handleToggleQueue = useCallback(
    async (id: string) => {
      const newsletter = newsletters.find((n) => n.id === id);
      if (!newsletter) return;
      await handleToggleInQueue(newsletter);
    },
    [handleToggleInQueue, newsletters],
  );

  const handleToggleLikeWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        await handleToggleLike(newsletter);
        // Dispatch event for unread count updates
        window.dispatchEvent(new CustomEvent("newsletter:like-status-changed"));
      } catch (error) {
        console.error("Error toggling like:", error);
        // Error is already handled by shared actions, don't rethrow
      }
    },
    [handleToggleLike],
  );

  const handleToggleBookmarkWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      await handleToggleBookmark(newsletter);
    },
    [handleToggleBookmark],
  );

  const handleUpdateTags = useCallback(
    async (newsletterId: string, tagIds: string[]) => {
      try {
        if (!user) {
          setToast({
            type: "error",
            message: "You must be logged in to update tags",
          });
          return;
        }

        // Get all existing tags to create proper Tag objects with required properties
        const existingTags = await tagApi.getAll();

        // Create Tag objects with required properties
        const tagsToUpdate = tagIds.map((tagId) => {
          const existingTag = existingTags.find((t) => t.id === tagId);
          return {
            id: tagId,
            name: existingTag?.name || `Tag ${tagId}`,
            color: existingTag?.color || "#000000",
            user_id: user.id,
            created_at: existingTag?.created_at || new Date().toISOString(),
          } as Tag;
        });

        // Use the tag API to update newsletter tags
        const success = await tagApi.updateNewsletterTags(
          newsletterId,
          tagsToUpdate,
        );

        if (success) {
          setToast({
            type: "success",
            message: "Tags updated successfully",
          });

          // Invalidate the newsletters query to refresh the list
          invalidateNewsletterQueries([newsletterId], "update");

          // Close the tag editor
          setVisibleTags((prev) => {
            const newVisibleTags = new Set(prev);
            newVisibleTags.delete(newsletterId);
            return newVisibleTags;
          });
        } else {
          throw new Error("Failed to update tags");
        }
      } catch (error) {
        setToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to update tags",
        });
      }
    },
    [user],
  );

  // Toggle tag visibility
  const toggleTagVisibility = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleTags((prev: Set<string>) => {
      const newVisibleTags = new Set(prev);
      if (newVisibleTags.has(id)) {
        newVisibleTags.delete(id);
      } else {
        newVisibleTags.clear();
        newVisibleTags.add(id);
      }
      return newVisibleTags;
    });
  }, []);

  // Handle inbox cleared and refresh events
  useEffect(() => {
    const handleClearFilters = (event?: Event) => {
      event?.preventDefault();
      setFilter("all");
      setTimeRange("all");
      setSourceFilter(null);
      setPendingTagUpdates([]);
      setSearchParams(new URLSearchParams(), { replace: true });
    };

    const handleRefreshNewsletters = (event?: Event) => {
      event?.preventDefault();
      refetchNewsletters();
    };

    window.addEventListener(
      "inbox:clear-filters",
      handleClearFilters as EventListener,
    );
    window.addEventListener(
      "inbox:refresh-newsletters",
      handleRefreshNewsletters as EventListener,
    );

    return () => {
      window.removeEventListener(
        "inbox:clear-filters",
        handleClearFilters as EventListener,
      );
      window.removeEventListener(
        "inbox:refresh-newsletters",
        handleRefreshNewsletters as EventListener,
      );
    };
  }, [refetchNewsletters, setSearchParams]);

  // Initialize pendingTagUpdates from URL on mount
  useEffect(() => {
    if (tagIds.length > 0) {
      setPendingTagUpdates([...tagIds]);
    }
  }, [tagIds]);

  // Get unique tags from all available tags and newsletters with performance optimization
  const allUniqueTags = useExpensiveComputation(
    (deps) => {
      const tags = new Map<string, Tag>();
      deps.allTags.forEach((tag: Tag) => {
        if (tag?.id) {
          tags.set(tag.id, tag);
        }
      });
      deps.newsletters.forEach((newsletter: NewsletterWithRelations) => {
        (newsletter.tags || []).forEach((tag: Tag) => {
          if (tag?.id && !tags.has(tag.id)) {
            tags.set(tag.id, tag);
          }
        });
      });
      return tags;
    },
    { allTags, newsletters },
  );

  // Get selected tag objects
  const selectedTags = useMemo(() => {
    return debouncedTagUpdates
      .map((id: string) => allUniqueTags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }, [debouncedTagUpdates, allUniqueTags]);

  // Use newsletters directly from API (server-side filtering replaces client-side)
  const filteredNewsletters = useMemo(() => {
    return newsletters || [];
  }, [newsletters]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Enhanced bulk action handlers with batch processing
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setPendingSelections(new Set());
    setIsSelecting(false);
  }, []);

  const handleBulkTrash = useCallback(async () => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${currentSelection.size} newsletter(s)? This action cannot be undone.`,
      )
    )
      return;

    try {
      // Process in batches for better performance
      const batchSize = 10;
      const ids = Array.from(currentSelection);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await handleBulkDelete(batch);
      }

      clearSelection();
      setToast({
        type: "success",
        message: `Successfully deleted ${ids.length} newsletter(s)`,
      });
    } catch (error) {
      console.error("Error deleting newsletters:", error);
      setToast({
        type: "error",
        message: "Failed to delete some newsletters",
      });
    }
  }, [handleBulkDelete, selectedIds, pendingSelections, clearSelection]);

  const handleBulkArchiveWrapper = useCallback(async () => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === 0) return;

    try {
      const batchSize = 20;
      const ids = Array.from(currentSelection);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await handleBulkArchive(batch);
      }

      clearSelection();
      setToast({
        type: "success",
        message: `Successfully archived ${ids.length} newsletter(s)`,
      });
    } catch (error) {
      console.error("Error archiving newsletters:", error);
      setToast({
        type: "error",
        message: "Failed to archive some newsletters",
      });
    }
  }, [handleBulkArchive, selectedIds, pendingSelections, clearSelection]);

  const handleBulkUnarchiveWrapper = useCallback(async () => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === 0) return;

    try {
      const batchSize = 20;
      const ids = Array.from(currentSelection);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await handleBulkUnarchive(batch);
      }

      clearSelection();
      setToast({
        type: "success",
        message: `Successfully unarchived ${ids.length} newsletter(s)`,
      });
    } catch (error) {
      console.error("Error unarchiving newsletters:", error);
      setToast({
        type: "error",
        message: "Failed to unarchive some newsletters",
      });
    }
  }, [handleBulkUnarchive, selectedIds, pendingSelections, clearSelection]);

  // Debounced selection update for better performance
  useEffect(() => {
    if (selectionDebounceRef.current) {
      clearTimeout(selectionDebounceRef.current);
    }

    selectionDebounceRef.current = setTimeout(() => {
      if (pendingSelections.size > 0) {
        setSelectedIds(new Set(pendingSelections));
        setPendingSelections(new Set());
      }
    }, 100); // 100ms debounce for selection updates

    return () => {
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current);
      }
    };
  }, [pendingSelections]);

  // Optimized toggle selection with debouncing
  // Toggle selection of a single newsletter with optimization
  const toggleSelect = optimizedCallback(
    (id: string) => {
      setPendingSelections((prev) => {
        const newSet = new Set(prev.size > 0 ? prev : selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        if (newSet.size === 0) {
          setIsSelecting(false);
        } else {
          setIsSelecting(true);
        }
        return newSet;
      });
    },
    [selectedIds],
  );

  // Toggle select all visible newsletters with optimization
  const toggleSelectAll = optimizedCallback(() => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === filteredNewsletters.length) {
      clearSelection();
    } else {
      const allIds = new Set(filteredNewsletters.map((n) => n.id));
      setSelectedIds(allIds);
      setPendingSelections(new Set());
      setIsSelecting(true);
    }
  }, [
    filteredNewsletters,
    selectedIds.size,
    pendingSelections.size,
    clearSelection,
  ]);

  // Enhanced selection helpers with immediate updates and optimization
  const selectRead = optimizedCallback(() => {
    const readIds = filteredNewsletters
      .filter((n) => n.is_read)
      .map((n) => n.id);
    setSelectedIds(new Set(readIds));
    setPendingSelections(new Set());
    setIsSelecting(readIds.length > 0);
  }, [filteredNewsletters]);

  const selectUnread = optimizedCallback(() => {
    const unreadIds = filteredNewsletters
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    setSelectedIds(new Set(unreadIds));
    setPendingSelections(new Set());
    setIsSelecting(unreadIds.length > 0);
  }, [filteredNewsletters]);

  const handleBulkMarkAsReadWrapper = useCallback(async () => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === 0) return;

    try {
      const batchSize = 25;
      const ids = Array.from(currentSelection);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await handleBulkMarkAsRead(batch);
      }

      clearSelection();
      setToast({
        type: "success",
        message: `Successfully marked ${ids.length} newsletter(s) as read`,
      });
    } catch (error) {
      console.error("Error marking newsletters as read:", error);
      setToast({
        type: "error",
        message: "Failed to mark some newsletters as read",
      });
    }
  }, [handleBulkMarkAsRead, selectedIds, pendingSelections, clearSelection]);

  const handleBulkMarkAsUnreadWrapper = useCallback(async () => {
    const currentSelection =
      selectedIds.size > 0 ? selectedIds : pendingSelections;
    if (currentSelection.size === 0) return;

    try {
      const batchSize = 25;
      const ids = Array.from(currentSelection);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await handleBulkMarkAsUnread(batch);
      }

      clearSelection();
      setToast({
        type: "success",
        message: `Successfully marked ${ids.length} newsletter(s) as unread`,
      });
    } catch (error) {
      console.error("Error marking newsletters as unread:", error);
      setToast({
        type: "error",
        message: "Failed to mark some newsletters as unread",
      });
    }
  }, [handleBulkMarkAsUnread, selectedIds, pendingSelections, clearSelection]);

  // Handle newsletter click
  const handleNewsletterClick = useCallback(
    (newsletter: NewsletterWithRelations) => {
      navigate(`/newsletters/${newsletter.id}`);
    },
    [navigate],
  );

  // Handle remove from queue
  const handleRemoveFromQueue = useCallback(
    async (e: React.MouseEvent, newsletterId: string) => {
      e.stopPropagation();
      try {
        const queueItem = readingQueue.find(
          (item) => item.newsletter_id === newsletterId,
        );
        if (queueItem) {
          await removeFromQueue(queueItem.id);
          await refetchNewsletters();
        } else {
          setToast({ type: "error", message: "Failed to find item in queue" });
        }
      } catch (error) {
        console.error("Error removing from queue:", error);
        setToast({ type: "error", message: "Failed to remove from queue" });
      }
    },
    [readingQueue, removeFromQueue, refetchNewsletters],
  );

  if (isLoadingNewsletters) {
    return <LoadingScreen />;
  }

  if (isErrorNewsletters) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex flex-col items-center justify-center h-screen bg-neutral-50 p-4">
          <div className="text-center">
            <Mail className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-semibold text-neutral-800 mb-2">
              Error Loading Newsletters
            </h2>
            <p className="text-neutral-600 mb-6">
              {errorNewsletters?.message ||
                "Something went wrong. Please try again later."}
            </p>
            <button
              onClick={() => refetchNewsletters()}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!newsletters) {
    return (
      <div className="text-center p-8 text-neutral-500">
        No newsletters found, or still initializing.
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <InboxFilters
                filter={filter}
                sourceFilter={sourceFilter}
                timeRange={timeRange}
                newsletterSources={newsletterSources}
                onFilterChange={setFilter}
                onSourceFilterChange={handleSourceFilterChange}
                onTimeRangeChange={setTimeRange}
              />
              {!isSelecting && (
                <button
                  onClick={() => setIsSelecting(true)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  Select
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium">🐛 Debug Info:</div>
          <button
            onClick={() => refetchNewsletters()}
            className="text-sm text-green-600 hover:underline flex items-center space-x-1"
          >
            🔄 Refresh
          </button>
        </div>
        <div>Filter: {filter}</div>
        <div>Source Filter: {sourceFilter || "None"}</div>
        <div>Newsletter Filter Applied: {JSON.stringify(newsletterFilter)}</div>
        <div>Time Range: {timeRange}</div>
        <div>Tag IDs: {tagIds.length > 0 ? tagIds.join(", ") : "None"}</div>
        <div>Fetched Newsletters: {newsletters.length}</div>
        <div>Filtered Newsletters: {filteredNewsletters.length}</div>
        <div>Is Loading: {isLoadingNewsletters ? "Yes" : "No"}</div>
        <div>Is Error: {isErrorNewsletters ? "Yes" : "No"}</div>
        <div>User ID: {user?.id || "None"}</div>
        <div>Query Enabled: {!!user ? "Yes" : "No"}</div>
        <button
          onClick={() => {
            console.log("Manual refetch triggered");
            refetchNewsletters();
          }}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Force Refetch
        </button>
        <div>Newsletter Filter: {JSON.stringify(newsletterFilter)}</div>
      </div>

      {isSelecting && (
        <div className="mt-2">
          <BulkSelectionActions
            selectedCount={Math.max(selectedIds.size, pendingSelections.size)}
            totalCount={filteredNewsletters.length}
            showArchived={showArchived}
            isBulkActionLoading={
              isBulkMarkingAsRead ||
              isBulkMarkingAsUnread ||
              isBulkArchiving ||
              isBulkUnarchiving ||
              isBulkDeletingNewsletters
            }
            onSelectAll={toggleSelectAll}
            onSelectRead={selectRead}
            onSelectUnread={selectUnread}
            onMarkAsRead={handleBulkMarkAsReadWrapper}
            onMarkAsUnread={handleBulkMarkAsUnreadWrapper}
            onArchive={handleBulkArchiveWrapper}
            onUnarchive={handleBulkUnarchiveWrapper}
            onDelete={handleBulkTrash}
            onCancel={clearSelection}
          />
        </div>
      )}

      {selectedTags.length > 0 && (
        <div className="px-6 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingTagUpdates(
                      toggleTagFilter(tag.id, pendingTagUpdates),
                    );
                  }}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  title="Remove tag filter"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg text-white text-sm
            ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      <div
        className={`${selectedTags.length > 0 ? "pt-2" : "pt-6"} px-6 pb-6 overflow-auto`}
      >
        {isLoadingNewsletters ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-base text-neutral-400">Loading newsletters...</p>
          </div>
        ) : filteredNewsletters.length === 0 &&
          !isTogglingLike &&
          !errorTogglingLike &&
          !errorTogglingBookmark ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <Mail className="mx-auto h-14 w-14 mb-4 text-blue-300" />
            <h2 className="text-xl font-semibold mb-2">
              {filter === "unread"
                ? "No unread newsletters"
                : filter === "liked"
                  ? "No liked newsletters"
                  : filter === "archived"
                    ? "No archived newsletters"
                    : sourceFilter
                      ? "No newsletters found for this source"
                      : "No newsletters found"}
            </h2>
            <p className="text-base text-neutral-400">
              {sourceFilter
                ? "Try selecting a different source or adjusting your filters."
                : "Try adjusting your filters or check back later."}
            </p>
          </div>
        ) : (
          filteredNewsletters.map((newsletter) => {
            const newsletterWithRelations: NewsletterWithRelations = {
              ...newsletter,
              newsletter_source_id: newsletter.newsletter_source_id || null,
              source: newsletter.source || null,
              tags: newsletter.tags || [],
              is_archived: newsletter.is_archived || false,
            };
            return (
              <NewsletterRow
                key={newsletter.id}
                newsletter={newsletterWithRelations}
                isSelected={isSelecting && selectedIds.has(newsletter.id)}
                onToggleSelect={toggleSelect}
                onToggleLike={handleToggleLikeWrapper}
                onToggleBookmark={handleToggleBookmarkWrapper}
                onToggleArchive={handleToggleArchiveWrapper}
                onToggleRead={handleToggleReadWrapper}
                onTrash={handleTrash}
                onToggleQueue={handleToggleQueue}
                onToggleTagVisibility={toggleTagVisibility}
                onUpdateTags={handleUpdateTags}
                onTagClick={handleTagClickWrapper}
                onRemoveFromQueue={handleRemoveFromQueue}
                onNewsletterClick={handleNewsletterClick}
                isInReadingQueue={readingQueue.some(
                  (item) => item.newsletter_id === newsletter.id,
                )}
                showCheckbox={isSelecting}
                showTags
                visibleTags={visibleTags}
                readingQueue={readingQueue}
                isDeletingNewsletter={isDeletingNewsletter || false}
                loadingStates={{
                  ...loadingStates,
                  [newsletter.id]: isTogglingLike
                    ? "like"
                    : loadingStates[newsletter.id],
                }}
                errorTogglingLike={errorTogglingLike}
                errorTogglingBookmark={errorTogglingBookmark}
              />
            );
          })
        )}
      </div>
    </div>
  );
});

Inbox.displayName = "Inbox";

export default Inbox;
