import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll/useInfiniteNewsletters';
import { newsletterService } from '@common/services/newsletter/NewsletterService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { vi } from 'vitest';

// Mock the newsletter service
vi.mock('@common/services/newsletter/NewsletterService', () => ({
  newsletterService: {
    getAll: vi.fn(),
  },
}));

// Mock the auth context
vi.mock('@common/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
  }),
}));

// Mock the query key factory
vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    newsletters: {
      infinite: vi.fn((filter) => ['newsletters', 'infinite', filter]),
    },
  },
}));

// Mock the normalize function
vi.mock('@common/utils/newsletterUtils', () => ({
  normalizeNewsletterFilter: (filter: any) => filter,
}));

describe('Reading Time Sorting Integration Tests', () => {
  let queryClient: QueryClient;
  let mockGetAll: vi.MockedFunction<typeof newsletterService.getAll>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockGetAll = newsletterService.getAll as vi.MockedFunction<typeof newsletterService.getAll>;

    // Reset all mocks
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  const createReadingTimeMockResponse = (orderDirection: 'asc' | 'desc') => ({
    data: [
      {
        id: '1',
        title: 'Quick Update',
        content: 'Short content',
        summary: 'Brief summary',
        image_url: '',
        received_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        is_read: false,
        is_archived: false,
        is_liked: false,
        user_id: 'test-user-id',
        newsletter_source_id: 'source-1',
        word_count: 100,
        estimated_read_time: orderDirection === 'asc' ? 1 : 10,
        tags: [],
        source: { id: 'source-1', name: 'Tech Newsletter' },
      },
      {
        id: '2',
        title: 'Detailed Analysis',
        content: 'Long content with lots of details',
        summary: 'Comprehensive summary',
        image_url: '',
        received_at: '2024-01-14T15:30:00Z',
        updated_at: '2024-01-14T15:30:00Z',
        is_read: false,
        is_archived: false,
        is_liked: false,
        user_id: 'test-user-id',
        newsletter_source_id: 'source-2',
        word_count: 1500,
        estimated_read_time: orderDirection === 'asc' ? 5 : 8,
        tags: [],
        source: { id: 'source-2', name: 'Business Weekly' },
      },
      {
        id: '3',
        title: 'In-Depth Report',
        content: 'Very long and detailed content',
        summary: 'Extensive summary',
        image_url: '',
        received_at: '2024-01-13T09:15:00Z',
        updated_at: '2024-01-13T09:15:00Z',
        is_read: false,
        is_archived: false,
        is_liked: false,
        user_id: 'test-user-id',
        newsletter_source_id: 'source-3',
        word_count: 3000,
        estimated_read_time: orderDirection === 'asc' ? 15 : 3,
        tags: [],
        source: { id: 'source-3', name: 'Research Journal' },
      },
    ],
    count: 3,
    hasMore: false,
    page: 1,
    limit: 20,
  });

  describe('Reading Time Sorting - End to End', () => {
    it('should sort newsletters by reading time in ascending order (shortest to longest)', async () => {
      const mockResponse = createReadingTimeMockResponse('asc');
      mockGetAll.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the API was called with correct parameters
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
          limit: 20,
          offset: 0,
        })
      );

      // Verify the newsletters are sorted by reading time (shortest to longest)
      expect(result.current.newsletters).toHaveLength(3);
      expect(result.current.newsletters[0].estimated_read_time).toBe(1);
      expect(result.current.newsletters[0].title).toBe('Quick Update');

      expect(result.current.newsletters[1].estimated_read_time).toBe(5);
      expect(result.current.newsletters[1].title).toBe('Detailed Analysis');

      expect(result.current.newsletters[2].estimated_read_time).toBe(15);
      expect(result.current.newsletters[2].title).toBe('In-Depth Report');
    });

    it('should sort newsletters by reading time in descending order (longest to shortest)', async () => {
      const mockResponse = createReadingTimeMockResponse('desc');
      mockGetAll.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'estimated_read_time',
          orderDirection: 'desc',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the API was called with correct parameters
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'desc',
          limit: 20,
          offset: 0,
        })
      );

      // Verify the newsletters are sorted by reading time (longest to shortest)
      expect(result.current.newsletters).toHaveLength(3);
      expect(result.current.newsletters[0].estimated_read_time).toBe(10);
      expect(result.current.newsletters[0].title).toBe('Quick Update');

      expect(result.current.newsletters[1].estimated_read_time).toBe(8);
      expect(result.current.newsletters[1].title).toBe('Detailed Analysis');

      expect(result.current.newsletters[2].estimated_read_time).toBe(3);
      expect(result.current.newsletters[2].title).toBe('In-Depth Report');
    });

    it('should handle reading time sort with additional filters', async () => {
      const mockResponse = createReadingTimeMockResponse('asc');
      mockGetAll.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
          isRead: false,
          search: 'analysis',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the API was called with all parameters
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
          isRead: false,
          search: 'analysis',
          limit: 20,
          offset: 0,
        })
      );

      expect(result.current.newsletters).toHaveLength(3);
      expect(result.current.newsletters[0].estimated_read_time).toBe(1);
    });

    it('should refetch when changing from reading time sort to other sort fields', async () => {
      const readingTimeResponse = createReadingTimeMockResponse('asc');
      const titleResponse = {
        ...readingTimeResponse,
        data: readingTimeResponse.data.sort((a, b) => a.title.localeCompare(b.title)),
      };

      // Initial call with reading time sort
      mockGetAll.mockResolvedValue(readingTimeResponse);

      const { result, rerender } = renderHook(
        ({ orderBy, orderDirection }) => useInfiniteNewsletters({ orderBy, orderDirection }),
        {
          wrapper,
          initialProps: { orderBy: 'estimated_read_time', orderDirection: 'asc' as const }
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify initial call
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
        })
      );

      // Change to title sort
      mockGetAll.mockResolvedValue(titleResponse);
      rerender({ orderBy: 'title', orderDirection: 'asc' as const });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the new call was made
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'title',
          orderDirection: 'asc',
        })
      );
    });

    it('should maintain reading time sort across infinite scroll pages', async () => {
      const firstPageResponse = {
        data: createReadingTimeMockResponse('asc').data.slice(0, 2),
        count: 5,
        hasMore: true,
        page: 1,
        limit: 2,
      };

      const secondPageResponse = {
        data: createReadingTimeMockResponse('asc').data.slice(2, 3),
        count: 5,
        hasMore: false,
        page: 2,
        limit: 2,
      };

      mockGetAll
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify first page
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
          limit: 20,
          offset: 0,
        })
      );

      expect(result.current.newsletters).toHaveLength(2);

      // Fetch next page
      await result.current.fetchNextPage();

      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false);
      });

      // Verify second page maintains same sort order
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
          limit: 20,
          offset: 2,
        })
      );

      expect(result.current.newsletters).toHaveLength(3);

      // Verify all items are still sorted by reading time
      const readTimes = result.current.newsletters.map(n => n.estimated_read_time);
      expect(readTimes).toEqual([1, 5, 15]);
    });

    it('should handle empty results with reading time sort', async () => {
      const emptyResponse = {
        data: [],
        count: 0,
        hasMore: false,
        page: 1,
        limit: 20,
      };

      mockGetAll.mockResolvedValue(emptyResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({
          orderBy: 'estimated_read_time',
          orderDirection: 'desc',
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'estimated_read_time',
          orderDirection: 'desc',
        })
      );

      expect(result.current.newsletters).toHaveLength(0);
      expect(result.current.hasNextPage).toBe(false);
    });
  });
});
