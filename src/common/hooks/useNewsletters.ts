import { useCallback, useMemo, useRef } from "react";
import {
  useQuery,
  useMutation,
  QueryObserverResult,
  RefetchOptions,
  UseMutateAsyncFunction,
  MutateOptions,
} from "@tanstack/react-query";

import { supabase } from "../services/supabaseClient";
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
  setQueryData,
  cancelQueries,
} from "../utils/cacheUtils";

type PreviousNewslettersState = {
  previousNewsletters?: NewsletterWithRelations[];
  previousNewsletter?: NewsletterWithRelations;
  deletedIds?: string[];
};

// Legacy query keys - maintained for backward compatibility
// @deprecated Use queryKeyFactory instead
const queryKeys = {
  all: ["newsletters"],
  lists: () => [...queryKeys.all, "list"],
  list: (filters: Record<string, unknown> = {}) => [
    ...queryKeys.lists(),
    filters,
  ],
  detail: (id: string) => [...queryKeys.all, "detail", id],
  tags: (tagId?: string) =>
    tagId ? [...queryKeys.all, "tags", tagId] : [...queryKeys.all, "tags"],
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

// Performance monitoring
const performanceMetrics = new Map<string, number>();

const logPerformance = (operation: string, duration: number) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[useNewsletters] ${operation} took ${duration.toFixed(2)}ms`);
  }
  performanceMetrics.set(operation, duration);
};

// Helper function to update newsletter in cache
// Removed unused updateNewsletterInCache function

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

  // Bulk read status mutations
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
  toggleLike: (
    id: string,
    isLikedParam?: boolean,
    options?: MutateOptions<
      boolean,
      Error,
      { id: string; isLiked: boolean },
      PreviousNewslettersState
    >,
  ) => Promise<boolean>;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;

  // Archive mutations
  toggleArchive: (
    id: string,
    isArchived: boolean,
    options?: MutateOptions<
      NewsletterWithRelations | boolean,
      Error,
      { id: string; isArchived: boolean } | string,
      PreviousNewslettersState
    >,
  ) => Promise<boolean>;
  isArchiving: boolean;
  errorArchiving: Error | null;
  isUnarchiving: boolean;
  errorUnarchiving: Error | null;

  // Bulk archive mutations
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
  isBulkArchiving: boolean;
  errorBulkArchiving: Error | null;
  isBulkUnarchiving: boolean;
  errorBulkUnarchiving: Error | null;

  // Queue mutations
  toggleInQueue: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isTogglingInQueue: boolean;
  errorTogglingInQueue: Error | null;

  // Delete mutations
  deleteNewsletter: UseMutateAsyncFunction<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >;
  isDeletingNewsletter: boolean;
  errorDeletingNewsletter: Error | null;
  bulkDeleteNewsletters: UseMutateAsyncFunction<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >;
  isBulkDeletingNewsletters: boolean;
  errorBulkDeletingNewsletters: Error | null;
}

// API response type that includes nested structures
interface NewsletterApiResponse extends Omit<Newsletter, "source" | "tags"> {
  newsletter_tags?: Array<{ tag: Tag }>;
  source?: NewsletterSource | null;
}

// Helper function to transform newsletter data
const transformNewsletterData = (
  data: NewsletterApiResponse[] | null,
): NewsletterWithRelations[] => {
  if (!data) return [];

  return data.map((item: NewsletterApiResponse) => {
    const tags = (item.newsletter_tags || [])
      .map((nt: { tag: Tag }) =>
        nt.tag
          ? {
              id: nt.tag.id,
              name: nt.tag.name,
              color: nt.tag.color,
              user_id: nt.tag.user_id,
              created_at: nt.tag.created_at || new Date().toISOString(),
            }
          : null,
      )
      .filter(Boolean) as Tag[];

    const source = item.source || null;

    // Explicitly check if is_archived exists on the item before setting a default
    const isArchived = "is_archived" in item ? item.is_archived : false;

    return {
      ...item,
      newsletter_source_id: item.newsletter_source_id || null,
      source,
      tags,
      is_archived: isArchived,
      is_read: item.is_read || false,
      is_liked: item.is_liked || false,
    } as NewsletterWithRelations;
  });
};

export const useNewsletters = (
  tagId?: string,
  filter: NewsletterFilter = "all",
  sourceId?: string | null,
  groupSourceIds: string[] = [],
  timeRange?: string,
): UseNewslettersReturn => {
  const { user } = useAuth();

  if (!user?.id) {
    throw new Error(
      "useNewsletters must be used within an AuthProvider with a logged-in user",
    );
  }

  // Initialize cache manager
  const cacheManager = useMemo((): SimpleCacheManager => {
    try {
      return getCacheManager();
    } catch {
      // Cache manager should be initialized elsewhere
      throw new Error("Cache manager not initialized");
    }
  }, []);

  // Build query key with new factory
  const queryKey = useMemo(
    () =>
      queryKeyFactory.newsletters.list({
        userId: user.id,
        tagIds: tagId ? [tagId] : undefined,
        filter,
        sourceId,
        groupSourceIds: groupSourceIds.length ? groupSourceIds : undefined,
        timeRange,
      }),
    [user.id, tagId, filter, sourceId, groupSourceIds, timeRange],
  );

  // Performance monitoring
  const performanceTimers = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((operation: string) => {
    performanceTimers.current.set(operation, performance.now());
  }, []);

  const endTimer = useCallback((operation: string) => {
    const start = performanceTimers.current.get(operation);
    if (start) {
      const duration = performance.now() - start;
      logPerformance(operation, duration);
      performanceTimers.current.delete(operation);
    }
  }, []);

  // Helper function to fetch all newsletters with proper typing
  const fetchAllNewsletters = useCallback(async (): Promise<
    NewsletterWithRelations[]
  > => {
    if (!user?.id) {
      console.warn(
        "[useNewsletters] No user ID available, skipping newsletter fetch",
      );
      return [];
    }

    try {
      // First, ensure we have a valid session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error(
          "No active session found or session error:",
          sessionError,
        );
        // Attempt to refresh the session
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          console.error("Failed to refresh session:", refreshError);
          throw new Error("Session expired. Please sign in again.");
        }
      }

      console.log("Fetching newsletters with user ID:", user.id);

      // Add a timeout to the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await supabase
          .from("newsletters")
          .select(
            `
            *,
            source:newsletter_sources(*),
            newsletter_tags!left(
              tag:tags(*)
            )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        // Check if we got a response with an error
        if (response.error) {
          console.error("Supabase error fetching newsletters:", {
            message: response.error.message,
            details: response.error.details,
            hint: response.error.hint,
            code: response.error.code,
          });

          // If we get an auth error, try to refresh the session and retry once
          if (
            response.error.code === "PGRST301" ||
            response.error.message.includes("JWT")
          ) {
            console.log(
              "Auth error detected, attempting to refresh session...",
            );
            const {
              data: { session: newSession },
              error: refreshError,
            } = await supabase.auth.refreshSession();

            if (refreshError || !newSession) {
              console.error("Failed to refresh session:", refreshError);
              throw new Error("Session expired. Please sign in again.");
            }

            // Retry the request with the new session
            console.log("Session refreshed, retrying request...");
            const retryResponse = await supabase
              .from("newsletters")
              .select(
                `
                *,
                source:newsletter_sources(*),
                newsletter_tags!left(
                  tag:tags(*)
                )
              `,
              )
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });

            if (retryResponse.error) {
              console.error(
                "Error on retry after session refresh:",
                retryResponse.error,
              );
              throw retryResponse.error;
            }

            return transformNewsletterData(retryResponse.data || []);
          }

          throw response.error;
        }

        return transformNewsletterData(response.data || []);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        // Check for network errors
        if (error.name === "AbortError") {
          console.error("Request timed out");
          throw new Error(
            "Request timed out. Please check your connection and try again.",
          );
        }

        // Check for HTML response errors
        if (
          error.message.includes("Unexpected token") &&
          error.message.includes("<!doctype")
        ) {
          console.error(
            "Received HTML response instead of JSON. This usually indicates an authentication or server error.",
          );
          throw new Error(
            "Server error: Received invalid response. The server might be experiencing issues.",
          );
        }

        // Check for network connectivity issues
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError")
        ) {
          console.error("Network error:", error);
          throw new Error(
            "Network error: Unable to connect to the server. Please check your internet connection.",
          );
        }
      }

      // Log the full error for debugging
      console.error("Error in fetchAllNewsletters:", {
        message: error instanceof Error ? error.message : "Unknown error",
        name: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw with a user-friendly message
      throw new Error("Failed to load newsletters. Please try again later.");
    }
  }, [user?.id]);

  // Main query for newsletters with optimized cache configuration
  const {
    data: allNewsletters = [],
    isLoading,
    error: errorNewsletters,
    refetch: refetchNewsletters,
  } = useQuery<NewsletterWithRelations[], Error>({
    queryKey,
    queryFn: fetchAllNewsletters,
    staleTime: CACHE_CONFIG.LIST_STALE_TIME,
    gcTime: CACHE_CONFIG.LIST_CACHE_TIME,
    enabled: !!user?.id,
    refetchOnWindowFocus: false, // Prevent refetch on window focus for better UX
    refetchOnReconnect: true, // Refetch when connection is restored
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("4") ||
        errorMessage.includes("Session expired")
      ) {
        return false;
      }
      // Retry up to MAX_RETRIES times for other errors
      return failureCount < CACHE_CONFIG.MAX_RETRIES;
    },
    retryDelay: (attemptIndex: number) =>
      Math.min(
        CACHE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attemptIndex),
        CACHE_CONFIG.MAX_RETRY_DELAY,
      ),
    networkMode: "online", // Only run queries when online
  });

  // Mark as read mutation with optimistic updates
  const markAsReadMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (newsletterId) => {
      startTimer("markAsRead");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", newsletterId);

        if (error) throw error;
        return true;
      } finally {
        endTimer("markAsRead");
      }
    },
    onMutate: async (newsletterId) => {
      // Use cache manager for optimistic update
      const originalData = await cacheManager.optimisticUpdate(
        newsletterId,
        { is_read: true },
        "mark-read",
      );

      return { previousNewsletter: originalData || undefined };
    },
    onError: (err, newsletterId, context) => {
      console.error("Error marking as read:", err);
      // Revert optimistic update using cache manager
      if (context?.previousNewsletter) {
        cacheManager.updateNewsletterInCache({
          id: newsletterId,
          updates: context.previousNewsletter,
        });
      }
    },
    onSettled: (_data, _error, newsletterId) => {
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries([newsletterId], "mark-read");
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
      startTimer("markAsUnread");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_read: false,
          })
          .eq("id", id);

        if (error) throw error;
        return true;
      } finally {
        endTimer("markAsUnread");
      }
    },
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches for this newsletter
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

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Find the newsletter to check if it's archived
      const newsletter = previousNewsletters.find((n) => n.id === id);

      // Don't update read status for archived newsletters
      if (newsletter?.is_archived) {
        return { previousNewsletters };
      }

      // Use cache manager for optimistic update
      cacheManager.updateNewsletterInCache({
        id,
        updates: { is_read: false },
      });

      return { previousNewsletters };
    },
    onError: (err, id, context) => {
      console.error("Error marking as unread:", err);
      // Revert optimistic update using cache manager
      if (context?.previousNewsletters) {
        cacheManager.updateNewsletterInCache({
          id: id,
          updates: { is_read: true },
        });
      }
    },
    onSettled: (_data, _error, id) => {
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries([id], "mark-unread");
    },
  });

  // Bulk delete newsletters mutation
  const bulkDeleteNewslettersMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      startTimer("bulkDeleteNewsletters");
      try {
        const { error } = await supabase
          .from("newsletters")
          .delete()
          .in("id", ids);

        if (error) throw error;
        return true;
      } finally {
        endTimer("bulkDeleteNewsletters");
      }
    },
    onMutate: async (ids) => {
      // Use cache manager for batch optimistic updates
      await cacheManager.batchUpdateNewsletters(
        ids.map((id) => ({ id, updates: { is_archived: true } })),
      );

      return { deletedIds: ids };
    },
    onError: (err, ids) => {
      console.error("Error bulk deleting newsletters:", err);
      // Revert by invalidating affected queries
      cacheManager.invalidateRelatedQueries(ids, "bulk-delete");
    },
    onSettled: (_data, _error, ids) => {
      // Final invalidation to ensure consistency
      cacheManager.invalidateRelatedQueries(ids, "bulk-archive");
    },
  });

  // Toggle in queue mutation
  const toggleInQueueMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      startTimer("toggleInQueue");
      try {
        // Check if the newsletter is already in the queue
        const { data: existingItem, error: checkError } = await supabase
          .from("reading_queue")
          .select("id, newsletter_id, position")
          .eq("user_id", user.id)
          .eq("newsletter_id", newsletterId)
          .maybeSingle();

        if (checkError) {
          throw checkError;
        }

        if (existingItem) {
          // Remove from queue
          const { error: deleteError } = await supabase
            .from("reading_queue")
            .delete()
            .eq("id", existingItem.id)
            .eq("user_id", user.id);

          if (deleteError) {
            throw deleteError;
          }

          return false; // Removed from queue
        } else {
          // Add to queue - get the current max position
          const { data: maxPosition, error: positionError } = await supabase
            .from("reading_queue")
            .select("position")
            .eq("user_id", user.id)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (positionError && positionError.code !== "PGRST116") {
            throw positionError;
          }

          const nextPosition = (maxPosition?.position ?? -1) + 1;

          // Add to queue
          const { error: insertError } = await supabase
            .from("reading_queue")
            .insert({
              user_id: user.id,
              newsletter_id: newsletterId,
              position: nextPosition,
            })
            .select()
            .single();

          if (insertError) {
            if (insertError.code === "23505") {
              // Item already exists, consider it successful
              return true;
            }
            throw insertError;
          }

          return true; // Added to queue
        }
      } finally {
        endTimer("toggleInQueue");
      }
    },
    onMutate: async (newsletterId) => {
      if (!user?.id) return;

      // Cancel any outgoing refetches
      await cancelQueries({
        predicate: (query) =>
          queryKeyFactory.matchers.isNewsletterListKey(
            query.queryKey as unknown[],
          ) ||
          queryKeyFactory.matchers.isReadingQueueKey(
            query.queryKey as unknown[],
          ),
      });

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Get current queue state
      const currentQueue =
        getQueryData<{ newsletter_id: string }[]>(
          queryKeyFactory.queue.list(user.id),
        ) || [];

      const isInQueue = currentQueue.some(
        (item) => item.newsletter_id === newsletterId,
      );

      // Use cache manager for optimistic update
      cacheManager.updateNewsletterInCache({
        id: newsletterId,
        updates: { is_bookmarked: !isInQueue },
      });

      return { previousNewsletters, wasInQueue: isInQueue };
    },
    onError: (err, newsletterId, context) => {
      console.error("Error toggling queue:", err);
      // Revert on error using cache manager
      if (context?.previousNewsletters && user?.id) {
        const newsletter = context.previousNewsletters!.find(
          (n) => n.id === newsletterId,
        );
        if (newsletter) {
          cacheManager.updateNewsletterInCache({
            id: newsletterId,
            updates: { is_bookmarked: newsletter.is_bookmarked },
          });
        }
      }
    },
    onSuccess: (result, newsletterId) => {
      if (!user?.id) return;

      // Update newsletter cache to reflect final queue status
      cacheManager.updateNewsletterInCache({
        id: newsletterId,
        updates: { is_bookmarked: result },
      });
    },
    onSettled: (_data, _error, newsletterId) => {
      if (!user?.id) return;

      // Use cache manager for comprehensive invalidation
      cacheManager.invalidateRelatedQueries([newsletterId], "toggle-queue");
    },
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (newsletterId: string) => {
      startTimer("deleteNewsletter");
      try {
        const { error } = await supabase
          .from("newsletters")
          .delete()
          .eq("id", newsletterId);

        if (error) throw error;
        return true;
      } finally {
        endTimer("deleteNewsletter");
      }
    },
    onMutate: async (newsletterId) => {
      // Use cache manager for optimistic delete
      const originalData = await cacheManager.optimisticUpdate(
        newsletterId,
        { is_archived: true },
        "delete",
      );

      return { previousNewsletter: originalData || undefined };
    },
    onError: (err, newsletterId, context) => {
      console.error("Error deleting newsletter:", err);
      // Revert optimistic update using cache manager
      if (context?.previousNewsletter) {
        cacheManager.updateNewsletterInCache({
          id: newsletterId,
          updates: context.previousNewsletter,
        });
      }
    },
    onSettled: (_data, _error, newsletterId) => {
      // Use cache manager for comprehensive invalidation
      cacheManager.invalidateRelatedQueries([newsletterId], "delete");
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation<
    boolean,
    Error,
    { id: string; isLiked: boolean },
    PreviousNewslettersState
  >({
    mutationFn: async ({ id, isLiked }) => {
      startTimer("toggleLike");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_liked: isLiked,
          })
          .eq("id", id);

        if (error) throw error;
        return isLiked;
      } finally {
        endTimer("toggleLike");
      }
    },
    onMutate: async ({ id, isLiked }) => {
      // Use cache manager for optimistic update
      const originalData = await cacheManager.optimisticUpdate(
        id,
        { is_liked: isLiked },
        "toggle-like",
      );

      return { previousNewsletter: originalData || undefined };
    },
    onError: (err, { id }, context) => {
      console.error("Error toggling like:", err);
      // Revert optimistic update using cache manager
      if (context?.previousNewsletter) {
        cacheManager.updateNewsletterInCache({
          id: id,
          updates: context.previousNewsletter,
        });
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries([id], "toggle-like");
    },
  });

  // Archive mutation
  const toggleArchiveMutation = useMutation<
    NewsletterWithRelations,
    Error,
    { id: string; isArchived: boolean },
    PreviousNewslettersState
  >({
    mutationFn: async ({ id, isArchived }) => {
      startTimer("toggleArchive");
      try {
        const { data, error } = await supabase
          .from("newsletters")
          .update({
            is_archived: isArchived,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return transformNewsletterData([data])[0];
      } finally {
        endTimer("toggleArchive");
      }
    },
    onMutate: async ({ id, isArchived }) => {
      // Use cache manager for optimistic update
      const originalData = await cacheManager.optimisticUpdate(
        id,
        { is_archived: isArchived },
        isArchived ? "archive" : "unarchive",
      );

      return { previousNewsletter: originalData || undefined };
    },
    onError: (err, { id }, context) => {
      console.error("Error toggling archive status:", err);
      // Revert optimistic update using cache manager
      if (context?.previousNewsletter) {
        cacheManager.updateNewsletterInCache({
          id: id,
          updates: context.previousNewsletter,
        });
      }
    },
    onSettled: (_data, _error, { id, isArchived }) => {
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries(
        [id],
        isArchived ? "archive" : "unarchive",
      );
    },
  });

  // Unarchive mutation (now handled by toggleArchive with isArchived: false)
  const unarchiveMutation = useMutation<
    boolean,
    Error,
    string,
    PreviousNewslettersState
  >({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("newsletters")
        .update({
          is_archived: false,
        })
        .eq("id", id);

      if (error) throw error;
      return true;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches for newsletter queries
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

      // Define query keys
      const listKey = queryKeyFactory.newsletters.lists();
      const detailKey = queryKeyFactory.newsletters.detail(id);

      // Snapshot the previous values
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(listKey) || [];
      const previousDetail = getQueryData<NewsletterWithRelations>(detailKey);

      // Optimistically update the list cache
      setQueryData<NewsletterWithRelations[]>(listKey, (old = []) =>
        old.map((n) => (n.id === id ? { ...n, is_archived: false } : n)),
      );

      // Optimistically update the detail cache if it exists
      if (previousDetail) {
        setQueryData(detailKey, {
          ...previousDetail,
          is_archived: false,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousNewsletters };
    },
    onError: (err, _id, context) => {
      console.error("Error unarchiving newsletter:", err);
      // Revert on error
      if (context?.previousNewsletters) {
        // Revert using cache manager for consistency
        if (context.previousNewsletters) {
          // Cache warming functionality - could be implemented later
          // cacheManager.warmCache(user.id, "high");
        }
      }
    },
    onSettled: (_data, _error, id) => {
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries([id], "unarchive");
    },
  });

  // Bulk archive and unarchive mutations are defined at the end of the file

  // Cache to store newsletter data by ID and track in-flight requests
  const newsletterCache = useRef<{
    data: Map<string, NewsletterWithRelations | null>;
    inFlight: Map<string, Promise<NewsletterWithRelations | null>>;
  }>({
    data: new Map(),
    inFlight: new Map(),
  });

  // Memoize the getNewsletter function with stable reference
  const getNewsletter = useCallback(
    async (id: string): Promise<NewsletterWithRelations | null> => {
      if (!user?.id) {
        console.log("No user ID, skipping fetch");
        return null;
      }

      // Return from cache if available
      if (newsletterCache.current.data.has(id)) {
        console.log("Returning newsletter from cache:", id);
        return newsletterCache.current.data.get(id) || null;
      }

      // Return existing promise if there's already a request in flight
      if (newsletterCache.current.inFlight.has(id)) {
        console.log("Returning existing in-flight request for:", id);
        return newsletterCache.current.inFlight.get(id) || null;
      }

      console.log(
        "Creating new fetch for newsletter:",
        id,
        "for user:",
        user.id,
      );

      // Create a new promise for this request
      const fetchPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from("newsletters")
            .select(
              `
            *,
            source:newsletter_sources(*),
            newsletter_tags!left(
              tag:tags(*)
            )
          `,
            )
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (error) {
            console.error("Supabase error:", error);
            throw error;
          }

          if (!data) {
            console.log("No newsletter found for ID:", id);
            newsletterCache.current.data.set(id, null);
            return null;
          }

          // Transform the data only if we have it
          const result = transformNewsletterData([data])[0];
          console.log("Successfully fetched newsletter:", result?.id);

          // Cache the result
          if (result) {
            newsletterCache.current.data.set(id, result);
          }

          return result;
        } catch (error) {
          console.error("Error in getNewsletter:", error);
          throw error;
        } finally {
          // Remove from in-flight cache when done
          newsletterCache.current.inFlight.delete(id);
        }
      })();

      // Store the promise in the in-flight cache
      newsletterCache.current.inFlight.set(id, fetchPromise);

      // Return the promise
      return fetchPromise;
    },
    [user?.id],
  ); // Only depends on user.id

  // Filter newsletters based on current filters
  const filteredNewsletters: NewsletterWithRelations[] = useMemo(() => {
    if (!allNewsletters) return [];
    let filtered = [...allNewsletters];

    // Apply tag filter if provided
    if (tagId) {
      filtered = filtered.filter((newsletter) =>
        newsletter.tags?.some((tag: Tag) => tag && tag.id === tagId),
      );
    }

    // Apply source filter if provided
    if (sourceId) {
      filtered = filtered.filter(
        (newsletter) => newsletter.newsletter_source_id === sourceId,
      );
    }

    // Apply group source filter if provided
    if (groupSourceIds && groupSourceIds.length > 0) {
      filtered = filtered.filter(
        (newsletter) =>
          newsletter.newsletter_source_id &&
          groupSourceIds.includes(newsletter.newsletter_source_id),
      );
    }

    // Apply status filter
    switch (filter) {
      case "unread":
        filtered = filtered.filter((n) => !n.is_read && !n.is_archived);
        break;
      case "liked":
        filtered = filtered.filter((n) => n.is_liked && !n.is_archived);
        break;
      case "archived":
        filtered = filtered.filter((n) => n.is_archived);
        break;
      default:
        filtered = filtered.filter((n) => !n.is_archived);
    }

    // Sort by received_at descending
    return filtered.sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
    );
  }, [allNewsletters, filter, tagId, sourceId, groupSourceIds]);

  // Define missing mutation callbacks (used in return statement)

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
      options?: Parameters<typeof markAsUnreadMutation.mutateAsync>[1],
    ) => {
      return markAsUnreadMutation.mutateAsync(id, options);
    },
    [markAsUnreadMutation],
  );

  const toggleLike = useCallback(
    async (
      id: string,
      isLikedParam?: boolean,
      options?: MutateOptions<
        boolean,
        Error,
        { id: string; isLiked: boolean },
        PreviousNewslettersState
      >,
    ) => {
      // If isLiked is not provided, we'll toggle the current state
      let isLiked = isLikedParam;
      if (isLiked === undefined) {
        const newsletter = allNewsletters?.find((n) => n.id === id);
        isLiked = !newsletter?.is_liked;
      }
      return toggleLikeMutation.mutateAsync(
        { id, isLiked: isLiked ?? false },
        options,
      );
    },
    [toggleLikeMutation, allNewsletters],
  );

  const toggleArchive = useCallback(
    async (
      newsletterId: string,
      isArchived: boolean,
      options?: MutateOptions<
        NewsletterWithRelations | boolean,
        Error,
        { id: string; isArchived: boolean } | string,
        PreviousNewslettersState
      >,
    ): Promise<boolean> => {
      if (isArchived) {
        return unarchiveMutation.mutateAsync(
          newsletterId,
          options as MutateOptions<
            boolean,
            Error,
            string,
            PreviousNewslettersState
          >,
        );
      } else {
        const result = await toggleArchiveMutation.mutateAsync(
          { id: newsletterId, isArchived: false },
          options as MutateOptions<
            NewsletterWithRelations,
            Error,
            { id: string; isArchived: boolean },
            PreviousNewslettersState
          >,
        );
        return !!result; // Ensure we return a boolean
      }
    },
    [unarchiveMutation, toggleArchiveMutation],
  );

  const bulkMarkAsReadMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      startTimer("bulkMarkAsRead");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (error) throw error;
        return true;
      } finally {
        endTimer("bulkMarkAsRead");
      }
    },
    onMutate: async (ids) => {
      // Cancel any outgoing refetches for newsletter queries
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

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Use cache manager for bulk optimistic update
      await cacheManager.batchUpdateNewsletters(
        ids
          .filter((id) => {
            // Only update non-archived newsletters
            const newsletter = previousNewsletters.find((n) => n.id === id);
            return newsletter && !newsletter.is_archived;
          })
          .map((id) => ({
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
      // Revert on error using cache manager
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
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries(ids, "bulk-mark-read");
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
      startTimer("bulkMarkAsUnread");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_read: false,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (error) throw error;
        return true;
      } finally {
        endTimer("bulkMarkAsUnread");
      }
    },
    onMutate: async (ids) => {
      // Cancel any outgoing refetches for newsletter queries
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

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Use cache manager for bulk optimistic update
      await cacheManager.batchUpdateNewsletters(
        ids
          .filter((id) => {
            // Only update non-archived newsletters
            const newsletter = previousNewsletters.find((n) => n.id === id);
            return newsletter && !newsletter.is_archived;
          })
          .map((id) => ({
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
      // Revert on error using cache manager
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
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries(ids, "bulk-mark-unread");
    },
  });

  const bulkArchiveMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      startTimer("bulkArchive");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_archived: true,
          })
          .in("id", ids);

        if (error) throw error;
        return true;
      } finally {
        endTimer("bulkArchive");
      }
    },
    onMutate: async (ids) => {
      // Cancel any outgoing refetches for newsletter queries
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

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Use cache manager for bulk optimistic update
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
      // Revert on error using cache manager
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
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries(ids, "bulk-archive");
    },
  });

  const bulkUnarchiveMutation = useMutation<
    boolean,
    Error,
    string[],
    PreviousNewslettersState
  >({
    mutationFn: async (ids: string[]) => {
      startTimer("bulkUnarchive");
      try {
        const { error } = await supabase
          .from("newsletters")
          .update({
            is_archived: false,
          })
          .in("id", ids);

        if (error) throw error;
        return true;
      } finally {
        endTimer("bulkUnarchive");
      }
    },
    onMutate: async (ids) => {
      // Cancel any outgoing refetches for newsletter queries
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

      // Snapshot the previous value
      const previousNewsletters =
        getQueryData<NewsletterWithRelations[]>(queryKey) || [];

      // Use cache manager for bulk optimistic update
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
      // Revert on error using cache manager
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
      // Use cache manager for smart invalidation
      cacheManager.invalidateRelatedQueries(ids, "bulk-unarchive");
    },
  });

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
    newsletters: filteredNewsletters,
    isLoadingNewsletters: isLoading,
    isErrorNewsletters: !!errorNewsletters,
    errorNewsletters,
    refetchNewsletters,

    // Read status mutations
    markAsRead: markAsRead as UseMutateAsyncFunction<
      boolean,
      Error,
      string,
      PreviousNewslettersState
    >,
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
