import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSimpleNewsletterNavigation } from '../useSimpleNewsletterNavigation';
import { useNewsletters } from '../useNewsletters';
import { useReadingQueue } from '../useReadingQueue';
import type { NewsletterWithRelations } from '@common/types';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
}));

vi.mock('../useNewsletters', () => ({
  useNewsletters: vi.fn(),
}));

vi.mock('../useReadingQueue', () => ({
  useReadingQueue: vi.fn(),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('useSimpleNewsletterNavigation', () => {
  const mockNavigate = vi.fn();
  const mockLocation = {
    pathname: '/newsletters/2',
    state: {},
    search: '',
    hash: '',
    key: 'default',
  };

  const mockNewsletters: NewsletterWithRelations[] = [
    {
      id: '1',
      title: 'Newsletter 1',
      is_read: false,
      is_archived: false,
      is_liked: false,
      content: '',
      sender: 'sender1@example.com',
      subject: 'Subject 1',
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 100,
      estimated_read_time: 1,
      tags: [],
    },
    {
      id: '2',
      title: 'Newsletter 2',
      is_read: true,
      is_archived: false,
      is_liked: false,
      content: '',
      sender: 'sender2@example.com',
      subject: 'Subject 2',
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 200,
      estimated_read_time: 2,
      tags: [],
    },
    {
      id: '3',
      title: 'Newsletter 3',
      is_read: false,
      is_archived: true,
      is_liked: true,
      content: '',
      sender: 'sender3@example.com',
      subject: 'Subject 3',
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 300,
      estimated_read_time: 3,
      tags: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue(mockLocation);
    vi.mocked(useNewsletters).mockReturnValue({
      newsletters: mockNewsletters,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
      totalCount: 3,
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      toggleLike: vi.fn(),
      toggleArchive: vi.fn(),
      deleteNewsletter: vi.fn(),
      bulkMarkAsRead: vi.fn(),
      bulkMarkAsUnread: vi.fn(),
      bulkArchive: vi.fn(),
      bulkUnarchive: vi.fn(),
      bulkLike: vi.fn(),
      bulkUnlike: vi.fn(),
      bulkDeleteNewsletters: vi.fn(),
      updateNewsletterTags: vi.fn(),
    } as any);
    vi.mocked(useReadingQueue).mockReturnValue({
      readingQueue: mockNewsletters.slice(0, 2).map((newsletter, index) => ({
        id: `queue-${index}`,
        newsletter_id: newsletter.id,
        user_id: 'user-1',
        position: index,
        added_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        newsletter,
      })),
      isLoading: false,
      isError: false,
      error: null,
      isEmpty: false,
      addToQueue: vi.fn(),
      removeFromQueue: vi.fn(),
      moveToPosition: vi.fn(),
      clearQueue: vi.fn(),
      getQueuePosition: vi.fn(),
      isInQueue: vi.fn(),
      reorderQueue: vi.fn(),
      bulkAddToQueue: vi.fn(),
      bulkRemoveFromQueue: vi.fn(),
      optimisticAddToQueue: vi.fn(),
      optimisticRemoveFromQueue: vi.fn(),
      optimisticReorderQueue: vi.fn(),
      refetch: vi.fn(),
    } as any);
  });

  describe('Normal newsletter context', () => {
    it('should identify navigation availability correctly', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false })
      );

      expect(result.current.hasPrevious).toBe(true);
      expect(result.current.hasNext).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle first newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: false })
      );

      expect(result.current.hasPrevious).toBe(false);
      expect(result.current.hasNext).toBe(true);
    });

    it('should handle last newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('3', { isReadingQueue: false })
      );

      expect(result.current.hasPrevious).toBe(true);
      expect(result.current.hasNext).toBe(false);
    });

    it('should navigate to previous newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false })
      );

      act(() => {
        result.current.navigateToPrevious();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/1', {
        replace: false,
        state: {
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: false,
          sourceId: undefined,
          currentFilter: undefined,
        },
      });
    });

    it('should navigate to next newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false })
      );

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/3', {
        replace: false,
        state: {
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: false,
          sourceId: undefined,
          currentFilter: undefined,
        },
      });
    });

    it('should preserve filter when navigating', () => {
      const filter = { is_read: false, is_archived: true };
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false, filter })
      );

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/3', {
        replace: false,
        state: {
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: false,
          sourceId: undefined,
          currentFilter: filter,
        },
      });
    });

    it('should preserve sourceId when navigating', () => {
      const sourceId = 'source-123';
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false, sourceId })
      );

      act(() => {
        result.current.navigateToPrevious();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/1', {
        replace: false,
        state: {
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: false,
          sourceId: sourceId,
          currentFilter: undefined,
        },
      });
    });
  });

  describe('Reading queue context', () => {
    it('should use reading queue data when isReadingQueue is true', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: true })
      );

      expect(result.current.hasPrevious).toBe(false);
      expect(result.current.hasNext).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should navigate correctly in reading queue context', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: true })
      );

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/2', {
        replace: false,
        state: {
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: true,
          sourceId: undefined,
          currentFilter: undefined,
        },
      });
    });

    it('should handle last item in reading queue', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: true })
      );

      expect(result.current.hasPrevious).toBe(true);
      expect(result.current.hasNext).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty newsletter list', () => {
      vi.mocked(useNewsletters).mockReturnValue({
        data: { items: [], total: 0 },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: false })
      );

      expect(result.current.hasPrevious).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should handle unknown newsletter ID', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('unknown-id', { isReadingQueue: false })
      );

      expect(result.current.hasPrevious).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should handle loading state', () => {
      vi.mocked(useNewsletters).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: false })
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasPrevious).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should not navigate when no previous newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('1', { isReadingQueue: false })
      );

      act(() => {
        result.current.navigateToPrevious();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should not navigate when no next newsletter', () => {
      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('3', { isReadingQueue: false })
      );

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should preserve existing location state when navigating', () => {
      const existingState = {
        someExistingProp: 'value',
        anotherProp: 123,
      };
      vi.mocked(useLocation).mockReturnValue({
        ...mockLocation,
        state: existingState,
      });

      const { result } = renderHook(() =>
        useSimpleNewsletterNavigation('2', { isReadingQueue: false })
      );

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/3', {
        replace: false,
        state: {
          ...existingState,
          from: '/newsletters/2',
          fromNavigation: true,
          fromReadingQueue: false,
          sourceId: undefined,
          currentFilter: undefined,
        },
      });
    });
  });
});
