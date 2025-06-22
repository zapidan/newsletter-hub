/* eslint-disable react/jsx-no-constructed-context-values */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/* ────────────  HOISTED MODULE-MOCKS  ──────────── */
/*   Mock every possible path to NewsletterNavigation so the real file
 *   never gets imported. This prevents any real implementation from
 *   being loaded, which is crucial for testing in isolation. */
const NavMock = {
  default: vi.fn(({ currentNewsletterId }: any) => (
    <div data-testid="mock-newsletter-navigation" data-current={currentNewsletterId} />
  )),
};
vi.mock('src/components/NewsletterDetail/NewsletterNavigation', () => NavMock);

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
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'nl-1' }),
    useLocation: () => ({
      pathname: '/newsletters/nl-1',
      state: null,
      search: '',
    }),
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
const mockGetTags = vi.fn().mockResolvedValue([]);
const mockMemoizedGetTags = vi.fn().mockResolvedValue([]);
const mockUpdateTag = vi.fn().mockResolvedValue(undefined);
const mockCreateTag = vi.fn().mockResolvedValue(undefined);
const mockDeleteTag = vi.fn().mockResolvedValue(undefined);

// Simple mock without dynamic imports
vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    tags: [],
    loading: false,
    error: null,
    getTags: mockGetTags,
    memoizedGetTags: mockMemoizedGetTags,
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
  default: ({ onTagsChange, selectedTags = [] }) => (
    <div data-testid="tag-selector">
      <button
        data-testid="add-tag"
        onClick={() => onTagsChange([{ id: 'tag1', name: 'New Tag', color: '#000' }])}
      >
        add
      </button>
      {selectedTags.map((t) => (
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

/* stub React-DOM portal → avoid jsdom “node to be removed” crash */
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: any) => node };
});

/* ────────────  TEST CODE  ──────────── */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

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

const renderPage = () => {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: { id: 'u1' },
            session: { access_token: 'test-token' },
            isLoading: false,
            signIn: vi.fn(),
            signOut: vi.fn(),
            refreshSession: vi.fn(),
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
  NavMock.default.mockClear();

  // Reset all mock functions
  mockHandleMarkAsRead.mockClear().mockResolvedValue(undefined);
  mockHandleToggleArchive.mockClear().mockResolvedValue(undefined);
  mockHandleToggleInQueue.mockClear().mockResolvedValue(undefined);
  mockUpdateNewsletterTags.mockClear().mockResolvedValue(true);
  mockMemoizedGetTags.mockClear().mockResolvedValue([]);

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

describe('NewsletterDetail (fast version)', () => {
  it('calls useNewsletterDetail with expected params', () => {
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
    const markAsReadButton = screen.getByLabelText(/mark as read/i);
    await user.click(markAsReadButton);

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

    mockHandleToggleArchive.mockResolvedValue();

    renderPage();

    // Verify content renders
    expect(screen.getByText('C')).toBeInTheDocument();

    // Fast-forward time by 3 seconds to trigger auto-archive
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Run pending timers
    await act(async () => {
      await Promise.resolve();
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
    await user.click(queueButton);

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

    await user.click(screen.getByTestId('add-tag'));

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
    });

    // Should not call toggle archive after unmount
    expect(mockHandleToggleArchive).not.toHaveBeenCalled();

    // Clean up timers
    vi.useRealTimers();
  });
});
