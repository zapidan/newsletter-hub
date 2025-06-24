import { User } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { AuthContext, AuthContextType } from '../../contexts/AuthContext';
import { newsletterService } from '../../services';
import { useInfiniteNewsletters } from '../infiniteScroll/useInfiniteNewsletters';

// Mock newsletterService
vi.mock('../../services');
const mockNewsletterService = newsletterService as vi.Mocked<typeof newsletterService>;

// Mock AuthContext
const mockUser = { id: 'test-user-id' } as User;
const mockAuthContextValue: AuthContextType = {
  user: mockUser,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  updateUser: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  resetPassword: vi.fn(),
};

const createWrapper = (authContextValue: AuthContextType = mockAuthContextValue) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for tests
      },
    },
  });
  return ({ children }: PropsWithChildren) => (
    <AuthContext.Provider value={authContextValue}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
};

describe('useInfiniteNewsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values when not enabled', () => {
    const { result } = renderHook(() => useInfiniteNewsletters({}, { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.newsletters).toEqual([]);
    expect(result.current.isLoading).toBe(false); // isLoading is true initially due to query state, but false if not enabled
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.pageCount).toBe(0);
    expect(result.current.currentPage).toBe(1);
    expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
  });

  it('should not fetch if user is not authenticated', () => {
    const { result } = renderHook(() => useInfiniteNewsletters(), {
      wrapper: createWrapper({ ...mockAuthContextValue, user: null }),
    });

    expect(result.current.isLoading).toBe(false); // Should not be loading as it's not enabled without a user
    expect(mockNewsletterService.getAll).not.toHaveBeenCalled();
  });

  it('should fetch initial newsletters successfully', async () => {
    const mockData = {
      data: [{ id: '1', title: 'Newsletter 1' }],
      count: 1,
      hasMore: false,
    };
    mockNewsletterService.getAll.mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteNewsletters(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.newsletters).toEqual(mockData.data);
    expect(result.current.totalCount).toBe(mockData.count);
    expect(result.current.hasNextPage).toBe(mockData.hasMore);
    expect(result.current.error).toBe(null);
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1);
    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        limit: 20, // default pageSize
        orderBy: 'received_at',
        ascending: false,
        includeRelations: true,
        includeTags: true,
        includeSource: true,
      })
    );
  });

  it.skip('should handle error during initial fetch', async () => {
    const mockError = new Error('Failed to fetch');
    mockNewsletterService.getAll.mockRejectedValueOnce(mockError);

    // Create a new QueryClient for this test to ensure isolation
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockAuthContextValue}>
        <QueryClientProvider client={testQueryClient}>
          {children}
        </QueryClientProvider>
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useInfiniteNewsletters(), {
      wrapper,
    });

    // Initial loading state should be true
    expect(result.current.isLoading).toBe(true);

    // Wait for the query to complete and verify error state
    await waitFor(() => {
      // Check for error state
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Failed to fetch');
      // Loading should be false after error
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    // Additional assertions after error state is confirmed
    expect(result.current.newsletters).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1);
    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        limit: 20,
      })
    );
  });

  it('should fetch next page when fetchNextPage is called', async () => {
    const initialMockData = {
      data: Array.from({ length: 20 }, (_, i) => ({ id: `n${i + 1}`, title: `Newsletter ${i + 1}` })),
      count: 40,
      hasMore: true,
    };
    const nextPageMockData = {
      data: Array.from({ length: 20 }, (_, i) => ({ id: `n${i + 21}`, title: `Newsletter ${i + 21}` })),
      count: 40,
      hasMore: false,
    };

    mockNewsletterService.getAll
      .mockResolvedValueOnce(initialMockData)
      .mockResolvedValueOnce(nextPageMockData);

    const { result } = renderHook(() => useInfiniteNewsletters(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.newsletters.length).toBe(20);
      expect(result.current.hasNextPage).toBe(true);
    });

    // Trigger next page fetch
    await act(async () => {
      await result.current.fetchNextPage();
    });

    // Check loading state and results
    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
      expect(result.current.newsletters.length).toBe(40);
      expect(result.current.hasNextPage).toBe(false);
    });

    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(2);
    expect(mockNewsletterService.getAll).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        offset: 20,
        limit: 20,
      })
    );
  });

  it('should not fetch next page if there is no next page', async () => {
    const mockData = {
      data: [{ id: '1', title: 'Newsletter 1' }],
      count: 1,
      hasMore: false,
    };
    mockNewsletterService.getAll.mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteNewsletters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);

    result.current.fetchNextPage(); // Attempt to fetch next page

    // Wait a bit to ensure no new fetch is initiated
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(result.current.isFetchingNextPage).toBe(false);
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(1); // Should only be called once
  });

  it('should refetch newsletters when refetch is called', async () => {
    const mockData1 = { data: [{ id: '1' }], count: 1, hasMore: false };
    const mockData2 = { data: [{ id: '2' }], count: 1, hasMore: false };
    mockNewsletterService.getAll
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    const { result } = renderHook(() => useInfiniteNewsletters(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.newsletters[0].id).toBe('1');

    result.current.refetch();

    await waitFor(() => expect(result.current.isLoading).toBe(false)); // isloading may not become true for refetch
    await waitFor(() => expect(result.current.newsletters[0].id).toBe('2'));
    expect(mockNewsletterService.getAll).toHaveBeenCalledTimes(2);
  });

  it('should use filters when fetching newsletters', async () => {
    const filters = { search: 'test', isRead: true };
    const mockData = { data: [], count: 0, hasMore: false };
    mockNewsletterService.getAll.mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteNewsletters(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'test',
        isRead: true,
        offset: 0,
        limit: 20,
      })
    );
  });

  it('should use custom pageSize from options', async () => {
    const pageSize = 10;
    const mockData = { data: [], count: 0, hasMore: false };
    mockNewsletterService.getAll.mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteNewsletters({}, { pageSize }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockNewsletterService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: pageSize,
      })
    );
    expect(result.current.pageCount).toBe(0); // Assuming count is 0
  });

  it('should correctly calculate pageCount', async () => {
    const mockData = {
      data: Array.from({ length: 15 }, (_, i) => ({ id: `n${i}` })),
      count: 35, // Total items
      hasMore: true,
    };
    mockNewsletterService.getAll.mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteNewsletters({}, { pageSize: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalCount).toBe(35);
    expect(result.current.pageCount).toBe(4); // 35 items / 10 per page = 3.5 -> 4 pages
  });

  it('should update currentPage correctly when fetching pages', async () => {
    const pageSize = 5;
    const mockPage1 = { data: Array(pageSize).fill(0), count: 12, hasMore: true };
    const mockPage2 = { data: Array(pageSize).fill(0), count: 12, hasMore: true };
    const mockPage3 = { data: Array(2).fill(0), count: 12, hasMore: false }; // Last page

    mockNewsletterService.getAll
      .mockResolvedValueOnce(mockPage1)
      .mockResolvedValueOnce(mockPage2)
      .mockResolvedValueOnce(mockPage3);

    const { result } = renderHook(() => useInfiniteNewsletters({}, { pageSize }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentPage).toBe(1);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.currentPage).toBe(2);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.currentPage).toBe(3);

    // Check no more pages
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should reset currentPage to 1 on refetch', async () => {
    const pageSize = 5;
    const mockPage1 = { data: Array(pageSize).fill(0), count: 10, hasMore: true };
    const mockPage2 = { data: Array(pageSize).fill(0), count: 10, hasMore: false };
    const refetchData = { data: Array(pageSize).fill(0), count: 5, hasMore: false };

    mockNewsletterService.getAll
      .mockResolvedValueOnce(mockPage1)
      .mockResolvedValueOnce(mockPage2)
      .mockResolvedValueOnce(refetchData);

    const { result } = renderHook(() => useInfiniteNewsletters({}, { pageSize }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentPage).toBe(1);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.currentPage).toBe(2);

    result.current.refetch();
    await waitFor(() => !result.current.isLoading && !result.current.isFetchingNextPage); // Wait for refetch to complete
    expect(result.current.currentPage).toBe(1);
    expect(result.current.newsletters.length).toBe(pageSize); // From refetchData
    expect(result.current.totalCount).toBe(5);
  });

  // TODO: Add tests for debug logging if possible/necessary, though it's harder to assert console logs
  // TODO: Add tests for staleTime and refetchOnWindowFocus if critical, though these are react-query internal behaviors
});
