import { useLogger } from '@common/utils/logger/useLogger';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { newsletterService } from '../../services';
import { useAuth } from '../../contexts/AuthContext';
import { NewsletterWithRelations } from '../../types';
import { NewsletterFilter } from '../../types/cache';
import { queryKeyFactory } from '../../utils/queryKeyFactory';

export interface UseInfiniteNewslettersOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
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
    refetchOnWindowFocus = false,
    staleTime = 30000, // 30 seconds
    pageSize = 20,
    debug = false,
  } = options;

  // Track current page for debugging/analytics
  const [currentPage, setCurrentPage] = useState(1);

  // Generate query key with filters
  const queryKey = useMemo(() => queryKeyFactory.newsletters.infinite(filters), [filters]);

  // Build API query parameters from filters
  const baseQueryParams = useMemo(() => {
    return {
      search: filters.search,
      isRead: filters.isRead,
      isArchived: filters.isArchived,
      isLiked: filters.isLiked,
      tagIds: filters.tagIds,
      sourceIds: filters.sourceIds,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: pageSize,
      orderBy: filters.orderBy || 'received_at',
      ascending: filters.ascending ?? false,
      includeRelations: true,
      includeTags: true,
      includeSource: true,
    };
  }, [filters, pageSize]);

  // Infinite query for newsletters
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam = 0 }) => {
        if (debug) {
          log.debug('Fetching newsletters page', {
            action: 'fetch_page',
            metadata: {
              page: pageParam / pageSize + 1,
              offset: pageParam,
              filters,
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
                metadata: { pageParam, pageSize, filters },
              },
              err instanceof Error ? err : new Error(String(err))
            );
          }
          throw err;
        }
      },
      enabled: enabled && !!user,
      getNextPageParam: (lastPage, allPages) => {
        // Calculate next offset based on current data
        const totalFetched = allPages.reduce((sum, page) => sum + page.data.length, 0);

        // Return next offset if there's more data, otherwise undefined
        return lastPage.hasMore && totalFetched < lastPage.count ? totalFetched : undefined;
      },
      initialPageParam: 0,
      staleTime,
      refetchOnWindowFocus,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    });

  // Flatten all pages into a single array of newsletters
  const newsletters = useMemo(() => {
    if (!data?.pages) return [];

    const allNewsletters = data.pages.flatMap((page) => page.data);

    if (debug) {
      log.debug('Total newsletters loaded', {
        action: 'calculate_total_newsletters',
        metadata: {
          count: allNewsletters.length,
          pages: data.pages.length,
          lastPageSize: data.pages[data.pages.length - 1]?.data.length || 0,
        },
      });
    }

    return allNewsletters;
  }, [data?.pages, debug, log]);

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
    if (hasNextPage && !isFetchingNextPage) {
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
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, debug, newsletters.length, totalCount, log]);

  // Enhanced refetch with debug logging
  const handleRefetch = useCallback(() => {
    if (debug) {
      log.debug('Refetching newsletters', {
        action: 'refetch_newsletters',
        metadata: {
          filters,
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
