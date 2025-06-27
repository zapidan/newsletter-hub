/**
 * @vitest-environment jsdom
 *
 * Integration-style tests for the Inbox page.
 */
import { ToastProvider } from '@common/contexts/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*                       HOISTED  STUBS & COMPONENTS                  */
/* ------------------------------------------------------------------ */
const {
  useInboxFiltersMock,
  useInfiniteNewslettersMock,
  useReadingQueueMock,
  useSharedNewsletterActionsMock,
  useNewslettersMock,
  MockInboxFilters,
} = vi.hoisted(() => ({
  /* hooks */
  useInboxFiltersMock: vi.fn(),
  useInfiniteNewslettersMock: vi.fn(),
  useReadingQueueMock: vi.fn(),
  useSharedNewsletterActionsMock: vi.fn(),
  useNewslettersMock: vi.fn(),

  /* visual InboxFilters stub – must be **named** export[1] */
  MockInboxFilters: vi.fn(
    ({ filter, sourceFilter, timeRange, onFilterChange, onSourceFilterChange, onTimeRangeChange }) => (
      <div data-testid="inbox-filters">
        <button onClick={() => onFilterChange?.('all')}>All</button>
        <button onClick={() => onSourceFilterChange?.('source-1')}>Source 1</button>
        <button onClick={() => onTimeRangeChange?.('week')}>This Week</button>
        <span data-testid="current-filter">
          {filter}-{sourceFilter}-{timeRange}
        </span>
      </div>
    ),
  ),
}));

/* ------------------------------------------------------------------ */
/*                              MOCKS                                 */
/* ------------------------------------------------------------------ */
vi.mock('@web/components/InboxFilters', () => ({
  __esModule: true,
  InboxFilters: MockInboxFilters,          // named export needed by Inbox.tsx[1]
  default: MockInboxFilters,
  NewsletterSourceWithCount: {},           // runtime placeholder
}));

vi.mock('@web/components/BulkSelectionActions', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="bulk-actions" />),
}));

vi.mock('@web/components/InfiniteScroll', () => ({
  __esModule: true,
  InfiniteNewsletterList: vi.fn(({ newsletters = [], onLoadMore }) => (
    <div data-testid="infinite-newsletter-list">
      {newsletters.map((n: { id: string; title: string }) => (
        <div key={n.id} data-testid={`newsletter-${n.id}`}>
          {n.title}
        </div>
      ))}
      <button onClick={onLoadMore}>Load More</button>
    </div>
  )),
}));

/* hooks ------------------------------------------------------------------- */
vi.mock('@common/hooks/useInboxFilters', () => ({
  __esModule: true,
  useInboxFilters: useInboxFiltersMock,
}));

/* Inbox imports from the **barrel** path, so mock both the barrel and file */
vi.mock('@common/hooks/infiniteScroll/useInfiniteNewsletters', () => ({
  __esModule: true,
  useInfiniteNewsletters: useInfiniteNewslettersMock,
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

/* misc context & util stubs ------------------------------------------------ */
vi.mock('@common/contexts', () => ({
  __esModule: true,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
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
const makeNewsletters = (n = 5) =>
  Array.from({ length: n }, (_, i) => ({
    id: `nl-${i}`,
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
  /* actions */
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
const mkSharedActions = () => ({ handleBulkMarkAsRead: vi.fn(), isNewsletterLoading: vi.fn() });

const mkNewsletters = () => ({
  markAsRead: vi.fn(),
  markAsUnread: vi.fn(),
  toggleLike: vi.fn(),
  toggleArchive: vi.fn(),
  deleteNewsletter: vi.fn(),
  toggleInQueue: vi.fn(),
  bulkMarkAsRead: vi.fn(),
  bulkMarkAsUnread: vi.fn(),
  bulkArchive: vi.fn(),
  bulkUnarchive: vi.fn(),
  bulkDeleteNewsletters: vi.fn(),
  updateNewsletterTags: vi.fn(),
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
    </QueryClientProvider>,
  );
};

/* ------------------------------------------------------------------ */
/*                              TESTS                                 */
/* ------------------------------------------------------------------ */
describe('Inbox page', () => {
  beforeEach(() => {
    /* fresh state for every spec */
    useInboxFiltersMock.mockReturnValue(mkInboxFilters());
    useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters());
    useReadingQueueMock.mockReturnValue(mkReadingQueue());
    useSharedNewsletterActionsMock.mockReturnValue(mkSharedActions());
    useNewslettersMock.mockReturnValue(mkNewsletters());
  });

  afterEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    renderInbox();
    expect(screen.getByTestId('inbox-filters')).toBeInTheDocument();
    expect(screen.getByTestId('infinite-newsletter-list')).toBeInTheDocument();
  });

  it('displays newsletters when loaded', () => {
    const data = makeNewsletters(3);
    useInfiniteNewslettersMock.mockReturnValue(mkInfiniteNewsletters(data));

    renderInbox();
    data.forEach((n) =>
      expect(screen.getByTestId(`newsletter-${n.id}`)).toBeInTheDocument(),
    );
  });

  it('shows loading state while first page is loading', () => {
    const loading = mkInfiniteNewsletters([]);
    loading.isLoading = true;
    useInfiniteNewslettersMock.mockReturnValue(loading);

    renderInbox();
    expect(screen.getByText('Loading your newsletters...')).toBeInTheDocument(); // copy matches component[1]
  });

  it('handles filter changes', async () => {
    const filters = mkInboxFilters();
    useInboxFiltersMock.mockReturnValue(filters);

    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByText('All'));
    expect(filters.setFilter).toHaveBeenCalledWith('all');

    await user.click(screen.getByText('Source 1'));
    expect(filters.setSourceFilter).toHaveBeenCalledWith('source-1');
  });

  it('loads more newsletters when "Load More" is clicked', async () => {
    const inf = mkInfiniteNewsletters();
    inf.hasNextPage = true;
    useInfiniteNewslettersMock.mockReturnValue(inf);

    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByText('Load More'));
    expect(inf.fetchNextPage).toHaveBeenCalled();
  });

  it('shows error state when newsletters fail to load', () => {
    const error = new Error('Failed to load newsletters');
    useInfiniteNewslettersMock.mockReturnValue({
      ...mkInfiniteNewsletters([]),
      error,
      isLoading: false,
    });

    renderInbox();
    expect(screen.getByText(/Error Loading Newsletters/i)).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
  });

  it('shows empty state when no newsletters are found', () => {
    useInfiniteNewslettersMock.mockReturnValue({
      ...mkInfiniteNewsletters([]),
      isLoading: false,
      totalCount: 0,
    });

    renderInbox();
    expect(screen.getByText(/No newsletters found/i)).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your filters or check back later./i)).toBeInTheDocument();
  });
});
