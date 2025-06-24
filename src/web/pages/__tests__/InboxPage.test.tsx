import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '@web/App'; // To render within the full app structure
import InboxPage from '../Inbox'; // The component we are testing

// Hooks and Contexts to Mock
import { useAuth } from '@common/contexts/AuthContext';
import { useToast } from '@common/contexts/ToastContext';
import { useLogger, useLoggerStatic } from '@common/utils/logger/useLogger';
import { useErrorHandling } from '@common/hooks/useErrorHandling';
import { useBulkLoadingStates } from '@common/hooks/useLoadingStates';
import { useInboxFilters } from '@common/hooks/useInboxFilters';
import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { CacheInitializer } from '@common/components/CacheInitializer';
import { useEmailAlias } from '@common/hooks/useEmailAlias';


// --- Global Mocks ---
vi.mock('@common/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@common/contexts/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});
vi.mock('@common/contexts/ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@common/contexts/ToastContext')>();
  return { ...actual, useToast: vi.fn() };
});
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: vi.fn(),
  useLoggerStatic: vi.fn(),
}));
vi.mock('@common/hooks/useErrorHandling', () => ({ useErrorHandling: vi.fn() }));
vi.mock('@common/hooks/useLoadingStates', () => ({ useBulkLoadingStates: vi.fn() }));
vi.mock('@common/hooks/useInboxFilters', () => ({ useInboxFilters: vi.fn() }));
vi.mock('@common/hooks/infiniteScroll', () => ({ useInfiniteNewsletters: vi.fn() }));
vi.mock('@common/hooks/useReadingQueue', () => ({ useReadingQueue: vi.fn() }));
vi.mock('@common/hooks/useSharedNewsletterActions', () => ({ useSharedNewsletterActions: vi.fn() }));
vi.mock('@common/components/CacheInitializer', () => ({
  CacheInitializer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@common/hooks/useEmailAlias', () => ({ useEmailAlias: vi.fn() }));

// Mock framer-motion as it caused issues in TagsPage tests
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
  };
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user', email: 'test@example.com', app_metadata: {}, user_metadata: {} } }, error: null }),
    },
  })),
}));


// --- Test Setup ---
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const TestWrapper = ({ initialEntries = ['/inbox'] }: { initialEntries?: string[] }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  </QueryClientProvider>
);

// Default mock return values
const defaultMockUseAuth = {
  user: { id: 'test-user', email: 'test@example.com', app_metadata: {}, user_metadata: {} },
  session: { access_token: 'fake-token', user: { id: 'test-user' } },
  loading: false,
  isAdmin: false,
  signOut: vi.fn().mockResolvedValue(null),
  refreshSession: vi.fn().mockResolvedValue(null),
};

const defaultMockUseToast = {
  showToast: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
};

const defaultMockUseLogger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  logNavigation: vi.fn(), logUserAction: vi.fn(),
};

const defaultMockUseErrorHandling = {
  handleError: vi.fn(),
};

const defaultMockUseBulkLoadingStates = {
  isBulkActionInProgress: false,
  setBulkActionLoading: vi.fn(),
  // Add other states/setters if needed from the hook's actual implementation
};

const defaultMockUseInboxFilters = {
  filter: 'all',
  sourceFilter: null,
  timeRange: 'all',
  tagIds: [],
  debouncedTagIds: [],
  allTags: [],
  newsletterSources: [],
  newsletterFilter: { status: 'all', timeRange: 'all' },
  isLoadingSources: false,
  setFilter: vi.fn(),
  setSourceFilter: vi.fn(),
  setTimeRange: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  resetFilters: vi.fn(),
  handleTagClick: vi.fn(),
};

const defaultMockUseInfiniteNewsletters = {
  newsletters: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  totalCount: 0,
};

const defaultMockUseReadingQueue = {
  readingQueue: [],
  addToQueue: vi.fn(),
  removeFromQueue: vi.fn(),
  isLoading: false,
};

const defaultMockUseSharedNewsletterActions = {
  handleMarkAsRead: vi.fn(),
  handleMarkAsUnread: vi.fn(),
  handleToggleLike: vi.fn(),
  handleToggleArchive: vi.fn(),
  handleDeleteNewsletter: vi.fn(),
  handleToggleInQueue: vi.fn(),
  handleUpdateTags: vi.fn(),
  handleBulkMarkAsRead: vi.fn(),
  handleBulkMarkAsUnread: vi.fn(),
  handleBulkArchive: vi.fn(),
  handleBulkUnarchive: vi.fn(),
  handleBulkDelete: vi.fn(),
  isNewsletterLoading: vi.fn(() => false),
};

const defaultMockUseEmailAlias = {
  emailAlias: 'test-alias@example.com',
  loading: false,
  error: null,
  refreshEmailAlias: vi.fn(),
};


describe('InboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(defaultMockUseAuth);
    vi.mocked(useToast).mockReturnValue(defaultMockUseToast);
    vi.mocked(useLogger).mockReturnValue(defaultMockUseLogger);
    vi.mocked(useLoggerStatic).mockReturnValue(defaultMockUseLogger);
    vi.mocked(useErrorHandling).mockReturnValue(defaultMockUseErrorHandling);
    vi.mocked(useBulkLoadingStates).mockReturnValue(defaultMockUseBulkLoadingStates);
    vi.mocked(useInboxFilters).mockReturnValue(defaultMockUseInboxFilters);
    vi.mocked(useInfiniteNewsletters).mockReturnValue(defaultMockUseInfiniteNewsletters);
    vi.mocked(useReadingQueue).mockReturnValue(defaultMockUseReadingQueue);
    vi.mocked(useSharedNewsletterActions).mockReturnValue(defaultMockUseSharedNewsletterActions);
    vi.mocked(useEmailAlias).mockReturnValue(defaultMockUseEmailAlias);
  });

  afterEach(() => {
    queryClient.clear(); // Clear react-query cache between tests
  });

  it('should render loading screen when newsletters are initially loading', async () => {
    vi.mocked(useInfiniteNewsletters).mockReturnValue({
      ...defaultMockUseInfiniteNewsletters,
      isLoading: true,
      newsletters: [], // Ensure newsletters are empty during initial load
    });
    render(<TestWrapper />);
    // LoadingScreen component is rendered by InboxPage when isLoadingNewsletters is true and rawNewsletters is empty
    // It might not have specific text "Loading newsletters..." but we can check for its presence if it has a role or testId
    // Or check that the main "Inbox" heading is not yet visible
    await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /Inbox/i, level: 1 })).not.toBeInTheDocument();
        // If LoadingScreen has a known accessible role or text:
        // expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
        // For now, we assume the absence of main content indicates loading
    });
  });

  it('should render error state when fetching newsletters fails', async () => {
    const testError = new Error('Failed to fetch newsletters');
    vi.mocked(useInfiniteNewsletters).mockReturnValue({
      ...defaultMockUseInfiniteNewsletters,
      error: testError,
      isLoading: false,
    });
    render(<TestWrapper />);
    await waitFor(() => {
      expect(screen.getByText(/Error Loading Newsletters/i)).toBeInTheDocument();
      expect(screen.getByText(testError.message)).toBeInTheDocument();
    });
  });

  it('should render empty state when no newsletters are found and not loading', async () => {
    vi.mocked(useInfiniteNewsletters).mockReturnValue({
      ...defaultMockUseInfiniteNewsletters,
      newsletters: [],
      isLoading: false,
      totalCount: 0, // Explicitly set totalCount to 0
    });
    vi.mocked(useInboxFilters).mockReturnValue({
      ...defaultMockUseInboxFilters,
      filter: 'all', // Example filter state
      sourceFilter: null,
    });

    render(<TestWrapper />);
    await waitFor(() => {
      // Check for text from the EmptyState component
      expect(screen.getByText(/No newsletters found/i)).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your filters or check back later./i)).toBeInTheDocument();
    });
  });

  it('should render a list of newsletters', async () => {
    const mockNewsletters = [
      { id: 'nl1', title: 'Newsletter 1', is_read: false, is_archived: false, is_liked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: [], newsletter_source: { id: 'src1', name: 'Source 1', from_address: 's1@example.com', status: 'active', user_id: 'user1'} },
      { id: 'nl2', title: 'Newsletter 2', is_read: true, is_archived: false, is_liked: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: [{id: 't1', name: 'Tech', color: '#ff0000', user_id: 'user1', created_at: '', updated_at: ''}], newsletter_source: { id: 'src2', name: 'Source 2', from_address: 's2@example.com', status: 'active', user_id: 'user1'} },
    ];
    vi.mocked(useInfiniteNewsletters).mockReturnValue({
      ...defaultMockUseInfiniteNewsletters,
      newsletters: mockNewsletters,
      isLoading: false,
      totalCount: mockNewsletters.length,
    });

    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Newsletter 1')).toBeInTheDocument();
      expect(screen.getByText('Newsletter 2')).toBeInTheDocument();
      expect(screen.getByText(/Source 1/i)).toBeInTheDocument(); // Using regex for flexibility
      expect(screen.getByText(/Tech/i)).toBeInTheDocument(); // Using regex for flexibility
    });

    // Check for newsletter actions (e.g., like button for nl1, which is not liked)
    // This depends on how InfiniteNewsletterList renders actions.
    // For example, if there's a "Like" button:
    const newsletter1Row = screen.getByText('Newsletter 1').closest('article'); // Assuming each newsletter is an article
    if (newsletter1Row) {
      // This is a placeholder, actual query will depend on InfiniteNewsletterList's implementation
      // For example, find a button with aria-label "Like"
      // const likeButton = within(newsletter1Row).getByRole('button', { name: /like/i });
      // expect(likeButton).toBeInTheDocument();
    }
  });

  // Add more tests for rendering newsletters, filters, bulk actions etc.
});
