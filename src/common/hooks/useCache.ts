import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { getCacheManager, createCacheManager } from "@common/utils/cacheUtils";
import type { NewsletterWithRelations, ReadingQueueItem } from "@common/types";

/**
 * Custom hook that provides a unified interface for cache operations
 * Uses the SimpleCacheManager internally to ensure consistent cache management
 */
export const useCache = () => {
  const queryClient = useQueryClient();

  // Initialize or get existing cache manager instance
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

  // Newsletter cache operations
  const updateNewsletter = useCallback(
    (newsletterId: string, updates: Partial<NewsletterWithRelations>) => {
      cacheManager.updateNewsletterInCache({
        id: newsletterId,
        updates,
      });
    },
    [cacheManager],
  );

  const batchUpdateNewsletters = useCallback(
    async (
      updates: { id: string; updates: Partial<NewsletterWithRelations> }[],
    ) => {
      await cacheManager.batchUpdateNewsletters(updates);
    },
    [cacheManager],
  );

  const optimisticUpdate = useCallback(
    async (
      newsletterId: string,
      updates: Partial<NewsletterWithRelations>,
      operation: string,
    ): Promise<NewsletterWithRelations | null> => {
      return await cacheManager.optimisticUpdate(
        newsletterId,
        updates,
        operation,
      );
    },
    [cacheManager],
  );

  // Reading queue cache operations
  const updateReadingQueue = useCallback(
    (operation: {
      type: "add" | "remove" | "reorder" | "updateTags" | "revert";
      newsletterId?: string;
      queueItemId?: string;
      updates?: { id: string; position: number }[];
      tagIds?: string[];
      queueItems?: ReadingQueueItem[];
      userId: string;
    }) => {
      cacheManager.updateReadingQueueInCache(operation);
    },
    [cacheManager],
  );

  // Query invalidation operations
  const invalidateRelatedQueries = useCallback(
    (newsletterIds: string[], operationType: string) => {
      cacheManager.invalidateRelatedQueries(newsletterIds, operationType);
    },
    [cacheManager],
  );

  const invalidateNewsletters = useCallback(() => {
    cacheManager.clearNewsletterCache();
  }, [cacheManager]);

  const invalidateReadingQueue = useCallback(() => {
    cacheManager.clearReadingQueueCache();
  }, [cacheManager]);

  // Cache warming operations
  const warmCache = useCallback(
    (userId: string, priority: "high" | "medium" | "low" = "medium") => {
      cacheManager.warmCache(userId, priority);
    },
    [cacheManager],
  );

  // Tag-specific cache operations (extending cache manager functionality)
  const invalidateTagQueries = useCallback(
    (tagIds: string[], operationType: string) => {
      // Use the generic invalidateRelatedQueries with tag-specific operation types
      const tagOperationTypes = [
        "tag-create",
        "tag-update",
        "tag-delete",
        "newsletter-tag-update",
      ];

      if (tagOperationTypes.includes(operationType)) {
        cacheManager.invalidateRelatedQueries(tagIds, operationType);
      } else {
        // Fallback for tag operations
        cacheManager.invalidateRelatedQueries([], "tag-update");
      }
    },
    [cacheManager],
  );

  // Newsletter source cache operations
  const invalidateSourceQueries = useCallback(
    (sourceIds: string[], operationType: string) => {
      const sourceOperationTypes = [
        "newsletter-sources",
        "source-update-optimistic",
        "source-update-error",
        "source-archive-optimistic",
        "source-unarchive-optimistic",
        "source-archive-error",
      ];

      if (sourceOperationTypes.includes(operationType)) {
        cacheManager.invalidateRelatedQueries(sourceIds, operationType);
      } else {
        // Fallback for source operations
        cacheManager.invalidateRelatedQueries([], "newsletter-sources");
      }
    },
    [cacheManager],
  );

  // Generic cache utilities
  const prefetchQuery = useCallback(
    (
      queryKey: unknown[],
      queryFn: () => Promise<unknown>,
      options?: { staleTime?: number },
    ) => {
      return queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes default
      });
    },
    [queryClient],
  );

  const setQueryData = useCallback(
    <T>(queryKey: unknown[], data: T | ((oldData: T | undefined) => T)) => {
      return queryClient.setQueryData(queryKey, data);
    },
    [queryClient],
  );

  const getQueryData = useCallback(
    <T>(queryKey: unknown[]): T | undefined => {
      return queryClient.getQueryData<T>(queryKey);
    },
    [queryClient],
  );

  const removeQueries = useCallback(
    (queryKey: unknown[]) => {
      queryClient.removeQueries({ queryKey, exact: true });
    },
    [queryClient],
  );

  // Batch operations for performance
  const batchInvalidate = useCallback(
    async (
      operations: Array<{
        queryKey?: unknown[];
        predicate?: (query: unknown) => boolean;
      }>,
    ) => {
      const promises = operations.map((op) => {
        if (op.queryKey) {
          return queryClient.invalidateQueries({ queryKey: op.queryKey });
        } else if (op.predicate) {
          return queryClient.invalidateQueries({ predicate: op.predicate });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
    },
    [queryClient],
  );

  return {
    // Newsletter operations
    updateNewsletter,
    batchUpdateNewsletters,
    optimisticUpdate,

    // Reading queue operations
    updateReadingQueue,

    // Invalidation operations
    invalidateRelatedQueries,
    invalidateNewsletters,
    invalidateReadingQueue,
    invalidateTagQueries,
    invalidateSourceQueries,

    // Cache warming
    warmCache,

    // Generic utilities
    prefetchQuery,
    setQueryData,
    getQueryData,
    removeQueries,
    batchInvalidate,

    // Direct access to cache manager for advanced use cases
    cacheManager,
  };
};
