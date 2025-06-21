/* eslint-disable react/jsx-no-constructed-context-values */
import { vi } from 'vitest';

/* ────────────  HOISTED MODULE-MOCKS  ──────────── */
/*   Mock every possible path to NewsletterNavigation so the real file
 *   never gets imported. This prevents any real implementation from
 *   being loaded, which is crucial for testing in isolation. */
const NavMock = {
  default: ({ currentNewsletterId }: any) => (
    <div data-testid="mock-newsletter-navigation" data-current={currentNewsletterId} />
  ),
};
vi.mock(
  'src/components/NewsletterDetail/NewsletterNavigation',
  () => NavMock,
);

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
const mockHandleMarkAsRead = vi.fn().mockResolvedValue(undefined);
const mockHandleToggleArchive = vi.fn().mockResolvedValue(undefined);

vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  useSharedNewsletterActions: () => ({
    handleMarkAsRead: mockHandleMarkAsRead,
    handleToggleArchive: mockHandleToggleArchive,
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

/* ────────────  REMAINING LIGHTWEIGHT MOCKS  ──────────── */
const mockUseNewsletterDetail = vi.fn();
vi.mock('@common/hooks/useNewsletterDetail', () => ({
  useNewsletterDetail: (id: string, options: any) => {
    // Call the mock function with the arguments for assertions
    mockUseNewsletterDetail(id, options);
    // Return the mock implementation
    return mockUseNewsletterDetail.mock.results[0]?.value || {
      newsletter: undefined,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
      prefetchRelated: vi.fn(),
    };
  },
}));

vi.mock('@web/components/TagSelector', () => ({
  default: () => <div data-testid="mock-tag-selector" />,
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
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  render,
  screen,
  waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CacheInitializer } from '@common/components/CacheInitializer';
import { AuthContext } from '@common/contexts/AuthContext';
import { FilterProvider } from '@common/contexts/FilterContext';
import { ToastProvider } from '@common/contexts/ToastContext';
import type { NewsletterWithRelations } from '@common/types';
import NewsletterDetail from '../NewsletterDetail';

/* browser-api stubs missing from jsdom */
global.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };

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
  // Reset all mock functions
  mockHandleMarkAsRead.mockClear();
  mockHandleToggleArchive.mockClear();

  // Set default mock implementation
  mockUseNewsletterDetail.mockReturnValue({
    newsletter: { ...newsletter, is_read: false },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    prefetchRelated: vi.fn(),
  });
});

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
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

  it('fires refetch on "mark as read" click', async () => {
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

    renderPage();
    const user = userEvent.setup();

    // Wait for any initial async operations to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Reset the mock to ignore any previous calls (like from initial render)
    refetch.mockClear();

    // Click the mark as read button
    const markAsReadButton = screen.getByLabelText(/mark as read/i);
    await user.click(markAsReadButton);

    // Check that refetch was called at least once after the button click
    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });
});
