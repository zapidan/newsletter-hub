import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUnreadCount, usePrefetchUnreadCounts } from '../useUnreadCount';
import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterService } from '@common/services';

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

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
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
          isAuthenticated: true,
          loading: false,
          signIn: vi.fn(),
          signOut: vi.fn(),
          signUp: vi.fn(),
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
              isAuthenticated: false,
              loading: false,
              signIn: vi.fn(),
              signOut: vi.fn(),
              signUp: vi.fn(),
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
