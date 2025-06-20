import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLogger } from '@common/utils/logger/useLogger';
import { invalidateForOperation } from '@common/utils/optimizedCacheInvalidation';
import { usePrefetchNewsletterDetail } from './useNewsletterDetail';

interface NavigationOptions {
  from?: string;
  fromReadingQueue?: boolean;
  fromNewsletterSources?: boolean;
  replace?: boolean;
  prefetch?: boolean;
  debounceDelay?: number;
}

interface UseDebouncedNavigationReturn {
  navigateToNewsletter: (newsletterId: string, options?: NavigationOptions) => Promise<void>;
  navigateToNextNewsletter: (
    currentId: string,
    newsletterIds: string[],
    options?: NavigationOptions
  ) => void;
  navigateToPreviousNewsletter: (
    currentId: string,
    newsletterIds: string[],
    options?: NavigationOptions
  ) => void;
  cancelPendingNavigation: () => void;
  isNavigating: boolean;
  pendingNavigationId: string | null;
}

/**
 * Hook for debounced newsletter navigation with prefetching
 * Reduces database queries during rapid navigation
 */
export const useDebouncedNavigation = (): UseDebouncedNavigationReturn => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const log = useLogger('useDebouncedNavigation');
  const { prefetchNewsletter } = usePrefetchNewsletterDetail();

  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingNavigationId, setPendingNavigationId] = useState<string | null>(null);

  // Refs for debouncing
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastNavigationTime = useRef<number>(0);
  const navigationQueue = useRef<string[]>([]);

  // Cancel any pending navigation
  const cancelPendingNavigation = useCallback(() => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    setPendingNavigationId(null);
    setIsNavigating(false);
    navigationQueue.current = [];
  }, []);

  // Core navigation function with debouncing
  const navigateToNewsletter = useCallback(
    async (newsletterId: string, options: NavigationOptions = {}) => {
      const {
        from,
        fromReadingQueue = false,
        fromNewsletterSources = false,
        replace = false,
        prefetch = true,
        debounceDelay = 200,
      } = options;

      // Cancel any pending navigation
      cancelPendingNavigation();

      // Track navigation intent
      setPendingNavigationId(newsletterId);
      setIsNavigating(true);

      // Add to navigation queue for tracking
      navigationQueue.current.push(newsletterId);

      // Calculate time since last navigation
      const now = Date.now();
      const timeSinceLastNav =
        lastNavigationTime.current === 0 ? 0 : now - lastNavigationTime.current;

      log.debug('Navigation requested', {
        action: 'navigation_request',
        metadata: {
          newsletterId,
          timeSinceLastNav,
          queueLength: navigationQueue.current.length,
        },
      });

      // Perform navigation after debounce delay
      navigationTimeoutRef.current = setTimeout(async () => {
        try {
          // Only navigate if this is still the pending navigation
          if (pendingNavigationId === newsletterId) {
            // Prefetch newsletter data if enabled
            if (prefetch) {
              await prefetchNewsletter(newsletterId, { priority: true });
            }

            // Trigger cache invalidation for navigation
            invalidateForOperation(queryClient, 'navigation', [newsletterId]);

            // Navigate to the newsletter
            navigate(`/newsletters/${newsletterId}`, {
              replace,
              state: {
                from,
                fromReadingQueue,
                fromNewsletterSources,
              },
            });

            // Update last navigation time after successful navigation
            lastNavigationTime.current = Date.now();

            log.debug('Navigation completed', {
              action: 'navigation_complete',
              metadata: {
                newsletterId,
                navigationTime: Date.now() - now,
              },
            });
          }
        } catch (error) {
          log.error(
            'Navigation failed',
            {
              action: 'navigation_error',
              metadata: { newsletterId },
            },
            error instanceof Error ? error : new Error(String(error))
          );
        } finally {
          setIsNavigating(false);
          setPendingNavigationId(null);
          navigationQueue.current = [];
        }
      }, debounceDelay);
    },
    [navigate, queryClient, log, prefetchNewsletter, cancelPendingNavigation, pendingNavigationId]
  );

  // Navigate to next newsletter in list
  const navigateToNextNewsletter = useCallback(
    (currentId: string, newsletterIds: string[], options: NavigationOptions = {}) => {
      const currentIndex = newsletterIds.indexOf(currentId);
      if (currentIndex === -1 || currentIndex === newsletterIds.length - 1) {
        log.debug('No next newsletter available', {
          action: 'navigate_next',
          metadata: { currentId, currentIndex },
        });
        return;
      }

      const nextId = newsletterIds[currentIndex + 1];

      // Prefetch the next newsletter after the one we're navigating to
      if (currentIndex + 2 < newsletterIds.length) {
        const afterNextId = newsletterIds[currentIndex + 2];
        prefetchNewsletter(afterNextId, { priority: false }).catch(() => {
          // Ignore prefetch errors
        });
      }

      navigateToNewsletter(nextId, options);
    },
    [navigateToNewsletter, log, prefetchNewsletter]
  );

  // Navigate to previous newsletter in list
  const navigateToPreviousNewsletter = useCallback(
    (currentId: string, newsletterIds: string[], options: NavigationOptions = {}) => {
      const currentIndex = newsletterIds.indexOf(currentId);
      if (currentIndex === -1 || currentIndex === 0) {
        log.debug('No previous newsletter available', {
          action: 'navigate_previous',
          metadata: { currentId, currentIndex },
        });
        return;
      }

      const previousId = newsletterIds[currentIndex - 1];

      // Prefetch the newsletter before the one we're navigating to
      if (currentIndex - 2 >= 0) {
        const beforePreviousId = newsletterIds[currentIndex - 2];
        prefetchNewsletter(beforePreviousId, { priority: false }).catch(() => {
          // Ignore prefetch errors
        });
      }

      navigateToNewsletter(previousId, options);
    },
    [navigateToNewsletter, log, prefetchNewsletter]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPendingNavigation();
    };
  }, [cancelPendingNavigation]);

  return {
    navigateToNewsletter,
    navigateToNextNewsletter,
    navigateToPreviousNewsletter,
    cancelPendingNavigation,
    isNavigating,
    pendingNavigationId,
  };
};

/**
 * Hook for preloading newsletters in a list for smoother navigation
 */
export const useNewsletterPreloader = (
  newsletterIds: string[],
  options: {
    enabled?: boolean;
    preloadCount?: number;
    currentIndex?: number;
  } = {}
) => {
  const { enabled = true, preloadCount = 2, currentIndex = 0 } = options;
  const { prefetchNewsletter } = usePrefetchNewsletterDetail();
  const log = useLogger('useNewsletterPreloader');

  useEffect(() => {
    if (!enabled || newsletterIds.length === 0) return;

    const preloadNewsletters = async () => {
      const startIndex = Math.max(0, currentIndex - preloadCount);
      const endIndex = Math.min(newsletterIds.length - 1, currentIndex + preloadCount);

      const preloadPromises: Promise<void>[] = [];

      for (let i = startIndex; i <= endIndex; i++) {
        if (i !== currentIndex) {
          preloadPromises.push(
            prefetchNewsletter(newsletterIds[i], { priority: false }).catch(() => {
              // Ignore individual prefetch errors
            })
          );
        }
      }

      if (preloadPromises.length > 0) {
        log.debug('Preloading newsletters', {
          action: 'preload_start',
          metadata: {
            count: preloadPromises.length,
            range: { startIndex, endIndex },
          },
        });

        await Promise.allSettled(preloadPromises);
      }
    };

    preloadNewsletters();
  }, [enabled, newsletterIds, currentIndex, preloadCount, prefetchNewsletter, log]);
};
