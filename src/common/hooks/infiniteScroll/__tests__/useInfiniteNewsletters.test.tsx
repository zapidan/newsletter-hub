import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useInfiniteNewsletters, UseInfiniteNewslettersOptions } from '../useInfiniteNewsletters';
import { newsletterService } from '@common/services';
import { useAuth } from '@common/contexts/AuthContext';
import { NewsletterFilter } from '@common/types/cache';
import { NewsletterWithRelations } from '@common/types';

// Mock dependencies
vi.mock('@common/services');
vi.mock('@common/contexts/AuthContext');
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockNewsletterService = vi.mocked(newsletterService);
const mockUseAuth = vi.mocked(useAuth);

const createMockNewsletter = (id: string): NewsletterWithRelations => ({
  id,
  title: `Newsletter ${id}`,
  content: `Content ${id}`,
  received_at: new Date().toISOString(),
  // Add other required fields...
  summary: '',
  image_url: '',
  is_read: false,
  is_liked: false,
  is_archived: false,
  updated_at: new Date().toISOString(),
  estimated_read_time: 5,
  word_count: 100,
  source: { id: 's1', name: 'Source 1', from: 's@e.com', user_id: 'u1', created_at: '', updated_at: '' },
  tags: [],
  newsletter_source_id: 's1',
  user_id: 'u1',
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries for tests to make them faster and more predictable
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useInfiniteNewsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear(); // Clear query cache before each test
    mockUseAuth.mockReturnValue({ user: { id: 'test-user' } } as any); // Default to authenticated user
  });

  it('should fetch initial page of newsletters', async () => {
    const mockPageSize = 5;
    const mockDataPage1 = Array(mockPageSize).fill(null).map((_, i) => createMockNewsletter(`nl1-${i}`));
    mockNewsletterService.getAll.mockResolvedValueOnce({
      data: mockDataPage1,
      count: 10, // Total 2 pages
      page: 1,
      limit: mockPageSize,
      hasMore: true,
      nextPage: 2,
      prevPage: null,
    });

    const { result } = renderHook(
      () => useInfiniteNewsletters({}, { pageSize: mockPageSize }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.newsletters.length).toBe(mockPageSize);
    expect(result.current.newsletters.map(n => n.id)).toEqual(mockDataPage1.map(n => n.id));
    expect(result.current.totalCount).toBe(10);
    expect(result.current.pageCount).toBe(2);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.currentPage).toBe(1);
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1);
    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: mockPageSize,
      offset: 0,
    }));
  });

  it('should fetch next page when fetchNextPage is called', async () => {
    const mockPageSize = 3;
    const mockDataPage1 = Array(mockPageSize).fill(null).map((_, i) => createMockNewsletter(`nl1-${i}`));
    const mockDataPage2 = Array(mockPageSize).fill(null).map((_, i) => createMockNewsletter(`nl2-${i}`));

    mockNewsletterService.getAll
      .mockResolvedValueOnce({ data: mockDataPage1, count: mockPageSize * 2, page:1, limit: mockPageSize, hasMore: true, nextPage:2, prevPage: null })
      .mockResolvedValueOnce({ data: mockDataPage2, count: mockPageSize * 2, page:2, limit: mockPageSize, hasMore: false, nextPage:null, prevPage: 1 });

    const { result } = renderHook(
      () => useInfiniteNewsletters({}, { pageSize: mockPageSize }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.newsletters.length).toBe(mockPageSize);

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

    expect(result.current.newsletters.length).toBe(mockPageSize * 2);
    expect(result.current.newsletters.map(n => n.id)).toEqual([...mockDataPage1, ...mockDataPage2].map(n => n.id));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.currentPage).toBe(2);
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(2);
    expect(mockNewsletterService.getAll).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: mockPageSize,
      offset: mockPageSize, // Offset for the second page
    }));
  });

  it('should correctly set hasNextPage to false when last page is fetched', async () => {
    const mockPageSize = 5;
    mockNewsletterService.getAll.mockResolvedValueOnce({
      data: Array(3).fill(null).map((_, i) => createMockNewsletter(`nl1-${i}`)), // Fewer than page size
      count: 3,
      page: 1,
      limit: mockPageSize,
      hasMore: false, // API indicates no more pages
      nextPage: null,
      prevPage: null,
    });

    const { result } = renderHook(
      () => useInfiniteNewsletters({}, { pageSize: mockPageSize }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should update query key and refetch when filters change', async () => {
    mockNewsletterService.getAll
      .mockResolvedValueOnce({ data: [createMockNewsletter('nl-initial')], count: 1, page:1, limit:5, hasMore: false, nextPage:null, prevPage:null })
      .mockResolvedValueOnce({ data: [createMockNewsletter('nl-filtered')], count: 1, page:1, limit:5, hasMore: false, nextPage:null, prevPage:null });

    const initialFilters: NewsletterFilter = { isRead: false };
    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteNewsletters(filters, { pageSize: 5 }),
      { initialProps: { filters: initialFilters }, wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1);
    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(expect.objectContaining({ isRead: false, offset: 0 }));
    expect(result.current.newsletters[0].id).toBe('nl-initial');

    const newFilters: NewsletterFilter = { isRead: true };
    rerender({ filters: newFilters });

    await waitFor(() => expect(result.current.isLoading).toBe(false)); // It might become true briefly
    // After filters change, useInfiniteQuery should refetch.
    // Depending on timing, isLoading might not capture the brief loading state for the new query.
    // We need to wait for the second call to getAll to complete.
    await waitFor(() => expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(2), { timeout: 2000 });

    expect(mockNewsletterService.getAll).toHaveBeenNthCalledWith(2, expect.objectContaining({ isRead: true, offset: 0 }));
    expect(result.current.newsletters[0].id).toBe('nl-filtered');
  });

  it('should handle API error during fetch', async () => {
    const mockError = new Error('API fetch failed');
    // Use mockRejectedValue so all retries (if any) also fail
    mockNewsletterService.getAll.mockRejectedValue(mockError);

    const { result } = renderHook(() => useInfiniteNewsletters(), { wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 7500 }); // Increased timeout for retries
    // After error is set, isLoading should definitely be false.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
    expect(result.current.newsletters).toEqual([]);
  });

  it('should not fetch if enabled is false', async () => {
    renderHook(() => useInfiniteNewsletters({}, { enabled: false }), { wrapper });
    // Wait a bit to ensure no calls are made
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
  });

  it('should not fetch if user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);
    renderHook(() => useInfiniteNewsletters(), { wrapper });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
  });

  it('refetch function should reset to page 1 and fetch data', async () => {
    mockNewsletterService.getAll
      .mockResolvedValueOnce({ data: [createMockNewsletter('nl-page1')], count: 2, page:1, limit:1, hasMore: true, nextPage:2, prevPage:null })
      .mockResolvedValueOnce({ data: [createMockNewsletter('nl-page2')], count: 2, page:2, limit:1, hasMore: false, nextPage:null, prevPage:1 }) // For fetchNextPage
      .mockResolvedValueOnce({ data: [createMockNewsletter('nl-refetched')], count: 1, page:1, limit:1, hasMore: false, nextPage:null, prevPage:null }); // For refetch

    const { result } = renderHook(() => useInfiniteNewsletters({}, { pageSize: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.fetchNextPage());
    await waitFor(() => !result.current.isFetchingNextPage && result.current.newsletters.length === 2);
    expect(result.current.currentPage).toBe(2);

    act(() => { result.current.refetch(); });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => result.current.newsletters[0]?.id === 'nl-refetched');


    expect(result.current.newsletters.length).toBe(1);
    expect(result.current.newsletters[0].id).toBe('nl-refetched');
    expect(result.current.currentPage).toBe(1); // Should reset to page 1
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(3);
    expect(mockNewsletterService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
  });

});
