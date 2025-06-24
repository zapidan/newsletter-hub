import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useNewsletters } from '../useNewsletters';
import { newsletterService } from '@common/services';
import type { NewsletterWithRelations } from '@common/types';

// Mock dependencies
vi.mock('@common/services', () => ({
  newsletterService: {
    getAll: vi.fn(),
    getById: vi.fn(), // Was getNewsletter
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    bulkUpdate: vi.fn(),
    toggleLike: vi.fn(),
    toggleArchive: vi.fn(),
    bulkArchive: vi.fn(),
    bulkUnarchive: vi.fn(),
    delete: vi.fn(), // Was deleteNewsletter
    // createNewsletter: vi.fn(), // Not used by useNewsletters directly
    // updateNewsletter: vi.fn(), // Not used by useNewsletters directly
    update: vi.fn(), // For unarchive specific
    updateTags: vi.fn(), // For updateNewsletterTags
  },
  readingQueueService: {
    isInQueue: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    // getAll: vi.fn(), // Not directly used by useNewsletters mutations
  },
  newsletterSourceGroupService: {}, // Keep other services if needed by full module mock
  tagService: {},
  userService: {},
}));

const mockActualCacheUtils = await vi.importActual<typeof import('@common/utils/cacheUtils')>('@common/utils/cacheUtils');
const mockQueryClientInstance = new QueryClient();

const mockCacheManagerInstance = {
  updateNewsletterInCache: vi.fn(),
  batchUpdateNewsletters: vi.fn(),
  optimisticUpdate: vi.fn(),
  optimisticUpdateWithRollback: vi.fn(),
  invalidateRelatedQueries: vi.fn(),
  clearNewsletterCache: vi.fn(),
  clearReadingQueueCache: vi.fn(),
  warmCache: vi.fn(),
  queryClient: undefined as unknown as QueryClient,
}

// Stub for cacheUtils
vi.mock('@common/utils/cacheUtils', () => {
  let liveClient: QueryClient
  return {
    __setClient: (c: QueryClient) => (liveClient = c),
    getCacheManager: vi.fn(() => mockCacheManager),
    getQueryData: vi.fn((key: any) => liveClient.getQueryData(key)),
    setQueryData: vi.fn((key: any, data: any) => liveClient.setQueryData(key, data)),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    newsletters: {
      list: (p: any = {}) => ['newsletters', 'list', p],
      detail: (id: string) => ['newsletters', 'detail', id],
      all: () => ['newsletters'],
    },
    queue: { list: (uid: string) => ['readingQueue', 'list', uid] },
  },
}))

vi.mock('@common/utils/optimizedCacheInvalidation', () => ({
  invalidateForOperation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@common/utils/tagUtils', () => ({
  updateNewsletterTags: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@common/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' }, // Consistent user ID
    // isAuthenticated: true, // Not part of useAuth return
    // loading: false, // Not part of useAuth return
  }),
}));

const mockNewsletterService = vi.mocked(newsletterService);
const mockReadingQueueService = vi.mocked(readingQueueService);
const mockUpdateNewsletterTagsUtil = vi.mocked(require('@common/utils/tagUtils').updateNewsletterTags);


// Mock data
const mockNewsletter: NewsletterWithRelations = {
  id: 'test-newsletter-1',
  title: 'Test Newsletter',
  content: 'Test content',
  summary: 'Test summary',
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_id: 'u-1',
  newsletter_source_id: 'src-1',
  tags: [],
  source: {
    id: 'src-1',
    name: 'Source',
    user_id: 'u-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    from: 'source@example.com',
  },
  word_count: 100,
  estimated_read_time: 1,
  image_url: '',
}

const paginated = (items: NewsletterWithRelations[]) => ({
  data: items,
  count: items.length,
  hasMore: false,
  nextPage: null,
  prevPage: null,
});


describe('useNewsletters', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;


  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks before each test
    vi.clearAllMocks();
    mockQueryClientInstance.clear(); // Clear the internal query client for the mock cache manager

    // Default mock for useAuth
    vi.mocked(require('@common/contexts/AuthContext').useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
    });

    // Default mock for newsletterService.getAll
    mockNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse());

    // Default mock for cache manager interactions
    mockCacheManagerInstance.updateNewsletterInCache.mockImplementation(({ id, updates }) => {
      // This is a simplified mock. A real one might update queryClient cache.
      // console.log(`Mock updateNewsletterInCache called for ${id} with`, updates);
    });
    mockCacheManagerInstance.batchUpdateNewsletters.mockImplementation((updatesArray) => {
      // console.log(`Mock batchUpdateNewsletters called with`, updatesArray);
    });
    mockCacheManagerInstance.optimisticUpdateWithRollback.mockImplementation(async (key, updater) => {
      const currentData = require('@common/utils/cacheUtils').getQueryData(key, mockQueryClientInstance);
      const newData = updater(currentData);
      require('@common/utils/cacheUtils').setQueryData(key, newData, mockQueryClientInstance);
      return {
        rollback: vi.fn().mockImplementation(() => {
          require('@common/utils/cacheUtils').setQueryData(key, currentData, mockQueryClientInstance);
        }),
      };
    });


    // Define the wrapper for each test, using the fresh QueryClient
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  // Helper function to initialize hook and wait for initial data load
  const setupHook = async (filters = {}, options = {}) => {
    const hookResult = renderHook(() => useNewsletters(filters, options), { wrapper });
    await waitFor(() => expect(hookResult.result.current.isLoadingNewsletters).toBe(false), { timeout: 2000 });
    return hookResult;
  };

  describe('Initial Data Fetching', () => {
    it('should fetch newsletters on mount if enabled and user is authenticated', async () => {
      await setupHook();
      expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1);
      const { result } = await setupHook(); // re-render to check newsletters
      expect(result.current.newsletters).toEqual([mockNewsletter]);
    });

    it('should not fetch if not enabled', async () => {
      await setupHook({}, { enabled: false });
      expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
    });

    it('should not fetch if user is not authenticated', async () => {
      vi.mocked(require('@common/contexts/AuthContext').useAuth).mockReturnValue({ user: null });
      // queryClient.clear(); // Clear previous queries that might have run with a user
      const { result } = renderHook(() => useNewsletters(), { wrapper });
      // Wait for isLoading to settle, it might briefly be true
      await waitFor(() => expect(result.current.isLoadingNewsletters).toBe(false));
      expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
      // Verify newsletters array is empty
      expect(result.current.newsletters).toEqual([]);
    });

    it('should use filters when fetching newsletters', async () => {
      const filters = { search: 'test', isRead: true };
      await setupHook(filters);
      expect(mockNewsletterService.getAll).toHaveBeenCalledWith(expect.objectContaining(filters));
    });

    it('should handle error during initial fetch', async () => {
      const mockError = new Error('Failed to fetch');
      mockNewsletterService.getAll.mockRejectedValueOnce(mockError);
      const { result } = renderHook(() => useNewsletters(), { wrapper });
      await waitFor(() => expect(result.current.isLoadingNewsletters).toBe(false));
      expect(result.current.errorNewsletters).toBe(mockError);
      expect(result.current.newsletters).toEqual([]);
    });
  });

  describe('getNewsletter', () => {
    it('delegates to service', async () => {
      ns.getById.mockResolvedValueOnce({ ...nl, id: 'x' })
      const { result } = await useHook()
      await result.current.getNewsletter('x')
      expect(ns.getById).toHaveBeenCalledWith('x')
    })

    it('returns null for empty id', async () => {
      const { result } = await useHook()
      // @ts-expect-error deliberate misuse
      expect(await result.current.getNewsletter('')).toBeNull()
    })
  })

  describe('markAsRead / markAsUnread', () => {
    const listKey = queryKeyFactory.newsletters.list({})

    it('optimistically sets is_read = true', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_read: false }]))
      ns.markAsRead.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.markAsRead('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_read).toBe(true)
    })

    it('markAsUnread reverts flag', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_read: true }]))
      ns.markAsUnread.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.markAsUnread('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_read).toBe(false)
    })
  })

  describe('toggleLike', () => {
    const listKey = queryKeyFactory.newsletters.list({})
    it('flips is_liked', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_liked: false }]))
      ns.toggleLike.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.toggleLike('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_liked).toBe(true)
    })
  })

  describe('toggleArchive', () => {
    it('removes item from non-archived view when archiving', async () => {
      const filters = { isArchived: false }
      const listKey = queryKeyFactory.newsletters.list(filters)
      qc.setQueryData(listKey, paginated([nl]))
      ns.toggleArchive.mockResolvedValueOnce(true)
      const { result } = await useHook(filters)
      await act(async () => { await result.current.toggleArchive('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data
      expect(cached.find((x: any) => x.id === 'nl-1')).toBeUndefined()
    })
  })

  describe('toggleInQueue', () => {
    const queueKey = queryKeyFactory.queue.list('u-1')

    it('removes the item from the cached queue when present', async () => {
      // Seed cache with one queue-item
      const seeded = [{ id: 'q1', newsletter_id: 'nl-1' }] as ReadingQueueItem[]
      qc.setQueryData(queueKey, seeded)

      // `isInQueue` resolves truthy so the hook performs a “remove” branch
      qs.isInQueue.mockResolvedValueOnce(true)
      qs.remove.mockResolvedValueOnce(true)

      const { result } = await useHook()
      await act(async () => {
        await result.current.toggleInQueue('nl-1')
      })

      const after = (qc.getQueryData(queueKey) as ReadingQueueItem[]) ?? []
      expect(after.find((i) => i.newsletter_id === 'nl-1')).toBeUndefined()
    })
  })

  describe('delete operations', () => {
    it('deleteNewsletter invalidates queries', async () => {
      ns.delete.mockResolvedValueOnce(true)
      const spy = vi.spyOn(optimizedInvalidation, 'invalidateForOperation')
      const { result } = await useHook()
      await act(async () => { await result.current.deleteNewsletter('nl-1') })
      expect(ns.delete).toHaveBeenCalledWith('nl-1')
      expect(spy).toHaveBeenCalledWith(qc, 'delete', ['nl-1'])
    })

    it('exposes error on delete failure', async () => {
      ns.delete.mockRejectedValueOnce(new Error('boom'))
      const { result } = await useHook()
      await expect(result.current.deleteNewsletter('nl-1')).rejects.toThrow('boom')
    })

    it('bulk delete deletes each id then invalidates', async () => {
      const ids = ['nl-1', 'nl-2', 'nl-3']
      ns.delete.mockResolvedValue(true)
      const spy = vi.spyOn(optimizedInvalidation, 'invalidateForOperation')
      const { result } = await useHook()
      await act(async () => { await result.current.bulkDeleteNewsletters(ids) })
      expect(ns.delete).toHaveBeenCalledTimes(ids.length)
      ids.forEach((id) => expect(ns.delete).toHaveBeenCalledWith(id))
      expect(spy).toHaveBeenCalledWith(qc, 'bulk-delete', ids)
    })

    it('bulk delete surfaces first error', async () => {
      ns.delete.mockImplementation(async (id: string) => {
        if (id === 'nl-1') throw new Error('fail')
        return true
      })
      const { result } = await useHook()
      await expect(result.current.bulkDeleteNewsletters(['nl-1', 'nl-2'])).rejects.toThrow('fail')
    })
  })
})
