import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useNewsletterNavigation } from '@common/hooks/useNewsletterNavigation';
import type { NewsletterMutations } from '@common/hooks/useSharedNewsletterActions';
import type { NewsletterFilter, NewsletterWithRelations } from '@common/types';
import { getCacheManager } from '@common/utils/cacheUtils';
import { useLogger } from '@common/utils/logger/useLogger';
import { ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NewsletterNavigationProps {
  currentNewsletterId: string;
  className?: string;
  showLabels?: boolean;
  showCounter?: boolean;
  disabled?: boolean;
  autoMarkAsRead?: boolean;
  isFromReadingQueue?: boolean;
  sourceId?: string;
  mutations?: NewsletterMutations;
}

export const NewsletterNavigation: React.FC<NewsletterNavigationProps> = ({
  currentNewsletterId,
  className = '',
  showLabels = true,
  showCounter = true,
  disabled = false,
  autoMarkAsRead = true,
  isFromReadingQueue = false,
  sourceId,
  mutations,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const log = useLogger('NewsletterNavigation');
  const { newsletterFilter } = useInboxFilters();

  // Detect current context and build appropriate navigation options
  const navigationOptions = useMemo(() => {
    // Check if we're in reading queue context
    const isReadingQueueContext =
      isFromReadingQueue ||
      location.pathname.includes('/reading-queue') ||
      location.pathname.includes('/queue');

    // Check if we're in a specific source context
    const isSourceContext =
      sourceId || location.pathname.includes('/sources/') || location.search.includes('source=');

    // Check if we're coming from inbox with specific filter context
    const isFromInboxWithFilter = location.state?.fromInbox && location.state?.currentFilter;

    console.log('🔍 DEBUG: NewsletterNavigation context detection', {
      isReadingQueueContext,
      isSourceContext,
      isFromInboxWithFilter,
      locationState: location.state,
      currentFilter: location.state?.currentFilter,
    });

    if (isReadingQueueContext) {
      return {
        enabled: !disabled,
        preloadAdjacent: true,
        debug: process.env.NODE_ENV === 'development',
        forceReadingQueue: true,
      };
    }

    if (isSourceContext) {
      const contextSourceId =
        sourceId ||
        new URLSearchParams(location.search).get('source') ||
        location.pathname.split('/sources/')[1]?.split('/')[0];

      return {
        enabled: !disabled,
        preloadAdjacent: true,
        debug: process.env.NODE_ENV === 'development',
        forceSourceFilter: contextSourceId,
      };
    }

    // Use filter context from inbox if available
    if (isFromInboxWithFilter) {
      // Convert inbox filter state to NewsletterFilter format
      const inboxFilter: NewsletterFilter = {
        // Convert filter string to boolean properties
        is_read: location.state.currentFilter === 'unread' ? false : undefined,
        is_archived: location.state.currentFilter === 'archived' ? true : undefined,
        is_liked: location.state.currentFilter === 'liked' ? true : undefined,
        // Add source filter if present
        source_id: location.state.sourceFilter || undefined,
        // Add tag IDs if present
        tag_ids: location.state.tagIds && location.state.tagIds.length > 0 ? location.state.tagIds : undefined,
        // Add date range if present
        start_date: location.state.timeRange && location.state.timeRange !== 'all' ? location.state.timeRange : undefined,
        end_date: location.state.timeRange && location.state.timeRange !== 'all' ? location.state.timeRange : undefined,
      };

      console.log('🔍 DEBUG: Using inbox filter context', {
        originalFilter: location.state.currentFilter,
        convertedFilter: inboxFilter,
      });

      return {
        enabled: !disabled,
        preloadAdjacent: true,
        debug: process.env.NODE_ENV === 'development',
        overrideFilter: inboxFilter,
      };
    }

    // Default to current inbox filters
    return {
      enabled: !disabled,
      preloadAdjacent: true,
      debug: process.env.NODE_ENV === 'development',
      overrideFilter: newsletterFilter,
    };
  }, [
    disabled,
    isFromReadingQueue,
    sourceId,
    location.pathname,
    location.search,
    location.state,
    newsletterFilter,
  ]);

  const {
    hasPrevious,
    hasNext,
    currentIndex,
    totalCount,
    isLoading,
    currentNewsletter,
    navigateToPrevious,
    navigateToNext,
  } = useNewsletterNavigation(currentNewsletterId, navigationOptions);

  // Navigation-specific handlers that use optimistic unread count updates
  const handleNavigationMarkAsRead = useCallback(async (newsletterId: string) => {
    if (!mutations?.markAsRead) {
      throw new Error('markAsRead mutation not available');
    }

    try {
      // Use the mutation directly but with navigation-specific cache handling
      await mutations.markAsRead(newsletterId);

      // Use optimistic unread count update instead of cache invalidation
      const cacheManager = getCacheManager();
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: [newsletterId],
      });

      log.debug('Navigation mark as read completed', {
        action: 'navigation_mark_read',
        metadata: { newsletterId },
      });
    } catch (error) {
      log.error(
        'Failed to mark newsletter as read during navigation',
        {
          action: 'navigation_mark_read_error',
          metadata: { newsletterId },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }, [mutations?.markAsRead, log]);

  const handleNavigationToggleArchive = useCallback(async (newsletter: NewsletterWithRelations) => {
    if (!mutations?.toggleArchive) {
      throw new Error('toggleArchive mutation not available');
    }

    try {
      await mutations.toggleArchive(newsletter.id);

      log.debug('Navigation toggle archive completed', {
        action: 'navigation_toggle_archive',
        metadata: { newsletterId: newsletter.id },
      });
    } catch (error) {
      log.error(
        'Failed to toggle archive during navigation',
        {
          action: 'navigation_toggle_archive_error',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }, [mutations?.toggleArchive, log]);

  // Track which newsletters have been auto-marked as read to prevent infinite loops
  const autoMarkedRef = useRef<Set<string>>(new Set());

  // Auto-mark current newsletter as read when it loads (instantaneous)
  useEffect(() => {
    if (
      autoMarkAsRead &&
      currentNewsletter &&
      !currentNewsletter.is_read &&
      !disabled &&
      !autoMarkedRef.current.has(currentNewsletter.id)
    ) {
      autoMarkedRef.current.add(currentNewsletter.id);
      const markAsRead = async () => {
        try {
          await handleNavigationMarkAsRead(currentNewsletter.id);
          log.debug('Auto-marked newsletter as read via navigation', {
            action: 'auto_mark_read_navigation',
            metadata: {
              newsletterId: currentNewsletter.id,
              title: currentNewsletter.title,
            },
          });
        } catch (error) {
          log.error(
            'Failed to auto-mark newsletter as read via navigation',
            {
              action: 'auto_mark_read_navigation_error',
              metadata: { newsletterId: currentNewsletter.id },
            },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      };
      markAsRead();
    }
  }, [currentNewsletter?.id, autoMarkAsRead, disabled, handleNavigationMarkAsRead, log]);

  const handlePrevious = useCallback(async () => {
    if (disabled || !hasPrevious) return;

    // Mark current newsletter as read and archive before navigating (only if not from reading queue)
    if (currentNewsletter && autoMarkAsRead && !isFromReadingQueue) {
      try {
        if (!currentNewsletter.is_read) {
          await handleNavigationMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleNavigationToggleArchive(currentNewsletter);
        }
      } catch (error) {
        log.error(
          'Failed to process current newsletter before navigation',
          {
            action: 'navigate_previous_process_error',
            metadata: { newsletterId: currentNewsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    const previousId = navigateToPrevious();
    if (previousId) {
      log.debug('Navigating to previous newsletter', {
        action: 'navigate_previous',
        metadata: {
          fromId: currentNewsletterId,
          toId: previousId,
          context: isFromReadingQueue
            ? 'reading_queue'
            : sourceId
              ? 'source_filter'
              : 'inbox_filter',
        },
      });

      // Preserve current context in navigation
      const currentPath = location.pathname;
      const currentSearch = location.search;
      let targetPath = `/newsletters/${previousId}`;

      // Preserve query parameters for context
      if (currentSearch && !isFromReadingQueue) {
        targetPath += currentSearch;
      }

      navigate(targetPath, {
        replace: false,
        state: {
          from: currentPath + currentSearch,
          fromNavigation: true,
          fromReadingQueue: isFromReadingQueue,
          fromNewsletterSources: !!sourceId,
          sourceId: sourceId,
          // Preserve original inbox filter context if it exists
          fromInbox: location.state?.fromInbox || false,
          currentFilter: location.state?.currentFilter,
          sourceFilter: location.state?.sourceFilter,
          timeRange: location.state?.timeRange,
          tagIds: location.state?.tagIds,
          context: isFromReadingQueue
            ? 'reading_queue'
            : sourceId
              ? 'source_filter'
              : 'inbox_filter',
        },
      });
    }
  }, [
    disabled,
    hasPrevious,
    navigateToPrevious,
    navigate,
    currentNewsletterId,
    currentNewsletter,
    autoMarkAsRead,
    isFromReadingQueue,
    location.pathname,
    location.search,
    sourceId,
    handleNavigationMarkAsRead,
    handleNavigationToggleArchive,
    log,
  ]);

  const handleNext = useCallback(async () => {
    if (disabled || !hasNext) return;

    // Mark current newsletter as read and archive before navigating (only if not from reading queue)
    if (currentNewsletter && autoMarkAsRead && !isFromReadingQueue) {
      try {
        if (!currentNewsletter.is_read) {
          await handleNavigationMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleNavigationToggleArchive(currentNewsletter);
        }
      } catch (error) {
        log.error(
          'Failed to process current newsletter before navigation',
          {
            action: 'navigate_next_process_error',
            metadata: { newsletterId: currentNewsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    const nextId = navigateToNext();
    if (nextId) {
      log.debug('Navigating to next newsletter', {
        action: 'navigate_next',
        metadata: {
          fromId: currentNewsletterId,
          toId: nextId,
          context: isFromReadingQueue
            ? 'reading_queue'
            : sourceId
              ? 'source_filter'
              : 'inbox_filter',
        },
      });

      // Preserve current context in navigation
      const currentPath = location.pathname;
      const currentSearch = location.search;
      let targetPath = `/newsletters/${nextId}`;

      // Preserve query parameters for context
      if (currentSearch && !isFromReadingQueue) {
        targetPath += currentSearch;
      }

      navigate(targetPath, {
        replace: false,
        state: {
          from: currentPath + currentSearch,
          fromNavigation: true,
          fromReadingQueue: isFromReadingQueue,
          fromNewsletterSources: !!sourceId,
          sourceId: sourceId,
          // Preserve original inbox filter context if it exists
          fromInbox: location.state?.fromInbox || false,
          currentFilter: location.state?.currentFilter,
          sourceFilter: location.state?.sourceFilter,
          timeRange: location.state?.timeRange,
          tagIds: location.state?.tagIds,
          context: isFromReadingQueue
            ? 'reading_queue'
            : sourceId
              ? 'source_filter'
              : 'inbox_filter',
        },
      });
    }
  }, [
    disabled,
    hasNext,
    navigateToNext,
    navigate,
    currentNewsletterId,
    currentNewsletter,
    autoMarkAsRead,
    isFromReadingQueue,
    location.pathname,
    location.search,
    sourceId,
    handleNavigationMarkAsRead,
    handleNavigationToggleArchive,
    log,
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // Only handle shortcuts when not typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'j') {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === 'ArrowRight' || event.key === 'k') {
        event.preventDefault();
        handleNext();
      }
    },
    [disabled, handlePrevious, handleNext]
  );

  // Add keyboard event listeners
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Don't render if we don't have enough data yet, but allow some time for loading
  if (currentIndex === -1 && !isLoading && !currentNewsletter) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={disabled || !hasPrevious || isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${hasPrevious && !disabled && !isLoading
            ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200'
            : 'text-gray-400 cursor-not-allowed'
          }
        `}
        title={hasPrevious ? 'Previous newsletter (← or J)' : 'No previous newsletter'}
        aria-label="Navigate to previous newsletter"
      >
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        {showLabels && <span>Previous</span>}
      </button>

      {/* Counter */}
      {showCounter && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : currentIndex >= 0 ? (
            <>
              <span className="font-medium text-gray-700">{currentIndex + 1}</span>
              <span>of</span>
              <span className="font-medium text-gray-700">
                {totalCount > 0 ? totalCount.toLocaleString() : '?'}
              </span>
            </>
          ) : (
            <span>Loading position...</span>
          )}
        </div>
      )}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={disabled || !hasNext || isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${hasNext && !disabled && !isLoading
            ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200'
            : 'text-gray-400 cursor-not-allowed'
          }
        `}
        title={hasNext ? 'Next newsletter (→ or K)' : 'No next newsletter'}
        aria-label="Navigate to next newsletter"
      >
        {showLabels && <span>Next</span>}
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

export default NewsletterNavigation;
