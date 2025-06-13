import { useMutation, useQuery } from "@tanstack/react-query";
import { updateNewsletterTags } from "@common/utils/tagUtils";
import { AuthContext } from "@common/contexts/AuthContext";
import { useContext, useCallback, useMemo, useRef } from "react";
import type { NewsletterWithRelations, ReadingQueueItem } from "@common/types";
import { queryKeyFactory } from "../utils/queryKeyFactory";
import { getCacheManagerSafe } from "../utils/cacheUtils";
import { readingQueueApi } from "@common/api/readingQueueApi";
import { newsletterApi } from "@common/api/newsletterApi";

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
  newsletter_sources?: {
    id: string;
    name: string;
    domain: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  } | null;
}

interface QueueItemFromDB {
  id: string;
  position: number;
  user_id: string;
  newsletter_id: string;
  created_at: string;
  updated_at: string;
  newsletters: NewsletterFromDB;
}

const transformQueueItem = (item: QueueItemFromDB): ReadingQueueItem => {
  const newsletter = item.newsletters;

  if (!newsletter) {
    throw new Error("Newsletter data is missing from queue item");
  }

  // Transform the newsletter data
  const transformedNewsletter: NewsletterWithRelations = {
    id: newsletter.id,
    title: newsletter.title,
    summary: newsletter.summary,
    content: newsletter.content,
    url: "", // Not available in this context
    author: "", // Not available in this context
    published_at: newsletter.received_at,
    created_at: newsletter.created_at,
    updated_at: newsletter.updated_at,
    is_read: newsletter.is_read,
    is_liked: newsletter.is_liked,
    is_archived: newsletter.is_archived,
    is_bookmarked: true, // Since it's in the reading queue
    user_id: newsletter.user_id,
    newsletter_source_id: newsletter.newsletter_source_id,
    newsletter_source: newsletter.newsletter_sources
      ? {
          id: newsletter.newsletter_sources.id,
          name: newsletter.newsletter_sources.name,
          url: newsletter.newsletter_sources.domain,
          description: "",
          is_active: true,
          is_archived: false,
          last_fetched_at: null,
          created_at: newsletter.newsletter_sources.created_at,
          updated_at: newsletter.newsletter_sources.updated_at,
          user_id: newsletter.newsletter_sources.user_id,
        }
      : null,
    tags: newsletter.tags || [],
  };

  return {
    id: item.id,
    position: item.position,
    user_id: item.user_id,
    newsletter_id: item.newsletter_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    newsletter: transformedNewsletter,
  };
};

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Safe cache manager helper
  const safeCacheCall = useCallback(
    (fn: (manager: any) => void) => {
      if (cacheManager) {
        fn(cacheManager);
      }
    },
    [cacheManager],
  );

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
  const fetchReadingQueue = useCallback(async (): Promise<
    ReadingQueueItem[]
  > => {
    try {
      return await readingQueueApi.getAll();
    } catch (error) {
      console.error("Error fetching reading queue:", error);
      return [];
    }
  }, []);

  // Query for reading queue
  const {
    data: readingQueue = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ReadingQueueItem[], Error>({
    queryKey: queryKeyFactory.queue.list(user?.id || ""),
    queryFn: () => fetchReadingQueue(),
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      startTimer("addToQueue");
      try {
        return await readingQueueApi.add(newsletterId);
      } finally {
        endTimer("addToQueue");
      }
    },
    onMutate: async (newsletterId) => {
      if (!user?.id) return;

      // Snapshot the previous queue
      const previousQueue = readingQueue;

      // Use cache manager for optimistic update
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: "add",
          newsletterId,
          userId: user.id,
        }),
      );

      return { previousQueue };
    },
    onError: (error, _newsletterId, context) => {
      console.error("Error adding to queue:", error);

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: "revert",
            queueItems: context.previousQueue,
            userId: user.id,
          }),
        );
      }
    },
    onSuccess: (_data, newsletterId) => {
      if (!user) return;

      // Update newsletter cache to reflect bookmark status
      safeCacheCall((manager) =>
        manager.updateNewsletterInCache(
          {
            id: newsletterId,
            updates: { is_bookmarked: true },
          },
          { optimistic: false, invalidateRelated: true },
        ),
      );
    },
    onSettled: () => {
      if (!user) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-add"),
      );
    },
  });

  // Remove from reading queue
  const removeFromQueue = useMutation({
    mutationFn: async (queueItemId: string) => {
      startTimer("removeFromQueue");
      try {
        return await readingQueueApi.remove(queueItemId);
      } finally {
        endTimer("removeFromQueue");
      }
    },
    onMutate: async (queueItemId) => {
      if (!user) return;

      // Find the item being removed
      const itemToRemove = readingQueue.find((item) => item.id === queueItemId);
      const previousQueue = readingQueue;

      // Use cache manager for optimistic removal
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: "remove",
          queueItemId,
          userId: user.id,
        }),
      );

      return { previousQueue, removedItem: itemToRemove };
    },
    onError: (error, _queueItemId, context) => {
      console.error("Error removing from queue:", error);

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: "revert",
            queueItems: context.previousQueue,
            userId: user.id,
          }),
        );
      }
    },
    onSuccess: (_data, _queueItemId, context) => {
      if (!user || !context?.removedItem) return;

      // Update newsletter cache to reflect bookmark status
      safeCacheCall((manager) =>
        manager.updateNewsletterInCache(
          {
            id: context.removedItem.newsletter.id,
            updates: { is_bookmarked: false },
          },
          { optimistic: false, invalidateRelated: true },
        ),
      );
    },
    onSettled: () => {
      if (!user) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-remove"),
      );
    },
  });

  // Reorder reading queue
  const reorderQueue = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      if (!user) throw new Error("User not authenticated");

      startTimer("reorderQueue");
      try {
        return await readingQueueApi.reorder(updates);
      } finally {
        endTimer("reorderQueue");
      }
    },
    onMutate: async (updates) => {
      if (!user?.id) return;

      // Snapshot the previous queue
      const previousQueue = readingQueue;

      // Use cache manager for optimistic reordering
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: "reorder",
          updates,
          userId: user.id,
        }),
      );

      return { previousQueue };
    },
    onError: (error, _updates, context) => {
      console.error("Error reordering queue:", error);

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: "revert",
            queueItems: context.previousQueue,
            userId: user.id,
          }),
        );
      }
    },
    onSettled: () => {
      if (!user?.id) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-reorder"),
      );
    },
  });

  // Clear entire reading queue
  const clearQueue = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      return readingQueueApi.clear();
    },
    onSuccess: () => {
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-clear"),
      );
    },
  });

  // Mark newsletter as read
  const markAsRead = useMutation({
    mutationFn: async (newsletterId: string) => {
      return newsletterApi.markAsRead(newsletterId);
    },
    onSuccess: () => {
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-mark-read"),
      );
    },
  });

  // Mark newsletter as unread
  const markAsUnread = useMutation({
    mutationFn: async (newsletterId: string) => {
      return newsletterApi.markAsUnread(newsletterId);
    },
    onSuccess: () => {
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-mark-unread"),
      );
    },
  });

  // Update tags
  const updateTags = useMutation({
    mutationFn: async ({
      newsletterId,
      tagIds,
    }: {
      newsletterId: string;
      tagIds: string[];
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const currentTagIds =
        readingQueue
          .find((item) => item.newsletter.id === newsletterId)
          ?.newsletter.tags?.map((tag) => tag.id) || [];

      return updateNewsletterTags(newsletterId, tagIds, currentTagIds, user.id);
    },
    onMutate: async ({ newsletterId, tagIds }) => {
      // Snapshot the previous value
      const previousQueue = readingQueue;

      // Use cache manager for optimistic tag update
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: "updateTags",
          newsletterId,
          tagIds,
          userId: user?.id || "",
        }),
      );

      return { previousQueue };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        // Revert using cache manager
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: "revert",
            queueItems: context.previousQueue,
            userId: user?.id || "",
          }),
        );
      }
    },
    onSettled: () => {
      // Use cache manager for smart invalidation
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "queue-update-tags"),
      );
    },
  });

  return {
    // Data
    readingQueue,
    isLoading,
    isError,
    error,
    isEmpty: readingQueue.length === 0,

    // Actions
    addToQueue: addToQueue.mutateAsync,
    removeFromQueue: removeFromQueue.mutateAsync,
    reorderQueue: reorderQueue.mutateAsync,
    clearQueue: clearQueue.mutateAsync,
    markAsRead: markAsRead.mutateAsync,
    markAsUnread: markAsUnread.mutateAsync,
    updateTags: updateTags.mutateAsync,

    // Loading states
    isAdding: addToQueue.isPending,
    isRemoving: removeFromQueue.isPending,
    isReordering: reorderQueue.isPending,
    isClearing: clearQueue.isPending,
    isMarkingAsRead: markAsRead.isPending,
    isMarkingAsUnread: markAsUnread.isPending,
    isUpdatingTags: updateTags.isPending,

    // Utils
    refetch,
  };
};
