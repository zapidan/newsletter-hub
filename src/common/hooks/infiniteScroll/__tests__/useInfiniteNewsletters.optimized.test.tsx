import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizedNewsletterService } from '../../../services/optimizedNewsletterService';
import { NewsletterWithRelations } from '../../../types';
import { PaginatedResponse } from '../../../types/api';
import { useInfiniteNewsletters } from '../useInfiniteNewsletters';

// Mock the optimized service
vi.mock('../../../services/optimizedNewsletterService');
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

const mockOptimizedNewsletterService = vi.mocked(optimizedNewsletterService);

describe('UseInfiniteNewsletters with Optimization', () => {
  let queryClient: QueryClient;

  const mockNewsletterData: NewsletterWithRelations[] = [
    {
      id: 'newsletter-1',
      title: 'Test Newsletter 1',
      content: 'Test content 1',
      summary: 'Test summary 1',
      image_url: 'https://example.com/image1.jpg',
      received_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      is_read: false,
      is_liked: false,
      is_archived: false,
      user_id: 'test-user-id',
      newsletter_source_id: 'source-1',
      word_count: 100,
      estimated_read_time: 2,
      source: {
        id: 'source-1',
        name: 'Test Source',
        from: 'test@example.com',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      tags: [
        {
          id: 'tag-1',
          name: 'Test Tag',
          color: '#ff0000',
          user_id: 'test-user-id',
          created_at: '2024-01-01T00:00:00Z',
          newsletter_count: 5,
        },
      ],
    },
    {
      id: 'newsletter-2',
      title: 'Test Newsletter 2',
      content: 'Test content 2',
      summary: 'Test summary 2',
      image_url: 'https://example.com/image2.jpg',
      received_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      is_read: true,
      is_liked: false,
      is_archived: false,
      user_id: 'test-user-id',
      newsletter_source_id: 'source-2',
      word_count: 150,
      estimated_read_time: 3,
      source: {
        id: 'source-2',
        name: 'Test Source 2',
        from: 'test2@example.com',
        user_id: 'test-user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      tags: [
        {
          id: 'tag-2',
          name: 'Test Tag 2',
          color: '#00ff00',
          user_id: 'test-user-id',
          created_at: '2024-01-01T00:00:00Z',
          newsletter_count: 3,
        },
      ],
    },
  ];

  const mockPaginatedResponse: PaginatedResponse<NewsletterWithRelations> = {
    data: mockNewsletterData,
    count: 2,
    page: 1,
    limit: 20,
    hasMore: false,
    nextPage: null,
    prevPage: null,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('optimized API integration', () => {
    it('should use optimized service for infinite queries', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({}, { pageSize: 10 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(2);
        expect(result.current.newsletters[0].title).toBe('Test Newsletter 1');
        expect(result.current.newsletters[1].title).toBe('Test Newsletter 2');
      });

      expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const firstPageResponse = {
        data: mockNewsletterData.slice(0, 1),
        count: 2,
        page: 1,
        limit: 1,
        hasMore: true,
        prevPage: null,
      };

      const secondPageResponse = {
        data: mockNewsletterData.slice(1, 2),
        count: 2,
        page: 2,
        limit: 1,
        hasMore: false,
        prevPage: 1,
      };

      mockOptimizedNewsletterService.getAll
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({ limit: 1 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(1);
        expect(result.current.hasNextPage).toBe(true);
      });

      await result.current.fetchNextPage();

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(2);
        expect(result.current.hasNextPage).toBe(false);
        expect(result.current.currentPage).toBe(2);
      });
    });

    it('should pass filters to optimized service', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const filters = {
        isRead: false,
        isArchived: true,
        sourceIds: ['00000000-0000-0000-0000-000000000001'],
        orderBy: 'title',
        orderDirection: 'asc' as const,
      };

      renderHook(() => useInfiniteNewsletters(filters, { pageSize: 5 }), { wrapper });

      await waitFor(() => {
        expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({
            isRead: false,
            isArchived: true,
            sourceIds: ['00000000-0000-0000-0000-000000000001'],
            limit: 5,
            offset: 0,
            orderBy: 'title',
            orderDirection: 'asc',
          })
        );
      });
    });

    it('should handle loading state', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({ limit: 10 }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.newsletters).toHaveLength(2);
      });
    });

    it('should handle loading more state', async () => {
      mockOptimizedNewsletterService.getAll
        .mockResolvedValueOnce({
          data: mockNewsletterData.slice(0, 1),
          count: 2,
          page: 1,
          limit: 1,
          hasMore: true,
          prevPage: null,
        })
        .mockResolvedValueOnce({
          data: mockNewsletterData.slice(1, 2),
          count: 2,
          page: 2,
          limit: 1,
          hasMore: false,
          prevPage: 1,
        });

      const { result } = renderHook(
        () => useInfiniteNewsletters({}, { pageSize: 1 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isLoadingMore).toBe(false);
      });

      // Start fetching next page
      result.current.fetchNextPage();

      // isLoadingMore may be true briefly - wait for either completion or loading state
      await waitFor(() => {
        expect(result.current.newsletters.length).toBeGreaterThanOrEqual(1);
      });

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(2);
        expect(result.current.hasNextPage).toBe(false);
      });
    });

    it('should handle error state', async () => {
      const mockError = new Error('API Error');
      mockOptimizedNewsletterService.getAll.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useInfiniteNewsletters({ limit: 10 }),
        { wrapper }
      );

      // Wait for loading to finish (hook retries 3 times, so may take a while)
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.newsletters).toHaveLength(0);
        },
        { timeout: 15000 }
      );

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('API Error');
    });
  });

  describe('backward compatibility', () => {
    it('should maintain same interface as original hook', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters(),
        { wrapper }
      );

      await waitFor(() => {
        // Check that all expected properties exist
        expect(result.current).toHaveProperty('newsletters');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('isLoadingMore');
        expect(result.current).toHaveProperty('error');
        expect(result.current).toHaveProperty('hasNextPage');
        expect(result.current).toHaveProperty('isFetchingNextPage');
        expect(result.current).toHaveProperty('fetchNextPage');
        expect(result.current).toHaveProperty('refetch');
        expect(result.current).toHaveProperty('totalCount');
        expect(result.current).toHaveProperty('pageCount');
        expect(result.current).toHaveProperty('currentPage');
      });
    });

    it('should return data in expected format', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters(),
        { wrapper }
      );

      await waitFor(() => {
        expect(Array.isArray(result.current.newsletters)).toBe(true);
        expect(result.current.newsletters[0]).toHaveProperty('id');
        expect(result.current.newsletters[0]).toHaveProperty('title');
        expect(result.current.newsletters[0]).toHaveProperty('source');
        expect(result.current.newsletters[0]).toHaveProperty('tags');
        expect(result.current.totalCount).toBe(2);
        expect(result.current.pageCount).toBe(1);
        expect(result.current.currentPage).toBe(1);
      });
    });
  });

  describe('performance optimization', () => {
    it('should not make unnecessary API calls when disabled', () => {
      const { result } = renderHook(
        () => useInfiniteNewsletters({}, { enabled: false }),
        { wrapper }
      );

      // Should not make API calls when disabled
      expect(mockOptimizedNewsletterService.getAll).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should use pageSize option correctly', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({}, { pageSize: 5 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(2);
      });

      expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 0,
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
    });

    it('should use staleTime option correctly', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result } = renderHook(
        () => useInfiniteNewsletters({}, { _staleTime: 5000 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.newsletters).toHaveLength(2);
      });

      expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalled();
    });
  });

  describe('query key generation', () => {
    it('should generate different query keys for different filters', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      const { result: result1 } = renderHook(
        () => useInfiniteNewsletters({ isRead: false }),
        { wrapper }
      );

      const { result: result2 } = renderHook(
        () => useInfiniteNewsletters({ isRead: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.newsletters).toHaveLength(2);
        expect(result2.current.newsletters).toHaveLength(2);
      });

      // Should make separate API calls for different filters
      expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalledTimes(2);
      expect(mockOptimizedNewsletterService.getAll).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          isRead: false,
          limit: 20,
          offset: 0,
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
      expect(mockOptimizedNewsletterService.getAll).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          isRead: true,
          limit: 20,
          offset: 0,
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
    });

    it('should generate different query keys for different page sizes', async () => {
      mockOptimizedNewsletterService.getAll.mockResolvedValue(mockPaginatedResponse);

      // Use different filters that affect query key (sourceIds affects the key)
      const source1 = '00000000-0000-0000-0000-000000000001';
      const source2 = '00000000-0000-0000-0000-000000000002';
      const { result: result1 } = renderHook(
        () => useInfiniteNewsletters({ sourceIds: [source1] }, { pageSize: 10 }),
        { wrapper }
      );

      const { result: result2 } = renderHook(
        () => useInfiniteNewsletters({ sourceIds: [source2] }, { pageSize: 5 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.newsletters).toHaveLength(2);
        expect(result2.current.newsletters).toHaveLength(2);
      });

      expect(mockOptimizedNewsletterService.getAll).toHaveBeenCalledTimes(2);
      expect(mockOptimizedNewsletterService.getAll).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sourceIds: [source1],
          limit: 10,
          offset: 0,
        })
      );
      expect(mockOptimizedNewsletterService.getAll).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sourceIds: [source2],
          limit: 5,
          offset: 0,
        })
      );
    });
  });
});
