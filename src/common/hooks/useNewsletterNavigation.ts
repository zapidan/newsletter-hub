import { useLogger } from '@common/utils/logger/useLogger';
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { NewsletterFilter, NewsletterWithRelations } from '../types';
import { useInfiniteNewsletters } from './infiniteScroll';
import { useInboxFilters } from './useInboxFilters';
import { useReadingQueue } from './useReadingQueue';

export interface NewsletterNavigationState {
  currentNewsletter: NewsletterWithRelations | null;
  previousNewsletter: NewsletterWithRelations | null;
  nextNewsletter: NewsletterWithRelations | null;
  currentIndex: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading: boolean;
}

export interface NewsletterNavigationActions {
  navigateToPrevious: () => string | null;
  navigateToNext: () => string | null;
  preloadAdjacent: () => void;
}

export interface UseNewsletterNavigationOptions {
  enabled?: boolean;
  preloadAdjacent?: boolean;
  debug?: boolean;
  /** Override context detection and use specific filter */
  overrideFilter?: NewsletterFilter;
  /** Force use of reading queue context */
  forceReadingQueue?: boolean;
  /** Force use of specific source filter */
  forceSourceFilter?: string;
}

export interface UseNewsletterNavigationReturn
  extends NewsletterNavigationState,
  NewsletterNavigationActions { }

/**
 * Custom hook for newsletter navigation functionality
 * Provides next/previous navigation within the current context
 * Respects current view (inbox, reading queue, source) filters and maintains navigation state
 */
export const useNewsletterNavigation = (
  currentNewsletterId: string | null,
  options: UseNewsletterNavigationOptions = {}
): UseNewsletterNavigationReturn => {
  const log = useLogger('useNewsletterNavigation');
  const location = useLocation();
  const {
    enabled = false,
    preloadAdjacent = true,
    debug = false,
    overrideFilter,
    forceReadingQueue = false,
    forceSourceFilter,
  } = options;

  // Get current inbox filters and reading queue
  const { newsletterFilter } = useInboxFilters();
  const { readingQueue = [] } = useReadingQueue() || {};

  // Determine the context and build appropriate filter
  const contextualFilter: NewsletterFilter = useMemo(() => {
    // Use override filter if provided
    if (overrideFilter) {
      return {
        ...overrideFilter,
        orderBy: 'received_at',
        ascending: false,
      };
    }

    // Detect context from URL and options
    const isReadingQueueContext =
      forceReadingQueue ||
      location.pathname.includes('/reading-queue') ||
      location.pathname.includes('/queue');

    const isNewsletterSourceContext =
      forceSourceFilter ||
      location.pathname.includes('/sources/') ||
      location.search.includes('source=');

    if (isReadingQueueContext) {
      // For reading queue, we don't use the regular filter system
      // Instead we'll use the reading queue data directly
      return {
        is_read: undefined,
        search: 'reading_queue',
        order_by: 'received_at',
        ascending: false,
      } as NewsletterFilter;
    }

    if (isNewsletterSourceContext) {
      // Extract source from URL or use forced source
      const sourceId =
        forceSourceFilter ||
        new URLSearchParams(location.search).get('source') ||
        location.pathname.split('/sources/')[1]?.split('/')[0];

      if (sourceId) {
        return {
          ...newsletterFilter,
          source_id: sourceId,
          order_by: 'received_at',
          ascending: false,
        };
      }
    }

    // Default to current inbox filters
    return {
      ...newsletterFilter,
      order_by: 'received_at',
      ascending: false,
    };
  }, [
    overrideFilter,
    forceReadingQueue,
    forceSourceFilter,
    location.pathname,
    location.search,
    newsletterFilter,
  ]);

  // Handle reading queue context separately
  const isUsingReadingQueue = contextualFilter.search === 'reading_queue';

  // For reading queue, use the queue data directly
  const readingQueueNewsletters = useMemo(() => {
    if (!isUsingReadingQueue) return [];
    return readingQueue.map((item) => item.newsletter).filter(Boolean);
  }, [isUsingReadingQueue, readingQueue]);

  // Fetch newsletters using contextual filters (skip if using reading queue)
  const {
    newsletters: fetchedNewsletters,
    isLoading,
    totalCount,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteNewsletters(contextualFilter, {
    enabled: enabled && !!currentNewsletterId && !isUsingReadingQueue &&
      // Only enable if we're actually on a detail page and need navigation
      (window.location.pathname.includes('/newsletters/') &&
        window.location.pathname.split('/').length > 2),
    pageSize: 50, // Larger page size for better navigation experience
    debug,
  });

  // Use appropriate newsletter list based on context
  const newsletters = useMemo(() => {
    return isUsingReadingQueue ? readingQueueNewsletters : fetchedNewsletters;
  }, [isUsingReadingQueue, readingQueueNewsletters, fetchedNewsletters]);

  const contextTotalCount = useMemo(() => {
    return isUsingReadingQueue ? readingQueue.length : totalCount;
  }, [isUsingReadingQueue, readingQueue.length, totalCount]);

  // Find current newsletter and its position
  const navigationState = useMemo(() => {
    if (!currentNewsletterId || !newsletters.length) {
      return {
        currentNewsletter: null,
        currentIndex: -1,
        previousNewsletter: null,
        nextNewsletter: null,
      };
    }

    const currentIndex = newsletters.findIndex((n) => n.id === currentNewsletterId);

    if (currentIndex === -1) {
      if (debug) {
        log.debug('Current newsletter not found in list', {
          action: 'find_current_newsletter',
          metadata: {
            currentNewsletterId,
            newslettersCount: newsletters.length,
            firstFewIds: newsletters.slice(0, 5).map((n) => n.id),
          },
        });
      }

      return {
        currentNewsletter: null,
        currentIndex: -1,
        previousNewsletter: null,
        nextNewsletter: null,
      };
    }

    const currentNewsletter = newsletters[currentIndex];
    const previousNewsletter = currentIndex > 0 ? newsletters[currentIndex - 1] : null;
    const nextNewsletter =
      currentIndex < newsletters.length - 1 ? newsletters[currentIndex + 1] : null;

    if (debug) {
      log.debug('Navigation state calculated', {
        action: 'calculate_navigation_state',
        metadata: {
          currentIndex,
          totalNewsletters: newsletters.length,
          hasPrevious: !!previousNewsletter,
          hasNext: !!nextNewsletter,
          previousId: previousNewsletter?.id,
          nextId: nextNewsletter?.id,
          context: isUsingReadingQueue ? 'reading_queue' : 'filtered_inbox',
          contextFilter: contextualFilter,
        },
      });
    }

    return {
      currentNewsletter,
      currentIndex,
      previousNewsletter,
      nextNewsletter,
    };
  }, [currentNewsletterId, newsletters, debug, log]);

  // Check if we need to fetch more pages for navigation (only for non-reading-queue contexts)
  const needsMoreData = useMemo(() => {
    if (isUsingReadingQueue) return false; // Reading queue is already fully loaded

    const { currentIndex } = navigationState;
    if (currentIndex === -1) return false;

    // If we're near the end and there are more pages, we should fetch
    const isNearEnd = currentIndex >= newsletters.length - 5;
    return isNearEnd && hasNextPage && !isFetchingNextPage;
  }, [isUsingReadingQueue, navigationState, newsletters.length, hasNextPage, isFetchingNextPage]);

  // Auto-fetch more data when needed (only for non-reading-queue contexts)
  const preloadAdjacentNewsletters = useCallback(() => {
    if (needsMoreData && preloadAdjacent && !isUsingReadingQueue) {
      if (debug) {
        log.debug('Preloading adjacent newsletters', {
          action: 'preload_adjacent',
          metadata: {
            currentIndex: navigationState.currentIndex,
            totalLoaded: newsletters.length,
            hasNextPage,
            context: 'filtered_inbox',
          },
        });
      }
      fetchNextPage();
    }
  }, [
    needsMoreData,
    preloadAdjacent,
    isUsingReadingQueue,
    fetchNextPage,
    debug,
    log,
    navigationState.currentIndex,
    newsletters.length,
    hasNextPage,
  ]);

  // Navigation functions
  const navigateToPrevious = useCallback((): string | null => {
    const { previousNewsletter } = navigationState;

    if (!previousNewsletter) {
      if (debug) {
        log.debug('No previous newsletter available', {
          action: 'navigate_previous',
          metadata: { currentIndex: navigationState.currentIndex },
        });
      }
      return null;
    }

    if (debug) {
      log.debug('Navigating to previous newsletter', {
        action: 'navigate_previous',
        metadata: {
          fromId: currentNewsletterId,
          toId: previousNewsletter.id,
          currentIndex: navigationState.currentIndex,
        },
      });
    }

    return previousNewsletter.id;
  }, [navigationState, currentNewsletterId, debug, log]);

  const navigateToNext = useCallback((): string | null => {
    const { nextNewsletter, currentIndex } = navigationState;

    // For reading queue, no need to fetch more pages
    if (isUsingReadingQueue) {
      if (!nextNewsletter) {
        if (debug) {
          log.debug('No next newsletter available in reading queue', {
            action: 'navigate_next',
            metadata: {
              currentIndex: navigationState.currentIndex,
              totalInQueue: readingQueue.length,
            },
          });
        }
        return null;
      }

      if (debug) {
        log.debug('Navigating to next newsletter in reading queue', {
          action: 'navigate_next',
          metadata: {
            fromId: currentNewsletterId,
            toId: nextNewsletter.id,
            currentIndex: navigationState.currentIndex,
          },
        });
      }

      return nextNewsletter.id;
    }

    // For filtered inbox, try to fetch more if needed
    if (!nextNewsletter && hasNextPage && !isFetchingNextPage) {
      if (debug) {
        log.debug('Fetching next page for navigation', {
          action: 'navigate_next_fetch',
          metadata: { currentIndex, totalLoaded: newsletters.length },
        });
      }
      fetchNextPage();
      return null; // User will need to try again after fetch
    }

    if (!nextNewsletter) {
      if (debug) {
        log.debug('No next newsletter available', {
          action: 'navigate_next',
          metadata: {
            currentIndex: navigationState.currentIndex,
            hasNextPage,
            isFetchingNextPage,
          },
        });
      }
      return null;
    }

    if (debug) {
      log.debug('Navigating to next newsletter', {
        action: 'navigate_next',
        metadata: {
          fromId: currentNewsletterId,
          toId: nextNewsletter.id,
          currentIndex: navigationState.currentIndex,
        },
      });
    }

    return nextNewsletter.id;
  }, [
    navigationState,
    currentNewsletterId,
    isUsingReadingQueue,
    readingQueue.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    debug,
    log,
    newsletters.length,
  ]);

  // Determine navigation availability
  const hasPrevious = navigationState.currentIndex > 0;
  const hasNext = useMemo(() => {
    const { currentIndex } = navigationState;
    if (currentIndex === -1) return false;

    // For reading queue, only check current data
    if (isUsingReadingQueue) {
      return currentIndex < newsletters.length - 1;
    }

    // For filtered inbox, has next if there's a next newsletter in current data OR more pages to fetch
    return currentIndex < newsletters.length - 1 || hasNextPage;
  }, [navigationState, newsletters.length, hasNextPage, isUsingReadingQueue]);

  // Auto-preload when position changes
  if (enabled && preloadAdjacent) {
    preloadAdjacentNewsletters();
  }

  return {
    // State
    currentNewsletter: navigationState.currentNewsletter,
    previousNewsletter: navigationState.previousNewsletter,
    nextNewsletter: navigationState.nextNewsletter,
    currentIndex: navigationState.currentIndex,
    totalCount: contextTotalCount,
    hasPrevious,
    hasNext,
    isLoading: isUsingReadingQueue ? false : isLoading || isFetchingNextPage,

    // Actions
    navigateToPrevious,
    navigateToNext,
    preloadAdjacent: preloadAdjacentNewsletters,
  };
};

/**
 * Hook variant that provides only navigation state without actions
 * Useful for read-only navigation information
 */
export const useNewsletterNavigationState = (
  currentNewsletterId: string | null,
  options: UseNewsletterNavigationOptions = {}
): NewsletterNavigationState => {
  const navigation = useNewsletterNavigation(currentNewsletterId, options);

  return {
    currentNewsletter: navigation.currentNewsletter,
    previousNewsletter: navigation.previousNewsletter,
    nextNewsletter: navigation.nextNewsletter,
    currentIndex: navigation.currentIndex,
    totalCount: navigation.totalCount,
    hasPrevious: navigation.hasPrevious,
    hasNext: navigation.hasNext,
    isLoading: navigation.isLoading,
  };
};

/**
 * Hook variant that provides only navigation actions
 * Useful when you only need the navigation functions
 */
export const useNewsletterNavigationActions = (
  currentNewsletterId: string | null,
  options: UseNewsletterNavigationOptions = {}
): NewsletterNavigationActions => {
  const navigation = useNewsletterNavigation(currentNewsletterId, options);

  return {
    navigateToPrevious: navigation.navigateToPrevious,
    navigateToNext: navigation.navigateToNext,
    preloadAdjacent: navigation.preloadAdjacent,
  };
};
