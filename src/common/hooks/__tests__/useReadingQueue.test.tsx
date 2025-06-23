import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useReadingQueue } from '../useReadingQueue';
import { readingQueueService, newsletterService, tagService } from '@common/services';
import { AuthContext } from '@common/contexts/AuthContext';
import * as cacheUtils from '@common/utils/cacheUtils';
import { ReadingQueueItem, NewsletterWithRelations, Tag } from '@common/types';

vi.mock('@common/services', async (importOriginal) => {
  // const actual = await importOriginal<typeof import('@common/services')>(); // Not needed if mocking all used parts
  return {
    newsletterService: {
        markAsRead: vi.fn(),
        markAsUnread: vi.fn(),
    },
    readingQueueService: {
        getAll: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        reorder: vi.fn(),
        clear: vi.fn(),
        isInQueue: vi.fn(),
        cleanupOrphanedItems: vi.fn(),
    },
    tagService: {
      getOrCreateTag: vi.fn(),
      updateNewsletterTagsWithIds: vi.fn().mockResolvedValue({ success: true }),
      getTagsForNewsletter: vi.fn().mockResolvedValue([]), // Add this
    },
  };
});

vi.mock('@common/utils/logger', () => {
  const loggerInstance = { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() };
  return { useLogger: () => loggerInstance, logger: loggerInstance };
});

const mockReadingQueueService = vi.mocked(readingQueueService);
const mockNewsletterService = vi.mocked(newsletterService);
const mockTagService = vi.mocked(tagService);

const mockCacheManagerInstance = {
  updateReadingQueueInCache: vi.fn(),
  invalidateRelatedQueries: vi.fn(),
};
vi.mock('@common/utils/cacheUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof cacheUtils>();
  return {
    ...actual,
    getCacheManagerSafe: vi.fn(() => mockCacheManagerInstance),
  };
});

const mockUser = { id: 'user-123', email: 'test@example.com' };

const createMockNewsletter = (id: string): NewsletterWithRelations => ({
  id, title: `Newsletter ${id}`, content: `Content ${id}`, received_at: new Date().toISOString(),
  summary: '', image_url: '', is_read: false, is_liked: false, is_archived: false,
  updated_at: new Date().toISOString(), estimated_read_time: 5, word_count: 100,
  source: { id: `s-${id}`, name: `Source ${id}`, from: `s-${id}@e.com`, user_id: mockUser.id, created_at: '', updated_at: '' },
  tags: [] as Tag[], newsletter_source_id: `s-${id}`, user_id: mockUser.id,
});

const createMockQueueItem = (id: string, newsletterId: string, position: number): ReadingQueueItem => ({
  id,
  user_id: mockUser.id,
  newsletter_id: newsletterId,
  newsletter: createMockNewsletter(newsletterId),
  added_at: new Date().toISOString(),
  position,
});

describe('useReadingQueue', () => {
  let queryClient: QueryClient;

  const wrapperFactory = (client: QueryClient, userValue: any = mockUser) =>
    ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user: userValue, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() } as any}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      queryCache: new QueryCache(),
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
    });
    vi.clearAllMocks();
    mockCacheManagerInstance.updateReadingQueueInCache.mockClear();
    mockCacheManagerInstance.invalidateRelatedQueries.mockClear();

    // Ensure tagService mocks have default implementations after clearing
    mockTagService.getOrCreateTag.mockResolvedValue({ success: true, tag: { id: 'tag-default', name: 'Default', color: '#fff', user_id: 'u1', created_at: ''} });
    mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Fetching Reading Queue', () => {
    it('should fetch reading queue items successfully', async () => {
      const mockItems = [createMockQueueItem('q1', 'nl1', 0)];
      mockReadingQueueService.getAll.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.readingQueue).toEqual(mockItems);
      expect(result.current.isError).toBe(false);
    });

    it('should return empty queue and no error for generic service errors', async () => {
      const mockError = new Error('Failed to fetch (generic)');
      mockReadingQueueService.getAll.mockRejectedValue(mockError);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.readingQueue).toEqual([]);
    });

    it('should return empty array for data integrity issues (e.g., newsletter not found)', async () => {
      const mockError = new Error('blah blah not found in reading queue item blah');
      mockReadingQueueService.getAll.mockRejectedValue(mockError);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.readingQueue).toEqual([]);
    });

    it('should be disabled if user is not authenticated', async () => {
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, null) });
      await act(async () => { await new Promise(r => setTimeout(r, 50)); });
      expect(result.current.isLoading).toBe(false);
      expect(mockReadingQueueService.getAll).not.toHaveBeenCalled();
    });

    it.skip('should re-throw network/auth errors for React Query to handle', async () => {
      const networkError = new Error('Network error');
      mockReadingQueueService.getAll.mockRejectedValue(networkError);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(networkError);
      expect(result.current.readingQueue).toEqual([]);
    });
  });

  describe('addToQueue Mutation', () => {
    it('should add item to queue and call cache manager for optimistic update', async () => {
      mockReadingQueueService.getAll.mockResolvedValue([]);
      mockReadingQueueService.add.mockResolvedValue(createMockQueueItem('new-q', 'nl-new', 0));
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.addToQueue('nl-new'); });
      expect(mockReadingQueueService.add).toHaveBeenCalledWith('nl-new');
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'add', newsletterId: 'nl-new', userId: mockUser.id })
      );
    });

    it('should revert optimistic update on addToQueue error', async () => {
      const initialQueue = [createMockQueueItem('q1', 'nl1', 0)];
      mockReadingQueueService.getAll.mockResolvedValue(initialQueue);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const addError = new Error('Failed to add');
      mockReadingQueueService.add.mockRejectedValue(addError);
      await act(async () => { try { await result.current.addToQueue('nl-new'); } catch (e) { /* Expected */ } });
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'revert', queueItems: initialQueue, userId: mockUser.id })
      );
    });
  });

  describe('removeFromQueue Mutation', () => {
    it('should remove item and call cache manager for optimistic update', async () => {
      const initialQueue = [createMockQueueItem('q1', 'nl1', 0)];
      mockReadingQueueService.getAll.mockResolvedValue(initialQueue);
      mockReadingQueueService.remove.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.readingQueue.length).toBe(1));
      await act(async () => { await result.current.removeFromQueue('q1'); });
      expect(mockReadingQueueService.remove).toHaveBeenCalledWith('q1');
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'remove', queueItemId: 'q1', userId: mockUser.id })
      );
    });
  });

  describe('reorderQueue Mutation', () => {
    it('should reorder queue', async () => {
      const updates = [{ id: 'q1', position: 1 }];
      mockReadingQueueService.reorder.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await act(async () => { await result.current.reorderQueue(updates); });
      expect(mockReadingQueueService.reorder).toHaveBeenCalledWith(updates);
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(expect.objectContaining({ type: 'reorder' }));
    });
  });

  describe('clearQueue Mutation', () => {
    it('should clear queue', async () => {
      mockReadingQueueService.clear.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await act(async () => { await result.current.clearQueue(); });
      expect(mockReadingQueueService.clear).toHaveBeenCalled();
    });
  });

  describe('markAsRead/Unread Mutations', () => {
    it('markAsRead should call newsletterService', async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({} as any);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await act(async () => { await result.current.markAsRead('nl1'); });
      expect(mockNewsletterService.markAsRead).toHaveBeenCalledWith('nl1');
    });
    it('markAsUnread should call newsletterService', async () => {
      mockNewsletterService.markAsUnread.mockResolvedValue({} as any);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await act(async () => { await result.current.markAsUnread('nl1'); });
      expect(mockNewsletterService.markAsUnread).toHaveBeenCalledWith('nl1');
    });
  });

  describe('updateTags Mutation', () => {
    it('should attempt to update tags and interact with cache', async () => {
      mockTagService.getOrCreateTag.mockResolvedValue({ success: true, tag: {id: 'tag1'} as Tag });
      mockReadingQueueService.getAll.mockResolvedValue([createMockQueueItem('q-item1', 'nl1', 0)]);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newsletterId = 'nl1'; const tagIds = ['tag1'];
      await act(async () => { await result.current.updateTags({ newsletterId, tagIds }); });

      // Check that updateNewsletterTags from tagUtils (which calls tagService.updateNewsletterTagsWithIds) was involved.
      // Since updateNewsletterTags util itself is not mocked here, we assume it calls tagService.
      // The hook itself calls the util. We can check if the cache interactions happened.
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'updateTags', newsletterId, tagIds, userId: mockUser.id })
      );
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith([], 'queue-update-tags');
    });
  });

  describe('isInQueue Function', () => {
    it('should call readingQueueService.isInQueue', async () => {
      mockReadingQueueService.isInQueue.mockResolvedValue(true);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      let isInQueueResult = false;
      await act(async () => { isInQueueResult = await result.current.isInQueue('nl1'); });
      expect(mockReadingQueueService.isInQueue).toHaveBeenCalledWith('nl1');
      expect(isInQueueResult).toBe(true);
    });
  });

  describe('cleanupOrphanedItems Mutation', () => {
     it('should call service and refetch on success if items were removed', async () => {
      mockReadingQueueService.getAll.mockResolvedValue([]); // Initial fetch for refetch spy
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false)); // Wait for initial fetch to complete

      mockReadingQueueService.cleanupOrphanedItems.mockResolvedValue({ removedCount: 1 });
      mockReadingQueueService.getAll.mockResolvedValueOnce([]); // For the refetch call

      await act(async () => {
        await result.current.cleanupOrphanedItems();
      });

      expect(mockReadingQueueService.cleanupOrphanedItems).toHaveBeenCalled();
      // getAll is called initially, then again by refetch
      expect(mockReadingQueueService.getAll).toHaveBeenCalledTimes(2);
     });

     it('should call service and NOT refetch if no items were removed', async () => {
      mockReadingQueueService.getAll.mockResolvedValue([]);
      const { result } = renderHook(() => useReadingQueue(), { wrapper: wrapperFactory(queryClient, mockUser) });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockReadingQueueService.cleanupOrphanedItems.mockResolvedValue({ removedCount: 0 });

      await act(async () => {
        await result.current.cleanupOrphanedItems();
      });
      expect(mockReadingQueueService.cleanupOrphanedItems).toHaveBeenCalled();
      expect(mockReadingQueueService.getAll).toHaveBeenCalledTimes(1); // Only initial fetch
     });
  });
});
