import type { NewsletterWithRelations } from '@common/types';
import { act, renderHook } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletters } from '../useNewsletters';
import { useReadingQueue } from '../useReadingQueue';
import { useSimpleNewsletterNavigation } from '../useSimpleNewsletterNavigation';

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
      summary: 'Newsletter summary 1',
      image_url: 'https://example.com/image1.jpg',
      user_id: 'user-1',
      is_read: false,
      is_archived: false,
      is_liked: false,
      content: '',
      newsletter_source_id: 'source-1',
      source: {
        id: 'source-1',
        name: 'Source 1',
        from: 'sender1@example.com',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      },
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 100,
      estimated_read_time: 1,
      tags: [],
    },
    {
      id: '2',
      title: 'Newsletter 2',
      summary: 'Newsletter summary 2',
      image_url: 'https://example.com/image2.jpg',
      user_id: 'user-1',
      is_read: true,
      is_archived: false,
      is_liked: false,
      content: '',
      newsletter_source_id: 'source-2',
      source: {
        id: 'source-2',
        name: 'Source 2',
        from: 'sender2@example.com',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      },
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 200,
      estimated_read_time: 2,
      tags: [],
    },
    {
      id: '3',
      title: 'Newsletter 3',
      summary: 'Newsletter summary 3',
      image_url: 'https://example.com/image3.jpg',
      user_id: 'user-1',
      is_read: false,
      is_archived: true,
      is_liked: true,
      content: '',
      newsletter_source_id: 'source-3',
      source: {
        id: 'source-3',
        name: 'Source 3',
        from: 'sender3@example.com',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      },
      received_at: new Date().toISOString(),
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
      isLoadingNewsletters: false,
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
      const filter = { isRead: false, isArchived: true };
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
        newsletters: [],
        isLoadingNewsletters: false,
        isLoadingMore: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        refetch: vi.fn(),
        totalCount: 0,
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

      // When unknown newsletter ID but newsletters exist, should allow navigation to available newsletters
      expect(result.current.hasPrevious).toBe(true); // Can go to last newsletter
      expect(result.current.hasNext).toBe(true); // Can go to first newsletter
    });

    it('should handle loading state', () => {
      vi.mocked(useNewsletters).mockReturnValue({
        newsletters: [],
        isLoadingNewsletters: true,
        isLoadingMore: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        refetch: vi.fn(),
        totalCount: 0,
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
      describe('Filter freezing (Option A)', () => {
        it('should use originalFilter when provided instead of current filter', () => {
          const originalFilter = { isRead: false, isArchived: false }; // unread filter
          const currentFilter = { isRead: true, isArchived: false }; // read filter

          // Mock useNewsletters to return different results based on filter
          vi.mocked(useNewsletters).mockReturnValue({
            newsletters: mockNewsletters.filter(n => !n.is_read && !n.is_archived), // unread newsletters
            isLoading: false,
            isLoadingMore: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
            refetch: vi.fn(),
            totalCount: 2,
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

          const { result } = renderHook(() =>
            useSimpleNewsletterNavigation('1', {
              isReadingQueue: false,
              filter: currentFilter,
              originalFilter: originalFilter
            })
          );

          // Should use originalFilter (unread) not currentFilter (read)
          // Newsletter 1 should have previous: false, next: true based on unread filter
          expect(result.current.hasPrevious).toBe(false);
          expect(result.current.hasNext).toBe(true);
        });

        it('should maintain frozen navigation context even when newsletter list changes', () => {
          const originalFilter = { isRead: false, isArchived: false };
          let currentNewsletters = mockNewsletters.filter(n => !n.is_read && !n.is_archived);

          vi.mocked(useNewsletters).mockImplementation((filter) => {
            // Simulate newsletter being archived and removed from list
            if (filter?.isArchived === false && filter?.isRead === false) {
              // Return only unread newsletters initially
              return {
                newsletters: currentNewsletters,
                isLoadingNewsletters: false,
                isLoadingMore: false,
                error: null,
                hasNextPage: false,
                fetchNextPage: vi.fn(),
                refetch: vi.fn(),
                totalCount: currentNewsletters.length,
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
              } as any;
            }
            return {
              newsletters: [],
              isLoadingNewsletters: false,
              isLoadingMore: false,
              error: null,
              hasNextPage: false,
              fetchNextPage: vi.fn(),
              refetch: vi.fn(),
              totalCount: 0,
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
            } as any;
          });

          const { result, rerender } = renderHook(() =>
            useSimpleNewsletterNavigation('1', {
              isReadingQueue: false,
              filter: originalFilter,
              originalFilter: originalFilter
            })
          );

          // Initially should show navigation
          expect(result.current.hasNext).toBe(true);

          // Simulate newsletter being archived (removed from original filter results)
          currentNewsletters = currentNewsletters.filter(n => n.id !== '2');

          // Rerender hook - with frozen filter, should still maintain navigation context
          rerender();

          // Navigation should still work (frozen context)
          expect(result.current.hasNext).toBe(true);
        });

        it('should fallback to current filter when originalFilter is not provided', () => {
          const currentFilter = { isRead: false, isArchived: false };

          const { result } = renderHook(() =>
            useSimpleNewsletterNavigation('1', {
              isReadingQueue: false,
              filter: currentFilter
              // No originalFilter provided
            })
          );

          // Should work as before with current filter
          expect(result.current.hasPrevious).toBe(false);
          expect(result.current.hasNext).toBe(true);
        });

        it('should respect time range filters for archived newsletters', () => {
          // Create mock newsletters with different dates
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const lastWeek = new Date(today);
          lastWeek.setDate(today.getDate() - 7);

          const mockNewslettersWithDates: NewsletterWithRelations[] = [
            {
              id: '1',
              title: 'Today Newsletter',
              summary: 'Today newsletter summary',
              image_url: 'https://example.com/today.jpg',
              user_id: 'user-1',
              is_read: false,
              is_archived: true,
              is_liked: false,
              content: '',
              newsletter_source_id: 'source-1',
              source: {
                id: 'source-1',
                name: 'Source 1',
                from: 'sender1@example.com',
                user_id: 'user-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_archived: false,
              },
              received_at: today.toISOString(),
              updated_at: today.toISOString(),
              word_count: 100,
              estimated_read_time: 1,
              tags: [],
            },
            {
              id: '2',
              title: 'Yesterday Newsletter',
              summary: 'Yesterday newsletter summary',
              image_url: 'https://example.com/yesterday.jpg',
              user_id: 'user-1',
              is_read: false,
              is_archived: true,
              is_liked: false,
              content: '',
              newsletter_source_id: 'source-2',
              source: {
                id: 'source-2',
                name: 'Source 2',
                from: 'sender2@example.com',
                user_id: 'user-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_archived: false,
              },
              received_at: yesterday.toISOString(),
              updated_at: yesterday.toISOString(),
              word_count: 200,
              estimated_read_time: 2,
              tags: [],
            },
            {
              id: '3',
              title: 'Last Week Newsletter',
              summary: 'Last week newsletter summary',
              image_url: 'https://example.com/lastweek.jpg',
              user_id: 'user-1',
              is_read: false,
              is_archived: true,
              is_liked: false,
              content: '',
              newsletter_source_id: 'source-3',
              source: {
                id: 'source-3',
                name: 'Source 3',
                from: 'sender3@example.com',
                user_id: 'user-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_archived: false,
              },
              received_at: lastWeek.toISOString(),
              updated_at: lastWeek.toISOString(),
              word_count: 300,
              estimated_read_time: 3,
              tags: [],
            },
          ];

          // Mock useNewsletters to return only today's archived newsletters when dateFrom is set
          vi.mocked(useNewsletters).mockReturnValue({
            newsletters: [mockNewslettersWithDates[0]], // Only today's newsletter
            isLoadingNewsletters: false,
            isLoadingMore: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
            refetch: vi.fn(),
            totalCount: 1,
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

          // Test with archived + day filter (should only show today's archived newsletter)
          const archivedDayFilter = {
            isArchived: true,
            dateFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
          };

          const { result } = renderHook(() =>
            useSimpleNewsletterNavigation('1', {
              isReadingQueue: false,
              filter: archivedDayFilter,
              originalFilter: archivedDayFilter
            })
          );

          // Should only navigate within today's archived newsletters
          expect(result.current.hasPrevious).toBe(false); // First item
          expect(result.current.hasNext).toBe(false); // Only one item matches the filter
        });

        it('should maintain frozen filter context during navigation', () => {
          const originalFilter = { isArchived: true, dateFrom: new Date().toISOString() };
          const changedFilter = { isArchived: true, dateFrom: new Date(Date.now() - 86400000).toISOString() }; // Different date

          let callCount = 0;
          vi.mocked(useNewsletters).mockImplementation((filter) => {
            callCount++;
            // Return different results based on which filter is used
            const isOriginalFilter = filter?.dateFrom === originalFilter.dateFrom;

            return {
              newsletters: isOriginalFilter ? mockNewsletters.slice(0, 2) : mockNewsletters.slice(1, 3), // Different results
              isLoadingNewsletters: false,
              isLoadingMore: false,
              error: null,
              hasNextPage: false,
              fetchNextPage: vi.fn(),
              refetch: vi.fn(),
              totalCount: isOriginalFilter ? 2 : 2,
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
            } as any;
          });

          const { result } = renderHook(() =>
            useSimpleNewsletterNavigation('1', {
              isReadingQueue: false,
              filter: changedFilter, // Current filter changed
              originalFilter: originalFilter // But original should be used
            })
          );

          // Should use originalFilter, so hasNext should be true (2 items)
          expect(result.current.hasNext).toBe(true);
          expect(callCount).toBe(1); // Should only call once
        });
      });
    });

    describe('Time range filtering for archived newsletters', () => {
      it('should navigate within archived newsletters filtered by day', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        const mockArchivedNewsletters: NewsletterWithRelations[] = [
          {
            id: '1',
            title: 'Today Archived',
            summary: 'Today archived newsletter summary',
            image_url: 'https://example.com/today.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-1',
            source: {
              id: 'source-1',
              name: 'Source 1',
              from: 'sender1@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: today.toISOString(),
            updated_at: today.toISOString(),
            word_count: 100,
            estimated_read_time: 1,
            tags: [],
          },
          {
            id: '2',
            title: 'Yesterday Archived',
            summary: 'Yesterday archived newsletter summary',
            image_url: 'https://example.com/yesterday.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-2',
            source: {
              id: 'source-2',
              name: 'Source 2',
              from: 'sender2@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: yesterday.toISOString(),
            updated_at: yesterday.toISOString(),
            word_count: 200,
            estimated_read_time: 2,
            tags: [],
          },
          {
            id: '3',
            title: 'Last Week Archived',
            summary: 'Last week archived newsletter summary',
            image_url: 'https://example.com/lastweek.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-3',
            source: {
              id: 'source-3',
              name: 'Source 3',
              from: 'sender3@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: lastWeek.toISOString(),
            updated_at: lastWeek.toISOString(),
            word_count: 300,
            estimated_read_time: 3,
            tags: [],
          },
        ];

        // Mock useNewsletters to return only today's archived newsletters when day filter is applied
        vi.mocked(useNewsletters).mockReturnValue({
          newsletters: [mockArchivedNewsletters[0]], // Only today's archived newsletter
          isLoadingNewsletters: false,
          isLoadingMore: false,
          error: null,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          refetch: vi.fn(),
          totalCount: 1,
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

        const dayFilter = {
          isArchived: true,
          dateFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        };

        const { result } = renderHook(() =>
          useSimpleNewsletterNavigation('1', {
            isReadingQueue: false,
            filter: dayFilter,
            originalFilter: dayFilter
          })
        );

        // Should only navigate within today's archived newsletters
        expect(result.current.hasPrevious).toBe(false); // First item
        expect(result.current.hasNext).toBe(false); // Only one item matches the day filter
      });

      it('should navigate within archived newsletters filtered by week', () => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week

        const mockArchivedNewsletters: NewsletterWithRelations[] = [
          {
            id: '1',
            title: 'This Week Archived 1',
            summary: 'This week archived newsletter 1 summary',
            image_url: 'https://example.com/week1.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-1',
            source: {
              id: 'source-1',
              name: 'Source 1',
              from: 'sender1@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: startOfWeek.toISOString(),
            updated_at: startOfWeek.toISOString(),
            word_count: 100,
            estimated_read_time: 1,
            tags: [],
          },
          {
            id: '2',
            title: 'This Week Archived 2',
            summary: 'This week archived newsletter 2 summary',
            image_url: 'https://example.com/week2.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-2',
            source: {
              id: 'source-2',
              name: 'Source 2',
              from: 'sender2@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: new Date(startOfWeek.getTime() + 86400000).toISOString(), // Next day
            updated_at: new Date(startOfWeek.getTime() + 86400000).toISOString(),
            word_count: 200,
            estimated_read_time: 2,
            tags: [],
          },
        ];

        // Mock useNewsletters to return this week's archived newsletters when week filter is applied
        vi.mocked(useNewsletters).mockReturnValue({
          newsletters: mockArchivedNewsletters, // This week's archived newsletters
          isLoadingNewsletters: false,
          isLoadingMore: false,
          error: null,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          refetch: vi.fn(),
          totalCount: 2,
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

        const weekFilter = {
          isArchived: true,
          dateFrom: startOfWeek.toISOString()
        };

        const { result } = renderHook(() =>
          useSimpleNewsletterNavigation('1', {
            isReadingQueue: false,
            filter: weekFilter,
            originalFilter: weekFilter
          })
        );

        // Should navigate within this week's archived newsletters
        expect(result.current.hasPrevious).toBe(false); // First item
        expect(result.current.hasNext).toBe(true); // Has next item
      });

      it('should navigate within archived newsletters filtered by month', () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month

        const mockArchivedNewsletters: NewsletterWithRelations[] = [
          {
            id: '1',
            title: 'This Month Archived 1',
            summary: 'This month archived newsletter 1 summary',
            image_url: 'https://example.com/month1.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-1',
            source: {
              id: 'source-1',
              name: 'Source 1',
              from: 'sender1@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: startOfMonth.toISOString(),
            updated_at: startOfMonth.toISOString(),
            word_count: 100,
            estimated_read_time: 1,
            tags: [],
          },
          {
            id: '2',
            title: 'This Month Archived 2',
            summary: 'This month archived newsletter 2 summary',
            image_url: 'https://example.com/month2.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-2',
            source: {
              id: 'source-2',
              name: 'Source 2',
              from: 'sender2@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: new Date(startOfMonth.getTime() + 86400000 * 15).toISOString(), // 15 days later
            updated_at: new Date(startOfMonth.getTime() + 86400000 * 15).toISOString(),
            word_count: 200,
            estimated_read_time: 2,
            tags: [],
          },
        ];

        // Mock useNewsletters to return this month's archived newsletters when month filter is applied
        vi.mocked(useNewsletters).mockReturnValue({
          newsletters: mockArchivedNewsletters, // This month's archived newsletters
          isLoadingNewsletters: false,
          isLoadingMore: false,
          error: null,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          refetch: vi.fn(),
          totalCount: 2,
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

        const monthFilter = {
          isArchived: true,
          dateFrom: startOfMonth.toISOString()
        };

        const { result } = renderHook(() =>
          useSimpleNewsletterNavigation('1', {
            isReadingQueue: false,
            filter: monthFilter,
            originalFilter: monthFilter
          })
        );

        // Should navigate within this month's archived newsletters
        expect(result.current.hasPrevious).toBe(false); // First item
        expect(result.current.hasNext).toBe(true); // Has next item
      });

      it('should handle empty results when time range filter excludes all archived newsletters', () => {
        // Mock useNewsletters to return empty results when time range excludes all newsletters
        vi.mocked(useNewsletters).mockReturnValue({
          newsletters: [], // No newsletters match the time filter
          isLoadingNewsletters: false,
          isLoadingMore: false,
          error: null,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          refetch: vi.fn(),
          totalCount: 0,
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

        const futureFilter = {
          isArchived: true,
          dateFrom: new Date(Date.now() + 86400000).toISOString() // Future date
        };

        const { result } = renderHook(() =>
          useSimpleNewsletterNavigation('1', {
            isReadingQueue: false,
            filter: futureFilter,
            originalFilter: futureFilter
          })
        );

        // Should not show navigation when no newsletters match
        expect(result.current.hasPrevious).toBe(false);
        expect(result.current.hasNext).toBe(false);
      });

      it('should preserve original filter when current filter changes during navigation', () => {
        const originalFilter = { isArchived: true, dateFrom: new Date().toISOString() };
        const changedFilter = { isArchived: true, dateFrom: new Date(Date.now() - 86400000).toISOString() }; // Different date

        const mockArchivedNewsletters: NewsletterWithRelations[] = [
          {
            id: '1',
            title: 'Archived Newsletter 1',
            summary: 'Archived newsletter 1 summary',
            image_url: 'https://example.com/archived1.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-1',
            source: {
              id: 'source-1',
              name: 'Source 1',
              from: 'sender1@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            word_count: 100,
            estimated_read_time: 1,
            tags: [],
          },
          {
            id: '2',
            title: 'Archived Newsletter 2',
            summary: 'Archived newsletter 2 summary',
            image_url: 'https://example.com/archived2.jpg',
            user_id: 'user-1',
            is_read: false,
            is_archived: true,
            is_liked: false,
            content: '',
            newsletter_source_id: 'source-2',
            source: {
              id: 'source-2',
              name: 'Source 2',
              from: 'sender2@example.com',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
            },
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            word_count: 200,
            estimated_read_time: 2,
            tags: [],
          },
        ];

        let callCount = 0;
        vi.mocked(useNewsletters).mockImplementation((filter) => {
          callCount++;
          const isOriginalFilter = filter?.dateFrom === originalFilter.dateFrom;
          return {
            newsletters: isOriginalFilter ? mockArchivedNewsletters.slice(0, 2) : [], // Different results
            isLoadingNewsletters: false,
            isLoadingMore: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
            refetch: vi.fn(),
            totalCount: isOriginalFilter ? 2 : 0,
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
          } as any;
        });

        const { result } = renderHook(() =>
          useSimpleNewsletterNavigation('1', {
            isReadingQueue: false,
            filter: changedFilter, // Current filter changed
            originalFilter: originalFilter // But original should be used
          })
        );

        // Should use originalFilter, so hasNext should be true (2 items)
        expect(result.current.hasNext).toBe(true);
        expect(callCount).toBe(1); // Should only call once
      });
    });
  });
});
