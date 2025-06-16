import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

import { InboxFilters } from "@web/components/InboxFilters";
import BulkSelectionActions from "@web/components/BulkSelectionActions";
import NewsletterRow from "@web/components/NewsletterRow";
import LoadingScreen from "@common/components/common/LoadingScreen";

import { useNewsletters } from "@common/hooks/useNewsletters";
import { useReadingQueue } from "@common/hooks/useReadingQueue";
import { useInboxFilters } from "@common/hooks/useInboxFilters";
import { useSharedNewsletterActions } from "@common/hooks/useSharedNewsletterActions";
import { useErrorHandling } from "@common/hooks/useErrorHandling";
import { useBulkLoadingStates } from "@common/hooks/useLoadingStates";

import { useToast } from "@common/contexts/ToastContext";
import { useAuth } from "@common/contexts";

import type { NewsletterWithRelations, Tag } from "@common/types";
import { getCacheManager } from "@common/utils/cacheUtils";

// Separate component for selected tags display
const SelectedTagsDisplay: React.FC<{
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onRemoveTag: (tagId: string) => void;
  onClearAll: () => void;
}> = memo(({ selectedTags, onRemoveTag, onClearAll }) => {
  if (selectedTags.length === 0) return null;

  return (
    <div className="px-6 pt-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-blue-900">
            Active Tag Filters ({selectedTags.length})
          </h3>
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            Clear all filters
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium cursor-pointer hover:opacity-80"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTag(tag.id);
                }}
                className="ml-1.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                title="Remove this filter"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Showing newsletters matching{" "}
          {selectedTags.length === 1 ? "this tag" : "any of these tags"}. Click
          tag names in newsletter rows to add more filters.
        </p>
      </div>
    </div>
  );
});

// Separate component for empty state
const EmptyState: React.FC<{
  filter: string;
  sourceFilter: string | null;
}> = memo(({ filter, sourceFilter }) => {
  const getEmptyMessage = () => {
    if (filter === "unread") return "No unread newsletters";
    if (filter === "liked") return "No liked newsletters";
    if (filter === "archived") return "No archived newsletters";
    if (sourceFilter) return "No newsletters found for this source";
    return "No newsletters found";
  };

  const getEmptyDescription = () => {
    if (sourceFilter) {
      return "Try selecting a different source or adjusting your filters.";
    }
    return "Try adjusting your filters or check back later.";
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
      <Mail className="mx-auto h-14 w-14 mb-4 text-blue-300" />
      <h2 className="text-xl font-semibold mb-2">{getEmptyMessage()}</h2>
      <p className="text-base text-neutral-400">{getEmptyDescription()}</p>
    </div>
  );
});

// Separate component for error state
const ErrorState: React.FC<{
  error: Error | null;
  onRetry: () => void;
}> = memo(({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center h-screen bg-neutral-50 p-4">
    <div className="text-center">
      <Mail className="mx-auto h-16 w-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-semibold text-neutral-800 mb-2">
        Error Loading Newsletters
      </h2>
      <p className="text-neutral-600 mb-6">
        {error?.message || "Something went wrong. Please try again later."}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
));

// Main Inbox component - now focused primarily on rendering
const Inbox: React.FC = memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useToast();

  // Filter management using our new context and hooks
  const {
    filter,
    sourceFilter,
    timeRange,
    debouncedTagIds,
    allTags,
    newsletterSources,
    newsletterFilter,
    // Filter actions
    setFilter,
    setSourceFilter,
    setTimeRange,
    removeTag,
    resetFilters,
    handleTagClick,
  } = useInboxFilters();

  // Newsletter data
  const {
    newsletters: rawNewsletters,
    isLoadingNewsletters,
    errorNewsletters,
    refetchNewsletters,
  } = useNewsletters(newsletterFilter, {
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // Reading queue
  const { readingQueue, removeFromQueue } = useReadingQueue();

  // Error handling
  const { handleError } = useErrorHandling({
    enableToasts: true,
    enableLogging: true,
  });

  // Loading states for bulk operations
  const bulkLoadingStates = useBulkLoadingStates();

  // Helper function to preserve URL parameters after actions
  const preserveFilterParams = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    let hasChanges = false;

    if (filter !== "all") {
      if (params.get("filter") !== filter) {
        params.set("filter", filter);
        hasChanges = true;
      }
    } else {
      if (params.has("filter")) {
        params.delete("filter");
        hasChanges = true;
      }
    }

    if (sourceFilter) {
      if (params.get("source") !== sourceFilter) {
        params.set("source", sourceFilter);
        hasChanges = true;
      }
    } else {
      if (params.has("source")) {
        params.delete("source");
        hasChanges = true;
      }
    }

    if (timeRange !== "all") {
      if (params.get("time") !== timeRange) {
        params.set("time", timeRange);
        hasChanges = true;
      }
    } else {
      if (params.has("time")) {
        params.delete("time");
        hasChanges = true;
      }
    }

    if (debouncedTagIds.length > 0) {
      const tagString = debouncedTagIds.join(",");
      if (params.get("tags") !== tagString) {
        params.set("tags", tagString);
        hasChanges = true;
      }
    } else {
      if (params.has("tags")) {
        params.delete("tags");
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [filter, sourceFilter, timeRange, debouncedTagIds]);

  // Shared newsletter actions with our enhanced version
  const newsletterActions = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
    enableErrorHandling: true,
    enableLoadingStates: true,
    onSuccess: () => {
      // Trigger any additional success handling
    },
    onError: handleError,
  });

  // Selection state (local to component since it's UI-only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Tag visibility state
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());

  // Tag error handling state
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

  // Action progress state to prevent refetching during actions
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Stable newsletter list
  const [stableNewsletters, setStableNewsletters] = useState<
    NewsletterWithRelations[]
  >([]);
  const [stableKeys, setStableKeys] = useState<Map<string, string>>(new Map());

  // Force refetch when filters change to ensure fresh data (but not during actions)
  useEffect(() => {
    // Skip refetch if action is in progress to preserve optimistic updates
    if (isActionInProgress) {
      console.log("🔄 Skipping refetch - action in progress");
      return;
    }

    console.log("🔄 Filter changed, refetching newsletters...", {
      filter,
      sourceFilter,
      timeRange,
      debouncedTagIds,
    });

    refetchNewsletters();
  }, [
    filter,
    sourceFilter,
    timeRange,
    debouncedTagIds,
    newsletterFilter,
    refetchNewsletters,
    isActionInProgress,
  ]);

  // Update stable newsletter list while preserving order
  useEffect(() => {
    if (rawNewsletters.length === 0 && !isLoadingNewsletters) {
      setStableNewsletters([]);
      setStableKeys(new Map());
      return;
    }

    if (rawNewsletters.length > 0) {
      setStableNewsletters((prevStable) => {
        const updatedNewsletters: NewsletterWithRelations[] = [];
        const existingIds = new Set(rawNewsletters.map((n) => n.id));

        // Keep existing newsletters in their current order
        prevStable.forEach((newsletter) => {
          if (existingIds.has(newsletter.id)) {
            const updated = rawNewsletters.find((n) => n.id === newsletter.id);
            if (updated) {
              updatedNewsletters.push(updated);
            }
          }
        });

        // Add new newsletters at the end
        rawNewsletters.forEach((newsletter) => {
          if (!updatedNewsletters.find((n) => n.id === newsletter.id)) {
            updatedNewsletters.push(newsletter);
          }
        });

        return updatedNewsletters;
      });

      // Update stable keys for new newsletters only
      setStableKeys((prev) => {
        const newKeys = new Map(prev);
        const timestamp = Date.now();
        rawNewsletters.forEach((newsletter) => {
          if (!newKeys.has(newsletter.id)) {
            newKeys.set(newsletter.id, `${newsletter.id}-${timestamp}`);
          }
        });
        return newKeys;
      });
    }
  }, [rawNewsletters, isLoadingNewsletters]);

  const newsletters = stableNewsletters;

  // Get selected tag objects for display
  const selectedTags = useMemo(() => {
    return debouncedTagIds
      .map((tagId) => allTags.find((tag) => tag.id === tagId))
      .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined);
  }, [debouncedTagIds, allTags]);

  // Selection handlers
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
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
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === newsletters.length) {
      clearSelection();
    } else {
      const allIds = new Set(newsletters.map((n) => n.id));
      setSelectedIds(allIds);
      setIsSelecting(true);
    }
  }, [newsletters, selectedIds.size, clearSelection]);

  const selectRead = useCallback(() => {
    const readIds = newsletters.filter((n) => n.is_read).map((n) => n.id);
    setSelectedIds(new Set(readIds));
    setIsSelecting(readIds.length > 0);
  }, [newsletters]);

  const selectUnread = useCallback(() => {
    const unreadIds = newsletters.filter((n) => !n.is_read).map((n) => n.id);
    setSelectedIds(new Set(unreadIds));
    setIsSelecting(unreadIds.length > 0);
  }, [newsletters]);

  // Bulk action handlers using our enhanced shared actions
  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsActionInProgress(true);

    try {
      const ids = Array.from(selectedIds);
      await newsletterActions.handleBulkMarkAsRead(ids);
      preserveFilterParams();
      clearSelection();
    } finally {
      setTimeout(() => setIsActionInProgress(false), 100);
    }
  }, [selectedIds, newsletterActions, preserveFilterParams, clearSelection]);

  const handleBulkMarkAsUnread = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsActionInProgress(true);

    try {
      const ids = Array.from(selectedIds);
      await newsletterActions.handleBulkMarkAsUnread(ids);
      preserveFilterParams();
      clearSelection();
    } finally {
      setTimeout(() => setIsActionInProgress(false), 100);
    }
  }, [selectedIds, newsletterActions, preserveFilterParams, clearSelection]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsActionInProgress(true);

    try {
      const ids = Array.from(selectedIds);
      await newsletterActions.handleBulkArchive(ids);
      preserveFilterParams();
      clearSelection();
    } finally {
      setTimeout(() => setIsActionInProgress(false), 100);
    }
  }, [selectedIds, newsletterActions, preserveFilterParams, clearSelection]);

  const handleBulkUnarchive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsActionInProgress(true);

    try {
      const ids = Array.from(selectedIds);
      await newsletterActions.handleBulkUnarchive(ids);
      preserveFilterParams();
      clearSelection();
    } finally {
      setTimeout(() => setIsActionInProgress(false), 100);
    }
  }, [selectedIds, newsletterActions, preserveFilterParams, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${selectedIds.size} newsletter(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsActionInProgress(true);

    try {
      const ids = Array.from(selectedIds);
      await newsletterActions.handleBulkDelete(ids);
      preserveFilterParams();
      clearSelection();
    } finally {
      setTimeout(() => setIsActionInProgress(false), 100);
    }
  }, [selectedIds, newsletterActions, preserveFilterParams, clearSelection]);

  // Individual newsletter handlers
  const handleNewsletterClick = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      try {
        // Mark as read if unread
        if (!newsletter.is_read) {
          try {
            await newsletterActions.handleToggleRead(newsletter);
          } catch (readError) {
            console.error("Failed to mark newsletter as read:", readError);
          }
        }

        // Archive the newsletter when opened from the inbox
        if (!newsletter.is_archived) {
          try {
            await newsletterActions.handleToggleArchive(newsletter);
          } catch (archiveError) {
            console.error("Failed to archive newsletter:", archiveError);
          }
        }

        // Preserve filter parameters before navigation
        try {
          preserveFilterParams();
        } catch (filterError) {
          console.error("Failed to preserve filter parameters:", filterError);
        }

        // Navigate to the newsletter detail
        navigate(`/newsletters/${newsletter.id}`);
      } catch (error) {
        console.error("Unexpected error in newsletter click handler:", error);
        // Still navigate even if other actions fail
        navigate(`/newsletters/${newsletter.id}`);
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [navigate, newsletterActions, preserveFilterParams],
  );

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
          showError("Failed to find item in queue");
        }
      } catch (error) {
        handleError(error, {
          category: "business",
          severity: "medium",
          context: { action: "removeFromQueue", newsletterId },
        });
      }
    },
    [readingQueue, removeFromQueue, refetchNewsletters, showError, handleError],
  );

  // Tag visibility toggle handler
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

  // Tag error handling
  const handleDismissTagError = useCallback(() => {
    setTagUpdateError(null);
  }, []);

  // Newsletter prefetching on hover
  const handleNewsletterMouseEnter = useCallback(
    (newsletter: NewsletterWithRelations) => {
      // Only prefetch if the newsletter is unread (more likely to be opened)
      // or if it's not archived (archived newsletters are less likely to be opened)
      if (!newsletter.is_read || !newsletter.is_archived) {
        // Prefetch newsletter details for better performance
        // This could be implemented with a prefetch hook if available
      }
    },
    [],
  );

  const handleToggleLikeWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      // Optimistic update for liked filter
      if (filter === "liked") {
        setStableNewsletters((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((n) => n.id === newsletter.id);
          if (index > -1) {
            const updatedNewsletter = { ...updated[index], is_liked: true };
            updated.splice(index, 1);
            updated.unshift(updatedNewsletter);
            return updated;
          }
          return prev;
        });
      }

      try {
        await newsletterActions.handleToggleLike(newsletter);
        preserveFilterParams();
        // Dispatch event for unread count updates
        window.dispatchEvent(new CustomEvent("newsletter:like-status-changed"));
      } catch (error) {
        console.error("❌ toggleLike failed:", error);
        // Revert optimistic update on error
        if (filter === "liked") {
          await refetchNewsletters();
        }
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, filter, preserveFilterParams, refetchNewsletters],
  );

  const handleToggleArchiveWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      const isCurrentlyArchived = newsletter.is_archived;
      const willBeArchived = !isCurrentlyArchived;

      // Optimistic update based on current state
      if (filter === "archived") {
        if (isCurrentlyArchived) {
          // Unarchiving in archive view - remove from list
          setStableNewsletters((prev) =>
            prev.filter((n) => n.id !== newsletter.id),
          );
        } else {
          // Archiving in archive view - add to top
          setStableNewsletters((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((n) => n.id === newsletter.id);
            if (index > -1) {
              const updatedNewsletter = {
                ...updated[index],
                is_archived: true,
              };
              updated.splice(index, 1);
              updated.unshift(updatedNewsletter);
              return updated;
            }
            return prev;
          });
        }
      } else if (!isCurrentlyArchived && willBeArchived) {
        // Archiving in non-archive view - remove from current view
        setStableNewsletters((prev) =>
          prev.filter((n) => n.id !== newsletter.id),
        );
      }

      try {
        await newsletterActions.handleToggleArchive(newsletter);
        preserveFilterParams();
      } catch (error) {
        console.error("❌ toggleArchive failed:", error);
        // Revert optimistic update on error by refetching
        if (isCurrentlyArchived) {
          // Restore newsletter to list if unarchive failed
          setStableNewsletters((prev) => [newsletter, ...prev]);
        } else if (!isCurrentlyArchived && willBeArchived) {
          // Restore newsletter to list if archive failed
          setStableNewsletters((prev) => [newsletter, ...prev]);
        }
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, filter, preserveFilterParams],
  );

  const handleToggleReadWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleToggleRead(newsletter);
        preserveFilterParams();
      } catch (error) {
        console.error("❌ toggleRead failed:", error);
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams],
  );

  const handleDeleteNewsletterWrapper = useCallback(
    async (newsletterId: string) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleDeleteNewsletter(newsletterId);
        preserveFilterParams();
      } catch (error) {
        console.error("❌ deleteNewsletter failed:", error);
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams],
  );

  const handleToggleQueueWrapper = useCallback(
    async (newsletter: NewsletterWithRelations, isInQueue: boolean) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleToggleInQueue(newsletter, isInQueue);
        preserveFilterParams();
      } catch (error) {
        console.error("❌ toggleInQueue failed:", error);
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams],
  );

  // Newsletter row action handlers
  const createNewsletterRowActions = useCallback(
    (newsletter: NewsletterWithRelations, isInQueue: boolean) => ({
      onToggleSelect: () => toggleSelect(newsletter.id),
      onToggleLike: () => handleToggleLikeWrapper(newsletter),
      onToggleArchive: () => handleToggleArchiveWrapper(newsletter),
      onToggleRead: () => handleToggleReadWrapper(newsletter),
      onTrash: () => handleDeleteNewsletterWrapper(newsletter.id),
      onToggleQueue: () => handleToggleQueueWrapper(newsletter, isInQueue),
      onUpdateTags: async (newsletterId: string, tagIds: string[]) => {
        setIsActionInProgress(true);

        try {
          setTagUpdateError(null);
          await newsletterActions.handleUpdateTags(newsletterId, tagIds);
          preserveFilterParams();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to update tags";
          setTagUpdateError(errorMessage);
          throw error;
        } finally {
          setTimeout(() => setIsActionInProgress(false), 100);
        }
      },
      onToggleTagVisibility: toggleTagVisibility,
      onTagClick: (tag: Tag) => handleTagClick(tag.id),
      onRemoveFromQueue: (e: React.MouseEvent) =>
        handleRemoveFromQueue(e, newsletter.id),
      onRowClick: (newsletter: NewsletterWithRelations) =>
        handleNewsletterClick(newsletter),
      onMouseEnter: handleNewsletterMouseEnter,
    }),
    [
      toggleSelect,
      handleToggleLikeWrapper,
      handleToggleArchiveWrapper,
      handleToggleReadWrapper,
      handleDeleteNewsletterWrapper,
      handleToggleQueueWrapper,
      newsletterActions,
      preserveFilterParams,
      toggleTagVisibility,
      handleTagClick,
      handleRemoveFromQueue,
      handleNewsletterClick,
      handleNewsletterMouseEnter,
      setTagUpdateError,
    ],
  );

  // Cache warming effects
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (cacheManager && user?.id) {
      cacheManager.warmCache(user.id, "high");
    }
  }, [cacheManager, user?.id]);

  // Loading state
  if (isLoadingNewsletters && newsletters.length === 0) {
    return <LoadingScreen />;
  }

  // Error state
  if (errorNewsletters) {
    return <ErrorState error={errorNewsletters} onRetry={refetchNewsletters} />;
  }

  const showArchived = filter === "archived";

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
          <div className="flex items-center gap-2">
            <InboxFilters
              filter={filter}
              sourceFilter={sourceFilter}
              timeRange={timeRange}
              newsletterSources={newsletterSources}
              onFilterChange={setFilter}
              onSourceFilterChange={setSourceFilter}
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

      {/* Bulk Selection Actions */}
      {isSelecting && (
        <div className="mt-2">
          <BulkSelectionActions
            selectedCount={selectedIds.size}
            totalCount={newsletters.length}
            showArchived={showArchived}
            isBulkActionLoading={bulkLoadingStates.isBulkActionInProgress}
            onSelectAll={toggleSelectAll}
            onSelectRead={selectRead}
            onSelectUnread={selectUnread}
            onMarkAsRead={handleBulkMarkAsRead}
            onMarkAsUnread={handleBulkMarkAsUnread}
            onArchive={handleBulkArchive}
            onUnarchive={handleBulkUnarchive}
            onDelete={handleBulkDelete}
            onCancel={clearSelection}
          />
        </div>
      )}

      {/* Selected Tags Display */}
      <SelectedTagsDisplay
        selectedTags={selectedTags}
        onRemoveTag={removeTag}
        onClearAll={resetFilters}
      />

      {/* Newsletter List */}
      <div
        className={`${selectedTags.length > 0 ? "pt-2" : "pt-6"} px-6 pb-6 overflow-auto`}
      >
        {isLoadingNewsletters && newsletters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-base text-neutral-400">Loading newsletters...</p>
          </div>
        ) : newsletters.length === 0 ? (
          <EmptyState filter={filter} sourceFilter={sourceFilter} />
        ) : (
          newsletters.map((newsletter) => {
            const newsletterWithRelations: NewsletterWithRelations = {
              ...newsletter,
              newsletter_source_id: newsletter.newsletter_source_id || null,
              source: newsletter.source || null,
              tags: newsletter.tags || [],
              is_archived: newsletter.is_archived || false,
            };

            const isInQueue = readingQueue.some(
              (item) => item.newsletter_id === newsletter.id,
            );

            const rowActions = createNewsletterRowActions(
              newsletterWithRelations,
              isInQueue,
            );

            return (
              <NewsletterRow
                key={stableKeys.get(newsletter.id) || newsletter.id}
                newsletter={newsletterWithRelations}
                isSelected={isSelecting && selectedIds.has(newsletter.id)}
                showCheckbox={isSelecting}
                showTags
                isInReadingQueue={isInQueue}
                readingQueue={readingQueue}
                visibleTags={visibleTags}
                isDeletingNewsletter={newsletterActions.isDeletingNewsletter}
                loadingStates={{}} // Loading states now managed by actions
                errorTogglingLike={null} // Errors now handled by error context
                isUpdatingTags={newsletterActions.isUpdatingTags}
                tagUpdateError={tagUpdateError}
                onDismissTagError={handleDismissTagError}
                {...rowActions}
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
