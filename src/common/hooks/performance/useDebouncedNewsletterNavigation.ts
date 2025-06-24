import { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedCallback } from '../usePerformanceOptimizations';
import { useNewsletterNavigation } from '../useNewsletterNavigation';
import { useLogger } from '@common/utils/logger/useLogger';
import { useCache } from '../useCache';

interface NavigationMetrics {
  totalNavigations: number;
  preventedNavigations: number;
  lastNavigation: number;
  averageNavigationTime: number;
}

interface DebouncedNavigationOptions {
  debounceDelay?: number;
  enablePreloading?: boolean;
  enableMetrics?: boolean;
  onNavigationStart?: (newsletterId: string) => void;
  onNavigationComplete?: (newsletterId: string) => void;
  onNavigationPrevented?: (newsletterId: string) => void;
}

interface DebouncedNavigationReturn {
  navigateToNewsletter: (newsletterId: string) => void;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
  isNavigating: boolean;
  canNavigate: boolean;
  currentNewsletterId: string | null;
  navigationState: ReturnType<typeof useNewsletterNavigation>;
  metrics: NavigationMetrics;
}

/**
 * Optimized newsletter navigation hook with debouncing and performance enhancements
 * Prevents rapid navigation and reduces unnecessary database queries
 */
export const useDebouncedNewsletterNavigation = (
  currentNewsletterId: string | null,
  options: DebouncedNavigationOptions = {}
): DebouncedNavigationReturn => {
  const {
    debounceDelay = 300,
    enablePreloading = true,
    enableMetrics = process.env.NODE_ENV === 'development',
    onNavigationStart,
    onNavigationComplete,
    onNavigationPrevented,
  } = options;

  const navigate = useNavigate();
  const log = useLogger('useDebouncedNewsletterNavigation');
  const cache = useCache();

  const [isNavigating, setIsNavigating] = useState(false);
  const [localCurrentId, setLocalCurrentId] = useState(currentNewsletterId);

  const navigationMetrics = useRef<NavigationMetrics>({
    totalNavigations: 0,
    preventedNavigations: 0,
    lastNavigation: 0,
    averageNavigationTime: 0,
  });

  const navigationStartTime = useRef<number>(0);
  const pendingNavigationRef = useRef<string | null>(null);

  // Use the existing newsletter navigation hook
  const navigationState = useNewsletterNavigation(localCurrentId, {
    enabled: true,
    preloadAdjacent: enablePreloading,
  });

  // Update local state when prop changes
  useEffect(() => {
    setLocalCurrentId(currentNewsletterId);
  }, [currentNewsletterId]);

  // Preload newsletter data
  const preloadNewsletter = useCallback(
    async (newsletterId: string) => {
      try {
        await cache.prefetchQuery(
          ['newsletter', newsletterId],
          async () => {
            // This will be replaced by actual API call
            // For now, just log that we're preloading
            log.debug('Preloading newsletter', {
              action: 'preload_newsletter',
              metadata: { newsletterId },
            });
            return null;
          },
          { staleTime: 5 * 60 * 1000 } // 5 minutes
        );
      } catch (error) {
        log.error(
          'Failed to preload newsletter',
          {
            action: 'preload_error',
            metadata: { newsletterId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [cache, log]
  );

  // Core navigation function
  const performNavigation = useCallback(
    async (newsletterId: string) => {
      if (isNavigating || newsletterId === localCurrentId) {
        if (enableMetrics) {
          navigationMetrics.current.preventedNavigations++;
        }
        onNavigationPrevented?.(newsletterId);
        return;
      }

      try {
        setIsNavigating(true);
        navigationStartTime.current = performance.now();
        onNavigationStart?.(newsletterId);

        // Update local state immediately for optimistic UI
        setLocalCurrentId(newsletterId);

        // Navigate using React Router
        navigate(`/newsletters/${newsletterId}`, {
          replace: false,
          state: { fromNavigation: true },
        });

        // Update metrics
        if (enableMetrics) {
          const navigationTime = performance.now() - navigationStartTime.current;
          const metrics = navigationMetrics.current;

          metrics.totalNavigations++;
          metrics.lastNavigation = Date.now();
          metrics.averageNavigationTime =
            (metrics.averageNavigationTime * (metrics.totalNavigations - 1) + navigationTime) /
            metrics.totalNavigations;

          log.debug('Navigation completed', {
            action: 'navigation_complete',
            metadata: {
              newsletterId,
              duration: navigationTime.toFixed(2),
              totalNavigations: metrics.totalNavigations,
            },
          });
        }

        onNavigationComplete?.(newsletterId);
      } catch (error) {
        log.error(
          'Navigation failed',
          {
            action: 'navigation_error',
            metadata: { newsletterId },
          },
          error instanceof Error ? error : new Error(String(error))
        );

        // Revert local state on error
        setLocalCurrentId(currentNewsletterId);
      } finally {
        setIsNavigating(false);
        pendingNavigationRef.current = null;
      }
    },
    [
      isNavigating,
      localCurrentId,
      currentNewsletterId,
      navigate,
      log,
      enableMetrics,
      onNavigationStart,
      onNavigationComplete,
      onNavigationPrevented,
    ]
  );

  // Debounced navigation function
  const debouncedNavigate = useDebouncedCallback((newsletterId: string) => {
    performNavigation(newsletterId);
  }, debounceDelay);

  // Public navigation function
  const navigateToNewsletter = useCallback(
    (newsletterId: string) => {
      if (!newsletterId || newsletterId === localCurrentId) {
        return;
      }

      // Cancel any pending navigation
      if (pendingNavigationRef.current && pendingNavigationRef.current !== newsletterId) {
        if (enableMetrics) {
          navigationMetrics.current.preventedNavigations++;
        }
      }

      pendingNavigationRef.current = newsletterId;

      // Preload data while debouncing
      if (enablePreloading) {
        preloadNewsletter(newsletterId);
      }

      // Perform debounced navigation
      debouncedNavigate(newsletterId);
    },
    [localCurrentId, debouncedNavigate, preloadNewsletter, enablePreloading, enableMetrics]
  );

  // Navigate to previous newsletter
  const navigateToPrevious = useCallback(() => {
    const previousId = navigationState.navigateToPrevious();
    if (previousId) {
      navigateToNewsletter(previousId);
    }
  }, [navigationState, navigateToNewsletter]);

  // Navigate to next newsletter
  const navigateToNext = useCallback(() => {
    const nextId = navigationState.navigateToNext();
    if (nextId) {
      navigateToNewsletter(nextId);
    }
  }, [navigationState, navigateToNewsletter]);

  // Preload adjacent newsletters when navigation state changes
  useEffect(() => {
    if (!enablePreloading) return;

    const { previousNewsletter, nextNewsletter } = navigationState;

    // Preload previous newsletter
    if (previousNewsletter) {
      preloadNewsletter(previousNewsletter.id);
    }

    // Preload next newsletter
    if (nextNewsletter) {
      preloadNewsletter(nextNewsletter.id);
    }
  }, [
    navigationState.previousNewsletter,
    navigationState.nextNewsletter,
    navigationState,
    preloadNewsletter,
    enablePreloading,
  ]);

  // Can navigate check
  const canNavigate = !isNavigating && !pendingNavigationRef.current;

  return {
    navigateToNewsletter,
    navigateToPrevious,
    navigateToNext,
    isNavigating,
    canNavigate,
    currentNewsletterId: localCurrentId,
    navigationState,
    metrics: navigationMetrics.current,
  };
};

/**
 * Hook for keyboard navigation with debouncing
 */
export const useKeyboardNavigation = (
  currentNewsletterId: string | null,
  options: DebouncedNavigationOptions & { enabled?: boolean } = {}
) => {
  const { navigateToPrevious, navigateToNext, canNavigate } = useDebouncedNewsletterNavigation(
    currentNewsletterId,
    options
  );

  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check for modifier keys
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (!canNavigate) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'p':
        case 'P':
          event.preventDefault();
          navigateToPrevious();
          break;
        case 'ArrowRight':
        case 'n':
        case 'N':
          event.preventDefault();
          navigateToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigateToPrevious, navigateToNext, canNavigate, enabled]);
};

/**
 * Hook for swipe navigation on mobile devices
 */
export const useSwipeNavigation = (
  currentNewsletterId: string | null,
  options: DebouncedNavigationOptions & {
    swipeThreshold?: number;
    enabled?: boolean;
  } = {}
) => {
  const { swipeThreshold = 50, enabled = true, ...navigationOptions } = options;

  const { navigateToPrevious, navigateToNext, canNavigate } = useDebouncedNewsletterNavigation(
    currentNewsletterId,
    navigationOptions
  );

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartX.current = event.touches[0].clientX;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      touchEndX.current = event.changedTouches[0].clientX;

      if (!canNavigate) return;

      const swipeDistance = touchEndX.current - touchStartX.current;

      if (Math.abs(swipeDistance) < swipeThreshold) {
        return;
      }

      if (swipeDistance > 0) {
        // Swipe right - go to previous
        navigateToPrevious();
      } else {
        // Swipe left - go to next
        navigateToNext();
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, canNavigate, navigateToPrevious, navigateToNext, swipeThreshold]);
};

/**
 * Combined navigation hook with all features
 */
export const useOptimizedNewsletterNavigation = (
  currentNewsletterId: string | null,
  options: DebouncedNavigationOptions & {
    enableKeyboard?: boolean;
    enableSwipe?: boolean;
    swipeThreshold?: number;
  } = {}
) => {
  const {
    enableKeyboard = true,
    enableSwipe = true,
    swipeThreshold = 50,
    ...navigationOptions
  } = options;

  const navigation = useDebouncedNewsletterNavigation(currentNewsletterId, navigationOptions);

  // Add keyboard navigation
  useKeyboardNavigation(currentNewsletterId, {
    ...navigationOptions,
    enabled: enableKeyboard,
  });

  // Add swipe navigation
  useSwipeNavigation(currentNewsletterId, {
    ...navigationOptions,
    swipeThreshold,
    enabled: enableSwipe,
  });

  return navigation;
};
