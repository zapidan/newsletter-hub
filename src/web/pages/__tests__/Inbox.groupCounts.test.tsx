/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@web/hooks/useGroupCounts', () => ({
  useGroupCounts: vi.fn(),
}));

vi.mock('@web/components/InboxFilters', () => ({
  __esModule: true,
  InboxFilters: vi.fn(({ newsletterGroups }) => (
    <div data-testid="inbox-filters">
      {newsletterGroups?.map((g: any) => (
        <div key={g.id} data-testid={`group-${g.id}`}>
          {g.name}: {g.count}
        </div>
      ))}
    </div>
  )),
  default: vi.fn(({ newsletterGroups }) => (
    <div data-testid="inbox-filters">
      {newsletterGroups?.map((g: any) => (
        <div key={g.id} data-testid={`group-${g.id}`}>
          {g.name}: {g.count}
        </div>
      ))}
    </div>
  )),
}));

vi.mock('@web/components/InfiniteScroll', () => ({
  InfiniteNewsletterList: vi.fn(() => <div data-testid="infinite-newsletter-list" />),
}));

vi.mock('@common/hooks/useInboxFilters', () => ({
  __esModule: true,
  useInboxFilters: vi.fn(() => ({
    filter: 'unread',
    sourceFilter: null,
    timeRange: 'all',
    debouncedTagIds: [],
    allTags: [],
    newsletterSources: [],
    isLoadingSources: false,
    groupFilters: [], // Add missing groupFilters
    sortBy: 'received_at',
    sortOrder: 'desc',
    useLocalTagFiltering: false,
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
      orderDirection: undefined, // Update to use orderDirection instead of ascending
    },
    setFilter: vi.fn(),
    setSourceFilter: vi.fn(),
    setTimeRange: vi.fn(),
    removeTag: vi.fn(),
    resetFilters: vi.fn(),
    handleTagClick: vi.fn(),
  })),
}));

vi.mock('@common/hooks/infiniteScroll/useInfiniteNewsletters', () => ({
  __esModule: true,
  useInfiniteNewsletters: vi.fn(() => ({
    newsletters: [],
    isLoading: false,
    isLoadingMore: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    error: null,
    totalCount: 0,
  })),
}));

vi.mock('@common/hooks/useNewsletterSourceGroups', () => ({
  __esModule: true,
  useNewsletterSourceGroups: vi.fn(() => ({
    groups: [
      { id: 'g1', name: 'Group A', sources: [{ id: 's1' }, { id: 's2' }] },
      { id: 'g2', name: 'Group B', sources: [{ id: 's3' }] },
    ],
    isLoading: false,
  })),
}));

vi.mock('@common/hooks/useReadingQueue', () => ({
  __esModule: true,
  useReadingQueue: vi.fn(() => ({ readingQueue: [], removeFromQueue: vi.fn() })),
}));

vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  __esModule: true,
  useSharedNewsletterActions: vi.fn(() => ({
    handleBulkMarkAsRead: vi.fn(),
    isNewsletterLoading: vi.fn(),
  })),
}));

vi.mock('@common/hooks/useNewsletters', () => ({
  __esModule: true,
  useNewsletters: vi.fn(() => ({
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
  })),
}));

vi.mock('@common/contexts', () => ({
  __esModule: true,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@common/contexts/ToastContext', () => ({
  __esModule: true,
  useToast: () => ({ showError: vi.fn() }),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  __esModule: true,
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

import { useGroupCounts } from '@web/hooks/useGroupCounts';
import Inbox from '../Inbox';

describe('Inbox group counts integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes group counts from useGroupCounts to InboxFilters', () => {
    const mockCounts = { g1: 7, g2: 3 };
    vi.mocked(useGroupCounts).mockReturnValue(mockCounts);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Inbox />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify the groups are rendered with the correct counts
    expect(screen.getByTestId('group-g1')).toHaveTextContent('Group A: 7');
    expect(screen.getByTestId('group-g2')).toHaveTextContent('Group B: 3');

    // Verify useGroupCounts was called (arguments are complex objects; just ensure it was invoked)
    expect(useGroupCounts).toHaveBeenCalled();
  });

  it('shows 0 counts when useGroupCounts returns empty', () => {
    vi.mocked(useGroupCounts).mockReturnValue({});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Inbox />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('group-g1')).toHaveTextContent('Group A: 0');
    expect(screen.getByTestId('group-g2')).toHaveTextContent('Group B: 0');
  });
});
