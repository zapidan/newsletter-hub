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
    debug?: boolean;
  } = {},
): UseNewslettersReturn => {
  const { user } = useAuth();
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = CACHE_CONFIG.LIST_STALE_TIME,
    cacheTime = CACHE_CONFIG.LIST_CACHE_TIME,
    debug = false,
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
    const params = {
      search: filters.search,
      isRead: filters.isRead,
      isArchived: filters.isArchived,
      isLiked: filters.isLiked,
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

    // Enhanced debugging for source filtering issues
    console.group("📝 useNewsletters - Building query params");
    console.log("Input filters:", JSON.stringify(filters, null, 2));
    console.log("Processed params:", JSON.stringify(params, null, 2));
    console.log("Source filtering details:", {
      hasSourceIds: !!filters.sourceIds,
      sourceIds: filters.sourceIds || [],
      sourceIdsType: Array.isArray(filters.sourceIds)
        ? "array"
        : typeof filters.sourceIds,
      sourceIdsLength: Array.isArray(filters.sourceIds)
        ? filters.sourceIds.length
        : 0,
      firstSourceId:
        Array.isArray(filters.sourceIds) && filters.sourceIds.length > 0
          ? filters.sourceIds[0]
          : null,
    });

    // Validate source IDs
    if (filters.sourceIds && filters.sourceIds.length > 0) {
      const validSourceIds = filters.sourceIds.filter(
        (id) => id && typeof id === "string",
      );
      if (validSourceIds.length !== filters.sourceIds.length) {
        console.warn("⚠️ Invalid source IDs detected:", {
          original: filters.sourceIds,
          valid: validSourceIds,
        });
      }
    }

    console.groupEnd();

    return params;
  }, [filters, debug]);

  // Main newsletters query using the new API
  const {
    data: newslettersResponse,
    isLoading,
    error: errorNewsletters,
    refetch: refetchNewsletters,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      console.group("🔍 useNewsletters - Fetching newsletters");
      console.log("Query key:", queryKey);
      console.log("Query params:", JSON.stringify(queryParams, null, 2));

      // Detailed source filtering debug
      if (queryParams.sourceIds && queryParams.sourceIds.length > 0) {
        console.log("🎯 Source filtering active:", {
          sourceIds: queryParams.sourceIds,
          count: queryParams.sourceIds.length,
          apiCall: `newsletterApi.getAll with sourceIds: [${queryParams.sourceIds.join(", ")}]`,
        });
      } else {
        console.log("📋 No source filtering - fetching all newsletters");
      }

      try {
        const result = await newsletterApi.getAll(queryParams);

        console.log("✅ API Response:", {
          status: "success",
          count: result.data?.length || 0,
          hasMore: result.hasMore,
          total: result.count,
          sourceBreakdown:
            result.data?.reduce(
              (acc, newsletter) => {
                const sourceId = newsletter.newsletter_source_id;
                acc[sourceId] = (acc[sourceId] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ) || {},
          firstItem: result.data?.[0]
            ? {
                id: result.data[0].id,
                title: result.data[0].title,
                sourceId: result.data[0].newsletter_source_id,
                sourceName: result.data[0].source?.name,
              }
            : null,
        });

        // Validate source filtering worked
        if (
          queryParams.sourceIds &&
          queryParams.sourceIds.length > 0 &&
          result.data
        ) {
          const unexpectedSources = result.data.filter(
            (newsletter) =>
              !queryParams.sourceIds!.includes(newsletter.newsletter_source_id),
          );
          if (unexpectedSources.length > 0) {
            console.warn("⚠️ Source filtering may not be working correctly:", {
              expectedSources: queryParams.sourceIds,
              unexpectedItems: unexpectedSources.map((n) => ({
                id: n.id,
                sourceId: n.newsletter_source_id,
                sourceName: n.source?.name,
              })),
            });
          } else {
            console.log("✅ Source filtering working correctly");
          }
        }

        return result;
      } catch (error) {
        console.error("❌ API Error:", error);
        throw error;
      } finally {
        console.groupEnd();
      }
    },
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

  // Debug newsletter data
  console.log("📊 useNewsletters - Newsletter data:", {
    count: newsletters.length,
    hasData: !!newslettersResponse,
    isLoading,
    hasError: !!errorNewsletters,
    filters: {
      sourceIds: queryParams.sourceIds,
      hasSourceFilter: !!(
        queryParams.sourceIds && queryParams.sourceIds.length > 0
      ),
    },
  });

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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:read-status-changed"));
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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:read-status-changed"));
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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:read-status-changed"));
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

      const queryData = getQueryData<any>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:read-status-changed"));
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
      // Only cancel detail queries for this specific newsletter, not list queries
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterDetailKey(
            query.queryKey as unknown[],
            id,
          ),
      });

      // Store current state for rollback
      const queryData = getQueryData<any>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

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
      // Use gentle invalidation with delay to prevent empty state
      setTimeout(() => {
        cacheManager.invalidateRelatedQueries([id], "toggle-like");
      }, 200);
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

      // Get the current newsletter list data to understand the current filter context
      const queryData = getQueryData<any>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];
      const newsletter = previousNewsletters.find(
        (n: NewsletterWithRelations) => n.id === id,
      );

      if (!newsletter) {
        return { previousNewsletters };
      }

      const newArchivedState = !newsletter.is_archived;

      // Determine if we should remove the newsletter from the current view
      const currentFilter = filters;
      const shouldRemoveFromView =
        newArchivedState && // Newsletter is being archived
        (currentFilter.isArchived === false ||
          currentFilter.isArchived === undefined); // And we're not in archived view

      if (shouldRemoveFromView) {
        // Remove the newsletter from the current filtered view immediately
        cacheManager.queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data))
            return oldData;

          const filteredData = oldData.data.filter(
            (n: NewsletterWithRelations) => n.id !== id,
          );
          return {
            ...oldData,
            data: filteredData,
            count: Math.max(0, (oldData.count || 0) - 1),
          };
        });
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
          cacheManager.queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData || !oldData.data || !Array.isArray(oldData.data))
              return oldData;

            // Add the newsletter back to its original position
            const restoredData = [...oldData.data];
            const originalIndex = context.previousNewsletters!.findIndex(
              (n) => n.id === id,
            );
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
          });
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
      // Use minimal invalidation to preserve filter state
      cacheManager.invalidateRelatedQueries([id], "toggle-archive");
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:archived"));
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

      const queryData = getQueryData<any>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:archived"));
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

      const queryData = getQueryData<any>(queryKey);
      const previousNewsletters = Array.isArray(queryData?.data)
        ? queryData.data
        : Array.isArray(queryData)
          ? queryData
          : [];

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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:archived"));
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
      // Dispatch event for unread count updates
      window.dispatchEvent(new CustomEvent("newsletter:deleted"));
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
