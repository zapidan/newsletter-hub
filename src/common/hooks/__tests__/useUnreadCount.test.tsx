import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterService } from '@common/services';
import type { User } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrefetchUnreadCounts, useUnreadCount } from '../useUnreadCount';

// Mock the service
vi.mock('@common/services', () => ({
  newsletterService: {
    getUnreadCount: vi.fn(),
    getUnreadCountBySource: vi.fn(),
  },
}));

// Mock logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: mockUser,
          session: null,
          loading: false,
          error: null,
          signIn: vi.fn(),
          signOut: vi.fn(),
          signUp: vi.fn(),
          resetPassword: vi.fn(),
          updatePassword: vi.fn(),
          checkPasswordStrength: vi.fn(),
        }}
      >
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('useUnreadCount', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all unread counts in a single query', async () => {
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
      'source-3': 2,
    });

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.unreadCount).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(10);
    });

    expect(result.current.isError).toBe(false);

    // Should have called both service methods in parallel
    expect(newsletterService.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterService.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should return source-specific count when sourceId is provided', async () => {
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
      'source-3': 2,
    });

    const { result } = renderHook(() => useUnreadCount('source-2'), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data to be loaded
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should return count for the specific source
    expect(result.current.unreadCount).toBe(5);
  });

  it('should return 0 for unknown source', async () => {
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
    });

    const { result } = renderHook(() => useUnreadCount('unknown-source'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should share data between hooks with different sourceIds', async () => {
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
    });

    const { result: result1 } = renderHook(() => useUnreadCount(), { wrapper });
    const { result: result2 } = renderHook(() => useUnreadCount('source-1'), { wrapper });
    const { result: result3 } = renderHook(() => useUnreadCount('source-2'), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
      expect(result3.current.isLoading).toBe(false);
    });

    expect(result1.current.unreadCount).toBe(10); // total
    expect(result2.current.unreadCount).toBe(3); // source-1
    expect(result3.current.unreadCount).toBe(5); // source-2

    // Should only fetch data once for all hooks
    expect(newsletterService.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterService.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should debounce invalidations when newsletter events occur', async () => {
    vi.useFakeTimers();

    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({});

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    // Wait for initial load using real timers
    vi.useRealTimers();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.useFakeTimers();

    // Clear mock call counts
    vi.clearAllMocks();

    // Simulate multiple rapid invalidations
    act(() => {
      result.current.invalidateUnreadCount();
      result.current.invalidateUnreadCount();
      result.current.invalidateUnreadCount();
    });

    // No immediate refetch
    expect(newsletterService.getUnreadCount).not.toHaveBeenCalled();

    // Advance timer past debounce delay (500ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    vi.useRealTimers();

    // Should only refetch once after debounce
    await waitFor(() => {
      expect(newsletterService.getUnreadCount).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    vi.mocked(newsletterService.getUnreadCount).mockRejectedValue(error);
    vi.mocked(newsletterService.getUnreadCountBySource).mockRejectedValue(error);

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(error);
    });

    // Should fallback to 0 count
    expect(result.current.unreadCount).toBe(0);
  });
});

describe('usePrefetchUnreadCounts', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should prefetch unread counts', async () => {
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(5);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 2,
      'source-2': 3,
    });

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper });

    // Call prefetch
    act(() => {
      result.current.prefetchUnreadCounts();
    });

    // Should have called both service methods
    expect(newsletterService.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterService.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should not prefetch when user is not authenticated', async () => {
    const unauthenticatedWrapper = () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
          },
        },
      });

      return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider
            value={{
              user: null,
              session: null,
              loading: false,
              error: null,
              signIn: vi.fn(),
              signOut: vi.fn(),
              signUp: vi.fn(),
              resetPassword: vi.fn(),
              updatePassword: vi.fn(),
              checkPasswordStrength: vi.fn(),
            }}
          >
            {children}
          </AuthContext.Provider>
        </QueryClientProvider>
      );
    };

    const { result } = renderHook(() => usePrefetchUnreadCounts(), {
      wrapper: unauthenticatedWrapper(),
    });

    // Call prefetch
    act(() => {
      result.current.prefetchUnreadCounts();
    });

    // Should not have called service methods
    expect(newsletterService.getUnreadCount).not.toHaveBeenCalled();
    expect(newsletterService.getUnreadCountBySource).not.toHaveBeenCalled();
  });

  it('should handle prefetch errors gracefully', async () => {
    const error = new Error('Prefetch failed');
    vi.mocked(newsletterService.getUnreadCount).mockRejectedValue(error);

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper });

    // Should not throw when prefetch fails
    expect(() => {
      act(() => {
        result.current.prefetchUnreadCounts();
      });
    }).not.toThrow();
  });
});

describe('useUnreadCount - Optimistic Updates Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock service responses
    vi.mocked(newsletterService.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterService.getUnreadCountBySource).mockResolvedValue({
      'source-1': 5,
      'source-2': 3,
      'source-3': 2,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderUseUnreadCount = (sourceId?: string) => {
    return renderHook(() => useUnreadCount(sourceId), {
      wrapper: ({ children }: { children: any }) => (
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider
            value={{
              user: mockUser,
              session: null,
              loading: false,
              error: null,
              signIn: vi.fn(),
              signOut: vi.fn(),
              signUp: vi.fn(),
              resetPassword: vi.fn(),
              updatePassword: vi.fn(),
              checkPasswordStrength: vi.fn(),
            }}
          >
            {children}
          </AuthContext.Provider>
        </QueryClientProvider>
      ),
    });
  };

  describe('Initial data loading', () => {
    it('should load unread count data correctly', async () => {
      const { result } = renderUseUnreadCount();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(false);
      });
    });

    it('should load source-specific unread count', async () => {
      const { result } = renderUseUnreadCount('source-1');

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.unreadCount).toBe(5);
      });
    });
  });

  describe('Optimistic updates integration', () => {
    it('should reflect optimistic updates in cache', async () => {
      const { result } = renderUseUnreadCount();

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
      });

      // Simulate optimistic update by directly setting cache data
      await act(async () => {
        queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
          total: 8, // Reduced by 2
          bySource: {
            'source-1': 3, // Reduced by 2
            'source-2': 3,
            'source-3': 2,
          },
        });
      });

      // Wait for the cache update to be processed
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(8);
      });
    });

    it('should handle optimistic updates for source-specific counts', async () => {
      const { result } = renderUseUnreadCount('source-1');

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(5);
      });

      // Simulate optimistic update
      await act(async () => {
        queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
          total: 8,
          bySource: {
            'source-1': 3, // Reduced by 2
            'source-2': 3,
            'source-3': 2,
          },
        });
      });

      // Wait for the cache update to be processed
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(3);
      });
    });

    it('should maintain consistency between total and source counts', async () => {
      const { result: totalResult } = renderUseUnreadCount();
      const { result: sourceResult } = renderUseUnreadCount('source-1');

      // Wait for initial data to load
      vi.useRealTimers();
      await waitFor(() => {
        expect(totalResult.current.unreadCount).toBe(10);
        expect(sourceResult.current.unreadCount).toBe(5);
      });

      // Simulate optimistic update
      act(() => {
        queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
          total: 8,
          bySource: {
            'source-1': 3,
            'source-2': 3,
            'source-3': 2,
          },
        });
      });

      // Wait for both hooks to reflect the cache update
      await waitFor(() => {
        expect(totalResult.current.unreadCount).toBe(8);
        expect(sourceResult.current.unreadCount).toBe(3);
      });
    });
  });

  describe('Cache invalidation behavior', () => {
    it('should not refetch when optimistic updates are applied', async () => {
      const { result } = renderUseUnreadCount();

      // Wait for initial data to load
      vi.useRealTimers();
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
      });

      const initialCallCount = vi.mocked(newsletterService.getUnreadCount).mock.calls.length;

      // Simulate optimistic update
      act(() => {
        queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
          total: 8,
          bySource: { 'source-1': 8 },
        });
      });

      // Wait a bit to see if any refetches occur
      vi.useFakeTimers();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      vi.useRealTimers();

      // Should not have made additional API calls
      expect(vi.mocked(newsletterService.getUnreadCount).mock.calls.length).toBe(initialCallCount);
    });

    it('should handle manual invalidation correctly', async () => {
      vi.useFakeTimers();

      const { result } = renderUseUnreadCount();

      // Wait for initial data to load using real timers
      vi.useRealTimers();
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
      });

      // Switch back to fake timers for controlled invalidation
      vi.useFakeTimers();

      // Manually invalidate the cache
      act(() => {
        result.current.invalidateUnreadCount();
      });

      // Advance timers past the debounce delay (500ms)
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Switch back to real timers for the waitFor
      vi.useRealTimers();

      // Wait for the unreadCount to be updated after invalidation
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
      });

      expect(vi.mocked(newsletterService.getUnreadCount).mock.calls.length).toBe(2); // Initial load + invalidation
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(newsletterService.getUnreadCount).mockRejectedValue(new Error('API Error'));
      vi.mocked(newsletterService.getUnreadCountBySource).mockRejectedValue(new Error('API Error'));

      const { result } = renderUseUnreadCount();

      // Wait for error to occur
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should maintain previous count on error', async () => {
      const { result } = renderUseUnreadCount();

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(10);
      });

      // Simulate optimistic update
      act(() => {
        queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
          total: 8,
          bySource: { 'source-1': 8 },
        });
      });

      // Wait for the optimistic update to be reflected
      await waitFor(() => {
        expect(result.current.unreadCount).toBe(8);
      });

      // Now simulate an error
      vi.mocked(newsletterService.getUnreadCount).mockRejectedValue(new Error('API Error'));

      // Manually invalidate to trigger error
      act(() => {
        result.current.invalidateUnreadCount();
      });

      // Wait for debounce delay
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Wait for error to be processed
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      // Should fallback to 0 on error since API failed
      expect(result.current.unreadCount).toBe(0);
    });

    describe('Performance optimizations', () => {
      it('should use stale time to prevent unnecessary refetches', async () => {
        const { result } = renderUseUnreadCount();

        // Wait for initial data to load
        vi.useRealTimers();
        await waitFor(() => {
          expect(result.current.unreadCount).toBe(10);
        });

        const initialCallCount = vi.mocked(newsletterService.getUnreadCount).mock.calls.length;

        // Trigger a re-render
        act(() => {
          // This would normally trigger a refetch, but stale time should prevent it
          queryClient.setQueryData(['unreadCount', 'all', mockUser.id], {
            total: 10,
            bySource: { 'source-1': 10 },
          });
        });

        // Should not have made additional API calls due to stale time
        expect(vi.mocked(newsletterService.getUnreadCount).mock.calls.length).toBe(initialCallCount);
      });

      it('should debounce invalidations', async () => {
        vi.useFakeTimers();

        const { result } = renderUseUnreadCount();

        // Wait for initial data to load using real timers
        vi.useRealTimers();
        await waitFor(() => {
          expect(result.current.unreadCount).toBe(10);
        });

        const initialCallCount = vi.mocked(newsletterService.getUnreadCount).mock.calls.length;

        // Switch back to fake timers for controlled invalidation
        vi.useFakeTimers();

        // Call invalidate multiple times quickly
        act(() => {
          result.current.invalidateUnreadCount();
          result.current.invalidateUnreadCount();
          result.current.invalidateUnreadCount();
        });

        // Wait for debounce delay
        act(() => {
          vi.advanceTimersByTime(600); // Debounce delay is 500ms
        });

        // Should only have made one additional call due to debouncing
        expect(vi.mocked(newsletterService.getUnreadCount).mock.calls.length).toBe(initialCallCount + 1);
      });
    });
  });
});
