/**
 * @vitest-environment jsdom
 *
 * Tests for bulk actions in the Inbox component.
 * This test file focuses on reproducing and verifying the fix for the "select all" action buttons bug.
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
  BulkSelectionActionsMock,
  MockInboxFilters,
} = vi.hoisted(() => ({
  useInboxFiltersMock: vi.fn(),
  useInfiniteNewslettersMock: vi.fn(),
  useReadingQueueMock: vi.fn(),
  useSharedNewsletterActionsMock: vi.fn(),
  useNewslettersMock: vi.fn(),
  useGroupCountsMock: vi.fn(() => ({})),
  BulkSelectionActionsMock: vi.fn(),
  MockInboxFilters: vi.fn(({ onSelectClick }) => (
    <div data-testid="inbox-filters">
      <button onClick={onSelectClick} data-testid="select-button">
        Select
      </button>
    </div>
  )),
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
  default: BulkSelectionActionsMock,
}));

vi.mock('@web/components/InfiniteScroll', () => ({
  __esModule: true,
  InfiniteNewsletterList: vi.fn(
    ({ newsletters = [], onNewsletterClick, showCheckbox, selectedIds, onToggleSelect }) => (
      <div data-testid="infinite-newsletter-list">
        {newsletters.map((n: any) => (
          <div key={n.id} data-testid={`newsletter-${n.id}`}>
            <span>{n.title}</span>
            {showCheckbox && (
              <input
                type="checkbox"
                data-testid={`checkbox-${n.id}`}
                checked={selectedIds?.has(n.id) || false}
                onChange={() => onToggleSelect?.(n.id)}
              />
            )}
            <button onClick={() => onNewsletterClick?.(n)} data-testid={`open-${n.id}`}>
              Open
            </button>
          </div>
        ))}
      </div>
    )
  ),
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
const makeNewsletters = (n = 3) =>
  Array.from({ length: n }, (_, i) => ({
    id: `newsletter-${i}`,
    title: `Newsletter ${i}`,
    content: `Content for newsletter ${i}`,
    summary: `Summary for newsletter ${i}`,
    image_url: '',
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_read: i % 2 === 0, // Mix of read/unread
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
  handleBulkMarkAsRead: vi.fn().mockResolvedValue(undefined),
  handleBulkMarkAsUnread: vi.fn().mockResolvedValue(undefined),
  handleBulkArchive: vi.fn().mockResolvedValue(undefined),
  handleBulkUnarchive: vi.fn().mockResolvedValue(undefined),
  handleBulkDelete: vi.fn().mockResolvedValue(undefined),
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
/*                         BULK ACTIONS TESTS                        */
/* ------------------------------------------------------------------ */
describe('Inbox Bulk Actions Bug Fix', () => {
  let mockSharedActions: ReturnType<typeof mkSharedActions>;
  let mockNewsletters: ReturnType<typeof mkNewsletters>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock returns
    useInboxFiltersMock.mockReturnValue(mkInboxFilters());
    useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters());
    useReadingQueueMock.mockReturnValue(mkReadingQueue());
    useGroupCountsMock.mockReturnValue({});

    mockSharedActions = mkSharedActions();
    mockNewsletters = mkNewsletters();

    useSharedNewsletterActionsMock.mockReturnValue(mockSharedActions);
    useNewslettersMock.mockReturnValue(mockNewsletters);

    // Mock BulkSelectionActions to render actual interactive elements
    BulkSelectionActionsMock.mockImplementation(
      ({
        selectedCount,
        onSelectAll,
        onMarkAsRead,
        onMarkAsUnread,
        onArchive,
        onUnarchive,
        onDelete,
        onCancel,
        showArchived = false,
      }) => (
        <div data-testid="bulk-actions">
          <span data-testid="selected-count">{selectedCount} selected</span>
          <button onClick={onSelectAll} data-testid="select-all">
            Select All
          </button>
          <button onClick={onMarkAsRead} data-testid="mark-as-read">
            Mark as Read
          </button>
          <button onClick={onMarkAsUnread} data-testid="mark-as-unread">
            Mark as Unread
          </button>
          {showArchived ? (
            <button onClick={onUnarchive} data-testid="unarchive">
              Unarchive
            </button>
          ) : (
            <button onClick={onArchive} data-testid="archive">
              Archive
            </button>
          )}
          <button onClick={onDelete} data-testid="delete">
            Delete
          </button>
          <button onClick={onCancel} data-testid="cancel">
            Cancel
          </button>
        </div>
      )
    );
  });


  describe('Selection State Management', () => {
    it('should show Select button to enable selection mode', async () => {
      const newsletters = makeNewsletters(3);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      renderInbox();

      // Select button should be visible
      expect(screen.getByTestId('select-button')).toBeInTheDocument();
    });

    it('should enable selection mode when Select button is clicked', async () => {
      const newsletters = makeNewsletters(3);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Initially, no bulk actions should be visible
      expect(screen.queryByTestId('bulk-actions')).not.toBeInTheDocument();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Checkboxes should now be visible and selectable
      expect(screen.getByTestId('checkbox-newsletter-0')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-newsletter-1')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-newsletter-2')).toBeInTheDocument();
    });

    it('should enable selection mode when a newsletter is selected', async () => {
      const newsletters = makeNewsletters(3);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Initially, no bulk actions should be visible
      expect(screen.queryByTestId('bulk-actions')).not.toBeInTheDocument();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select a newsletter
      const checkbox = screen.getByTestId('checkbox-newsletter-0');
      await user.click(checkbox);

      // Bulk actions should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selected-count')).toHaveTextContent('1 selected');
    });

    it('should allow selecting all newsletters', async () => {
      const newsletters = makeNewsletters(3);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select first newsletter to enable selection mode
      await user.click(screen.getByTestId('checkbox-newsletter-0'));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      // Click "Select All"
      await user.click(screen.getByTestId('select-all'));

      // All newsletters should be selected
      await waitFor(() => {
        expect(screen.getByTestId('selected-count')).toHaveTextContent('3 selected');
      });

      // All checkboxes should be checked
      newsletters.forEach((_, i) => {
        const checkbox = screen.getByTestId(`checkbox-newsletter-${i}`);
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Bulk Action Handlers', () => {
    it('should call handleBulkMarkAsRead when Mark as Read is clicked', async () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select newsletters
      await user.click(screen.getByTestId('checkbox-newsletter-0'));
      await user.click(screen.getByTestId('checkbox-newsletter-1'));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      // Click "Mark as Read"
      await user.click(screen.getByTestId('mark-as-read'));

      // Verify the handler was called with correct IDs
      await waitFor(() => {
        expect(mockSharedActions.handleBulkMarkAsRead).toHaveBeenCalledWith([
          'newsletter-0',
          'newsletter-1',
        ]);
      });
    });

    it('should call handleBulkMarkAsUnread when Mark as Unread is clicked', async () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select newsletters
      await user.click(screen.getByTestId('checkbox-newsletter-0'));
      await user.click(screen.getByTestId('checkbox-newsletter-1'));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      // Click "Mark as Unread"
      await user.click(screen.getByTestId('mark-as-unread'));

      // Verify the handler was called with correct IDs
      await waitFor(() => {
        expect(mockSharedActions.handleBulkMarkAsUnread).toHaveBeenCalledWith([
          'newsletter-0',
          'newsletter-1',
        ]);
      });
    });

    it('should call handleBulkArchive when Archive is clicked', async () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select newsletters
      await user.click(screen.getByTestId('checkbox-newsletter-0'));
      await user.click(screen.getByTestId('checkbox-newsletter-1'));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      // Click "Archive"
      await user.click(screen.getByTestId('archive'));

      // Verify the handler was called with correct IDs
      await waitFor(() => {
        expect(mockSharedActions.handleBulkArchive).toHaveBeenCalledWith([
          'newsletter-0',
          'newsletter-1',
        ]);
      });
    });

    it('should clear selection after successful bulk action', async () => {
      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');
      await user.click(selectButton);

      // Select newsletters
      await user.click(screen.getByTestId('checkbox-newsletter-0'));
      await user.click(screen.getByTestId('checkbox-newsletter-1'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-count')).toHaveTextContent('2 selected');
      });

      // Perform bulk action
      await user.click(screen.getByTestId('archive'));

      // Selection should be cleared after successful action
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-actions')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle bulk action errors gracefully', async () => {
      // Mock a failing bulk action
      const rejectionError = new Error('Network error');
      mockSharedActions.handleBulkArchive.mockRejectedValue(rejectionError);

      const newsletters = makeNewsletters(2);
      useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(newsletters));

      const user = userEvent.setup();
      renderInbox();

      // Click the Select button to enable selection mode
      const selectButton = screen.getByTestId('select-button');

      // Wrap the entire interaction in act to handle React state updates
      await act(async () => {
        await user.click(selectButton);
        // Wait a tick for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Select newsletters
      await act(async () => {
        await user.click(screen.getByTestId('checkbox-newsletter-0'));
        await user.click(screen.getByTestId('checkbox-newsletter-1'));
        // Wait a tick for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      });

      // Click "Archive" (this should fail)
      await act(async () => {
        await user.click(screen.getByTestId('archive'));
        // Wait a tick for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify the handler was called
      expect(mockSharedActions.handleBulkArchive).toHaveBeenCalled();

      // Selection should remain (since action failed)
      await waitFor(() => {
        expect(screen.getByTestId('selected-count')).toHaveTextContent('2 selected');
      });
    });
  });

  describe('Mutation Integration', () => {
    it('should pass correct mutations to useSharedNewsletterActions', () => {
      renderInbox();

      // Verify that useSharedNewsletterActions was called with the mutations from useNewsletters
      expect(useSharedNewsletterActionsMock).toHaveBeenCalledWith(
        mockNewsletters,
        expect.objectContaining({
          showToasts: true,
          optimisticUpdates: true,
          enableErrorHandling: true,
          enableLoadingStates: true,
        })
      );
    });

    it('should verify that bulk mutations are available in useNewsletters hook', () => {
      renderInbox();

      // Check that the mutations object contains all required bulk methods
      const [mutations] = useSharedNewsletterActionsMock.mock.calls[0];

      expect(mutations).toHaveProperty('bulkMarkAsRead');
      expect(mutations).toHaveProperty('bulkMarkAsUnread');
      expect(mutations).toHaveProperty('bulkArchive');
      expect(mutations).toHaveProperty('bulkUnarchive');
      expect(mutations).toHaveProperty('bulkDeleteNewsletters');

      expect(typeof mutations.bulkMarkAsRead).toBe('function');
      expect(typeof mutations.bulkMarkAsUnread).toBe('function');
      expect(typeof mutations.bulkArchive).toBe('function');
      expect(typeof mutations.bulkUnarchive).toBe('function');
      expect(typeof mutations.bulkDeleteNewsletters).toBe('function');
    });
  });
});
