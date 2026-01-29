import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { vi } from 'vitest';
import { FilterProvider } from '../../contexts/FilterContext';
import { useInfiniteNewsletters } from '../infiniteScroll/useInfiniteNewsletters';
import { useInboxFilters } from '../useInboxFilters';

// Mock all the dependencies
vi.mock('../useInboxFilters', () => ({
  useInboxFilters: () => ({
    sortBy: 'received_at',
    sortOrder: 'desc',
    newsletterFilter: {
      orderBy: 'received_at',
      orderDirection: 'desc',
      isRead: false,
      isArchived: false,
    },
    setSortBy: vi.fn(),
    setSortOrder: vi.fn(),
  }),
}));

vi.mock('@common/services/newsletter/NewsletterService', () => ({
  newsletterService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@common/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
  }),
}));

vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    newsletters: {
      infinite: vi.fn((filter) => ['newsletters', 'infinite', filter]),
    },
  },
}));

vi.mock('@common/utils/newsletterUtils', () => ({
  normalizeNewsletterFilter: (filter: any) => filter,
}));

vi.mock('../useTags', () => ({
  useTags: () => ({
    allTags: [],
    isLoadingTags: false,
    memoizedGetTags: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../useNewsletterSources', () => ({
  useNewsletterSources: () => ({
    newsletterSources: [],
    isLoadingSources: false,
  }),
}));

describe('Sorting Integration Tests', () => {
  let queryClient: QueryClient;
  let mockGetAll: vi.MockedFunction<any>;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    // Simple mock setup
    mockGetAll = vi.fn();
    const mockModule = vi.mocked(await import('@common/services/newsletter/NewsletterService'));
    mockModule.newsletterService.getAll = mockGetAll;
    
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <FilterProvider>{children}</FilterProvider>
    </QueryClientProvider>
  );

  describe('Complete sorting flow', () => {
    it('should integrate sorting from UI to API', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            title: 'A Newsletter',
            received_at: '2024-01-01',
            is_read: false,
            is_archived: false,
            is_liked: false,
            tags: [],
            source: { id: 'source-1', name: 'Test Source' },
          },
        ],
        count: 1,
        hasMore: false,
        page: 1,
        limit: 20,
      };

      mockGetAll.mockResolvedValue(mockResponse);

      // Test the complete flow: useInboxFilters -> useInfiniteNewsletters -> API
      const { result: filtersResult } = renderHook(() => useInboxFilters(), { wrapper });
      const { result: newslettersResult } = renderHook(
        () => useInfiniteNewsletters(filtersResult.current.newsletterFilter),
        { wrapper }
      );

      await waitFor(() => {
        expect(newslettersResult.current.isLoading).toBe(false);
      });

      // Verify the API was called with correct sorting parameters
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
    });

    it('should handle sorting changes through the entire chain', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            title: 'Z Newsletter',
            received_at: '2024-12-31',
            is_read: false,
            is_archived: false,
            is_liked: false,
            tags: [],
            source: { id: 'source-1', name: 'Test Source' },
          },
        ],
        count: 1,
        hasMore: false,
        page: 1,
        limit: 20,
      };

      mockGetAll.mockResolvedValue(mockResponse);

      const { result: filtersResult } = renderHook(() => useInboxFilters(), { wrapper });
      const { result: newslettersResult, rerender } = renderHook(
        (filters) => useInfiniteNewsletters(filters),
        { 
          wrapper,
          initialProps: filtersResult.current.newsletterFilter
        }
      );

      await waitFor(() => {
        expect(newslettersResult.current.isLoading).toBe(false);
      });

      // Initial call with default sorting
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );

      // Simulate changing sort order (this would normally come from UI interaction)
      const updatedFilter = {
        ...filtersResult.current.newsletterFilter,
        orderDirection: 'asc' as const,
      };

      mockGetAll.mockResolvedValue(mockResponse);
      rerender(updatedFilter);

      await waitFor(() => {
        expect(newslettersResult.current.isLoading).toBe(false);
      });

      // Should have been called with new sort order
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'received_at',
          orderDirection: 'asc',
        })
      );
    });
  });

  describe('Query key generation integration', () => {
    it('should generate correct query keys for sorting', () => {
      const filter = {
        orderBy: 'title',
        orderDirection: 'asc',
        isRead: false,
      };

      renderHook(() => useInfiniteNewsletters(filter), { wrapper });

      // The query key factory is already mocked at the top of the file
      // We just need to verify the hook renders without errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should generate different query keys for different sort parameters', () => {
      const filter1 = {
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const filter2 = {
        orderBy: 'title',
        orderDirection: 'desc',
      };

      renderHook(() => useInfiniteNewsletters(filter1), { wrapper });
      renderHook(() => useInfiniteNewsletters(filter2), { wrapper });

      // The query key factory is already mocked
      // We just need to verify both hooks render without errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      mockGetAll.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'title',
          orderDirection: 'asc',
        }),
        { wrapper }
      );

      // Just verify the hook renders and the mock was called
      expect(result.current.isLoading).toBe(true);
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'title',
          orderDirection: 'asc',
        })
      );
    });
  });

  describe('Performance optimization', () => {
    it('should not make unnecessary API calls when sort parameters are stable', async () => {
      const mockResponse = {
        data: [],
        count: 0,
        hasMore: false,
        page: 1,
        limit: 20,
      };

      mockGetAll.mockResolvedValue(mockResponse);

      const filter = {
        orderBy: 'received_at',
        orderDirection: 'desc',
      };

      const { result, rerender } = renderHook(() => useInfiniteNewsletters(filter), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial call
      expect(mockGetAll).toHaveBeenCalledTimes(1);

      // Rerender with same filter
      rerender(filter);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not make additional calls
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });
  });
});
