import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useNewsletterNavigation } from '@common/hooks/useNewsletterNavigation';
import type { NewsletterFilter, NewsletterWithRelations } from '@common/types';
import { getCacheManager } from '@common/utils/cacheUtils';
import { useLogger } from '@common/utils/logger/useLogger';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { NewsletterNavigation } from '../NewsletterNavigation';

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(),
    useNavigate: vi.fn(),
  };
});

// Mock the cache manager
vi.mock('@common/utils/cacheUtils', () => ({
  getCacheManager: vi.fn(),
  createCacheManager: vi.fn(),
}));

// Mock the newsletter navigation hook
vi.mock('@common/hooks/useNewsletterNavigation', () => ({
  useNewsletterNavigation: vi.fn(),
}));

// Mock the inbox filters hook
vi.mock('@common/hooks/useInboxFilters', () => ({
  useInboxFilters: vi.fn(),
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    auth: vi.fn(),
    api: vi.fn(),
    ui: vi.fn(),
    logUserAction: vi.fn(),
    logComponentError: vi.fn(),
    startTimer: vi.fn(() => vi.fn()),
  })),
}));

const mockUseLocation = useLocation as MockedFunction<typeof useLocation>;
const mockUseNavigate = useNavigate as MockedFunction<typeof useNavigate>;
const mockGetCacheManager = getCacheManager as MockedFunction<typeof getCacheManager>;
const mockUseNewsletterNavigation = useNewsletterNavigation as MockedFunction<typeof useNewsletterNavigation>;
const mockUseInboxFilters = useInboxFilters as MockedFunction<typeof useInboxFilters>;
const mockUseLogger = useLogger as MockedFunction<typeof useLogger>;

describe('NewsletterNavigation - Optimistic Unread Count Updates', () => {
  let queryClient: QueryClient;
  let mockCacheManager: any;
  let mockNavigate: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock cache manager
    mockCacheManager = {
      updateUnreadCountOptimistically: vi.fn(),
      queryClient: queryClient,
    };
    mockGetCacheManager.mockReturnValue(mockCacheManager);

    // Mock navigation
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    // Mock location
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/test-id',
      search: '',
      hash: '',
      state: {
        fromInbox: true,
        currentFilter: 'unread',
      },
    } as any);

    // Mock newsletter navigation hook
    mockUseNewsletterNavigation.mockReturnValue({
      hasPrevious: true,
      hasNext: true,
      currentIndex: 5,
      totalCount: 20,
      isLoading: false,
      currentNewsletter: {
        id: 'test-id',
        title: 'Test Newsletter',
        content: 'Test content',
        summary: 'Test summary',
        image_url: 'test-image.jpg',
        received_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_read: false,
        is_liked: false,
        is_archived: false,
        user_id: 'user-123',
        newsletter_source_id: 'source-123',
        source: null,
        tags: [],
        word_count: 100,
        estimated_read_time: 1,
      } as NewsletterWithRelations,
      previousNewsletter: null,
      nextNewsletter: null,
      navigateToPrevious: vi.fn(() => 'prev-id'),
      navigateToNext: vi.fn(() => 'next-id'),
      preloadAdjacent: vi.fn(),
    });

    // Mock inbox filters
    mockUseInboxFilters.mockReturnValue({
      newsletterFilter: {
        isRead: false,
        isArchived: false,
      } as NewsletterFilter,
      hasActiveFilters: false,
      isFilterActive: vi.fn(() => false),
      newsletterSources: [],
      isLoadingTags: false,
      isLoadingSources: false,
      filter: 'all',
      sourceFilter: null,
      timeRange: 'all',
      tagIds: [],
      debouncedTagIds: [],
      pendingTagUpdates: [],
      visibleTags: new Set(),
      allTags: [],
      setFilter: vi.fn(),
      setSourceFilter: vi.fn(),
      setTimeRange: vi.fn(),
      setTagIds: vi.fn(),
      setPendingTagUpdates: vi.fn(),
      toggleTag: vi.fn(),
      addTag: vi.fn(),
      removeTag: vi.fn(),
      clearTags: vi.fn(),
      resetFilters: vi.fn(),
      updateTagDebounced: vi.fn(),
      handleTagClick: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderNewsletterNavigation = (props = {}) => {
    const defaultProps = {
      currentNewsletterId: 'test-id',
      mutations: {
        markAsRead: vi.fn().mockResolvedValue(true),
        markAsUnread: vi.fn().mockResolvedValue(true),
        toggleLike: vi.fn().mockResolvedValue(true),
        toggleArchive: vi.fn().mockResolvedValue(true),
        deleteNewsletter: vi.fn().mockResolvedValue(true),
        toggleInQueue: vi.fn().mockResolvedValue(true),
        updateNewsletterTags: vi.fn().mockResolvedValue(true),
      },
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewsletterNavigation {...defaultProps} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Navigation-specific handlers', () => {
    it('should use optimistic unread count updates for mark as read during navigation', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for the navigation to complete
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('test-id');
      });

      // Check that optimistic unread count update was called
      expect(mockCacheManager.updateUnreadCountOptimistically).toHaveBeenCalledWith({
        type: 'mark-read',
        newsletterIds: ['test-id'],
      });
    });

    it('should use optimistic unread count updates for auto-mark-as-read', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
        autoMarkAsRead: true,
      });

      // Wait for auto-mark-as-read to trigger
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('test-id');
      });

      // Check that optimistic unread count update was called
      expect(mockCacheManager.updateUnreadCountOptimistically).toHaveBeenCalledWith({
        type: 'mark-read',
        newsletterIds: ['test-id'],
      });
    });

    it('should handle mark as read errors gracefully', async () => {
      const mockMarkAsRead = vi.fn().mockRejectedValue(new Error('API Error'));
      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        auth: vi.fn(),
        api: vi.fn(),
        ui: vi.fn(),
        logUserAction: vi.fn(),
        logComponentError: vi.fn(),
        startTimer: vi.fn(() => vi.fn()),
      };

      mockUseLogger.mockReturnValue(mockLogger);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to mark newsletter as read during navigation',
          {
            action: 'navigation_mark_read_error',
            metadata: { newsletterId: 'test-id' },
          },
          expect.any(Error)
        );
      });
    });

    it('should not call optimistic updates when newsletter is already read', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      // Mock newsletter that's already read
      mockUseNewsletterNavigation.mockReturnValue({
        hasPrevious: true,
        hasNext: true,
        currentIndex: 5,
        totalCount: 20,
        isLoading: false,
        currentNewsletter: {
          id: 'test-id',
          title: 'Test Newsletter',
          content: 'Test content',
          summary: 'Test summary',
          image_url: 'test-image.jpg',
          received_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_read: true, // Already read
          is_liked: false,
          is_archived: false,
          user_id: 'user-123',
          newsletter_source_id: 'source-123',
          source: null,
          tags: [],
          word_count: 100,
          estimated_read_time: 1,
        } as NewsletterWithRelations,
        previousNewsletter: null,
        nextNewsletter: null,
        navigateToPrevious: vi.fn(() => 'prev-id'),
        navigateToNext: vi.fn(() => 'next-id'),
        preloadAdjacent: vi.fn(),
      });

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });

      // Check that mark as read was not called since newsletter is already read
      expect(mockMarkAsRead).not.toHaveBeenCalled();
      expect(mockCacheManager.updateUnreadCountOptimistically).not.toHaveBeenCalled();
    });

    it('should handle archive operations during navigation', async () => {
      const mockToggleArchive = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: vi.fn().mockResolvedValue(true),
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: mockToggleArchive,
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for the navigation to complete
      await waitFor(() => {
        expect(mockToggleArchive).toHaveBeenCalledWith('test-id');
      });
    });

    it('should skip auto-mark-as-read when disabled', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
        autoMarkAsRead: false,
      });

      // Wait a bit to ensure auto-mark-as-read doesn't trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that mark as read was not called
      expect(mockMarkAsRead).not.toHaveBeenCalled();
      expect(mockCacheManager.updateUnreadCountOptimistically).not.toHaveBeenCalled();
    });

    it('should handle reading queue context correctly', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      // Mock location for reading queue context
      mockUseLocation.mockReturnValue({
        pathname: '/reading-queue/test-id',
        search: '',
        hash: '',
        state: {
          fromReadingQueue: true,
        },
      } as any);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
        isFromReadingQueue: true,
        autoMarkAsRead: false,
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });

      // In reading queue context, mark as read should not be called at all
      expect(mockMarkAsRead).not.toHaveBeenCalled();
      expect(mockCacheManager.updateUnreadCountOptimistically).not.toHaveBeenCalled();
    });

    it('should handle both mark as read and archive in sequence', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);
      const mockToggleArchive = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: mockToggleArchive,
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for both operations to complete
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('test-id');
        expect(mockToggleArchive).toHaveBeenCalledWith('test-id');
      });

      // Check that optimistic unread count update was called
      expect(mockCacheManager.updateUnreadCountOptimistically).toHaveBeenCalledWith({
        type: 'mark-read',
        newsletterIds: ['test-id'],
      });
    });

    it('should handle archive errors gracefully', async () => {
      const mockToggleArchive = vi.fn().mockRejectedValue(new Error('Archive failed'));
      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        auth: vi.fn(),
        api: vi.fn(),
        ui: vi.fn(),
        logUserAction: vi.fn(),
        logComponentError: vi.fn(),
        startTimer: vi.fn(() => vi.fn()),
      };

      mockUseLogger.mockReturnValue(mockLogger);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: vi.fn().mockResolvedValue(true),
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: mockToggleArchive,
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to process current newsletter before navigation',
          {
            action: 'navigate_next_process_error',
            metadata: { newsletterId: 'test-id' },
          },
          expect.any(Error)
        );
      });
    });
  });

  describe('Navigation state preservation', () => {
    it('should preserve filter context during navigation', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/newsletters/next-id',
          expect.objectContaining({
            state: expect.objectContaining({
              fromInbox: true,
              currentFilter: 'unread',
              fromNavigation: true,
            }),
          })
        );
      });
    });

    it('should preserve source context during navigation', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
        sourceId: 'source-123',
      });

      // Find and click the next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/newsletters/next-id',
          expect.objectContaining({
            state: expect.objectContaining({
              sourceId: 'source-123',
              fromNewsletterSources: true,
            }),
          })
        );
      });
    });
  });

  describe('UI interactions', () => {
    it('should disable navigation buttons when disabled prop is true', () => {
      renderNewsletterNavigation({
        disabled: true,
      });

      const prevButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should show correct navigation state', () => {
      renderNewsletterNavigation();

      // Check that the counter shows correct position - the text is split across multiple elements
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('of')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('should handle previous navigation correctly', async () => {
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);

      renderNewsletterNavigation({
        mutations: {
          markAsRead: mockMarkAsRead,
          markAsUnread: vi.fn().mockResolvedValue(true),
          toggleLike: vi.fn().mockResolvedValue(true),
          toggleArchive: vi.fn().mockResolvedValue(true),
          deleteNewsletter: vi.fn().mockResolvedValue(true),
          toggleInQueue: vi.fn().mockResolvedValue(true),
          updateNewsletterTags: vi.fn().mockResolvedValue(true),
        },
      });

      // Find and click the previous button
      const prevButton = screen.getByRole('button', { name: /previous/i });
      fireEvent.click(prevButton);

      // Wait for the navigation to complete
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('test-id');
      });

      // Check that optimistic unread count update was called
      expect(mockCacheManager.updateUnreadCountOptimistically).toHaveBeenCalledWith({
        type: 'mark-read',
        newsletterIds: ['test-id'],
      });
    });
  });
}); 