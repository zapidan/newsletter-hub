import { useLogger } from '@common/utils/logger/useLogger';
import { normalizeNewsletterFilter } from '@common/utils/newsletterUtils';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { newsletterService } from '../../services';
import { NewsletterWithRelations } from '../../types';
import { NewsletterFilter } from '../../types/cache';
import { queryKeyFactory } from '../../utils/queryKeyFactory';
import { useFilters } from '../../contexts/FilterContext';

export interface UseInfiniteNewslettersOptions {
  enabled?: boolean;
  _refetchOnWindowFocus?: boolean;
  _staleTime?: number;
  pageSize?: number;
  debug?: boolean;
}

export interface UseInfiniteNewslettersReturn {
  newsletters: NewsletterWithRelations[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  totalCount: number;
  pageCount: number;
  currentPage: number;
}

/**
 * Custom hook for infinite loading of newsletters with pagination
 * Manages the business logic for fetching, caching, and paginating newsletter data
 */
export const useInfiniteNewsletters = (
  filters: NewsletterFilter = {},
  options: UseInfiniteNewslettersOptions = {}
): UseInfiniteNewslettersReturn => {
  const { user } = useAuth();
  const log = useLogger('useInfiniteNewsletters');
  const queryClient = useQueryClient();
  // Make useFilters optional for backward compatibility with tests
  let reportNavigationHealth = () => {};
  let effectiveUseLocalTagFiltering = false;

  try {
    const filtersContext = useFilters();
    reportNavigationHealth = filtersContext.reportNavigationHealth;
    effectiveUseLocalTagFiltering = filtersContext.effectiveUseLocalTagFiltering;
  } catch (error) {
    // FilterProvider not available (e.g., in tests)
    // Use default values
  }
  const {
    enabled = true,
    _refetchOnWindowFocus = false,
    _staleTime = 30000, // 30 seconds
    pageSize = 20,
    debug = false,
  } = options;

  // Track current page for debugging/analytics
  const [currentPage, setCurrentPage] = useState(1);

  // Track if component is mounted to prevent queries after unmount
  const isMounted = useRef(true);

  // Track if currently fetching to prevent multiple simultaneous requests
  const isFetchingRef = useRef(false);

  // Determine if query should run
  const shouldRunQuery = enabled && !!user;

  // Normalize filters to camelCase for query and cache
  const normalizedFilters = useMemo(() => normalizeNewsletterFilter(filters), [filters]);

  // Track navigation state to prevent stale queries
  const navigationStateRef = useRef<string>('');

  // Generate navigation state key for cache stability
  const navigationState = useMemo(() => {
    const state = JSON.stringify({
      tagIds: normalizedFilters.tagIds?.sort(),
      sourceIds: normalizedFilters.sourceIds?.sort(),
      isRead: normalizedFilters.isRead,
      isArchived: normalizedFilters.isArchived,
      isLiked: normalizedFilters.isLiked,
    });
    navigationStateRef.current = state;
    return state;
  }, [
    normalizedFilters.tagIds?.join(','),
    normalizedFilters.sourceIds?.join(','),
    normalizedFilters.isRead,
    normalizedFilters.isArchived,
    normalizedFilters.isLiked,
  ]);

  // Throttle debug logging to prevent excessive logs during rapid updates
  const lastDebugLogRef = useRef<Record<string, number>>({});
  const DEBUG_THROTTLE_MS = 100; // Only log debug messages every 100ms

  const throttledDebug = useCallback(
    (action: string, message: string, metadata?: any) => {
      if (!debug) return;

      const now = Date.now();
      const lastLog = lastDebugLogRef.current[action] || 0;

      if (now - lastLog > DEBUG_THROTTLE_MS) {
        log.debug(message, { action, metadata });
        lastDebugLogRef.current[action] = now;
      }
    },
    [debug, log]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Generate query key with normalized filters
  const queryKey = useMemo(() => {
    const key = queryKeyFactory.newsletters.infinite(normalizedFilters);
    throttledDebug('query_key_generated', 'Generated query key', {
      originalFilters: JSON.stringify(filters),
      normalizedFilters: JSON.stringify(normalizedFilters),
      queryKey: JSON.stringify(key),
    });
    return key;
  }, [
    normalizedFilters.search,
    normalizedFilters.isRead,
    normalizedFilters.isArchived,
    normalizedFilters.isLiked,
    normalizedFilters.tagIds?.join(','),
    normalizedFilters.sourceIds?.join(','),
    normalizedFilters.dateFrom,
    normalizedFilters.dateTo,
    normalizedFilters.orderBy,
    normalizedFilters.ascending,
    throttledDebug,
  ]);

  // Build API query parameters from normalized filters - memoize to prevent unnecessary re-renders
  const baseQueryParams = useMemo(() => {
    const params = {
      search: normalizedFilters.search,
      isRead: normalizedFilters.isRead,
      isArchived: normalizedFilters.isArchived,
      isLiked: normalizedFilters.isLiked,
      tagIds: normalizedFilters.tagIds ? [...normalizedFilters.tagIds] : undefined, // Create a new array to ensure stability
      sourceIds: normalizedFilters.sourceIds ? [...normalizedFilters.sourceIds] : undefined, // Create a new array to ensure stability
      dateFrom: normalizedFilters.dateFrom,
      dateTo: normalizedFilters.dateTo,
      limit: pageSize,
      orderBy: normalizedFilters.orderBy || 'received_at',
      ascending: normalizedFilters.ascending ?? false,
      includeRelations: true,
      includeTags: true,
      includeSource: true,
    };

    throttledDebug('base_query_params_built', 'Base query params built', {
      params: JSON.stringify(params),
      filters: JSON.stringify(normalizedFilters),
    });

    return params;
  }, [
    normalizedFilters.search,
    normalizedFilters.isRead,
    normalizedFilters.isArchived,
    normalizedFilters.isLiked,
    normalizedFilters.tagIds?.join(','),
    normalizedFilters.sourceIds?.join(','),
    normalizedFilters.dateFrom,
    normalizedFilters.dateTo,
    normalizedFilters.orderBy,
    normalizedFilters.ascending,
    pageSize,
    throttledDebug,
  ]);

  // Debug: Log enabled condition
  useEffect(() => {
    throttledDebug('enabled_condition_check', 'Enabled condition check', {
      enabled,
      hasUser: !!user,
      userId: user?.id,
      enabledCondition: enabled && !!user,
    });
  }, [enabled, user?.id, throttledDebug]);

  // Infinite query for newsletters
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      // Add timeout and retry configuration for better resilience
      retry: (failureCount, error) => {
        // Don't retry on timeout for tag filtering queries to prevent cascading delays
        if (normalizedFilters.tagIds?.length && failureCount >= 1) {
          throttledDebug('skip_retry_tag_filter', 'Skipping retry for tag filter query', {
            failureCount,
            tagCount: normalizedFilters.tagIds.length,
          });
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: 1000,
      queryFn: async ({ pageParam = 0 }) => {
        // Prevent multiple simultaneous requests
        if (isFetchingRef.current) {
          throttledDebug('skip_fetch_already_fetching', 'Skipping fetch - already fetching', {
            pageParam,
          });
          return { data: [], count: 0, hasMore: false };
        }

        isFetchingRef.current = true;

        throttledDebug('fetch_page', 'Fetching newsletters page', {
          page: pageParam / pageSize + 1,
          offset: pageParam,
          filters: JSON.stringify(normalizedFilters),
        });

        const queryParams = {
          ...baseQueryParams,
          offset: pageParam,
        };

        try {
          // Add timing measurement for navigation health monitoring
          const startTime = performance.now();

          // Add timeout for tag filtering queries to prevent test timeouts
          const timeoutMs = normalizedFilters.tagIds?.length ? 15000 : 30000;
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
          );

          const result = (await Promise.race([
            newsletterService.getAll(queryParams),
            timeoutPromise,
          ])) as any;

          // Report successful navigation health
          const responseTime = performance.now() - startTime;
          reportNavigationHealth(true, responseTime);

          throttledDebug('fetch_page_success', 'Newsletters fetched successfully', {
            count: result.data.length,
            total: result.count,
            hasMore: result.hasMore,
            page: pageParam / pageSize + 1,
            resultKeys: Object.keys(result),
            resultDataKeys: result.data ? Object.keys(result.data[0] || {}) : [],
          });

          return result;
        } catch (err) {
          const isTimeout = err instanceof Error && err.message === 'Query timeout';

          throttledDebug('fetch_page_error', 'Failed to fetch newsletters', {
            pageParam,
            pageSize,
            filters: JSON.stringify(normalizedFilters),
            isTimeout,
            hasTagFilters: !!normalizedFilters.tagIds?.length,
          });

          // Report navigation health failure
          reportNavigationHealth(false);

          // For timeout errors with tag filtering, return empty results to prevent cascading failures
          if (isTimeout && normalizedFilters.tagIds?.length) {
            log.warn('Tag filtering query timed out, returning empty results', {
              action: 'tag_filter_timeout',
              metadata: {
                tagCount: normalizedFilters.tagIds.length,
                pageParam,
              },
            });
            return { data: [], count: 0, hasMore: false };
          }

          throw err;
        } finally {
          isFetchingRef.current = false;
        }
      },
      enabled: shouldRunQuery,
      // Enhanced cache configuration for navigation stability
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      // Use navigation state in query key for better cache isolation
      queryKeyHashFn: (queryKey) => {
        return JSON.stringify([...queryKey, navigationState]);
      },
      getNextPageParam: (lastPage, allPages) => {
        // Check if there's more data available
        if (!lastPage.hasMore) {
          if (debug) {
            log.debug('No more pages available - hasMore is false', {
              action: 'no_more_pages',
              metadata: {
                totalCount: lastPage.count,
                currentPageDataLength: lastPage.data.length,
                hasMore: lastPage.hasMore,
                totalPages: allPages.length,
                totalFetched: allPages.reduce((sum, page) => sum + page.data.length, 0),
              },
            });
          }
          return undefined;
        }

        // Calculate next offset based on current data
        const totalFetched = allPages.reduce((sum, page) => sum + page.data.length, 0);

        // Return next offset if there's more data, otherwise undefined
        return lastPage.hasMore && totalFetched < lastPage.count ? totalFetched : undefined;
      },
      initialPageParam: 0,
    });

  // Client-side tag filtering when using fallback mode
  const applyClientSideTagFilter = useCallback(
    (newsletters: NewsletterWithRelations[]) => {
      if (!effectiveUseLocalTagFiltering || !normalizedFilters.tagIds?.length) {
        return newsletters;
      }

      return newsletters.filter((newsletter) => {
        // Check if newsletter has all required tags
        const newsletterTagIds = newsletter.tags?.map((tag) => tag.id) || [];
        return normalizedFilters.tagIds!.every((requiredTagId) =>
          newsletterTagIds.includes(requiredTagId)
        );
      });
    },
    [effectiveUseLocalTagFiltering, normalizedFilters.tagIds]
  );

  // Simple cache invalidation only when necessary
  const previousFiltersRef = useRef<string>('');
  useEffect(() => {
    // Only invalidate for major filter changes, not minor tag updates
    const currentFiltersStr = JSON.stringify({
      isRead: normalizedFilters.isRead,
      isArchived: normalizedFilters.isArchived,
      isLiked: normalizedFilters.isLiked,
      sourceIds: normalizedFilters.sourceIds,
    });

    if (previousFiltersRef.current && previousFiltersRef.current !== currentFiltersStr) {
      log.debug('Major filter change detected, invalidating cache', {
        action: 'invalidate_cache_on_major_filter_change',
        metadata: {
          oldFilters: previousFiltersRef.current,
          newFilters: currentFiltersStr,
        },
      });

      queryClient.invalidateQueries({
        queryKey: ['newsletters'],
        exact: false,
      });
    }

    previousFiltersRef.current = currentFiltersStr;
  }, [
    normalizedFilters.isRead,
    normalizedFilters.isArchived,
    normalizedFilters.isLiked,
    normalizedFilters.sourceIds,
    queryClient,
    log,
  ]);

  // Debug: Log query state - optimized to reduce re-renders
  useEffect(() => {
    if (debug) {
      const pagesCount = data?.pages?.length || 0;
      const totalNewsletters = data?.pages?.reduce((sum, page) => sum + page.data.length, 0) || 0;

      log.debug('Query state updated', {
        action: 'query_state_updated',
        metadata: {
          enabled: enabled && !!user,
          hasUser: !!user,
          userId: user?.id,
          isLoading,
          hasError: !!error,
          hasData: !!data,
          pagesCount,
          totalNewsletters,
          hasNextPage,
          isFetchingNextPage,
          queryKey: JSON.stringify(queryKey),
        },
      });
    }
  }, [
    debug,
    enabled,
    user?.id,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    log,
    queryKey,
    data?.pages?.length,
  ]);

  // Flatten all pages into a single array of newsletters
  const newsletters = useMemo(() => {
    if (!data?.pages) {
      if (debug) {
        log.debug('No data pages available', {
          action: 'no_data_pages',
          metadata: {
            hasData: !!data,
            dataKeys: data ? Object.keys(data) : [],
            pagesLength: data?.pages?.length || 0,
          },
        });
      }
      return [];
    }

    const allNewsletters = data.pages.flatMap((page) => page.data);

    if (debug) {
      log.debug('Total newsletters loaded', {
        action: 'calculate_total_newsletters',
        metadata: {
          count: allNewsletters.length,
          pages: data.pages.length,
          lastPageSize: data.pages[data.pages.length - 1]?.data.length || 0,
          firstPageData:
            data.pages[0]?.data?.slice(0, 2).map((n) => ({ id: n.id, title: n.title })) || [],
          allPagesDataLengths: data.pages.map((page) => page.data?.length || 0),
        },
      });
    }

    return allNewsletters;
  }, [data?.pages?.length, debug, log]);

  // Calculate metadata
  const totalCount = data?.pages[0]?.count || 0;
  const pageCount = Math.ceil(totalCount / pageSize);

  // Debug logging for hasNextPage calculation - optimized to reduce re-renders
  useEffect(() => {
    if (debug) {
      const pagesLength = data?.pages?.length || 0;
      const lastPageHasMore = data?.pages?.[data.pages.length - 1]?.hasMore;
      const lastPageDataLength = data?.pages?.[data.pages.length - 1]?.data?.length || 0;

      log.debug('hasNextPage calculation', {
        action: 'has_next_page_calculation',
        metadata: {
          hasNextPage,
          totalCount,
          currentNewsletters: newsletters.length,
          pageCount,
          currentPage,
          isFetchingNextPage,
          pages: pagesLength,
          lastPageHasMore,
          lastPageDataLength,
        },
      });
    }
  }, [
    hasNextPage,
    totalCount,
    newsletters.length,
    pageCount,
    currentPage,
    isFetchingNextPage,
    debug,
    log,
    data?.pages?.length,
  ]);

  // Update current page when data changes
  useMemo(() => {
    if (data?.pages) {
      const newCurrentPage = data.pages.length;
      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage);
      }
    }
  }, [data?.pages?.length, currentPage]);

  // Enhanced fetch next page with error handling
  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchingRef.current) {
      if (debug) {
        log.debug('Loading next page', {
          action: 'load_next_page',
          metadata: {
            currentNewsletters: newsletters.length,
            totalCount,
            hasNextPage,
          },
        });
      }
      fetchNextPage();
    } else if (debug) {
      log.debug('Skipping next page load', {
        action: 'skip_next_page_load',
        metadata: {
          hasNextPage,
          isFetchingNextPage,
          isFetching: isFetchingRef.current,
        },
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, debug, newsletters.length, totalCount, log]);

  // Enhanced refetch with debug logging
  const handleRefetch = useCallback(() => {
    if (debug) {
      log.debug('Refetching newsletters', {
        action: 'refetch_newsletters',
        metadata: {
          filters: JSON.stringify(normalizedFilters),
          currentCount: newsletters.length,
        },
      });
    }

    setCurrentPage(1);
    return refetch();
  }, [
    refetch,
    debug,
    normalizedFilters.search,
    normalizedFilters.isRead,
    normalizedFilters.isArchived,
    normalizedFilters.isLiked,
    normalizedFilters.tagIds,
    normalizedFilters.sourceIds,
    normalizedFilters.dateFrom,
    normalizedFilters.dateTo,
    normalizedFilters.orderBy,
    normalizedFilters.ascending,
    newsletters.length,
    log,
  ]);

  // Apply client-side tag filtering when in fallback mode
  const filteredNewsletters = applyClientSideTagFilter(newsletters);

  return {
    newsletters: filteredNewsletters,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: error as Error | null,
    hasNextPage: hasNextPage || false,
    isFetchingNextPage,
    fetchNextPage: handleFetchNextPage,
    refetch: handleRefetch,
    totalCount,
    pageCount,
    currentPage,
  };
};
