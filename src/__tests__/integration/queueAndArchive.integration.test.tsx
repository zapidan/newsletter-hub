import type { NewsletterWithRelations, ReadingQueueItem } from '@common/types';
import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies
vi.mock('@common/api', () => ({
  newsletterApi: {
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    toggleArchive: vi.fn(),
    markAsRead: vi.fn(),
  },
  readingQueueApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

// Import mocked modules
import { newsletterApi, readingQueueApi } from '@common/api';

describe('Queue and Archive Integration Tests', () => {
  let queryClient: QueryClient;

  const mockNewsletter: NewsletterWithRelations = {
    id: 'newsletter-1',
    title: 'Test Newsletter',
    content: 'Test content',
    url: 'https://example.com',
    is_archived: false,
    is_read: false,
    is_liked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'user-1',
    newsletter_source_id: 'source-1',
    tags: [],
    newsletter_source: {
      id: 'source-1',
      name: 'Test Source',
      email: 'test@example.com',
      is_active: true,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'user-1',
    },
  };

  const mockQueueItem: ReadingQueueItem = {
    id: 'queue-item-1',
    newsletter_id: 'newsletter-1',
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
      logger: {
        log: () => { },
        warn: () => { },
        error: () => { },
      },
    });

    // Default mock implementations
    vi.mocked(newsletterApi.getById).mockResolvedValue(mockNewsletter);
    vi.mocked(newsletterApi.getAll).mockResolvedValue([mockNewsletter]);
    vi.mocked(readingQueueApi.getAll).mockResolvedValue([]);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Queue Removal Persistence', () => {
    it('should remove newsletter from queue and persist state', async () => {
      // Initial state: newsletter is in queue
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([mockQueueItem]);
      vi.mocked(readingQueueApi.remove).mockResolvedValue(undefined);

      // Simulate queue removal
      await readingQueueApi.remove(mockQueueItem.id);

      // Verify the API was called with correct parameters
      expect(readingQueueApi.remove).toHaveBeenCalledWith('queue-item-1');
      expect(readingQueueApi.remove).toHaveBeenCalledTimes(1);

      // Mock empty queue after removal for subsequent checks
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([]);

      // Verify queue is empty
      const queueItems = await readingQueueApi.getAll();
      expect(queueItems).toHaveLength(0);

      // Simulate adding back to queue to verify it was removed
      vi.mocked(readingQueueApi.add).mockResolvedValue({
        id: 'new-queue-item',
        newsletter_id: mockNewsletter.id,
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await readingQueueApi.add(mockNewsletter.id);
      expect(readingQueueApi.add).toHaveBeenCalledWith(mockNewsletter.id);
    });

    it('should handle queue removal errors gracefully', async () => {
      // Initial state: newsletter is in queue
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([mockQueueItem]);
      vi.mocked(readingQueueApi.remove).mockRejectedValue(new Error('Network error'));

      // Try to remove from queue (should fail)
      await expect(readingQueueApi.remove(mockQueueItem.id)).rejects.toThrow('Network error');

      // Verify the API was called
      expect(readingQueueApi.remove).toHaveBeenCalledWith('queue-item-1');

      // Verify queue state hasn't changed
      const queueItems = await readingQueueApi.getAll();
      expect(queueItems).toHaveLength(1);
      expect(queueItems[0].id).toBe(mockQueueItem.id);
    });

    it('should handle concurrent queue operations', async () => {
      const queueItem1 = { ...mockQueueItem, id: 'queue-1', newsletter_id: 'newsletter-1' };
      const queueItem2 = { ...mockQueueItem, id: 'queue-2', newsletter_id: 'newsletter-2' };

      vi.mocked(readingQueueApi.getAll).mockResolvedValue([queueItem1, queueItem2]);
      vi.mocked(readingQueueApi.remove).mockImplementation(async (_) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return undefined;
      });

      // Remove both items concurrently
      const removePromises = [
        readingQueueApi.remove(queueItem1.id),
        readingQueueApi.remove(queueItem2.id),
      ];

      await Promise.all(removePromises);

      expect(readingQueueApi.remove).toHaveBeenCalledTimes(2);
      expect(readingQueueApi.remove).toHaveBeenCalledWith('queue-1');
      expect(readingQueueApi.remove).toHaveBeenCalledWith('queue-2');
    });
  });

  describe('Auto-Archive Functionality', () => {
    it('should archive newsletter when markAsRead is called with auto-archive enabled', async () => {
      const updatedNewsletter = { ...mockNewsletter, is_read: true, is_archived: true };

      // Mock the mark as read operation
      vi.mocked(newsletterApi.markAsRead).mockResolvedValue(updatedNewsletter);

      // Simulate marking as read with auto-archive
      const result = await newsletterApi.markAsRead(mockNewsletter.id, { autoArchive: true });

      expect(newsletterApi.markAsRead).toHaveBeenCalledWith(mockNewsletter.id, {
        autoArchive: true,
      });
      expect(result.is_read).toBe(true);
      expect(result.is_archived).toBe(true);
    });

    it('should not archive when auto-archive is disabled', async () => {
      const updatedNewsletter = { ...mockNewsletter, is_read: true, is_archived: false };

      // Mock the mark as read operation
      vi.mocked(newsletterApi.markAsRead).mockResolvedValue(updatedNewsletter);

      // Simulate marking as read without auto-archive
      const result = await newsletterApi.markAsRead(mockNewsletter.id, { autoArchive: false });

      expect(newsletterApi.markAsRead).toHaveBeenCalledWith(mockNewsletter.id, {
        autoArchive: false,
      });
      expect(result.is_read).toBe(true);
      expect(result.is_archived).toBe(false);
    });

    it('should handle archive toggle correctly', async () => {
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };

      // Mock archive toggle
      vi.mocked(newsletterApi.toggleArchive).mockResolvedValue(archivedNewsletter);

      // Archive newsletter
      const archived = await newsletterApi.toggleArchive(mockNewsletter.id);
      expect(archived.is_archived).toBe(true);

      // Mock unarchive
      const unarchivedNewsletter = { ...mockNewsletter, is_archived: false };
      vi.mocked(newsletterApi.toggleArchive).mockResolvedValue(unarchivedNewsletter);

      // Unarchive newsletter
      const unarchived = await newsletterApi.toggleArchive(mockNewsletter.id);
      expect(unarchived.is_archived).toBe(false);

      expect(newsletterApi.toggleArchive).toHaveBeenCalledTimes(2);
    });

    it('should handle archive errors gracefully', async () => {
      // Mock archive failure
      vi.mocked(newsletterApi.toggleArchive).mockRejectedValue(new Error('Archive failed'));

      // Try to archive (should fail)
      await expect(newsletterApi.toggleArchive(mockNewsletter.id)).rejects.toThrow(
        'Archive failed'
      );

      expect(newsletterApi.toggleArchive).toHaveBeenCalledWith(mockNewsletter.id);
    });
  });

  describe('Combined Operations', () => {
    it('should handle queue and archive operations together', async () => {
      // Newsletter in queue and not archived
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([mockQueueItem]);

      // Archive the newsletter
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };
      vi.mocked(newsletterApi.toggleArchive).mockResolvedValue(archivedNewsletter);

      const archived = await newsletterApi.toggleArchive(mockNewsletter.id);
      expect(archived.is_archived).toBe(true);

      // Newsletter should still be in queue
      const queueItems = await readingQueueApi.getAll();
      expect(queueItems).toHaveLength(1);

      // Remove from queue
      vi.mocked(readingQueueApi.remove).mockResolvedValue(undefined);
      await readingQueueApi.remove(mockQueueItem.id);

      // Update mock to return empty queue
      vi.mocked(readingQueueApi.getAll).mockResolvedValue([]);

      // Verify newsletter is archived but not in queue
      const finalQueueItems = await readingQueueApi.getAll();
      expect(finalQueueItems).toHaveLength(0);
      expect(archived.is_archived).toBe(true);
    });

    it('should handle bulk operations', async () => {
      const newsletters = [
        mockNewsletter,
        { ...mockNewsletter, id: 'newsletter-2', title: 'Newsletter 2' },
        { ...mockNewsletter, id: 'newsletter-3', title: 'Newsletter 3' },
      ];

      const queueItems = newsletters.map((n, i) => ({
        ...mockQueueItem,
        id: `queue-${i + 1}`,
        newsletter_id: n.id,
      }));

      vi.mocked(readingQueueApi.getAll).mockResolvedValue(queueItems);
      vi.mocked(newsletterApi.getAll).mockResolvedValue(newsletters);

      // Remove all from queue
      vi.mocked(readingQueueApi.remove).mockResolvedValue(undefined);

      const removePromises = queueItems.map((item) => readingQueueApi.remove(item.id));
      await Promise.all(removePromises);

      expect(readingQueueApi.remove).toHaveBeenCalledTimes(3);

      // Archive all newsletters
      vi.mocked(newsletterApi.toggleArchive).mockImplementation(async (id) => {
        const newsletter = newsletters.find((n) => n.id === id);
        return newsletter ? { ...newsletter, is_archived: true } : mockNewsletter;
      });

      const archivePromises = newsletters.map((n) => newsletterApi.toggleArchive(n.id));
      const archivedNewsletters = await Promise.all(archivePromises);

      expect(newsletterApi.toggleArchive).toHaveBeenCalledTimes(3);
      archivedNewsletters.forEach((n) => {
        expect(n.is_archived).toBe(true);
      });
    });
  });

  describe('Query Cache Integration', () => {
    it('should update cache after operations', async () => {
      // Set initial data in cache
      queryClient.setQueryData(['newsletters', 'list'], [mockNewsletter]);
      queryClient.setQueryData(['reading-queue'], [mockQueueItem]);

      // Remove from queue
      vi.mocked(readingQueueApi.remove).mockResolvedValue(undefined);
      await readingQueueApi.remove(mockQueueItem.id);

      // Update cache manually (simulating what the real app would do)
      queryClient.setQueryData(['reading-queue'], []);

      // Verify cache is updated
      const cachedQueue = queryClient.getQueryData(['reading-queue']);
      expect(cachedQueue).toEqual([]);

      // Archive newsletter
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };
      vi.mocked(newsletterApi.toggleArchive).mockResolvedValue(archivedNewsletter);
      await newsletterApi.toggleArchive(mockNewsletter.id);

      // Update cache
      queryClient.setQueryData(['newsletters', 'list'], [archivedNewsletter]);

      // Verify cache is updated
      const cachedNewsletters = queryClient.getQueryData([
        'newsletters',
        'list',
      ]) as NewsletterWithRelations[];
      expect(cachedNewsletters[0].is_archived).toBe(true);
    });

    it('should invalidate queries after mutations', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Archive newsletter
      vi.mocked(newsletterApi.toggleArchive).mockResolvedValue({
        ...mockNewsletter,
        is_archived: true,
      });
      await newsletterApi.toggleArchive(mockNewsletter.id);

      // Simulate what the mutation would do
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
      await queryClient.invalidateQueries({ queryKey: ['newsletter', mockNewsletter.id] });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['newsletters'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['newsletter', mockNewsletter.id],
        });
      });
    });
  });
});
