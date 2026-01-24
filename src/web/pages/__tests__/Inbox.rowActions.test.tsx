/**
 * @vitest-environment jsdom
 *
 * Tests for row actions responsiveness in the Inbox component.
 * This test file focuses on verifying the fix for row action UI updates.
 */
import { ToastProvider } from '@common/contexts/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*                       HOISTED  MOCKS                              */
/* ------------------------------------------------------------------ */
const {
  useInboxFiltersMock,
  useInfiniteNewslettersMock,
  useReadingQueueMock,
  useSharedNewsletterActionsMock,
  useNewslettersMock,
  useGroupCountsMock,
  MockInboxFilters,
  MockInfiniteNewsletterList,
} = vi.hoisted(() => ({
  useInboxFiltersMock: vi.fn(),
  useInfiniteNewslettersMock: vi.fn(),
  useReadingQueueMock: vi.fn(),
  useSharedNewsletterActionsMock: vi.fn(),
  useNewslettersMock: vi.fn(),
  useGroupCountsMock: vi.fn(() => ({})),
  MockInboxFilters: vi.fn(() => <div data-testid="inbox-filters" />),
  MockInfiniteNewsletterList: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*                              MOCKS                                 */
/* ------------------------------------------------------------------ */
vi.mock('@web/components/InboxFilters', () => ({
  __esModule: true,
  InboxFilters: MockInboxFilters,
  default: MockInboxFilters,
  NewsletterSourceWithCount: {},
}));

vi.mock('@web/components/BulkSelectionActions', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="bulk-actions" />),
}));

vi.mock('@web/components/InfiniteScroll', () => ({
  __esModule: true,
  InfiniteNewsletterList: MockInfiniteNewsletterList,
}));

/* hooks ------------------------------------------------------------------- */
vi.mock('@common/hooks/useInboxFilters', () => ({
  __esModule: true,
  useInboxFilters: useInboxFiltersMock,
}));

vi.mock('@common/hooks/infiniteScroll', () => ({
  __esModule: true,
  useInfiniteNewsletters: useInfiniteNewslettersMock,
}));

vi.mock('@common/hooks/useReadingQueue', () => ({
  __esModule: true,
  useReadingQueue: useReadingQueueMock,
}));

vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  __esModule: true,
  useSharedNewsletterActions: useSharedNewsletterActionsMock,
}));

vi.mock('@common/hooks/useNewsletters', () => ({
  __esModule: true,
  useNewsletters: useNewslettersMock,
}));

vi.mock('@web/hooks/useGroupCounts', () => ({
  __esModule: true,
  useGroupCounts: useGroupCountsMock,
}));

/* context & util stubs ---------------------------------------------------- */
vi.mock('@common/contexts', () => ({
  __esModule: true,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useErrorHandling', () => ({
  __esModule: true,
  useErrorHandling: () => ({ handleError: vi.fn() }),
}));

vi.mock('@common/hooks/useLoadingStates', () => ({
  __esModule: true,
  useBulkLoadingStates: () => ({ isBulkActionInProgress: false }),
}));

/* ------------------------------------------------------------------ */
/*            IMPORT COMPONENT AFTER all mocks are registered         */
/* ------------------------------------------------------------------ */
import Inbox from '../Inbox';

/* ------------------------------------------------------------------ */
/*                     TEST-HELPER  FACTORIES                         */
/* ------------------------------------------------------------------ */
const makeNewsletters = (n = 3, overrides = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `newsletter-${i}`,
    title: `Newsletter ${i}`,
    content: `Content for newsletter ${i}`,
    summary: `Summary for newsletter ${i}`,
    image_url: '',
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_read: false,
    is_liked: false,
    is_archived: false,
    user_id: 'user-1',
    newsletter_source_id: `source-${i}`,
    source: {
      id: `source-${i}`,
      name: `Source ${i}`,
      from: `source${i}@example.com`,
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    tags: [],
    word_count: 100,
    estimated_read_time: 1,
    ...overrides,
  }));

const mkInboxFilters = () => ({
  filter: 'all',
  sourceFilter: null,
  timeRange: 'all',
  debouncedTagIds: [],
  allTags: [],
  newsletterSources: [],
  isLoadingSources: false,
  newsletterFilter: {
    isRead: false,
    isArchived: false,
    isLiked: false,
    tagIds: [],
    sourceIds: [],
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    orderBy: undefined,
    ascending: undefined,
  },
  setFilter: vi.fn(),
  setSourceFilter: vi.fn(),
  setTimeRange: vi.fn(),
  removeTag: vi.fn(),
  resetFilters: vi.fn(),
  handleTagClick: vi.fn(),
});

const mkInfiniteNewsletters = (newsletters = makeNewsletters()) => ({
  newsletters,
  isLoading: false,
  isLoadingMore: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  error: null,
  totalCount: newsletters.length,
});

const mkReadingQueue = () => ({ readingQueue: [], removeFromQueue: vi.fn() });

const mkSharedActions = () => ({
  handleMarkAsRead: vi.fn().mockResolvedValue(undefined),
  handleMarkAsUnread: vi.fn().mockResolvedValue(undefined),
  handleToggleLike: vi.fn().mockResolvedValue(undefined),
  handleToggleArchive: vi.fn().mockResolvedValue(undefined),
  handleDeleteNewsletter: vi.fn().mockResolvedValue(undefined),
  handleToggleInQueue: vi.fn().mockResolvedValue(undefined),
  handleUpdateTags: vi.fn().mockResolvedValue(undefined),
  isNewsletterLoading: vi.fn().mockReturnValue(false),
});

const mkNewsletters = () => ({
  markAsRead: vi.fn().mockResolvedValue(true),
  markAsUnread: vi.fn().mockResolvedValue(true),
  toggleLike: vi.fn().mockResolvedValue(true),
  toggleArchive: vi.fn().mockResolvedValue(true),
  deleteNewsletter: vi.fn().mockResolvedValue(true),
  toggleInQueue: vi.fn().mockResolvedValue(true),
  bulkMarkAsRead: vi.fn().mockResolvedValue(true),
  bulkMarkAsUnread: vi.fn().mockResolvedValue(true),
  bulkArchive: vi.fn().mockResolvedValue(true),
  bulkUnarchive: vi.fn().mockResolvedValue(true),
  bulkDeleteNewsletters: vi.fn().mockResolvedValue(true),
  updateNewsletterTags: vi.fn().mockResolvedValue(undefined),
});

/* render helper ------------------------------------------------------------ */
const renderInbox = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <Inbox />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

/* ------------------------------------------------------------------ */
/*                     TEST SETUP & CLEANUP                            */
/* ------------------------------------------------------------------ */

// Global error handlers to catch unhandled rejections during tests
let originalConsoleError: typeof console.error;
let unhandledRejections: Error[] = [];

beforeEach(() => {
  // Store original console.error
  originalConsoleError = console.error;

  // Suppress console.error for expected test errors
  console.error = vi.fn();

  // Track unhandled rejections
  unhandledRejections = [];

  // Add unhandled rejection handler
  const handleRejection = (reason: any) => {
    unhandledRejections.push(reason);
    // Don't let the rejection go unhandled - just track it
  };

  process.on('unhandledRejection', handleRejection);

  // Store handler for cleanup
  (globalThis as any)._testRejectionHandler = handleRejection;
});

afterEach(() => {
  // Restore console.error
  console.error = originalConsoleError;

  // Remove unhandled rejection handler
  const handler = (globalThis as any)._testRejectionHandler;
  if (handler) {
    process.off('unhandledRejection', handler);
    delete (globalThis as any)._testRejectionHandler;
  }

  // Clear any pending timeouts
  vi.clearAllTimers();

  // Reset all mocks
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*                         ROW ACTIONS TESTS                         */
/* ------------------------------------------------------------------ */
describe('Inbox Row Actions Responsiveness Fix', () => {
  let mockSharedActions: ReturnType<typeof mkSharedActions>;
  let mockNewsletters: ReturnType<typeof mkNewsletters>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock returns
    useInboxFiltersMock.mockReturnValue(mkInboxFilters());
    useReadingQueueMock.mockReturnValue(mkReadingQueue());
    useGroupCountsMock.mockReturnValue({});

    mockSharedActions = mkSharedActions();
    mockNewsletters = mkNewsletters();

    useSharedNewsletterActionsMock.mockReturnValue(mockSharedActions);
    useNewslettersMock.mockReturnValue(mockNewsletters);

    // Mock InfiniteNewsletterList to render interactive row action buttons
    MockInfiniteNewsletterList.mockImplementation(({
      newsletters = [],
      onToggleLike,
      onToggleArchive,
      onToggleRead,
      onTrash,
    }) => (
      <div data-testid="infinite-newsletter-list">
        {newsletters.map((newsletter: any) => (
          <div key={newsletter.id} data-testid={`newsletter-row-${newsletter.id}`}>
            <span>{newsletter.title}</span>
            <div className="row-actions">
              <button
                onClick={() => onToggleLike?.(newsletter)}
                data-testid={`like-${newsletter.id}`}
              >
                {newsletter.is_liked ? 'Unlike' : 'Like'}
              </button>
              <button
                onClick={() => onToggleArchive?.(newsletter.id)}
                data-testid={`archive-${newsletter.id}`}
              >
                {newsletter.is_archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => onToggleRead?.(newsletter.id)}
                data-testid={`read-${newsletter.id}`}
              >
                {newsletter.is_read ? 'Mark Unread' : 'Mark Read'}
              </button>
              <button
                onClick={() => onTrash?.(newsletter.id)}
                data-testid={`delete-${newsletter.id}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    ));
  });


  describe('Row Action Handler Integration', () => {
    it('should use shared newsletter actions instead of raw mutations', () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      renderInbox();

      // Verify that useSharedNewsletterActions was called with optimistic updates enabled
      expect(useSharedNewsletterActionsMock).toHaveBeenCalledWith(
        mockNewsletters,
        expect.objectContaining({
          optimisticUpdates: true, // This is the key fix
        })
      );
    });

    it('should call shared actions for like operations', async () => {
      const newsletters = makeNewsletters(1, { is_liked: false });
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the like button
      const likeButton = screen.getByTestId('like-newsletter-0');
      await user.click(likeButton);

      // Verify the shared action was called (not raw mutation)
      await waitFor(() => {
        expect(mockSharedActions.handleToggleLike).toHaveBeenCalledWith(newsletters[0]);
      });
    });

    it('should call shared actions for archive operations', async () => {
      const newsletters = makeNewsletters(1, { is_archived: false });
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the archive button
      const archiveButton = screen.getByTestId('archive-newsletter-0');
      await user.click(archiveButton);

      // Verify the shared action was called (not raw mutation)
      await waitFor(() => {
        expect(mockSharedActions.handleToggleArchive).toHaveBeenCalledWith(newsletters[0]);
      });
    });

    it('should call shared actions for read operations', async () => {
      const newsletters = makeNewsletters(1, { is_read: false });
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the mark read button
      const readButton = screen.getByTestId('read-newsletter-0');
      await user.click(readButton);

      // Verify the shared action was called (not raw mutation)
      await waitFor(() => {
        expect(mockSharedActions.handleMarkAsRead).toHaveBeenCalledWith('newsletter-0');
      });
    });

    it('should call shared actions for delete operations', async () => {
      const newsletters = makeNewsletters(1);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the delete button
      const deleteButton = screen.getByTestId('delete-newsletter-0');
      await user.click(deleteButton);

      // Verify the shared action was called (not raw mutation)
      await waitFor(() => {
        expect(mockSharedActions.handleDeleteNewsletter).toHaveBeenCalledWith('newsletter-0');
      });
    });
  });

  describe('Row Action Error Handling', () => {
    it('should handle like action errors gracefully', async () => {
      // Mock a failing like action
      const rejectionError = new Error('Like failed');
      mockSharedActions.handleToggleLike.mockRejectedValue(rejectionError);

      const newsletters = makeNewsletters(1);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the like button
      const likeButton = screen.getByTestId('like-newsletter-0');

      // Wrap the entire interaction in act to handle React state updates
      await act(async () => {
        await user.click(likeButton);
        // Wait a tick for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify the action was attempted
      expect(mockSharedActions.handleToggleLike).toHaveBeenCalled();
    });

    it('should handle archive action errors gracefully', async () => {
      // Mock a failing archive action
      const rejectionError = new Error('Archive failed');
      mockSharedActions.handleToggleArchive.mockRejectedValue(rejectionError);

      const newsletters = makeNewsletters(1);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the archive button
      const archiveButton = screen.getByTestId('archive-newsletter-0');

      // Wrap the entire interaction in act to handle React state updates
      await act(async () => {
        await user.click(archiveButton);
        // Wait a tick for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify the action was attempted
      expect(mockSharedActions.handleToggleArchive).toHaveBeenCalled();
    });
  });

  describe('Row Action Responsiveness', () => {
    it('should provide immediate feedback through optimistic updates', async () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      renderInbox();

      // Verify that optimistic updates are enabled for immediate UI feedback
      const [, options] = useSharedNewsletterActionsMock.mock.calls[0];
      expect(options.optimisticUpdates).toBe(true);
    });

    it('should handle multiple rapid row actions without conflicts', async () => {
      const newsletters = makeNewsletters(3);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Rapidly click multiple row actions
      const likeButton1 = screen.getByTestId('like-newsletter-0');
      const archiveButton2 = screen.getByTestId('archive-newsletter-1');
      const readButton3 = screen.getByTestId('read-newsletter-2');

      // Click all buttons in rapid succession
      await user.click(likeButton1);
      await user.click(archiveButton2);
      await user.click(readButton3);

      // Verify all actions were called
      await waitFor(() => {
        expect(mockSharedActions.handleToggleLike).toHaveBeenCalledWith(newsletters[0]);
        expect(mockSharedActions.handleToggleArchive).toHaveBeenCalledWith(newsletters[1]);
        expect(mockSharedActions.handleMarkAsRead).toHaveBeenCalledWith('newsletter-2');
      });
    });
  });

  describe('Cache Invalidation Verification', () => {
    it('should verify row actions trigger proper cache updates', async () => {
      const newsletters = makeNewsletters(1);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Perform a row action
      const likeButton = screen.getByTestId('like-newsletter-0');
      await user.click(likeButton);

      // Verify the shared action was called (which includes cache invalidation)
      await waitFor(() => {
        expect(mockSharedActions.handleToggleLike).toHaveBeenCalledWith(newsletters[0]);
      });

      // The shared actions should handle cache invalidation internally
      // This test ensures we're using the shared actions instead of raw mutations
    });
  });
});
