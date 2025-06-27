import { useLogger } from '@common/utils/logger/useLogger';
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
    _staleTime = 30000, // 30 seconds
    pageSize = 20,
    debug = false,
  } = options;

  // Track current page for debugging/analytics
  const [currentPage, setCurrentPage] = useState(1);

  // Track if we're currently fetching to prevent multiple simultaneous requests
  const isFetchingRef = useRef(false);
  const lastQueryKeyRef = useRef<string>('');

  // Generate query key with filters - use JSON.stringify for stable comparison
  const queryKey = useMemo(() => {
    const key = queryKeyFactory.newsletters.infinite(filters);
    const keyString = JSON.stringify(key);

    if (debug) {
      log.debug('Query key generated', {
        action: 'query_key_generated',
        metadata: {
          key,
          keyString,
          filters: JSON.stringify(filters),
          hasChanged: lastQueryKeyRef.current !== keyString,
        },
      });
    }

    // Track if the query key has changed
    const _hasChanged = lastQueryKeyRef.current !== keyString;
    lastQueryKeyRef.current = keyString;

    return key;
  }, [filters, debug, log]);

  // Build API query parameters from filters - memoize to prevent unnecessary re-renders
  const baseQueryParams = useMemo(() => {
    const params = {
      search: filters.search,
      isRead: filters.isRead,
      isArchived: filters.isArchived,
      isLiked: filters.isLiked,
      tagIds: filters.tagIds ? [...filters.tagIds] : undefined, // Create a new array to ensure stability
      sourceIds: filters.sourceIds ? [...filters.sourceIds] : undefined, // Create a new array to ensure stability
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: pageSize,
      orderBy: filters.orderBy || 'received_at',
      ascending: filters.ascending ?? false,
      includeRelations: true,
      includeTags: true,
      includeSource: true,
    };

    if (debug) {
      log.debug('Base query params built', {
        action: 'base_query_params_built',
        metadata: {
          params: JSON.stringify(params),
          filters: JSON.stringify(filters),
        },
      });
    }

    return params;
  }, [
    filters,
    pageSize,
    debug,
    log
  ]);

  // Debug: Log enabled condition
  useEffect(() => {
    if (debug) {
      log.debug('Enabled condition check', {
        action: 'enabled_condition_check',
        metadata: {
          enabled,
          hasUser: !!user,
          userId: user?.id,
          enabledCondition: enabled && !!user,
        },
      });
    }
  }, [debug, enabled, user, log]);

  // Infinite query for newsletters
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam = 0 }) => {
        // Prevent multiple simultaneous requests
        if (isFetchingRef.current) {
          if (debug) {
            log.debug('Skipping fetch - already fetching', {
              action: 'skip_fetch_already_fetching',
              metadata: { pageParam },
            });
          }
          return { data: [], count: 0, hasMore: false };
        }

        isFetchingRef.current = true;

        if (debug) {
          log.debug('Fetching newsletters page', {
            action: 'fetch_page',
            metadata: {
              page: pageParam / pageSize + 1,
              offset: pageParam,
              filters: JSON.stringify(filters),
            },
          });
        }

        const queryParams = {
          ...baseQueryParams,
          offset: pageParam,
        };

        try {
          const result = await newsletterService.getAll(queryParams);

          if (debug) {
            log.debug('Newsletters fetched successfully', {
              action: 'fetch_page_success',
              metadata: {
                count: result.data.length,
                total: result.count,
                hasMore: result.hasMore,
                page: pageParam / pageSize + 1,
                resultKeys: Object.keys(result),
                resultDataKeys: result.data ? Object.keys(result.data[0] || {}) : [],
              },
            });
          }

          return result;
        } catch (err) {
          if (debug) {
            log.error(
              'Failed to fetch newsletters',
              {
                action: 'fetch_page_error',
                metadata: { pageParam, pageSize, filters: JSON.stringify(filters) },
              },
              err instanceof Error ? err : new Error(String(err))
            );
          }
          throw err;
        } finally {
          isFetchingRef.current = false;
        }
      },
      enabled: enabled && !!user,
      getNextPageParam: (lastPage, allPages) => {
        // Calculate next offset based on current data
        const totalFetched = allPages.reduce((sum, page) => sum + page.data.length, 0);

        // Return next offset if there's more data, otherwise undefined
        const shouldFetchMore = lastPage.hasMore && totalFetched < lastPage.count;
        const nextOffset = shouldFetchMore ? totalFetched : undefined;

        if (debug) {
          log.debug('Next page param calculated', {
            action: 'next_page_param_calculated',
            metadata: {
              totalFetched,
              totalCount: lastPage.count,
              hasMore: lastPage.hasMore,
              shouldFetchMore,
              nextOffset,
              lastPageKeys: Object.keys(lastPage),
              lastPageDataLength: lastPage.data?.length || 0,
              allPagesLength: allPages.length,
            },
          });
        }

        return nextOffset;
      },
      initialPageParam: 0,
      staleTime: 60000, // Increase stale time to 1 minute to prevent constant refetches
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Prevent refetch on mount if data exists
      refetchOnReconnect: false, // Prevent refetch on reconnect
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    });

  // Debug: Log query state
  useEffect(() => {
    if (debug) {
      log.debug('Query state updated', {
        action: 'query_state_updated',
        metadata: {
          enabled: enabled && !!user,
          hasUser: !!user,
          userId: user?.id,
          isLoading,
          hasError: !!error,
          hasData: !!data,
          pagesCount: data?.pages?.length || 0,
          totalNewsletters: data?.pages?.reduce((sum, page) => sum + page.data.length, 0) || 0,
          hasNextPage,
          isFetchingNextPage,
          queryKey: JSON.stringify(queryKey),
        },
      });
    }
  }, [debug, enabled, user, isLoading, error, data, hasNextPage, isFetchingNextPage, log, queryKey]);

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
          firstPageData: data.pages[0]?.data?.slice(0, 2).map(n => ({ id: n.id, title: n.title })) || [],
          allPagesDataLengths: data.pages.map(page => page.data?.length || 0),
        },
      });
    }

    return allNewsletters;
  }, [data, debug, log]);

  // Calculate metadata
  const totalCount = data?.pages[0]?.count || 0;
  const pageCount = Math.ceil(totalCount / pageSize);

  // Update current page when data changes
  useMemo(() => {
    if (data?.pages) {
      const newCurrentPage = data.pages.length;
      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage);
      }
    }
  }, [data?.pages, currentPage]);

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
          filters: JSON.stringify(filters),
          currentCount: newsletters.length,
        },
      });
    }

    setCurrentPage(1);
    return refetch();
  }, [refetch, debug, filters, newsletters.length, log]);

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
