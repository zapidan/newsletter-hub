import { useLogger } from '@common/utils/logger/useLogger';
import { normalizeNewsletterFilter } from '@common/utils/newsletterUtils';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { newsletterService } from '../../services';
import { NewsletterWithRelations } from '../../types';
import { NewsletterFilter } from '../../types/cache';
import { queryKeyFactory } from '../../utils/queryKeyFactory';

export interface UseInfiniteNewslettersOptions {
  enabled?: boolean;
  _refetchOnWindowFocus?: boolean;
  _refetchOnMount?: boolean;
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

  const {
    enabled = true,
    _refetchOnWindowFocus = false,
    _refetchOnMount = false,
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

  // Throttle debug logging to prevent excessive logs during rapid updates
  const lastDebugLogRef = useRef<Record<string, number>>({});
  const DEBUG_THROTTLE_MS = 100; // Only log debug messages every 100ms

  const throttledDebug = useCallback(
    (action: string, message: string, metadata?: Record<string, unknown>) => {
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

  // Determine if query should run
  const shouldRunQuery = enabled && !!user;

  // Normalize filters to camelCase for query and cache
  const normalizedFilters = useMemo(() => normalizeNewsletterFilter(filters), [filters]);

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
    filters,
    normalizedFilters,
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
      orderDirection: normalizedFilters.orderDirection || 'desc',
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
    normalizedFilters,
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
  }, [enabled, user, throttledDebug]);

  // Infinite query for newsletters
  // In useInfiniteNewsletters.ts
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam = 0 }) => {
        if (isFetchingRef.current) {
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
          // Use NewsletterService as the single source of truth
          // The service will handle tag filtering internally
          const result = await newsletterService.getAll(queryParams);

          throttledDebug('fetch_page_success', 'Newsletters fetched successfully', {
            count: result.data.length,
            total: result.count,
            hasMore: result.hasMore,
            page: pageParam / pageSize + 1,
          });

          return result;
        } catch (err) {
          throttledDebug('fetch_page_error', 'Failed to fetch newsletters', {
            pageParam,
            pageSize,
            filters: JSON.stringify(normalizedFilters),
          });
          throw err;
        } finally {
          isFetchingRef.current = false;
        }
      },

      enabled: shouldRunQuery,
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
      staleTime: _staleTime, // Use configurable stale time from options
      refetchOnWindowFocus: _refetchOnWindowFocus,
      refetchOnMount: _refetchOnMount, // Can be overridden via options
      refetchOnReconnect: false, // Prevent refetch on reconnect
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    });

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
    user,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    log,
    queryKey,
    data,
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
  }, [data, debug, log]);

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
    data,
  ]);

  // Update current page when data changes
  useMemo(() => {
    if (data?.pages) {
      const newCurrentPage = data.pages.length;
      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage);
      }
    }
  }, [data, currentPage]);

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
    normalizedFilters,
    newsletters.length,
    log,
  ]);

  return {
    newsletters,
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
