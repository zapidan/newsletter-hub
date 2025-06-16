import React, { memo, useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../common/contexts/ToastContext";
import { NewsletterWithRelations } from "../../common/types";
import { useInfiniteNewsletters } from "../../common/hooks/infiniteScroll";
import { useInboxFilters } from "../../common/hooks/useInboxFilters";
import { useReadingQueue } from "../../common/hooks/useReadingQueue";
import { useErrorHandling } from "../../common/hooks/useErrorHandling";
import { useBulkLoadingStates } from "../../common/hooks/useLoadingStates";
import { useSharedNewsletterActions } from "../../common/hooks/useSharedNewsletterActions";
import { toast } from "react-hot-toast";
import { InfiniteNewsletterList } from "../components/InfiniteScroll";
import { InboxFilters } from "../components/InboxFilters";
import BulkSelectionActions from "../components/BulkSelectionActions";

const SelectedTagsDisplay: React.FC<{
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onRemoveTag: (tagId: string) => void;
  onClearAll: () => void;
}> = memo(({ selectedTags, onRemoveTag, onClearAll }) => {
  if (selectedTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-4 bg-blue-50 rounded-lg">
      <span className="text-sm font-medium text-blue-900">Active filters:</span>
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs font-medium border border-blue-200"
          style={{ color: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => onRemoveTag(tag.id)}
            className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            ×
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        Clear all
      </button>
    </div>
  );
});

const EmptyState: React.FC<{
  filter: string;
  sourceFilter: string | null;
}> = memo(({ filter, sourceFilter }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-gray-400 mb-4">
      <svg
        className="w-16 h-16 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2m16-7H4m16 0l-2-2m-12 2l2-2"
        />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      {filter === "all" && !sourceFilter
        ? "No newsletters yet"
        : `No ${filter === "all" ? "" : filter} newsletters found`}
    </h3>
    <p className="text-sm text-gray-500 max-w-md">
      {filter === "all" && !sourceFilter
        ? "Subscribe to some newsletter sources to see content here."
        : "Try adjusting your filters or check back later for new content."}
    </p>
  </div>
));

const ErrorState: React.FC<{
  error: Error;
  onRetry: () => void;
}> = memo(({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-red-500 mb-4">
      <svg
        className="w-16 h-16 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <p className="text-lg font-medium text-gray-900 mb-2">
        Something went wrong
      </p>
      <p className="text-sm text-gray-500 mb-4">
        {error.message || "Failed to load newsletters"}
      </p>
    </div>
    <button
      onClick={onRetry}
      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
    >
      Try Again
    </button>
  </div>
));

const Inbox: React.FC = memo(() => {
  const navigate = useNavigate();
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

  // Infinite newsletter data
  const {
    newsletters,
    isLoading,
    isLoadingMore,
    error: errorNewsletters,
    hasNextPage,
    fetchNextPage,
    refetch: refetchNewsletters,
    totalCount,
  } = useInfiniteNewsletters(newsletterFilter, {
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    pageSize: 25, // Load 25 newsletters per page
    debug: process.env.NODE_ENV === "development",
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

  // Shared newsletter action handlers
  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleDeleteNewsletter,
    handleToggleInQueue,
    handleUpdateTags: sharedHandleUpdateTags,
    isUpdatingTags,
    handleBulkMarkAsRead,
    handleBulkMarkAsUnread,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkDelete,
  } = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
    onSuccess: () => {
      // Success handled by shared handlers
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  // Selection state (local to component since it's UI-only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Tag visibility state
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());

  // Tag error handling state
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

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

  // Create wrapper functions for bulk actions to handle selection state
  const handleBulkMarkAsReadWrapper = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await handleBulkMarkAsRead(ids);
      preserveFilterParams();
      clearSelection();
    } catch (error) {
      handleError(error, {
        category: "business",
        severity: "medium",
        context: { action: "bulkMarkAsRead", ids: Array.from(selectedIds) },
      });
    }
  }, [
    selectedIds,
    handleBulkMarkAsRead,
    preserveFilterParams,
    clearSelection,
    handleError,
  ]);

  const handleBulkMarkAsUnreadWrapper = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await handleBulkMarkAsUnread(ids);
      preserveFilterParams();
      clearSelection();
    } catch (error) {
      handleError(error, {
        category: "business",
        severity: "medium",
        context: { action: "bulkMarkAsUnread", ids: Array.from(selectedIds) },
      });
    }
  }, [
    selectedIds,
    handleBulkMarkAsUnread,
    preserveFilterParams,
    clearSelection,
    handleError,
  ]);

  const handleBulkArchiveWrapper = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await handleBulkArchive(ids);
      preserveFilterParams();
      clearSelection();
    } catch (error) {
      handleError(error, {
        category: "business",
        severity: "medium",
        context: { action: "bulkArchive", ids: Array.from(selectedIds) },
      });
    }
  }, [
    selectedIds,
    handleBulkArchive,
    preserveFilterParams,
    clearSelection,
    handleError,
  ]);

  const handleBulkUnarchiveWrapper = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await handleBulkUnarchive(ids);
      preserveFilterParams();
      clearSelection();
    } catch (error) {
      handleError(error, {
        category: "business",
        severity: "medium",
        context: { action: "bulkUnarchive", ids: Array.from(selectedIds) },
      });
    }
  }, [
    selectedIds,
    handleBulkUnarchive,
    preserveFilterParams,
    clearSelection,
    handleError,
  ]);

  const handleBulkDeleteWrapper = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await handleBulkDelete(ids);
      preserveFilterParams();
      clearSelection();
    } catch (error) {
      handleError(error, {
        category: "business",
        severity: "high",
        context: { action: "bulkDelete", ids: Array.from(selectedIds) },
      });
    }
  }, [
    selectedIds,
    handleBulkDelete,
    preserveFilterParams,
    clearSelection,
    handleError,
  ]);

  // Individual newsletter handlers
  const handleNewsletterClick = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        // Mark as read if unread
        if (!newsletter.is_read) {
          try {
            await handleToggleRead(newsletter);
          } catch (readError) {
            console.error("Failed to mark newsletter as read:", readError);
          }
        }

        // Archive the newsletter when opened from the inbox
        if (!newsletter.is_archived) {
          try {
            await handleToggleArchive(newsletter);
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
      }
    },
    [navigate, handleToggleRead, handleToggleArchive, preserveFilterParams],
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

  // Use shared actions for tag updates (matching newsletters page pattern)
  const handleUpdateTags = useCallback(
    async (newsletterId: string, tagIds: string[]): Promise<void> => {
      try {
        setTagUpdateError(null);
        await sharedHandleUpdateTags(newsletterId, tagIds);
        preserveFilterParams();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update tags";
        setTagUpdateError(errorMessage);
        toast.error("Failed to update tags");
      }
    },
    [sharedHandleUpdateTags, preserveFilterParams],
  );

  // Handle load more for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isLoadingMore) {
      fetchNextPage();
    }
  }, [hasNextPage, isLoadingMore, fetchNextPage]);

  // Handle retry for infinite scroll
  const handleRetry = useCallback(() => {
    refetchNewsletters();
  }, [refetchNewsletters]);

  // Loading state
  if (isLoading && newsletters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-base text-neutral-400">Loading newsletters...</p>
      </div>
    );
  }

  // Error state for initial load
  if (errorNewsletters && newsletters.length === 0) {
    return <ErrorState error={errorNewsletters} onRetry={handleRetry} />;
  }

  const showArchived = filter === "archived";

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
            {totalCount > 0 && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {newsletters.length} of {totalCount} loaded
              </span>
            )}
          </div>
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
            onMarkAsRead={handleBulkMarkAsReadWrapper}
            onMarkAsUnread={handleBulkMarkAsUnreadWrapper}
            onArchive={handleBulkArchiveWrapper}
            onUnarchive={handleBulkUnarchiveWrapper}
            onDelete={handleBulkDeleteWrapper}
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

      {/* Newsletter List with Infinite Scroll */}
      <div className={`${selectedTags.length > 0 ? "pt-2" : "pt-6"} px-6 pb-6`}>
        {newsletters.length === 0 && !isLoading ? (
          <EmptyState filter={filter} sourceFilter={sourceFilter} />
        ) : (
          <InfiniteNewsletterList
            newsletters={newsletters}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasNextPage={hasNextPage}
            totalCount={totalCount}
            error={errorNewsletters}
            onLoadMore={handleLoadMore}
            onRetry={handleRetry}
            // Selection state
            selectedIds={selectedIds}
            isSelecting={isSelecting}
            readingQueue={readingQueue}
            visibleTags={visibleTags}
            // Newsletter actions
            onRowClick={handleNewsletterClick}
            onToggleSelect={toggleSelect}
            onToggleLike={handleToggleLike}
            onToggleArchive={(id: string) => {
              const newsletter = newsletters.find((n) => n.id === id);
              if (newsletter) handleToggleArchive(newsletter);
            }}
            onToggleRead={(id: string) => {
              const newsletter = newsletters.find((n) => n.id === id);
              if (newsletter) handleToggleRead(newsletter);
            }}
            onTrash={handleDeleteNewsletter}
            onToggleQueue={(newsletterId: string) => {
              const newsletter = newsletters.find((n) => n.id === newsletterId);
              const isInQueue = readingQueue.some(
                (item) => item.newsletter_id === newsletterId,
              );
              if (newsletter) handleToggleInQueue(newsletter, isInQueue);
            }}
            onUpdateTags={handleUpdateTags}
            onToggleTagVisibility={toggleTagVisibility}
            onTagClick={handleTagClick}
            onRemoveFromQueue={handleRemoveFromQueue}
            onMouseEnter={handleNewsletterMouseEnter}
            // Loading states
            isDeletingNewsletter={() => false}
            isUpdatingTags={() => isUpdatingTags}
            loadingStates={{}}
            // Error states
            errorTogglingLike={null}
            tagUpdateError={tagUpdateError}
            onDismissTagError={handleDismissTagError}
            // Display options
            showTags={true}
            showCheckbox={isSelecting}
            // Infinite scroll options
            threshold={0.1}
            rootMargin="100px"
            className="max-w-none"
          />
        )}
      </div>
    </div>
  );
});

export default Inbox;
