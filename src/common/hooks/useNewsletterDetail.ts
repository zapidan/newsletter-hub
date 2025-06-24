import { AuthContext } from '@common/contexts/AuthContext';
import { NewsletterService } from '@common/services';
import { NewsletterWithRelations } from '@common/types';
import {
  getCacheManagerSafe,
  getQueriesData,
  getQueryData,
  getQueryState,
  prefetchQuery,
} from '@common/utils/cacheUtils';
import { useLogger } from '@common/utils/logger/useLogger';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useContext, useMemo } from 'react';

export interface UseNewsletterDetailOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  prefetchTags?: boolean;
  prefetchSource?: boolean;
}

export interface UseNewsletterDetailResult {
  newsletter: NewsletterWithRelations | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
  prefetchRelated: () => Promise<void>;
}

/**
 * Custom hook for fetching and caching newsletter details with optimized caching
 * and prefetching capabilities for improved performance
 */
export const useNewsletterDetail = (
  newsletterId: string,
  options: UseNewsletterDetailOptions = {}
) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus = false,
    prefetchTags = true,
    prefetchSource = true,
  } = options;

  // Initialize newsletter service
  const newsletterService = useMemo(() => {
    return new NewsletterService();
  }, []);

  // Fetch newsletter detail using the service
  const fetchNewsletterDetail = useCallback(async (): Promise<NewsletterWithRelations> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!newsletterId) {
      throw new Error('Newsletter ID is required');
    }

    try {
      const newsletter = await newsletterService.getNewsletter(newsletterId);

      if (!newsletter) {
        throw new Error('Newsletter not found');
      }

      return newsletter;
    } catch (error) {
      log.error(
        'Failed to fetch newsletter detail',
        {
          action: 'fetch_newsletter_detail',
          metadata: { newsletterId, userId: user.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }, [user, newsletterId, log, newsletterService]);

  // Main query for newsletter detail
  const query = useQuery({
    queryKey: queryKeyFactory.newsletters.detail(newsletterId),
    queryFn: fetchNewsletterDetail,
    enabled: enabled && !!user && !!newsletterId,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    refetchOnMount: false, // Prevent cascade refetching
    refetchOnReconnect: false, // Prevent refetch on reconnect
    // Optimistic updates - try to get data from newsletter lists first
    initialData: () => {
      const listsData = getQueriesData<
        NewsletterWithRelations[] | { data: NewsletterWithRelations[] }
      >(queryKeyFactory.newsletters.lists());

      for (const [, data] of listsData) {
        if (data) {
          // Handle both array and paginated response formats
          const newsletters = Array.isArray(data) ? data : data.data;
          if (Array.isArray(newsletters)) {
            const found = newsletters.find((n: NewsletterWithRelations) => n.id === newsletterId);
            if (found) {
              return found;
            }
          }
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      // Get the timestamp of when the list data was last updated
      const listsData = getQueriesData<
        NewsletterWithRelations[] | { data: NewsletterWithRelations[] }
      >(queryKeyFactory.newsletters.lists());

      let latestUpdate = 0;
      for (const [queryKey, data] of listsData) {
        if (data) {
          // Handle both array and paginated response formats
          const newsletters = Array.isArray(data) ? data : data.data;
          if (Array.isArray(newsletters)) {
            const found = newsletters.find((n: NewsletterWithRelations) => n.id === newsletterId);
            if (found) {
              const state = getQueryState(queryKey);
              latestUpdate = Math.max(latestUpdate, state?.dataUpdatedAt || 0);
            }
          }
        }
      }

      return latestUpdate || 0;
    },
    // Retry configuration
    retry: (failureCount, error: Error) => {
      // Don't retry on 404 or authentication errors
      if (error?.message?.includes('not found') || error?.message?.includes('authenticated')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Prefetch related data for better performance
  const prefetchRelated = useCallback(async (): Promise<void> => {
    if (!query.data || !user) return;

    const newsletter = query.data;
    const prefetchPromises: Promise<unknown>[] = [];

    // Prefetch tags if enabled and newsletter has tags
    if (prefetchTags && newsletter.tags && newsletter.tags.length > 0) {
      // Prefetch individual tag details
      newsletter.tags.forEach((tag: { id: string }) => {
        prefetchPromises.push(
          prefetchQuery(
            [...queryKeyFactory.newsletters.tag(tag.id)],
            async () => {
              // Use the service to fetch tag details
              const { tagApi } = await import('@common/api/tagApi');
              const tagData = await tagApi.getById(tag.id);
              if (!tagData) throw new Error('Tag not found');
              return tagData;
            },
            { staleTime: 10 * 60 * 1000 } // 10 minutes
          )
        );
      });

      // Prefetch newsletters with same tags
      const tagIds = newsletter.tags.map((t: { id: string }) => t.id);
      if (tagIds.length > 0) {
        prefetchPromises.push(
          prefetchQuery(
            [...queryKeyFactory.newsletters.list({ tagIds })],
            async () => {
              // Use the service to fetch newsletters by tags
              const newsletters = await newsletterService.getNewsletters({ tagIds });
              return newsletters.data || [];
            },
            { staleTime: 2 * 60 * 1000 } // 2 minutes
          )
        );
      }
    }

    // Prefetch source if enabled and newsletter has a source
    if (prefetchSource && newsletter.source) {
      prefetchPromises.push(
        prefetchQuery(
          [...queryKeyFactory.newsletters.source(newsletter.source.id)],
          async () => {
            // Use the service to fetch source details
            const { newsletterSourceApi } = await import('@common/api/newsletterSourceApi');
            const sourceData = await newsletterSourceApi.getById(newsletter.source!.id);
            if (!sourceData) throw new Error('Source not found');
            return sourceData;
          },
          { staleTime: 15 * 60 * 1000 } // 15 minutes
        )
      );

      // Prefetch other newsletters from same source
      prefetchPromises.push(
        prefetchQuery(
          [
            ...queryKeyFactory.newsletters.list({
              sourceId: newsletter.source.id,
            }),
          ],
          async () => {
            // Use the service to fetch newsletters by source
            const newsletters = await newsletterService.getNewsletters({
              sourceIds: [newsletter.source!.id]
            });
            return newsletters.data || [];
          },
          { staleTime: 2 * 60 * 1000 } // 2 minutes
        )
      );
    }

    // Execute all prefetch operations
    try {
      await Promise.allSettled(prefetchPromises);
    } catch (_) {
      log.warn('Some prefetch operations failed', {
        action: 'prefetch_operations',
        metadata: {
          newsletterId,
          prefetchTags,
          prefetchSource,
        },
      });
      // Don't throw - prefetching failures shouldn't break the main functionality
    }
  }, [query.data, user, prefetchTags, prefetchSource, log, newsletterId, newsletterService]);

  // Enhanced refetch that also updates cache manager
  const refetch = useCallback(() => {
    // Refetch the main query
    const refetchPromise = query.refetch();

    // Update cache manager performance metrics
    if (cacheManager && user) {
      // Note: warmCache method not available in SimpleCacheManager
      // This is for future enhancement
      refetchPromise.then(() => {
        // Could add cache warming functionality here in the future
      });
    }

    return refetchPromise;
  }, [query, user, cacheManager]);

  return {
    newsletter: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    isFetching: query.isFetching,
    refetch,
    prefetchRelated,
  };
};

/**
 * Hook for prefetching newsletter details without subscribing to the query
 * Useful for hover states and anticipatory loading
 */
export const usePrefetchNewsletterDetail = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();

  // Initialize newsletter service
  const newsletterService = useMemo(() => {
    return new NewsletterService();
  }, []);

  const prefetchNewsletter = useCallback(
    async (newsletterId: string, options: { priority?: boolean } = {}) => {
      if (!user || !newsletterId) return;

      const { priority = false } = options;

      // Check if already cached and fresh
      const existingData = getQueryData(queryKeyFactory.newsletters.detail(newsletterId));
      const queryState = getQueryState(queryKeyFactory.newsletters.detail(newsletterId));

      // If we have fresh data, no need to prefetch
      if (
        existingData &&
        queryState?.dataUpdatedAt &&
        Date.now() - queryState.dataUpdatedAt < 5 * 60 * 1000
      ) {
        return;
      }

      try {
        await prefetchQuery(
          queryKeyFactory.newsletters.detail(newsletterId),
          async () => {
            const newsletter = await newsletterService.getNewsletter(newsletterId);
            if (!newsletter) {
              throw new Error('Newsletter not found');
            }
            return newsletter;
          },
          {
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Higher priority prefetches get longer cache time
            gcTime: priority ? 60 * 60 * 1000 : 30 * 60 * 1000,
          }
        );
      } catch (_) {
        log.warn('Failed to prefetch newsletter', {
          action: 'prefetch_newsletter',
          metadata: { newsletterId },
        });
        // Don't throw - prefetch failures shouldn't break the app
      }
    },
    [user, log, newsletterService]
  );

  return { prefetchNewsletter };
};
