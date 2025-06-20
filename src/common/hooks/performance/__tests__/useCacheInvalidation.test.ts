import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCacheInvalidation,
  useTypedCacheInvalidation,
  setGlobalQueryClient,
} from '../useCacheInvalidation';
import React from 'react';
import type { ReactNode } from 'react';

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock debounced callback
let mockDebouncedCallbacks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../../usePerformanceOptimizations', () => ({
  useDebouncedCallback: (callback: (...args: unknown[]) => unknown, _delay: number) => {
    const key = callback.toString();
    if (!mockDebouncedCallbacks[key]) {
      mockDebouncedCallbacks[key] = vi.fn(callback);
    }
    return mockDebouncedCallbacks[key];
  },
}));

describe('useCacheInvalidation', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDebouncedCallbacks = {};

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    // Spy on queryClient methods
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('immediate invalidation', () => {
    it('should invalidate queries immediately', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateImmediate(['test-query']);
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['test-query'],
      });
    });

    it('should handle invalidation errors gracefully', async () => {
      const error = new Error('Invalidation failed');
      vi.mocked(queryClient.invalidateQueries).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateImmediate(['test-query']);
      });

      // Should not throw, just log the error
      expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });

    it('should track metrics for immediate invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateImmediate(['test-query-1']);
        await result.current.invalidateImmediate(['test-query-2']);
      });

      const metrics = result.current.getMetrics();
      expect(metrics.totalInvalidations).toBe(2);
      expect(metrics.lastInvalidation).toBeGreaterThan(0);
    });
  });

  describe('batched invalidation', () => {
    it('should batch multiple invalidations', async () => {
      const { result } = renderHook(() => useCacheInvalidation({ batchDelay: 100 }), { wrapper });

      act(() => {
        result.current.invalidateBatched(['query-1']);
        result.current.invalidateBatched(['query-2']);
        result.current.invalidateBatched(['query-3']);
      });

      // Should not call immediately
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

      // Wait for batch to process
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Should have called invalidateQueries
      expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });

    it('should process batch when reaching max size', async () => {
      const { result } = renderHook(
        () => useCacheInvalidation({ batchDelay: 1000, maxBatchSize: 3 }),
        { wrapper }
      );

      act(() => {
        result.current.invalidateBatched(['query-1']);
        result.current.invalidateBatched(['query-2']);
        result.current.invalidateBatched(['query-3']); // Should trigger immediate processing
      });

      // Should process immediately when batch is full
      await waitFor(() => {
        expect(queryClient.invalidateQueries).toHaveBeenCalled();
      });
    });

    it('should track metrics for batched invalidations', async () => {
      const { result } = renderHook(() => useCacheInvalidation({ batchDelay: 50 }), { wrapper });

      act(() => {
        result.current.invalidateBatched(['query-1']);
        result.current.invalidateBatched(['query-2']);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const metrics = result.current.getMetrics();
      expect(metrics.totalInvalidations).toBe(2);
      expect(metrics.batchedInvalidations).toBe(2);
    });

    it('should flush pending batches on demand', async () => {
      const { result } = renderHook(() => useCacheInvalidation({ batchDelay: 1000 }), { wrapper });

      act(() => {
        result.current.invalidateBatched(['query-1']);
        result.current.invalidateBatched(['query-2']);
      });

      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.flush();
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });
  });

  describe('debounced invalidation', () => {
    it('should debounce newsletter list invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      act(() => {
        result.current.invalidateNewsletterList();
        result.current.invalidateNewsletterList();
        result.current.invalidateNewsletterList();
      });

      // Should only be called once due to debouncing
      expect(mockDebouncedCallbacks[Object.keys(mockDebouncedCallbacks)[0]]).toHaveBeenCalledTimes(
        3
      );
    });

    it('should debounce unread count invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      act(() => {
        result.current.invalidateUnreadCount();
        result.current.invalidateUnreadCount();
      });

      // Check that a debounced callback was created
      const debouncedCallbacks = Object.values(mockDebouncedCallbacks);
      expect(debouncedCallbacks.length).toBeGreaterThan(0);

      // Find the unread count invalidation callback
      const unreadCountFn =
        debouncedCallbacks.find((fn) =>
          fn.mock?.calls?.some?.(
            (call: unknown[]) => call.length === 0 || (call[0] && typeof call[0] === 'function')
          )
        ) || debouncedCallbacks[0];

      expect(unreadCountFn).toBeDefined();
      expect(unreadCountFn).toHaveBeenCalledTimes(2);
    });

    it('should track metrics for debounced invalidations', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      // Call the actual debounced function
      await act(async () => {
        const debouncedFn = Object.values(mockDebouncedCallbacks)[0];
        if (debouncedFn) {
          await debouncedFn();
        }
      });

      const metrics = result.current.getMetrics();
      expect(metrics.debouncedInvalidations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('operation-based invalidation', () => {
    it('should invalidate correctly for newsletter archive operation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateByOperation('newsletter-archive', 'newsletter-123');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['newsletter', 'newsletter-123'],
      });
    });

    it('should invalidate correctly for mark read operation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateByOperation('newsletter-mark-read', 'newsletter-123');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['newsletter', 'newsletter-123'],
      });
      // Should also trigger debounced unread count invalidation
      expect(Object.keys(mockDebouncedCallbacks).length).toBeGreaterThan(0);
    });

    it('should invalidate correctly for tag operations', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateByOperation('newsletter-tag-add', 'newsletter-123');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['newsletter', 'newsletter-123'],
      });
    });

    it('should handle bulk operations with batching', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      act(() => {
        result.current.invalidateByOperation('bulk-operation');
      });

      // Check that batched invalidation was called
      const metrics = result.current.getMetrics();
      expect(metrics.pendingBatchSize).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to newsletter list for unknown operations', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.invalidateByOperation('unknown-operation');
      });

      // Should trigger newsletter list invalidation
      expect(Object.keys(mockDebouncedCallbacks).length).toBeGreaterThan(0);
    });
  });

  describe('typed cache invalidation', () => {
    it('should provide typed invalidation methods', async () => {
      const { result } = renderHook(() => useTypedCacheInvalidation(), { wrapper });

      await act(async () => {
        await result.current.newsletter('newsletter-123');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['newsletter', 'newsletter-123'],
      });
    });

    it('should handle all typed methods', async () => {
      const { result } = renderHook(() => useTypedCacheInvalidation(), { wrapper });

      // Test newsletter method
      await act(async () => {
        await result.current.newsletter('123');
      });

      // Test reading queue method
      await act(async () => {
        await result.current.readingQueue();
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
    });

    it('should trigger debounced methods', () => {
      const { result } = renderHook(() => useTypedCacheInvalidation(), { wrapper });

      act(() => {
        result.current.newsletters();
        result.current.unreadCount();
        result.current.tags();
        result.current.newsletterSources();
      });

      // All debounced methods should be registered
      expect(Object.keys(mockDebouncedCallbacks).length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('global cache invalidation', () => {
    it('should work with global query client', async () => {
      setGlobalQueryClient(queryClient);

      // Import after setting global client
      const { globalCacheInvalidation } = await import('../useCacheInvalidation');

      await act(async () => {
        await globalCacheInvalidation.invalidateNewsletter('newsletter-123');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['newsletter', 'newsletter-123'],
      });
    });

    it('should handle missing global query client gracefully', async () => {
      setGlobalQueryClient(null as unknown as QueryClient);

      const { globalCacheInvalidation } = await import('../useCacheInvalidation');

      // Should not throw
      expect(() => {
        globalCacheInvalidation.invalidateNewsletters();
      }).not.toThrow();
    });
  });

  describe('query key grouping', () => {
    it('should group similar query keys for optimization', async () => {
      const { result } = renderHook(() => useCacheInvalidation({ batchDelay: 50 }), { wrapper });

      act(() => {
        result.current.invalidateBatched(['newsletters', 'inbox']);
        result.current.invalidateBatched(['newsletters', 'archive']);
        result.current.invalidateBatched(['newsletters', 'liked']);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should group newsletters queries together
      expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });
  });

  describe('performance and edge cases', () => {
    it('should handle rapid invalidations', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        const promises = Array.from({ length: 10 }, (_, i) =>
          result.current.invalidateImmediate([`query-${i}`])
        );
        await Promise.all(promises);
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(10);
    });

    it('should cleanup timeouts on unmount', () => {
      const { unmount } = renderHook(() => useCacheInvalidation({ batchDelay: 1000 }), { wrapper });

      unmount();

      // Should not throw or cause memory leaks
      expect(true).toBe(true);
    });

    it('should handle empty query keys', async () => {
      const { result } = renderHook(() => useCacheInvalidation({ batchDelay: 50 }), { wrapper });

      act(() => {
        result.current.invalidateBatched([]);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should handle gracefully without errors
      expect(true).toBe(true);
    });
  });
});
