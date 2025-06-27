import { Mail } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import BulkSelectionActions from '@web/components/BulkSelectionActions';
import { InboxFilters, NewsletterSourceWithCount } from '@web/components/InboxFilters';

import LoadingScreen from '@common/components/common/LoadingScreen';
import { InfiniteNewsletterList } from '@web/components/InfiniteScroll';

import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll';
import { useErrorHandling } from '@common/hooks/useErrorHandling';
import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useBulkLoadingStates } from '@common/hooks/useLoadingStates';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

import { useAuth } from '@common/contexts';
import { useToast } from '@common/contexts/ToastContext';
import { useLogger } from '@common/utils/logger/useLogger';
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
const Inbox: React.FC = memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useToast();
  const log = useLogger();

  // Filter management using our new context and hooks
  const {
    filter,
    sourceFilter,
    timeRange,
    debouncedTagIds,
    allTags,
    newsletterSources,
    isLoadingSources,
    // Filter actions
    setFilter,
    setSourceFilter,
    setTimeRange,
    removeTag,
    resetFilters,
    handleTagClick,
  } = useInboxFilters();

  // Create sources with unread counts for the filter dropdown
  const sourcesWithUnreadCounts = useMemo(() => {
    return newsletterSources.map(
      (source): NewsletterSourceWithCount => ({
        ...source,
        count: source.unread_count || 0,
      })
    );
  }, [newsletterSources]);

  // Newsletter filter from context
  const { newsletterFilter: contextNewsletterFilter } = useInboxFilters();

  // Stabilize the newsletter filter to prevent unnecessary re-renders
  const stableNewsletterFilter = useMemo(() => {
    return {
      ...contextNewsletterFilter,
      tagIds: contextNewsletterFilter.tagIds ? [...contextNewsletterFilter.tagIds] : undefined,
      sourceIds: contextNewsletterFilter.sourceIds ? [...contextNewsletterFilter.sourceIds] : undefined,
    };
  }, [
    contextNewsletterFilter,
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
    _staleTime: 0,
    pageSize: 25,
    debug: process.env.NODE_ENV === 'development',
  });

  // Debug: Log newsletter data only when it changes significantly
  const lastDebugStateRef = useRef<string>('');

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const currentState = JSON.stringify({
        rawNewslettersCount: rawNewsletters.length,
        isLoadingNewsletters,
        errorNewsletters: errorNewsletters?.message,
        totalCount,
        hasNextPage,
      });

      // Only log if the state has actually changed
      if (lastDebugStateRef.current !== currentState) {
        lastDebugStateRef.current = currentState;
        console.log('Newsletter Debug:', {
          newsletterFilter: stableNewsletterFilter,
          rawNewslettersCount: rawNewsletters.length,
          isLoadingNewsletters,
          errorNewsletters: errorNewsletters?.message,
          totalCount,
          hasNextPage,
          user: user?.id,
          isAuthenticated: !!user,
          rawNewsletters: rawNewsletters.slice(0, 3).map(n => ({ id: n.id, title: n.title })), // Show first 3 newsletters
        });
      }
    }
  }, [stableNewsletterFilter, rawNewsletters.length, isLoadingNewsletters, errorNewsletters, totalCount, hasNextPage, user, rawNewsletters]);

  // Additional debugging for newsletter data
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Newsletter Data Debug:', {
        rawNewslettersLength: rawNewsletters.length,
        rawNewslettersType: typeof rawNewsletters,
        isArray: Array.isArray(rawNewsletters),
        firstNewsletter: rawNewsletters[0],
        allNewsletters: rawNewsletters.map(n => ({ id: n.id, title: n.title })),
        isLoadingNewsletters,
        errorNewsletters: errorNewsletters?.message,
        totalCount,
        hasNextPage,
        user: user?.id,
        isAuthenticated: !!user,
      });
    }
  }, [rawNewsletters, isLoadingNewsletters, errorNewsletters, totalCount, hasNextPage, user]);

  // Reading queue
  const { readingQueue = [], removeFromQueue } = useReadingQueue() || {};

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

    if (filter !== 'all') {
      if (params.get('filter') !== filter) {
        params.set('filter', filter);
        hasChanges = true;
      }
    } else {
      if (params.has('filter')) {
        params.delete('filter');
        hasChanges = true;
      }
    }

    if (sourceFilter) {
      if (params.get('source') !== sourceFilter) {
        params.set('source', sourceFilter);
        hasChanges = true;
      }
    } else {
      if (params.has('source')) {
        params.delete('source');
        hasChanges = true;
      }
    }

    if (timeRange !== 'all') {
      if (params.get('time') !== timeRange) {
        params.set('time', timeRange);
        hasChanges = true;
      }
    } else {
      if (params.has('time')) {
        params.delete('time');
        hasChanges = true;
      }
    }

    if (debouncedTagIds.length > 0) {
      const tagString = debouncedTagIds.join(',');
      if (params.get('tags') !== tagString) {
        params.set('tags', tagString);
        hasChanges = true;
      }
    } else {
      if (params.has('tags')) {
        params.delete('tags');
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [filter, sourceFilter, timeRange, debouncedTagIds]);

  // Shared newsletter actions with our enhanced version
  const newsletterActions = useSharedNewsletterActions({
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

  // Tag visibility state
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());

  // Tag error handling state
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

  // Action progress state to prevent refetching during actions
  const [_isActionInProgress, setIsActionInProgress] = useState(false);

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
    if (selectedIds.size === rawNewsletters.length) {
      clearSelection();
    } else {
      const allIds = new Set(rawNewsletters.map((n) => n.id));
      setSelectedIds(allIds);
      setIsSelecting(true);
    }
  }, [rawNewsletters, selectedIds.size, clearSelection]);

  const selectRead = useCallback(() => {
    const readIds = rawNewsletters.filter((n) => n.is_read).map((n) => n.id);
    setSelectedIds(new Set(readIds));
    setIsSelecting(readIds.length > 0);
  }, [rawNewsletters]);

  const selectUnread = useCallback(() => {
    const unreadIds = rawNewsletters.filter((n) => !n.is_read).map((n) => n.id);
    setSelectedIds(new Set(unreadIds));
    setIsSelecting(unreadIds.length > 0);
  }, [rawNewsletters]);

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

      try {
        // Perform optimistic updates simultaneously for better UX
        const actions = [];

        // Mark as read if unread (optimistic)
        if (!newsletter.is_read) {
          actions.push(
            newsletterActions.handleMarkAsRead(newsletter.id, {
              optimisticUpdates: true,
              showToasts: false, // Don't show toast for auto-actions
            })
          );
        }

        // Archive the newsletter when opened from the inbox (optimistic)
        if (!newsletter.is_archived) {
          actions.push(
            newsletterActions.handleToggleArchive(newsletter, {
              optimisticUpdates: true,
              showToasts: false, // Don't show toast for auto-actions
            })
          );
        }

        // Execute actions in parallel for better performance
        if (actions.length > 0) {
          try {
            await Promise.allSettled(actions);
          } catch (actionError) {
            log.error(
              'Some newsletter actions failed during click',
              {
                action: 'newsletter_click_actions',
                metadata: {
                  newsletterId: newsletter.id,
                  actionsCount: actions.length,
                },
              },
              actionError instanceof Error ? actionError : new Error(String(actionError))
            );
            // Continue with navigation even if actions fail
          }
        }

        // Preserve filter parameters before navigation
        preserveFilterParams();

        // Navigate to the newsletter detail
        navigate(`/newsletters/${newsletter.id}`);
      } catch (error) {
        log.error(
          'Unexpected error in newsletter click handler',
          {
            action: 'newsletter_click',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Still navigate even if other actions fail
        navigate(`/newsletters/${newsletter.id}`);
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [navigate, newsletterActions, preserveFilterParams, log]
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
  }, []);

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
        // Dispatch event for unread count updates
        window.dispatchEvent(new CustomEvent('newsletter:like-status-changed'));
      } catch (error) {
        log.error(
          'Failed to toggle like status',
          {
            action: 'toggle_like',
            metadata: { newsletterId: newsletter.id, filter },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Revert optimistic update on error
        if (filter === 'liked') {
          await refetchNewsletters();
        }
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, filter, preserveFilterParams, refetchNewsletters, log]
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
        await newsletterActions.handleToggleRead(newsletter);
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
            metadata: { newsletterId: newsletterId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [newsletterActions, preserveFilterParams, log]
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

  // Loading state
  if (isLoadingNewsletters && rawNewsletters.length === 0) {
    return <LoadingScreen />;
  }

  // Error state
  if (errorNewsletters) {
    return <ErrorState error={errorNewsletters} onRetry={refetchNewsletters} />;
  }

  const showArchived = filter === 'archived';

  return (
    <div className="px-0 sm:px-6 py-6 bg-neutral-50 min-h-screen">
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
              timeRange={timeRange}
              newsletterSources={sourcesWithUnreadCounts}
              onFilterChange={setFilter}
              onSourceFilterChange={setSourceFilter}
              onTimeRangeChange={setTimeRange}
              isLoadingSources={isLoadingSources}
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
            totalCount={rawNewsletters.length}
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

      {/* Newsletter List with Infinite Scroll */}
      <div className={`${selectedTags.length > 0 ? 'pt-2' : 'pt-6'} pb-6 overflow-auto sm:px-6 px-0`}>
        {isLoadingNewsletters && rawNewsletters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-base text-neutral-400">Loading newsletters...</p>
          </div>
        ) : rawNewsletters.length === 0 && !isLoadingNewsletters ? (
          <EmptyState filter={filter} sourceFilter={sourceFilter} />
        ) : (
          <InfiniteNewsletterList
            newsletters={rawNewsletters}
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
            onToggleSelect={async (id: string) => { toggleSelect(id); }}
            onToggleLike={handleToggleLikeWrapper}
            onToggleArchive={async (id: string) => {
              const newsletter = rawNewsletters.find((n) => n.id === id);
              if (newsletter) await handleToggleArchiveWrapper(newsletter);
            }}
            onToggleRead={async (id: string) => {
              const newsletter = rawNewsletters.find((n) => n.id === id);
              if (newsletter) await handleToggleReadWrapper(newsletter);
            }}
            onTrash={async (id: string) => {
              await handleDeleteNewsletterWrapper(id);
            }}
            onToggleQueue={async (newsletterId: string) => {
              const newsletter = rawNewsletters.find((n) => n.id === newsletterId);
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
          />
        )}
      </div>
    </div>
  );
});

Inbox.displayName = 'Inbox';

export default Inbox;
