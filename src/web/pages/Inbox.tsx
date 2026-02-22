import { Mail } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import BulkSelectionActions from '@web/components/BulkSelectionActions';
import { InboxFilters } from '@web/components/InboxFilters';

import LoadingScreen from '@common/components/common/LoadingScreen';
import { InfiniteNewsletterList } from '@web/components/InfiniteScroll';

import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll';
import { useErrorHandling } from '@common/hooks/useErrorHandling';
import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useBulkLoadingStates } from '@common/hooks/useLoadingStates';
import { useNewsletters } from '@common/hooks/useNewsletters';
import { useNewsletterSourceGroups } from '@common/hooks/useNewsletterSourceGroups';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useGroupCounts } from '@web/hooks/useGroupCounts';
import { parseFilterUrlParams, syncFilterUrl } from '@web/utils/filterUrlUtils';

import { useAuth } from '@common/contexts';
import { useToast } from '@common/contexts/ToastContext';
import { useLogger } from '@common/utils/logger/useLogger';
import { SelectedFiltersDisplay } from '@web/components/SelectedFiltersDisplay';
import SelectedTagsDisplay from '@web/components/SelectedTagsDisplay';

import type { NewsletterWithRelations, Tag } from '@common/types';
import { getCacheManager } from '@common/utils/cacheUtils';

// Separate component for empty state
const EmptyState: React.FC<{
  filter: string;
  sourceFilter: string | null;
}> = memo(({ filter, sourceFilter }) => {
  const getEmptyMessage = () => {
    if (filter === 'unread') return 'No unread newsletters';
    if (filter === 'liked') return 'No liked newsletters';
    if (filter === 'archived') return 'No archived newsletters';
    if (sourceFilter) return 'No newsletters found for this source';
    return 'No newsletters found';
  };

  const getEmptyDescription = () => {
    if (sourceFilter) {
      return 'Try selecting a different source or adjusting your filters.';
    }
    return 'Try adjusting your filters or check back later.';
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
      <h2 className="text-2xl font-semibold text-neutral-800 mb-2">Error Loading Newsletters</h2>
      <p className="text-neutral-600 mb-6">
        {error?.message || 'Something went wrong. Please try again later.'}
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
const Inbox: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useToast();
  const log = useLogger();

  // Filter management using our new context and hooks
  const {
    filter,
    setFilter,
    sourceFilter,
    setSourceFilter,
    timeRange,
    _tagIds,
    debouncedTagIds,
    _pendingTagUpdates,
    visibleTags,
    setVisibleTags,
    allTags,
    groupFilters,
    sortBy,
    sortOrder,
    _newsletterFilter,
    _hasActiveFilters,
    _isFilterActive,
    useLocalTagFiltering,
    newsletterSources,
    isLoadingSources,
    setTimeRange,
    _setTagIds,
    _setPendingTagUpdates,
    _toggleTag,
    _addTag,
    removeTag,
    resetFilters,
    _updateTagDebounced,
    handleTagClick,
    setGroupFilters,
    _toggleGroup,
    _addGroup,
    _removeGroup,
    _clearGroups,
    setSortBy,
    setSortOrder,
  } = useInboxFilters();

  // Group filters state (multi-select)
  const { groups: newsletterGroups = [], isLoading: isLoadingGroups } = useNewsletterSourceGroups();


  // Helper function to preserve URL parameters after actions
  const preserveFilterParams = useCallback(() => {
    const currentParams = parseFilterUrlParams(new URLSearchParams(window.location.search));
    syncFilterUrl(
      currentParams,
      filter,
      sourceFilter,
      groupFilters,
      debouncedTagIds,
      timeRange
    );
  }, [filter, sourceFilter, groupFilters, timeRange, debouncedTagIds]);

  // When group(s) are selected, clear source filter; when source is selected, clear group filters
  const handleSourceFilterChange = useCallback(
    (sourceId: string | null) => {
      setGroupFilters([]);
      setSourceFilter(sourceId);
    },
    [setGroupFilters, setSourceFilter] // Added setSourceFilter as required by linter
  );

  const handleGroupFiltersChange = useCallback(
    (groupIds: string[]) => {
      setSourceFilter(null);
      setGroupFilters(groupIds);
    },
    [setGroupFilters, setSourceFilter] // Added setSourceFilter as required by linter
  );

  // Handle filter changes while preserving group filters in URL
  const handleFilterChange = useCallback(
    (newFilter: string) => {
      setFilter(newFilter as InboxFilterType); // Type assertion to handle string to InboxFilterType conversion
      // Sync URL parameters with current state including group filters
      const currentParams = parseFilterUrlParams(new URLSearchParams(window.location.search));
      syncFilterUrl(
        currentParams,
        newFilter,
        sourceFilter,
        groupFilters,
        debouncedTagIds,
        timeRange
      );
    },
    [sourceFilter, groupFilters, debouncedTagIds, timeRange, setFilter] // Added setFilter back as dependency
  );

  // Handle time range changes while preserving group filters in URL
  const handleTimeRangeChange = useCallback(
    (newTimeRange: string) => {
      setTimeRange(newTimeRange as TimeRange); // Type assertion to handle string to TimeRange conversion
      // Sync URL parameters with current state including group filters
      const currentParams = parseFilterUrlParams(new URLSearchParams(window.location.search));
      syncFilterUrl(
        currentParams,
        filter,
        sourceFilter,
        groupFilters,
        debouncedTagIds,
        newTimeRange
      );
    },
    [filter, sourceFilter, groupFilters, debouncedTagIds, setTimeRange]
  );


  // Compute source IDs for the selected groups (union)
  const selectedGroupSourceIds = useMemo(() => {
    // Return undefined if no groups are selected
    if (!groupFilters || groupFilters.length === 0) {
      return undefined;
    }

    // Wait for groups to load before converting
    if (isLoadingGroups || newsletterGroups.length === 0) {
      return undefined;
    }

    const idSet = new Set<string>();
    groupFilters.forEach((gid) => {
      const g = newsletterGroups.find((x) => x.id === gid);
      g?.sources?.forEach((s) => idSet.add(s.id));
    });

    const sourceIds = Array.from(idSet);
    return sourceIds.length > 0 ? sourceIds : undefined;
  }, [groupFilters, newsletterGroups, isLoadingGroups]);

  // Newsletter filter from context
  const { newsletterFilter: contextNewsletterFilter } = useInboxFilters();

  // Stabilize the newsletter filter to prevent unnecessary re-renders
  const stableNewsletterFilter = useMemo(() => {
    let filterObj = {
      ...contextNewsletterFilter,
      tagIds: contextNewsletterFilter.tagIds ? [...contextNewsletterFilter.tagIds] : undefined,
      sourceIds: contextNewsletterFilter.sourceIds
        ? [...contextNewsletterFilter.sourceIds]
        : undefined,
    };
    if (groupFilters.length > 0 && selectedGroupSourceIds) {
      filterObj = {
        ...filterObj,
        sourceIds: selectedGroupSourceIds,
      };
    }

    return filterObj;
  }, [
    contextNewsletterFilter,
    groupFilters,
    selectedGroupSourceIds,
  ]);

  // Newsletter data with infinite scroll
  const {
    newsletters: rawNewsletters,
    isLoading: isLoadingNewsletters,
    isLoadingMore,
    error: errorNewsletters,
    hasNextPage,
    fetchNextPage,
    refetch: refetchNewsletters,
    totalCount,
  } = useInfiniteNewsletters(stableNewsletterFilter, {
    _refetchOnWindowFocus: false,
    _refetchOnMount: useLocalTagFiltering && debouncedTagIds.length > 0, // Force refetch when tags are selected
    _staleTime: 0,
    pageSize: 25,
    debug: process.env.NODE_ENV === 'development',
  });

  // Apply client-side tag filtering when useLocalTagFiltering is enabled
  const newsletters = useMemo(() => {
    if (!useLocalTagFiltering || !debouncedTagIds.length) {
      // Debug: No client-side filtering needed
      if (process.env.NODE_ENV === 'development' && debouncedTagIds.length > 0) {
        console.log('[Inbox] Skipping client-side filtering:', {
          useLocalTagFiltering,
          tagCount: debouncedTagIds.length,
          rawCount: rawNewsletters.length,
        });
      }
      return rawNewsletters;
    }

    const filtered = rawNewsletters.filter((newsletter) => {
      const newsletterTagIds = newsletter.tags?.map((tag) => tag.id) || [];
      return debouncedTagIds.every((requiredTagId) => newsletterTagIds.includes(requiredTagId));
    });

    // Debug: Log client-side filtering results
    if (process.env.NODE_ENV === 'development') {
      console.log('[Inbox] Client-side tag filtering applied:', {
        filter,
        requiredTags: debouncedTagIds,
        rawCount: rawNewsletters.length,
        filteredCount: filtered.length,
        sampleRawNewsletter: rawNewsletters[0]
          ? {
            id: rawNewsletters[0].id,
            title: rawNewsletters[0].title?.substring(0, 50),
            tags: rawNewsletters[0].tags?.map((t) => ({ id: t.id, name: t.name })),
          }
          : null,
        sampleFiltered: filtered[0]
          ? {
            id: filtered[0].id,
            title: filtered[0].title?.substring(0, 50),
            tags: filtered[0].tags?.map((t) => ({ id: t.id, name: t.name })),
          }
          : null,
      });
    }

    return filtered;
  }, [rawNewsletters, useLocalTagFiltering, debouncedTagIds, filter]);

  // Prepare group dropdown data with correct counts based on current filter (server-aligned)
  const groupCountsBaseFilter = useMemo(
    () => ({
      search: contextNewsletterFilter.search,
      isRead: contextNewsletterFilter.isRead,
      isArchived: contextNewsletterFilter.isArchived,
      isLiked: contextNewsletterFilter.isLiked,
      tagIds: contextNewsletterFilter.tagIds,
      dateFrom: contextNewsletterFilter.dateFrom,
      dateTo: contextNewsletterFilter.dateTo,
    }),
    [
      contextNewsletterFilter.search,
      contextNewsletterFilter.isRead,
      contextNewsletterFilter.isArchived,
      contextNewsletterFilter.isLiked,
      contextNewsletterFilter.tagIds,
      contextNewsletterFilter.dateFrom,
      contextNewsletterFilter.dateTo,
    ]
  );

  const groupCounts = useGroupCounts(newsletterGroups, groupCountsBaseFilter);
  const groupsForDropdown = useMemo(
    () => newsletterGroups.map((g) => ({ id: g.id, name: g.name, count: groupCounts[g.id] ?? 0 })),
    [newsletterGroups, groupCounts]
  );

  // Reading queue
  const { readingQueue = [], removeFromQueue } = useReadingQueue() || {};

  // Error handling
  const { handleError } = useErrorHandling({
    enableToasts: true,
    enableLogging: true,
  });

  // Loading states for bulk operations
  const bulkLoadingStates = useBulkLoadingStates();

  // Get newsletter mutations from useNewsletters hook (new onMutate handlers)
  const {
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkArchive,
    bulkUnarchive,
    bulkDeleteNewsletters,
    updateNewsletterTags,
  } = useNewsletters();

  // Memoize mutations object to prevent unnecessary re-renders
  const mutations = useMemo(
    () => ({
      markAsRead,
      markAsUnread,
      toggleLike,
      toggleArchive,
      deleteNewsletter,
      toggleInQueue,
      bulkMarkAsRead,
      bulkMarkAsUnread,
      bulkArchive,
      bulkUnarchive,
      bulkDeleteNewsletters,
      updateNewsletterTags,
    }),
    [
      markAsRead,
      markAsUnread,
      toggleLike,
      toggleArchive,
      deleteNewsletter,
      toggleInQueue,
      bulkMarkAsRead,
      bulkMarkAsUnread,
      bulkArchive,
      bulkUnarchive,
      bulkDeleteNewsletters,
      updateNewsletterTags,
    ]
  );

  // Shared newsletter actions with our enhanced version
  const newsletterActions = useSharedNewsletterActions(mutations, {
    showToasts: true,
    optimisticUpdates: true,
    enableErrorHandling: true,
    enableLoadingStates: true,
    onSuccess: useCallback(() => {
      // Trigger any additional success handling
    }, []),
    onError: handleError,
  });

  // Selection state (local to component since it's UI-only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Tag error handling state
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

  // Action progress state to prevent refetching during actions
  const [_isActionInProgress, setIsActionInProgress] = useState(false);

  // Get selected tag objects for display
  const selectedTags = useMemo(() => {
    return debouncedTagIds
      .map((tagId) => allTags.find((tag) => tag.id === tagId))
      .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined);
  }, [allTags, debouncedTagIds]);

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

  // Memoized bulk action handlers with optimistic updates
  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    setIsActionInProgress(true);

    try {
      await newsletterActions.handleBulkMarkAsRead(ids);
      clearSelection();
    } finally {
      setIsActionInProgress(false);
    }
  }, [selectedIds, newsletterActions, clearSelection]);

  const handleBulkMarkAsUnread = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    setIsActionInProgress(true);

    try {
      await newsletterActions.handleBulkMarkAsUnread(ids);
      clearSelection();
    } finally {
      setIsActionInProgress(false);
    }
  }, [selectedIds, newsletterActions, clearSelection]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    setIsActionInProgress(true);

    try {
      await newsletterActions.handleBulkArchive(ids);
      clearSelection();
    } finally {
      setIsActionInProgress(false);
    }
  }, [selectedIds, newsletterActions, clearSelection]);

  const handleBulkUnarchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    setIsActionInProgress(true);

    try {
      await newsletterActions.handleBulkUnarchive(ids);
      clearSelection();
    } finally {
      setIsActionInProgress(false);
    }
  }, [selectedIds, newsletterActions, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${selectedIds.size} newsletter(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    const ids = Array.from(selectedIds);
    setIsActionInProgress(true);

    try {
      await newsletterActions.handleBulkDelete(ids);
      clearSelection();
    } finally {
      setIsActionInProgress(false);
    }
  }, [selectedIds, newsletterActions, clearSelection]);

  // Individual newsletter handlers with optimistic updates
  const handleNewsletterClick = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      // Navigate immediately to avoid async issues
      // Build URL with query parameters to preserve filter context
      const params = new URLSearchParams();

      // Set separate read/unread and archived/unarchived parameters
      if (filter === 'unread') {
        params.set('isRead', 'false');
        params.set('isArchived', 'false');
      } else if (filter === 'read') {
        params.set('isRead', 'true');
        params.set('isArchived', 'false');
      } else if (filter === 'archived') {
        params.set('isArchived', 'true');
      } else if (filter === 'liked') {
        params.set('filter', 'liked'); // Keep filter parameter for liked
      }

      // Also keep the original filter parameter for backward compatibility
      if (filter && filter !== 'unread') {
        params.set('filter', filter);
      } else if (filter === 'unread') {
        // Explicitly set unread filter in URL for navigation
        params.set('filter', 'unread');
      }

      if (sourceFilter) {
        params.set('source', sourceFilter);
      }
      // Multi-group param support
      if (groupFilters && groupFilters.length > 0) {
        params.set('groups', groupFilters.join(','));
      }
      if (timeRange && timeRange !== 'all') {
        params.set('time', timeRange);
      }
      if (debouncedTagIds && debouncedTagIds.length > 0) {
        params.set('tags', debouncedTagIds.join(','));
      }

      const queryString = params.toString();
      const targetPath = `/newsletters/${newsletter.id}${queryString ? `?${queryString}` : ''}`;

      log.debug('Navigating to newsletter detail immediately', {
        action: 'navigate_to_detail',
        metadata: {
          newsletterId: newsletter.id,
          targetPath,
          currentPath: window.location.pathname,
          queryString,
        },
      });

      navigate(targetPath, {
        state: {
          from: '/inbox',
          fromInbox: true,
          currentFilter: filter,
          sourceFilter: sourceFilter,
          timeRange: timeRange,
          tagIds: debouncedTagIds,
        },
      });

      // Perform actions after navigation (they will continue in background)
      try {
        // Perform optimistic updates simultaneously for better UX
        const actions = [];

        // Mark as read if unread (optimistic)
        if (!newsletter.is_read) {
          actions.push(newsletterActions.handleMarkAsRead(newsletter.id));
        }

        // Archive the newsletter when opened from the inbox (optimistic)
        // But only if we're not in a filtered view that would hide it
        const shouldArchive =
          !newsletter.is_archived &&
          // Don't auto-archive if we're viewing archived newsletters
          filter !== 'archived' &&
          // Don't auto-archive if we're on a filter that would hide this newsletter
          // when it gets archived (like 'unread' for read newsletters, 'liked' for unliked newsletters)
          !(filter === 'unread' && newsletter.is_read) &&
          !(filter === 'liked' && !newsletter.is_liked);

        if (shouldArchive) {
          actions.push(newsletterActions.handleToggleArchive(newsletter));
        }

        // Execute actions in parallel for better performance
        if (actions.length > 0) {
          try {
            await Promise.allSettled(actions);
            log.debug('Newsletter actions completed successfully', {
              action: 'newsletter_actions_completed',
              metadata: {
                newsletterId: newsletter.id,
                actionsCount: actions.length,
                shouldArchive,
              },
            });
          } catch (actionError) {
            log.error(
              'Some newsletter actions failed during click',
              {
                action: 'newsletter_click_actions',
                metadata: {
                  newsletterId: newsletter.id,
                  actionsCount: actions.length,
                  shouldArchive,
                },
              },
              actionError instanceof Error ? actionError : new Error(String(actionError))
            );
          }
        }

        // Preserve filter parameters after navigation
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Unexpected error in newsletter click handler',
          {
            action: 'newsletter_click',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [
      navigate,
      newsletterActions,
      preserveFilterParams,
      log,
      filter,
      sourceFilter,
      groupFilters,
      timeRange,
      debouncedTagIds
    ]
  );

  const handleRemoveFromQueue = useCallback(
    async (e: React.MouseEvent, newsletterId: string) => {
      e.stopPropagation();
      try {
        const queueItem = readingQueue.find((item) => item.newsletter_id === newsletterId);
        if (queueItem) {
          await removeFromQueue(queueItem.id);
          await refetchNewsletters();
        } else {
          showError('Failed to find item in queue');
        }
      } catch (error) {
        handleError(error, {
          category: 'business',
          severity: 'medium',
          context: { action: 'removeFromQueue', newsletterId },
        });
      }
    },
    [readingQueue, removeFromQueue, refetchNewsletters, showError, handleError]
  );

  // Tag visibility toggle handler
  const toggleTagVisibility = useCallback(async (id: string, e: React.MouseEvent) => {
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
  }, [setVisibleTags]);

  // Tag error handling
  const handleDismissTagError = useCallback(() => {
    setTagUpdateError(null);
  }, []);

  // Newsletter prefetching on hover
  const handleNewsletterMouseEnter = useCallback((newsletter: NewsletterWithRelations) => {
    // Only prefetch if the newsletter is unread (more likely to be opened)
    // or if it's not archived (archived newsletters are less likely to be opened)
    if (!newsletter.is_read || !newsletter.is_archived) {
      // Prefetch newsletter details for better performance
      // This could be implemented with a prefetch hook if available
    }
  }, []);

  const handleToggleLikeWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleToggleLike(newsletter);
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Failed to toggle like status',
          {
            action: 'toggle_like',
            metadata: { newsletterId: newsletter.id, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, filter, preserveFilterParams, log]
  );

  const handleToggleArchiveWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleToggleArchive(newsletter);
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Failed to toggle archive status',
          {
            action: 'toggle_archive',
            metadata: { newsletterId: newsletter.id, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams, filter, log]
  );

  const handleToggleReadWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      try {
        if (newsletter.is_read) {
          await newsletterActions.handleMarkAsUnread(newsletter.id);
        } else {
          await newsletterActions.handleMarkAsRead(newsletter.id);
        }
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Failed to toggle read status',
          {
            action: 'toggle_read',
            metadata: { newsletterId: newsletter.id, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams, filter, log]
  );

  const handleDeleteNewsletterWrapper = useCallback(
    async (newsletterId: string) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleDeleteNewsletter(newsletterId);
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Failed to delete newsletter',
          {
            action: 'delete_newsletter',
            metadata: { newsletterId, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams, filter, log]
  );

  const handleToggleQueueWrapper = useCallback(
    async (newsletter: NewsletterWithRelations, isInQueue: boolean) => {
      setIsActionInProgress(true);

      try {
        await newsletterActions.handleToggleInQueue(newsletter, isInQueue);
        preserveFilterParams();
      } catch (error) {
        log.error(
          'Failed to toggle queue status',
          {
            action: 'toggle_queue',
            metadata: { newsletterId: newsletter.id, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams, filter, log]
  );

  const handleUpdateTagsWrapper = useCallback(
    async (newsletterId: string, tagIds: string[]) => {
      try {
        setTagUpdateError(null);
        await newsletterActions.handleUpdateTags(newsletterId, tagIds);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update tags';
        setTagUpdateError(errorMessage);
        throw error;
      }
    },
    [newsletterActions]
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
      cacheManager.warmCache(user.id, 'high');
    }
  }, [cacheManager, user?.id]);

  // Initialize group filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupsParam = params.get('groups');
    if (groupsParam) {
      const ids = groupsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        setGroupFilters(ids);
        setSourceFilter(null);
      }
    }
  }, [setGroupFilters, setSourceFilter]); // Added back dependencies as required by linter

  // Create sources with unread counts for the filter dropdown
  const sourcesWithUnreadCounts = useMemo(() => {
    return newsletterSources.map(
      (source: NewsletterSource): NewsletterSourceWithCount => ({
        ...source,
        count: source.unread_count || 0,
      })
    );
  }, [newsletterSources]);

  // Loading state
  if (isLoadingNewsletters && newsletters.length === 0) {
    return <LoadingScreen />;
  }

  // Error state
  if (errorNewsletters) {
    return <ErrorState error={errorNewsletters} onRetry={refetchNewsletters} />;
  }

  const showArchived = filter === 'archived';

  return (
    <div className="px-0 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex flex-col w-full">
          <div className="flex justify-between items-center w-full">
            <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
          </div>
          {/* Filters below title */}
          <div className="mt-2 w-full">
            <InboxFilters
              filter={filter}
              sourceFilter={sourceFilter}
              groupFilters={groupFilters}
              timeRange={timeRange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              newsletterSources={sourcesWithUnreadCounts}
              newsletterGroups={groupsForDropdown}
              onFilterChange={handleFilterChange}
              onSourceFilterChange={handleSourceFilterChange}
              onGroupFiltersChange={handleGroupFiltersChange}
              onTimeRangeChange={handleTimeRangeChange}
              onSortByChange={setSortBy}
              onSortOrderChange={setSortOrder}
              isLoadingSources={isLoadingSources}
              isLoadingGroups={isLoadingGroups}
              showFilterCounts={true}
              onSelectClick={() => setIsSelecting(true)}
            />
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

      {/* Selected Groups Display */}
      <SelectedFiltersDisplay
        selectedGroups={groupFilters}
        groups={groupsForDropdown}
        onClearGroup={(gid) => {
          const newGroups = groupFilters.filter((id) => id !== gid);
          handleGroupFiltersChange(newGroups);
        }}
        onClearAll={() => handleGroupFiltersChange([])}
      />

      {/* Newsletter List with Infinite Scroll */}
      <div
        className={`${selectedTags.length > 0 ? 'pt-2' : 'pt-6'} pb-6 overflow-auto sm:px-6 px-0`}
      >
        {isLoadingNewsletters && rawNewsletters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-base text-neutral-400">Loading newsletters...</p>
          </div>
        ) : newsletters.length === 0 && !isLoadingNewsletters ? (
          <EmptyState filter={filter} sourceFilter={sourceFilter} />
        ) : (
          <InfiniteNewsletterList
            newsletters={newsletters}
            isLoading={isLoadingNewsletters}
            isLoadingMore={isLoadingMore}
            hasNextPage={hasNextPage}
            totalCount={totalCount}
            error={errorNewsletters}
            onLoadMore={fetchNextPage}
            onRetry={refetchNewsletters}
            // Newsletter row props
            selectedIds={selectedIds}
            isSelecting={isSelecting}
            readingQueue={readingQueue}
            visibleTags={visibleTags}
            // Newsletter row actions
            onToggleSelect={async (id: string) => {
              toggleSelect(id);
            }}
            onToggleLike={handleToggleLikeWrapper}
            onToggleArchive={async (id: string) => {
              const newsletter = newsletters.find((n) => n.id === id);
              if (newsletter) await handleToggleArchiveWrapper(newsletter);
            }}
            onToggleRead={async (id: string) => {
              const newsletter = newsletters.find((n) => n.id === id);
              if (newsletter) await handleToggleReadWrapper(newsletter);
            }}
            onTrash={async (id: string) => {
              await handleDeleteNewsletterWrapper(id);
            }}
            onToggleQueue={async (newsletterId: string) => {
              const newsletter = newsletters.find((n) => n.id === newsletterId);
              const isInQueue = readingQueue.some((item) => item.newsletter_id === newsletterId);
              if (newsletter) await handleToggleQueueWrapper(newsletter, isInQueue);
            }}
            onUpdateTags={handleUpdateTagsWrapper}
            onToggleTagVisibility={toggleTagVisibility}
            onTagClick={async (tag: Tag, _e: React.MouseEvent) => handleTagClick(tag.id)}
            onRemoveFromQueue={async (_e: React.MouseEvent, newsletterId: string) =>
              await handleRemoveFromQueue(_e, newsletterId)
            }
            onNewsletterClick={handleNewsletterClick}
            onMouseEnter={handleNewsletterMouseEnter}
            // Loading states
            isDeletingNewsletter={(id: string) =>
              newsletterActions.isNewsletterLoading('deleteNewsletter', id)
            }
            isUpdatingTags={(id: string) => newsletterActions.isNewsletterLoading('updateTags', id)}
            loadingStates={{}}
            // Error states
            errorTogglingLike={null}
            tagUpdateError={tagUpdateError}
            onDismissTagError={handleDismissTagError}
            // Display options
            showTags={true}
            showCheckbox={isSelecting}
            activeGroupIds={groupFilters}
            allGroups={newsletterGroups.map(g => ({ ...g, color: g.color || '#3B82F6' }))}
          />
        )}
      </div>
      {/* ScrollToTop is now mounted globally in Layout */}
    </div>
  );
};

Inbox.displayName = 'Inbox';

export default Inbox;
