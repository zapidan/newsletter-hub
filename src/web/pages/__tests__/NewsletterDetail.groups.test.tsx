import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import NewsletterDetail from '../NewsletterDetail';

// Mock react-router-dom hooks with hoisted variables
const { mockNavigate, mockUseLocation, mockUseSearchParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn(),
  mockUseSearchParams: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: mockUseLocation,
    useSearchParams: mockUseSearchParams,
  };
});

// Mock dependencies
vi.mock('@common/contexts/AuthContext', () => ({
  AuthContext: { current: { user: { id: 'test-user' } } },
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('@common/hooks/useNewsletterDetail', () => ({
  useNewsletterDetail: () => ({
    newsletter: {
      id: 'test-newsletter-1',
      subject: 'Test Newsletter',
      content: 'Test content',
      source_id: 'test-source-1',
      source: {
        id: 'test-source-1',
        name: 'Test Source',
      },
    },
    isLoading: false,
    error: null,
    isError: false,
    refetch: vi.fn(),
    prefetchRelated: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useNewsletterSourceGroups', () => ({
  useNewsletterSourceGroups: () => ({
    groups: [
      { id: 'group1', name: 'Group 1' },
      { id: 'group2', name: 'Group 2' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  useSharedNewsletterActions: () => ({
    handleMarkAsRead: vi.fn(),
    handleMarkAsUnread: vi.fn(),
    handleToggleLike: vi.fn(),
    handleArchive: vi.fn(),
    handleUnarchive: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useSimpleNewsletterNavigation', () => ({
  useSimpleNewsletterNavigation: () => ({
    previousNewsletter: null,
    nextNewsletter: null,
    navigateToNewsletter: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    getTags: vi.fn().mockResolvedValue([]),
    availableTags: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@common/services', () => ({
  newsletterService: {
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

vi.mock('@common/services/newsletterSourceGroup/NewsletterSourceGroupService', () => ({
  findGroupBySourceId: vi.fn(),
  newsletterSourceGroupService: {
    removeSourcesFromGroup: vi.fn(),
    addSourcesToGroup: vi.fn(),
  },
}));

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

describe('NewsletterDetail - Groups Parameter Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render back button with correct text based on navigation state', () => {
    // Mock default case (fromReadingQueue: false)
    mockUseLocation.mockReturnValue({
      state: { fromReadingQueue: false },
      search: '?groups=group1,group2&filter=liked&source=test-source&time=week',
    });

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('?groups=group1,group2&filter=liked&source=test-source&time=week'),
      vi.fn()
    ]);

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewsletterDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should show "Back to Inbox" by default
    expect(screen.getByText('Back to Inbox')).toBeInTheDocument();
  });

  it('should show "Back to Reading Queue" when from reading queue', () => {
    // Mock reading queue case
    mockUseLocation.mockReturnValue({
      state: { fromReadingQueue: true },
      search: '?groups=group1,group2',
    });

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('?groups=group1,group2'),
      vi.fn()
    ]);

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewsletterDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should show "Back to Reading Queue" when useLocation returns fromReadingQueue: true
    expect(screen.getByText('Back to Reading Queue')).toBeInTheDocument();
  });

  it('should preserve multiple URL parameters when navigating back', () => {
    // Mock default case
    mockUseLocation.mockReturnValue({
      state: { fromReadingQueue: false },
      search: '?groups=group1,group2&filter=liked&source=test-source&time=week',
    });

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('?groups=group1,group2&filter=liked&source=test-source&time=week'),
      vi.fn()
    ]);

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewsletterDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Find and click back button
    const backButton = screen.getByText('Back to Inbox');

    // Click back button
    fireEvent.click(backButton);

    // Should navigate to inbox with all parameters preserved
    expect(mockNavigate).toHaveBeenCalledWith(
      '/inbox?groups=group1%2Cgroup2&filter=liked&source=test-source&time=week',
      { replace: true }
    );
  });

  it('should navigate to reading queue without preserving groups when from reading queue', () => {
    // Mock reading queue case
    mockUseLocation.mockReturnValue({
      state: { fromReadingQueue: true },
      search: '?groups=group1,group2',
    });

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('?groups=group1,group2'),
      vi.fn()
    ]);

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewsletterDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Find and click back button - should now show "Back to Reading Queue"
    const backButton = screen.getByText('Back to Reading Queue');

    // Click back button
    fireEvent.click(backButton);

    // Should navigate to queue with preserved groups
    expect(mockNavigate).toHaveBeenCalledWith(
      '/queue?groups=group1%2Cgroup2',
      { replace: true }
    );
  });
});
