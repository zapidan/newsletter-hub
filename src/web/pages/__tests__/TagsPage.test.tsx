import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TagsPage from '../TagsPage';
import { useTags } from '@common/hooks/useTags';
import { useEmailAlias } from '@common/hooks/useEmailAlias'; // Added this import
import { type Tag } from '@common/types';
import { AuthProvider, useAuth } from '@common/contexts/AuthContext';
import { SupabaseProvider } from '@common/contexts/SupabaseContext';
import { CacheInitializer } from '@common/components/CacheInitializer';
import App from '@web/App'; // Import App to render the full structure initially

// Mock hooks and components
// Import useTagsPage here to be used with vi.mocked later
import { useTagsPage } from '@common/hooks/ui/useTagsPage';
vi.mock('@common/hooks/ui/useTagsPage', () => ({
  useTagsPage: vi.fn(),
}));

vi.mock('@common/hooks/useEmailAlias', () => ({
  useEmailAlias: vi.fn(),
}));

vi.mock('@common/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@common/contexts/AuthContext')>();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

// Mock CacheInitializer as it might have its own data fetching
vi.mock('@common/components/CacheInitializer', () => ({
  CacheInitializer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>, // Replace motion.aside with a simple aside
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>, // Example for motion.div if needed elsewhere
      // Add other motion components if they cause issues
    },
  };
});

// Mock Supabase client (basic mock, might need expansion if Supabase is called directly)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user', email: 'test@example.com', app_metadata: {}, user_metadata: {} } }, error: null }),
      // Add other Supabase methods if needed by AuthProvider/SupabaseProvider
    },
    // Add other Supabase services if needed
  })),
}));


const mockTags: Tag[] = [
  { id: '1', name: 'Technology', newsletter_count: 10, user_id: 'user1', created_at: '2023-01-01', updated_at: '2023-01-01' },
  { id: '2', name: 'Science', newsletter_count: 5, user_id: 'user1', created_at: '2023-01-01', updated_at: '2023-01-01' },
  { id: '3', name: 'Health', newsletter_count: 0, user_id: 'user1', created_at: '2023-01-01', updated_at: '2023-01-01' }, // Tag with zero articles
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries for tests for faster failures
    },
  },
});

// This TestWrapper now includes AuthProvider and SupabaseProvider
// The TestWrapper now renders the full App component and navigates
const TestWrapper = ({ initialEntries = ['/tags'] }: { initialEntries?: string[] }) => (
  <QueryClientProvider client={queryClient}>
    <SupabaseProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </SupabaseProvider>
  </QueryClientProvider>
);


describe('TagsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Default mock for useAuth: authenticated user, not loading
    (useAuth as vi.Mock).mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com', app_metadata: {}, user_metadata: {} }, // Ensure user object matches expected structure
      session: { access_token: 'fake-token', user: { id: 'test-user' } }, // Mock session object
      loading: false,
      isAdmin: false,
      signOut: vi.fn().mockResolvedValue(null),
      refreshSession: vi.fn().mockResolvedValue(null), // Mock other methods if called
      // Add any other properties/methods expected from useAuth
    });

    // Mock useEmailAlias to return a non-loading state with a mock alias
    (vi.mocked(useEmailAlias) as vi.Mock).mockReturnValue({
      emailAlias: 'test-alias@example.com',
      loading: false,
      error: null,
      refreshEmailAlias: vi.fn(),
    });

    // Mock useLogger to prevent console noise or side effects during tests
    vi.mock('@common/utils/logger/useLogger', () => ({
      useLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        logNavigation: vi.fn(),
        logUserAction: vi.fn(),
      }),
      useLoggerStatic: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        logNavigation: vi.fn(),
        logUserAction: vi.fn(),
      }),
    }));

    // vi.mocked(useTagsPage) was here, it's not needed as useTagsPage is imported directly now
  });

  const mockUseTagsPageDefaults = {
    tagNewsletters: {},
    isCreating: false,
    newTag: { name: '', color: '#ffffff' },
    editingTagId: null,
    editTagData: {},
    setIsCreating: vi.fn(),
    setNewTag: vi.fn(),
    setEditingTagId: vi.fn(),
    setEditTagData: vi.fn(),
    handleCreateTag: vi.fn(),
    handleUpdateTag: vi.fn(),
    handleDeleteTag: vi.fn(),
  };

  it('should render loading state initially when useTagsPage is loading', async () => {
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: [],
      isLoading: true,
      error: null,
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    // The TagsPage renders <LoadingScreen /> which doesn't have "Loading tags..."
    // Instead, we can check for a known element within LoadingScreen or that no specific TagsPage content is present.
    // For now, let's assume LoadingScreen has a distinct role or text. If not, this test might need adjustment.
    // Or, more simply, check that the main content isn't there yet.
    await waitFor(() => {
      // Check for a generic loading indicator if LoadingScreen has one
      // For example, if LoadingScreen has a specific data-testid or role:
      // expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
      // Or check that tag content is NOT present:
      expect(screen.queryByRole('heading', { name: /Tags/i, level: 1 })).not.toBeInTheDocument();
    });
  });

  it('should render error message if fetching tags fails', async () => {
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: [],
      isLoading: false,
      error: new Error('Failed to fetch tags from hook'),
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading tags: Failed to fetch tags from hook/i)).toBeInTheDocument();
    });
  });

  it('should render "You haven\'t created any tags yet." when there are no tags', async () => {
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: [],
      isLoading: false,
      error: null,
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    await waitFor(() => {
      // Adjusted to match the actual text in TagsPage.tsx
      expect(screen.getByText(/You haven't created any tags yet./i)).toBeInTheDocument();
    });
  });

  it('should render the list of tags correctly', async () => {
    const currentMockTagNewsletters = {
      '1': [{id: 'nl1'} as any], // Technology has 1 newsletter
      '2': [],                   // Science has 0
      '3': [{id: 'nl2'}, {id: 'nl3'}] as any, // Health has 2 newsletters
    };
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: mockTags,
      tagNewsletters: currentMockTagNewsletters,
      isLoading: false,
      error: null,
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tags/i, level: 1 })).toBeInTheDocument();
      mockTags.forEach(tag => {
        expect(screen.getByText(tag.name)).toBeInTheDocument();
        // The TagsPage displays count from tagNewsletters length
        const count = (currentMockTagNewsletters[tag.id] || []).length; // Use the specific mock for this test
        const newsletterText = count === 1 ? 'newsletter' : 'newsletters';
        const listItem = screen.getByText(tag.name).closest('li');
        expect(listItem).toHaveTextContent(`Used in ${count} ${newsletterText}`);
      });
    });
  });

  it('should display newsletter count for each tag based on tagNewsletters', async () => {
    const specificMockTags = [
      { id: 'tech-id', name: 'Technology', newsletter_count: 10, user_id: 'user1', created_at: '2023-01-01', updated_at: '2023-01-01', color: '#ff0000' },
      { id: 'sci-id', name: 'Science', newsletter_count: 5, user_id: 'user1', created_at: '2023-01-01', updated_at: '2023-01-01', color: '#00ff00' },
    ];
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: specificMockTags,
      tagNewsletters: {
        'tech-id': [{} as any, {} as any], // 2 newsletters
        'sci-id': [{} as any],             // 1 newsletter
      },
      isLoading: false,
      error: null,
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    await waitFor(() => {
      const technologyTagItem = screen.getByText('Technology').closest('li');
      expect(technologyTagItem).toHaveTextContent('Used in 2 newsletters');

      const scienceTagItem = screen.getByText('Science').closest('li');
      expect(scienceTagItem).toHaveTextContent('Used in 1 newsletter');
    });
  });

  it('should render links for each tag that navigate to search', async () => {
    vi.mocked(useTagsPage).mockReturnValue({
      ...mockUseTagsPageDefaults,
      tags: mockTags,
      isLoading: false,
      error: null,
    });

    render(<TestWrapper initialEntries={['/tags']} />);

    await waitFor(() => {
      mockTags.forEach(tag => {
        // The clickable element is the tag name itself
        const tagLink = screen.getByText(tag.name);
        expect(tagLink).toBeInTheDocument();
        // Note: handleTagClickWithNavigation is called, not a direct href.
        // Testing the navigation itself would require more involved setup or spying on `navigate`.
        // For now, we confirm the element that triggers navigation is present.
      });
    });
  });
});
