import { useCallback, useMemo } from "react";
import {
  useQuery,
  useMutation,
  QueryObserverResult,
  RefetchOptions,
  UseMutateAsyncFunction,
  MutateOptions,
} from "@tanstack/react-query";

import { newsletterApi } from "../api/newsletterApi";
import { useAuth } from "../contexts/AuthContext";
import {
  NewsletterWithRelations,
  Tag,
  Newsletter,
  NewsletterSource,
} from "../types";
import type { NewsletterFilter } from "../types/cache";
import { queryKeyFactory } from "../utils/queryKeyFactory";
import {
  getCacheManager,
  SimpleCacheManager,
  getQueryData,
  cancelQueries,
} from "../utils/cacheUtils";

type PreviousNewslettersState = {
  previousNewsletters?: NewsletterWithRelations[];
  previousNewsletter?: NewsletterWithRelations;
  deletedIds?: string[];
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

interface UseNewslettersReturn {
  // Single newsletter operations
  getNewsletter: (id: string) => Promise<NewsletterWithRelations | null>;

  // Newsletter list and query
  newsletters: NewsletterWithRelations[];
  isLoadingNewsletters: boolean;
  isErrorNewsletters: boolean;
  errorNewsletters: Error | null;
  refetchNewsletters: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<NewsletterWithRelations[], Error>>;

  // Read status mutations
  markAsRead: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isMarkingAsRead: boolean;
  errorMarkingAsRead: Error | null;
  markAsUnread: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isMarkingAsUnread: boolean;
  errorMarkingAsUnread: Error | null;
  bulkMarkAsRead: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >;
  isBulkMarkingAsRead: boolean;
  errorBulkMarkingAsRead: Error | null;
  bulkMarkAsUnread: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >;
  isBulkMarkingAsUnread: boolean;
  errorBulkMarkingAsUnread: Error | null;

  // Like mutations
  toggleLike: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;

  // Archive mutations
  toggleArchive: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  bulkArchive: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >;
  bulkUnarchive: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >;
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
  bulkDeleteNewsletters: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    unknown
  >;
  isBulkDeletingNewsletters: boolean;
  errorBulkDeletingNewsletters: Error | null;
}

export const useNewsletters = (
  filters: NewsletterFilter = {},
  options: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    staleTime?: number;
    cacheTime?: number;
  } = {},
): UseNewslettersReturn => {
  const { user } = useAuth();
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = CACHE_CONFIG.LIST_STALE_TIME,
    cacheTime = CACHE_CONFIG.LIST_CACHE_TIME,
  } = options;

  // Create cache manager instance
  const cacheManager = useMemo(
    () => getCacheManager() as SimpleCacheManager,
    [],
  );

  // Generate query key with filters
  const queryKey = useMemo(
    () => queryKeyFactory.newsletters.list(filters),
    [filters],
  );

  // Build API query parameters from filters
  const queryParams = useMemo(() => {
    return {
      search: filters.search,
      isRead: filters.isRead,
      isArchived: filters.isArchived,
      isLiked: filters.isLiked,
      isBookmarked: filters.isBookmarked,
      tagIds: filters.tagIds,
      sourceIds: filters.sourceIds,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      orderBy: filters.orderBy || "received_at",
      ascending: filters.ascending ?? false,
      includeRelations: true,
      includeTags: true,
      includeSource: true,
    };
  }, [filters]);

  // Main newsletters query using the new API
  const {
    data: newslettersResponse,
    isLoading,
    error: errorNewsletters,
    refetch: refetchNewsletters,
  } = useQuery({
    queryKey,
    queryFn: () => newsletterApi.getAll(queryParams),
    enabled: enabled && !!user,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    retry: CACHE_CONFIG.MAX_RETRIES,
    retryDelay: (attemptIndex) =>
      Math.min(
        CACHE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attemptIndex),
        CACHE_CONFIG.MAX_RETRY_DELAY,
      ),
  });

  const newsletters = newslettersResponse?.data || [];

  // Get single newsletter function
  const getNewsletter = useCallback(
    async (id: string): Promise<NewsletterWithRelations | null> => {
      return newsletterApi.getById(id);
    },
    [],
  );

  // Mark as read mutation
  const markAsReadMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.markAsRead(id);
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_read: true,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
    },
    onError: (_err, id, context) => {
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
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], "mark-as-read");
    },
  });

  // Mark as unread mutation
  const markAsUnreadMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.markAsUnread(id);
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_read: false,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
    },
    onError: (_err, id, context) => {
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
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], "mark-as-unread");
    },
  });

  // Bulk mark as read mutation
  const bulkMarkAsReadMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      const result = await newsletterApi.bulkUpdate({
        ids,
        updates: { is_read: true },
      });
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          ids.some((id) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: {
            is_read: true,
            updated_at: new Date().toISOString(),
          },
        })),
      );

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find(
            (n) => n.id === id,
          );
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
    onSettled: (_data, _error, ids) => {
      cacheManager.invalidateRelatedQueries(ids, "bulk-mark-as-read");
    },
  });

  // Bulk mark as unread mutation
  const bulkMarkAsUnreadMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      const result = await newsletterApi.bulkUpdate({
        ids,
        updates: { is_read: false },
      });
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          ids.some((id) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: {
            is_read: false,
            updated_at: new Date().toISOString(),
          },
        })),
      );

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find(
            (n) => n.id === id,
          );
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
    onSettled: (_data, _error, ids) => {
      cacheManager.invalidateRelatedQueries(ids, "bulk-mark-as-unread");
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.toggleLike(id);
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];
      const newsletter = previousNewsletters.find((n) => n.id === id);

      if (newsletter) {
        cacheManager.updateNewsletterInCache({
          id,
          updates: {
            is_liked: !newsletter.is_liked,
            updated_at: new Date().toISOString(),
          },
        });
      }

      return { previousNewsletters };
    },
    onError: (_err, id, context) => {
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
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], "toggle-like");
    },
  });

  // Toggle archive mutation
  const toggleArchiveMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.toggleArchive(id);
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];
      const newsletter = previousNewsletters.find((n) => n.id === id);

      if (newsletter) {
        cacheManager.updateNewsletterInCache({
          id,
          updates: {
            is_archived: !newsletter.is_archived,
            updated_at: new Date().toISOString(),
          },
        });
      }

      return { previousNewsletters };
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
      cacheManager.invalidateRelatedQueries([id], "toggle-archive");
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      const result = await newsletterApi.bulkArchive(ids);
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          ids.some((id) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: {
            is_archived: true,
            updated_at: new Date().toISOString(),
          },
        })),
      );

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find(
            (n) => n.id === id,
          );
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
      cacheManager.invalidateRelatedQueries(ids, "bulk-archive");
    },
  });

  // Bulk unarchive mutation
  const bulkUnarchiveMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      const result = await newsletterApi.bulkUnarchive(ids);
      return result.successCount === ids.length;
    },
    onMutate: async (ids) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          ids.some((id) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({
          id,
          updates: {
            is_archived: false,
            updated_at: new Date().toISOString(),
          },
        })),
      );

      return { previousNewsletters };
    },
    onError: (_err, ids, context) => {
      if (context?.previousNewsletters) {
        ids.forEach((id) => {
          const newsletter = context.previousNewsletters!.find(
            (n) => n.id === id,
          );
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
      cacheManager.invalidateRelatedQueries(ids, "bulk-unarchive");
    },
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation<boolean, Error, string, unknown>(
    {
      mutationFn: async (id: string) => {
        return newsletterApi.delete(id);
      },
      onSettled: (_data, _error, id) => {
        cacheManager.invalidateRelatedQueries([id], "delete");
      },
    },
  );

  // Bulk delete newsletters mutation
  const bulkDeleteNewslettersMutation = useMutation<
    boolean,
    Error,
    string[],
    unknown
  >({
    mutationFn: async (ids: string[]) => {
      // Delete each newsletter individually since we don't have a bulk delete in the API yet
      const promises = ids.map((id) => newsletterApi.delete(id));
      await Promise.all(promises);
      return true;
    },
    onSettled: (_data, _error, ids) => {
      cacheManager.invalidateRelatedQueries(ids, "bulk-delete");
    },
  });

  // Placeholder for queue operations (if needed in the future)
  const toggleInQueueMutation = useMutation<boolean, Error, string, unknown>({
    mutationFn: async (id: string) => {
      // This would need to be implemented in the API layer
      throw new Error("Queue operations not yet implemented");
    },
  });

  // Unarchive mutation (separate from toggle for specific use cases)
  const unarchiveMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.update({ id, is_archived: false });
      return true;
    },
    onMutate: async (id) => {
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_archived: false,
          updated_at: new Date().toISOString(),
        },
      });

      return { previousNewsletters };
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
      cacheManager.invalidateRelatedQueries([id], "unarchive");
    },
  });

  // Memoized callback functions
  const markAsRead = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>,
    ) => {
      return markAsReadMutation.mutateAsync(id, options);
    },
    [markAsReadMutation],
  );

  const markAsUnread = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>,
    ) => {
      return markAsUnreadMutation.mutateAsync(id, options);
    },
    [markAsUnreadMutation],
  );

  const bulkMarkAsRead = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<
        boolean,
        Error,
        string[],
        PreviousNewslettersState
      >,
    ) => {
      return bulkMarkAsReadMutation.mutateAsync(ids, options);
    },
    [bulkMarkAsReadMutation],
  );

  const bulkMarkAsUnread = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<
        boolean,
        Error,
        string[],
        PreviousNewslettersState
      >,
    ) => {
      return bulkMarkAsUnreadMutation.mutateAsync(ids, options);
    },
    [bulkMarkAsUnreadMutation],
  );

  const toggleLike = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>,
    ) => {
      return toggleLikeMutation.mutateAsync(id, options);
    },
    [toggleLikeMutation],
  );

  const toggleArchive = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>,
    ) => {
      return toggleArchiveMutation.mutateAsync(id, options);
    },
    [toggleArchiveMutation],
  );

  const bulkArchive = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<
        boolean,
        Error,
        string[],
        PreviousNewslettersState
      >,
    ) => {
      return bulkArchiveMutation.mutateAsync(ids, options);
    },
    [bulkArchiveMutation],
  );

  const bulkUnarchive = useCallback(
    async (
      ids: string[],
      options?: MutateOptions<
        boolean,
        Error,
        string[],
        PreviousNewslettersState
      >,
    ) => {
      return bulkUnarchiveMutation.mutateAsync(ids, options);
    },
    [bulkUnarchiveMutation],
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
  } as const;
};
