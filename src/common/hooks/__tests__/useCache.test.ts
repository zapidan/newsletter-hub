import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCache } from '../useCache';
import * as cacheUtils from '@common/utils/cacheUtils';

// Mock the cacheUtils module
vi.mock('@common/utils/cacheUtils');

const mockCacheManagerInstance = {
  updateNewsletterInCache: vi.fn(),
  batchUpdateNewsletters: vi.fn(),
  optimisticUpdate: vi.fn(),
  updateReadingQueueInCache: vi.fn(),
  invalidateRelatedQueries: vi.fn(),
  clearNewsletterCache: vi.fn(),
  clearReadingQueueCache: vi.fn(),
  warmCache: vi.fn(),
  // Add any other methods from CacheManager that useCache might call
};

const mockGetCacheManager = vi.mocked(cacheUtils.getCacheManager);
const mockPrefetchQuery = vi.mocked(cacheUtils.prefetchQuery);
const mockSetQueryData = vi.mocked(cacheUtils.setQueryData);
const mockGetQueryData = vi.mocked(cacheUtils.getQueryData);
const mockInvalidateQueries = vi.mocked(cacheUtils.invalidateQueries);


describe('useCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for getCacheManager returns a functional mock instance
    mockGetCacheManager.mockReturnValue(mockCacheManagerInstance as any);
  });

  it('should call getCacheManager on initialization', () => {
    renderHook(() => useCache());
    expect(mockGetCacheManager).toHaveBeenCalledTimes(1);
  });

  it('should return null for cacheManager and operations should be no-ops if getCacheManager throws', () => {
    mockGetCacheManager.mockImplementationOnce(() => {
      throw new Error('Cache manager init failed');
    });
    const { result } = renderHook(() => useCache());
    expect(result.current.cacheManager).toBeNull();

    // Example: calling updateNewsletter should not throw and not call anything on a null manager
    expect(() => result.current.updateNewsletter('id1', { title: 'new' })).not.toThrow();
    expect(mockCacheManagerInstance.updateNewsletterInCache).not.toHaveBeenCalled();
  });

  describe('Newsletter Operations', () => {
    it('updateNewsletter should call cacheManager.updateNewsletterInCache', () => {
      const { result } = renderHook(() => useCache());
      const update = { title: 'New Title' };
      act(() => result.current.updateNewsletter('nl1', update));
      expect(mockCacheManagerInstance.updateNewsletterInCache).toHaveBeenCalledWith({
        id: 'nl1',
        updates: update,
      });
    });

    it('batchUpdateNewsletters should call cacheManager.batchUpdateNewsletters', async () => {
      const { result } = renderHook(() => useCache());
      const updates = [{ id: 'nl1', updates: { title: 'New Title' } }];
      await act(async () => {
        await result.current.batchUpdateNewsletters(updates);
      });
      expect(mockCacheManagerInstance.batchUpdateNewsletters).toHaveBeenCalledWith(updates);
    });

    it('optimisticUpdate should call cacheManager.optimisticUpdate', async () => {
      const { result } = renderHook(() => useCache());
      const updates = { title: 'Optimistic Title' };
      mockCacheManagerInstance.optimisticUpdate.mockResolvedValueOnce({ id: 'nl1', ...updates } as any);

      let opResult;
      await act(async () => {
        opResult = await result.current.optimisticUpdate('nl1', updates, 'test-op');
      });
      expect(mockCacheManagerInstance.optimisticUpdate).toHaveBeenCalledWith('nl1', updates, 'test-op');
      expect(opResult).toEqual(expect.objectContaining(updates));
    });
  });

  describe('Reading Queue Operations', () => {
    it('updateReadingQueue should call cacheManager.updateReadingQueueInCache', () => {
      const { result } = renderHook(() => useCache());
      const operation = { type: 'add' as const, newsletterId: 'nl1', userId: 'u1' };
      act(() => result.current.updateReadingQueue(operation));
      expect(mockCacheManagerInstance.updateReadingQueueInCache).toHaveBeenCalledWith(operation);
    });
  });

  describe('Invalidation Operations', () => {
    it('invalidateRelatedQueries should call cacheManager.invalidateRelatedQueries', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.invalidateRelatedQueries(['nl1'], 'op-type'));
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith(['nl1'], 'op-type');
    });

    it('invalidateNewsletters should call cacheManager.clearNewsletterCache', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.invalidateNewsletters());
      expect(mockCacheManagerInstance.clearNewsletterCache).toHaveBeenCalled();
    });

    it('invalidateReadingQueue should call cacheManager.clearReadingQueueCache', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.invalidateReadingQueue());
      expect(mockCacheManagerInstance.clearReadingQueueCache).toHaveBeenCalled();
    });

    it('invalidateTagQueries should call cacheManager.invalidateRelatedQueries with correct type or fallback', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.invalidateTagQueries(['tag1'], 'tag-update'));
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith(['tag1'], 'tag-update');

      mockCacheManagerInstance.invalidateRelatedQueries.mockClear();
      act(() => result.current.invalidateTagQueries(['tag2'], 'unknown-op'));
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith([], 'tag-update'); // Fallback
    });

    it('invalidateSourceQueries should call cacheManager.invalidateRelatedQueries with correct type or fallback', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.invalidateSourceQueries(['src1'], 'source-update-optimistic'));
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith(['src1'], 'source-update-optimistic');

      mockCacheManagerInstance.invalidateRelatedQueries.mockClear();
      act(() => result.current.invalidateSourceQueries(['src2'], 'unknown-op'));
      expect(mockCacheManagerInstance.invalidateRelatedQueries).toHaveBeenCalledWith([], 'newsletter-sources'); // Fallback
    });
  });

  describe('Cache Warming', () => {
    it('warmCache should call cacheManager.warmCache', () => {
      const { result } = renderHook(() => useCache());
      act(() => result.current.warmCache('user1', 'high'));
      expect(mockCacheManagerInstance.warmCache).toHaveBeenCalledWith('user1', 'high');
    });
  });

  describe('Generic Cache Utilities', () => {
    const queryKey = ['testKey'];
    const queryFn = vi.fn().mockResolvedValue('testData');

    it('prefetchQuery should call utilsPrefetchQuery', async () => {
      const { result } = renderHook(() => useCache());
      await act(async () => {
        await result.current.prefetchQuery(queryKey, queryFn, { staleTime: 100 });
      });
      expect(mockPrefetchQuery).toHaveBeenCalledWith(queryKey, queryFn, { staleTime: 100, gcTime: 30 * 60 * 1000 });
    });

    it('setQueryData should call utilsSetQueryData', () => {
      const { result } = renderHook(() => useCache());
      const data = 'newData';
      act(() => result.current.setQueryData(queryKey, data));
      expect(mockSetQueryData).toHaveBeenCalledWith(queryKey, data);
    });

    it('getQueryData should call utilsGetQueryData', () => {
      const { result } = renderHook(() => useCache());
      mockGetQueryData.mockReturnValueOnce('cachedData');
      let data;
      act(() => {
        data = result.current.getQueryData(queryKey);
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(queryKey);
      expect(data).toBe('cachedData');
    });

    it('removeQueries should call invalidateQueries with queryKey', async () => {
      const { result } = renderHook(() => useCache());
      await act(async () => {
        await result.current.removeQueries(queryKey);
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
    });

    it('batchInvalidate should call invalidateQueries for each operation', async () => {
      const { result } = renderHook(() => useCache());
      const operations = [
        { queryKey: ['key1'] },
        { predicate: vi.fn() }
      ];
      await act(async () => {
        await result.current.batchInvalidate(operations);
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: operations[0].queryKey });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ predicate: operations[1].predicate });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });
});
