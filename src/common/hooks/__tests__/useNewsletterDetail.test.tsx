import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@common/contexts/AuthContext';
import { NewsletterService } from '@common/services';
import { NewsletterWithRelations } from '@common/types';
import * as cacheUtils from '@common/utils/cacheUtils';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { useNewsletterDetail, usePrefetchNewsletterDetail } from '../useNewsletterDetail';

// Mock dependencies
vi.mock('@common/services', () => ({
  NewsletterService: vi.fn(),
}));

vi.mock('@common/utils/cacheUtils');
vi.mock('@common/utils/logger', () => ({
  useLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }, // If logger is directly imported
}));

// Mock dynamic imports
vi.mock('@common/api/tagApi', () => ({
  tagApi: {
    getById: vi.fn(),
  },
}));

vi.mock('@common/api/newsletterSourceApi', () => ({
  newsletterSourceApi: {
    getById: vi.fn(),
  },
}));

const mockNewsletterService = vi.mocked(NewsletterService);
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
  source: { id: 'src-1', name: 'Source 1', from: 'a@b.c', user_id: mockUser.id, created_at: '', updated_at: '' },
  tags: [],
  ...overrides,
});

const mockFullNewsletterData = createMockNewsletterData(mockNewsletterId, {
  tags: [{ id: 'tag-1', name: 'Tag One', color: '#ff0000', user_id: mockUser.id, created_at: '' }],
});

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
  let mockServiceInstance: any;

  const wrapperFactory = (client: QueryClient, user: any = mockUser) =>
    ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={{ user, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() } as any}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </AuthContext.Provider>
    );

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();

    // Setup mock service instance
    mockServiceInstance = {
      getNewsletter: vi.fn(),
      getNewsletters: vi.fn(),
    };
    mockNewsletterService.mockImplementation(() => mockServiceInstance);

    mockGetCacheManagerSafe.mockReturnValue(null);
    mockGetQueriesData.mockReturnValue([]);
    mockGetQueryData.mockReturnValue(undefined);
    mockGetQueryState.mockReturnValue(undefined);
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it('should fetch newsletter details successfully', async () => {
    mockServiceInstance.getNewsletter.mockResolvedValueOnce(mockFullNewsletterData);

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.newsletter).toEqual(mockFullNewsletterData);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockServiceInstance.getNewsletter).toHaveBeenCalledWith(mockNewsletterId);
  });

  it('should return error state if fetch fails', async () => {
    const mockError = new Error('Newsletter not found');
    mockServiceInstance.getNewsletter.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 }); // Increased timeout for retries

    expect(result.current.newsletter).toBeUndefined();
    expect(result.current.error?.message).toBe('Newsletter not found');
    expect(mockServiceInstance.getNewsletter).toHaveBeenCalledWith(mockNewsletterId);
  });

  it('should return error state if newsletter is not found', async () => {
    mockServiceInstance.getNewsletter.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.newsletter).toBeUndefined();
    expect(result.current.error?.message).toBe('Newsletter not found');
    expect(mockServiceInstance.getNewsletter).toHaveBeenCalledWith(mockNewsletterId);
  });

  it('should be disabled if newsletterId is empty', async () => {
    const { result } = renderHook(() => useNewsletterDetail(''), { wrapper: wrapperFactory(queryClient) });

    // Query should not run, isLoading should remain false (initial state)
    // Need a brief moment for hooks to settle if they were to run
    await act(() => new Promise(r => setTimeout(r, 50)));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockServiceInstance.getNewsletter).not.toHaveBeenCalled();
  });

  it('should be disabled if user is not authenticated', async () => {
    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient, null) }); // No user
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockServiceInstance.getNewsletter).not.toHaveBeenCalled();
  });

  it('should use initialData from cache if available', async () => {
    const cachedNewsletter = createMockNewsletterData(mockNewsletterId, { title: 'Cached Title' });
    mockGetQueriesData.mockReturnValue([
      [queryKeyFactory.newsletters.list(), { data: [cachedNewsletter] }],
    ]);
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: Date.now() } as any);
    // Service mock should not be called if initialData is used and fresh
    mockServiceInstance.getNewsletter.mockResolvedValue(new Error("Should not be called"));

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId), { wrapper: wrapperFactory(queryClient) });

    // Should immediately have data and not be loading
    expect(result.current.isLoading).toBe(false);
    expect(result.current.newsletter).toEqual(cachedNewsletter);
    expect(mockServiceInstance.getNewsletter).not.toHaveBeenCalled();
  });

  it('should handle prefetchRelated with tags and source', async () => {
    const newsletterWithRelations = createMockNewsletterData(mockNewsletterId, {
      tags: [{ id: 'tag-1', name: 'Tag One', color: '#ff0000', user_id: mockUser.id, created_at: '' }],
      source: { id: 'src-1', name: 'Source 1', from: 'a@b.c', user_id: mockUser.id, created_at: '', updated_at: '' },
    });

    mockServiceInstance.getNewsletter.mockResolvedValueOnce(newsletterWithRelations);
    mockServiceInstance.getNewsletters.mockResolvedValue({ data: [] });
    mockPrefetchQueryUtil.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNewsletterDetail(mockNewsletterId, { prefetchTags: true, prefetchSource: true }), {
      wrapper: wrapperFactory(queryClient)
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Call prefetchRelated
    await act(async () => {
      await result.current.prefetchRelated();
    });

    // Verify that prefetchQuery was called for the related data
    expect(mockPrefetchQueryUtil).toHaveBeenCalled();
  });

});

describe('usePrefetchNewsletterDetail', () => {
  let queryClient: QueryClient;
  let mockServiceInstance: any;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user: mockUser, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() } as any}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();

    // Setup mock service instance
    mockServiceInstance = {
      getNewsletter: vi.fn(),
    };
    mockNewsletterService.mockImplementation(() => mockServiceInstance);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should call prefetchQuery utility when prefetchNewsletter is invoked', async () => {
    mockGetQueryData.mockReturnValue(undefined); // No existing data
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: 0 } as any); // Stale
    mockPrefetchQueryUtil.mockResolvedValueOnce(undefined);
    mockServiceInstance.getNewsletter.mockResolvedValueOnce(mockFullNewsletterData);

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

  it('should handle service errors gracefully in prefetch', async () => {
    mockGetQueryData.mockReturnValue(undefined); // No existing data
    mockGetQueryState.mockReturnValue({ dataUpdatedAt: 0 } as any); // Stale
    mockServiceInstance.getNewsletter.mockRejectedValueOnce(new Error('Service error'));
    mockPrefetchQueryUtil.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePrefetchNewsletterDetail(), { wrapper });

    // Should not throw
    await act(async () => {
      await result.current.prefetchNewsletter(mockNewsletterId);
    });

    // The service should be called as part of the prefetch query function
    expect(mockPrefetchQueryUtil).toHaveBeenCalled();
  });
});
