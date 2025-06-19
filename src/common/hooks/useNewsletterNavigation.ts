import { useCallback, useMemo } from "react";
import { useInfiniteNewsletters } from "./infiniteScroll";
import { useInboxFilters } from "./useInboxFilters";
import { useLogger } from "@common/utils/logger/useLogger";
import type { NewsletterWithRelations, NewsletterFilter } from "../types";

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
}

export interface UseNewsletterNavigationReturn
  extends NewsletterNavigationState,
    NewsletterNavigationActions {}

/**
 * Custom hook for newsletter navigation functionality
 * Provides next/previous navigation within the inbox context
 * Respects current inbox filters and maintains navigation state
 */
export const useNewsletterNavigation = (
  currentNewsletterId: string | null,
  options: UseNewsletterNavigationOptions = {},
): UseNewsletterNavigationReturn => {
  const log = useLogger("useNewsletterNavigation");
  const { enabled = true, preloadAdjacent = true, debug = false } = options;

  // Get current inbox filters to respect user's filtering context
  const { newsletterFilter } = useInboxFilters();

  // Build the same filter that would be used in the inbox
  const inboxFilters: NewsletterFilter = useMemo(
    () => ({
      ...newsletterFilter,
      // Ensure we're fetching in the same order as the inbox
      orderBy: "received_at",
      ascending: false, // Most recent first
    }),
    [newsletterFilter],
  );

  // Fetch newsletters using the same filters as the inbox
  const {
    newsletters,
    isLoading,
    totalCount,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteNewsletters(inboxFilters, {
    enabled: enabled && !!currentNewsletterId,
    pageSize: 50, // Larger page size for better navigation experience
    debug,
  });

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

    const currentIndex = newsletters.findIndex(
      (n) => n.id === currentNewsletterId,
    );

    if (currentIndex === -1) {
      if (debug) {
        log.debug("Current newsletter not found in list", {
          action: "find_current_newsletter",
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
    const previousNewsletter =
      currentIndex > 0 ? newsletters[currentIndex - 1] : null;
    const nextNewsletter =
      currentIndex < newsletters.length - 1
        ? newsletters[currentIndex + 1]
        : null;

    if (debug) {
      log.debug("Navigation state calculated", {
        action: "calculate_navigation_state",
        metadata: {
          currentIndex,
          totalNewsletters: newsletters.length,
          hasPrevious: !!previousNewsletter,
          hasNext: !!nextNewsletter,
          previousId: previousNewsletter?.id,
          nextId: nextNewsletter?.id,
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

  // Check if we need to fetch more pages for navigation
  const needsMoreData = useMemo(() => {
    const { currentIndex } = navigationState;

    if (currentIndex === -1) return false;

    // If we're near the end and there are more pages, we should fetch
    const isNearEnd = currentIndex >= newsletters.length - 5;
    return isNearEnd && hasNextPage && !isFetchingNextPage;
  }, [navigationState, newsletters.length, hasNextPage, isFetchingNextPage]);

  // Auto-fetch more data when needed
  const preloadAdjacentNewsletters = useCallback(() => {
    if (needsMoreData && preloadAdjacent) {
      if (debug) {
        log.debug("Preloading adjacent newsletters", {
          action: "preload_adjacent",
          metadata: {
            currentIndex: navigationState.currentIndex,
            totalLoaded: newsletters.length,
            hasNextPage,
          },
        });
      }
      fetchNextPage();
    }
  }, [
    needsMoreData,
    preloadAdjacent,
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
        log.debug("No previous newsletter available", {
          action: "navigate_previous",
          metadata: { currentIndex: navigationState.currentIndex },
        });
      }
      return null;
    }

    if (debug) {
      log.debug("Navigating to previous newsletter", {
        action: "navigate_previous",
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

    // If no next newsletter is immediately available but we have more pages,
    // try to fetch next page first
    if (!nextNewsletter && hasNextPage && !isFetchingNextPage) {
      if (debug) {
        log.debug("Fetching next page for navigation", {
          action: "navigate_next_fetch",
          metadata: { currentIndex, totalLoaded: newsletters.length },
        });
      }
      fetchNextPage();
      return null; // User will need to try again after fetch
    }

    if (!nextNewsletter) {
      if (debug) {
        log.debug("No next newsletter available", {
          action: "navigate_next",
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
      log.debug("Navigating to next newsletter", {
        action: "navigate_next",
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

    // Has next if there's a next newsletter in current data OR more pages to fetch
    return currentIndex < newsletters.length - 1 || hasNextPage;
  }, [navigationState, newsletters.length, hasNextPage]);

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
    totalCount,
    hasPrevious,
    hasNext,
    isLoading: isLoading || isFetchingNextPage,

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
  options: UseNewsletterNavigationOptions = {},
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
  options: UseNewsletterNavigationOptions = {},
): NewsletterNavigationActions => {
  const navigation = useNewsletterNavigation(currentNewsletterId, options);

  return {
    navigateToPrevious: navigation.navigateToPrevious,
    navigateToNext: navigation.navigateToNext,
    preloadAdjacent: navigation.preloadAdjacent,
  };
};
