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
import { readingQueueApi } from "../api/readingQueueApi";
import { useAuth } from "../contexts/AuthContext";
import { NewsletterWithRelations, ReadingQueueItem } from "../types";
import { PaginatedResponse } from "../types/api";
import type { NewsletterFilter } from "../types/cache";
import { queryKeyFactory } from "../utils/queryKeyFactory";
import { updateNewsletterTags } from "../utils/tagUtils";
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
  rollbackFunctions?: Array<() => void>;
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
  ) => Promise<
    QueryObserverResult<PaginatedResponse<NewsletterWithRelations>, Error>
  >;

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

  // Bookmark mutations
  toggleBookmark: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isTogglingBookmark: boolean;
  errorTogglingBookmark: Error | null;

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

  // Tag mutations
  updateNewsletterTags: (
    id: string,
    tagIds: string[],
    options?: MutateOptions<
      boolean,
      Error,
      { id: string; tagIds: string[] },
      PreviousNewslettersState
    >,
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
      // Cancel any outgoing refetches to avoid race conditions
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

      // Store current state for rollback
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey);

      // Ensure previousNewsletters is always an array
      const newsletterArray = Array.isArray(previousNewsletters)
        ? previousNewsletters
        : [];

      // Find the current newsletter to get its like status
      const currentNewsletter = newsletterArray.find((n) => n.id === id);
      const currentLikedState = currentNewsletter?.is_liked ?? false;
      const newLikedState = !currentLikedState;

      const rollbackFunctions: Array<() => void> = [];

      try {
        // Update newsletter list optimistically with rollback
        const listResult = await cacheManager.optimisticUpdateWithRollback<
          NewsletterWithRelations[]
        >([...queryKey], (data) => {
          // Always return a valid array, even if data is undefined
          const currentData = Array.isArray(data) ? data : [];
          return currentData.map((newsletter) =>
            newsletter.id === id
              ? { ...newsletter, is_liked: newLikedState }
              : newsletter,
          );
        });

        if (listResult?.rollback) {
          rollbackFunctions.push(listResult.rollback);
        }

        // Update individual newsletter queries with rollback
        const detailQueries = cacheManager.queryClient.getQueryCache().findAll({
          predicate: (query) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
        });

        for (const query of detailQueries) {
          try {
            const detailResult =
              await cacheManager.optimisticUpdateWithRollback<NewsletterWithRelations>(
                Array.from(query.queryKey),
                (data) => {
                  if (!data) return data;
                  return { ...data, is_liked: newLikedState };
                },
              );

            if (detailResult?.rollback) {
              rollbackFunctions.push(detailResult.rollback);
            }
          } catch (detailError) {
            console.warn(
              "Failed to update individual newsletter query:",
              query.queryKey,
              detailError,
            );
            // Continue with other queries even if one fails
          }
        }
      } catch (error) {
        console.error("Optimistic update failed:", error);
        // Execute any rollback functions that were successfully created
        rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
          }
        });
      }

      return {
        previousNewsletters: newsletterArray,
        currentLikedState,
        newLikedState,
        rollbackFunctions,
      };
    },
    onError: (_error, id, context) => {
      console.error("Error toggling like status:", _error);

      // Execute rollback functions if available
      if (context?.rollbackFunctions) {
        context.rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
          }
        });
      }

      // Force refresh of affected queries as fallback
      cacheManager.invalidateRelatedQueries([id], "toggle-like-error");
    },
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], "toggle-like");
    },
  });

  // Toggle bookmark mutation
  const toggleBookmarkMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      await newsletterApi.toggleBookmark(id);
      return true;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid race conditions
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

      // Store current state for rollback
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey);

      // Ensure previousNewsletters is always an array
      const newsletterArray = Array.isArray(previousNewsletters)
        ? previousNewsletters
        : [];

      // Find the current newsletter to get its bookmark status
      const currentNewsletter = newsletterArray.find((n) => n.id === id);
      const currentBookmarkedState = currentNewsletter?.is_bookmarked ?? false;
      const newBookmarkedState = !currentBookmarkedState;

      const rollbackFunctions: Array<() => void> = [];

      try {
        // Update newsletter list optimistically with rollback
        const listResult = await cacheManager.optimisticUpdateWithRollback<
          NewsletterWithRelations[]
        >([...queryKey], (data) => {
          // Always return a valid array, even if data is undefined
          const currentData = Array.isArray(data) ? data : [];
          return currentData.map((newsletter) =>
            newsletter.id === id
              ? { ...newsletter, is_bookmarked: newBookmarkedState }
              : newsletter,
          );
        });

        if (listResult?.rollback) {
          rollbackFunctions.push(listResult.rollback);
        }

        // Update individual newsletter queries with rollback
        const detailQueries = cacheManager.queryClient.getQueryCache().findAll({
          predicate: (query) =>
            queryKeyFactory.matchers.isNewsletterDetailKey(
              query.queryKey as unknown[],
              id,
            ),
        });

        for (const query of detailQueries) {
          try {
            const detailResult =
              await cacheManager.optimisticUpdateWithRollback<NewsletterWithRelations>(
                Array.from(query.queryKey),
                (data) => {
                  if (!data) return data;
                  return { ...data, is_bookmarked: newBookmarkedState };
                },
              );

            if (detailResult?.rollback) {
              rollbackFunctions.push(detailResult.rollback);
            }
          } catch (detailError) {
            console.warn(
              "Failed to update individual newsletter query:",
              query.queryKey,
              detailError,
            );
            // Continue with other queries even if one fails
          }
        }
      } catch (error) {
        console.error("Optimistic update failed:", error);
        // Execute any rollback functions that were successfully created
        rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
          }
        });
      }

      return {
        previousNewsletters: newsletterArray,
        currentBookmarkedState,
        newBookmarkedState,
        rollbackFunctions,
      };
    },
    onError: (_error, id, context) => {
      console.error("Error toggling bookmark status:", _error);

      // Execute rollback functions if available
      if (context?.rollbackFunctions) {
        context.rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
          }
        });
      }

      // Force refresh of affected queries as fallback
      cacheManager.invalidateRelatedQueries([id], "toggle-bookmark-error");
    },
    onSettled: (_data, _error, id) => {
      cacheManager.invalidateRelatedQueries([id], "toggle-bookmark");
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
      // Cancel any outgoing refetches to avoid race conditions
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

      // Get the current newsletter to toggle its archived status
      const newsletter = await getNewsletter(id);
      if (!newsletter) {
        return { previousNewsletters: [] };
      }

      // Optimistically update the cache
      cacheManager.updateNewsletterInCache({
        id,
        updates: {
          is_archived: !newsletter.is_archived,
          updated_at: new Date().toISOString(),
        },
      });

      // Return the previous state in case we need to rollback
      return {
        previousNewsletters: [newsletter],
      };
    },
    onError: (_err, id, context) => {
      // Rollback to the previous state on error
      if (context?.previousNewsletters) {
        context.previousNewsletters.forEach((newsletter) => {
          cacheManager.updateNewsletterInCache({
            id,
            updates: {
              is_archived: newsletter.is_archived,
              updated_at: newsletter.updated_at,
            },
          });
        });
      }
    },
    onSettled: (_data, _error, id) => {
      // Invalidate the queries to ensure we have fresh data
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
        getQueryData<ReadingQueueItem[]>(queryKeyFactory.queue.lists()) || [];
      let isInQueue = queueItems.some((item) => item.newsletter_id === id);

      // If cache is empty or unreliable, check API
      if (queueItems.length === 0) {
        try {
          isInQueue = await readingQueueApi.isInQueue(id);
        } catch (error) {
          console.warn(
            "Failed to check queue status, proceeding with cache value:",
            error,
          );
        }
      }

      // Perform the toggle operation
      if (isInQueue) {
        const queueItem = queueItems.find((item) => item.newsletter_id === id);
        if (queueItem) {
          await readingQueueApi.remove(queueItem.id);
        }
      } else {
        await readingQueueApi.add(id);
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
            queryKey[0] === "reading-queue" ||
            queryKey[0] === "unreadCount"
          );
        },
      });

      const rollbackFunctions: Array<() => void> = [];

      // Get current states for rollback
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      const newsletterArray = Array.isArray(previousNewsletters)
        ? previousNewsletters
        : [];

      const queueItems =
        getQueryData<ReadingQueueItem[]>(queryKeyFactory.queue.lists()) || [];
      const wasInQueue = queueItems.some((item) => item.newsletter_id === id);

      // Note: We don't need to update newsletter lists since queue status
      // is managed separately through ReadingQueueItem table

      // Apply optimistic updates to reading queue with better error handling
      const queueQueryKey = queryKeyFactory.queue.lists();
      try {
        const result = await cacheManager.optimisticUpdateWithRollback<
          ReadingQueueItem[]
        >(Array.from(queueQueryKey), (data) => {
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
                user_id: user?.id || "",
                position: currentData.length + 1,
                added_at: new Date().toISOString(),
                newsletter,
              };
              return [...currentData, mockQueueItem];
            }
          }
          return currentData;
        });

        if (result?.rollback) {
          rollbackFunctions.push(result.rollback);
        }
      } catch (error) {
        console.warn("Failed to apply optimistic update to queue:", error);
        // Don't throw here - we want to continue with the mutation
      }

      return {
        previousNewsletters: newsletterArray,
        wasInQueue,
        rollbackFunctions,
      };
    },
    onError: (error, id, context) => {
      console.error("Error toggling queue status:", error);

      // Execute all rollback functions
      if (context?.rollbackFunctions) {
        context.rollbackFunctions.forEach((rollback) => {
          try {
            rollback();
          } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
          }
        });
      }

      // Force refresh of queue data as fallback
      cacheManager.invalidateRelatedQueries([id], "toggle-queue-error");
    },
    onSuccess: (_result, id) => {
      // Use smart invalidation for efficient cache updates
      cacheManager.smartInvalidate({
        operation: "toggle-queue",
        newsletterIds: [id],
        priority: "high",
      });
    },
    onSettled: (_data, _error, id) => {
      // Ensure fresh data with minimal invalidation
      cacheManager.invalidateRelatedQueries([id], "toggle-queue");
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
        throw new Error("User authentication required");
      }

      // Get current newsletter to get current tags
      const currentNewsletter = await newsletterApi.getById(id);
      if (!currentNewsletter) {
        throw new Error("Newsletter not found");
      }

      const currentTagIds = currentNewsletter.tags?.map((tag) => tag.id) || [];

      // Update newsletter tags using the tag utility
      await updateNewsletterTags(id, tagIds, currentTagIds, user.id);
      return true;
    },
    onMutate: async ({ id }) => {
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
      cacheManager.invalidateRelatedQueries([id], "update-tags");
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

      const newsletterArray = Array.isArray(previousNewsletters)
        ? previousNewsletters
        : [];

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

  const toggleBookmark = useCallback(
    async (
      id: string,
      options?: MutateOptions<boolean, Error, string, PreviousNewslettersState>,
    ) => {
      return toggleBookmarkMutation.mutateAsync(id, options);
    },
    [toggleBookmarkMutation],
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

  const updateNewsletterTagsCallback = useCallback(
    async (
      id: string,
      tagIds: string[],
      options?: MutateOptions<
        boolean,
        Error,
        { id: string; tagIds: string[] },
        PreviousNewslettersState
      >,
    ) => {
      await updateNewsletterTagsMutation.mutateAsync({ id, tagIds }, options);
    },
    [updateNewsletterTagsMutation],
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

    // Bookmark mutation
    toggleBookmark,
    isTogglingBookmark: toggleBookmarkMutation.isPending,
    errorTogglingBookmark: toggleBookmarkMutation.error,

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
