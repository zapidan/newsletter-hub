import { QueryClient, QueryKey } from "@tanstack/react-query";
import type { NewsletterWithRelations, Tag, Newsletter } from "../types";
import type {
  NewsletterFilter,
  NewsletterCacheUpdate,
  NewsletterBulkUpdate,
} from "../types/cache";
import { queryKeyFactory } from "./queryKeyFactory";
import type { ReadingQueueItem } from "../types";

export interface CacheUpdateOptions {
  optimistic?: boolean;
  invalidateRelated?: boolean;
  refetchActive?: boolean;
}

export interface CacheManagerConfig {
  defaultStaleTime: number;
  defaultCacheTime: number;
  enableOptimisticUpdates: boolean;
  enableCrossFeatureSync: boolean;
  enablePerformanceLogging: boolean;
}

/**
 * Enhanced cache management utility with optimistic updates and cross-feature synchronization
 */
export class NewsletterCacheManager {
  private queryClient: QueryClient;
  private config: CacheManagerConfig;
  private performanceMetrics: Map<string, { start: number; end?: number }> =
    new Map();

  constructor(
    queryClient: QueryClient,
    config: Partial<CacheManagerConfig> = {},
  ) {
    this.queryClient = queryClient;
    this.config = {
      defaultStaleTime: 2 * 60 * 1000, // 2 minutes
      defaultCacheTime: 10 * 60 * 1000, // 10 minutes
      enableOptimisticUpdates: true,
      enableCrossFeatureSync: true,
      enablePerformanceLogging: false,
      ...config,
    };
  }

  // Performance monitoring
  private startPerformanceTimer(operation: string): void {
    if (!this.config.enablePerformanceLogging) return;
    this.performanceMetrics.set(operation, { start: performance.now() });
  }

  private endPerformanceTimer(operation: string): number | null {
    if (!this.config.enablePerformanceLogging) return null;
    const metric = this.performanceMetrics.get(operation);
    if (!metric) return null;

    const duration = performance.now() - metric.start;
    metric.end = performance.now();

    console.log(`[CacheManager] ${operation} took ${duration.toFixed(2)}ms`);
    return duration;
  }

  // Newsletter cache operations
  updateNewsletterInCache(
    update: NewsletterCacheUpdate,
    options: CacheUpdateOptions = {},
  ): void {
    this.startPerformanceTimer(`updateNewsletter-${update.id}`);

    // Update all newsletter list queries
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

    // Update newsletter detail query if it exists
    const detailQueryKey = queryKeyFactory.newsletters.detail(update.id);
    this.queryClient.setQueryData<NewsletterWithRelations>(
      detailQueryKey,
      (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, ...update.updates };
      },
    );

    // Cross-feature synchronization
    if (this.config.enableCrossFeatureSync) {
      this.syncWithReadingQueue(update);
      this.syncWithTagQueries(update);
      this.syncWithSourceQueries(update);
    }

    // Invalidate related queries if requested
    if (options.invalidateRelated) {
      this.invalidateRelatedQueries(update.id, update.updates);
    }

    this.endPerformanceTimer(`updateNewsletter-${update.id}`);
  }

  bulkUpdateNewslettersInCache(
    updates: NewsletterBulkUpdate,
    options: CacheUpdateOptions = {},
  ): void {
    this.startPerformanceTimer(`bulkUpdateNewsletters-${updates.ids.length}`);

    const updatesMap = new Map(updates.ids.map((id) => [id, updates.updates]));

    // Update all newsletter list queries
    this.queryClient.setQueriesData<NewsletterWithRelations[]>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((newsletter) =>
          updatesMap.has(newsletter.id)
            ? { ...newsletter, ...updates.updates }
            : newsletter,
        );
      },
    );

    // Update individual detail queries
    updates.ids.forEach((id) => {
      const detailQueryKey = queryKeyFactory.newsletters.detail(id);
      this.queryClient.setQueryData<NewsletterWithRelations>(
        detailQueryKey,
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, ...updates.updates };
        },
      );
    });

    // Cross-feature synchronization for bulk updates
    if (this.config.enableCrossFeatureSync) {
      updates.ids.forEach((id) => {
        this.syncWithReadingQueue({ id, updates: updates.updates });
      });
    }

    // Invalidate related queries if requested
    if (options.invalidateRelated) {
      updates.ids.forEach((id) => {
        this.invalidateRelatedQueries(id, updates.updates);
      });
    }

    this.endPerformanceTimer(`bulkUpdateNewsletters-${updates.ids.length}`);
  }

  // Reading queue cache operations
  updateReadingQueueInCache(
    queueUpdate: {
      action: "add" | "remove" | "reorder";
      items: ReadingQueueItem[] | string[];
    },
    userId: string,
  ): void {
    this.startPerformanceTimer(`updateReadingQueue-${queueUpdate.action}`);

    const queueQueryKey = queryKeyFactory.queue.list(userId);

    if (queueUpdate.action === "add" && Array.isArray(queueUpdate.items)) {
      // Add items to queue
      this.queryClient.setQueryData<ReadingQueueItem[]>(
        queueQueryKey,
        (oldData = []) => {
          const newItems = queueUpdate.items as ReadingQueueItem[];
          return [...oldData, ...newItems];
        },
      );
    } else if (
      queueUpdate.action === "remove" &&
      Array.isArray(queueUpdate.items)
    ) {
      // Remove items from queue
      const itemIds = queueUpdate.items as string[];
      this.queryClient.setQueryData<ReadingQueueItem[]>(
        queueQueryKey,
        (oldData = []) => oldData.filter((item) => !itemIds.includes(item.id)),
      );
    } else if (
      queueUpdate.action === "reorder" &&
      Array.isArray(queueUpdate.items)
    ) {
      // Reorder queue items
      this.queryClient.setQueryData<ReadingQueueItem[]>(
        queueQueryKey,
        () => queueUpdate.items as ReadingQueueItem[],
      );
    }

    // Sync newsletter cache to reflect queue status changes
    if (this.config.enableCrossFeatureSync) {
      this.syncNewsletterQueueStatus(queueUpdate, userId);
    }

    this.endPerformanceTimer(`updateReadingQueue-${queueUpdate.action}`);
  }

  // Cross-feature synchronization methods
  private syncWithReadingQueue(newsletterUpdate: NewsletterCacheUpdate): void {
    // Update newsletter data within reading queue items
    this.queryClient.setQueriesData<ReadingQueueItem[]>(
      { queryKey: queryKeyFactory.queue.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((queueItem) =>
          queueItem.newsletter.id === newsletterUpdate.id
            ? {
                ...queueItem,
                newsletter: {
                  ...queueItem.newsletter,
                  ...newsletterUpdate.updates,
                },
              }
            : queueItem,
        );
      },
    );
  }

  private syncWithTagQueries(newsletterUpdate: NewsletterCacheUpdate): void {
    // If tags were updated, invalidate tag-related queries
    if (newsletterUpdate.updates.tags !== undefined) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeyFactory.newsletters.tags(),
        refetchType: "active",
      });
    }
  }

  private syncWithSourceQueries(newsletterUpdate: NewsletterCacheUpdate): void {
    // If source was updated, invalidate source-related queries
    if (newsletterUpdate.updates.newsletter_source_id !== undefined) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeyFactory.newsletters.sources(),
        refetchType: "active",
      });
    }
  }

  // Tag-specific cache operations
  updateTagInCache(
    tagUpdate: { id: string; updates: Partial<Tag> },
    options: CacheUpdateOptions = {},
  ): void {
    this.startPerformanceTimer(`updateTag-${tagUpdate.id}`);

    // Update tag in all tag list queries
    this.queryClient.setQueriesData<Tag[]>(
      { queryKey: queryKeyFactory.newsletters.tags() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((tag) =>
          tag.id === tagUpdate.id ? { ...tag, ...tagUpdate.updates } : tag,
        );
      },
    );

    // Update individual tag query if it exists
    const tagQueryKey = queryKeyFactory.newsletters.tag(tagUpdate.id);
    this.queryClient.setQueryData<Tag>(tagQueryKey, (oldData) => {
      if (!oldData) return oldData;
      return { ...oldData, ...tagUpdate.updates };
    });

    // Update newsletters that have this tag
    this.queryClient.setQueriesData<NewsletterWithRelations[]>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((newsletter) => {
          if (newsletter.tags?.some((tag) => tag.id === tagUpdate.id)) {
            return {
              ...newsletter,
              tags: newsletter.tags.map((tag) =>
                tag.id === tagUpdate.id
                  ? { ...tag, ...tagUpdate.updates }
                  : tag,
              ),
            };
          }
          return newsletter;
        });
      },
    );

    if (options.invalidateRelated) {
      this.invalidateTagQueries([tagUpdate.id]);
    }

    this.endPerformanceTimer(`updateTag-${tagUpdate.id}`);
  }

  invalidateTagQueries(tagIds?: string[]): void {
    this.startPerformanceTimer("invalidateTagQueries");

    const invalidationPromises: Promise<void>[] = [];

    if (tagIds && tagIds.length > 0) {
      // Invalidate specific tag queries
      tagIds.forEach((tagId) => {
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tag(tagId),
            refetchType: "active",
          }),
        );

        // Invalidate newsletter lists that filter by this tag
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            predicate: (query) => {
              return queryKeyFactory.matchers.hasTags(
                query.queryKey as unknown[],
                [tagId],
              );
            },
            refetchType: "active",
          }),
        );
      });
    } else {
      // Invalidate all tag-related queries
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          queryKey: queryKeyFactory.newsletters.tags(),
          refetchType: "active",
        }),
      );
    }

    // Always invalidate newsletter lists as tags might affect filtering
    invalidationPromises.push(
      this.queryClient.invalidateQueries({
        queryKey: queryKeyFactory.newsletters.lists(),
        refetchType: "active",
      }),
    );

    Promise.all(invalidationPromises).catch((error) => {
      console.error("Error invalidating tag queries:", error);
    });

    this.endPerformanceTimer("invalidateTagQueries");
  }

  // Cross-feature cache synchronization
  handleTagUpdate(
    tagId: string,
    updates: Partial<Tag>,
    options: CacheUpdateOptions = {},
  ): void {
    this.startPerformanceTimer(`handleTagUpdate-${tagId}`);

    // Update the tag in cache
    this.updateTagInCache({ id: tagId, updates }, options);

    // Cross-feature synchronization
    if (this.config.enableCrossFeatureSync) {
      // Invalidate related newsletter queries
      this.queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as unknown[];
          return queryKeyFactory.matchers.hasTags(queryKey, [tagId]);
        },
        refetchType: "active",
      });

      // Invalidate tag-newsletter relationship queries
      this.queryClient.invalidateQueries({
        queryKey: queryKeyFactory.related.tagNewsletters(tagId),
        refetchType: "active",
      });
    }

    this.endPerformanceTimer(`handleTagUpdate-${tagId}`);
  }

  private syncNewsletterQueueStatus(
    queueUpdate: {
      action: "add" | "remove" | "reorder";
      items: ReadingQueueItem[] | string[];
    },
    userId: string,
  ): void {
    if (queueUpdate.action === "add") {
      // Mark newsletters as bookmarked in all newsletter caches
      const items = queueUpdate.items as ReadingQueueItem[];
      items.forEach((item) => {
        this.updateNewsletterInCache({
          id: item.newsletter.id,
          updates: { is_bookmarked: true },
        });
      });
    } else if (queueUpdate.action === "remove") {
      // Mark newsletters as not bookmarked
      const itemIds = queueUpdate.items as string[];
      // We need to get the current queue to find newsletter IDs
      const currentQueue = this.queryClient.getQueryData<ReadingQueueItem[]>(
        queryKeyFactory.queue.list(userId),
      );

      if (currentQueue) {
        const removedItems = currentQueue.filter((item) =>
          itemIds.includes(item.id),
        );
        removedItems.forEach((item) => {
          this.updateNewsletterInCache({
            id: item.newsletter.id,
            updates: { is_bookmarked: false },
          });
        });
      }
    }
  }

  // Smart invalidation strategies
  invalidateRelatedQueries(
    newsletterId: string,
    updates: Partial<NewsletterWithRelations> | Record<string, boolean>,
  ): void {
    this.startPerformanceTimer(`invalidateRelated-${newsletterId}`);

    const invalidationPromises: Promise<void>[] = [];

    // If read status changed, invalidate filtered queries and unread count
    if (
      updates.is_read !== undefined ||
      (updates as Record<string, boolean>).unreadCount
    ) {
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          predicate: (query) => {
            return queryKeyFactory.matchers.hasFilter(
              query.queryKey as unknown[],
              "unread",
            );
          },
          refetchType: "active",
        }),
      );

      // Invalidate unread count cache
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          queryKey: ["unreadCount"],
          refetchType: "active",
        }),
      );
    }

    // If archive status changed, invalidate archived queries and unread count
    if (updates.is_archived !== undefined) {
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          predicate: (query) => {
            return queryKeyFactory.matchers.hasFilter(
              query.queryKey as unknown[],
              "archived",
            );
          },
          refetchType: "active",
        }),
      );

      // Invalidate unread count cache when archiving/unarchiving
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          queryKey: ["unreadCount"],
          refetchType: "active",
        }),
      );
    }

    // If like status changed, invalidate liked queries
    if (updates.is_liked !== undefined) {
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          predicate: (query) => {
            return queryKeyFactory.matchers.hasFilter(
              query.queryKey as unknown[],
              "liked",
            );
          },
          refetchType: "active",
        }),
      );
    }

    // If tags changed, invalidate tag-specific queries
    if (updates.tags !== undefined) {
      invalidationPromises.push(
        this.queryClient.invalidateQueries({
          queryKey: queryKeyFactory.newsletters.tags(),
          refetchType: "active",
        }),
      );
    }

    // Wait for all invalidations to complete
    Promise.all(invalidationPromises).catch((error) => {
      console.error("Error invalidating related queries:", error);
    });

    this.endPerformanceTimer(`invalidateRelated-${newsletterId}`);
  }

  // Optimistic update with rollback
  async optimisticUpdate(
    newsletterId: string,
    updates: Partial<Newsletter>,
    operation: string,
  ): Promise<void> {
    this.startPerformanceTimer("optimisticUpdate");

    try {
      // Update newsletter in all relevant caches
      this.updateNewsletterInCache(
        { id: newsletterId, updates },
        { optimistic: true },
      );

      // Invalidate related queries to ensure consistency
      await this.invalidateRelatedQueries(newsletterId, {
        newsletters: true,
        readingQueue: true,
        tags: true,
        sources: false,
        unreadCount: true,
      });
    } catch (error) {
      console.error(`Error in optimistic update for ${operation}:`, error);
      throw error;
    } finally {
      this.endPerformanceTimer("optimisticUpdate");
    }
  }

  async optimisticUpdateLegacy<T>(
    queryKey: QueryKey,
    updateFn: (oldData: T) => T,
    mutationFn: () => Promise<void>,
    rollbackData?: T,
  ): Promise<void> {
    this.startPerformanceTimer("optimisticUpdateLegacy");

    // Store the previous data for potential rollback
    const previousData = this.queryClient.getQueryData<T>(queryKey);

    try {
      // Apply optimistic update
      this.queryClient.setQueryData<T>(queryKey, (oldData) => {
        if (oldData === undefined) return oldData;
        return updateFn(oldData);
      });

      // Execute the actual mutation
      await mutationFn();
    } catch (error) {
      // Rollback on error
      this.queryClient.setQueryData<T>(
        queryKey,
        rollbackData !== undefined ? rollbackData : previousData,
      );

      // Re-throw the error
      throw error;
    } finally {
      this.endPerformanceTimer("optimisticUpdateLegacy");
    }
  }

  // Batch operations for better performance
  batchCacheUpdates(updates: (() => void)[]): void {
    this.startPerformanceTimer(`batchUpdates-${updates.length}`);

    // Temporarily disable cache notifications
    const originalNotifyOnChangeProps =
      this.queryClient.getDefaultOptions().queries?.notifyOnChangeProps;

    this.queryClient.setDefaultOptions({
      queries: {
        ...this.queryClient.getDefaultOptions().queries,
        notifyOnChangeProps: [],
      },
    });

    try {
      // Execute all updates
      updates.forEach((update) => update());
    } finally {
      // Restore original notification settings
      this.queryClient.setDefaultOptions({
        queries: {
          ...this.queryClient.getDefaultOptions().queries,
          notifyOnChangeProps: originalNotifyOnChangeProps,
        },
      });

      this.endPerformanceTimer(`batchUpdates-${updates.length}`);
    }
  }

  // Batch newsletter operations for UI components
  async batchUpdateNewsletters(config: {
    operations: Array<{
      id: string;
      updates: Partial<NewsletterWithRelations>;
      type: "read" | "unread" | "archive" | "unarchive" | "delete" | "like";
    }>;
    optimistic?: boolean;
  }): Promise<void> {
    this.startPerformanceTimer(
      `batchNewsletterUpdates-${config.operations.length}`,
    );

    const { operations, optimistic = true } = config;

    // Group operations by type for efficiency
    const operationsByType = operations.reduce(
      (acc, op) => {
        if (!acc[op.type]) acc[op.type] = [];
        acc[op.type].push(op);
        return acc;
      },
      {} as Record<string, typeof operations>,
    );

    try {
      // Use cache manager's bulk update for each operation type
      for (const [type, ops] of Object.entries(operationsByType)) {
        const ids = ops.map((op) => op.id);
        const updates = ops[0].updates; // All operations of same type should have same updates

        if (type === "delete") {
          // Handle deletions specially
          this.queryClient.setQueriesData<NewsletterWithRelations[]>(
            { queryKey: queryKeyFactory.newsletters.lists() },
            (old = []) => old.filter((n) => !ids.includes(n.id)),
          );

          // Remove individual caches
          ids.forEach((id) => {
            this.queryClient.removeQueries({
              queryKey: queryKeyFactory.newsletters.detail(id),
            });
          });
        } else {
          // Use existing bulk update method
          this.bulkUpdateNewslettersInCache({ ids, updates }, { optimistic });
        }
      }

      // Cross-feature synchronization
      if (this.config.enableCrossFeatureSync) {
        operations.forEach(({ id, updates }) => {
          this.syncWithReadingQueue({ id, updates });
        });
      }
    } catch (error) {
      console.error("Error in batch newsletter updates:", error);
      throw error;
    } finally {
      this.endPerformanceTimer(
        `batchNewsletterUpdates-${config.operations.length}`,
      );
    }
  }

  // Cache warming for anticipated queries
  warmCache(
    userId: string,
    priority: "high" | "medium" | "low" = "medium",
  ): void {
    const staleTime = priority === "high" ? 0 : this.config.defaultStaleTime;

    // Pre-fetch common newsletter queries
    this.queryClient.prefetchQuery({
      queryKey: queryKeyFactory.newsletters.list({ userId, filter: "unread" }),
      staleTime,
    });

    this.queryClient.prefetchQuery({
      queryKey: queryKeyFactory.queue.list(userId),
      staleTime,
    });

    if (priority === "high") {
      // Pre-fetch additional high-priority data
      this.queryClient.prefetchQuery({
        queryKey: queryKeyFactory.newsletters.list({ userId, filter: "liked" }),
        staleTime,
      });
    }
  }

  // Cache statistics and debugging
  getCacheStats(): {
    totalQueries: number;
    newsletterQueries: number;
    queueQueries: number;
    staleQueries: number;
  } {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();

    const newsletterQueries = queries.filter(
      (query) =>
        queryKeyFactory.matchers.isNewsletterListKey(
          query.queryKey as unknown[],
        ) ||
        queryKeyFactory.matchers.isNewsletterDetailKey(
          query.queryKey as unknown[],
        ),
    );

    const queueQueries = queries.filter((query) =>
      queryKeyFactory.matchers.isReadingQueueKey(query.queryKey as unknown[]),
    );

    const staleQueries = queries.filter((query) => query.isStale());

    return {
      totalQueries: queries.length,
      newsletterQueries: newsletterQueries.length,
      queueQueries: queueQueries.length,
      staleQueries: staleQueries.length,
    };
  }

  // Clear specific cache segments
  clearNewsletterCache(): void {
    this.queryClient.removeQueries({
      queryKey: queryKeyFactory.newsletters.all(),
    });
  }

  clearReadingQueueCache(): void {
    this.queryClient.removeQueries({
      queryKey: queryKeyFactory.queue.all(),
    });
  }

  // Error boundary and retry logic
  setupErrorBoundaries(): void {
    // Set up default retry logic for network errors
    this.queryClient.setDefaultOptions({
      queries: {
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error instanceof Error && error.message.includes("4")) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex: number) =>
          Math.min(1000 * Math.pow(2, attemptIndex), 30000),
      },
      mutations: {
        retry: (failureCount, error) => {
          // More conservative retry for mutations
          if (error instanceof Error && error.message.includes("4")) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex: number) =>
          Math.min(2000 * Math.pow(2, attemptIndex), 15000),
      },
    });
  }
}

// Singleton instance for global access
let cacheManagerInstance: NewsletterCacheManager | null = null;

export const createCacheManager = (
  queryClient: QueryClient,
  config?: Partial<CacheManagerConfig>,
): NewsletterCacheManager => {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new NewsletterCacheManager(queryClient, config);
    cacheManagerInstance.setupErrorBoundaries();
  }
  return cacheManagerInstance;
};

export const getCacheManager = (): NewsletterCacheManager => {
  if (!cacheManagerInstance) {
    throw new Error(
      "Cache manager not initialized. Call createCacheManager first.",
    );
  }
  return cacheManagerInstance;
};

// Utility functions for backward compatibility
export const updateCachedNewsletter = <T extends { id: string }>(
  queryClient: QueryClient,
  id: string,
  updates: Partial<T>,
  queryKey: QueryKey = queryKeyFactory.newsletters.lists(),
) => {
  queryClient.setQueriesData<T[]>({ queryKey }, (oldData = []) =>
    oldData.map((item) => (item.id === id ? { ...item, ...updates } : item)),
  );
};

export const updateMultipleCachedNewsletters = <T extends { id: string }>(
  queryClient: QueryClient,
  updates: Array<{ id: string; updates: Partial<T> }>,
  queryKey: QueryKey = queryKeyFactory.newsletters.lists(),
) => {
  const updatesMap = new Map(updates.map(({ id, updates }) => [id, updates]));

  queryClient.setQueriesData<T[]>({ queryKey }, (oldData = []) =>
    oldData.map((item) =>
      updatesMap.has(item.id) ? { ...item, ...updatesMap.get(item.id) } : item,
    ),
  );
};

export const invalidateNewsletterQueries = (
  queryClient: QueryClient,
  filters: {
    scope?: "list" | "detail" | "tags";
    filter?: NewsletterFilter;
    tagIds?: string[];
    sourceId?: string | null;
  } = {},
) => {
  if (filters.scope === "list") {
    queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.lists(),
      refetchType: "active",
    });
  } else if (filters.scope === "detail") {
    queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.details(),
      refetchType: "active",
    });
  } else if (filters.scope === "tags") {
    queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.tags(),
      refetchType: "active",
    });
  } else {
    // Invalidate all newsletter queries
    queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.all(),
      refetchType: "active",
    });
  }
};
