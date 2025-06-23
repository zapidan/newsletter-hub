// Attempting a top-level vi.mock for SortableNewsletterRow
import { vi } from 'vitest';
vi.mock('../components/reading-queue/SortableNewsletterRow', () => {
  // console.log('TOP LEVEL MOCK: SortableNewsletterRow factory executed');
  return {
    SortableNewsletterRow: vi.fn(({ newsletter, item, onNewsletterClick }) => {
      const id = newsletter?.id || item?.newsletter?.id || 'mock-fallback-id';
      const title = newsletter?.title || item?.newsletter?.title || 'Mock Fallback Title';
      // console.log(`Top-level SortableNewsletterRow MOCK RENDERED for ${id}`);
      return (
        <div data-testid={`newsletter-row-${id}`} onClick={() => onNewsletterClick(newsletter || item?.newsletter)}>
          Mocked Row Content: {title}
        </div>
      );
    }),
  };
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach } from 'vitest'; // vi is already imported

import ReadingQueuePage from '../ReadingQueuePage';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useTags } from '@common/hooks/useTags';
import { useCache } from '@common/hooks/useCache';
import { AuthContext } from '@common/contexts/AuthContext';
import { ReadingQueueItem, NewsletterWithRelations, Tag } from '@common/types';

// Mock hooks and components
vi.mock('@common/hooks/useReadingQueue');
vi.mock('@common/hooks/useSharedNewsletterActions');
vi.mock('@common/hooks/useTags');
vi.mock('@common/hooks/useCache');
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});
vi.mock('@common/utils/logger', () => {
  const loggerInstance = {
    debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn()
  };
  return {
    useLogger: () => loggerInstance,
    logger: loggerInstance,
  };
});

// Attempt to mock SortableNewsletterRow has been removed.
// The actual component will be used.

vi.mock('@common/utils/cacheUtils', async (importOriginal) => { // For getCacheManager used in page
    const actual = await importOriginal<typeof import('@common/utils/cacheUtils')>();
    return {
        ...actual,
        getCacheManager: vi.fn(() => ({ // Provide a mock cache manager
            warmCache: vi.fn(),
            batchInvalidateQueries: vi.fn(),
            smartInvalidate: vi.fn(),
        })),
    };
});


const mockUseReadingQueue = vi.mocked(useReadingQueue);
const mockUseSharedNewsletterActions = vi.mocked(useSharedNewsletterActions);
const mockUseTags = vi.mocked(useTags);
const mockUseCache = vi.mocked(useCache);
// Correctly get a handle to the mocked useNavigate
import { useNavigate } from 'react-router-dom';
const mockUseNavigate = vi.mocked(useNavigate);


const mockUser = { id: 'user-123', email: 'test@example.com' };

const createMockNewsletter = (id: string, title: string): NewsletterWithRelations => ({
  id, title, content: `Content ${id}`, received_at: new Date().toISOString(),
  summary: '', image_url: '', is_read: false, is_liked: false, is_archived: false,
  updated_at: new Date().toISOString(), estimated_read_time: 5, word_count: 100,
  source: { id: `s-${id}`, name: `Source ${id}`, from: `s-${id}@e.com`, user_id: mockUser.id, created_at: '', updated_at: '' },
  tags: [] as Tag[], newsletter_source_id: `s-${id}`, user_id: mockUser.id,
});

const createMockQueueItem = (id: string, newsletterId: string, title: string, position: number): ReadingQueueItem => ({
  id,
  user_id: mockUser.id,
  newsletter_id: newsletterId,
  newsletter: createMockNewsletter(newsletterId, title),
  added_at: new Date().toISOString(),
  position,
});

const queryClient = new QueryClient();

const renderReadingQueuePage = () => { // Changed back to synchronous
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user: mockUser as any, session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn() }}>
        <MemoryRouter>
          <ReadingQueuePage /> {/* Using statically imported component */}
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('ReadingQueuePage', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mocks for hooks used by ReadingQueuePage or its children
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseCache.mockReturnValue({ setQueryData: vi.fn() } as any);
    mockUseTags.mockReturnValue({ getTags: vi.fn().mockResolvedValue([]), tags: [] } as any);
    mockUseSharedNewsletterActions.mockReturnValue({
      handleMarkAsRead: vi.fn(),
      handleMarkAsUnread: vi.fn(),
      handleToggleLike: vi.fn(),
      handleToggleArchive: vi.fn(),
    } as any);
    // Note: useReadingQueue is mocked at the top level and its mockReturnValue will be set per test.
  });

  it('should display loading state', () => { // No longer async
    mockUseReadingQueue.mockReturnValue({ readingQueue: [], isLoading: true, error: null } as any);
    renderReadingQueuePage(); // No longer awaited
    const loadingDiv = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'div' && element.classList.contains('animate-spin');
    });
    expect(loadingDiv).toBeInTheDocument();
  });

  it('should display error state', () => { // No longer async
    mockUseReadingQueue.mockReturnValue({ readingQueue: [], isLoading: false, error: new Error('Failed to load') } as any);
    renderReadingQueuePage(); // No longer awaited
    expect(screen.getByText(/Failed to load reading queue/i)).toBeInTheDocument();
  });

  it('should display empty state when queue is empty', () => { // No longer async
    mockUseReadingQueue.mockReturnValue({ readingQueue: [], isLoading: false, error: null } as any);
    renderReadingQueuePage(); // No longer awaited
    expect(screen.getByText(/No newsletters in queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Browse Newsletters/i)).toBeInTheDocument();
  });

  it('should display reading queue items', () => { // No longer async
    const items = [
      createMockQueueItem('q1', 'nl1', 'Newsletter 1', 0),
      createMockQueueItem('q2', 'nl2', 'Newsletter 2', 1),
    ];
    mockUseReadingQueue.mockReturnValue({ readingQueue: items, isLoading: false, error: null } as any);
    renderReadingQueuePage(); // No longer awaited

    // Assertions for mocked component content
    expect(screen.getByText('Mocked Row Content: Newsletter 1')).toBeInTheDocument();
    expect(screen.getByText('Mocked Row Content: Newsletter 2')).toBeInTheDocument();
    expect(screen.getByText(/2 items/i)).toBeInTheDocument(); // Item count
  });

  it('clicking "Browse Newsletters" button should navigate to home', () => { // No longer async
    mockUseReadingQueue.mockReturnValue({ readingQueue: [], isLoading: false, error: null } as any);
    renderReadingQueuePage(); // No longer awaited
    fireEvent.click(screen.getByText(/Browse Newsletters/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicking a newsletter item should navigate to its detail page and mark as read if unread', async () => {
    const mockUnreadNewsletter = createMockNewsletter('nl1', 'Unread Newsletter');
    mockUnreadNewsletter.is_read = false;
    const items = [createMockQueueItem('q1', 'nl1', 'Unread Newsletter', 0)];
    items[0].newsletter = mockUnreadNewsletter;

    const markAsReadMock = vi.fn();
    // Set up the specific mock return value for useSharedNewsletterActions for this test
    mockUseSharedNewsletterActions.mockReturnValue({
        handleMarkAsRead: markAsReadMock,
        handleMarkAsUnread: vi.fn(),
        handleToggleLike: vi.fn(),
        handleToggleArchive: vi.fn(),
        // Ensure all actions potentially called are mocked
    } as any);

    mockUseReadingQueue.mockReturnValue({
        readingQueue: items,
        isLoading: false,
        error: null,
        removeFromQueue: vi.fn(),
        reorderQueue: vi.fn(),
     } as any);

    await renderReadingQueuePage(); // This test is async due to findByTestId and waitFor

    // Expect the real component to be rendered
    // The NewsletterRow component uses `data-testid={newsletter-row-${newsletter.id}}`
    // For the first item, newsletter.id is 'nl1'
    const newsletterRow = await screen.findByTestId('newsletter-row-nl1');
    expect(screen.getByText('Mocked Row Content: Unread Newsletter')).toBeInTheDocument();
    fireEvent.click(newsletterRow);

    // The onNewsletterClick prop of SortableNewsletterRow (mocked) calls handleNewsletterClick,
    // which then calls handleToggleRead, eventually calling sharedActions.handleMarkAsRead.
    // The handleNewsletterClick function in ReadingQueuePage calls handleToggleRead, then navigates.
    // handleToggleRead calls sharedActions.handleMarkAsRead if item is unread.

    await waitFor(() => expect(markAsReadMock).toHaveBeenCalledWith(mockUnreadNewsletter)); // handleMarkAsRead receives the full newsletter object

    expect(mockNavigate).toHaveBeenCalledWith('/newsletters/nl1', {
      state: { fromReadingQueue: true, from: '/queue' },
    });
  });

  // TODO: Add tests for sorting, tag filtering, drag-and-drop (if feasible), and row actions (like, archive, remove from queue).
});
