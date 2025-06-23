import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SharedNewsletterActionHandlers } from '@common/utils/newsletterActionHandlers';
import { readingQueueApi } from '@common/api';
import { toast } from 'react-hot-toast';
import { getCacheManager } from '@common/utils/cacheUtils';
import type { NewsletterWithRelations } from '@common/types';

// Mock dependencies
vi.mock('@common/api', () => ({
  readingQueueApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@common/utils/cacheUtils', () => ({
  getCacheManager: vi.fn(() => ({
    optimisticUpdate: vi.fn(),
    updateNewsletterInCache: vi.fn(),
    invalidateRelatedQueries: vi.fn(),
  })),
}));

vi.mock('@common/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('NewsletterActionHandlers', () => {
  let handlers: SharedNewsletterActionHandlers;
  let mockHandlers: any;
  let mockCacheManager: any;
  let mockNewsletter: NewsletterWithRelations;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock cache manager
    mockCacheManager = {
      optimisticUpdate: vi.fn().mockResolvedValue(null),
      updateNewsletterInCache: vi.fn(),
      invalidateRelatedQueries: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getCacheManager).mockReturnValue(mockCacheManager);

    // Setup mock handlers
    mockHandlers = {
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAsUnread: vi.fn().mockResolvedValue(undefined),
      toggleLike: vi.fn().mockResolvedValue(undefined),
      toggleArchive: vi.fn().mockResolvedValue(undefined),
      deleteNewsletter: vi.fn().mockResolvedValue(undefined),
      toggleInQueue: vi.fn().mockResolvedValue(undefined),
      updateTags: vi.fn().mockResolvedValue(undefined),
      bulkMarkAsRead: vi.fn().mockResolvedValue(undefined),
      bulkMarkAsUnread: vi.fn().mockResolvedValue(undefined),
      bulkArchive: vi.fn().mockResolvedValue(undefined),
      bulkUnarchive: vi.fn().mockResolvedValue(undefined),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock newsletter
    mockNewsletter = {
      id: 'newsletter-1',
      title: 'Test Newsletter',
      is_archived: false,
      is_read: false,
      is_liked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      newsletter_source: null,
    } as NewsletterWithRelations;

    handlers = new SharedNewsletterActionHandlers(mockHandlers);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('toggleInQueue', () => {
    it('should add newsletter to queue when not in queue', async () => {
      // Arrange
      const isInQueue = false;
      vi.mocked(readingQueueApi.add).mockResolvedValue({
        id: 'queue-item-1',
        newsletter_id: mockNewsletter.id,
        created_at: new Date().toISOString(),
        user_id: 'user-1',
        updated_at: new Date().toISOString(),
      });

      // Act
      await handlers.toggleInQueue(mockNewsletter, isInQueue);

      // Assert
      expect(readingQueueApi.add).toHaveBeenCalledWith(mockNewsletter.id);
      expect(toast.success).toHaveBeenCalledWith('Added to reading queue');

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'toggle-queue'
      );
    });

    it('should remove newsletter from queue when in queue', async () => {
      // Arrange
      const isInQueue = true;
      const mockQueueItem = {
        id: 'queue-item-1',
        newsletter_id: mockNewsletter.id,
        created_at: new Date().toISOString(),
        user_id: 'user-1',
        updated_at: new Date().toISOString(),
      };

      vi.mocked(readingQueueApi.getAll).mockResolvedValue([mockQueueItem]);
      vi.mocked(readingQueueApi.remove).mockResolvedValue(undefined);

      // Act
      await handlers.toggleInQueue(mockNewsletter, isInQueue);

      // Assert
      expect(readingQueueApi.getAll).toHaveBeenCalled();
      expect(readingQueueApi.remove).toHaveBeenCalledWith('queue-item-1');
      expect(toast.success).toHaveBeenCalledWith('Removed from reading queue');

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'toggle-queue'
      );
    });

    it('should handle error when newsletter not found in queue', async () => {
      // Arrange
      const isInQueue = true;
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([]);

      // Act & Assert
      await expect(handlers.toggleInQueue(mockNewsletter, isInQueue)).rejects.toThrow(
        'Newsletter not found in reading queue'
      );

      expect(toast.error).toHaveBeenCalledWith(
        'Failed to update reading queue: Newsletter not found in reading queue'
      );
      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'toggle-queue-error'
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const isInQueue = false;
      const errorMessage = 'API Error';
      vi.mocked(readingQueueApi.add).mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(handlers.toggleInQueue(mockNewsletter, isInQueue)).rejects.toThrow(errorMessage);

      expect(toast.error).toHaveBeenCalledWith(`Failed to update reading queue: ${errorMessage}`);
      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'toggle-queue-error'
      );
    });

    it('should respect showToasts option', async () => {
      // Arrange
      const isInQueue = false;
      vi.mocked(readingQueueApi.add).mockResolvedValue({
        id: 'queue-item-1',
        newsletter_id: mockNewsletter.id,
        created_at: new Date().toISOString(),
        user_id: 'user-1',
        updated_at: new Date().toISOString(),
      });

      // Act
      await handlers.toggleInQueue(mockNewsletter, isInQueue, { showToasts: false });

      // Assert
      expect(readingQueueApi.add).toHaveBeenCalledWith(mockNewsletter.id);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should call onSuccess callback when provided', async () => {
      // Arrange
      const isInQueue = false;
      const onSuccess = vi.fn();
      vi.mocked(readingQueueApi.add).mockResolvedValue({
        id: 'queue-item-1',
        newsletter_id: mockNewsletter.id,
        created_at: new Date().toISOString(),
        user_id: 'user-1',
        updated_at: new Date().toISOString(),
      });

      // Act
      await handlers.toggleInQueue(mockNewsletter, isInQueue, { onSuccess });

      // Assert
      expect(onSuccess).toHaveBeenCalledWith(mockNewsletter);
    });
  });

  describe('toggleArchive', () => {
    it('should archive newsletter when not archived', async () => {
      // Arrange
      mockNewsletter.is_archived = false;
      mockCacheManager.optimisticUpdate.mockResolvedValue(mockNewsletter);

      // Act
      await handlers.toggleArchive(mockNewsletter);

      // Assert
      expect(mockCacheManager.optimisticUpdate).toHaveBeenCalledWith(
        mockNewsletter.id,
        { is_archived: true },
        'archive'
      );
      expect(mockHandlers.toggleArchive).toHaveBeenCalledWith(mockNewsletter.id);
      expect(toast.success).toHaveBeenCalledWith('Newsletter archived');
    });

    it('should unarchive newsletter when archived', async () => {
      // Arrange
      mockNewsletter.is_archived = true;
      mockCacheManager.optimisticUpdate.mockResolvedValue(mockNewsletter);

      // Act
      await handlers.toggleArchive(mockNewsletter);

      // Assert
      expect(mockCacheManager.optimisticUpdate).toHaveBeenCalledWith(
        mockNewsletter.id,
        { is_archived: false },
        'unarchive'
      );
      expect(mockHandlers.toggleArchive).toHaveBeenCalledWith(mockNewsletter.id);
      expect(toast.success).toHaveBeenCalledWith('Newsletter unarchived');
    });

    it('should revert optimistic update on error', async () => {
      // Arrange
      const originalNewsletter = { ...mockNewsletter };
      mockCacheManager.optimisticUpdate.mockResolvedValue(originalNewsletter);
      mockHandlers.toggleArchive.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(handlers.toggleArchive(mockNewsletter)).rejects.toThrow('API Error');

      expect(mockCacheManager.updateNewsletterInCache).toHaveBeenCalledWith({
        id: mockNewsletter.id,
        updates: originalNewsletter,
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to archive: API Error');
    });

    it('should force refresh if revert fails', async () => {
      // Arrange
      const originalNewsletter = { ...mockNewsletter };
      mockCacheManager.optimisticUpdate.mockResolvedValue(originalNewsletter);
      // Make updateNewsletterInCache throw synchronously
      mockCacheManager.updateNewsletterInCache.mockImplementation(() => {
        throw new Error('Cache Error');
      });
      mockCacheManager.invalidateRelatedQueries.mockResolvedValue(undefined);
      mockHandlers.toggleArchive.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      try {
        await handlers.toggleArchive(mockNewsletter);
      } catch (error) {
        // Expected to throw
        expect(error).toEqual(new Error('API Error'));
      }

      // Verify revert was attempted
      expect(mockCacheManager.updateNewsletterInCache).toHaveBeenCalledWith({
        id: mockNewsletter.id,
        updates: originalNewsletter,
      });

      // The invalidateRelatedQueries call happens when revert fails
      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'error-recovery'
      );
    });

    it('should dispatch custom event on success', async () => {
      // Arrange
      vi.useFakeTimers();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      mockCacheManager.optimisticUpdate.mockResolvedValue(mockNewsletter);

      // Act
      await handlers.toggleArchive(mockNewsletter);

      // Wait for setTimeout
      await vi.runAllTimersAsync();

      // Assert
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'newsletter:archived',
        })
      );

      vi.useRealTimers();
    });

    it('should call onSuccess callback when provided', async () => {
      // Arrange
      const onSuccess = vi.fn();
      mockCacheManager.optimisticUpdate.mockResolvedValue(mockNewsletter);

      // Act
      await handlers.toggleArchive(mockNewsletter, { onSuccess });

      // Assert
      expect(onSuccess).toHaveBeenCalledWith(mockNewsletter);
    });

    it('should call onError callback on failure', async () => {
      // Arrange
      const onError = vi.fn();
      const error = new Error('API Error');
      mockHandlers.toggleArchive.mockRejectedValue(error);

      // Act & Assert
      await expect(handlers.toggleArchive(mockNewsletter, { onError })).rejects.toThrow(
        'API Error'
      );

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should work without optimistic updates', async () => {
      // Arrange
      handlers = new SharedNewsletterActionHandlers(mockHandlers, { optimisticUpdates: false });

      // Act
      await handlers.toggleArchive(mockNewsletter);

      // Assert
      expect(mockCacheManager.optimisticUpdate).not.toHaveBeenCalled();
      expect(mockHandlers.toggleArchive).toHaveBeenCalledWith(mockNewsletter.id);
      expect(toast.success).toHaveBeenCalledWith('Newsletter archived');
    });
  });

  describe('Edge Cases', () => {
    it('should handle cache invalidation timeout correctly', async () => {
      // Arrange
      vi.useFakeTimers();
      mockCacheManager.optimisticUpdate.mockResolvedValue(mockNewsletter);

      // Act
      await handlers.toggleArchive(mockNewsletter);

      // Assert - cache invalidation should be scheduled
      expect(mockCacheManager.invalidateRelatedQueries).not.toHaveBeenCalled();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(100);

      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        [mockNewsletter.id],
        'archive'
      );

      vi.useRealTimers();
    });

    it('should handle null/undefined newsletter gracefully', async () => {
      // Act & Assert
      await expect(handlers.toggleInQueue(null as any, false)).rejects.toThrow();
    });

    it('should handle missing newsletter ID', async () => {
      // Arrange
      const newsletterWithoutId = { ...mockNewsletter, id: undefined } as any;
      vi.mocked(readingQueueApi.add).mockRejectedValue(new Error('Newsletter ID is required'));

      // Act & Assert
      await expect(handlers.toggleInQueue(newsletterWithoutId, false)).rejects.toThrow(
        'Newsletter ID is required'
      );
    });
  });
});
