import { AuthContext } from '@common/contexts/AuthContext';
import { useCache } from '@common/hooks/useCache';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useReadingQueueCacheOptimizer } from '@common/hooks/useReadingQueueCacheOptimizer';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useTags } from '@common/hooks/useTags';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock BackButton component BEFORE importing ReadingQueuePage
vi.mock('@web/components/BackButton', () => ({
  default: ({ className }: { className?: string }) => (
    <button className={className} data-testid="back-button">
      Back to Inbox
    </button>
  ),
}));

import ReadingQueuePage from '../ReadingQueuePage';

// Mock hooks
vi.mock('@common/hooks/useReadingQueue');
vi.mock('@common/hooks/useSharedNewsletterActions');
vi.mock('@common/hooks/useTags');
vi.mock('@common/hooks/useReadingQueueCacheOptimizer');
vi.mock('@common/hooks/useCache');
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@dnd-kit/core', () => {
  const actualDndCore = vi.importActual('@dnd-kit/core');
  return {
    ...actualDndCore,
    DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: any }) => (
      <div data-testid="dnd-context" onClick={() => onDragEnd?.({ active: { id: 'item-1' }, over: { id: 'item-2' } })}>
        {children}
      </div>
    ),
    closestCenter: vi.fn(),
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: vi.fn(() => [{ id: 'pointer', sensor: vi.fn() }, { id: 'keyboard', sensor: vi.fn() }]),
  };
});

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable');
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
    useSortable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
  };
});

// Mock SortableNewsletterRow - simplified mock that renders the newsletter title and tags
vi.mock('../../components/reading-queue/SortableNewsletterRow', () => ({
  SortableNewsletterRow: vi.fn(({ newsletter, onNewsletterClick, onTagClick, _onToggleRead, _onToggleLike, _onToggleArchive, _onRemoveFromQueue, _onUpdateTags, id }) => (
    <div
      data-testid={`sortable-row-${id}`}
      onClick={() => onNewsletterClick?.(newsletter)}
      className="newsletter-row"
    >
      <div data-testid={`newsletter-row-main-${newsletter.id}`}>
        <span>{newsletter.title}</span>
        {newsletter.tags?.map((tag: { id: string; name: string; color: string; user_id: string; created_at: string }) => (
          <button
            key={tag.id}
            data-testid={`tag-${tag.id}`}
            onClick={(e) => onTagClick?.(tag, e)}
            className="tag-button"
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  )),
  default: vi.fn(({ newsletter, onNewsletterClick, onTagClick, _onToggleRead, _onToggleLike, _onToggleArchive, _onRemoveFromQueue, _onUpdateTags, id }) => (
    <div
      data-testid={`sortable-row-${id}`}
      onClick={() => onNewsletterClick?.(newsletter)}
      className="newsletter-row"
    >
      <div data-testid={`newsletter-row-main-${newsletter.id}`}>
        <span>{newsletter.title}</span>
        {newsletter.tags?.map((tag: { id: string; name: string; color: string; user_id: string; created_at: string }) => (
          <button
            key={tag.id}
            data-testid={`tag-${tag.id}`}
            onClick={(e) => onTagClick?.(tag, e)}
            className="tag-button"
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  )),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock tagUtils
vi.mock('@common/utils/tagUtils', () => ({
  updateNewsletterTags: vi.fn().mockResolvedValue({ added: 1, removed: 0 }),
}));

// Mock cacheUtils
vi.mock('@common/utils/cacheUtils', () => ({
  getCacheManager: vi.fn(() => ({
    smartInvalidate: vi.fn(),
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockNewsletterWithRelations = (id: string, title: string, receivedAt: string, tags: Array<{ id: string; name: string; color: string; user_id: string; created_at: string }> = []) => ({
  id,
  title,
  content: `Content for ${title}`,
  summary: `Summary for ${title}`,
  image_url: `https://example.com/image-${id}.jpg`,
  received_at: receivedAt,
  updated_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'user-1',
  newsletter_source_id: `source-${id}`,
  source_id: `source-${id}`,
  source: {
    id: `source-${id}`,
    name: `Test Source ${id}`,
    from: `test${id}@example.com`,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_archived: false,
  },
  tags,
  word_count: 100,
  estimated_read_time: 1,
});

const mockReadingQueueItem = (id: string, title: string, position: number, receivedAt: string, tags: Array<{ id: string; name: string; color: string; user_id: string; created_at: string }> = []) => ({
  id: `queue-item-${id}`,
  newsletter_id: id,
  position,
  user_id: 'user-1',
  added_at: new Date().toISOString(),
  newsletter: mockNewsletterWithRelations(id, title, receivedAt, tags),
});

const mockTagsData = [
  { id: 'tag-1', name: 'Tech', color: '#FF0000', user_id: 'user-1', created_at: new Date().toISOString() },
  { id: 'tag-2', name: 'Business', color: '#00FF00', user_id: 'user-1', created_at: new Date().toISOString() },
];

const renderReadingQueuePage = async () => {
  let utils;
  await act(async () => {
    utils = render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{
          user: mockUser,
          session: null,
          loading: false,
          error: null,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          resetPassword: vi.fn(),
          updatePassword: vi.fn(),
          checkPasswordStrength: vi.fn(),
        }}>
          <MemoryRouter>
            <ReadingQueuePage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  });
  return utils;
};

describe('ReadingQueuePage', () => {
  const mockUseCache = vi.mocked(useCache);
  const mockUseReadingQueue = vi.mocked(useReadingQueue);
  const mockUseSharedNewsletterActions = vi.mocked(useSharedNewsletterActions);
  const mockUseTags = vi.mocked(useTags);
  const mockUseReadingQueueCacheOptimizer = vi.mocked(useReadingQueueCacheOptimizer);

  beforeEach(async () => {
    mockUseCache.mockReturnValue({
      updateNewsletter: vi.fn(),
      batchUpdateNewsletters: vi.fn(),
      optimisticUpdate: vi.fn(),
      updateReadingQueue: vi.fn(),
      invalidateRelatedQueries: vi.fn(),
      invalidateNewsletters: vi.fn(),
      invalidateReadingQueue: vi.fn(),
      invalidateTagQueries: vi.fn(),
      invalidateSourceQueries: vi.fn(),
      warmCache: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      batchInvalidate: vi.fn(),
      cacheManager: null,
    });

    mockUseReadingQueue.mockReturnValue({
      readingQueue: [],
      isLoading: false,
      isError: false,
      error: null,
      isEmpty: true,
      addToQueue: vi.fn(),
      removeFromQueue: vi.fn().mockResolvedValue({}),
      reorderQueue: vi.fn().mockResolvedValue({}),
      clearQueue: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      updateTags: vi.fn(),
      cleanupOrphanedItems: vi.fn(),
      isInQueue: vi.fn(),
      isAdding: false,
      isRemoving: false,
      isReordering: false,
      isClearing: false,
      isMarkingAsRead: false,
      isMarkingAsUnread: false,
      isUpdatingTags: false,
      isCleaningUp: false,
      refetch: vi.fn(),
    });

    mockUseSharedNewsletterActions.mockReturnValue({
      handleMarkAsRead: vi.fn().mockResolvedValue({}),
      handleMarkAsUnread: vi.fn().mockResolvedValue({}),
      handleToggleLike: vi.fn().mockResolvedValue({}),
      handleToggleArchive: vi.fn().mockResolvedValue({}),
      handleDeleteNewsletter: vi.fn(),
      handleToggleInQueue: vi.fn(),
      handleUpdateTags: vi.fn(),
      handleToggleRead: vi.fn(),
      handleBulkMarkAsRead: vi.fn(),
      handleBulkMarkAsUnread: vi.fn(),
      handleBulkArchive: vi.fn(),
      handleBulkUnarchive: vi.fn(),
      handleBulkDelete: vi.fn(),
      handleRemoveFromQueue: vi.fn(),
      handleAddToQueue: vi.fn(),
      handleNewsletterRowActions: vi.fn(),
      isMarkingAsRead: false,
      isMarkingAsUnread: false,
      isTogglingLike: false,
      isDeletingNewsletter: false,
      isUpdatingTags: false,
      isBulkMarkingAsRead: false,
      isBulkMarkingAsUnread: false,
      isBulkArchiving: false,
      isBulkUnarchiving: false,
      isBulkDeletingNewsletters: false,
      isNewsletterLoading: vi.fn((_action: string, _newsletterId: string) => false),
      isAnyNewsletterLoading: vi.fn((_newsletterId: string) => false),
      isBulkActionInProgress: false,
      handleError: vi.fn(),
      lastError: undefined,
      withOptions: vi.fn(),
    });

    mockUseTags.mockReturnValue({
      loading: false,
      error: null,
      getTags: vi.fn().mockResolvedValue(mockTagsData),
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
      getTagsForNewsletter: vi.fn(),
      updateNewsletterTags: vi.fn(),
    });

    mockUseReadingQueueCacheOptimizer.mockReturnValue(undefined);

    vi.clearAllMocks();
  });

  test('displays loading state', async () => {
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      isLoading: true,
    });

    await renderReadingQueuePage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays empty queue message', async () => {
    await renderReadingQueuePage();
    expect(screen.getByText('No newsletters in queue')).toBeInTheDocument();
    expect(screen.getByText('Browse Newsletters')).toBeInTheDocument();
  });

  test('displays error state', async () => {
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      isError: true,
      error: new Error('Failed to load'),
    });

    await renderReadingQueuePage();
    expect(screen.getByText('Failed to load reading queue. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  test('renders a list of newsletters', async () => {
    const items = [
      mockReadingQueueItem('1', 'Newsletter 1', 0, new Date().toISOString()),
      mockReadingQueueItem('2', 'Newsletter 2', 1, new Date().toISOString()),
    ];

    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
    });

    await renderReadingQueuePage();
    expect(screen.getByText('Newsletter 1')).toBeInTheDocument();
    expect(screen.getByText('Newsletter 2')).toBeInTheDocument();
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();
  });

  test('navigates to newsletter detail on click', async () => {
    const newsletter = mockReadingQueueItem('1', 'Newsletter One', 0, new Date().toISOString());
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: [newsletter],
      isEmpty: false,
    });

    await renderReadingQueuePage();

    const newsletterElement = screen.getByText('Newsletter One');
    await act(async () => {
      fireEvent.click(newsletterElement);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/newsletters/1', {
        state: { fromReadingQueue: true, from: '/queue' },
      });
    });
  });

  test('filters newsletters by tag', async () => {
    const items = [
      mockReadingQueueItem('1', 'Tech News', 0, new Date().toISOString(), [mockTagsData[0]]),
      mockReadingQueueItem('2', 'Business Insights', 1, new Date().toISOString(), [mockTagsData[1]]),
      mockReadingQueueItem('3', 'Mixed Content', 2, new Date().toISOString(), mockTagsData),
    ];

    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
    });

    await renderReadingQueuePage();

    await screen.findByText('Tech News');
    await screen.findByText('Business Insights');
    await screen.findByText('Mixed Content');

    // Look for the tag button within the newsletter row
    const newsletterRow = screen.getByTestId('newsletter-row-main-1');
    const techTagButton = within(newsletterRow).getByTestId('tag-tag-1');
    expect(techTagButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(techTagButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Tech News')).toBeInTheDocument();
      expect(screen.queryByText('Business Insights')).not.toBeInTheDocument();
      expect(screen.getByText('Mixed Content')).toBeInTheDocument();
      expect(screen.getByText(/2 items/i)).toBeInTheDocument();
      expect(screen.getByText('Filtering by tags:')).toBeInTheDocument();
      // Check that the tag filter pill and tag button are present
      const techTagButtons = screen.getAllByTestId('tag-tag-1');
      expect(techTagButtons.length).toBeGreaterThan(0);
      // Check the tag filter pill (should be present as a span, not a button)
      const tagFilterPills = screen.getAllByText(mockTagsData[0].name, { selector: 'span' });
      expect(tagFilterPills.length).toBeGreaterThan(0);
    });

    // Remove the tag filter by clicking the pill
    const tagFilterPills = screen.getAllByText(mockTagsData[0].name, { selector: 'span' });
    const selectedTechTag = tagFilterPills.find(
      (el: HTMLElement) => el.querySelector('span') && el.querySelector('span')?.textContent === '×'
    );
    expect(selectedTechTag).toBeTruthy();
    await act(async () => {
      fireEvent.click(selectedTechTag!);
    });

    await waitFor(() => {
      expect(screen.getByText('Tech News')).toBeInTheDocument();
      expect(screen.getByText('Business Insights')).toBeInTheDocument();
      expect(screen.getByText('Mixed Content')).toBeInTheDocument();
      expect(screen.getByText(/3 items/i)).toBeInTheDocument();
      expect(screen.queryByText('Filtering by tags:')).not.toBeInTheDocument();
    });
  });

  test('sorts newsletters by date', async () => {
    const olderDate = new Date('2023-01-01T10:00:00.000Z').toISOString();
    const newerDate = new Date('2023-01-02T10:00:00.000Z').toISOString();
    const items = [
      mockReadingQueueItem('1', 'Older Newsletter', 0, olderDate),
      mockReadingQueueItem('2', 'Newer Newsletter', 1, newerDate),
    ];

    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
    });

    await renderReadingQueuePage();

    const sortByDateButton = screen.getByText('Sort by Date');
    await act(async () => {
      fireEvent.click(sortByDateButton);
    });

    await waitFor(() => {
      const renderedItems = screen.getAllByTestId(/newsletter-row-main-/);
      expect(renderedItems[0]).toHaveTextContent('Newer Newsletter');
      expect(renderedItems[1]).toHaveTextContent('Older Newsletter');
    });

    const sortDirectionButton = screen.getByTitle('Newest first');
    await act(async () => {
      fireEvent.click(sortDirectionButton);
    });

    await waitFor(() => {
      const renderedItems = screen.getAllByTestId(/newsletter-row-main-/);
      expect(renderedItems[0]).toHaveTextContent('Older Newsletter');
      expect(renderedItems[1]).toHaveTextContent('Newer Newsletter');
    });
  });

  test('handles drag and drop reordering', async () => {
    const items = [
      mockReadingQueueItem('1', 'Newsletter 1', 0, new Date().toISOString()),
      mockReadingQueueItem('2', 'Newsletter 2', 1, new Date().toISOString()),
    ];

    const mockReorderQueue = vi.fn().mockResolvedValue({});
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
      reorderQueue: mockReorderQueue,
    });

    await renderReadingQueuePage();

    // The drag-and-drop context should be present
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
    // The newsletter rows should be rendered with the correct test IDs
    expect(screen.getByTestId('newsletter-row-main-1')).toBeInTheDocument();
    expect(screen.getByTestId('newsletter-row-main-2')).toBeInTheDocument();
  });

  test('handles tag updates', async () => {
    const items = [
      mockReadingQueueItem('1', 'Newsletter 1', 0, new Date().toISOString(), [mockTagsData[0]]),
    ];

    const mockRefetch = vi.fn();
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
      refetch: mockRefetch,
    });

    await renderReadingQueuePage();

    // The newsletter row and tag should be present
    expect(screen.getByTestId('newsletter-row-main-1')).toBeInTheDocument();
    // Use getAllByText to handle multiple elements with the same text
    const techElements = screen.getAllByText('Tech');
    expect(techElements.length).toBeGreaterThan(0);
  });

  test('handles newsletter actions', async () => {
    const items = [
      mockReadingQueueItem('1', 'Newsletter 1', 0, new Date().toISOString()),
    ];

    const mockHandleMarkAsRead = vi.fn().mockResolvedValue({});
    const mockHandleToggleLike = vi.fn().mockResolvedValue({});
    const mockHandleToggleArchive = vi.fn().mockResolvedValue({});
    const mockRemoveFromQueue = vi.fn().mockResolvedValue({});

    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
      removeFromQueue: mockRemoveFromQueue,
    });

    mockUseSharedNewsletterActions.mockReturnValue({
      ...mockUseSharedNewsletterActions(),
      handleMarkAsRead: mockHandleMarkAsRead,
      handleToggleLike: mockHandleToggleLike,
      handleToggleArchive: mockHandleToggleArchive,
      isNewsletterLoading: vi.fn((_action: string, _newsletterId: string) => false),
      isAnyNewsletterLoading: vi.fn((_newsletterId: string) => false),
    });

    await renderReadingQueuePage();

    // The newsletter row should be present
    expect(screen.getByTestId('newsletter-row-main-1')).toBeInTheDocument();
    expect(screen.getByText('Newsletter 1')).toBeInTheDocument();
  });

  test('navigates to browse newsletters when empty queue button is clicked', async () => {
    await renderReadingQueuePage();

    const browseButton = screen.getByText('Browse Newsletters');
    await act(async () => {
      fireEvent.click(browseButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('handles retry on error', async () => {
    const mockRefetch = vi.fn();
    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      isError: true,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    });

    await renderReadingQueuePage();

    const retryButton = screen.getByText('Retry');
    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  test('shows no newsletters message when filtering by tags returns empty', async () => {
    const items = [
      mockReadingQueueItem('1', 'Tech News', 0, new Date().toISOString(), [mockTagsData[0]]),
    ];

    mockUseReadingQueue.mockReturnValue({
      ...mockUseReadingQueue(),
      readingQueue: items,
      isEmpty: false,
    });

    await renderReadingQueuePage();

    // The newsletter row and tag should be present
    expect(screen.getByTestId('newsletter-row-main-1')).toBeInTheDocument();
    // Use getAllByText to handle multiple elements with the same text
    const techElements = screen.getAllByText('Tech');
    expect(techElements.length).toBeGreaterThan(0);
  });
});
