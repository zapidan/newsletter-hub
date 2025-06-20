import { useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useDebouncedCallback } from '../usePerformanceOptimizations';
import { useLogger } from '@common/utils/logger/useLogger';

interface InvalidationBatch {
  queryKeys: Array<readonly unknown[]>;
  timestamp: number;
}

interface CacheInvalidationOptions {
  batchDelay?: number;
  debounceDelay?: number;
  maxBatchSize?: number;
  enableLogging?: boolean;
}

interface InvalidationMetrics {
  totalInvalidations: number;
  batchedInvalidations: number;
  debouncedInvalidations: number;
  lastInvalidation: number;
}

/**
 * Optimized cache invalidation hook with batching and debouncing
 * Reduces redundant invalidations and improves performance
 */
export const useCacheInvalidation = (options: CacheInvalidationOptions = {}) => {
  const {
    batchDelay = 100,
    debounceDelay = 500,
    maxBatchSize = 50,
    enableLogging = process.env.NODE_ENV === 'development',
  } = options;

  const queryClient = useQueryClient();
  const log = useLogger('useCacheInvalidation');
  const batchRef = useRef<InvalidationBatch>({ queryKeys: [], timestamp: 0 });
  const metricsRef = useRef<InvalidationMetrics>({
    totalInvalidations: 0,
    batchedInvalidations: 0,
    debouncedInvalidations: 0,
    lastInvalidation: 0,
  });
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Process batched invalidations
  const processBatch = useCallback(async () => {
    const batch = batchRef.current;
    if (batch.queryKeys.length === 0) return;

    const startTime = performance.now();
    const queryKeys = [...batch.queryKeys];
    batchRef.current = { queryKeys: [], timestamp: 0 };

    try {
      // Group similar query keys to optimize invalidation
      const groupedKeys = groupQueryKeys(queryKeys);

      // Invalidate each group
      await Promise.all(
        groupedKeys.map(group =>
          queryClient.invalidateQueries({ queryKey: group.baseKey })
        )
      );

      const duration = performance.now() - startTime;
      metricsRef.current.batchedInvalidations += queryKeys.length;
      metricsRef.current.lastInvalidation = Date.now();

      if (enableLogging) {
        log.debug('Batch invalidation completed', {
          action: 'batch_invalidation',
          metadata: {
            batchSize: queryKeys.length,
            groupCount: groupedKeys.length,
            duration: duration.toFixed(2),
          },
        });
      }
    } catch (error) {
      log.error('Batch invalidation failed', {
        action: 'batch_invalidation_error',
        metadata: {
          batchSize: queryKeys.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }, error instanceof Error ? error : new Error(String(error)));
    }
  }, [queryClient, enableLogging, log]);

  // Add query key to batch
  const addToBatch = useCallback((queryKey: readonly unknown[]) => {
    const now = Date.now();

    // If batch is empty or timeout expired, start new batch
    if (batchRef.current.queryKeys.length === 0 ||
        now - batchRef.current.timestamp > batchDelay) {
      batchRef.current = { queryKeys: [queryKey], timestamp: now };

      // Clear existing timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      // Set new timeout
      batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
    } else {
      // Add to existing batch
      batchRef.current.queryKeys.push(queryKey);

      // Process immediately if batch is full
      if (batchRef.current.queryKeys.length >= maxBatchSize) {
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }
        processBatch();
      }
    }
  }, [batchDelay, maxBatchSize, processBatch]);

  // Immediate invalidation (no batching)
  const invalidateImmediate = useCallback(
    async (queryKey: readonly unknown[]) => {
      const startTime = performance.now();

      try {
        await queryClient.invalidateQueries({ queryKey });
        metricsRef.current.totalInvalidations++;
        metricsRef.current.lastInvalidation = Date.now();

        if (enableLogging) {
          const duration = performance.now() - startTime;
          log.debug('Immediate invalidation completed', {
            action: 'immediate_invalidation',
            metadata: {
              queryKey,
              duration: duration.toFixed(2),
            },
          });
        }
      } catch (error) {
        log.error('Immediate invalidation failed', {
          action: 'immediate_invalidation_error',
          metadata: {
            queryKey,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        }, error instanceof Error ? error : new Error(String(error)));
      }
    },
    [queryClient, enableLogging, log]
  );

  // Batched invalidation
  const invalidateBatched = useCallback(
    (queryKey: readonly unknown[]) => {
      metricsRef.current.totalInvalidations++;
      addToBatch(queryKey);
    },
    [addToBatch]
  );

  // Debounced invalidation for specific query types
  const invalidateNewsletterList = useDebouncedCallback(
    async () => {
      await invalidateImmediate(['newsletters']);
      metricsRef.current.debouncedInvalidations++;
    },
    debounceDelay
  );

  const invalidateUnreadCount = useDebouncedCallback(
    async () => {
      await invalidateImmediate(['unreadCount']);
      metricsRef.current.debouncedInvalidations++;
    },
    debounceDelay
  );

  const invalidateTags = useDebouncedCallback(
    async () => {
      await invalidateImmediate(['tags']);
      metricsRef.current.debouncedInvalidations++;
    },
    debounceDelay
  );

  const invalidateNewsletterSources = useDebouncedCallback(
    async () => {
      await invalidateImmediate(['newsletter-sources']);
      metricsRef.current.debouncedInvalidations++;
    },
    debounceDelay
  );

  // Smart invalidation based on operation type
  const invalidateByOperation = useCallback(
    async (operation: string, entityId?: string) => {
      const invalidations: Array<() => void | Promise<void>> = [];

      switch (operation) {
        case 'newsletter-archive':
        case 'newsletter-unarchive':
        case 'newsletter-like':
        case 'newsletter-unlike':
          if (entityId) {
            invalidateImmediate(['newsletter', entityId]);
          }
          invalidations.push(invalidateNewsletterList);
          invalidations.push(invalidateUnreadCount);
          break;

        case 'newsletter-mark-read':
        case 'newsletter-mark-unread':
          if (entityId) {
            invalidateImmediate(['newsletter', entityId]);
          }
          invalidations.push(invalidateUnreadCount);
          // Don't invalidate full list for read status changes
          break;

        case 'newsletter-tag-add':
        case 'newsletter-tag-remove':
          if (entityId) {
            invalidateImmediate(['newsletter', entityId]);
          }
          invalidations.push(invalidateTags);
          invalidations.push(invalidateNewsletterList);
          break;

        case 'tag-create':
        case 'tag-update':
        case 'tag-delete':
          invalidations.push(invalidateTags);
          invalidations.push(invalidateNewsletterList);
          break;

        case 'newsletter-source-update':
        case 'newsletter-source-archive':
          invalidations.push(invalidateNewsletterSources);
          invalidations.push(invalidateNewsletterList);
          break;

        case 'bulk-operation':
          // For bulk operations, use batched invalidation
          invalidateBatched(['newsletters']);
          invalidations.push(invalidateUnreadCount);
          invalidations.push(invalidateTags);
          break;

        default:
          // Fallback to full invalidation
          invalidations.push(invalidateNewsletterList);
          break;
      }

      // Execute all invalidations
      await Promise.all(invalidations.map(fn => fn()));
    },
    [
      invalidateImmediate,
      invalidateBatched,
      invalidateNewsletterList,
      invalidateUnreadCount,
      invalidateTags,
      invalidateNewsletterSources,
    ]
  );

  // Get current metrics
  const getMetrics = useCallback(() => ({
    ...metricsRef.current,
    pendingBatchSize: batchRef.current.queryKeys.length,
  }), []);

  // Force process any pending batches
  const flush = useCallback(async () => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    await processBatch();
  }, [processBatch]);

  // Cleanup on unmount
  useMemo(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Core invalidation methods
    invalidateImmediate,
    invalidateBatched,
    invalidateByOperation,

    // Specific debounced invalidations
    invalidateNewsletterList,
    invalidateUnreadCount,
    invalidateTags,
    invalidateNewsletterSources,

    // Utilities
    getMetrics,
    flush,
  };
};

/**
 * Group similar query keys to optimize invalidation
 * This reduces the number of invalidation calls by finding common prefixes
 */
function groupQueryKeys(queryKeys: Array<readonly unknown[]>): Array<{
  baseKey: readonly unknown[];
  keys: Array<readonly unknown[]>;
}> {
  const groups = new Map<string, Array<readonly unknown[]>>();

  for (const queryKey of queryKeys) {
    if (queryKey.length === 0) continue;

    // Use first element as group key
    const groupKey = JSON.stringify(queryKey[0]);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey)!.push(queryKey);
  }

  return Array.from(groups.entries()).map(([_, keys]) => {
    // Find the most specific common prefix
    const baseKey = keys.length === 1
      ? keys[0]
      : [keys[0][0]]; // Use just the first element as base

    return { baseKey, keys };
  });
}

/**
 * Type-safe cache invalidation for specific query types
 */
export interface TypedCacheInvalidation {
  newsletter: (id: string) => Promise<void>;
  newsletters: () => void;
  unreadCount: () => void;
  tags: () => void;
  newsletterSources: () => void;
  readingQueue: () => Promise<void>;
}

/**
 * Hook for type-safe cache invalidation
 */
export const useTypedCacheInvalidation = (): TypedCacheInvalidation => {
  const {
    invalidateImmediate,
    invalidateNewsletterList,
    invalidateUnreadCount,
    invalidateTags,
    invalidateNewsletterSources,
  } = useCacheInvalidation();

  return {
    newsletter: (id: string) => invalidateImmediate(['newsletter', id]),
    newsletters: invalidateNewsletterList,
    unreadCount: invalidateUnreadCount,
    tags: invalidateTags,
    newsletterSources: invalidateNewsletterSources,
    readingQueue: () => invalidateImmediate(['reading-queue']),
  };
};

/**
 * Global cache invalidation instance for use outside of React components
 */
let globalQueryClient: QueryClient | null = null;

export const setGlobalQueryClient = (client: QueryClient) => {
  globalQueryClient = client;
};

export const globalCacheInvalidation = {
  invalidateNewsletter: (id: string) => {
    if (globalQueryClient) {
      globalQueryClient.invalidateQueries({ queryKey: ['newsletter', id] });
    }
  },
  invalidateNewsletters: () => {
    if (globalQueryClient) {
      globalQueryClient.invalidateQueries({ queryKey: ['newsletters'] });
    }
  },
  invalidateUnreadCount: () => {
    if (globalQueryClient) {
      globalQueryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    }
  },
};
