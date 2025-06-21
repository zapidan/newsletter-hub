import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newsletterApi } from '../../api/newsletterApi';
import { readingQueueApi } from '../../api/readingQueueApi';
import type { NewsletterWithRelations, ReadingQueueItem } from '../../types';
import {
  ReadingQueueService,
  readingQueueService,
  readingQueueService as service1,
  readingQueueService as service2,
} from '../readingQueue/ReadingQueueService';

// Mock the APIs
vi.mock('../../api/readingQueueApi', () => ({
  readingQueueApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    reorder: vi.fn(),
    cleanupOrphanedItems: vi.fn(),
  },
}));

vi.mock('../../api/newsletterApi', () => ({
  newsletterApi: {
    getById: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockReadingQueueApi = vi.mocked(readingQueueApi);
const mockNewsletterApi = vi.mocked(newsletterApi);

describe('ReadingQueueService', () => {
  let service: ReadingQueueService;

  const mockQueueItem: ReadingQueueItem = {
    id: 'queue-1',
    user_id: 'user-1',
    newsletter_id: 'newsletter-1',
    position: 1,
    added_at: '2024-01-01T00:00:00Z',
    newsletter: {
      id: 'newsletter-1',
      title: 'Test Newsletter',
      content: 'Test content',
      summary: 'Test summary',
      is_read: false,
      is_liked: false,
      is_archived: false,
      received_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: 'user-1',
      newsletter_source_id: 'source-1',
      tags: [],
      source: null,
      word_count: 100,
      estimated_read_time: 5,
      image_url: '',
    },
  };

  const mockNewsletter: NewsletterWithRelations = {
    id: 'newsletter-1',
    title: 'Test Newsletter',
    content: 'Test content',
    summary: 'Test summary',
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_id: 'user-1',
    newsletter_source_id: 'source-1',
    tags: [],
    source: null,
    word_count: 100,
    estimated_read_time: 5,
    image_url: '',
  };

  beforeEach(() => {
    service = new ReadingQueueService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getReadingQueue', () => {
    it('should return all items in reading queue', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);

      const result = await service.getReadingQueue();

      expect(result).toEqual(mockItems);
      expect(mockReadingQueueApi.getAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty queue', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.getReadingQueue();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockReadingQueueApi.getAll.mockRejectedValue(error);

      await expect(service.getReadingQueue()).rejects.toThrow('API Error');
    });
  });

  describe('getReadingQueueWithDetails', () => {
    it('should return queue with newsletter details', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);

      const result = await service.getReadingQueueWithDetails();

      expect(result).toEqual([mockNewsletter]);
      expect(mockReadingQueueApi.getAll).toHaveBeenCalledTimes(1);
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith('newsletter-1');
    });

    it('should skip newsletters that cannot be found', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockNewsletterApi.getById.mockResolvedValue(null);

      const result = await service.getReadingQueueWithDetails();

      expect(result).toEqual([]);
    });
  });

  describe('addToQueue', () => {
    it('should successfully add newsletter to queue', async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.getAll.mockResolvedValue([]); // No existing items
      mockReadingQueueApi.add.mockResolvedValue(mockQueueItem);

      const result = await service.addToQueue('newsletter-1');

      expect(result.success).toBe(true);
      expect(result.item).toEqual(mockQueueItem);
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith('newsletter-1');
      expect(mockReadingQueueApi.add).toHaveBeenCalledWith('newsletter-1');
    });

    it('should fail if newsletter is not found', async () => {
      mockNewsletterApi.getById.mockResolvedValue(null);

      const result = await service.addToQueue('newsletter-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Newsletter not found');
      expect(mockReadingQueueApi.add).not.toHaveBeenCalled();
    });

    it('should fail if newsletter is archived', async () => {
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };
      mockNewsletterApi.getById.mockResolvedValue(archivedNewsletter);

      const result = await service.addToQueue('newsletter-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot add archived newsletter to reading queue');
      expect(mockReadingQueueApi.add).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.getAll.mockResolvedValue([]);
      mockReadingQueueApi.add.mockRejectedValue(new Error('Add failed'));

      const result = await service.addToQueue('newsletter-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Add failed');
    });

    it('should validate newsletter ID', async () => {
      await expect(service.addToQueue('')).rejects.toThrow();
      await expect(service.addToQueue(null as any)).rejects.toThrow();
    });
  });

  describe('removeFromQueue', () => {
    it('should successfully remove newsletter from queue', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.remove.mockResolvedValue(true);

      const result = await service.removeFromQueue('newsletter-1');

      expect(result.success).toBe(true);
      expect(mockReadingQueueApi.remove).toHaveBeenCalledWith('queue-1');
    });

    it('should fail if item is not in queue', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.removeFromQueue('newsletter-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Newsletter is not in reading queue');
      expect(mockReadingQueueApi.remove).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.remove.mockRejectedValue(new Error('Remove failed'));

      const result = await service.removeFromQueue('newsletter-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Remove failed');
    });
  });

  describe('bulkAddToQueue', () => {
    it('should successfully add multiple newsletters', async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.getAll.mockResolvedValue([]); // No existing items
      mockReadingQueueApi.add.mockResolvedValue(mockQueueItem);

      const result = await service.bulkAddToQueue(['newsletter-1', 'newsletter-2']);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockReadingQueueApi.add).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      mockNewsletterApi.getById.mockResolvedValueOnce(mockNewsletter).mockResolvedValueOnce(null);
      mockReadingQueueApi.getAll.mockResolvedValue([]); // No existing items
      mockReadingQueueApi.add.mockResolvedValue(mockQueueItem);

      const result = await service.bulkAddToQueue(['newsletter-1', 'newsletter-2']);

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should validate input array', async () => {
      await expect(service.bulkAddToQueue([])).rejects.toThrow();
      await expect(service.bulkAddToQueue(null as any)).rejects.toThrow();
    });
  });

  describe('clearQueue', () => {
    it('should successfully clear non-empty queue', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.clear.mockResolvedValue(true);

      const result = await service.clearQueue();

      expect(result.success).toBe(true);
      expect(mockReadingQueueApi.clear).toHaveBeenCalledTimes(1);
    });

    it('should handle empty queue', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.clearQueue();

      expect(result.success).toBe(true);
      expect(result.error).toBe('Reading queue is already empty');
      expect(mockReadingQueueApi.clear).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.clear.mockRejectedValue(new Error('Clear failed'));

      const result = await service.clearQueue();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clear failed');
    });
  });

  describe('reorderQueue', () => {
    it('should successfully reorder queue items', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.reorder.mockResolvedValue(true);

      const result = await service.reorderQueue(['newsletter-1']);

      expect(result.success).toBe(true);
      expect(mockReadingQueueApi.reorder).toHaveBeenCalledWith([{ id: 'queue-1', position: 1 }]);
    });

    it('should fail if newsletter is not in queue', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.reorderQueue(['newsletter-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Newsletter newsletter-1 not found in reading queue');
      expect(mockReadingQueueApi.reorder).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.reorder.mockRejectedValue(new Error('Reorder failed'));

      const result = await service.reorderQueue(['newsletter-1']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reorder failed');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);

      const result = await service.getQueueStats();

      expect(result.totalItems).toBe(1);
      expect(result.unreadItems).toBe(1);
      expect(result.estimatedReadTime).toBe(5);
      expect(result.averageReadTime).toBe(5);
    });

    it('should handle empty queue stats', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.getQueueStats();

      expect(result.totalItems).toBe(0);
      expect(result.unreadItems).toBe(0);
      expect(result.estimatedReadTime).toBe(0);
      expect(result.averageReadTime).toBe(0);
    });
  });

  describe('autoCleanup', () => {
    it('should skip cleanup when disabled', async () => {
      const serviceWithoutCleanup = new ReadingQueueService({ autoRemoveRead: false });

      const result = await serviceWithoutCleanup.autoCleanup();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(0);
      expect(mockReadingQueueApi.getAll).not.toHaveBeenCalled();
    });

    it('should remove read newsletters when enabled', async () => {
      const serviceWithCleanup = new ReadingQueueService({ autoRemoveRead: true });
      const readNewsletter = { ...mockNewsletter, is_read: true };

      mockReadingQueueApi.getAll.mockResolvedValue([mockQueueItem]);
      mockNewsletterApi.getById.mockResolvedValue(readNewsletter);
      mockReadingQueueApi.remove.mockResolvedValue(true);

      const result = await serviceWithCleanup.autoCleanup();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(mockReadingQueueApi.remove).toHaveBeenCalledWith('queue-1');
    });
  });

  describe('isInQueue', () => {
    it('should return true if newsletter is in queue', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);

      const result = await service.isInQueue('newsletter-1');

      expect(result).toBe(true);
    });

    it('should return false if newsletter is not in queue', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue([]);

      const result = await service.isInQueue('newsletter-1');

      expect(result).toBe(false);
    });

    it('should validate newsletter ID', async () => {
      await expect(service.isInQueue('')).rejects.toThrow();
    });
  });

  describe('alias methods', () => {
    it('should provide getAll alias', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);

      const result = await service.getAll();

      expect(result).toEqual(mockItems);
    });

    it('should provide add alias', async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.getAll.mockResolvedValue([]); // No existing items
      mockReadingQueueApi.add.mockResolvedValue(mockQueueItem);

      const result = await service.add('newsletter-1');

      expect(result).toBe(true);
    });

    it('should provide remove alias', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.remove.mockResolvedValue(true);

      const result = await service.remove('queue-1');

      expect(result).toBe(true);
    });

    it('should provide clear alias', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.clear.mockResolvedValue(true);

      const result = await service.clear();

      expect(result).toBe(true);
    });

    it('should provide reorder alias', async () => {
      const mockItems = [mockQueueItem];
      mockReadingQueueApi.getAll.mockResolvedValue(mockItems);
      mockReadingQueueApi.reorder.mockResolvedValue(true);

      const updates = [{ id: 'queue-1', position: 1 }];
      const result = await service.reorder(updates);

      expect(result).toBe(true);
    });

    it('should provide cleanupOrphanedItems alias', async () => {
      const serviceWithCleanup = new ReadingQueueService({ autoRemoveRead: false });

      const result = await serviceWithCleanup.cleanupOrphanedItems();

      expect(result.removedCount).toBe(0);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(readingQueueService).toBeInstanceOf(ReadingQueueService);
    });

    it('should be the same instance when imported multiple times', async () => {
      expect(service1).toBe(service2);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      mockReadingQueueApi.getAll.mockRejectedValue(timeoutError);

      await expect(service.getReadingQueue()).rejects.toThrow('Network timeout');
    });

    it('should handle validation errors', async () => {
      await expect(service.addToQueue('')).rejects.toThrow();
      await expect(service.removeFromQueue('')).rejects.toThrow();
      await expect(service.isInQueue('')).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      mockReadingQueueApi.getAll.mockResolvedValue(null as any);

      await expect(service.getReadingQueue()).rejects.toThrow();
    });
  });

  describe('performance considerations', () => {
    it('should handle large queues efficiently', async () => {
      const largeQueue = Array.from({ length: 100 }, (_, i) => ({
        ...mockQueueItem,
        id: `queue-${i}`,
        newsletter_id: `newsletter-${i}`,
        position: i,
      }));

      mockReadingQueueApi.getAll.mockResolvedValue(largeQueue);

      const result = await service.getReadingQueue();

      expect(result).toHaveLength(100);
      expect(mockReadingQueueApi.getAll).toHaveBeenCalledTimes(1);
    });

    it('should respect queue size limits', async () => {
      const serviceWithLimit = new ReadingQueueService({ maxQueueSize: 2 });

      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.getAll.mockResolvedValue([mockQueueItem, mockQueueItem]);

      const result = await serviceWithLimit.addToQueue('newsletter-new');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reading queue is full (maximum 2 items)');
    });
  });
});
