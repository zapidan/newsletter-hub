import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUnreadCount, usePrefetchUnreadCounts } from '../useUnreadCount';
import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterApi } from '@common/api/newsletterApi';

// Mock the API
vi.mock('@common/api/newsletterApi', () => ({
  newsletterApi: {
    getUnreadCount: vi.fn(),
    getUnreadCountBySource: vi.fn(),
  },
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

const mockAuth = {
  user: {
    id: 'test-user',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    email_confirmed_at: '2024-01-01T00:00:00Z',
    phone_confirmed_at: undefined,
    confirmation_sent_at: undefined,
    confirmed_at: '2024-01-01T00:00:00Z',
    last_sign_in_at: '2024-01-01T00:00:00Z',
    role: 'authenticated',
    phone: undefined,
    recovery_sent_at: undefined,
    email_change_sent_at: undefined,
    new_email: undefined,
    new_phone: undefined,
    invited_at: undefined,
    action_link: undefined,
    email_change: undefined,
    phone_change: undefined,
    is_anonymous: false,
  },
  session: {
    access_token: 'test-token',
    user: {
      id: 'test-user',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
    },
  } as any,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  checkPasswordStrength: vi.fn(),
  loading: false,
  error: null,
};

const mockUnreadData = {
  total: 10,
  bySource: {
    'source-1': 3,
    'source-2': 5,
    'source-3': 2,
  },
};

describe('useUnreadCount', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  it('should fetch all unread counts in a single query', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
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

    // Should have called both APIs in parallel
    expect(newsletterApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterApi.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should return source-specific count when sourceId is provided', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
      'source-3': 2,
    });

    const { result } = renderHook(() => useUnreadCount('source-2'), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.unreadCount).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(5);
    });
  });

  it('should return 0 for unknown source', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
    });

    const { result } = renderHook(() => useUnreadCount('unknown-source'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it('should share data between hooks with different sourceIds', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
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
      expect(result1.current.unreadCount).toBe(10);
      expect(result2.current.unreadCount).toBe(3);
      expect(result3.current.unreadCount).toBe(5);
    });

    // Should only fetch data once for all hooks
    expect(newsletterApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterApi.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should debounce invalidations when newsletter events occur', async () => {
    vi.useFakeTimers();

    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({});

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    // Wait for initial load using real timers
    vi.useRealTimers();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(10);
    });
    vi.useFakeTimers();

    // Reset mock calls
    vi.clearAllMocks();

    // Trigger multiple events rapidly
    act(() => {
      window.dispatchEvent(new Event('newsletter:read-status-changed'));
      window.dispatchEvent(new Event('newsletter:archived'));
      window.dispatchEvent(new Event('newsletter:deleted'));
      window.dispatchEvent(new Event('newsletter:read-status-changed'));
    });

    // No immediate refetch
    expect(newsletterApi.getUnreadCount).not.toHaveBeenCalled();

    // Advance timer past debounce delay (500ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Switch back to real timers for waitFor
    vi.useRealTimers();
    await waitFor(() => {
      // Should refetch only once after debounce
      expect(newsletterApi.getUnreadCount).toHaveBeenCalledTimes(1);
      expect(newsletterApi.getUnreadCountBySource).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch unread count');
    vi.mocked(newsletterApi.getUnreadCount).mockRejectedValue(error);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockRejectedValue(error);

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should return 0 when user is not authenticated', async () => {
    const noAuthWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ ...mockAuth, user: null }}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUnreadCount(), { wrapper: noAuthWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });

    expect(newsletterApi.getUnreadCount).not.toHaveBeenCalled();
  });

  it('should maintain previous count during refetch', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({});

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.unreadCount).toBe(10);
    });

    // Update mock to return new value
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(15);

    // Use fake timers for debounce
    vi.useFakeTimers();

    // Trigger refetch
    act(() => {
      window.dispatchEvent(new Event('newsletter:read-status-changed'));
    });

    // Should still show 10 during refetch
    expect(result.current.unreadCount).toBe(10);

    // Advance timer past debounce delay
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Switch back to real timers for waitFor
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(15);
    });
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUnreadCount(), { wrapper });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'newsletter:read-status-changed',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'newsletter:archived',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith('newsletter:deleted', expect.any(Function));
  });
});

describe('usePrefetchUnreadCounts', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  it('should prefetch unread counts', async () => {
    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(10);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
      'source-1': 3,
      'source-2': 5,
    });

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper });

    await act(async () => {
      await result.current.prefetchCounts();
    });

    expect(newsletterApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterApi.getUnreadCountBySource).toHaveBeenCalledTimes(1);

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(['unreadCount', 'all', 'test-user']);
    expect(cachedData).toEqual({
      total: 10,
      bySource: {
        'source-1': 3,
        'source-2': 5,
      },
    });
  });

  it('should skip prefetch if data is fresh', async () => {
    // Preload cache with fresh data
    queryClient.setQueryData(['unreadCount', 'all', 'test-user'], mockUnreadData, {
      updatedAt: Date.now(),
    });

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper });

    await act(async () => {
      await result.current.prefetchCounts();
    });

    // Should not fetch since data is fresh
    expect(newsletterApi.getUnreadCount).not.toHaveBeenCalled();
    expect(newsletterApi.getUnreadCountBySource).not.toHaveBeenCalled();
  });

  it('should prefetch if data is stale', async () => {
    // Preload cache with stale data (6 minutes old)
    queryClient.setQueryData(['unreadCount', 'all', 'test-user'], mockUnreadData, {
      updatedAt: Date.now() - 6 * 60 * 1000,
    });

    vi.mocked(newsletterApi.getUnreadCount).mockResolvedValue(15);
    vi.mocked(newsletterApi.getUnreadCountBySource).mockResolvedValue({
      'source-1': 5,
      'source-2': 10,
    });

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper });

    await act(async () => {
      await result.current.prefetchCounts();
    });

    // Should fetch since data is stale
    expect(newsletterApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(newsletterApi.getUnreadCountBySource).toHaveBeenCalledTimes(1);
  });

  it('should not prefetch when user is not authenticated', async () => {
    const noAuthWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ ...mockAuth, user: null }}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => usePrefetchUnreadCounts(), { wrapper: noAuthWrapper });

    await act(async () => {
      await result.current.prefetchCounts();
    });

    expect(newsletterApi.getUnreadCount).not.toHaveBeenCalled();
    expect(newsletterApi.getUnreadCountBySource).not.toHaveBeenCalled();
  });
});
