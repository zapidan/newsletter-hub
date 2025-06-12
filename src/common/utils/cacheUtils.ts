import { QueryClient } from "@tanstack/react-query";
import { queryKeyFactory } from "./queryKeyFactory";
import type { NewsletterWithRelations, ReadingQueueItem } from "@common/types";

interface CacheManagerConfig {
  enableOptimisticUpdates?: boolean;
  enableCrossFeatureSync?: boolean;
  enablePerformanceLogging?: boolean;
}

export class SimpleCacheManager {
  private queryClient: QueryClient;
  private config: CacheManagerConfig;

  constructor(queryClient: QueryClient, config: CacheManagerConfig = {}) {
    this.queryClient = queryClient;
    this.config = {
      enableOptimisticUpdates: true,
      enableCrossFeatureSync: true,
      enablePerformanceLogging: false,
      ...config,
    };
  }

  // Update newsletter in cache
  updateNewsletterInCache(update: {
    id: string;
    updates: Partial<NewsletterWithRelations>;
  }): void {
    // Update in all newsletter list queries
    this.queryClient.setQueriesData<NewsletterWithRelations[]>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((newsletter) =>
          newsletter.id === update.id
            ? { ...newsletter, ...update.updates }
            : newsletter,
        );
      },
    );

    // Update individual newsletter query if it exists
    const detailQueryKey = queryKeyFactory.newsletters.detail(update.id);
    this.queryClient.setQueryData<NewsletterWithRelations>(
      detailQueryKey,
      (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, ...update.updates };
      },
    );

    // Cross-feature sync: update newsletter in reading queue
    if (this.config.enableCrossFeatureSync) {
      this.queryClient.setQueriesData<ReadingQueueItem[]>(
        { queryKey: queryKeyFactory.queue.lists() },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((queueItem) =>
            queueItem.newsletter.id === update.id
              ? {
                  ...queueItem,
                  newsletter: { ...queueItem.newsletter, ...update.updates },
                }
              : queueItem,
          );
        },
      );
    }
  }

  // Bulk update newsletters
  async batchUpdateNewsletters(
    updates: { id: string; updates: Partial<NewsletterWithRelations> }[],
  ): Promise<void> {
    updates.forEach((update) => {
      this.updateNewsletterInCache(update);
    });
  }

  // Reading queue operations
  updateReadingQueueInCache(operation: {
    type: "add" | "remove" | "reorder" | "updateTags" | "revert";
    newsletterId?: string;
    queueItemId?: string;
    updates?: { id: string; position: number }[];
    tagIds?: string[];
    queueItems?: ReadingQueueItem[];
    userId: string;
  }): void {
    const queueQueryKey = queryKeyFactory.queue.list(operation.userId);

    switch (operation.type) {
      case "add":
        // For add operations, we'll just invalidate to refetch
        // since we need full newsletter data
        this.queryClient.invalidateQueries({ queryKey: queueQueryKey });
        break;

      case "remove":
        if (operation.queueItemId) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(
            queueQueryKey,
            (oldData = []) =>
              oldData.filter((item) => item.id !== operation.queueItemId),
          );
        }
        break;

      case "reorder":
        if (operation.updates) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(
            queueQueryKey,
            (oldData = []) => {
              const reorderedData = [...oldData];
              operation.updates!.forEach(({ id, position }) => {
                const itemIndex = reorderedData.findIndex(
                  (item) => item.id === id,
                );
                if (itemIndex !== -1) {
                  reorderedData[itemIndex] = {
                    ...reorderedData[itemIndex],
                    position,
                  };
                }
              });
              return reorderedData.sort((a, b) => a.position - b.position);
            },
          );
        }
        break;

      case "updateTags":
        if (operation.newsletterId && operation.tagIds) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(
            queueQueryKey,
            (oldData = []) =>
              oldData.map((item) =>
                item.newsletter_id === operation.newsletterId
                  ? {
                      ...item,
                      newsletter: {
                        ...item.newsletter,
                        tags: operation.tagIds!.map((tagId) => ({
                          id: tagId,
                          name: "",
                          color: "#808080",
                          user_id: operation.userId,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        })),
                      },
                    }
                  : item,
              ),
          );
        }
        break;

      case "revert":
        if (operation.queueItems) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(
            queueQueryKey,
            operation.queueItems,
          );
        }
        break;
    }
  }

  // Smart invalidation with operation types
  invalidateRelatedQueries(
    newsletterIds: string[],
    operationType: string,
  ): void {
    const invalidationPromises: Promise<void>[] = [];

    switch (operationType) {
      case "mark-read":
      case "mark-unread":
      case "bulk-mark-read":
      case "bulk-mark-unread":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ["unreadCount"],
            refetchType: "active",
          }),
        );
        break;

      case "archive":
      case "unarchive":
      case "bulk-archive":
      case "bulk-unarchive":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ["unreadCount"],
            refetchType: "active",
          }),
        );
        break;

      case "delete":
      case "bulk-delete":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            refetchType: "active",
          }),
          this.queryClient.invalidateQueries({
            queryKey: ["unreadCount"],
            refetchType: "active",
          }),
        );
        // Remove individual newsletter caches
        newsletterIds.forEach((id) => {
          this.queryClient.removeQueries({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
          });
        });
        break;

      case "toggle-like":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            refetchType: "active",
          }),
        );
        break;

      case "toggle-queue":
      case "queue-add":
      case "queue-remove":
      case "queue-reorder":
      case "queue-clear":
      case "queue-mark-read":
      case "queue-mark-unread":
      case "queue-update-tags":
      case "queue-cleanup":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.queue.lists(),
            refetchType: "active",
          }),
        );
        break;

      case "tag-update":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
            refetchType: "active",
          }),
        );
        break;

      case "newsletter-sources":
      case "source-update-optimistic":
      case "source-update-error":
      case "source-archive-optimistic":
      case "source-unarchive-optimistic":
      case "source-archive-error":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            predicate: (query) => {
              return query.queryKey[0] === "newsletterSources";
            },
            refetchType: "active",
          }),
        );
        break;

      case "unread-count-change":
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ["unreadCount"],
            refetchType: "active",
          }),
        );
        break;

      default:
        // Fallback: invalidate general newsletter queries
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            refetchType: "active",
          }),
        );
        break;
    }

    Promise.all(invalidationPromises).catch((error) => {
      console.error("Error invalidating related queries:", error);
    });
  }

  // Optimistic update with rollback support
  async optimisticUpdate(
    newsletterId: string,
    updates: Partial<NewsletterWithRelations>,
    operation: string,
  ): Promise<NewsletterWithRelations | null> {
    // Get the current newsletter data before update for potential rollback
    const currentData =
      this.queryClient
        .getQueryData<
          NewsletterWithRelations[]
        >(queryKeyFactory.newsletters.lists())
        ?.find((n) => n.id === newsletterId) || null;

    // Update newsletter in all relevant caches
    this.updateNewsletterInCache({ id: newsletterId, updates });

    // Invalidate related queries to ensure consistency
    this.invalidateRelatedQueries([newsletterId], operation);

    return currentData;
  }

  // Warm cache by prefetching common queries
  warmCache(
    userId: string,
    priority: "high" | "medium" | "low" = "medium",
  ): void {
    if (!userId) return;

    const prefetchOptions = {
      staleTime: priority === "high" ? 10 * 60 * 1000 : 5 * 60 * 1000, // 10 min for high, 5 min for others
    };

    // Prefetch newsletters
    this.queryClient.prefetchQuery({
      queryKey: queryKeyFactory.newsletters.list({ userId }),
      queryFn: () => Promise.resolve([]), // Would be actual fetch function
      ...prefetchOptions,
    });

    // Prefetch reading queue if high priority
    if (priority === "high") {
      this.queryClient.prefetchQuery({
        queryKey: queryKeyFactory.queue.list(userId),
        queryFn: () => Promise.resolve([]), // Would be actual fetch function
        ...prefetchOptions,
      });
    }

    // Prefetch unread count
    this.queryClient.prefetchQuery({
      queryKey: ["unreadCount", userId],
      queryFn: () => Promise.resolve(0), // Would be actual fetch function
      ...prefetchOptions,
    });
  }

  // Clear specific cache sections
  clearNewsletterCache(): void {
    this.queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.lists(),
      refetchType: "active",
    });
  }

  clearReadingQueueCache(): void {
    this.queryClient.invalidateQueries({
      queryKey: queryKeyFactory.queue.lists(),
      refetchType: "active",
    });
  }
}

// Singleton instance
let cacheManagerInstance: SimpleCacheManager | null = null;

export const createCacheManager = (
  queryClient: QueryClient,
  config?: CacheManagerConfig,
): SimpleCacheManager => {
  cacheManagerInstance = new SimpleCacheManager(queryClient, config);
  return cacheManagerInstance;
};

export const getCacheManager = (): SimpleCacheManager => {
  if (!cacheManagerInstance) {
    throw new Error(
      "Cache manager not initialized. Call createCacheManager first.",
    );
  }
  return cacheManagerInstance;
};

export const getCacheManagerSafe = (): SimpleCacheManager | null => {
  return cacheManagerInstance;
};

// Utility functions for backward compatibility
export const updateCachedNewsletter = (
  newsletterId: string,
  updates: Partial<NewsletterWithRelations>,
) => {
  const manager = getCacheManager();
  manager.updateNewsletterInCache({ id: newsletterId, updates });
};

export const updateMultipleCachedNewsletters = async (
  updates: { id: string; updates: Partial<NewsletterWithRelations> }[],
) => {
  const manager = getCacheManager();
  await manager.batchUpdateNewsletters(updates);
};

export const invalidateNewsletterQueries = (
  newsletterIds: string[],
  operationType: string,
) => {
  const manager = getCacheManager();
  manager.invalidateRelatedQueries(newsletterIds, operationType);
};
