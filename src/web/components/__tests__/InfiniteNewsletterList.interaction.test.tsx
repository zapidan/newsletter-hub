import { TestProviders } from '@common/components/providers/AppProviders';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { InfiniteNewsletterList } from '../InfiniteScroll/InfiniteNewsletterList';
import { createMockNewsletter, setupIntersectionObserverMock } from './test-utils';

// Mock NewsletterRow with interaction handlers
const mockToggleSelect = vi.fn();
const mockToggleLike = vi.fn().mockResolvedValue(undefined);
const mockToggleArchive = vi.fn();
const mockToggleRead = vi.fn();
const mockRowClick = vi.fn();

vi.mock('../NewsletterRow', () => ({
  default: vi.fn(({ newsletter, onToggleLike, onToggleRead, onRowClick }) => (
    <div
      className="rounded-lg p-4 flex items-start cursor-pointer transition-all duration-200"
      onClick={(e) => onRowClick?.(newsletter, e)}
      data-testid={`newsletter-row-${newsletter.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base truncate">
                  {newsletter.title}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead?.(newsletter.id);
                    }}
                    aria-label="Mark as read"
                    className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500"
                    data-testid={`mark-read-${newsletter.id}`}
                    title="Mark as read"
                  >
                    <span className="w-3 h-3">
                      <svg className="lucide lucide-eye" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike?.(newsletter);
                    }}
                    aria-label="Like"
                    className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500"
                    data-testid={`like-${newsletter.id}`}
                    title="Like"
                  >
                    <span className="w-3 h-3">
                      <svg className="lucide lucide-heart" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 14c1.49-1.46 1.49-4.42 0-6.85C17.5 4.52 12 1 12 1S6.5 4.52 5 7.15c-1.49 2.43-1.49 5.39 0 6.85L12 23l7-9z" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )),
}));

// Mock LoadingSentinel
vi.mock('../InfiniteScroll/LoadingSentinel', () => ({
  LoadingSentinel: () => <div data-testid="loading-sentinel" />,
}));

describe('InfiniteNewsletterList - Interactions', () => {
  const mockNewsletters = [
    createMockNewsletter('1', {
      title: 'Test Newsletter 1',
      source: {
        id: 'source-1',
        name: 'Test Source 1',
        from: 'test1@example.com',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      }
    }),
    createMockNewsletter('2', {
      title: 'Test Newsletter 2',
      source: {
        id: 'source-2',
        name: 'Test Source 2',
        from: 'test2@example.com',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      }
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    setupIntersectionObserverMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles row click', async () => {
    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={2}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={mockToggleLike}
          onRowClick={mockRowClick}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    const newsletterTitle = screen.getByText('Test Newsletter 1');
    fireEvent.click(newsletterTitle);
    expect(mockRowClick).toHaveBeenCalledWith(mockNewsletters[0], expect.anything());
  });

  it('handles newsletter like', async () => {
    const mockNewsletters = [
      createMockNewsletter('1', {
        title: 'Test Newsletter 1',
        received_at: new Date().toISOString() // Use current timestamp instead of calculating from ID
      }),
    ];

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={1}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={mockToggleLike}
          onToggleRead={mockToggleRead}
          onRowClick={mockRowClick}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Find the like button by its aria-label and click it
    const likeButton = screen.getByRole('button', { name: /like/i });
    await fireEvent.click(likeButton);
    expect(mockToggleLike).toHaveBeenCalledWith(mockNewsletters[0]);
  });

  it('handles mark as read', () => {
    const mockNewsletters = [
      createMockNewsletter('1', {
        title: 'Test Newsletter 1',
        received_at: new Date().toISOString() // Use current timestamp instead of calculating from ID
      }),
    ];

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={1}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={mockToggleLike}
          onToggleRead={mockToggleRead}
          onRowClick={mockRowClick}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Find the mark as read button by its aria-label and click it
    const markReadButton = screen.getByRole('button', { name: /mark as read/i });
    fireEvent.click(markReadButton);
    expect(mockToggleRead).toHaveBeenCalledWith('1');
  });

  it('calls onRowClick when a newsletter is clicked', () => {
    const handleClick = vi.fn();

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={mockNewsletters.length}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
          onRowClick={handleClick}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    const newsletterTitle = screen.getByText('Test Newsletter 1');
    fireEvent.click(newsletterTitle);
    expect(handleClick).toHaveBeenCalledWith(mockNewsletters[0], expect.anything());
  });
  it('calls onRetry when retry button is clicked in initial error state', () => {
    const mockError = new Error('Failed to fetch');
    const mockOnRetry = vi.fn();
    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={[]}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={0}
          error={mockError}
          onLoadMore={() => { }}
          onRetry={mockOnRetry}
          onToggleLike={async () => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );
    fireEvent.click(screen.getByText('Try Again'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });
});
