import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNewsletters } from '../useNewsletters';
import { newsletterApi } from '../../api/newsletterApi';
import { getCacheManager } from '../../utils/cacheUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { NewsletterWithRelations } from '../../types';

// Mock dependencies
jest.mock('../../api/newsletterApi');
jest.mock('../../utils/cacheUtils');
jest.mock('../../contexts/AuthContext');

const mockNewsletterApi = newsletterApi as jest.Mocked<typeof newsletterApi>;
const mockGetCacheManager = getCacheManager as jest.MockedFunction<typeof getCacheManager>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock data
const mockNewsletter: NewsletterWithRelations = {
  id: 'test-newsletter-1',
  title: 'Test Newsletter',
  content: 'Test content',
  summary: 'Test summary',
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_id: 'test-user',
  newsletter_source_id: 'test-source',
  tags: [],
  source: null,
  word_count: 100,
  estimated_read_time: 1,
  image_url: null,
  url: null,
};

const mockCacheManager = {
  optimisticUpdateWithRollback: jest.fn(),
  invalidateRelatedQueries: jest.fn(),
  queryClient: {
    getQueryCache: () => ({
      findAll: () => [],
    }),
  },
};

const mockUser = {
  id: 'test-user',
  email: 'test@example.com',
};

describe('useNewsletters - Action Fixes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockGetCacheManager.mockReturnValue(mockCacheManager as any);

    // Mock successful API calls
    mockNewsletterApi.toggleLike.mockResolvedValue(mockNewsletter);

    // Mock optimistic update with rollback
    mockCacheManager.optimisticUpdateWithRollback.mockResolvedValue({
      rollback: jest.fn(),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('toggleLike mutation', () => {
    it('should properly update is_liked field in optimistic update', async () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      // Mock initial newsletter data
      const mockNewsletters = [{ ...mockNewsletter, is_liked: false }];
      queryClient.setQueryData(['newsletters', 'list', {}], mockNewsletters);

      await act(async () => {
        await result.current.toggleLike('test-newsletter-1');
      });

      // Verify optimistic update was called with correct field
      expect(mockCacheManager.optimisticUpdateWithRollback).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function)
      );

      // Get the update function and test it
      const updateFn = mockCacheManager.optimisticUpdateWithRollback.mock.calls[0][1];
      const updatedData = updateFn(mockNewsletters);

      expect(updatedData[0].is_liked).toBe(true);
    });

    it('should handle undefined previousNewsletters gracefully', async () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      // Don't set any initial data (undefined case)

      await act(async () => {
        await result.current.toggleLike('test-newsletter-1');
      });

      // Should not throw error and should handle gracefully
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalledWith('test-newsletter-1');
    });

    it('should execute rollback functions on error', async () => {
      const mockRollback = jest.fn();
      mockCacheManager.optimisticUpdateWithRollback.mockResolvedValue({
        rollback: mockRollback,
      });

      // Mock API error
      mockNewsletterApi.toggleLike.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      try {
        await act(async () => {
          await result.current.toggleLike('test-newsletter-1');
        });
      } catch (error) {
        // Expected to throw
      }

      // Rollback should be executed on error
      expect(mockRollback).toHaveBeenCalled();
    });
  });



  describe('error handling and fallbacks', () => {
    it('should invalidate cache on optimistic update failure', async () => {
      mockCacheManager.optimisticUpdateWithRollback.mockRejectedValue(
        new Error('Cache update failed')
      );

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await act(async () => {
        await result.current.toggleLike('test-newsletter-1');
      });

      // Should still call API even if optimistic update fails
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalled();
      expect(mockCacheManager.invalidateRelatedQueries).toHaveBeenCalledWith(
        ['test-newsletter-1'],
        'toggle-like'
      );
    });

    it('should handle partial rollback function failures gracefully', async () => {
      const mockRollback1 = jest.fn();
      const mockRollback2 = jest.fn().mockImplementation(() => {
        throw new Error('Rollback failed');
      });
      const mockRollback3 = jest.fn();

      // Mock multiple optimistic updates
      mockCacheManager.optimisticUpdateWithRollback
        .mockResolvedValueOnce({ rollback: mockRollback1 })
        .mockResolvedValueOnce({ rollback: mockRollback2 })
        .mockResolvedValueOnce({ rollback: mockRollback3 });

      mockNewsletterApi.toggleLike.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      try {
        await act(async () => {
          await result.current.toggleLike('test-newsletter-1');
        });
      } catch (error) {
        // Expected to throw
      }

      // All rollbacks should be attempted, even if one fails
      expect(mockRollback1).toHaveBeenCalled();
      expect(mockRollback2).toHaveBeenCalled();
      expect(mockRollback3).toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    it('should expose loading states correctly', () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      expect(typeof result.current.isTogglingLike).toBe('boolean');
    });

    it('should expose error states correctly', () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      expect(result.current.errorTogglingLike).toBeNull();
    });
  });
});
