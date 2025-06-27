import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterService } from '@common/services';
import { useLogger } from '@common/utils/logger/useLogger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes stale time
const CACHE_TIME = 60 * 60 * 1000; // 1 hour cache time
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes refetch interval
const DEBOUNCE_DELAY = 500; // 500ms debounce for invalidations

interface UnreadCountData {
  total: number;
  bySource: Record<string, number>;
}

/**
 * Optimized hook for fetching unread newsletter counts
 * Fetches all counts in a single query and uses React Query's select for per-source counts
 * Implements debouncing to reduce database queries
 */
export const useUnreadCount = (sourceId?: string | null) => {
  const log = useLogger('useUnreadCount');
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const initialLoadComplete = useRef(false);
  const previousCount = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Single query key for all unread count data
  const queryKey = useMemo(() => {
    if (!user?.id) {
      return ['unreadCount', 'all', null];
    }
    return ['unreadCount', 'all', user.id];
  }, [user?.id]);

  // Selector function to extract the needed count
  const selectCount = useCallback(
    (data: UnreadCountData | undefined): number => {
      if (!data) return 0;

      if (sourceId) {
        return data.bySource[sourceId] || 0;
      }

      return data.total;
    },
    [sourceId]
  );

  // Single query that fetches all unread counts
  const {
    data: unreadCount = 0,
    isLoading,
    isError,
    error,
  } = useQuery<UnreadCountData, Error, number>({
    queryKey,
    queryFn: async () => {
      if (!user) {
        log.debug('No user, returning empty unread count data', {
          action: 'fetch_unread_count_no_user',
        });
        return { total: 0, bySource: {} };
      }

      log.debug('Fetching all unread counts', {
        action: 'fetch_unread_count_start',
        metadata: { userId: user.id },
      });

      try {
        // Fetch both total and per-source counts in parallel
        const [totalResult, bySourceResult] = await Promise.all([
          newsletterService.getUnreadCount(),
          newsletterService.getUnreadCountBySource(),
        ]);

        const total = totalResult || 0;
        const bySource = bySourceResult || {};

        const result = { total, bySource };

        log.debug('Unread count result', {
          action: 'fetch_unread_count_result',
          metadata: {
            total,
            sourceCount: Object.keys(bySource).length,
            sourceId,
            count: sourceId ? bySource[sourceId] || 0 : total,
          },
        });

        return result;
      } catch (error) {
        log.error(
          'Error fetching unread counts',
          {
            action: 'fetch_unread_count_error',
            metadata: { userId: user.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    },
    select: selectCount,
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    networkMode: 'always',
  });

  // Track initial load
  useEffect(() => {
    if (!isLoading && !initialLoadComplete.current) {
      initialLoadComplete.current = true;
      previousCount.current = unreadCount;
    }
  }, [isLoading, unreadCount]);

  // Only update the previous count when we have a stable value
  // This prevents the count from changing during rapid updates
  useEffect(() => {
    if (initialLoadComplete.current && unreadCount !== undefined) {
      previousCount.current = unreadCount;
    }
  }, [unreadCount]);

  // Debounced invalidation function
  const debouncedInvalidate = useCallback(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      log.debug('Invalidating unread count after debounce', {
        action: 'invalidate_unread_count_debounced',
      });

      // Single invalidation for all unread count data
      queryClient.invalidateQueries({
        queryKey: ['unreadCount', 'all'],
        exact: false,
        refetchType: 'active', // Only refetch active queries
      });
    }, DEBOUNCE_DELAY);
  }, [queryClient, log]);

  // Listen for newsletter updates and invalidate unread count with debouncing
  useEffect(() => {
    if (!user) return;

    const handleNewsletterUpdate = () => {
      log.debug('Newsletter update event received', {
        action: 'newsletter_update_event',
      });
      debouncedInvalidate();
    };

    // Listen for custom events from newsletter actions
    window.addEventListener('newsletter:read-status-changed', handleNewsletterUpdate);
    window.addEventListener('newsletter:archived', handleNewsletterUpdate);
    window.addEventListener('newsletter:deleted', handleNewsletterUpdate);

    return () => {
      window.removeEventListener('newsletter:read-status-changed', handleNewsletterUpdate);
      window.removeEventListener('newsletter:archived', handleNewsletterUpdate);
      window.removeEventListener('newsletter:deleted', handleNewsletterUpdate);

      // Clear debounce timeout on cleanup
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, debouncedInvalidate, log]);

  // Return 0 during initial load, then return actual count or fallback to previous count
  const displayCount =
    unreadCount !== undefined
      ? unreadCount
      : previousCount.current !== null
        ? previousCount.current
        : 0;

  return {
    unreadCount: displayCount,
    isLoading: !initialLoadComplete.current && isLoading,
    isError,
    error,
    invalidateUnreadCount: debouncedInvalidate,
  };
};

/**
 * Hook to prefetch all unread counts
 * Useful for warming the cache before navigation
 */
export const usePrefetchUnreadCounts = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const log = useLogger('usePrefetchUnreadCounts');

  const prefetchCounts = useCallback(async () => {
    if (!user) return;

    const queryKey = ['unreadCount', 'all', user.id];

    // Check if data is already fresh
    const state = queryClient.getQueryState(queryKey);
    if (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < STALE_TIME) {
      log.debug('Unread counts are fresh, skipping prefetch', {
        action: 'prefetch_skip',
        metadata: {
          dataAge: Date.now() - state.dataUpdatedAt,
          staleTime: STALE_TIME,
        },
      });
      return; // Data is fresh, no need to prefetch
    }

    log.debug('Prefetching unread counts', {
      action: 'prefetch_start',
    });

    await queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const [total, bySource] = await Promise.all([
          newsletterService.getUnreadCount(),
          newsletterService.getUnreadCountBySource(),
        ]);

        return { total, bySource };
      },
      staleTime: STALE_TIME,
    });
  }, [user, queryClient, log]);

  return { prefetchUnreadCounts: prefetchCounts };
};
