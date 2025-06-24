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
  optimisticUpdateWithRollback: vi.fn().mockImplementation(async (key, updater) => {
    const currentData = mockActualCacheUtils.getQueryData(key, mockQueryClientInstance);
    const newData = updater(currentData);
    mockActualCacheUtils.setQueryData(key, newData, mockQueryClientInstance);
    return {
      rollback: vi.fn().mockImplementation(() => {
        mockActualCacheUtils.setQueryData(key, currentData, mockQueryClientInstance);
      }),
    };
  }),
  invalidateRelatedQueries: vi.fn(),
  clearNewsletterCache: vi.fn(),
  clearReadingQueueCache: vi.fn(),
  warmCache: vi.fn(),
  queryClient: mockQueryClientInstance, // Use a real QueryClient instance for the mock cache manager
};

vi.mock('@common/utils/cacheUtils', async () => {
  const actual = await vi.importActual<typeof import('@common/utils/cacheUtils')>('@common/utils/cacheUtils');
  return {
    ...actual,
    getCacheManager: vi.fn(() => mockCacheManagerInstance),
    getQueryData: vi.fn((queryKey, client) => actual.getQueryData(queryKey, client || mockQueryClientInstance)),
    setQueryData: vi.fn((queryKey, data, client) => actual.setQueryData(queryKey, data, client || mockQueryClientInstance)),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined), // Mock this if invalidateForOperation uses it directly
  };
});

vi.mock('@common/utils/tagUtils', () => ({
  updateNewsletterTags: vi.fn().mockResolvedValue(undefined),
}));

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
  user_id: 'test-user',
  newsletter_source_id: 'test-source',
  tags: [],
  source: { id: 'test-source', name: 'Test Source', user_id: 'test-user-id', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', from_address: 'source@example.com', status: 'active' },
  word_count: 100,
  estimated_read_time: 1,
  image_url: '',
  created_at: '2024-01-01T00:00:00Z', // Added missing property
  // queue_items: [], // Add if your type includes this and it's relevant
};

const mockPaginatedResponse = (items: NewsletterWithRelations[] = [mockNewsletter]): import('@common/types/api').PaginatedResponse<NewsletterWithRelations> => ({
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
    mockCacheManagerInstance.updateNewsletterInCache.mockImplementation(( {id, updates} ) => {
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
    it('should fetch a single newsletter by ID', async () => {
      const specificNewsletter = { ...mockNewsletter, id: 'specific-id', title: 'Specific One' };
      mockNewsletterService.getById.mockResolvedValueOnce(specificNewsletter);
      const { result } = await setupHook();
      const fetched = await result.current.getNewsletter('specific-id');
      expect(mockNewsletterService.getById).toHaveBeenCalledWith('specific-id');
      expect(fetched).toEqual(specificNewsletter);
    });

     it('should return null if getNewsletter is called with no ID', async () => {
      const { result } = await setupHook();
      // @ts-expect-error testing invalid input
      const fetched = await result.current.getNewsletter(null);
      expect(fetched).toBeNull();
      expect(mockNewsletterService.getById).not.toHaveBeenCalled();
    });
  });


  // --- Read/Unread Operations ---
  describe('Mark as Read/Unread', () => {
    const newsletterId = mockNewsletter.id;

    it('markAsRead should optimistically update and call service', async () => {
      const { result } = await setupHook();
      // Set initial cache data for the list query
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
      require('@common/utils/cacheUtils').setQueryData(listQueryKey, mockPaginatedResponse([{...mockNewsletter, is_read: false}]), queryClient);

      mockNewsletterService.markAsRead.mockResolvedValueOnce({ success: true, newsletter: {...mockNewsletter, is_read: true } });

      await act(async () => {
        await result.current.markAsRead(newsletterId);
      });

      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith(expect.objectContaining({
        id: newsletterId,
        updates: expect.objectContaining({ is_read: true }),
      }));
      expect(mockNewsletterService.markAsRead).toHaveBeenCalledWith(newsletterId);
      // Optionally, check if queryClient cache reflects optimistic update immediately
      // const cachedData = require('@common/utils/cacheUtils').getQueryData(listQueryKey, queryClient) as PaginatedResponse<NewsletterWithRelations>;
      // expect(cachedData.data.find(n => n.id === newsletterId)?.is_read).toBe(true);
    });

    it('markAsUnread should optimistically update and call service', async () => {
      const { result } = await setupHook();
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
      require('@common/utils/cacheUtils').setQueryData(listQueryKey, mockPaginatedResponse([{...mockNewsletter, is_read: true}]), queryClient);
      mockNewsletterService.markAsUnread.mockResolvedValueOnce({ success: true, newsletter: {...mockNewsletter, is_read: false } });

      await act(async () => {
        await result.current.markAsUnread(newsletterId);
      });

      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith(expect.objectContaining({
        id: newsletterId,
        updates: expect.objectContaining({ is_read: false }),
      }));
      expect(mockNewsletterService.markAsUnread).toHaveBeenCalledWith(newsletterId);
    });

    it('markAsRead should rollback on error', async () => {
      const { result } = await setupHook();
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
      const originalNewsletterData = { ...mockNewsletter, is_read: false, title: "Original Title for Rollback Test" };

      // Prime the cache with initial data
      queryClient.setQueryData(listQueryKey, mockPaginatedResponse([originalNewsletterData]));

      mockNewsletterService.markAsRead.mockRejectedValueOnce(new Error('Mark As Read Failed'));

      // Spy on the actual cache update function to see what it's called with during rollback
      const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

      await act(async () => {
        try {
          await result.current.markAsRead(newsletterId);
        } catch (e) {
          // Expected error
        }
      });

      expect(mockNewsletterService.markAsRead).toHaveBeenCalledWith(newsletterId);

      // Verify rollback: updateNewsletterInCache should be called twice:
      // 1. For optimistic update (is_read: true)
      // 2. For rollback (is_read: false, original title)
      expect(updateInCacheSpy).toHaveBeenCalledTimes(2);

      // Check the arguments of the second call (the rollback)
      const rollbackCallArgs = updateInCacheSpy.mock.calls[1][0]; // [0] is the first argument of the second call
      expect(rollbackCallArgs.id).toBe(newsletterId);
      expect(rollbackCallArgs.updates.is_read).toBe(originalNewsletterData.is_read);
      // Ensure other fields are also reverted if they were part of the original object fetched by onMutate context
      // For this specific mutation, only is_read and updated_at are touched optimistically and rolled back.
      // If the rollback logic was more complex (e.g. re-setting the whole previous item), this test would be different.

      // More robust: check the actual cache state after the operation
      const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
      const finalNewsletterInCache = finalCachedData?.data.find(n => n.id === newsletterId);
      expect(finalNewsletterInCache?.is_read).toBe(false); // Should be reverted to original is_read status
    });

    describe('Bulk Mark as Read/Unread', () => {
      const newsletterIds = [mockNewsletter.id, 'newsletter-2'];
      const initialNewsletters = [
        { ...mockNewsletter, id: mockNewsletter.id, is_read: false },
        { ...mockNewsletter, id: 'newsletter-2', is_read: false },
      ];

      it('bulkMarkAsRead should optimistically update and call service', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialNewsletters));

        mockNewsletterService.bulkUpdate.mockResolvedValueOnce({ successCount: newsletterIds.length, failedCount: 0, errors: [] });

        await act(async () => {
          await result.current.bulkMarkAsRead(newsletterIds);
        });

        expect(mockCacheManagerInstance.batchUpdateNewsletters).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_read: true }) }))
          )
        );
        expect(mockNewsletterService.bulkUpdate).toHaveBeenCalledWith({ ids: newsletterIds, updates: { is_read: true } });
      });

      it('bulkMarkAsRead should rollback on error', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialNewsletters));

        mockNewsletterService.bulkUpdate.mockRejectedValueOnce(new Error('Bulk Mark As Read Failed'));
        const batchUpdateSpy = vi.spyOn(mockCacheManagerInstance, 'batchUpdateNewsletters');
        // We also need to spy on updateNewsletterInCache because the rollback logic in the hook calls it individually for each item.
        const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');


        await act(async () => {
          try {
            await result.current.bulkMarkAsRead(newsletterIds);
          } catch (e) { /* Expected */ }
        });

        expect(mockNewsletterService.bulkUpdate).toHaveBeenCalledWith({ ids: newsletterIds, updates: { is_read: true } });

        // Optimistic update
        expect(batchUpdateSpy).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_read: true }) }))
          )
        );

        // Rollback for each item
        expect(updateInCacheSpy).toHaveBeenCalledTimes(newsletterIds.length);
        initialNewsletters.forEach(nl => {
          expect(updateInCacheSpy).toHaveBeenCalledWith(expect.objectContaining({
            id: nl.id,
            updates: expect.objectContaining({ is_read: nl.is_read, updated_at: nl.updated_at }),
          }));
        });

        const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
        newsletterIds.forEach(id => {
          const item = finalCachedData?.data.find(n => n.id === id);
          const originalItem = initialNewsletters.find(n => n.id === id);
          expect(item?.is_read).toBe(originalItem?.is_read);
        });
      });

      it('bulkMarkAsUnread should optimistically update and call service', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        const newslettersToUnread = initialNewsletters.map(n => ({ ...n, is_read: true }));
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(newslettersToUnread));

        mockNewsletterService.bulkUpdate.mockResolvedValueOnce({ successCount: newsletterIds.length, failedCount: 0, errors: [] });

        await act(async () => {
          await result.current.bulkMarkAsUnread(newsletterIds);
        });

        expect(mockCacheManagerInstance.batchUpdateNewsletters).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_read: false }) }))
          )
        );
        expect(mockNewsletterService.bulkUpdate).toHaveBeenCalledWith({ ids: newsletterIds, updates: { is_read: false } });
      });

      it('bulkMarkAsUnread should rollback on error', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        const newslettersToUnread = initialNewsletters.map(n => ({ ...n, is_read: true }));
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(newslettersToUnread));

        mockNewsletterService.bulkUpdate.mockRejectedValueOnce(new Error('Bulk Mark As Unread Failed'));
        const batchUpdateSpy = vi.spyOn(mockCacheManagerInstance, 'batchUpdateNewsletters');
        const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

        await act(async () => {
          try {
            await result.current.bulkMarkAsUnread(newsletterIds);
          } catch (e) { /* Expected */ }
        });

        expect(mockNewsletterService.bulkUpdate).toHaveBeenCalledWith({ ids: newsletterIds, updates: { is_read: false } });
        expect(batchUpdateSpy).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_read: false }) }))
          )
        );
        expect(updateInCacheSpy).toHaveBeenCalledTimes(newsletterIds.length);
        newslettersToUnread.forEach(nl => { // Rollback to their 'is_read: true' state
          expect(updateInCacheSpy).toHaveBeenCalledWith(expect.objectContaining({
            id: nl.id,
            updates: expect.objectContaining({ is_read: nl.is_read, updated_at: nl.updated_at }),
          }));
        });

        const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
        newsletterIds.forEach(id => {
          const item = finalCachedData?.data.find(n => n.id === id);
          const originalItem = newslettersToUnread.find(n => n.id === id);
          expect(item?.is_read).toBe(originalItem?.is_read); // Should be true after rollback
        });
      });
    });
  });

  // --- Like Operations ---
  describe('Toggle Like', () => {
    const newsletterId = mockNewsletter.id;

    it('should optimistically update like status and call service', async () => {
      const { result } = await setupHook();
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
      require('@common/utils/cacheUtils').setQueryData(listQueryKey, mockPaginatedResponse([{...mockNewsletter, is_liked: false}]), queryClient);
      mockNewsletterService.toggleLike.mockResolvedValueOnce({ success: true, newsletter: {...mockNewsletter, is_liked: true } });

      await act(async () => {
        await result.current.toggleLike(newsletterId);
      });

      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith(expect.objectContaining({
        id: newsletterId,
        updates: expect.objectContaining({ is_liked: true }),
      }));
      expect(mockNewsletterService.toggleLike).toHaveBeenCalledWith(newsletterId);
    });

    it('toggleLike should rollback on error', async () => {
      const { result } = await setupHook();
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
      const originalNewsletterData = { ...mockNewsletter, is_liked: false };
      queryClient.setQueryData(listQueryKey, mockPaginatedResponse([originalNewsletterData]));

      mockNewsletterService.toggleLike.mockRejectedValueOnce(new Error('Toggle Like Failed'));
      const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

      await act(async () => {
        try {
          await result.current.toggleLike(newsletterId);
        } catch (e) { /* Expected */ }
      });

      expect(mockNewsletterService.toggleLike).toHaveBeenCalledWith(newsletterId);
      expect(updateInCacheSpy).toHaveBeenCalledTimes(2); // Optimistic + Rollback

      // Check rollback call arguments
      const rollbackCallArgs = updateInCacheSpy.mock.calls[1][0];
      expect(rollbackCallArgs.id).toBe(newsletterId);
      expect(rollbackCallArgs.updates.is_liked).toBe(originalNewsletterData.is_liked);

      // Check final cache state
      const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
      const finalNewsletterInCache = finalCachedData?.data.find(n => n.id === newsletterId);
      expect(finalNewsletterInCache?.is_liked).toBe(false);
    });
  });

  // --- Archive Operations ---
  describe('Toggle Archive', () => {
    const newsletterId = mockNewsletter.id;

    it('should optimistically update archive status and call service (and remove from view if not in archive view)', async () => {
      const { result } = await setupHook({ isArchived: false }); // Current view is unarchived
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({ isArchived: false });
      require('@common/utils/cacheUtils').setQueryData(listQueryKey, mockPaginatedResponse([{...mockNewsletter, is_archived: false}]), queryClient);

      mockNewsletterService.toggleArchive.mockResolvedValueOnce({ success: true, newsletter: {...mockNewsletter, is_archived: true } });

      await act(async () => {
        await result.current.toggleArchive(newsletterId);
      });

      // Check if it was removed from the cache for the current non-archived view
      const cachedData = require('@common/utils/cacheUtils').getQueryData(listQueryKey, queryClient) as import('@common/types/api').PaginatedResponse<NewsletterWithRelations>;
      expect(cachedData.data.find(n => n.id === newsletterId)).toBeUndefined();
      expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith(newsletterId);
    });

    it('should optimistically update archive status and call service (and keep in view if in archive view)', async () => {
      const { result } = await setupHook({ isArchived: true }); // Current view is archived
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({ isArchived: true });
      require('@common/utils/cacheUtils').setQueryData(listQueryKey, mockPaginatedResponse([{...mockNewsletter, is_archived: false}]), queryClient); // Item is initially unarchived

      mockNewsletterService.toggleArchive.mockResolvedValueOnce({ success: true, newsletter: {...mockNewsletter, is_archived: true } });

      await act(async () => {
        await result.current.toggleArchive(newsletterId); // This will archive it
      });

      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith(expect.objectContaining({
        id: newsletterId,
        updates: expect.objectContaining({ is_archived: true }),
      }));
      expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith(newsletterId);
    });

    it('toggleArchive should rollback (revert is_archived) on error if item was updated in place', async () => {
      // Simulate being in a view where the item is not removed (e.g., "All Items" or "Archived" view when unarchiving)
      // Here, we'll test archiving it, assuming current filter allows seeing archived items.
      const currentFilters = { isArchived: undefined }; // Or isArchived: true if we were unarchiving
      const { result } = await setupHook(currentFilters);
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list(currentFilters);
      const originalNewsletterData = { ...mockNewsletter, is_archived: false };
      queryClient.setQueryData(listQueryKey, mockPaginatedResponse([originalNewsletterData]));

      mockNewsletterService.toggleArchive.mockRejectedValueOnce(new Error('Toggle Archive Failed'));
      const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

      await act(async () => {
        try {
          await result.current.toggleArchive(newsletterId);
        } catch (e) { /* Expected */ }
      });

      expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith(newsletterId);
      // updateNewsletterInCache is called for optimistic update and then for rollback.
      expect(updateInCacheSpy).toHaveBeenCalledTimes(2);

      const rollbackCallArgs = updateInCacheSpy.mock.calls[1][0];
      expect(rollbackCallArgs.id).toBe(newsletterId);
      expect(rollbackCallArgs.updates.is_archived).toBe(originalNewsletterData.is_archived);

      const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
      const finalNewsletterInCache = finalCachedData?.data.find(n => n.id === newsletterId);
      expect(finalNewsletterInCache?.is_archived).toBe(false);
    });

    it('toggleArchive should rollback (re-add item) on error if item was removed from view', async () => {
      // Simulate being in a view where the item is removed upon archiving (e.g., "Inbox" where isArchived=false)
      const currentFilters = { isArchived: false };
      const { result } = await setupHook(currentFilters);
      const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list(currentFilters);
      const originalNewsletterData = { ...mockNewsletter, id: newsletterId, is_archived: false, title: "To Be Archived" };
      const otherNewsletter = { ...mockNewsletter, id: "other-id", title: "Other" };
      queryClient.setQueryData(listQueryKey, mockPaginatedResponse([originalNewsletterData, otherNewsletter]));

      mockNewsletterService.toggleArchive.mockRejectedValueOnce(new Error('Toggle Archive Failed'));
      // The hook uses queryClient.setQueryData directly for removal/re-addition in this case.
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      await act(async () => {
        try {
          await result.current.toggleArchive(newsletterId);
        } catch (e) { /* Expected */ }
      });

      expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith(newsletterId);

      // First setQueryData is optimistic removal. Second is rollback (re-adding).
      expect(setQueryDataSpy).toHaveBeenCalledTimes(2);

      const finalCachedData = queryClient.getQueryData<import('@common/types/api').PaginatedResponse<NewsletterWithRelations>>(listQueryKey);
      expect(finalCachedData?.data).toContainEqual(expect.objectContaining({ id: newsletterId, is_archived: false }));
      expect(finalCachedData?.data.length).toBe(2); // Should be back to original count
    });

    describe('Bulk Archive/Unarchive', () => {
      const newsletterIds = [mockNewsletter.id, 'newsletter-2'];
      const initialUnarchivedNewsletters = [
        { ...mockNewsletter, id: mockNewsletter.id, is_archived: false },
        { ...mockNewsletter, id: 'newsletter-2', is_archived: false },
      ];
      const initialArchivedNewsletters = initialUnarchivedNewsletters.map(n => ({ ...n, is_archived: true }));

      it('bulkArchive should optimistically update and call service', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialUnarchivedNewsletters));

        mockNewsletterService.bulkArchive.mockResolvedValueOnce({ successCount: newsletterIds.length, failedCount: 0, errors: [] });

        await act(async () => {
          await result.current.bulkArchive(newsletterIds);
        });

        expect(mockCacheManagerInstance.batchUpdateNewsletters).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_archived: true }) }))
          )
        );
        expect(mockNewsletterService.bulkArchive).toHaveBeenCalledWith(newsletterIds);
      });

      it('bulkArchive should rollback on error', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialUnarchivedNewsletters));

        mockNewsletterService.bulkArchive.mockRejectedValueOnce(new Error('Bulk Archive Failed'));
        const batchUpdateSpy = vi.spyOn(mockCacheManagerInstance, 'batchUpdateNewsletters');
        const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

        await act(async () => {
          try {
            await result.current.bulkArchive(newsletterIds);
          } catch (e) { /* Expected */ }
        });

        expect(mockNewsletterService.bulkArchive).toHaveBeenCalledWith(newsletterIds);
        expect(batchUpdateSpy).toHaveBeenCalledTimes(1); // Optimistic update
        expect(updateInCacheSpy).toHaveBeenCalledTimes(newsletterIds.length); // Rollback
        initialUnarchivedNewsletters.forEach(nl => {
          expect(updateInCacheSpy).toHaveBeenCalledWith(expect.objectContaining({
            id: nl.id,
            updates: expect.objectContaining({ is_archived: nl.is_archived, updated_at: nl.updated_at }),
          }));
        });
      });

      it('bulkUnarchive should optimistically update and call service', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialArchivedNewsletters));

        mockNewsletterService.bulkUnarchive.mockResolvedValueOnce({ successCount: newsletterIds.length, failedCount: 0, errors: [] });

        await act(async () => {
          await result.current.bulkUnarchive(newsletterIds);
        });

        expect(mockCacheManagerInstance.batchUpdateNewsletters).toHaveBeenCalledWith(
          expect.arrayContaining(
            newsletterIds.map(id => expect.objectContaining({ id, updates: expect.objectContaining({ is_archived: false }) }))
          )
        );
        expect(mockNewsletterService.bulkUnarchive).toHaveBeenCalledWith(newsletterIds);
      });

      it('bulkUnarchive should rollback on error', async () => {
        const { result } = await setupHook();
        const listQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.newsletters.list({});
        queryClient.setQueryData(listQueryKey, mockPaginatedResponse(initialArchivedNewsletters));

        mockNewsletterService.bulkUnarchive.mockRejectedValueOnce(new Error('Bulk Unarchive Failed'));
        const batchUpdateSpy = vi.spyOn(mockCacheManagerInstance, 'batchUpdateNewsletters');
        const updateInCacheSpy = vi.spyOn(mockCacheManagerInstance, 'updateNewsletterInCache');

        await act(async () => {
          try {
            await result.current.bulkUnarchive(newsletterIds);
          } catch (e) { /* Expected */ }
        });

        expect(mockNewsletterService.bulkUnarchive).toHaveBeenCalledWith(newsletterIds);
        expect(batchUpdateSpy).toHaveBeenCalledTimes(1); // Optimistic
        expect(updateInCacheSpy).toHaveBeenCalledTimes(newsletterIds.length); // Rollback
         initialArchivedNewsletters.forEach(nl => {
          expect(updateInCacheSpy).toHaveBeenCalledWith(expect.objectContaining({
            id: nl.id,
            updates: expect.objectContaining({ is_archived: nl.is_archived, updated_at: nl.updated_at }),
          }));
        });
      });
    });
  });

  // --- Queue Operations ---
  describe('Toggle In Queue', () => {
    const newsletterId = mockNewsletter.id;

    it('should add to queue if not in queue', async () => {
      const { result } = await setupHook();
      mockReadingQueueService.isInQueue.mockResolvedValueOnce(false);
      mockReadingQueueService.add.mockResolvedValueOnce({} as any); // Assuming add returns some confirmation

      await act(async () => {
        await result.current.toggleInQueue(newsletterId);
      });

      expect(mockReadingQueueService.add).toHaveBeenCalledWith(newsletterId);
      // Optimistic update for queue is complex, involves cacheManager.optimisticUpdateWithRollback
      // Verify that cacheManager's optimistic update was called
      expect(mockCacheManagerInstance.optimisticUpdateWithRollback).toHaveBeenCalled();
    });

    it('should remove from queue if in queue', async () => {
      const { result } = await setupHook();
      const queueQueryKey = require('@common/utils/queryKeyFactory').queryKeyFactory.queue.list('test-user-id');
      require('@common/utils/cacheUtils').setQueryData(queueQueryKey, [{ newsletter_id: newsletterId, id: 'q1' }] as any[], queryClient);

      mockReadingQueueService.isInQueue.mockResolvedValueOnce(true); // Mock that it is in queue
      mockReadingQueueService.remove.mockResolvedValueOnce(true);

      await act(async () => {
        await result.current.toggleInQueue(newsletterId);
      });

      expect(mockReadingQueueService.remove).toHaveBeenCalledWith('q1'); // Assumes it finds queue item id from cache
      expect(mockCacheManagerInstance.optimisticUpdateWithRollback).toHaveBeenCalled();
    });
    // TODO: Rollback tests for toggleInQueue
  });

  // --- Delete Operations ---
  describe('Delete Operations', () => {
    const newsletterId = mockNewsletter.id;
    const bulkIds = [mockNewsletter.id, 'newsletter-2'];

    it('deleteNewsletter should call service and invalidate queries on success', async () => {
      const { result } = await setupHook();
      mockNewsletterService.delete.mockResolvedValueOnce(true);
      const invalidateSpy = vi.spyOn(require('@common/utils/optimizedCacheInvalidation'), 'invalidateForOperation');

      await act(async () => {
        await result.current.deleteNewsletter(newsletterId);
      });

      expect(mockNewsletterService.delete).toHaveBeenCalledWith(newsletterId);
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(queryClient, 'delete', [newsletterId]));
      invalidateSpy.mockRestore();
    });

    it('deleteNewsletter should set error state on failure', async () => {
      const { result } = await setupHook();
      const error = new Error('Delete failed');
      mockNewsletterService.delete.mockRejectedValueOnce(error);

      await act(async () => {
        try {
          await result.current.deleteNewsletter(newsletterId);
        } catch (e) { /* Expected */ }
      });
      expect(result.current.errorDeletingNewsletter).toBe(error);
    });

    it('bulkDeleteNewsletters should call service for each ID and invalidate queries on success', async () => {
      const { result } = await setupHook();
      mockNewsletterService.delete.mockResolvedValue(true); // Mock delete for each item in bulk
      const invalidateSpy = vi.spyOn(require('@common/utils/optimizedCacheInvalidation'), 'invalidateForOperation');

      await act(async () => {
        await result.current.bulkDeleteNewsletters(bulkIds);
      });

      expect(mockNewsletterService.delete).toHaveBeenCalledTimes(bulkIds.length);
      bulkIds.forEach(id => expect(mockNewsletterService.delete).toHaveBeenCalledWith(id));
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(queryClient, 'bulk-delete', bulkIds));
      invalidateSpy.mockRestore();
    });

    it('bulkDeleteNewsletters should set error state on failure', async () => {
      const { result } = await setupHook();
      const error = new Error('Bulk delete failed');
      mockNewsletterService.delete.mockImplementation(async (id) => {
        if (id === bulkIds[0]) return true;
        throw error; // Fail on the second item
      });

      await act(async () => {
        try {
          await result.current.bulkDeleteNewsletters(bulkIds);
        } catch (e) { /* Expected */ }
      });
      expect(result.current.errorBulkDeletingNewsletters).toBe(error);
    });
  });

  // --- Tag Operations ---
  describe('Update Newsletter Tags', () => {
    const newsletterId = mockNewsletter.id;
    const newTagIds = ['tag1', 'tag2'];

    it('should call utility to update tags', async () => {
      const { result } = await setupHook();
      mockNewsletterService.getById.mockResolvedValueOnce({...mockNewsletter, tags: []}); // For current tags check

      await act(async () => {
        await result.current.updateNewsletterTags(newsletterId, newTagIds);
      });

      expect(mockUpdateNewsletterTagsUtil).toHaveBeenCalledWith(newsletterId, newTagIds, [], 'test-user-id');
      // Optimistic update for tags is mainly updating updated_at
      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith(expect.objectContaining({
        id: newsletterId,
        updates: expect.objectContaining({ updated_at: expect.any(String) }),
      }));
    });
    // TODO: Rollback test for updateNewsletterTags
  });

  // Add more tests for other mutations (bulk operations, error states, loading states, etc.)
  // Focus on testing one piece of logic per test case for clarity.
});
