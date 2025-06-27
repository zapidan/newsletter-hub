import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useNewsletterNavigation } from '@common/hooks/useNewsletterNavigation';
import type { NewsletterMutations } from '@common/hooks/useSharedNewsletterActions';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useLogger } from '@common/utils/logger/useLogger';
import { ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import React, { useCallback, useEffect, useMemo } from 'react';
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

  const { handleMarkAsRead, handleToggleArchive } = useSharedNewsletterActions(
    mutations,
    {
      showToasts: false, // Don't show toasts for auto-mark-as-read and auto-archive
      optimisticUpdates: true,
    }
  );

  // Auto-mark current newsletter as read when it loads (instantaneous)
  useEffect(() => {
    if (autoMarkAsRead && currentNewsletter && !currentNewsletter.is_read && !disabled) {
      const markAsRead = async () => {
        try {
          await handleMarkAsRead(currentNewsletter.id);
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

      // Mark as read immediately without delay
      markAsRead();
    }
  }, [currentNewsletter?.id, autoMarkAsRead, disabled]); // Stable deps only to avoid infinite loops

  const handlePrevious = useCallback(async () => {
    if (disabled || !hasPrevious) return;

    // Mark current newsletter as read and archive before navigating (only if not from reading queue)
    if (currentNewsletter && autoMarkAsRead && !isFromReadingQueue) {
      try {
        if (!currentNewsletter.is_read) {
          await handleMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleToggleArchive(currentNewsletter);
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
    handleMarkAsRead,
    handleToggleArchive,
    log,
  ]);

  const handleNext = useCallback(async () => {
    if (disabled || !hasNext) return;

    // Mark current newsletter as read and archive before navigating (only if not from reading queue)
    if (currentNewsletter && autoMarkAsRead && !isFromReadingQueue) {
      try {
        if (!currentNewsletter.is_read) {
          await handleMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleToggleArchive(currentNewsletter);
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
    handleMarkAsRead,
    handleToggleArchive,
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
