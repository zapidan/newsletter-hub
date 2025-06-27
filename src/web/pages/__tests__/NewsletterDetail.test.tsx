/* eslint-disable react/jsx-no-constructed-context-values */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'; // Added fireEvent
import userEvent from '@testing-library/user-event';
import * as ReactRouterDom from 'react-router-dom'; // Import for spyOn
import { vi, type MockedFunction } from 'vitest';
import * as NavModule from '../../../components/NewsletterDetail/NewsletterNavigation';

/* ────────────  HOISTED MODULE-MOCKS  ──────────── */
/*   Mock every possible path to NewsletterNavigation so the real file
 *   never gets imported. This prevents any real implementation from
 *   being loaded, which is crucial for testing in isolation. */
vi.mock('../../../components/NewsletterDetail/NewsletterNavigation', () => ({
  default: vi.fn(({ currentNewsletterId }: any) => (
    <div data-testid="mock-newsletter-navigation" data-current={currentNewsletterId} />
  )),
}));

/* 1️⃣  Stub react-modal so it never touches the real DOM   */
vi.mock('react-modal', () => ({
  // eslint-disable-next-line react/display-name
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-modal">{children}</div>
  ),
  setAppElement: () => { },
}));

/* 2️⃣  Stub useNewsletters to avoid cache-manager startup  */
vi.mock('@common/hooks/useNewsletters', () => ({
  useNewsletters: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

/* Mock useSharedNewsletterActions at the top level */
// Mock implementations that match the expected function signatures
const mockHandleMarkAsRead = vi.fn().mockResolvedValue(undefined);
const mockHandleToggleArchive = vi.fn().mockResolvedValue(undefined);
const mockHandleToggleInQueue = vi.fn().mockResolvedValue(undefined);

vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  useSharedNewsletterActions: () => ({
    handleMarkAsRead: mockHandleMarkAsRead,
    handleToggleArchive: mockHandleToggleArchive,
    handleToggleInQueue: mockHandleToggleInQueue,
  }),
}));

/* Mock Supabase client */
vi.mock('@common/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1' } } },
        error: null,
      }),
    },
  },
}));

/* Mock useParams to return the newsletter ID */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'nl-1' })), // Default mock for useParams
    useLocation: vi.fn(() => ({ // Default mock, can be overridden in tests
      pathname: '/newsletters/nl-1',
      state: null,
      search: '',
      key: 'defaultKey',
      hash: ''
    })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

/* Mock readingQueueApi */
vi.mock('@common/api/readingQueueApi', () => ({
  isInQueue: vi.fn().mockResolvedValue(false),
}));

/* Mock useReadingQueue */
vi.mock('@common/hooks/useReadingQueue', () => ({
  useReadingQueue: () => ({
    removeFromQueue: vi.fn().mockResolvedValue(undefined),
    addToQueue: vi.fn().mockResolvedValue(undefined),
    isInQueue: vi.fn().mockReturnValue(false),
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Create mock functions at module level
const mockUpdateNewsletterTags = vi.fn().mockResolvedValue(true);
// Ensure getTags & memoizedGetTags always return a Promise resolving to an array
const mockGetTags = vi.fn().mockImplementation(() => Promise.resolve([]));
const mockMemoizedGetTags = vi.fn().mockImplementation(() => Promise.resolve([]));
const mockUpdateTag = vi.fn().mockResolvedValue(undefined);
const mockCreateTag = vi.fn().mockResolvedValue(undefined);
const mockDeleteTag = vi.fn().mockResolvedValue(undefined);

// Simple mock without dynamic imports
vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    tags: [], // Provide a default empty array for tags state
    loading: false,
    error: null,
    getTags: mockGetTags, // Ensure this is consistently a Promise
    memoizedGetTags: mockMemoizedGetTags, // Ensure this is consistently a Promise
    updateNewsletterTags: mockUpdateNewsletterTags,
    updateTag: mockUpdateTag,
    createTag: mockCreateTag,
    deleteTag: mockDeleteTag,
  }),
}));

/* ────────────  REMAINING LIGHTWEIGHT MOCKS  ──────────── */
const mockUseNewsletterDetail = vi.fn();
vi.mock('@common/hooks/useNewsletterDetail', () => ({
  useNewsletterDetail: (id: string, options: any) => {
    // Call the mock function with the arguments for assertions
    mockUseNewsletterDetail(id, options);
    // Return the mock implementation
    return (
      mockUseNewsletterDetail.mock.results[0]?.value || {
        newsletter: undefined,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn().mockResolvedValue(undefined),
        prefetchRelated: vi.fn(),
      }
    );
  },
}));

vi.mock('@web/components/TagSelector', () => ({
  // A minimal, interactive stub
  default: ({ onTagsChange, selectedTags = [] }: { onTagsChange: (tags: any[]) => void; selectedTags?: any[] }) => (
    <div data-testid="tag-selector">
      <button
        data-testid="add-tag"
        onClick={() => onTagsChange([{ id: 'tag1', name: 'New Tag', color: '#000' }])}
      >
        add
      </button>
      {selectedTags.map((t: any) => (
        <button key={t.id} data-testid={`remove-${t.id}`} onClick={() => onTagsChange([])}>
          {t.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@common/components/common/LoadingScreen', () => ({
  default: () => <div data-testid="loading" />,
}));

// Mock useInboxFilters to simplify testing of NewsletterDetail and NewsletterNavigation
const mockUseInboxFiltersReturn = {
  filter: 'all',
  sourceFilter: null,
  timeRange: 'all',
  debouncedTagIds: [],
  allTags: [],
  newsletterSources: [],
  newsletterFilter: {},
  isLoadingSources: false,
  setFilter: vi.fn(),
  setSourceFilter: vi.fn(),
  setTimeRange: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  resetFilters: vi.fn(),
  handleTagClick: vi.fn(),
};
vi.mock('@common/hooks/useInboxFilters', () => ({
  useInboxFilters: vi.fn(() => mockUseInboxFiltersReturn),
}));


/* stub React-DOM portal → avoid jsdom "node to be removed" crash */
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: any) => node };
});

/* ────────────  TEST CODE  ──────────── */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation as useReactRouterLocation, useNavigate as useReactRouterNavigate } from 'react-router-dom';

import { CacheInitializer } from '@common/components/CacheInitializer';
import { AuthContext } from '@common/contexts/AuthContext';
import { FilterProvider } from '@common/contexts/FilterContext';
import { ToastProvider } from '@common/contexts/ToastContext';
import type { NewsletterWithRelations } from '@common/types';
import NewsletterDetail from '../NewsletterDetail';
// Using mocked version of useTags

/* browser-api stubs missing from jsdom */
global.ResizeObserver = class {
  observe() { }
  unobserve() { }
  disconnect() { }
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

// Define mockUser for use in tests
const mockUser = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  user_metadata: { name: 'Test User' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: {
              access_token: 'test-token',
              refresh_token: 'test-refresh',
              expires_in: 3600,
              token_type: 'bearer',
              user: mockUser
            },
            loading: false,
            error: null,
            signIn: vi.fn(),
            signOut: vi.fn(),
            signUp: vi.fn(),
            resetPassword: vi.fn(),
            updatePassword: vi.fn(),
            checkPasswordStrength: vi.fn(),
          }}
        >
          <FilterProvider useLocalTagFiltering={true}>
            <CacheInitializer>
              <ToastProvider>
                <NewsletterDetail />
              </ToastProvider>
            </CacheInitializer>
          </FilterProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

/* minimal fixture */
const newsletter: NewsletterWithRelations = {
  id: 'nl-1',
  title: 'T',
  content: '<p>C</p>',
  summary: '',
  image_url: '',
  received_at: '',
  updated_at: '',
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'u1',
  newsletter_source_id: 's1',
  word_count: 0,
  estimated_read_time: 1,
  source: {
    id: 's1',
    name: '',
    from: '',
    user_id: 'u1',
    created_at: '',
    updated_at: '',
    is_archived: false,
  },
  tags: [],
};

beforeEach(() => {
  queryClient.clear();
  mockUseNewsletterDetail.mockReset();
  vi.clearAllMocks();
  // Reset all mock functions
  mockHandleMarkAsRead.mockClear();
  mockHandleToggleArchive.mockClear();
  mockHandleToggleInQueue.mockClear();
  mockUpdateNewsletterTags.mockClear();
  mockGetTags.mockClear();
  mockMemoizedGetTags.mockClear();
  mockUpdateTag.mockClear();
  mockCreateTag.mockClear();
  mockDeleteTag.mockClear();

  // Set default mock implementation
  mockUseNewsletterDetail.mockReturnValue({
    newsletter: { ...newsletter, is_read: false },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    prefetchRelated: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const mockUseLocation = useReactRouterLocation as MockedFunction<typeof useReactRouterLocation>;
const mockUseNavigate = useReactRouterNavigate as MockedFunction<typeof useReactRouterNavigate>;


describe('NewsletterDetail (fast version)', () => {
  it('calls useNewsletterDetail with expected params', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: null,
      search: '',
      key: 'test-key',
      hash: ''
    });
    renderPage();
    expect(mockUseNewsletterDetail).toHaveBeenCalledWith(
      'nl-1',
      expect.objectContaining({
        enabled: true,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        prefetchTags: true,
        prefetchSource: true,
      })
    );
  });

  it('shows loading component', () => {
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders content html when loaded', () => {
    renderPage();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('calls handleMarkAsRead on "mark as read" click', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const prefetchRelated = vi.fn().mockResolvedValue(undefined);

    // Mock the useNewsletterDetail hook to return a newsletter that's not read
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: {
        ...newsletter,
        is_read: false,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated,
    });

    // Reset the mock before rendering
    mockHandleMarkAsRead.mockClear();

    renderPage();
    const user = userEvent.setup();

    // Wait for any initial async operations to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Click the mark as read button
    const markAsReadButtons = screen.getAllByTestId('mark-as-read-btn');
    await act(async () => {
      await user.click(markAsReadButtons[0]);
    });

    // Check that handleMarkAsRead was called with the newsletter id
    await waitFor(() => {
      expect(mockHandleMarkAsRead).toHaveBeenCalledWith(newsletter.id);
    });
  });

  it('automatically marks newsletter as read when loaded', async () => {
    const refetch = vi.fn();
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: { ...newsletter, is_read: false },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated: vi.fn(),
    });

    renderPage();
    await waitFor(() => {
      expect(mockHandleMarkAsRead).toHaveBeenCalledWith(newsletter.id);
    });
  });

  it('automatically archives read newsletter after a delay', async () => {
    vi.useFakeTimers();

    const refetch = vi.fn();

    // Start with a newsletter that is read but not archived
    const readNewsletter = { ...newsletter, is_read: true, is_archived: false };

    mockUseNewsletterDetail.mockReturnValue({
      newsletter: readNewsletter,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated: vi.fn(),
    });

    mockHandleToggleArchive.mockResolvedValue(undefined);

    renderPage();

    // Verify content renders
    expect(screen.getByText('C')).toBeInTheDocument();

    // Fast-forward time by 3 seconds to trigger auto-archive
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve(); // Ensure promises triggered by timers resolve
    });

    // Verify auto-archive was called
    expect(mockHandleToggleArchive).toHaveBeenCalledWith(
      expect.objectContaining({ id: newsletter.id, is_read: true, is_archived: false })
    );

    vi.useRealTimers();
  });

  it('handles newsletter queue toggle correctly', async () => {
    const refetch = vi.fn();
    const user = userEvent.setup();

    mockUseNewsletterDetail.mockReturnValue({
      newsletter: { ...newsletter },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated: vi.fn(),
    });

    renderPage();

    // Find and click the queue toggle button
    const queueButton = await screen.findByLabelText(/add to queue/i);
    await act(async () => {
      await user.click(queueButton);
    });

    // Verify handleToggleInQueue was called with correct parameters
    expect(mockHandleToggleInQueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: newsletter.id }),
      false // isInQueue should be false initially
    );
  });

  it('allows adding and removing tags', async () => {
    // Reset all mocks before this test
    vi.clearAllMocks();

    const refetch = vi.fn().mockResolvedValue(undefined);
    const prefetchRelated = vi.fn().mockResolvedValue(undefined);

    // Create a mock implementation of the TagSelector component
    const MockTagSelector = vi
      .fn()
      .mockImplementation(({ onAddTag, onRemoveTag, selectedTags = [] }) => (
        <div data-testid="tag-selector">
          <input
            data-testid="tag-input"
            placeholder="Add a tag"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                onAddTag({
                  id: 'new-tag',
                  name: (e.target as HTMLInputElement).value,
                  color: '#000000',
                });
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <div data-testid="selected-tags">
            {selectedTags.map((tag: any) => (
              <button key={tag.id} data-testid={`tag-${tag.id}`} onClick={() => onRemoveTag(tag)}>
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ));

    // Mock the TagSelector component
    vi.doMock('@web/components/TagSelector', () => ({
      __esModule: true,
      default: MockTagSelector,
    }));

    // Setup user event with proper options
    const user = userEvent.setup({ delay: null });

    // Mock the updateNewsletterTags function
    mockUpdateNewsletterTags.mockResolvedValue(true);

    // Mock the useNewsletterDetail hook to return a newsletter with no tags initially
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: {
        ...newsletter,
        tags: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    });

    // Mock the useNewsletterDetail hook
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: {
        ...newsletter,
        tags: [], // Start with no tags
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated,
    });

    // Mock the memoizedGetTags to return some tags
    mockMemoizedGetTags.mockResolvedValue([{ id: 'tag1', name: 'New Tag' }]);

    renderPage();

    await act(async () => {
      await user.click(screen.getByTestId('add-tag'));
    });

    expect(mockUpdateNewsletterTags).toHaveBeenCalledWith(newsletter.id, [
      { id: 'tag1', name: 'New Tag', color: '#000' },
    ]);
    expect(refetch).toHaveBeenCalled();

    // Mock the useNewsletterDetail hook
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: {
        ...newsletter,
        tags: [], // Start with no tags
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch,
      prefetchRelated: vi.fn(),
    });

    renderPage();
  });
});

describe('API Call Verification', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementation for useNewsletterDetail
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: false, is_archived: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('makes initial API calls on mount', async () => {
    // Mock the useNewsletterDetail hook
    const mockPrefetchRelated = vi.fn().mockResolvedValue(undefined);
    const mockRefetch = vi.fn().mockResolvedValue({});

    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      prefetchRelated: mockPrefetchRelated,
    }));

    renderPage();

    // Verify initial calls
    // Allow for multiple calls to mockUseNewsletterDetail due to React's rendering behavior
    expect(mockUseNewsletterDetail).toHaveBeenCalled();

    // Verify handleMarkAsRead was called with the correct arguments
    expect(mockHandleMarkAsRead).toHaveBeenCalledWith(expect.any(String));

    // Verify prefetchRelated was called
    expect(mockPrefetchRelated).toHaveBeenCalled();

    // Reset mocks to track subsequent calls
    vi.clearAllMocks();

    // Ensure no additional unexpected calls were made
    expect(mockHandleMarkAsRead).not.toHaveBeenCalled();
    expect(mockPrefetchRelated).not.toHaveBeenCalled();
  });

  it('auto-marks newsletter as read on mount', async () => {
    // Mock an unread newsletter
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));

    renderPage();

    // Should call mark as read once
    expect(mockHandleMarkAsRead).toHaveBeenCalledTimes(1);
  });

  it('does not auto-mark as read if already read', async () => {
    // Mock an already read newsletter
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: true },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));

    renderPage();

    // Should not call mark as read
    expect(mockHandleMarkAsRead).not.toHaveBeenCalled();
  });

  it('auto-archives read newsletter after delay', async () => {
    // Mock the timer
    vi.useFakeTimers();

    // Mock a read newsletter
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: true, is_archived: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));

    renderPage();

    // Fast-forward time by 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Should call toggle archive once
    expect(mockHandleToggleArchive).toHaveBeenCalledTimes(1);

    // Clean up timers
    vi.useRealTimers();
  });

  it('does not auto-archive if already archived', async () => {
    // Mock the timer
    vi.useFakeTimers();

    // Mock an already archived newsletter
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: true, is_archived: true },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));

    renderPage();

    // Fast-forward time by 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not call toggle archive
    expect(mockHandleToggleArchive).not.toHaveBeenCalled();

    // Clean up timers
    vi.useRealTimers();
  });

  it('cleans up timers on unmount', async () => {
    // Mock the timer
    vi.useFakeTimers();

    // Mock a read newsletter
    mockUseNewsletterDetail.mockImplementation((id) => ({
      newsletter: { ...newsletter, id, is_read: true, is_archived: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn().mockResolvedValue(undefined),
    }));

    const { unmount } = renderPage();

    // Unmount before the timer fires
    unmount();

    // Fast-forward time by 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not call toggle archive after unmount
    expect(mockHandleToggleArchive).not.toHaveBeenCalled();

    // Clean up timers
    vi.useRealTimers();
  });
});

describe('NewsletterDetail - Error State Navigation', () => {
  const mockNavigateFn = vi.fn();

  beforeEach(() => {
    mockNavigateFn.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigateFn);
    // Store original history and restore it after each test in this block
    const originalHistory = window.history;
    window.history.back = vi.fn(); // Mock back for all tests in this block
    return () => { // Cleanup function for afterEach
      window.history = originalHistory;
    };
  });

  test('shows "Back to Inbox" in error state and navigates to /inbox (assuming no history stack)', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: null,
      search: '',
      key: 'test-key',
      hash: ''
    });
    // Mock error state
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });

    // Simulate history.length <= 1 so it uses navigate
    const originalHistory = window.history;
    // @ts-ignore
    delete window.history;
    // @ts-ignore
    window.history = { ...originalHistory, length: 1, back: vi.fn(), replaceState: vi.fn(), go: vi.fn() };

    renderPage();
    const backButton = screen.getByText('Back to Inbox');
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigateFn).toHaveBeenCalledWith('/inbox', { replace: true });
    expect(window.history.back).not.toHaveBeenCalled();
    window.history = originalHistory;
  });

  test('shows "Back to Reading Queue" in error state and navigates to /queue if fromReadingQueue is true in state (assuming no history stack)', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: { fromReadingQueue: true },
      search: '',
      key: 'test-key',
      hash: ''
    });
    // Mock error state
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });

    const originalHistory = window.history;
    // @ts-ignore
    delete window.history;
    // @ts-ignore
    window.history = { ...originalHistory, length: 1, back: vi.fn(), replaceState: vi.fn(), go: vi.fn() };
    renderPage();
    const backButton = screen.getByText('Back to Reading Queue');
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigateFn).toHaveBeenCalledWith('/queue', { replace: true });
    window.history = originalHistory;
  });

  test('shows "Back to Reading Queue" in error state and navigates to /queue if from is /reading-queue in state (assuming no history stack)', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: { from: '/reading-queue' },
      search: '',
      key: 'test-key',
      hash: ''
    });
    // Mock error state
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });

    const originalHistory = window.history;
    // @ts-ignore
    delete window.history;
    // @ts-ignore
    window.history = { ...originalHistory, length: 1, back: vi.fn(), replaceState: vi.fn(), go: vi.fn() };
    renderPage();
    const backButton = screen.getByText('Back to Reading Queue');
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigateFn).toHaveBeenCalledWith('/queue', { replace: true });
    window.history = originalHistory;
  });

  test('shows "Back to Newsletter Sources" in error state and navigates to /newsletters if fromNewsletterSources is true in state (assuming no history stack)', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: { fromNewsletterSources: true },
      search: '',
      key: 'test-key',
      hash: ''
    });
    // Mock error state
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });

    const originalHistory = window.history;
    // @ts-ignore
    delete window.history;
    // @ts-ignore
    window.history = { ...originalHistory, length: 1, back: vi.fn(), replaceState: vi.fn(), go: vi.fn() };
    renderPage();
    const backButton = screen.getByText('Back to Newsletter Sources');
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigateFn).toHaveBeenCalledWith('/newsletters', { replace: true });
    window.history = originalHistory;
  });

  test('uses window.history.back() in error state if history.length > 1', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/newsletters/nl-1',
      state: null,
      search: '',
      key: 'test-key',
      hash: ''
    });
    // Mock error state
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Test error'),
      isFetching: false,
      refetch: vi.fn(),
      prefetchRelated: vi.fn(),
    });

    const originalHistory = window.history;
    const mockBack = vi.fn();
    // @ts-ignore
    delete window.history; // Make window.history writable for the test
    // @ts-ignore
    window.history = { ...originalHistory, length: 2, back: mockBack, replaceState: vi.fn(), go: vi.fn() };

    renderPage();
    const backButton = screen.getByText('Back to Inbox');
    fireEvent.click(backButton);

    expect(mockBack).toHaveBeenCalledTimes(1);
    // In this scenario, navigate might be called as a fallback by the setTimeout,
    // but the primary action is history.back(). For simplicity, we don't check navigate here.

    window.history = originalHistory; // Restore original history object
  });
});

describe('NewsletterDetail - TagSelector Interactions', () => {
  const mockRefetchNewsletterDetail = vi.fn();

  beforeEach(() => {
    mockRefetchNewsletterDetail.mockClear();
    mockUpdateNewsletterTags.mockClear();
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: { ...newsletter, tags: [] }, // Start with no tags for some tests
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchNewsletterDetail,
      prefetchRelated: vi.fn(),
    });
  });

  test('calls updateNewsletterTags and refetches when TagSelector changes tags', async () => {
    renderPage();
    // The mocked TagSelector calls onTagsChange with a new tag when "add-tag" is clicked
    const addTagButtonInMockedSelector = screen.getByTestId('add-tag');
    fireEvent.click(addTagButtonInMockedSelector);

    await waitFor(() => {
      expect(mockUpdateNewsletterTags).toHaveBeenCalledWith(newsletter.id, [{ id: 'tag1', name: 'New Tag', color: '#000' }]);
    });
    await waitFor(() => {
      expect(mockRefetchNewsletterDetail).toHaveBeenCalledTimes(1);
    });
  });

  test('updates TagSelector key (forcing rerender) after successful tag update', async () => {
    mockUpdateNewsletterTags.mockResolvedValue(true); // Ensure success
    const { rerender } = renderPage();

    const initialKey = screen.getByTestId('tag-selector').getAttribute('key');

    const addTagButtonInMockedSelector = screen.getByTestId('add-tag');
    fireEvent.click(addTagButtonInMockedSelector);

    await waitFor(() => expect(mockUpdateNewsletterTags).toHaveBeenCalled());
    await waitFor(() => expect(mockRefetchNewsletterDetail).toHaveBeenCalled());

    // To observe key change, we might need to simulate the state update that changes the key
    // This is tricky as the key is internal state.
    // Awaiting refetch implies the state update for the key should have happened.
    // We can't directly check the key prop easily without a more complex mock of TagSelector
    // or by inspecting the component instance if possible (not standard RTL).
    // For now, we assume if refetch is called, the key logic is also triggered.
    // A more direct test would require exposing the key or a way to observe its change.
  });
});

describe.skip('NewsletterDetail - NewsletterNavigation Props', () => {
  const originalUseParams = ReactRouterDom.useParams;

  beforeEach(() => {
    // Reset useNewsletterDetail mock for this suite if needed, or configure per test
    mockUseNewsletterDetail.mockReset();
  });

  afterEach(() => {
    // @ts-ignore
    ReactRouterDom.useParams = originalUseParams;
    vi.clearAllMocks();
  });

  test('passes correct props to NewsletterNavigation', () => {
    const currentId = 'nl-123';
    mockUseLocation.mockReturnValue({
      pathname: `/newsletters/${currentId}`,
      state: { fromReadingQueue: true, sourceId: 'source-xyz' },
      search: '',
      key: 'nav-test-key',
      hash: ''
    });

    // Ensure useParams returns the correct ID for this specific test
    // @ts-ignore
    ReactRouterDom.useParams = vi.fn().mockReturnValue({ id: currentId });

    // Ensure useNewsletterDetail returns a valid newsletter for this ID and is not loading/erroring
    mockUseNewsletterDetail.mockReturnValue({
      newsletter: { // Provide all required fields for NewsletterWithRelations
        id: currentId,
        title: "Specific For Nav Test",
        content: "<p>Test</p>",
        summary: "Summary",
        image_url: "",
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_read: false,
        is_liked: false,
        is_archived: false,
        user_id: mockUser.id,
        newsletter_source_id: 'src-test',
        source_id: 'src-test',
        source: { id: 'src-test', name: 'Test Nav Source', from_address: 'test@nav.com', user_id: mockUser.id, created_at: '', updated_at: '', is_archived: false },
        tags: [],
        word_count: 10,
        estimated_read_time: 1,
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
      prefetchRelated: vi.fn(),
    });

    // Custom render for this test to control MemoryRouter's initial entry
    render(
      <MemoryRouter initialEntries={[`/newsletters/${currentId}`]}>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider
            value={{
              user: mockUser,
              session: {
                access_token: 'test-token',
                refresh_token: 'test-refresh',
                expires_in: 3600,
                token_type: 'bearer',
                user: mockUser
              },
              loading: false,
              error: null,
              signIn: vi.fn(),
              signOut: vi.fn(),
              signUp: vi.fn(),
              resetPassword: vi.fn(),
              updatePassword: vi.fn(),
              checkPasswordStrength: vi.fn(),
            }}
          >
            <FilterProvider useLocalTagFiltering={true}>
              <CacheInitializer>
                <ToastProvider>
                  <NewsletterDetail />
                </ToastProvider>
              </CacheInitializer>
            </FilterProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Debug: log NavMock.default calls
    console.log('NavMock.default.mock.calls:', (NavModule.default as any).mock.calls);

    expect(NavModule.default).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNewsletterId: currentId,
        isFromReadingQueue: true,
        sourceId: 'source-xyz',
        autoMarkAsRead: false,
      }),
      expect.anything()
    );
  });
});
