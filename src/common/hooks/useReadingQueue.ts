import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterService, readingQueueService } from '@common/services';
import type { ReadingQueueItem } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import { updateNewsletterTags } from '@common/utils/tagUtils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useContext, useMemo, useRef } from 'react';
import { getCacheManagerSafe } from '../utils/cacheUtils';
import { queryKeyFactory } from '../utils/queryKeyFactory';

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Safe cache manager helper
  const safeCacheCall = useCallback(
    (fn: (manager: NonNullable<ReturnType<typeof getCacheManagerSafe>>) => void) => {
      if (cacheManager) {
        fn(cacheManager);
      }
    },
    [cacheManager]
  );

  // Performance monitoring
  const performanceTimers = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((operation: string) => {
    performanceTimers.current.set(operation, performance.now());
  }, []);

  const endTimer = useCallback(
    (operation: string) => {
      const start = performanceTimers.current.get(operation);
      if (start && process.env.NODE_ENV === 'development') {
        const duration = performance.now() - start;
        log.debug('Reading queue operation completed', {
          action: 'performance_timer',
          metadata: {
            operation,
            duration: duration.toFixed(2),
            unit: 'ms',
          },
        });
        performanceTimers.current.delete(operation);
      }
    },
    [log]
  );

  // Helper function to fetch reading queue
  const fetchReadingQueue = useCallback(async (): Promise<ReadingQueueItem[]> => {
    try {
      return await readingQueueService.getAll();
    } catch (error) {
      log.error(
        'Failed to fetch reading queue',
        {
          action: 'fetch_reading_queue',
          metadata: { userId: user?.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );

      // Handle specific error types
      if (error instanceof Error) {
        // If it's a null newsletter error, it means data integrity issues
        if (error.message.includes('not found in reading queue item')) {
          log.warn('Data integrity issue in reading queue', {
            action: 'data_integrity_check',
            metadata: {
              userId: user?.id,
              issue: 'missing_newsletter_in_queue_item',
              resolution: 'returning_empty_queue',
            },
          });
          // Could potentially trigger a cleanup here if needed
          return [];
        }

        // If it's a network/auth error, re-throw to let React Query handle retries
        if (
          error.message.includes('JWT') ||
          error.message.includes('auth') ||
          error.message.includes('network')
        ) {
          throw error;
        }
      }

      // For other errors, return empty array to prevent UI breaks
      return [];
    }
  }, [log, user?.id]);

  // Query for reading queue
  const {
    data: readingQueue = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ReadingQueueItem[], Error>({
    queryKey: queryKeyFactory.queue.list(user?.id || ''),
    queryFn: () => fetchReadingQueue(),
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on data integrity errors
      if (error instanceof Error && error.message.includes('not found in reading queue item')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      startTimer('addToQueue');
      try {
        return await readingQueueService.add(newsletterId);
      } finally {
        endTimer('addToQueue');
      }
    },
    onMutate: async (newsletterId) => {
      if (!user?.id) return;

      // Snapshot the previous queue
      const previousQueue = readingQueue;

      // Use cache manager for optimistic update
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: 'add',
          newsletterId,
          userId: user.id,
        })
      );

      return { previousQueue };
    },
    onError: (error, _newsletterId, context) => {
      log.error(
        'Failed to add newsletter to reading queue',
        {
          action: 'add_to_queue',
          metadata: {
            newsletterId: _newsletterId,
            userId: user?.id,
            hasContext: !!context?.previousQueue,
          },
        },
        error
      );

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: 'revert',
            queueItems: context.previousQueue,
            userId: user.id,
          })
        );
      }
    },
    onSuccess: (_data) => {
      if (!user) return;

      // Reading queue status is now managed separately from newsletter properties
    },
    onSettled: () => {
      if (!user) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-add'));
    },
  });

  // Remove from reading queue
  const removeFromQueue = useMutation({
    mutationFn: async (queueItemId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      startTimer('removeFromQueue');
      try {
        return await readingQueueService.remove(queueItemId);
      } finally {
        endTimer('removeFromQueue');
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
          type: 'remove',
          queueItemId,
          userId: user.id,
        })
      );

      return { previousQueue, removedItem: itemToRemove };
    },
    onError: (error, _queueItemId, context) => {
      log.error(
        'Failed to remove newsletter from reading queue',
        {
          action: 'remove_from_queue',
          metadata: {
            queueItemId: _queueItemId,
            userId: user?.id,
            hasContext: !!context?.previousQueue,
          },
        },
        error
      );

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: 'revert',
            queueItems: context.previousQueue,
            userId: user.id,
          })
        );
      }
    },
    onSuccess: (_data, _queueItemId, context) => {
      if (!user || !context?.removedItem) return;

      // Reading queue status is now managed separately from newsletter properties
    },
    onSettled: () => {
      if (!user) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-remove'));
    },
  });

  // Reorder reading queue
  const reorderQueue = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      if (!user) throw new Error('User not authenticated');

      startTimer('reorderQueue');
      try {
        return await readingQueueService.reorder(updates);
      } finally {
        endTimer('reorderQueue');
      }
    },
    onMutate: async (updates) => {
      if (!user?.id) return;

      // Snapshot the previous queue
      const previousQueue = readingQueue;

      // Use cache manager for optimistic reordering
      safeCacheCall((manager) =>
        manager.updateReadingQueueInCache({
          type: 'reorder',
          updates,
          userId: user.id,
        })
      );

      return { previousQueue };
    },
    onError: (error, _updates, context) => {
      log.error(
        'Failed to reorder reading queue',
        {
          action: 'reorder_queue',
          metadata: {
            userId: user?.id,
            updatesCount: _updates?.length || 0,
            hasContext: !!context?.previousQueue,
          },
        },
        error
      );

      // Revert optimistic update using cache manager
      if (context?.previousQueue && user?.id) {
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: 'revert',
            queueItems: context.previousQueue,
            userId: user.id,
          })
        );
      }
    },
    onSettled: () => {
      if (!user?.id) return;
      // Use cache manager for smart invalidation
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-reorder'));
    },
  });

  // Clear entire reading queue
  const clearQueue = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      return readingQueueService.clear();
    },
    onSuccess: () => {
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-clear'));
    },
  });

  // Mark newsletter as read
  const markAsRead = useMutation({
    mutationFn: async (newsletterId: string) => {
      return newsletterService.markAsRead(newsletterId);
    },
    onSuccess: () => {
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-mark-read'));
    },
  });

  // Mark newsletter as unread
  const markAsUnread = useMutation({
    mutationFn: async (newsletterId: string) => {
      return newsletterService.markAsUnread(newsletterId);
    },
    onSuccess: () => {
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-mark-unread'));
    },
  });

  // Update tags
  const updateTags = useMutation({
    mutationFn: async ({ newsletterId, tagIds }: { newsletterId: string; tagIds: string[] }) => {
      if (!user?.id) throw new Error('User not authenticated');

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
          type: 'updateTags',
          newsletterId,
          tagIds,
          userId: user?.id || '',
        })
      );

      return { previousQueue };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        // Revert using cache manager
        safeCacheCall((manager) =>
          manager.updateReadingQueueInCache({
            type: 'revert',
            queueItems: context.previousQueue,
            userId: user?.id || '',
          })
        );
      }
    },
    onSettled: () => {
      // Use cache manager for smart invalidation
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-update-tags'));
    },
  });

  // Cleanup orphaned items
  const cleanupOrphanedItems = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      return readingQueueService.cleanupOrphanedItems();
    },
    onSuccess: (result) => {
      if (result.removedCount > 0) {
        log.info('Cleaned up orphaned reading queue items', {
          action: 'cleanup_orphaned_items',
          metadata: {
            removedCount: result.removedCount,
            userId: user?.id,
          },
        });
        // Refetch the queue to get the updated state
        refetch();
      }
    },
    onError: (error) => {
      log.error(
        'Failed to cleanup orphaned reading queue items',
        {
          action: 'cleanup_orphaned_items',
          metadata: { userId: user?.id },
        },
        error
      );
    },
    onSettled: () => {
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'queue-cleanup'));
    },
  });

  // Check if newsletter is in queue
  const isInQueue = useCallback(
    async (newsletterId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        return await readingQueueService.isInQueue(newsletterId);
      } catch (error) {
        log.error(
          'Failed to check if newsletter is in queue',
          {
            action: 'check_is_in_queue',
            metadata: { newsletterId, userId: user.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    },
    [user, log]
  );

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
    cleanupOrphanedItems: cleanupOrphanedItems.mutateAsync,
    isInQueue,

    // Loading states
    isAdding: addToQueue.isPending,
    isRemoving: removeFromQueue.isPending,
    isReordering: reorderQueue.isPending,
    isClearing: clearQueue.isPending,
    isMarkingAsRead: markAsRead.isPending,
    isMarkingAsUnread: markAsUnread.isPending,
    isUpdatingTags: updateTags.isPending,
    isCleaningUp: cleanupOrphanedItems.isPending,

    // Utils
    refetch,
  };
};
