import { useMemo, useCallback } from "react";
import {
  getCacheManager,
  prefetchQuery as utilsPrefetchQuery,
  setQueryData as utilsSetQueryData,
  getQueryData as utilsGetQueryData,
  invalidateQueries,
} from "@common/utils/cacheUtils";
import type { NewsletterWithRelations, ReadingQueueItem } from "@common/types";

/**
 * Custom hook that provides a unified interface for cache operations
 * Uses the SimpleCacheManager internally to ensure consistent cache management
 */
export const useCache = () => {
  // Initialize or get existing cache manager instance
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      // If no cache manager exists, this means it needs to be initialized elsewhere
      // Return null and handle gracefully
      return null;
    }
  }, []);

  // Newsletter cache operations
  const updateNewsletter = useCallback(
    (newsletterId: string, updates: Partial<NewsletterWithRelations>) => {
      if (!cacheManager) return;
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
      if (!cacheManager) return;
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
      if (!cacheManager) return null;
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
      if (!cacheManager) return;
      cacheManager.updateReadingQueueInCache(operation);
    },
    [cacheManager],
  );

  // Query invalidation operations
  const invalidateRelatedQueries = useCallback(
    (newsletterIds: string[], operationType: string) => {
      if (!cacheManager) return;
      cacheManager.invalidateRelatedQueries(newsletterIds, operationType);
    },
    [cacheManager],
  );

  const invalidateNewsletters = useCallback(() => {
    if (!cacheManager) return;
    cacheManager.clearNewsletterCache();
  }, [cacheManager]);

  const invalidateReadingQueue = useCallback(() => {
    if (!cacheManager) return;
    cacheManager.clearReadingQueueCache();
  }, [cacheManager]);

  // Cache warming operations
  const warmCache = useCallback(
    (userId: string, priority: "high" | "medium" | "low" = "medium") => {
      if (!cacheManager) return;
      cacheManager.warmCache(userId, priority);
    },
    [cacheManager],
  );

  // Tag-specific cache operations (extending cache manager functionality)
  const invalidateTagQueries = useCallback(
    (tagIds: string[], operationType: string) => {
      if (!cacheManager) return;
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
      if (!cacheManager) return;
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
      queryKey: readonly unknown[],
      queryFn: () => Promise<unknown>,
      options?: { staleTime?: number; gcTime?: number },
    ) => {
      return utilsPrefetchQuery(queryKey, queryFn, {
        staleTime: options?.staleTime || 5 * 60 * 1000,
        gcTime: options?.gcTime || 30 * 60 * 1000,
      });
    },
    [],
  );

  const setQueryData = useCallback(
    <T>(
      queryKey: readonly unknown[],
      data: T | ((oldData: T | undefined) => T),
    ) => {
      return utilsSetQueryData(queryKey, data);
    },
    [],
  );

  const getQueryData = useCallback(
    <T>(queryKey: readonly unknown[]): T | undefined => {
      return utilsGetQueryData<T>(queryKey);
    },
    [],
  );

  const removeQueries = useCallback(async (queryKey: readonly unknown[]) => {
    // Use invalidateQueries with exact matching for removal
    await invalidateQueries({ queryKey });
  }, []);

  // Batch operations for performance
  const batchInvalidate = useCallback(
    async (
      operations: Array<{
        queryKey?: readonly unknown[];
        predicate?: (query: unknown) => boolean;
      }>,
    ) => {
      const promises = operations.map((op) => {
        if (op.queryKey) {
          return invalidateQueries({ queryKey: op.queryKey });
        } else if (op.predicate) {
          return invalidateQueries({ predicate: op.predicate });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
    },
    [],
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
