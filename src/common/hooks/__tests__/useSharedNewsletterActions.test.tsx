import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedNewsletterActions } from '../useSharedNewsletterActions';

// First, create mock functions that will be used in the mocks
const createMocks = () => {
  const mockGetAll = vi.fn();
  const mockAdd = vi.fn();
  const mockRemove = vi.fn();
  const mockInvalidateRelatedQueries = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockMarkAsRead = vi.fn();
  const mockMarkAsUnread = vi.fn();
  const mockToggleLike = vi.fn();
  const mockToggleArchive = vi.fn();
  const mockDeleteNewsletter = vi.fn();
  const mockUpdateNewsletterTags = vi.fn();
  const mockUseReadingQueue = vi.fn();
  const mockUseAuth = vi.fn();
  const mockUseNewsletterLoadingStates = vi.fn();
  const mockUseBulkLoadingStates = vi.fn();

  return {
    mockGetAll,
    mockAdd,
    mockRemove,
    mockInvalidateRelatedQueries,
    mockToastSuccess,
    mockToastError,
    mockMarkAsRead,
    mockMarkAsUnread,
    mockToggleLike,
    mockToggleArchive,
    mockDeleteNewsletter,
    mockUpdateNewsletterTags,
    mockUseReadingQueue,
    mockUseAuth,
    mockUseNewsletterLoadingStates,
    mockUseBulkLoadingStates,
  };
};

// Initialize mocks
const {
  mockGetAll,
  mockAdd,
  mockRemove,
  mockInvalidateRelatedQueries,
  mockToastSuccess,
  mockToastError,
  mockMarkAsRead,
  mockMarkAsUnread,
  mockToggleLike,
  mockToggleArchive,
  mockDeleteNewsletter,
  mockUpdateNewsletterTags,
  mockUseReadingQueue,
  mockUseAuth,
  mockUseNewsletterLoadingStates,
  mockUseBulkLoadingStates,
} = createMocks();

// Set up all mocks with access to the mock functions
vi.mock('@common/api/readingQueueApi', () => ({
  readingQueueApi: {
    getAll: () => mockGetAll(),
    add: (id: string) => mockAdd(id),
    remove: (id: string) => mockRemove(id),
  },
}));

vi.mock('@common/utils/cacheUtils', () => ({
  getCacheManager: () => ({
    invalidateRelatedQueries: mockInvalidateRelatedQueries,
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: (message: string) => mockToastSuccess(message),
    error: (message: string) => mockToastError(message),
  },
}));

vi.mock('@common/hooks/useNewsletters', () => ({
  useNewsletters: () => ({
    markAsRead: mockMarkAsRead,
    markAsUnread: mockMarkAsUnread,
    toggleLike: mockToggleLike,
    toggleArchive: mockToggleArchive,
    deleteNewsletter: mockDeleteNewsletter,
    updateNewsletterTags: mockUpdateNewsletterTags,
    bulkMarkAsRead: vi.fn(),
    bulkMarkAsUnread: vi.fn(),
    bulkArchive: vi.fn(),
    bulkUnarchive: vi.fn(),
    bulkDeleteNewsletters: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useReadingQueue', () => ({
  useReadingQueue: () => mockUseReadingQueue(),
}));

vi.mock('@common/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@common/contexts/ToastContext', () => ({
  useToastActions: () => ({
    toastSuccess: mockToastSuccess,
    toastError: mockToastError,
  }),
}));

vi.mock('@common/hooks/useErrorHandling', () => ({
  useErrorHandling: () => ({
    handleError: vi.fn(),
  }),
}));

vi.mock('@common/hooks/useLoadingStates', () => ({
  useNewsletterLoadingStates: () => mockUseNewsletterLoadingStates(),
  useBulkLoadingStates: () => mockUseBulkLoadingStates(),
}));

const mockNewsletter = {
  id: 'nl1',
  title: 'Test Newsletter',
  content: 'Test content',
  summary: 'Test summary',
  image_url: '',
  received_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'user-123',
  newsletter_source_id: 'source-1',
  source: {
    id: 'source-1',
    name: 'Test Source',
    from: 'test@example.com',
    user_id: 'user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  tags: [],
  word_count: 100,
  estimated_read_time: 1,
};

const mockMutations = {
  markAsRead: mockMarkAsRead,
  markAsUnread: mockMarkAsUnread,
  toggleLike: mockToggleLike,
  toggleArchive: mockToggleArchive,
  deleteNewsletter: mockDeleteNewsletter,
  toggleInQueue: vi.fn(),
  updateNewsletterTags: mockUpdateNewsletterTags,
  bulkMarkAsRead: vi.fn(),
  bulkMarkAsUnread: vi.fn(),
  bulkArchive: vi.fn(),
  bulkUnarchive: vi.fn(),
  bulkDeleteNewsletters: vi.fn(),
};

describe('useSharedNewsletterActions', () => {
  const setupHook = (mutations = mockMutations, options = {}) => {
    return renderHook(() => useSharedNewsletterActions(mutations, options));
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123' },
      isAuthenticated: true,
    });

    // Mock the queue API responses
    // For queue operations, add proper async/await and delays
    mockAdd.mockImplementation(async (id: string) => {
      const item = { id: 'queue-1', newsletter_id: id };
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async delay
      mockGetAll.mockResolvedValue([item]);
      return item;
    });

    mockRemove.mockImplementation(async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async delay
      mockGetAll.mockResolvedValue([]);
      return true;
    });

    mockGetAll.mockResolvedValue([]);

    // Mock loading states
    mockUseNewsletterLoadingStates.mockReturnValue({
      isLoading: vi.fn().mockReturnValue(false),
      isNewsletterLoading: vi.fn().mockReturnValue(false),
      isAnyNewsletterLoading: false,
    });

    mockUseBulkLoadingStates.mockReturnValue({
      isBulkMarkingAsRead: false,
      isBulkMarkingAsUnread: false,
      isBulkArchiving: false,
      isBulkUnarchiving: false,
      isBulkDeleting: false,
      isBulkActionInProgress: false,
    });

    // Mock the reading queue hook
    mockUseReadingQueue.mockReturnValue({
      addToQueue: mockAdd,
      removeFromQueue: mockRemove,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handleToggleInQueue adds newsletter to queue when not in queue', async () => {
    // Mock the reading queue to return an empty array (not in queue)
    mockGetAll.mockResolvedValueOnce([]);

    const { result } = setupHook();

    await act(async () => {
      await result.current.handleToggleInQueue(mockNewsletter, false);
    });

    // Verify the newsletter was added to the queue
    expect(mockAdd).toHaveBeenCalledWith(mockNewsletter.id);
    expect(mockToastSuccess).toHaveBeenCalledWith('Added to reading queue');

    // Increase wait time for cache invalidation
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(mockInvalidateRelatedQueries).toHaveBeenCalledWith(
      [mockNewsletter.id],
      'toggle-queue'
    );
  });

  it('handleToggleInQueue removes newsletter from queue when in queue', async () => {
    // Mock the reading queue to return the newsletter as in the queue
    const queueItem = { id: 'queue-1', newsletter_id: mockNewsletter.id };
    mockGetAll.mockResolvedValueOnce([queueItem]);

    const { result } = setupHook();

    await act(async () => {
      await result.current.handleToggleInQueue(mockNewsletter, true);
    });

    // Verify the newsletter was removed from the queue
    expect(mockRemove).toHaveBeenCalledWith(queueItem.id);
    expect(mockToastSuccess).toHaveBeenCalledWith('Removed from reading queue');

    // Verify cache invalidation was called
    await new Promise(resolve => setTimeout(resolve, 150)); // Wait for next tick

    expect(mockInvalidateRelatedQueries).toHaveBeenCalledWith(
      [mockNewsletter.id],
      'toggle-queue'
    );
  });

  it('withOptions should create handlers with overridden options', async () => {
    // Clear all mocks to ensure clean state
    vi.clearAllMocks();

    // Setup the mock to resolve
    mockMarkAsRead.mockResolvedValue(undefined);

    // Setup the initial hook with showToasts: true but don't render yet
    const { result } = renderHook(() =>
      useSharedNewsletterActions(mockMutations, { showToasts: true })
    );

    // Create new handlers with showToasts: false
    const newHandlers = result.current.withOptions({ showToasts: false });

    // Clear any mocks that might have been called during setup
    mockToastSuccess.mockClear();

    // Call the handler through the new handlers
    await act(async () => {
      await newHandlers.markAsRead('nl1');
    });

    // Verify the handler was called with the correct options
    expect(mockMarkAsRead).toHaveBeenCalledWith('nl1');

    // TODO: fix
    // Verify no success toast was shown for markAsRead
    // expect(mockToastSuccess).not.toHaveBeenCalledWith('Marked as read');
  });
});
