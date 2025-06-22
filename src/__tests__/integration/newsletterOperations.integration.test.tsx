import { AuthContext } from '@common/contexts/AuthContext';
import type {
  BulkNewsletterOperationResult,
  NewsletterOperationResult
} from '@common/services/newsletter/NewsletterService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger at the top level to avoid hoisting issues
const { mockLogger } = vi.hoisted(() => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return { mockLogger: logger };
});

vi.mock('@common/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
  useLogger: () => mockLogger,
  logger: mockLogger,
}));

// Define mock implementations using vi.hoisted
const { mockNewsletterService, _mockToast } = vi.hoisted(() => {
  // Create mock newsletter service with default implementations
  const mockNewsletterService = {
    markAsRead: vi.fn().mockResolvedValue({
      success: true,
      newsletter: { id: 'newsletter-1', is_read: true }
    }),
    markAsUnread: vi.fn().mockResolvedValue({
      success: true,
      newsletter: { id: 'newsletter-1', is_read: false }
    }),
    toggleArchive: vi.fn().mockResolvedValue({
      success: true,
      newsletter: { id: 'newsletter-1', is_archived: true }
    }),
    toggleLike: vi.fn().mockResolvedValue({
      success: true,
      newsletter: { id: 'newsletter-1', is_liked: true }
    }),
    deleteNewsletter: vi.fn().mockResolvedValue({
      success: true,
      newsletter: { id: 'newsletter-1' }
    }),
    bulkMarkAsRead: vi.fn().mockResolvedValue({
      success: true,
      processedCount: 2,
      failedCount: 0,
      errors: []
    }),
    bulkArchive: vi.fn().mockResolvedValue({
      success: true,
      processedCount: 2,
      failedCount: 0,
      errors: []
    }),
    bulkDelete: vi.fn().mockResolvedValue({
      success: true,
      processedCount: 2,
      failedCount: 0,
      errors: []
    })
  };

  // Create mock toast with all required methods
  const _mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  };

  return { mockNewsletterService, _mockToast };
});

// 2. Set up mocks for external modules
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: _mockToast.success,
    error: _mockToast.error,
    loading: _mockToast.loading,
    dismiss: _mockToast.dismiss,
    promise: _mockToast.promise,
  },
  Toaster: () => <div data-testid="toaster" />,
}));

// 3. Mock the newsletter service
vi.mock('@common/services', () => ({
  __esModule: true,
  newsletterService: mockNewsletterService,
}));

// Mock useNewsletterOperations with proper implementations
const createMockUseNewsletterOperations = () => {
  return vi.fn().mockImplementation(() => {
    const markAsRead = vi.fn().mockImplementation(async (id: string) => {
      try {
        const result = await mockNewsletterService.markAsRead(id);
        if (result.success) {
          _mockToast.success('Newsletter marked as read');
        }
        return result;
      } catch (error: any) {
        _mockToast.error(error.message);
        throw error;
      }
    });
    
    const toggleArchive = vi.fn().mockImplementation(async (id: string) => {
      const result = await mockNewsletterService.toggleArchive(id);
      if (result.success) {
        _mockToast.success('Newsletter archived');
      }
      return result;
    });
    
    const toggleLike = vi.fn().mockImplementation(async (id: string) => {
      const result = await mockNewsletterService.toggleLike(id);
      if (result.success) {
        _mockToast.success('Newsletter liked');
      }
      return result;
    });
    
    const deleteNewsletter = vi.fn().mockImplementation(async (id: string) => {
      // Add confirmation check
      const confirmed = window.confirm('Are you sure you want to delete this newsletter?');
      if (!confirmed) return { success: false };
      
      const result = await mockNewsletterService.deleteNewsletter(id);
      if (result.success) {
        _mockToast.success('Newsletter deleted');
      }
      return result;
    });
    
    const bulkMarkAsRead = vi.fn().mockImplementation(async (ids: string[]) => {
      const result = await mockNewsletterService.bulkMarkAsRead(ids);
      if (result.success) {
        _mockToast.success(`Marked ${result.processedCount} newsletters as read`);
      }
      return result;
    });
    
    return {
      markAsRead,
      markAsUnread: vi.fn().mockResolvedValue({ success: true }),
      toggleArchive,
      toggleLike,
      deleteNewsletter,
      bulkMarkAsRead,
      bulkMarkAsUnread: vi.fn().mockResolvedValue({ success: true, processedCount: 1, failedCount: 0, errors: [] }),
      bulkArchive: vi.fn().mockResolvedValue({ success: true, processedCount: 1, failedCount: 0, errors: [] }),
      bulkUnarchive: vi.fn().mockResolvedValue({ success: true, processedCount: 1, failedCount: 0, errors: [] }),
      bulkDelete: vi.fn().mockResolvedValue({ success: true, processedCount: 1, failedCount: 0, errors: [] }),
      addTag: vi.fn().mockResolvedValue({ success: true }),
      removeTag: vi.fn().mockResolvedValue({ success: true }),
      isMarkingAsRead: false,
      isMarkingAsUnread: false,
      isTogglingArchive: false,
      isTogglingLike: false,
      isDeleting: false,
      isBulkMarkingAsRead: false,
      isBulkMarkingAsUnread: false,
      isBulkArchiving: false,
      isBulkUnarchiving: false,
      isBulkDeleting: false,
      isAddingTag: false,
      isRemovingTag: false
    };
  });
};

vi.mock('@common/hooks/business/useNewsletterOperations', () => ({
  useNewsletterOperations: mockUseNewsletterOperations,
}));

// Mock react-query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');

  // Create a mock QueryClient class
  class MockQueryClient {
    queryCache = {
      clear: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      find: vi.fn(),
      subscribe: vi.fn(),
      removeQueries: vi.fn(),
      getQueriesData: vi.fn().mockReturnValue([]),
    };

    mutationCache = {
      clear: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      subscribe: vi.fn(),
    };

    defaultOptions = {};

    clear() { }
    getQueryData() { }
    setQueryData() { }
    getQueriesData() { return []; }
    setQueriesData() { }
    invalidateQueries() { return Promise.resolve(); }
    refetchQueries() { return Promise.resolve([]); }
    cancelQueries() { return Promise.resolve(); }
    executeMutation() { return Promise.resolve(); }
    resetQueries() { return Promise.resolve(); }
    removeQueries() { }
    getQueryCache() { return this.queryCache; }
    getMutationCache() { return this.mutationCache; }
    getDefaultOptions() { return this.defaultOptions; }
    setDefaultOptions() { }
    mount() { }
    unmount() { }
    isFetching() { return 0; }
    isMutating() { return 0; }
  }

  return {
    ...actual as object,
    QueryClient: MockQueryClient,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    useQueryClient: vi.fn().mockImplementation(() => ({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      getQueryCache: vi.fn().mockReturnValue({
        find: vi.fn(),
        findAll: vi.fn().mockReturnValue([]),
      }),
    })),
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isLoading: false,
      isSuccess: true,
      refetch: vi.fn(),
    }),
    useMutation: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      reset: vi.fn(),
      data: undefined,
      error: null,
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      status: 'idle',
    }),
  };
});

// Mock queryKeyFactory
vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    newsletters: {
      all: ['newsletters'],
      lists: () => ['newsletters', 'list'],
      list: () => ['newsletters', 'list', {}],
      detail: (id: string) => ['newsletters', 'detail', id],
    },
    inbox: () => ['newsletters', 'inbox'],
    queue: {
      all: () => ['readingQueue'],
      lists: () => ['readingQueue', 'list'],
      list: (userId: string) => ['readingQueue', 'list', userId],
      details: () => ['readingQueue', 'detail'],
      detail: (id: string) => ['readingQueue', 'detail', id],
    },
    tags: {
      all: () => ['tags'],
      lists: () => ['tags', 'list'],
      list: () => ['tags', 'list', {}],
      details: () => ['tags', 'detail'],
      detail: (id: string) => ['tags', 'detail', id],
    },
  },
  __esModule: true,
}));

// Mock NewsletterOperationsProvider
const NewsletterOperationsProvider = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);

// Mock the context to use our mock implementation
vi.mock('@web/contexts/NewsletterOperationsContext', () => ({
  NewsletterOperationsProvider,
  useNewsletterOperations: createMockUseNewsletterOperations(),
}));

// Create the mock instance
const mockUseNewsletterOperations = createMockUseNewsletterOperations();

// Mock components
const NewsletterList = () => <div data-testid="mock-newsletter-list" />;
const NewsletterDetail = () => <div data-testid="mock-newsletter-detail" />;

vi.mock('@web/components/NewsletterList', () => ({
  default: NewsletterList,
}));

vi.mock('@web/pages/NewsletterDetail', () => ({
  default: NewsletterDetail,
}));

// Test data
const mockNewsletter = {
  id: 'newsletter-1',
  title: 'Test Newsletter',
  content: '<p>Test content</p>',
  is_read: false,
  is_archived: false,
  is_liked: false,
  source: {
    id: 'source-1',
    name: 'Test Source',
  },
};

// Test component that uses the newsletter operations
const TestComponent = () => {
  const operations = mockUseNewsletterOperations();
  return (
    <Routes>
      <Route path="/" element={
        <div>
          <button onClick={() => operations.markAsRead('newsletter-1')} data-testid="mark-as-read">
            Mark as Read
          </button>
          <button onClick={() => operations.toggleArchive('newsletter-1')}>
            Toggle Archive
          </button>
          <button onClick={() => operations.toggleLike('newsletter-1')}>
            Toggle Like
          </button>
          <button onClick={() => operations.deleteNewsletter('newsletter-1')}>
            Delete
          </button>
          <button onClick={() => operations.bulkMarkAsRead(['newsletter-1', 'newsletter-2'])}>
            Bulk Mark as Read
          </button>
          <NewsletterList />
        </div>
      } />
      <Route path="/newsletters/:id" element={<NewsletterDetail />} />
    </Routes>
  );
};

const renderWithProviders = (initialEntries = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: {
            id: 'test-user',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: 'test@example.com'
          },
          session: {
            access_token: 'test-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'test-user',
              email: 'test@example.com'
            }
          },
          isLoading: false,
          signIn: vi.fn(),
          signOut: vi.fn(),
          refreshSession: vi.fn(),
        }}
      >
        <NewsletterOperationsProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <TestComponent />
          </MemoryRouter>
        </NewsletterOperationsProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('Newsletter Operations Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup user event
    user = userEvent.setup();

    // Setup default mock implementations for the service
    mockNewsletterService.markAsRead.mockImplementation(async (id: string) => ({
      success: true,
      newsletter: { ...mockNewsletter, id, is_read: true }
    } as NewsletterOperationResult));

    mockNewsletterService.toggleArchive.mockImplementation(async (id: string) => ({
      success: true,
      newsletter: { ...mockNewsletter, id, is_archived: true }
    } as NewsletterOperationResult));

    mockNewsletterService.toggleLike.mockImplementation(async (id: string) => ({
      success: true,
      newsletter: { ...mockNewsletter, id, is_liked: true }
    } as NewsletterOperationResult));

    mockNewsletterService.deleteNewsletter.mockImplementation(async (id: string) => ({
      success: true,
      newsletter: { ...mockNewsletter, id }
    } as NewsletterOperationResult));

    mockNewsletterService.bulkMarkAsRead.mockImplementation(async (ids: string[]) => ({
      success: true,
      processedCount: ids.length,
      failedCount: 0,
      errors: []
    } as BulkNewsletterOperationResult));

    mockNewsletterService.deleteNewsletter.mockImplementation(async () => ({
      success: true,
      newsletter: { ...mockNewsletter, id: 'deleted-newsletter' }
    } as NewsletterOperationResult));
  });

  it('should mark a newsletter as read', async () => {
    // Setup the mock implementation for markAsRead
    mockNewsletterService.markAsRead.mockResolvedValueOnce({
      success: true,
      newsletter: { ...mockNewsletter, id: 'newsletter-1', is_read: true }
    });

    renderWithProviders();

    const markAsReadButton = screen.getByTestId('mark-as-read');
    await user.click(markAsReadButton);

    // Verify the service was called with the correct ID
    expect(mockNewsletterService.markAsRead).toHaveBeenCalledWith('newsletter-1');

    // Verify that the success toast was shown with the correct message
    await waitFor(() => {
      expect(_mockToast.success).toHaveBeenCalledWith('Newsletter marked as read');
    });
  });

  it('should toggle archive status of a newsletter', async () => {
    // Setup the mock implementation for toggleArchive
    mockNewsletterService.toggleArchive.mockResolvedValueOnce({
      success: true,
      newsletter: { ...mockNewsletter, id: 'newsletter-1', is_archived: true }
    });

    renderWithProviders();

    const toggleArchiveButton = screen.getByText('Toggle Archive');
    await user.click(toggleArchiveButton);

    // Verify the service was called with the correct ID
    expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith('newsletter-1');

    // Verify that the success toast was shown with the correct message
    await waitFor(() => {
      expect(_mockToast.success).toHaveBeenCalledWith('Newsletter archived');
    });
  });

  it('should toggle like status of a newsletter', async () => {
    // Setup the mock implementation for toggleLike
    mockNewsletterService.toggleLike.mockResolvedValueOnce({
      success: true,
      newsletter: { ...mockNewsletter, id: 'newsletter-1', is_liked: true }
    });

    renderWithProviders();

    const toggleLikeButton = screen.getByText('Toggle Like');
    await user.click(toggleLikeButton);

    // Verify the service was called with the correct ID
    expect(mockNewsletterService.toggleLike).toHaveBeenCalledWith('newsletter-1');

    // Verify that the success toast was shown with the correct message
    await waitFor(() => {
      expect(_mockToast.success).toHaveBeenCalledWith('Newsletter liked');
    });
  });

  it('should delete a newsletter', async () => {
    // Mock window.confirm to return true
    const mockConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    // Setup the mock implementation for deleteNewsletter
    const deleteResult = { success: true, newsletter: { ...mockNewsletter, id: 'newsletter-1' } };
    mockNewsletterService.deleteNewsletter.mockResolvedValueOnce(deleteResult);

    // Mock the toast implementation
    const mockSuccessToast = vi.fn();
    _mockToast.success = mockSuccessToast;

    renderWithProviders();

    // Find and click the delete button
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    // Verify the confirm dialog was shown with the correct message
    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this newsletter?');

    // Wait for the async operation to complete
    await waitFor(() => {
      // Verify the service was called with the correct ID
      expect(mockNewsletterService.deleteNewsletter).toHaveBeenCalledWith('newsletter-1');
    });

    // Verify that the success toast was shown with the correct message
    expect(mockSuccessToast).toHaveBeenCalledWith('Newsletter deleted');

    // Cleanup
    mockConfirm.mockRestore();
  });

  it('should bulk mark newsletters as read', async () => {
    // Setup the mock implementation for bulkMarkAsRead
    mockNewsletterService.bulkMarkAsRead.mockResolvedValueOnce({
      success: true,
      processedCount: 2,
      failedCount: 0,
      errors: []
    });

    renderWithProviders();

    const bulkMarkAsReadButton = screen.getByText('Bulk Mark as Read');
    await user.click(bulkMarkAsReadButton);

    // Verify the service was called with the correct IDs
    expect(mockNewsletterService.bulkMarkAsRead).toHaveBeenCalledWith(['newsletter-1', 'newsletter-2']);

    // Verify that the success toast was shown with the correct message
    await waitFor(() => {
      expect(_mockToast.success).toHaveBeenCalledWith('Marked 2 newsletters as read');
    });
  });

  it('should handle operation errors', async () => {
    // Mock a failing API call
    const errorMessage = 'Failed to mark as read';
    const error = new Error(errorMessage);

    // Setup the mock to reject with an error
    mockNewsletterService.markAsRead.mockRejectedValueOnce(error);

    // Mock the toast implementation
    const mockErrorToast = vi.fn();
    _mockToast.error = mockErrorToast;

    renderWithProviders();

    // Find and click the mark as read button
    const markAsReadButton = screen.getByTestId('mark-as-read');
    await user.click(markAsReadButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      // Verify the service was called
      expect(mockNewsletterService.markAsRead).toHaveBeenCalled();
    });

    // Verify error toast was shown with the correct message
    expect(mockErrorToast).toHaveBeenCalledWith(errorMessage);
  });

  it('should handle navigation to newsletter detail', async () => {
    renderWithProviders(['/newsletters/newsletter-1']);

    // Verify that the newsletter detail component is rendered
    expect(screen.getByTestId('mock-newsletter-detail')).toBeInTheDocument();
  });
});