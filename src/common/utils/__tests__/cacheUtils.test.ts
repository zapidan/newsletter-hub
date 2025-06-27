import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleCacheManager, createCacheManager, getCacheManager, getCurrentUnreadCount, resetCacheManager } from '../cacheUtils';
import { logger } from '../logger';

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CacheManager - Optimistic Unread Count Updates', () => {
  let queryClient: QueryClient;
  let cacheManager: SimpleCacheManager;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    cacheManager = createCacheManager(queryClient, {
      enableOptimisticUpdates: true,
      enableCrossFeatureSync: true,
      enablePerformanceLogging: true,
    });
  });

  afterEach(() => {
    queryClient.clear();
    resetCacheManager();
    vi.clearAllMocks();
  });

  describe('updateUnreadCountOptimistically', () => {
    it('should update unread count optimistically for mark-read operation', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: {
          'source-1': 5,
          'source-2': 3,
          'source-3': 2,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform optimistic update
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1', 'newsletter-2'],
        sourceId: 'source-1',
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 8, // 10 - 2
        bySource: {
          'source-1': 3, // 5 - 2
          'source-2': 3,
          'source-3': 2,
        },
      });

      expect(logger.debug).toHaveBeenCalledWith('Updating unread count optimistically', {
        action: 'update_unread_count_optimistic',
        metadata: {
          operation: 'mark-read',
          newsletterIds: ['newsletter-1', 'newsletter-2'],
          sourceId: 'source-1',
        },
      });
    });

    it('should update unread count optimistically for mark-unread operation', () => {
      // Set up initial unread count data
      const initialData = {
        total: 8,
        bySource: {
          'source-1': 3,
          'source-2': 3,
          'source-3': 2,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform optimistic update
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-unread',
        newsletterIds: ['newsletter-1', 'newsletter-2'],
        sourceId: 'source-1',
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 10, // 8 + 2
        bySource: {
          'source-1': 5, // 3 + 2
          'source-2': 3,
          'source-3': 2,
        },
      });
    });

    it('should handle bulk operations correctly', () => {
      // Set up initial unread count data
      const initialData = {
        total: 15,
        bySource: {
          'source-1': 8,
          'source-2': 4,
          'source-3': 3,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform bulk optimistic update
      cacheManager.updateUnreadCountOptimistically({
        type: 'bulk-mark-read',
        newsletterIds: ['newsletter-1', 'newsletter-2', 'newsletter-3', 'newsletter-4'],
        sourceId: 'source-1',
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 11, // 15 - 4
        bySource: {
          'source-1': 4, // 8 - 4
          'source-2': 4,
          'source-3': 3,
        },
      });
    });

    it('should not go below zero for unread counts', () => {
      // Set up initial unread count data with low numbers
      const initialData = {
        total: 2,
        bySource: {
          'source-1': 1,
          'source-2': 1,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Try to mark more newsletters as read than exist
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1', 'newsletter-2', 'newsletter-3'],
        sourceId: 'source-1',
      });

      // Check that counts don't go below zero
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 0, // 2 - 3 = 0 (not negative)
        bySource: {
          'source-1': 0, // 1 - 3 = 0 (not negative)
          'source-2': 1,
        },
      });
    });

    it('should handle operations without sourceId', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: {
          'source-1': 5,
          'source-2': 3,
          'source-3': 2,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform optimistic update without sourceId
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1'],
      });

      // Check that only total was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 9, // 10 - 1
        bySource: {
          'source-1': 5, // unchanged
          'source-2': 3, // unchanged
          'source-3': 2, // unchanged
        },
      });
    });

    it('should handle archive operations by invalidating cache', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: {
          'source-1': 5,
          'source-2': 3,
          'source-3': 2,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Mock invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Perform archive operation
      cacheManager.updateUnreadCountOptimistically({
        type: 'archive',
        newsletterIds: ['newsletter-1'],
      });

      // Check that invalidateQueries was called instead of optimistic update
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['unreadCount'],
        refetchType: 'active',
      });

      // Check that the original data wasn't changed
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);
      expect(updatedData).toEqual(initialData);

      expect(logger.debug).toHaveBeenCalledWith('Archive/delete operation detected, invalidating unread count', {
        action: 'update_unread_count_archive_delete',
      });
    });

    it('should handle missing cache data gracefully', () => {
      // Don't set any initial data

      // Perform optimistic update
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1'],
      });

      // Check that no error was thrown and debug was logged
      expect(logger.debug).toHaveBeenCalledWith('No current unread count data found, skipping optimistic update', {
        action: 'update_unread_count_no_data',
      });
    });

    it('should handle unknown operation types', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: { 'source-1': 10 },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform unknown operation
      cacheManager.updateUnreadCountOptimistically({
        type: 'unknown-operation' as any,
        newsletterIds: ['newsletter-1'],
      });

      // Check that warning was logged and data wasn't changed
      expect(logger.warn).toHaveBeenCalledWith('Unknown operation type for unread count update', {
        action: 'update_unread_count_unknown_operation',
        metadata: { operation: 'unknown-operation' },
      });

      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);
      expect(updatedData).toEqual(initialData);
    });

    it('should handle multiple source updates correctly', () => {
      // Set up initial unread count data
      const initialData = {
        total: 20,
        bySource: {
          'source-1': 8,
          'source-2': 6,
          'source-3': 4,
          'source-4': 2,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Perform optimistic update affecting multiple sources
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1', 'newsletter-2'],
        sourceId: 'source-1',
      });

      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-3'],
        sourceId: 'source-2',
      });

      // Check that both sources were updated correctly
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);

      expect(updatedData).toEqual({
        total: 17, // 20 - 2 - 1
        bySource: {
          'source-1': 6, // 8 - 2
          'source-2': 5, // 6 - 1
          'source-3': 4, // unchanged
          'source-4': 2, // unchanged
        },
      });
    });

    it('should handle error during optimistic update gracefully', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: { 'source-1': 10 },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Mock setQueryData to throw an error
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData').mockImplementationOnce(() => {
        throw new Error('Cache update failed');
      });

      // Perform optimistic update
      cacheManager.updateUnreadCountOptimistically({
        type: 'mark-read',
        newsletterIds: ['newsletter-1'],
      });

      // Check that error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update unread count optimistically',
        {
          action: 'update_unread_count_optimistic_error',
          metadata: { operation: 'mark-read', newsletterIds: ['newsletter-1'] },
        },
        expect.any(Error)
      );

      // Restore the spy
      setQueryDataSpy.mockRestore();
    });
  });

  describe('invalidateRelatedQueries with optimistic updates', () => {
    it('should use optimistic updates for mark-read operations', () => {
      // Set up initial unread count data
      const initialData = {
        total: 10,
        bySource: { 'source-1': 10 },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Mock the optimistic update method
      const optimisticUpdateSpy = vi.spyOn(cacheManager, 'updateUnreadCountOptimistically');

      // Perform mark-read operation
      cacheManager.invalidateRelatedQueries(['newsletter-1'], 'mark-read');

      // Check that optimistic update was called instead of invalidation
      expect(optimisticUpdateSpy).toHaveBeenCalledWith({
        type: 'mark-read',
        newsletterIds: ['newsletter-1'],
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);
      expect(updatedData?.total).toBe(9);
    });

    it('should use optimistic updates for mark-unread operations', () => {
      // Set up initial unread count data
      const initialData = {
        total: 8,
        bySource: { 'source-1': 8 },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Mock the optimistic update method
      const optimisticUpdateSpy = vi.spyOn(cacheManager, 'updateUnreadCountOptimistically');

      // Perform mark-unread operation
      cacheManager.invalidateRelatedQueries(['newsletter-1'], 'mark-unread');

      // Check that optimistic update was called
      expect(optimisticUpdateSpy).toHaveBeenCalledWith({
        type: 'mark-unread',
        newsletterIds: ['newsletter-1'],
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);
      expect(updatedData?.total).toBe(9);
    });

    it('should use optimistic updates for bulk operations', () => {
      // Set up initial unread count data
      const initialData = {
        total: 15,
        bySource: { 'source-1': 15 },
      };

      queryClient.setQueryData(['unreadCount', 'all'], initialData);

      // Mock the optimistic update method
      const optimisticUpdateSpy = vi.spyOn(cacheManager, 'updateUnreadCountOptimistically');

      // Perform bulk mark-read operation
      cacheManager.invalidateRelatedQueries(['newsletter-1', 'newsletter-2', 'newsletter-3'], 'bulk-mark-read');

      // Check that optimistic update was called
      expect(optimisticUpdateSpy).toHaveBeenCalledWith({
        type: 'bulk-mark-read',
        newsletterIds: ['newsletter-1', 'newsletter-2', 'newsletter-3'],
      });

      // Check that the cache was updated
      const updatedData = queryClient.getQueryData<{ total: number; bySource: Record<string, number> }>(['unreadCount', 'all']);
      expect(updatedData?.total).toBe(12);
    });

    it('should handle navigation operations by skipping invalidation', () => {
      // Mock invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Perform navigation operation
      cacheManager.invalidateRelatedQueries(['newsletter-1'], 'navigation');

      // Check that no invalidation was performed
      expect(invalidateSpy).not.toHaveBeenCalled();

      // Check that debug was logged
      expect(logger.debug).toHaveBeenCalledWith('Navigation operation detected, skipping unread count invalidation', {
        action: 'navigation_skip_unread_invalidation',
        metadata: { newsletterIds: ['newsletter-1'] },
      });
    });

    it('should still invalidate for archive operations', () => {
      // Mock invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Perform archive operation
      cacheManager.invalidateRelatedQueries(['newsletter-1'], 'archive');

      // Check that invalidation was performed
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['unreadCount'],
        refetchType: 'active',
      });
    });
  });

  describe('getCurrentUnreadCount utility', () => {
    it('should return current unread count from cache', () => {
      const testData = {
        total: 15,
        bySource: {
          'source-1': 8,
          'source-2': 7,
        },
      };

      queryClient.setQueryData(['unreadCount', 'all'], testData);

      const result = getCurrentUnreadCount();
      expect(result).toEqual(testData);
    });

    it('should return undefined when no data exists', () => {
      const result = getCurrentUnreadCount();
      expect(result).toBeUndefined();
    });
  });

  describe('Singleton pattern', () => {
    it('should create and retrieve cache manager instance', () => {
      const manager = createCacheManager(queryClient);
      expect(manager).toBeInstanceOf(SimpleCacheManager);

      const retrievedManager = getCacheManager();
      expect(retrievedManager).toBe(manager);
    });

    it('should throw error when getting manager before creation', () => {
      // Clear any existing instance
      resetCacheManager();

      expect(() => getCacheManager()).toThrow('Cache manager not initialized. Call createCacheManager first.');
    });
  });
}); 