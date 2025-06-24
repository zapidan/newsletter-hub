import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@common/services/supabaseClient';
import { userService } from '@common/services/user/UserService';
import { useEmailAlias } from '../useEmailAlias';

vi.mock('@common/services/user/UserService');
vi.mock('@common/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

const mockUserService = vi.mocked(userService);
const mockSupabaseAuth = vi.mocked(supabase.auth);

const mockClipboard = { writeText: vi.fn() };
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard, writable: true, configurable: true,
});

const createQueryClient = (enableRetries = false) => new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      retry: enableRetries ? undefined : false,
      gcTime: Infinity,
      staleTime: 0,
      retryDelay: 10,
    }
  },
});

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockEmailAlias = 'alias@example.com';

describe('useEmailAlias', () => {
  let queryClient: QueryClient;
  let mockOnAuthStateChangeCallback: ((event: string, session: any) => void) | null = null;

  const wrapperFactory = (client: QueryClient) => ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();

    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: mockUser as any }, error: null });
    mockSupabaseAuth.onAuthStateChange.mockImplementation((callback) => {
      mockOnAuthStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });

    mockUserService.getEmailAlias.mockResolvedValue({ success: true, email: mockEmailAlias });
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockOnAuthStateChangeCallback = null;
    vi.useRealTimers();
    queryClient.clear();
  });

  it('should fetch and return email alias when user is authenticated', async () => {
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.emailAlias).toBe(mockEmailAlias), { timeout: 2000 });
    expect(result.current.loading).toBe(false);
  });

  it('should not fetch email alias if user is not authenticated initially', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockSupabaseAuth.onAuthStateChange.mockImplementationOnce((callback) => {
      mockOnAuthStateChangeCallback = callback;
      if (mockOnAuthStateChangeCallback) mockOnAuthStateChangeCallback("INITIAL_SESSION", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(mockUserService.getEmailAlias).not.toHaveBeenCalled();
  });

  it('should fetch alias when user logs in via onAuthStateChange', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { if (mockOnAuthStateChangeCallback) mockOnAuthStateChangeCallback('SIGNED_IN', { user: mockUser }); });
    await waitFor(() => expect(result.current.emailAlias).toBe(mockEmailAlias), { timeout: 2000 });
  });

  it('should handle error when fetching email alias fails (queryFn throws)', async () => {
    const apiError = new Error('API Error from service');
    mockUserService.getEmailAlias.mockRejectedValue(apiError);
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
    }, { timeout: 5000 });
    expect(result.current.error).toBe('Failed to load email alias');
  });

  it.skip('should copy email alias to clipboard and set copied state', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });

    // Wait for the email alias to be fetched and set
    await waitFor(() => expect(result.current.emailAlias).toBe(mockEmailAlias));

    // Call copyToClipboard
    await act(async () => {
      const success = await result.current.copyToClipboard();
      expect(success).toBe(true);
    });
    expect(mockClipboard.writeText).toHaveBeenCalledWith(mockEmailAlias);
    expect(result.current.copied).toBe(true);

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });

  it('copyToClipboard should return false and log error if clipboard write fails', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard write failed'));
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.emailAlias).toBe(mockEmailAlias));
    let copyResult: boolean | undefined;
    await act(async () => { copyResult = await result.current.copyToClipboard(); });
    expect(copyResult).toBe(false);
  });

  it('copyToClipboard should do nothing if emailAlias is empty', async () => {
    mockUserService.getEmailAlias.mockResolvedValueOnce({ success: true, email: '' });
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.emailAlias).toBe(''));
    await act(async () => { await result.current.copyToClipboard(); });
    expect(mockClipboard.writeText).not.toHaveBeenCalled();
  });

  it('refresh function should call refetch from useQuery and update data', async () => {
    mockUserService.getEmailAlias.mockResolvedValueOnce({ success: true, email: 'initial@alias.com' });
    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });
    await waitFor(() => expect(result.current.emailAlias).toBe('initial@alias.com'));

    mockUserService.getEmailAlias.mockResolvedValueOnce({ success: true, email: 'refreshed@alias.com' });
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.emailAlias).toBe('refreshed@alias.com'));
    expect(mockUserService.getEmailAlias).toHaveBeenCalledTimes(2);
  });

  it.skip('should use custom retry logic (no retry on auth error, retry up to 2 times on other errors)', async () => {
    vi.useFakeTimers();
    const retryQueryClient = createQueryClient(true); // Enable retries for this test
    const retryWrapper = wrapperFactory(retryQueryClient);
    const authMissingError = new Error('Auth session missing');
    const networkError = new Error('Network failed');

    // Scenario 1: Auth error
    mockUserService.getEmailAlias.mockReset();
    mockUserService.getEmailAlias.mockRejectedValueOnce(authMissingError);
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: mockUser as any }, error: null });
    const { result: resultAuthError } = renderHook(() => useEmailAlias(), { wrapper: retryWrapper });
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => {
      expect(resultAuthError.current.loading).toBe(false);
      expect(resultAuthError.current.error).toBe('Failed to load email alias');
    }, { timeout: 2000 });
    expect(mockUserService.getEmailAlias).toHaveBeenCalledTimes(1);

    // Scenario 2: Network error
    retryQueryClient.clear();
    mockUserService.getEmailAlias.mockReset();
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: mockUser as any }, error: null });
    mockUserService.getEmailAlias
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ success: true, email: 'retried@alias.com' });
    const { result: resultRetry } = renderHook(() => useEmailAlias(), { wrapper: retryWrapper });

    await act(async () => { await vi.runAllTimersAsync(); }); // Initial + first failure + schedules first retry
    await act(async () => { await vi.runAllTimersAsync(); }); // First retry + second failure + schedules second retry
    await act(async () => { await vi.runAllTimersAsync(); }); // Second retry + success

    await waitFor(() => {
      expect(resultRetry.current.loading).toBe(false);
      expect(resultRetry.current.emailAlias).toBe('retried@alias.com');
    }, { timeout: 5000 });
    expect(mockUserService.getEmailAlias).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('should unsubscribe from onAuthStateChange on unmount', async () => {
    const mockUnsubscribe = vi.fn();
    mockSupabaseAuth.onAuthStateChange.mockImplementationOnce(() => {
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } } as any;
    });

    const { unmount } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });

    // Wait for initial setup
    await waitFor(() => expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled());

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('refresh function should do nothing if user is not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    // Ensure onAuthStateChange also reflects no user initially
    mockSupabaseAuth.onAuthStateChange.mockImplementationOnce((callback) => {
      mockOnAuthStateChangeCallback = callback;
      if (mockOnAuthStateChangeCallback) mockOnAuthStateChangeCallback("INITIAL_SESSION", null); // Simulate initial state with no user
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });

    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });

    // Wait for the hook to stabilize with no user
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emailAlias).toBe('');
    expect(mockUserService.getEmailAlias).not.toHaveBeenCalled(); // Ensure it wasn't called

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });

    // getEmailAlias should still not have been called
    expect(mockUserService.getEmailAlias).not.toHaveBeenCalled();
  });

  it('should not set hook error state if userService.getEmailAlias resolves with success:false', async () => {
    const serviceErrorMessage = 'Service-level error message';
    mockUserService.getEmailAlias.mockResolvedValue({ success: false, email: '', error: serviceErrorMessage });

    const { result } = renderHook(() => useEmailAlias(), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.emailAlias).toBe(''); // Email should be empty
    expect(result.current.error).toBeNull(); // Hook's error state should be null
    expect(mockUserService.getEmailAlias).toHaveBeenCalledTimes(1);
  });
});
