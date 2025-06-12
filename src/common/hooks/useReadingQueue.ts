import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@common/services/supabaseClient";
import { updateNewsletterTags } from "@common/utils/tagUtils";
import { AuthContext } from "@common/contexts/AuthContext";
import { useContext, useCallback, useMemo, useRef } from "react";
import type {
  NewsletterWithRelations,
  Tag,
  ReadingQueueItem,
} from "@common/types";
import { queryKeyFactory } from "../utils/queryKeyFactory";
import { createCacheManager, getCacheManager } from "../utils/cacheUtils";

interface NewsletterFromDB {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  image_url: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_read: boolean;
  is_liked: boolean;
  is_archived: boolean;
  newsletter_source_id: string | null;
  word_count: number;
  estimated_read_time: number;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  }>;
  newsletter_sources?: Array<{
    id: string;
    name: string;
    domain: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  }> | null;
}

interface QueueItemFromDB {
  id: string;
  position: number;
  user_id: string;
  newsletter_id: string;
  created_at: string;
  updated_at: string;
  newsletters: NewsletterFromDB[];
}

// Helper function to transform queue item from DB to our format
const transformQueueItem = (item: QueueItemFromDB): ReadingQueueItem | null => {
  try {
    // Handle both array and direct object cases for newsletters
    const newsletter = (() => {
      if (!item.newsletters) return null;
      return Array.isArray(item.newsletters)
        ? item.newsletters[0]
        : item.newsletters;
    })();

    if (!newsletter) {
      console.warn("No newsletter found for queue item:", item.id);

      // If we're in development, log the full item for debugging
      if (process.env.NODE_ENV === "development") {
        console.warn("Queue item with missing newsletter:", item);
      }

      return null;
    }

    // Handle both array and direct object cases for newsletter_sources
    const source = (() => {
      if (!newsletter.newsletter_sources) return undefined;
      if (Array.isArray(newsletter.newsletter_sources)) {
        return newsletter.newsletter_sources[0];
      }
      return newsletter.newsletter_sources;
    })();

    // Create the newsletter object with all required fields
    const newsletterData = {
      id: newsletter.id,
      title: newsletter.title || "",
      content: newsletter.content || "",
      summary: newsletter.summary || "",
      image_url: newsletter.image_url || "",
      received_at: newsletter.received_at,
      updated_at: newsletter.updated_at,
      user_id: newsletter.user_id,
      is_read: newsletter.is_read || false,
      is_liked: newsletter.is_liked || false,
      is_archived: newsletter.is_archived || false,
      is_bookmarked: true, // Always true for items in the reading queue
      newsletter_source_id: newsletter.newsletter_source_id ?? null,
      word_count: newsletter.word_count || 0,
      estimated_read_time: newsletter.estimated_read_time || 0,
      source: source
        ? {
            id: source.id,
            name: source.name,
            domain: source.domain,
            user_id: source.user_id,
            created_at: source.created_at,
            updated_at: source.updated_at,
          }
        : undefined,
      // Include tags if they exist in the newsletter data
      tags: newsletter.tags || [],
    };

    return {
      id: item.id,
      position: item.position,
      user_id: item.user_id,
      newsletter_id: item.newsletter_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      newsletter: newsletterData,
    } as ReadingQueueItem;
  } catch (error) {
    console.error("Error transforming queue item:", error, item);
    return null;
  }
};

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Initialize cache manager
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      return createCacheManager(queryClient, {
        enableOptimisticUpdates: true,
        enableCrossFeatureSync: true,
        enablePerformanceLogging: process.env.NODE_ENV === "development",
      });
    }
  }, [queryClient]);

  // Performance monitoring
  const performanceTimers = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((operation: string) => {
    performanceTimers.current.set(operation, performance.now());
  }, []);

  const endTimer = useCallback((operation: string) => {
    const start = performanceTimers.current.get(operation);
    if (start && process.env.NODE_ENV === "development") {
      const duration = performance.now() - start;
      console.log(
        `[useReadingQueue] ${operation} took ${duration.toFixed(2)}ms`,
      );
      performanceTimers.current.delete(operation);
    }
  }, []);

  // Helper function to fetch reading queue
  const fetchReadingQueue = useCallback(
    async (userId: string): Promise<ReadingQueueItem[]> => {
      try {
        // First, get queue items with joined newsletter and source data
        // First, fetch the queue items with newsletter data
        const { data: queueItems, error: queueError } = await supabase
          .from("reading_queue")
          .select(
            `
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `,
          )
          .eq("user_id", userId)
          .order("position", { ascending: true });

        if (!queueItems?.length) return [];

        // Fetch tags for all newsletters in the queue
        const newsletterIds = queueItems.map((item) => item.newsletter_id);
        const { data: newsletterTags } = await supabase
          .from("newsletter_tags")
          .select("newsletter_id, tags(*)")
          .in("newsletter_id", newsletterIds);

        // Create a map of newsletter_id to tags
        const tagsByNewsletterId = newsletterTags?.reduce(
          (acc, { newsletter_id, tags }) => {
            if (!acc[newsletter_id]) {
              acc[newsletter_id] = [];
            }
            if (Array.isArray(tags)) {
              acc[newsletter_id].push(...tags);
            }
            return acc;
          },
          {} as Record<string, Tag[]>,
        );

        // Add tags to newsletters, handling both array and single object cases
        const queueItemsWithTags = queueItems.map((item) => {
          const newsletters = Array.isArray(item.newsletters)
            ? item.newsletters.map((newsletter: NewsletterFromDB) => ({
                ...newsletter,
                tags: tagsByNewsletterId?.[newsletter.id] || [],
              }))
            : item.newsletters
              ? {
                  ...item.newsletters,
                  tags: tagsByNewsletterId?.[item.newsletters.id] || [],
                }
              : null;

          return {
            ...item,
            newsletters: newsletters
              ? [newsletters].flat()
              : ([] as NewsletterFromDB[]),
          };
        });

        if (queueError) {
          console.error("Error fetching reading queue:", queueError);
          throw queueError;
        }

        if (!queueItemsWithTags.length) return [];

        // Transform the queue items with tags and filter out nulls
        const validItems = queueItemsWithTags
          .map(transformQueueItem)
          .filter((item): item is ReadingQueueItem => item !== null);

        // Clean up any orphaned queue items (where the newsletter doesn't exist)
        if (validItems.length < queueItemsWithTags.length) {
          // Find items that failed to transform (orphaned)
          const orphanedIds = queueItemsWithTags
            .filter(
              (item) =>
                !validItems.some(
                  (valid) => valid.newsletter_id === item.newsletter_id,
                ),
            )
            .map((item) => item.id);

          // Delete orphaned items in the background
          if (orphanedIds.length > 0) {
            console.log(
              `Cleaning up ${orphanedIds.length} orphaned queue items`,
            );
            const { error } = await supabase
              .from("reading_queue")
              .delete()
              .in("id", orphanedIds);

            if (error) {
              console.error("Error cleaning up orphaned queue items:", error);
            } else {
              console.log(
                `Successfully cleaned up ${orphanedIds.length} orphaned queue items`,
              );
              // Invalidate the query to refresh the list
              queryClient.invalidateQueries({
                queryKey: ["readingQueue", userId],
              });
            }
          }
        }

        return validItems;
      } catch (error) {
        console.error("Error fetching reading queue:", error);
        throw error;
      }
    },
    [queryClient],
  );

  // Main query for reading queue
  const {
    data: readingQueue = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ReadingQueueItem[]>({
    queryKey: queryKeyFactory.queue.list(user?.id || ""),
    queryFn: () =>
      user?.id ? fetchReadingQueue(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("4") ||
        errorMessage.includes("Session expired")
      ) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) =>
      Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      startTimer("addToQueue");
      try {
        // First check if the newsletter is already in the queue
        const { data: existingItem } = await supabase
          .from("reading_queue")
          .select("id, position")
          .eq("user_id", user.id)
          .eq("newsletter_id", newsletterId)
          .maybeSingle();

        if (existingItem) {
          console.log(
            "Newsletter already in queue at position:",
            existingItem.position,
          );
          return existingItem; // Already in queue
        }

        // Get the current max position with proper error handling
        let nextPosition = 0;
        try {
          const { data: maxPosition, error: positionError } = await supabase
            .from("reading_queue")
            .select("position")
            .eq("user_id", user.id)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (positionError && positionError.code !== "PGRST116") {
            // PGRST116 is 'no rows found'
            console.error("Error getting max position:", positionError);
            throw positionError;
          }

          nextPosition = (maxPosition?.position ?? -1) + 1;
        } catch (error) {
          console.error("Error in position calculation:", error);
          // Default to 0 if there's an error getting the max position
          nextPosition = 0;
        }

        // Insert the new item
        const { data: insertedData, error: insertError } = await supabase
          .from("reading_queue")
          .insert({
            user_id: user.id,
            newsletter_id: newsletterId,
            position: nextPosition,
          })
          .select("*")
          .single();

        if (insertError) {
          // If it's a unique violation, the item might have been added by another request
          if (insertError.code === "23505") {
            // Fetch the existing item
            const { data: existing, error: fetchError } = await supabase
              .from("reading_queue")
              .select("*")
              .eq("user_id", user.id)
              .eq("newsletter_id", newsletterId)
              .single();

            if (fetchError) {
              console.error(
                "Error fetching existing queue item after conflict:",
                fetchError,
              );
              throw fetchError;
            }

            console.log("Resolved queue item conflict, using existing item");
            return existing;
          }

          console.error("Error inserting into reading queue:", insertError);
          throw insertError;
        }

        console.log("Successfully added to reading queue:", insertedData);
        return insertedData;
      } catch (error) {
        console.error("Error in addToQueue:", error);
        throw error;
      } finally {
        endTimer("addToQueue");
      }
    },
    onMutate: async (newsletterId: string) => {
      if (!user?.id) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
      });

      // Get newsletter data for optimistic update
      const newsletters = queryClient.getQueriesData({
        queryKey: queryKeyFactory.newsletters.lists(),
      });

      let newsletter = null;
      for (const [, data] of newsletters) {
        if (Array.isArray(data)) {
          newsletter = data.find(
            (n: NewsletterWithRelations) => n.id === newsletterId,
          );
          if (newsletter) break;
        }
      }

      if (newsletter) {
        // Create optimistic queue item
        const optimisticItem: ReadingQueueItem = {
          id: `temp-${Date.now()}`,
          position: readingQueue.length,
          user_id: user.id,
          newsletter_id: newsletterId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          newsletter: { ...newsletter, is_bookmarked: true },
        };

        // Use cache manager for optimistic update
        cacheManager.updateReadingQueueInCache(
          {
            action: "add",
            items: [optimisticItem],
          },
          user.id,
        );
      }

      return { previousQueue: readingQueue };
    },
    onError: (error, _newsletterId, context) => {
      console.error("Error adding to queue:", error);

      // Revert optimistic update
      if (context?.previousQueue && user?.id) {
        queryClient.setQueryData(
          queryKeyFactory.queue.list(user.id),
          context.previousQueue,
        );
      }
    },
    onSuccess: (_data, newsletterId) => {
      if (!user?.id) return;

      // Update newsletter cache to reflect bookmark status
      cacheManager.updateNewsletterInCache(
        {
          id: newsletterId,
          updates: { is_bookmarked: true },
        },
        { optimistic: false, invalidateRelated: true },
      );
    },
    onSettled: () => {
      if (!user?.id) return;

      // Smart invalidation using cache manager
      queryClient.invalidateQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
        refetchType: "active",
      });
    },
  });

  // Remove from reading queue
  const removeFromQueue = useMutation({
    mutationFn: async (queueItemId: string) => {
      startTimer("removeFromQueue");
      try {
        const { error } = await supabase
          .from("reading_queue")
          .delete()
          .eq("id", queueItemId);

        if (error) {
          console.error("Error removing from queue:", error);
          throw error;
        }

        console.log("Successfully removed from queue:", queueItemId);
      } catch (error) {
        console.error("Error in removeFromQueue:", error);
        throw error;
      } finally {
        endTimer("removeFromQueue");
      }
    },
    onMutate: async (queueItemId: string) => {
      if (!user?.id) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
      });

      // Find the item being removed
      const itemToRemove = readingQueue.find((item) => item.id === queueItemId);

      if (itemToRemove) {
        // Use cache manager for optimistic update
        cacheManager.updateReadingQueueInCache(
          {
            action: "remove",
            items: [queueItemId],
          },
          user.id,
        );
      }

      return { previousQueue: readingQueue, removedItem: itemToRemove };
    },
    onError: (error, _queueItemId, context) => {
      console.error("Error removing from queue:", error);

      // Revert optimistic update
      if (context?.previousQueue && user?.id) {
        queryClient.setQueryData(
          queryKeyFactory.queue.list(user.id),
          context.previousQueue,
        );
      }
    },
    onSuccess: (_data, _queueItemId, context) => {
      if (!user?.id || !context?.removedItem) return;

      // Update newsletter cache to reflect bookmark status
      cacheManager.updateNewsletterInCache(
        {
          id: context.removedItem.newsletter.id,
          updates: { is_bookmarked: false },
        },
        { optimistic: false, invalidateRelated: true },
      );
    },
    onSettled: () => {
      if (!user?.id) return;

      // Smart invalidation using cache manager
      queryClient.invalidateQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
        refetchType: "active",
      });
    },
  });

  // Reorder reading queue
  const reorderQueue = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      startTimer("reorderQueue");
      try {
        // First, verify all items belong to the current user
        const { data: existingItems, error: fetchError } = await supabase
          .from("reading_queue")
          .select("id")
          .in(
            "id",
            updates.map((u) => u.id),
          )
          .eq("user_id", user.id);

        if (fetchError) throw fetchError;

        if (existingItems.length !== updates.length) {
          throw new Error(
            "Some items do not exist or you do not have permission to update them",
          );
        }

        // Then update the positions
        const { data, error } = await supabase
          .from("reading_queue")
          .upsert(
            updates.map(({ id, position }) => ({
              id,
              position,
              user_id: user.id, // Include user_id to satisfy RLS
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "id" },
          )
          .select();

        if (error) {
          console.error("Error reordering queue:", error);
          throw error;
        }

        console.log("Successfully reordered queue");
        return data;
      } catch (error) {
        console.error("Error reordering queue:", error);
        throw error;
      } finally {
        endTimer("reorderQueue");
      }
    },
    onMutate: async (updates: { id: string; position: number }[]) => {
      if (!user?.id) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
      });

      // Create optimistically reordered queue
      const reorderedQueue = [...readingQueue];

      // Apply position updates
      updates.forEach((update) => {
        const itemIndex = reorderedQueue.findIndex(
          (item) => item.id === update.id,
        );
        if (itemIndex !== -1) {
          reorderedQueue[itemIndex] = {
            ...reorderedQueue[itemIndex],
            position: update.position,
          };
        }
      });

      // Sort by new positions
      reorderedQueue.sort((a, b) => a.position - b.position);

      // Use cache manager for optimistic update
      cacheManager.updateReadingQueueInCache(
        {
          action: "reorder",
          items: reorderedQueue,
        },
        user.id,
      );

      return { previousQueue: readingQueue };
    },
    onError: (error, _updates, context) => {
      console.error("Error reordering queue:", error);

      // Revert optimistic update
      if (context?.previousQueue && user?.id) {
        queryClient.setQueryData(
          queryKeyFactory.queue.list(user.id),
          context.previousQueue,
        );
      }
    },
    onSettled: () => {
      if (!user?.id) return;

      // Invalidate and refetch the reading queue
      queryClient.invalidateQueries({
        queryKey: queryKeyFactory.queue.list(user.id),
        refetchType: "active",
      });
    },
  });

  // Toggle read status
  const toggleRead = useMutation({
    mutationFn: async ({
      newsletterId,
      isRead,
    }: {
      newsletterId: string;
      isRead: boolean;
    }) => {
      const { error } = await supabase
        .from("newsletters")
        .update({ is_read: isRead, updated_at: new Date().toISOString() })
        .eq("id", newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingQueue", user?.id] });
    },
  });

  // Toggle like status
  const toggleLike = useMutation({
    mutationFn: async ({
      newsletterId,
      isLiked,
    }: {
      newsletterId: string;
      isLiked: boolean;
    }) => {
      const { error } = await supabase
        .from("newsletters")
        .update({ is_liked: isLiked, updated_at: new Date().toISOString() })
        .eq("id", newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingQueue", user?.id] });
    },
  });

  // Toggle archive status
  const toggleArchive = useMutation({
    mutationFn: async ({
      newsletterId,
      isArchived,
    }: {
      newsletterId: string;
      isArchived: boolean;
    }) => {
      const { error } = await supabase
        .from("newsletters")
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingQueue", user?.id] });
    },
  });

  // Update tags for a newsletter
  const updateTags = useMutation({
    mutationFn: async ({
      newsletterId,
      tagIds,
    }: {
      newsletterId: string;
      tagIds: string[];
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Get current tag IDs for the newsletter
      const currentTags =
        readingQueue.find((item) => item.newsletter.id === newsletterId)
          ?.newsletter.tags || [];
      const currentTagIds = currentTags.map((tag) => tag.id);

      // Use the utility function to update tags
      return updateNewsletterTags(newsletterId, tagIds, currentTagIds, user.id);
    },
    onMutate: async ({ newsletterId, tagIds }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["readingQueue", user?.id] });

      // Snapshot the previous value
      const previousQueue =
        queryClient.getQueryData<ReadingQueueItem[]>([
          "readingQueue",
          user?.id,
        ]) || [];

      // Optimistically update the cache
      queryClient.setQueryData<ReadingQueueItem[]>(
        ["readingQueue", user?.id],
        (old = []) =>
          old.map((item) => {
            if (item.newsletter.id === newsletterId) {
              // Get the full tag objects for the selected tag IDs
              const updatedTags = tagIds.map((tagId) => {
                const existingTag = item.newsletter.tags?.find(
                  (t) => t.id === tagId,
                );
                return (
                  existingTag || {
                    id: tagId,
                    name: "",
                    color: "#808080",
                    user_id: user?.id || "",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }
                );
              });

              return {
                ...item,
                newsletter: {
                  ...item.newsletter,
                  tags: updatedTags,
                },
              };
            }
            return item;
          }),
      );

      return { previousQueue };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(
          ["readingQueue", user?.id],
          context.previousQueue,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["readingQueue", user?.id] });
    },
  });

  return {
    readingQueue,
    isLoading,
    error,
    refetch,
    addToQueue: addToQueue.mutateAsync,
    removeFromQueue: removeFromQueue.mutateAsync,
    reorderQueue: reorderQueue.mutateAsync,
    toggleRead: toggleRead.mutateAsync,
    toggleLike: toggleLike.mutateAsync,
    toggleArchive: toggleArchive.mutateAsync,
    isAdding: addToQueue.isPending,
    isRemoving: removeFromQueue.isPending,
    isReordering: reorderQueue.isPending,
    isTogglingRead: toggleRead.isPending,
    isTogglingLike: toggleLike.isPending,
    isTogglingArchive: toggleArchive.isPending,
    updateTags: updateTags.mutateAsync,
    isUpdatingTags: updateTags.isPending,
  };
};

export default useReadingQueue;
