import { useEffect } from 'react';
import { ReadingQueueItem, User } from '@common/types';
import { CacheManager } from '@common/utils/cacheUtils'; // Assuming CacheManager type is exported

export const useReadingQueueCacheOptimizer = (
  cacheManager: CacheManager | null,
  user: User | null | undefined,
  readingQueue: ReadingQueueItem[]
) => {
  useEffect(() => {
    if (cacheManager && user?.id && readingQueue) {
      // Warm up critical caches for better performance
      cacheManager.warmCache(user.id, 'high');

      // Pre-warm newsletter details for queue items
      if (readingQueue.length > 0) {
        // Batch pre-load first 5 newsletters for instant access
        const newsletterIds = readingQueue.slice(0, 5).map((item) => item.newsletter_id);

        if (newsletterIds.length > 0) {
          setTimeout(() => {
            cacheManager.batchInvalidateQueries([
              {
                type: 'newsletter-detail',
                ids: newsletterIds,
              },
            ]);
          }, 100);
        }

        // Pre-load next batch in background
        if (readingQueue.length > 5) {
          const nextBatchIds = readingQueue.slice(5, 10).map((item) => item.newsletter_id);
          if (nextBatchIds.length > 0) {
            setTimeout(() => {
              cacheManager.batchInvalidateQueries([
                {
                  type: 'newsletter-detail',
                  ids: nextBatchIds,
                },
              ]);
            }, 500);
          }
        }
      }
    }
  }, [cacheManager, user?.id, readingQueue]); // Ensure user.id is in dependency array if user can change
};
