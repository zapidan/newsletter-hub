import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useLogger } from './logger/useLogger';
import { queryKeyFactory } from './queryKeyFactory';

interface InvalidationRequest {
  queryKey: readonly unknown[];
  exact?: boolean;
  refetchType?: 'active' | 'inactive' | 'all' | 'none';
}

interface BatchedInvalidation {
  requests: Map<string, InvalidationRequest>;
  timeoutId: NodeJS.Timeout | null;
  pendingPromise: Promise<void> | null;
}

/**
 * Optimized cache invalidation system with batching and debouncing
 * Reduces redundant invalidations and improves performance
 */
export class OptimizedCacheInvalidator {
  private queryClient: QueryClient;
  private log: ReturnType<typeof useLogger>;
  private batchedInvalidations: BatchedInvalidation;
  private debounceDelay: number;
  private operationDebounceTimers: Map<string, NodeJS.Timeout>;

  constructor(queryClient: QueryClient, logger: ReturnType<typeof useLogger>, debounceDelay = 100) {
    this.queryClient = queryClient;
    this.log = logger;
    this.debounceDelay = debounceDelay;
    this.batchedInvalidations = {
      requests: new Map(),
      timeoutId: null,
      pendingPromise: null,
    };
    this.operationDebounceTimers = new Map();
  }

  /**
   * Generate a unique key for invalidation requests to prevent duplicates
   */
  private getInvalidationKey(request: InvalidationRequest): string {
    return JSON.stringify({
      queryKey: request.queryKey,
      exact: request.exact,
      refetchType: request.refetchType,
    });
  }

  /**
   * Add an invalidation request to the batch
   */
  private addToBatch(request: InvalidationRequest): void {
    const key = this.getInvalidationKey(request);
    this.batchedInvalidations.requests.set(key, request);
  }

  /**
   * Execute all batched invalidations
   */
  private async executeBatch(): Promise<void> {
    const requests = Array.from(this.batchedInvalidations.requests.values());
    this.batchedInvalidations.requests.clear();
    this.batchedInvalidations.timeoutId = null;

    if (requests.length === 0) return;

    this.log.debug('Executing batched invalidations', {
      action: 'execute_batch',
      metadata: {
        count: requests.length,
        keys: requests.map((r) => r.queryKey),
      },
    });

    try {
      // Execute all invalidations in parallel
      await Promise.all(
        requests.map((request) =>
          this.queryClient.invalidateQueries({
            queryKey: request.queryKey,
            exact: request.exact,
            refetchType: request.refetchType || 'active',
          })
        )
      );
    } catch (error) {
      this.log.error(
        'Failed to execute batched invalidations',
        {
          action: 'execute_batch_error',
          metadata: { requestCount: requests.length },
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Schedule batch execution with debouncing
   */
  private scheduleBatch(): void {
    // Clear existing timeout
    if (this.batchedInvalidations.timeoutId) {
      clearTimeout(this.batchedInvalidations.timeoutId);
    }

    // Schedule new execution
    this.batchedInvalidations.timeoutId = setTimeout(() => {
      this.batchedInvalidations.pendingPromise = this.executeBatch();
    }, this.debounceDelay);
  }

  /**
   * Invalidate queries with batching and deduplication
   */
  async invalidate(request: InvalidationRequest): Promise<void> {
    this.addToBatch(request);
    this.scheduleBatch();

    // Return the pending promise if we need to wait for completion
    if (this.batchedInvalidations.pendingPromise) {
      return this.batchedInvalidations.pendingPromise;
    }
  }

  /**
   * Invalidate multiple queries in a single batch
   */
  async invalidateMultiple(requests: InvalidationRequest[]): Promise<void> {
    requests.forEach((request) => this.addToBatch(request));
    this.scheduleBatch();

    if (this.batchedInvalidations.pendingPromise) {
      return this.batchedInvalidations.pendingPromise;
    }
  }

  /**
   * Force immediate execution of pending invalidations
   */
  async flush(): Promise<void> {
    if (this.batchedInvalidations.timeoutId) {
      clearTimeout(this.batchedInvalidations.timeoutId);
      this.batchedInvalidations.timeoutId = null;
    }

    return this.executeBatch();
  }

  /**
   * Clear all pending invalidations without executing
   */
  clear(): void {
    if (this.batchedInvalidations.timeoutId) {
      clearTimeout(this.batchedInvalidations.timeoutId);
      this.batchedInvalidations.timeoutId = null;
    }
    this.batchedInvalidations.requests.clear();
    this.batchedInvalidations.pendingPromise = null;
  }

  /**
   * Debounced operation-specific invalidation
   */
  invalidateForOperation(
    operationType: string,
    newsletterIds: string[],
    debounceKey?: string
  ): void {
    const key = debounceKey || `${operationType}-${newsletterIds.join(',')}`;

    // Clear existing timer for this operation
    const existingTimer = this.operationDebounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.operationDebounceTimers.delete(key);
      this.executeOperationInvalidation(operationType, newsletterIds);
    }, 200); // 200ms debounce for operations

    this.operationDebounceTimers.set(key, timer);
  }

  /**
   * Execute invalidation based on operation type
   */
  private async executeOperationInvalidation(
    operationType: string,
    newsletterIds: string[]
  ): Promise<void> {
    const invalidations: InvalidationRequest[] = [];

    switch (operationType) {
      case 'mark-read':
      case 'mark-unread':
      case 'bulk-mark-read':
      case 'bulk-mark-unread':
        // Only invalidate unread count and specific newsletter details
        invalidations.push({
          queryKey: ['unreadCount', 'all'],
          exact: false,
          refetchType: 'active',
        });

        // Invalidate specific newsletter details
        newsletterIds.forEach((id) => {
          invalidations.push({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
            refetchType: 'active',
          });
        });
        break;

      case 'toggle-archive':
      case 'archive':
      case 'unarchive':
      case 'bulk-archive':
      case 'bulk-unarchive':
        // Invalidate newsletter lists and unread counts
        invalidations.push(
          {
            queryKey: queryKeyFactory.newsletters.lists(),
            exact: false,
            refetchType: 'active',
          },
          {
            queryKey: ['unreadCount', 'all'],
            exact: false,
            refetchType: 'active',
          }
        );

        // Invalidate specific newsletter details
        newsletterIds.forEach((id) => {
          invalidations.push({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
            refetchType: 'active',
          });
        });
        break;

      case 'delete':
      case 'bulk-delete':
        // Comprehensive invalidation for deletes
        invalidations.push(
          {
            queryKey: queryKeyFactory.newsletters.all(),
            exact: false,
            refetchType: 'active',
          },
          {
            queryKey: ['unreadCount', 'all'],
            exact: false,
            refetchType: 'active',
          },
          {
            queryKey: queryKeyFactory.queue.all(),
            exact: false,
            refetchType: 'active',
          }
        );
        break;

      case 'toggle-like':
      case 'toggle-like-error':
        // Minimal invalidation for likes - only specific newsletters
        newsletterIds.forEach((id) => {
          invalidations.push({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
            refetchType: 'none', // Don't refetch, rely on optimistic updates
          });
        });
        break;

      case 'toggle-queue':
      case 'queue-add':
      case 'queue-remove':
        // Queue operations need queue and specific newsletter invalidation
        invalidations.push({
          queryKey: queryKeyFactory.queue.all(),
          exact: false,
          refetchType: 'active',
        });

        newsletterIds.forEach((id) => {
          invalidations.push({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
            refetchType: 'active',
          });
        });
        break;

      case 'tag-update':
        // Tag updates need tag queries and specific newsletters
        invalidations.push({
          queryKey: queryKeyFactory.newsletters.tags(),
          exact: false,
          refetchType: 'active',
        });

        newsletterIds.forEach((id) => {
          invalidations.push({
            queryKey: queryKeyFactory.newsletters.detail(id),
            exact: true,
            refetchType: 'active',
          });
        });
        break;

      case 'navigation':
        // For navigation between newsletters, prefetch instead of invalidate
        newsletterIds.forEach((id) => {
          // Only invalidate if data is stale
          const state = this.queryClient.getQueryState(queryKeyFactory.newsletters.detail(id));

          if (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt > 5 * 60 * 1000) {
            invalidations.push({
              queryKey: queryKeyFactory.newsletters.detail(id),
              exact: true,
              refetchType: 'active',
            });
          }
        });
        break;

      default:
        // Fallback with conservative invalidation
        this.log.warn('Unknown operation type for invalidation', {
          action: 'unknown_operation',
          metadata: { operationType, newsletterIds },
        });

        invalidations.push({
          queryKey: queryKeyFactory.newsletters.lists(),
          exact: false,
          refetchType: 'active',
        });
        break;
    }

    if (invalidations.length > 0) {
      await this.invalidateMultiple(invalidations);
    }
  }

  /**
   * Get pending invalidation count
   */
  getPendingCount(): number {
    return this.batchedInvalidations.requests.size;
  }

  /**
   * Check if there are pending invalidations
   */
  hasPending(): boolean {
    return this.batchedInvalidations.requests.size > 0;
  }

  /**
   * Clear all debounce timers
   */
  destroy(): void {
    this.clear();
    this.operationDebounceTimers.forEach((timer) => clearTimeout(timer));
    this.operationDebounceTimers.clear();
  }
}

// Singleton instance
let invalidatorInstance: OptimizedCacheInvalidator | null = null;

/**
 * Get or create the cache invalidator instance
 */
export const getCacheInvalidator = (
  queryClient: QueryClient,
  logger: ReturnType<typeof useLogger>
): OptimizedCacheInvalidator => {
  if (!invalidatorInstance) {
    invalidatorInstance = new OptimizedCacheInvalidator(queryClient, logger);
  }
  return invalidatorInstance;
};

/**
 * Convenience hook for using the cache invalidator
 */
export const useCacheInvalidator = (): OptimizedCacheInvalidator => {
  const queryClient = useQueryClient();
  const logger = useLogger('OptimizedCacheInvalidator');
  return getCacheInvalidator(queryClient, logger);
};

/**
 * Invalidate cache for a specific operation type with debouncing
 */
export const invalidateForOperation = (
  queryClient: QueryClient,
  operationType: string,
  newsletterIds: string[],
  debounceKey?: string,
  logger: ReturnType<typeof useLogger> = {
    debug: (message: string, context = {}) => console.debug(message, context),
    info: (message: string, context = {}) => console.info(message, context),
    warn: (message: string, context = {}, error?: Error) => console.warn(message, context, error),
    error: (message: string, context = {}, error?: Error) => console.error(message, context, error),
    auth: (message: string, context = {}) => console.log(message, context),
    api: (message: string, context = {}) => console.log(message, context),
    ui: (message: string, context = {}) => console.log(message, context),
    logUserAction: (action: string, context = {}) => console.log(action, context),
    logComponentError: (error: Error, context = {}) => console.error(error, context),
    startTimer: (_timerName: string) => () => {},
  }
): void => {
  const invalidator = getCacheInvalidator(queryClient, logger);
  invalidator.invalidateForOperation(operationType, newsletterIds, debounceKey);
};

/**
 * Convenience function for direct use in non-component contexts
 */
export const invalidateCache = async (
  queryClient: QueryClient,
  logger: ReturnType<typeof useLogger>,
  request: InvalidationRequest
): Promise<void> => {
  const invalidator = getCacheInvalidator(queryClient, logger);
  return invalidator.invalidate(request);
};
