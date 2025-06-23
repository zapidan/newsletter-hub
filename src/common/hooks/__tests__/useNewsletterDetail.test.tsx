import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useNewsletterDetail, usePrefetchNewsletterDetail } from '../useNewsletterDetail';
import { supabase } from '@common/services/supabaseClient';
import * as cacheUtils from '@common/utils/cacheUtils';
import { AuthContext } from '@common/contexts/AuthContext';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { NewsletterWithRelations } from '@common/types';


// Mock dependencies
vi.mock('@common/services/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }), // Default single mock
  },
}));
vi.mock('@common/utils/cacheUtils');
vi.mock('@common/utils/logger', () => ({
  useLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }, // If logger is directly imported
}));


const mockSupabase = vi.mocked(supabase);
const mockGetCacheManagerSafe = vi.mocked(cacheUtils.getCacheManagerSafe);
const mockGetQueriesData = vi.mocked(cacheUtils.getQueriesData);
const mockGetQueryData = vi.mocked(cacheUtils.getQueryData);
const mockGetQueryState = vi.mocked(cacheUtils.getQueryState);
const mockPrefetchQueryUtil = vi.mocked(cacheUtils.prefetchQuery);


const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockNewsletterId = 'nl-abc';

const createMockNewsletterData = (id: string, overrides: Partial<NewsletterWithRelations> = {}): NewsletterWithRelations => ({
  id,
  title: `Title ${id}`,
  content: `Content ${id}`,
  summary: `Summary ${id}`,
  image_url: '',
  received_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: mockUser.id,
  newsletter_source_id: 'src-1',
  word_count: 100,
  estimated_read_time: 1,
  source: { id: 'src-1', name: 'Source 1', from: 'a@b.c', user_id: mockUser.id, created_at:'', updated_at:'' },
  tags: [],
  ...overrides,
});

const mockFullNewsletterData = createMockNewsletterData(mockNewsletterId, {
  // No tags here, will be added in the raw data structure for the mock response
});

// This is what the Supabase query in the hook would return before transformation
const mockSupabaseRawDataWithTags = {
  ...createMockNewsletterData(mockNewsletterId), // Base fields
  tags: [ { tag: { id: 'tag-1', name: 'Tag One', color: '#ff0000', user_id: mockUser.id, created_at: '' } } ],
};
// This is what the hook should transform it into
const mockExpectedTransformedDataWithTags = {
  ...createMockNewsletterData(mockNewsletterId),
  tags: [{ id: 'tag-1', name: 'Tag One', color: '#ff0000', user_id: mockUser.id, created_at: '' }],
};


const createQueryClient = () => new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity,
      staleTime: 0,
    },
  },
});


describe('useNewsletterDetail', () => {
  let queryClient: QueryClient;

  const wrapperFactory = (client: QueryClient, user: any = mockUser) =>
    ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() } as any}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetCacheManagerSafe.mockReturnValue(null);
    mockGetQueriesData.mockReturnValue([]);
    mockGetQueryData.mockReturnValue(undefined);
    mockGetQueryState.mockReturnValue(undefined);

    // Reset supabase mocks to return `this` for chaining, and default resolutions for terminal methods
    const supabaseMockObject = mockSupabase as any; // Cast to allow dynamic method mocking
    supabaseMockObject.from.mockClear().mockReturnThis();
    supabaseMockObject.select.mockClear().mockReturnThis();
    supabaseMockObject.eq.mockClear().mockReturnThis();
    supabaseMockObject.single.mockClear().mockResolvedValue({ data: null, error: null });
    // Add other chained methods if used by the hook directly on supabaseMockObject
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it('should fetch newsletter details successfully and transform tags', async () => {
    mockSupabase.from('newsletters').select().eq().eq().single.mockResolvedValueOnce({
      data: mockSupabaseRawDataWithTags, // Use the raw structure here
      error: null,
    });

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.newsletter).toEqual(mockExpectedTransformedDataWithTags); // Expect transformed data
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
    expect(mockSupabase.select).toHaveBeenCalledWith(expect.stringContaining('*'));
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockNewsletterId);
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    expect(mockSupabase.single).toHaveBeenCalledTimes(1);
  });

  it('should return error state if fetch fails', async () => {
  it('should return error state if fetch fails', async () => {
    const mockApiError = { message: 'Fetch failed', code: 'DB_ERROR', details: '', hint: '' };

    // Make the mock persistent for potential retries from React Query
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: mockApiError });
    const eqMock2 = vi.fn().mockReturnValueOnce({ single: singleMock }); // These can be Once if only one path to single
    const eqMock1 = vi.fn().mockReturnValueOnce({ eq: eqMock2 });
    const selectMock = vi.fn().mockReturnValueOnce({ eq: eqMock1 });
    vi.mocked(mockSupabase.from).mockReturnValueOnce({ select: selectMock });

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true), {timeout: 5000}); // Increased timeout for retries

    expect(result.current.newsletter).toBeUndefined();
    expect(result.current.error?.message).toBe(mockApiError.message);
  });

  it('should be disabled if newsletterId is empty', async () => {
    const { result } = renderHook(() => useNewsletterDetail(''), { wrapper: wrapperFactory(queryClient) });

    // Query should not run, isLoading should remain false (initial state)
    // Need a brief moment for hooks to settle if they were to run
    await act(() => new Promise(r => setTimeout(r, 50)));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockSupabase.single).not.toHaveBeenCalled();
  });

  it('should be disabled if user is not authenticated', async () => {
    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient, null) }); // No user
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockSupabase.single).not.toHaveBeenCalled();
  });

  it('should use initialData from cache if available', async () => {
    const cachedNewsletter = createMockNewsletterData(mockNewsletterId, { title: 'Cached Title' });
    mockGetQueriesData.mockReturnValue([
      [queryKeyFactory.newsletters.list(), { data: [cachedNewsletter] }],
    ]);
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: Date.now() } as any);
    // Supabase mock should not be called if initialData is used and fresh
    mockSupabase.single.mockResolvedValue({data: null, error: new Error("Should not be called")});


    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    // Should immediately have data and not be loading
    expect(result.current.isLoading).toBe(false);
    expect(result.current.newsletter).toEqual(cachedNewsletter);
    expect(mockSupabase.single).not.toHaveBeenCalled();
  });

  // More tests to be added for retry, prefetchRelated, usePrefetchNewsletterDetail etc.

});


describe('usePrefetchNewsletterDetail', () => {
  let queryClient: QueryClient;
   const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user: mockUser, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() } as any}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should call prefetchQuery utility when prefetchNewsletter is invoked', async () => {
    mockGetQueryData.mockReturnValue(undefined); // No existing data
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: 0 } as any); // Stale
    mockPrefetchQueryUtil.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePrefetchNewsletterDetail(), { wrapper });

    await act(async () => {
      await result.current.prefetchNewsletter(mockNewsletterId);
    });

    expect(mockPrefetchQueryUtil).toHaveBeenCalledTimes(1);
    expect(mockPrefetchQueryUtil).toHaveBeenCalledWith(
      queryKeyFactory.newsletters.detail(mockNewsletterId),
      expect.any(Function), // The queryFn
      expect.objectContaining({ staleTime: expect.any(Number) })
    );
  });

  it('should not prefetch if data is already cached and fresh', async () => {
    mockGetQueryData.mockReturnValue(mockFullNewsletterData); // Data exists
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: Date.now() } as any); // Fresh

    const { result } = renderHook(() => usePrefetchNewsletterDetail(), { wrapper });
    await act(async () => {
      await result.current.prefetchNewsletter(mockNewsletterId);
    });
    expect(mockPrefetchQueryUtil).not.toHaveBeenCalled();
  });

});
