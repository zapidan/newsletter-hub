import {
  MutateOptions,
  QueryObserverResult,
  RefetchOptions,
  UseMutateAsyncFunction,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useLogger } from '@common/utils/logger/useLogger';
import { normalizeNewsletterFilter } from '@common/utils/newsletterUtils';
import { useAuth } from '../contexts/AuthContext';
import { newsletterService, readingQueueService } from '../services';
import { NewsletterWithRelations, ReadingQueueItem } from '../types';
import { PaginatedResponse } from '../types/api';
import type { NewsletterFilter } from '../types/cache';
import {
  cancelQueries,
  getCacheManager,
  getQueryData,
  SimpleCacheManager,
} from '../utils/cacheUtils';
import { invalidateForOperation } from '../utils/optimizedCacheInvalidation';
import { queryKeyFactory } from '../utils/queryKeyFactory';
import { updateNewsletterTags } from '../utils/tagUtils';

type PreviousNewslettersState = {
  previousNewsletters?: NewsletterWithRelations[];
  previousNewsletter?: NewsletterWithRelations;
  deletedIds?: string[];
  rollbackFunctions?: Array<() => void>;
  newsletter?: NewsletterWithRelations;
  newArchivedState?: boolean;
  shouldRemoveFromView?: boolean;
};

// Cache configuration based on data volatility
const CACHE_CONFIG = {
  // Newsletter list data - moderately dynamic
  LIST_STALE_TIME: 2 * 60 * 1000, // 2 minutes - data can be slightly stale
  LIST_CACHE_TIME: 10 * 60 * 1000, // 10 minutes - keep in memory longer

  // Individual newsletter details - less dynamic
  DETAIL_STALE_TIME: 5 * 60 * 1000, // 5 minutes - details change less frequently
  DETAIL_CACHE_TIME: 15 * 60 * 1000, // 15 minutes - keep longer for navigation

  // Error retry configuration
  RETRY_DELAY_BASE: 1000, // 1 second base delay
  MAX_RETRY_DELAY: 30000, // 30 second max delay
  MAX_RETRIES: 3,
};

// Utility function for safe predicate checks
const createSafePredicate = (ids: string[] | undefined) => (query: any) => {
  if (!ids || !Array.isArray(ids)) {
    return (
      queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
      queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[])
    );
  }

  return (
    queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
    queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[]) ||
    ids.some((id) =>
      queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id)
    )
  );
};

interface UseNewslettersReturn {
  // Single newsletter operations
  getNewsletter: (id: string) => Promise<NewsletterWithRelations | null>;

  // Newsletter list and query
  newsletters: NewsletterWithRelations[];
  isLoadingNewsletters: boolean;
  isErrorNewsletters: boolean;
  errorNewsletters: Error | null;
  refetchNewsletters: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<PaginatedResponse<NewsletterWithRelations>, Error>>;

  // Read status mutations
  markAsRead: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isMarkingAsRead: boolean;
  errorMarkingAsRead: Error | null;
  markAsUnread: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isMarkingAsUnread: boolean;
  errorMarkingAsUnread: Error | null;
  bulkMarkAsRead: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkMarkingAsRead: boolean;
  errorBulkMarkingAsRead: Error | null;
  bulkMarkAsUnread: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkMarkingAsUnread: boolean;
  errorBulkMarkingAsUnread: Error | null;

  // Like mutations
  toggleLike: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;

  // Archive mutations
  toggleArchive: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  bulkArchive: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  bulkUnarchive: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isArchiving: boolean;
  errorArchiving: Error | null;
  isUnarchiving: boolean;
  errorUnarchiving: Error | null;
  isBulkArchiving: boolean;
  errorBulkArchiving: Error | null;
  isBulkUnarchiving: boolean;
  errorBulkUnarchiving: Error | null;

  // Queue mutations
  toggleInQueue: UseMutateAsyncFunction<boolean, Error, string, unknown>;
  isTogglingInQueue: boolean;
  errorTogglingInQueue: Error | null;

  // Delete mutations
  deleteNewsletter: UseMutateAsyncFunction<boolean, Error, string, unknown>;
  isDeletingNewsletter: boolean;
  errorDeletingNewsletter: Error | null;
  bulkDeleteNewsletters: UseMutateAsyncFunction<boolean, Error, string[], unknown>;
  isBulkDeletingNewsletters: boolean;
  errorBulkDeletingNewsletters: Error | null;

  // Tag mutations
  updateNewsletterTags: (
    id: string,
    tagIds: string[],
    options?: MutateOptions<
      boolean,
      Error,
      { id: string; tagIds: string[] },
      PreviousNewslettersState
    >
  ) => Promise<void>;
  isUpdatingTags: boolean;
  errorUpdatingTags: Error | null;
}

export const useNewsletters = (
  filters: NewsletterFilter = {},
  options: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
    cacheTime?: number;
    debug?: boolean;
  } = {}
): UseNewslettersReturn => {
  const { user } = useAuth();
  const log = useLogger('useNewsletters');
  const queryClient = useQueryClient();
  const lastCallTimeRef = useRef<number>(0);
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = CACHE_CONFIG.LIST_STALE_TIME,
    cacheTime = CACHE_CONFIG.LIST_CACHE_TIME,
    // debug = false, // Commented out unused parameter
  } = options;

  // Create cache manager instance with proper null check
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager() as SimpleCacheManager;
    } catch (error) {
      log.error('Failed to initialize cache manager', { error });
      throw new Error('Cache manager initialization failed');
    }
  }, [log]);

  // Normalize filters to camelCase for query and cache
  const normalizedFilters = useMemo(() => normalizeNewsletterFilter(filters), [filters]);

  // Generate query key with normalized filters
  const queryKey = useMemo(
    () => queryKeyFactory.newsletters.list(normalizedFilters),
    [normalizedFilters]
  );

  // Define proper type for query parameters
  interface NewsletterQueryParams {
    search?: string;
    isRead?: boolean;
    isArchived?: boolean;
    isLiked?: boolean;
    tagIds?: string[];
    sourceIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
    includeRelations?: boolean;
    includeTags?: boolean;
    includeSource?: boolean;
  }

  // Build API query parameters from normalized filters with proper typing
  const queryParams = useMemo<NewsletterQueryParams>(() => {
    const params: NewsletterQueryParams = {
      search: normalizedFilters.search,
      isRead: normalizedFilters.isRead,
      isArchived: normalizedFilters.isArchived,
      isLiked: normalizedFilters.isLiked,
      tagIds: normalizedFilters.tagIds,
      sourceIds: normalizedFilters.sourceIds,
      dateFrom: normalizedFilters.dateFrom,
      dateTo: normalizedFilters.dateTo,
      limit: normalizedFilters.limit || 50,
      offset: normalizedFilters.offset || 0,
      orderBy: normalizedFilters.orderBy || 'received_at',
      ascending: normalizedFilters.ascending ?? false,
      includeRelations: true,
      includeTags: true,
      includeSource: true,
    };

    // Validate source IDs in development
    if (process.env.NODE_ENV === 'development') {
      const sourceIds: string[] | undefined = normalizedFilters.sourceIds;
      if (sourceIds && sourceIds.length > 0) {
        const validSourceIds = sourceIds.filter(
          (id: string): id is string => typeof id === 'string' && id.length > 0
        );
        if (validSourceIds.length !== sourceIds.length) {
          log.warn('Invalid source IDs detected', {
            action: 'validate_source_ids',
            metadata: {
              original: sourceIds,
              valid: validSourceIds,
            },
          });
        }
      }
    }

    return params;
  }, [normalizedFilters, log]);

  // Track query key changes to prevent unnecessary re-fetches
  const previousQueryKeyRef = useRef<string>('');
  const queryKeyString = JSON.stringify(queryKey);

  useEffect(() => {
    // Only track if query key actually changed
    if (previousQueryKeyRef.current !== queryKeyString) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTimeRef.current;

      if (lastCallTimeRef.current > 0 && timeSinceLastCall < 1000) {
        log.warn('Frequent newsletter query detected', {
          action: 'frequency_warning',
          metadata: {
            timeSinceLastCall,
            queryKey: queryKeyString,
            userId: user?.id,
            previousKey: previousQueryKeyRef.current,
          },
        });
      }

      lastCallTimeRef.current = now;
      previousQueryKeyRef.current = queryKeyString;
    }
  }, [queryKeyString, log, user?.id]);

  // Main newsletters query using the new API with proper type annotation
  const {
    data: newslettersResponse,
    isLoading,
    error: errorNewsletters,
    refetch: refetchNewsletters,
  } = useQuery<PaginatedResponse<NewsletterWithRelations>, Error>({
    queryKey,
    queryFn: async (): Promise<PaginatedResponse<NewsletterWithRelations>> => {
      try {
        log.debug('Executing newsletter API call', {
          action: 'api_call_start',
          metadata: {
            queryParams,
            queryKey: JSON.stringify(queryKey),
          },
        });

        const result = await newsletterService.getAll(queryParams);

        // Type guard to ensure result.data exists
        if (!result?.data) {
          throw new Error('No data received from API');
        }

        // Validate source filtering in development
        if (process.env.NODE_ENV === 'development' && queryParams.sourceIds?.length) {
          const unexpectedSources = result.data.filter(
            (newsletter) =>
              newsletter.newsletter_source_id &&
              !queryParams.sourceIds!.includes(newsletter.newsletter_source_id)
          );

          if (unexpectedSources.length > 0) {
            log.warn('Source filtering may not be working correctly', {
              action: 'validate_source_filtering',
              metadata: {
                expectedSources: queryParams.sourceIds,
                unexpectedItems: unexpectedSources.map((n) => ({
                  id: n.id,
                  sourceId: n.newsletter_source_id,
                  sourceName: n.source?.name,
                })),
              },
            });
          }
        }

        log.debug('Newsletter API call completed', {
          action: 'api_call_success',
          metadata: {
            dataCount: result.data?.length || 0,
            totalCount: result.count,
          },
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error));
        log.error(
          'API Error occurred',
          {
            action: 'fetch_newsletters',
            metadata: { filters, queryParams },
          },
          errorMessage
        );
        throw errorMessage;
      }
    },
    enabled: enabled && !!user,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: CACHE_CONFIG.MAX_RETRIES,
    retryDelay: (attemptIndex) =>
      Math.min(
        CACHE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attemptIndex),
        CACHE_CONFIG.MAX_RETRY_DELAY
      ),
    // Prevent unnecessary refetches
    structuralSharing: (oldData, newData) => {
      // If data hasn't structurally changed, return old reference
      if (JSON.stringify(oldData) === JSON.stringify(newData)) {
        return oldData;
      }
      return newData;
    },
  });

  // Safe access to newsletters data
  const newsletters = useMemo(() => newslettersResponse?.data || [], [newslettersResponse]);

  // Get single newsletter function - memoized to prevent recreation
  const getNewsletter = useCallback(async (id: string): Promise<NewsletterWithRelations | null> => {
    if (!id) return null;
    return newsletterService.getById(id);
  }, []);

  // Mark as read mutation with proper typing
  const markAsReadMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string): Promise<boolean> => {
      if (!id) {
        throw new Error('Newsletter ID is required');
      }
      try {
        await newsletterService.markAsRead(id);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to mark as read', { id }, errorMessage);
        throw errorMessage;
      }
    },
    onMutate: async (id: string) => {
      if (!id) {
        throw new Error('Newsletter ID is required for optimistic update');
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Optimistically update the cache
      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_read: true,
          updated_at: new Date().toISOString(),
        },
      });

      // Return the context with previous values for potential rollback
      return { previousNewsletters };
    },
    onError: (error: Error, id: string, context?: PreviousNewslettersState) => {
      log.error('Error in markAsRead mutation', { id }, error);

      // Rollback to previous state on error
      if (context?.previousNewsletters) {
        const newsletter = context.previousNewsletters.find((n) => n.id === id);
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_read: newsletter.is_read,
              updated_at: newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data: boolean | undefined, error: Error | null, id: string) => {
      // Invalidate and refetch related queries
      if (!error) {
        // Use invalidateForOperation to properly update UI
        invalidateForOperation(queryClient, 'mark-read', [id]);

        // Also update unread count optimistically for immediate feedback
        setTimeout(() => {
          cacheManager.updateUnreadCountOptimistically({
            type: 'mark-read',
            newsletterIds: [id],
          });

          // Notify other components about the read status change
          window.dispatchEvent(new CustomEvent('newsletter:read-status-changed'));
        }, 100);
      }
    },
  });

  // Mark as unread mutation with proper typing
  const markAsUnreadMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string): Promise<boolean> => {
      if (!id) {
        throw new Error('Newsletter ID is required');
      }
      try {
        await newsletterService.markAsUnread(id);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to mark as unread', { id }, errorMessage);
        throw errorMessage;
      }
    },
    onMutate: async (id: string) => {
      if (!id) {
        throw new Error('Newsletter ID is required for optimistic update');
      }

      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Optimistically update the cache
      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_read: false,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
    },
    onError: (error: Error, id: string, context?: PreviousNewslettersState) => {
      log.error('Error in markAsUnread mutation', { id }, error);

      // Rollback to previous state on error
      if (context?.previousNewsletters) {
        const newsletter = context.previousNewsletters.find((n) => n.id === id);
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_read: newsletter.is_read,
              updated_at: newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data: boolean | undefined, error: Error | null, id: string) => {
      // Invalidate and refetch related queries
      if (!error) {
        // Use invalidateForOperation to properly update UI
        invalidateForOperation(queryClient, 'mark-unread', [id]);

        // Also update unread count optimistically for immediate feedback
        setTimeout(() => {
          cacheManager.updateUnreadCountOptimistically({
            type: 'mark-unread',
            newsletterIds: [id],
          });

          // Notify other components about the read status change
          window.dispatchEvent(new CustomEvent('newsletter:read-status-changed'));
        }, 100);
      }
    },
  });

  // Bulk mark as read mutation with enhanced type safety
  const bulkMarkAsReadMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]): Promise<boolean> => {
      if (!ids?.length) {
        throw new Error('No newsletter IDs provided for bulk mark as read');
      }

      try {
        const result = await newsletterService.bulkUpdate({
          ids,
          updates: { is_read: true },
        });

        if (result.successCount !== ids.length) {
          throw new Error('Failed to mark all newsletters as read');
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error));
        log.error('Bulk mark as read failed', { ids, count: ids.length }, errorMessage);
        throw errorMessage;
      }
    },
    onMutate: async (ids: string[]): Promise<PreviousNewslettersState> => {
      if (!ids?.length) {
        throw new Error('No newsletter IDs provided for optimistic update');
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await cancelQueries({
        predicate: createSafePredicate(ids),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];
      const now = new Date().toISOString();

      // Optimistically update the cache
      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: { is_read: true, updated_at: now },
        }))
      );

      return { previousNewsletters };
    },
    onError: (error: Error, ids: string[], context?: PreviousNewslettersState) => {
      log.error('Error in bulkMarkAsRead mutation', { ids, count: ids.length }, error);

      // Rollback to previous state on error
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find((n) => n.id === id);
          if (newsletter) {
            cacheManager.updateNewsletterInCache({
              id,
              updates: {
                is_read: newsletter.is_read,
                updated_at: newsletter.updated_at,
              },
            });
          }
        });
      }
    },
    onSettled: (_data: boolean | undefined, error: Error | null, ids: string[]) => {
      // Invalidate and refetch related queries
      if (!error) {
        // Use invalidateForOperation to properly update UI
        invalidateForOperation(queryClient, 'bulk-mark-read', ids);

        // Also update unread count optimistically for immediate feedback
        setTimeout(() => {
          cacheManager.updateUnreadCountOptimistically({
            type: 'bulk-mark-read',
            newsletterIds: ids,
          });

          // Notify other components about the read status change
          window.dispatchEvent(new CustomEvent('newsletter:read-status-changed'));
        }, 100);
      }
    },
  });

  // Bulk mark as unread mutation with enhanced type safety
  const bulkMarkAsUnreadMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]): Promise<boolean> => {
      if (!ids?.length) {
        throw new Error('No newsletter IDs provided for bulk mark as unread');
      }

      try {
        const result = await newsletterService.bulkUpdate({
          ids,
          updates: { is_read: false },
        });

        if (result.successCount !== ids.length) {
          throw new Error('Failed to mark all newsletters as unread');
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error));
        log.error('Bulk mark as unread failed', { ids, count: ids.length }, errorMessage);
        throw errorMessage;
      }
    },
    onMutate: async (ids: string[]): Promise<PreviousNewslettersState> => {
      if (!ids?.length) {
        throw new Error('No newsletter IDs provided for optimistic update');
      }

      // Cancel any outgoing refetches
      await cancelQueries({
        predicate: createSafePredicate(ids),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];
      const now = new Date().toISOString();

      // Optimistically update the cache
      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: { is_read: false, updated_at: now },
        }))
      );

      return { previousNewsletters };
    },
    onError: (error: Error, ids: string[], context?: PreviousNewslettersState) => {
      log.error('Error in bulkMarkAsUnread mutation', { ids, count: ids.length }, error);

      // Rollback to previous state on error
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find((n) => n.id === id);
          if (newsletter) {
            cacheManager.updateNewsletterInCache({
              id,
              updates: {
                is_read: newsletter.is_read,
                updated_at: newsletter.updated_at,
              },
            });
          }
        });
      }
    },
    onSettled: (_data: boolean | undefined, error: Error | null, ids: string[]) => {
      // Invalidate and refetch related queries
      if (!error) {
        // Use invalidateForOperation to properly update UI
        invalidateForOperation(queryClient, 'bulk-mark-unread', ids);

        // Also update unread count optimistically for immediate feedback
        setTimeout(() => {
          cacheManager.updateUnreadCountOptimistically({
            type: 'bulk-mark-unread',
            newsletterIds: ids,
          });

          // Notify other components about the read status change
          window.dispatchEvent(new CustomEvent('newsletter:read-status-changed'));
        }, 100);
      }
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string) => {
      await newsletterService.toggleLike(id);
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      const queryData = getQueryData<PaginatedResponse<NewsletterWithRelations>>(queryKey);
      const previousNewsletters = queryData?.data || [];

      // Find the current newsletter to get its like status
      const currentNewsletter = previousNewsletters.find(
        (n: NewsletterWithRelations) => n.id === id
      );
      const currentLikedState = currentNewsletter?.is_liked ?? false;
      const newLikedState = !currentLikedState;

      console.log(
        `Optimistically toggling like for newsletter ${id}: ${currentLikedState} -> ${newLikedState}`
      );

      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_liked: newLikedState,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
    },
    onError: (_err, id, context) => {
      console.log(`Error in toggleLike for newsletter ${id}, rolling back`);
      if (context?.previousNewsletters) {
        const newsletter = context.previousNewsletters.find((n) => n.id === id);
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_liked: newsletter.is_liked,
              updated_at: newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data: boolean | undefined, error: Error | null, id: string) => {
      // Invalidate and refetch related queries
      if (!error) {
        // Use invalidateForOperation to properly update UI
        invalidateForOperation(queryClient, 'toggle-like', [id]);
      }
    },
  });

  // Toggle archive mutation
  const toggleArchiveMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string) => {
      await newsletterService.toggleArchive(id);
      return true;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid race conditions
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterInfiniteKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      // Get the current newsletter list data to understand the current filter context
      const queryData = getQueryData<PaginatedResponse<NewsletterWithRelations>>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];
      const newsletter = previousNewsletters.find((n: NewsletterWithRelations) => n.id === id);

      if (!newsletter) {
        return { previousNewsletters };
      }

      const newArchivedState = !newsletter.is_archived;

      // Determine if we should remove the newsletter from the current view
      const currentFilter = normalizedFilters;
      const shouldRemoveFromView =
        newArchivedState && // Newsletter is being archived
        (currentFilter.isArchived === false || currentFilter.isArchived === undefined); // And we're not in archived view

      if (shouldRemoveFromView) {
        // Remove the newsletter from the current filtered view immediately
        // Handle both infinite queries and regular list queries
        cacheManager.queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) &&
                key[0] === 'newsletters' &&
                (key[1] === 'infinite' || key[1] === 'list')
              );
            },
          },
          (
            oldData:
              | { pages: PaginatedResponse<NewsletterWithRelations>[] }
              | PaginatedResponse<NewsletterWithRelations>
              | undefined
          ) => {
            // Handle infinite query data structure
            if (oldData && 'pages' in oldData && oldData.pages) {
              let totalRemoved = 0;
              const updatedData = {
                ...oldData,
                pages: oldData.pages.map((page) => {
                  const filteredData = page.data.filter(
                    (newsletter: NewsletterWithRelations) => newsletter.id !== id
                  );
                  const removed = page.data.length - filteredData.length;
                  totalRemoved += removed;

                  return {
                    ...page,
                    data: filteredData,
                    count: Math.max(0, (page.count || 0) - removed),
                  };
                }),
              };

              // Log the removal for debugging
              if (totalRemoved > 0) {
                console.log(
                  `Removed ${totalRemoved} archived newsletter(s) from infinite query cache`
                );
              }

              return updatedData;
            }

            // Handle regular list query data structure
            if (oldData && 'data' in oldData && Array.isArray(oldData.data)) {
              const filteredData = oldData.data.filter(
                (newsletter: NewsletterWithRelations) => newsletter.id !== id
              );
              const removed = oldData.data.length - filteredData.length;

              if (removed > 0) {
                console.log(`Removed ${removed} archived newsletter(s) from list query cache`);
              }

              return {
                ...oldData,
                data: filteredData,
                count: Math.max(0, (oldData.count || 0) - removed),
              };
            }

            return oldData;
          }
        );
      } else {
        // Update the newsletter's archived status in place
        cacheManager.updateNewsletterInCache({
          id,
          updates: {
            is_archived: newArchivedState,
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Return the previous state in case we need to rollback
      return {
        previousNewsletters,
        newsletter,
        newArchivedState,
        shouldRemoveFromView,
      };
    },
    onError: (_err, id, context) => {
      // Rollback to the previous state on error
      if (context?.previousNewsletters && context?.newsletter) {
        if (context.shouldRemoveFromView) {
          // Restore the newsletter to the list if it was removed
          cacheManager.queryClient.setQueryData(
            queryKey,
            (oldData: PaginatedResponse<NewsletterWithRelations>) => {
              if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;

              // Add the newsletter back to its original position
              const restoredData = [...oldData.data];
              const originalIndex = context.previousNewsletters!.findIndex((n) => n.id === id);
              if (originalIndex >= 0) {
                restoredData.splice(originalIndex, 0, context.newsletter!);
              } else {
                restoredData.unshift(context.newsletter!);
              }

              return {
                ...oldData,
                data: restoredData,
                count: (oldData.count || 0) + 1,
              };
            }
          );
        } else {
          // Restore the original archived state
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_archived: context.newsletter.is_archived,
              updated_at: context.newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data, _error, id) => {
      // Use invalidateForOperation to properly update UI
      if (!_error) {
        invalidateForOperation(queryClient, 'toggle-archive', [id]);
        // Dispatch event for unread count updates
        window.dispatchEvent(new CustomEvent('newsletter:archived'));
      }
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty newsletter IDs provided for bulk archive');
      }
      const result = await newsletterService.bulkArchive(ids);
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: createSafePredicate(ids),
      });

      const queryData = getQueryData<PaginatedResponse<NewsletterWithRelations>>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

      // Determine if we should remove newsletters from the current view
      const currentFilter = normalizedFilters;
      const shouldRemoveFromView =
        currentFilter.isArchived === false || currentFilter.isArchived === undefined; // Not in archived view

      if (shouldRemoveFromView) {
        // Remove archived newsletters from both infinite queries and regular list queries
        cacheManager.queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) &&
                key[0] === 'newsletters' &&
                (key[1] === 'infinite' || key[1] === 'list')
              );
            },
          },
          (oldData: { pages: PaginatedResponse<NewsletterWithRelations>[] } | undefined) => {
            if (!oldData || !oldData.pages) return oldData;

            let totalRemoved = 0;
            const updatedData = {
              ...oldData,
              pages: oldData.pages.map((page) => {
                const filteredData = page.data.filter(
                  (newsletter: NewsletterWithRelations) => !ids.includes(newsletter.id)
                );
                const removed = page.data.length - filteredData.length;
                totalRemoved += removed;

                return {
                  ...page,
                  data: filteredData,
                  count: Math.max(0, (page.count || 0) - removed),
                };
              }),
            };

            // Log the removal for debugging
            if (totalRemoved > 0) {
              console.log(
                `Removed ${totalRemoved} archived newsletter(s) from infinite query cache`
              );
            }

            return updatedData;
          }
        );
      } else {
        // Update the newsletters' archived status in place
        cacheManager.batchUpdateNewsletters(
          ids.map((id) => ({
            id,
            updates: {
              is_archived: true,
              updated_at: new Date().toISOString(),
            },
          }))
        );
      }

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find((n) => n.id === id);
          if (newsletter) {
            cacheManager.updateNewsletterInCache({
              id,
              updates: {
                is_archived: newsletter.is_archived,
                updated_at: newsletter.updated_at,
              },
            });
          }
        });
      }
    },
    onSettled: (_data, _error, ids) => {
      invalidateForOperation(queryClient, 'bulk-archive', ids);
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent('newsletter:archived'));
    },
  });

  // Bulk unarchive mutation
  const bulkUnarchiveMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty newsletter IDs provided for bulk unarchive');
      }
      const result = await newsletterService.bulkUnarchive(ids);
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: createSafePredicate(ids),
      });

      const queryData = getQueryData<PaginatedResponse<NewsletterWithRelations>>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

      // For unarchive, we always update the status in place since we want to show unarchived newsletters
      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: {
            is_archived: false,
            updated_at: new Date().toISOString(),
          },
        }))
      );

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find((n) => n.id === id);
          if (newsletter) {
            cacheManager.updateNewsletterInCache({
              id,
              updates: {
                is_archived: newsletter.is_archived,
                updated_at: newsletter.updated_at,
              },
            });
          }
        });
      }
    },
    onSettled: (_data, _error, ids) => {
      invalidateForOperation(queryClient, 'bulk-unarchive', ids);
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent('newsletter:archived'));
    },
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation<boolean, Error, string, unknown>({
    mutationFn: async (id: string) => {
      return newsletterService.delete(id);
    },
    onSettled: (_data, _error, id) => {
      invalidateForOperation(queryClient, 'delete', [id]);
    },
  });

  // Bulk delete newsletters mutation
  const bulkDeleteNewslettersMutation = useMutation<boolean, Error, string[], unknown>({
    mutationFn: async (ids: string[]) => {
      // Delete each newsletter individually since we don't have a bulk delete in the API yet
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty newsletter IDs provided for bulk delete');
      }
      const promises = ids.map((id) => newsletterService.delete(id));
      await Promise.all(promises);
      return true;
    },
    onSettled: (_data, _error, ids) => {
      if (ids && Array.isArray(ids)) {
        invalidateForOperation(queryClient, 'bulk-delete', ids);
      }
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent('newsletter:deleted'));
    },
  });

  // Toggle in-queue status mutation with improved optimistic updates
  const toggleInQueueMutation = useMutation<
    boolean,
    Error,
    string,
    {
      previousNewsletters: NewsletterWithRelations[];
      wasInQueue: boolean;
      rollbackFunctions: Array<() => void>;
      previousQueueItems?: ReadingQueueItem[];
    }
  >({
    mutationFn: async (id: string) => {
      // Get current queue status from cache first, then API if needed
      const queueItems =
        getQueryData<ReadingQueueItem[]>(queryKeyFactory.queue.list(user?.id || '')) || [];
      let isInQueue = queueItems.some((item) => item.newsletter_id === id);

      // If cache is empty or unreliable, check API
      if (queueItems.length === 0) {
        try {
          isInQueue = await readingQueueService.isInQueue(id);
        } catch (error) {
          log.warn(
            'Failed to check queue status, proceeding with cache value',
            {
              action: 'check_queue_status',
              metadata: { newsletterId: id },
            },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      // Perform the toggle operation
      if (isInQueue) {
        const queueItem = queueItems.find((item) => item.newsletter_id === id);
        if (queueItem) {
          await readingQueueService.remove(queueItem.id);
        }
      } else {
        await readingQueueService.add(id);
      }

      return !isInQueue;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid race conditions
      await cancelQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as unknown[];
          return (
            queryKeyFactory.matchers.isNewsletterListKey(queryKey) ||
            queryKeyFactory.matchers.isNewsletterDetailKey(queryKey, id) ||
            queryKey[0] === 'reading-queue' ||
            queryKey[0] === 'unreadCount'
          );
        },
      });

      const rollbackFunctions: Array<() => void> = [];

      // Get current states for rollback
      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      const newsletterArray = Array.isArray(previousNewsletters) ? previousNewsletters : [];

      const queueItems =
        getQueryData<ReadingQueueItem[]>(queryKeyFactory.queue.list(user?.id || '')) || [];
      const wasInQueue = queueItems.some((item) => item.newsletter_id === id);

      // Note: We don't need to update newsletter lists since queue status
      // is managed separately through ReadingQueueItem table

      // Apply optimistic updates to reading queue with better error handling
      const queueQueryKey = queryKeyFactory.queue.list(user?.id || '');
      try {
        const result = await cacheManager.optimisticUpdateWithRollback<ReadingQueueItem[]>(
          Array.from(queueQueryKey),
          (data) => {
            // Ensure we always have a valid array
            const currentData = Array.isArray(data) ? data : [];

            if (wasInQueue) {
              // Remove from queue
              return currentData.filter((item) => item.newsletter_id !== id);
            } else {
              // Add to queue (create a mock item for the UI)
              const newsletter = newsletterArray.find((n) => n.id === id);
              if (newsletter) {
                const mockQueueItem: ReadingQueueItem = {
                  id: `temp-${id}`,
                  newsletter_id: id,
                  user_id: user?.id || '',
                  position: currentData.length + 1,
                  added_at: new Date().toISOString(),
                  newsletter,
                };
                return [...currentData, mockQueueItem];
              }
            }
            return currentData;
          }
        );

        if (result?.rollback) {
          rollbackFunctions.push(result.rollback);
        }
      } catch (error) {
        log.warn(
          'Failed to apply optimistic update to queue',
          {
            action: 'optimistic_queue_update',
            metadata: { newsletterId: id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Don't throw here - we want to continue with the mutation
      }

      return {
        previousNewsletters: newsletterArray,
        wasInQueue,
        rollbackFunctions,
      };
    },
    onError: (error, id, context) => {
      log.error(
        'Error toggling queue status',
        {
          action: 'toggle_queue_status',
          metadata: { newsletterId: id },
        },
        error instanceof Error ? error : new Error(String(error))
      );

      // Execute all rollback functions
      if (context?.rollbackFunctions) {
        context.rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            log.error(
              'Error during rollback',
              {
                action: 'rollback_queue_toggle',
                metadata: { newsletterId: id },
              },
              rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError))
            );
          }
        });
      }

      // Don't force refresh on error - let the UI handle retry
    },
    onSuccess: (_result, _id) => {
      // Only invalidate the specific reading queue query
      queryClient.invalidateQueries({
        queryKey: queryKeyFactory.queue.list(user?.id || ''),
        refetchType: 'none', // Don't refetch automatically
      });
    },
    onSettled: (_data, _error, _id) => {
      // No additional invalidation needed - handled in onSuccess
    },
  });

  // Update newsletter tags mutation
  const updateNewsletterTagsMutation = useMutation<
    boolean,
    Error,
    { id: string; tagIds: string[] },
    PreviousNewslettersState
  >({
    mutationFn: async ({ id, tagIds }) => {
      if (!user?.id) {
        throw new Error('User authentication required');
      }

      // Get current newsletter to get current tags
      const currentNewsletter = await newsletterService.getById(id);
      if (!currentNewsletter) {
        throw new Error('Newsletter not found');
      }

      const currentTagIds = currentNewsletter.tags?.map((tag) => tag.id) || [];

      // Update newsletter tags using the tag utility - same as reading queue
      await updateNewsletterTags(id, tagIds, currentTagIds, user.id);
      return true;
    },
    onMutate: async ({ id }) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Optimistically update the newsletter with new tags
      // Note: We don't have the full tag objects here, just IDs
      // The actual tag objects will be fetched after the mutation succeeds
      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
    },
    onError: (_err, { id }, context) => {
      // Revert optimistic updates if the mutation fails
      if (context?.previousNewsletters) {
        const newsletter = context.previousNewsletters.find((n) => n.id === id);
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              updated_at: newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate queries to refetch fresh data with updated tags
      cacheManager.invalidateRelatedQueries([id], 'update-tags');
    },
  });

  // Unarchive mutation (separate from toggle for specific use cases)
  const unarchiveMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string) => {
      await newsletterService.update({ id, is_archived: false });
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(query.queryKey as unknown[]) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(query.queryKey as unknown[], id),
      });

      const previousNewsletters = getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      const newsletterArray = Array.isArray(previousNewsletters) ? previousNewsletters : [];

      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_archived: false,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters: newsletterArray };
    },
    onError: (_err, id, context) => {
      if (context?.previousNewsletters) {
        const newsletter = context.previousNewsletters.find((n) => n.id === id);
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_archived: newsletter.is_archived,
              updated_at: newsletter.updated_at,
            },
          });
        }
      }
    },
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], 'unarchive');
    },
  });

  // Memoized callback functions
  const markAsRead = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>
    ) => {
      return markAsReadMutation.mutateAsync(id, options);
    },
    [markAsReadMutation]
  );

  const markAsUnread = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>
    ) => {
      return markAsUnreadMutation.mutateAsync(id, options);
    },
    [markAsUnreadMutation]
  );

  const bulkMarkAsRead = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<boolean, Error, string[], PreviousNewslettersState>
    ) => {
      return bulkMarkAsReadMutation.mutateAsync(ids, options);
    },
    [bulkMarkAsReadMutation]
  );

  const bulkMarkAsUnread = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<boolean, Error, string[], PreviousNewslettersState>
    ) => {
      return bulkMarkAsUnreadMutation.mutateAsync(ids, options);
    },
    [bulkMarkAsUnreadMutation]
  );

  const toggleLike = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>
    ) => {
      return toggleLikeMutation.mutateAsync(id, options);
    },
    [toggleLikeMutation]
  );

  const toggleArchive = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>
    ) => {
      return toggleArchiveMutation.mutateAsync(id, options);
    },
    [toggleArchiveMutation]
  );

  const bulkArchive = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<boolean, Error, string[], PreviousNewslettersState>
    ) => {
      return bulkArchiveMutation.mutateAsync(ids, options);
    },
    [bulkArchiveMutation]
  );

  const bulkUnarchive = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<boolean, Error, string[], PreviousNewslettersState>
    ) => {
      return bulkUnarchiveMutation.mutateAsync(ids, options);
    },
    [bulkUnarchiveMutation]
  );

  const updateNewsletterTagsCallback = useCallback(
    async (
      id: string,
      tagIds: string[],
      options?: MutateOptions<
        boolean,
        Error,
        { id: string; tagIds: string[] },
        PreviousNewslettersState
      >
    ) => {
      await updateNewsletterTagsMutation.mutateAsync({ id, tagIds }, options);
    },
    [updateNewsletterTagsMutation]
  );

  return {
    // Single newsletter operations
    getNewsletter,

    // Newsletter list and query
    newsletters,
    isLoadingNewsletters: isLoading,
    isErrorNewsletters: !!errorNewsletters,
    errorNewsletters,
    refetchNewsletters,

    // Read status mutations
    markAsRead,
    markAsUnread,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    isMarkingAsRead: markAsReadMutation.isPending,
    errorMarkingAsRead: markAsReadMutation.error,
    isMarkingAsUnread: markAsUnreadMutation.isPending,
    errorMarkingAsUnread: markAsUnreadMutation.error,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending,
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,

    // Like mutation
    toggleLike,
    isTogglingLike: toggleLikeMutation.isPending,
    errorTogglingLike: toggleLikeMutation.error,

    // Archive mutations
    toggleArchive,
    bulkArchive,
    bulkUnarchive,
    isArchiving: toggleArchiveMutation.isPending,
    errorArchiving: toggleArchiveMutation.error,
    isUnarchiving: unarchiveMutation.isPending,
    errorUnarchiving: unarchiveMutation.error,
    isBulkArchiving: bulkArchiveMutation.isPending,
    errorBulkArchiving: bulkArchiveMutation.error,
    isBulkUnarchiving: bulkUnarchiveMutation.isPending,
    errorBulkUnarchiving: bulkUnarchiveMutation.error,

    // Queue mutations
    toggleInQueue: toggleInQueueMutation.mutateAsync,
    isTogglingInQueue: toggleInQueueMutation.isPending,
    errorTogglingInQueue: toggleInQueueMutation.error,

    // Delete mutations
    deleteNewsletter: deleteNewsletterMutation.mutateAsync,
    isDeletingNewsletter: deleteNewsletterMutation.isPending,
    errorDeletingNewsletter: deleteNewsletterMutation.error,
    bulkDeleteNewsletters: bulkDeleteNewslettersMutation.mutateAsync,
    isBulkDeletingNewsletters: bulkDeleteNewslettersMutation.isPending,
    errorBulkDeletingNewsletters: bulkDeleteNewslettersMutation.error,

    // Tag mutations
    updateNewsletterTags: updateNewsletterTagsCallback,
    isUpdatingTags: updateNewsletterTagsMutation.isPending,
    errorUpdatingTags: updateNewsletterTagsMutation.error,
  } as const;
};
