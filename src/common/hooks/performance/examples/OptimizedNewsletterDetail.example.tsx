import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  useNewsletterDetail,
  useSharedNewsletterActions,
  useOptimizedNewsletterNavigation,
  useCacheInvalidation,
  useTypedCacheInvalidation,
  useComponentOptimizations,
  usePerformanceMonitor,
} from '@common/hooks';
import { useLogger } from '@common/utils/logger/useLogger';
import type { NewsletterWithRelations } from '@common/types';

/**
 * Example implementation of an optimized newsletter detail component
 * Demonstrates best practices for performance optimization
 */
export const OptimizedNewsletterDetail: React.FC = () => {
  const { id: newsletterId } = useParams<{ id: string }>();
  const log = useLogger('OptimizedNewsletterDetail');

  // Performance monitoring
  const { startRender, endRender, getMetrics } = usePerformanceMonitor('NewsletterDetail');
  const { renderCount, addCleanup } = useComponentOptimizations('NewsletterDetail');

  // Initialize optimized cache invalidation
  const {
    invalidateByOperation,
    getMetrics: getCacheMetrics,
    flush: flushCache,
  } = useCacheInvalidation({
    batchDelay: 100,
    debounceDelay: 500,
    enableLogging: process.env.NODE_ENV === 'development',
  });

  // Type-safe cache invalidation
  const _typedCache = useTypedCacheInvalidation();

  // Optimized navigation with keyboard and swipe support
  const navigation = useOptimizedNewsletterNavigation(newsletterId || null, {
    debounceDelay: 300,
    enablePreloading: true,
    enableKeyboard: true,
    enableSwipe: true,
    swipeThreshold: 50,
    onNavigationStart: (id) => {
      log.debug('Navigation starting', {
        action: 'navigation_start',
        metadata: { newsletterId: id },
      });
    },
    onNavigationComplete: (id) => {
      log.debug('Navigation complete', {
        action: 'navigation_complete',
        metadata: { newsletterId: id },
      });
    },
  });

  // Fetch newsletter details with caching
  const {
    data: newsletter,
    isLoading,
    error,
  } = useNewsletterDetail(newsletterId || '', {
    enabled: !!newsletterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Shared actions with optimized cache invalidation
  const { handleArchive, handleLike, handleMarkRead, handleAddTag, handleRemoveTag, isUpdating } =
    useSharedNewsletterActions();

  // Optimized archive handler
  const handleOptimizedArchive = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        startRender();

        // Perform the archive action
        await handleArchive(newsletter);

        // Use operation-based invalidation for smart cache updates
        await invalidateByOperation(
          newsletter.is_archived ? 'newsletter-unarchive' : 'newsletter-archive',
          newsletter.id
        );

        endRender();

        // Log performance metrics in development
        if (process.env.NODE_ENV === 'development') {
          const metrics = getMetrics();
          log.debug('Archive operation completed', {
            action: 'archive_complete',
            metadata: {
              renderTime: metrics.renderTime.toFixed(2),
              averageRenderTime: metrics.averageRenderTime.toFixed(2),
            },
          });
        }
      } catch (error) {
        log.error(
          'Archive operation failed',
          {
            action: 'archive_error',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleArchive, invalidateByOperation, startRender, endRender, getMetrics, log]
  );

  // Optimized like handler
  const handleOptimizedLike = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        await handleLike(newsletter);

        // Use operation-based invalidation
        await invalidateByOperation(
          newsletter.is_liked ? 'newsletter-unlike' : 'newsletter-like',
          newsletter.id
        );
      } catch (error) {
        log.error(
          'Like operation failed',
          {
            action: 'like_error',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleLike, invalidateByOperation, log]
  );

  // Optimized mark read handler
  const handleOptimizedMarkRead = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        await handleMarkRead(newsletter);

        // Use specific invalidation for read status
        await invalidateByOperation(
          newsletter.is_read ? 'newsletter-mark-unread' : 'newsletter-mark-read',
          newsletter.id
        );
      } catch (error) {
        log.error(
          'Mark read operation failed',
          {
            action: 'mark_read_error',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleMarkRead, invalidateByOperation, log]
  );

  // Optimized tag operations
  const _handleOptimizedAddTag = useCallback(
    async (tagId: string) => {
      if (!newsletter) return;

      try {
        await handleAddTag(newsletter.id, tagId);

        // Use operation-based invalidation for tags
        await invalidateByOperation('newsletter-tag-add', newsletter.id);
      } catch (error) {
        log.error(
          'Add tag operation failed',
          {
            action: 'add_tag_error',
            metadata: { newsletterId: newsletter.id, tagId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [newsletter, handleAddTag, invalidateByOperation, log]
  );

  const handleOptimizedRemoveTag = useCallback(
    async (tagId: string) => {
      if (!newsletter) return;

      try {
        await handleRemoveTag(newsletter.id, tagId);

        // Use operation-based invalidation for tags
        await invalidateByOperation('newsletter-tag-remove', newsletter.id);
      } catch (error) {
        log.error(
          'Remove tag operation failed',
          {
            action: 'remove_tag_error',
            metadata: { newsletterId: newsletter.id, tagId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [newsletter, handleRemoveTag, invalidateByOperation, log]
  );

  // Cleanup and performance optimization
  useEffect(() => {
    // Add cleanup for pending cache operations
    addCleanup(() => {
      flushCache();
    });

    return () => {
      // Log cache metrics on unmount in development
      if (process.env.NODE_ENV === 'development') {
        const cacheMetrics = getCacheMetrics();
        log.debug('Component unmounting - Cache metrics', {
          action: 'component_unmount',
          metadata: cacheMetrics,
        });
      }
    };
  }, [addCleanup, flushCache, getCacheMetrics, log]);

  // Log render count in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && renderCount % 10 === 0) {
      log.debug('Render count milestone', {
        action: 'render_count',
        metadata: { renderCount },
      });
    }
  }, [renderCount, log]);

  // Navigation helpers
  const handleNavigatePrevious = useCallback(() => {
    navigation.navigateToPrevious();
  }, [navigation]);

  const handleNavigateNext = useCallback(() => {
    navigation.navigateToNext();
  }, [navigation]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error loading newsletter</div>
      </div>
    );
  }

  // No newsletter found
  if (!newsletter) {
    return (
      <div className="flex items-center justify-center h-full">
        <div>Newsletter not found</div>
      </div>
    );
  }

  return (
    <div className="newsletter-detail optimized">
      {/* Navigation Bar */}
      <div className="navigation-bar flex items-center justify-between p-4 border-b">
        <button
          onClick={handleNavigatePrevious}
          disabled={!navigation.navigationState.hasPrevious || navigation.isNavigating}
          className="btn btn-secondary"
          aria-label="Previous newsletter"
        >
          Previous
        </button>

        <div className="navigation-info text-sm text-gray-600">
          {navigation.navigationState.currentIndex + 1} of {navigation.navigationState.totalCount}
        </div>

        <button
          onClick={handleNavigateNext}
          disabled={!navigation.navigationState.hasNext || navigation.isNavigating}
          className="btn btn-secondary"
          aria-label="Next newsletter"
        >
          Next
        </button>
      </div>

      {/* Newsletter Content */}
      <div className="newsletter-content p-6">
        <h1 className="text-2xl font-bold mb-4">{newsletter.title}</h1>

        {/* Action Buttons */}
        <div className="actions flex gap-2 mb-4">
          <button
            onClick={() => handleOptimizedArchive(newsletter)}
            disabled={isUpdating}
            className={`btn ${newsletter.is_archived ? 'btn-warning' : 'btn-secondary'}`}
          >
            {newsletter.is_archived ? 'Unarchive' : 'Archive'}
          </button>

          <button
            onClick={() => handleOptimizedLike(newsletter)}
            disabled={isUpdating}
            className={`btn ${newsletter.is_liked ? 'btn-danger' : 'btn-secondary'}`}
          >
            {newsletter.is_liked ? 'Unlike' : 'Like'}
          </button>

          <button
            onClick={() => handleOptimizedMarkRead(newsletter)}
            disabled={isUpdating}
            className={`btn ${newsletter.is_read ? 'btn-info' : 'btn-primary'}`}
          >
            {newsletter.is_read ? 'Mark Unread' : 'Mark Read'}
          </button>
        </div>

        {/* Tags */}
        <div className="tags mb-4">
          <h3 className="text-sm font-semibold mb-2">Tags:</h3>
          <div className="flex flex-wrap gap-2">
            {newsletter.tags?.map((tag) => (
              <span key={tag.id} className="tag bg-gray-200 px-2 py-1 rounded text-sm">
                {tag.name}
                <button
                  onClick={() => handleOptimizedRemoveTag(tag.id)}
                  className="ml-2 text-red-500 hover:text-red-700"
                  aria-label={`Remove ${tag.name} tag`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Newsletter Body */}
        <div className="newsletter-body prose max-w-none">
          <div
            dangerouslySetInnerHTML={{ __html: newsletter.content || newsletter.summary || '' }}
          />
        </div>
      </div>

      {/* Performance Metrics (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="performance-metrics fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs">
          <div>Render #{renderCount}</div>
          <div>Navigation: {navigation.metrics.totalNavigations} total</div>
          <div>Cache: {getCacheMetrics().totalInvalidations} invalidations</div>
        </div>
      )}
    </div>
  );
};

/**
 * Example of using the optimized newsletter detail in a route
 */
export const NewsletterDetailRoute: React.FC = () => {
  return (
    <div className="newsletter-detail-container h-full">
      <OptimizedNewsletterDetail />
    </div>
  );
};
