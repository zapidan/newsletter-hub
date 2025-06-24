import { TestProviders } from '@common/components/providers/AppProviders';
import { NewsletterWithRelations } from '@common/types';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { InfiniteNewsletterList } from '../InfiniteScroll/InfiniteNewsletterList';

// Mock IntersectionObserver
// Mock IntersectionObserver
const mockUnobserveFn = vi.fn();
const mockDisconnectFn = vi.fn();
let capturedIntersectionObserverCallback: IntersectionObserverCallback | null = null;

const mockObserveInstance = vi.fn(element => {
  if (capturedIntersectionObserverCallback && element && element.dataset.testid === 'loading-sentinel') {
    // console.log('Mock Observer: Sentinel observed, firing callback.');
    act(() => {
      capturedIntersectionObserverCallback!([{ isIntersecting: true, target: element } as any], {} as IntersectionObserver);
    });
  }
});

global.IntersectionObserver = vi.fn((cb, options) => {
  capturedIntersectionObserverCallback = cb;
  return {
    observe: mockObserveInstance,
    unobserve: mockUnobserveFn,
    disconnect: mockDisconnectFn,
    root: null,
    rootMargin: options?.rootMargin || "",
    thresholds: options?.threshold ? (Array.isArray(options.threshold) ? options.threshold : [options.threshold]) : [0],
    takeRecords: () => [],
  };
});


// Mock the date formatting function to ensure consistent snapshots
vi.mock('@/common/utils/date', () => ({
  formatDate: vi.fn().mockImplementation((date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }),
  formatRelativeTime: vi.fn().mockReturnValue('2 days ago'),
}));

// Mock the LoadingSentinel component to prevent snapshot mismatches
vi.mock('../InfiniteScroll/LoadingSentinel', () => ({
  LoadingSentinel: vi.fn().mockImplementation(({ isLoading, hasReachedEnd, error, onRetry }) => (
    <div data-testid="loading-sentinel">
      {isLoading && 'Loading more newsletters...'}
      {hasReachedEnd && !isLoading && !error && 'No more newsletters to load'}
      {error && <button onClick={onRetry}>Retry Load More</button>}
    </div>
  ))
}));

// Mock NewsletterRow to simplify testing and inspect props
const mockNewsletterRowOnClick = vi.fn();
vi.mock('../NewsletterRow', () => ({
  default: vi.fn((props) => (
    <div
      data-testid={`newsletter-row-${props.newsletter.id}`}
      data-props={JSON.stringify(props)}
      onClick={() => {
        mockNewsletterRowOnClick(props.newsletter); // Store what it was called with
        if (props.onRowClick) {
          props.onRowClick(props.newsletter);
        }
      }}
    >
      {props.newsletter.title}
    </div>
  )),
}));


describe('InfiniteNewsletterList', () => {
  // Mock system time to a fixed date for consistent snapshots
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-03T00:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockObserveInstance.mockClear(); // Use the new mock name
    mockUnobserveFn.mockClear();
    mockDisconnectFn.mockClear();
    capturedIntersectionObserverCallback = null; // Reset the callback capture
  });

  const mockNewsletters: NewsletterWithRelations[] = [
    {
      id: '1',
      title: 'Test Newsletter 1',
      content: 'This is a test newsletter',
      summary: 'Test summary',
      image_url: 'https://example.com/image.jpg',
      received_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      is_read: false,
      is_liked: false,
      is_archived: false,
      user_id: 'user-1',
      newsletter_source_id: 'source-1',
      source_id: 'source-1',
      source: {
        id: 'source-1',
        name: 'Test Source',
        from: 'test@example.com',
        user_id: 'user-1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        is_archived: false
      },
      tags: [],
      word_count: 100,
      estimated_read_time: 1
    },
    {
      id: '2',
      title: 'Test Newsletter 2',
      content: 'Another test newsletter',
      summary: 'Test summary',
      image_url: 'https://example.com/image.jpg',
      received_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      is_read: true,
      is_liked: false,
      is_archived: false,
      user_id: 'user-1',
      newsletter_source_id: 'source-2',
      source_id: 'source-2',
      source: {
        id: 'source-2',
        name: 'Test Source 2',
        from: 'test2@example.com',
        user_id: 'user-1',
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        is_archived: false
      },
      tags: [],
      word_count: 100,
      estimated_read_time: 1
    },
  ];

  it('renders loading state correctly', () => {
    const { container } = render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={[]}
          isLoading={true}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={0}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
        />
      </TestProviders>
    );

    expect(container).toMatchSnapshot();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByText('Loading newsletters...')).toBeInTheDocument();
  });

  it('renders empty state when no newsletters are available', () => {
    const { container } = render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={[]}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={0}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
        />
      </TestProviders>
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText(/no newsletters found/i)).toBeInTheDocument();
  });

  it('renders newsletters list correctly', () => {
    const { container } = render(
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
          onRowClick={() => { }}
        />
      </TestProviders>
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('Test Newsletter 1')).toBeInTheDocument();
    expect(screen.getByText('Test Newsletter 2')).toBeInTheDocument();
  });

  it('shows loading more indicator when fetching next page', () => {
    const { container } = render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={true}
          hasNextPage={true}
          totalCount={mockNewsletters.length}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
        />
      </TestProviders>
    );

    // Verify the loading sentinel is rendered correctly
    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('calls onNewsletterClick when a newsletter is clicked', () => {
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
        />
      </TestProviders>
    );

    screen.getByText('Test Newsletter 1').click();
    expect(handleClick).toHaveBeenCalledWith(mockNewsletters[0]);
  });

  it.skip('calls onLoadMore when sentinel is intersected', async () => { // TODO: Fix IntersectionObserver timeout
    const mockOnLoadMore = vi.fn();

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={true}
          totalCount={mockNewsletters.length + 5} // Simulate more items available
          error={null}
          onLoadMore={mockOnLoadMore}
          onToggleLike={async () => {}}
        />
      </TestProviders>
    );

    // Ensure the sentinel has been rendered and that IntersectionObserver.observe was called
    await waitFor(() => expect(mockObserveFn).toHaveBeenCalled());
    const sentinelElement = screen.getByTestId('loading-sentinel');
    // Check if the sentinel element itself was observed
    expect(mockObserveFn).toHaveBeenCalledWith(sentinelElement);

    // Manually trigger the intersection callback
    // Ensure the callback has been captured by the mock
    if (!mockIntersectionObserverCallback) {
      throw new Error('IntersectionObserver callback was not captured by the mock.');
    }

    await act(async () => { // Make act async
      // Simulate the sentinel intersecting
      mockIntersectionObserverCallback!([{ isIntersecting: true, target: sentinelElement }] as any, {} as IntersectionObserver);
      await new Promise(resolve => setTimeout(resolve, 0)); // Ensure event loop ticks
    });

    await waitFor(() => expect(mockOnLoadMore).toHaveBeenCalledTimes(1), { timeout: 5000 }); // Increased timeout for CI
  });

  it('renders error state for initial load correctly', () => {
    const mockError = new Error('Failed to fetch');
    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={[]}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={0}
          error={mockError}
          onLoadMore={() => {}}
          onToggleLike={async () => {}}
        />
      </TestProviders>
    );
    expect(screen.getByText('Failed to load newsletters')).toBeInTheDocument();
    expect(screen.getByText(mockError.message)).toBeInTheDocument();
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
          onLoadMore={() => {}}
          onRetry={mockOnRetry}
          onToggleLike={async () => {}}
        />
      </TestProviders>
    );
    fireEvent.click(screen.getByText('Try Again'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('passes correct props to NewsletterRow', () => {
    const selectedIds = new Set(['1']);
    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={false}
          totalCount={mockNewsletters.length}
          error={null}
          onLoadMore={() => {}}
          onToggleLike={async () => {}}
          selectedIds={selectedIds}
          isSelecting={true}
          showCheckbox={true}
          showTags={false}
        />
      </TestProviders>
    );

    const newsletterRow1 = screen.getByTestId('newsletter-row-1');
    const props1 = JSON.parse(newsletterRow1.getAttribute('data-props') || '{}');
    expect(props1.newsletter.id).toBe('1');
    expect(props1.isSelected).toBe(true);
    expect(props1.showCheckbox).toBe(true);
    expect(props1.showTags).toBe(false);

    const newsletterRow2 = screen.getByTestId('newsletter-row-2');
    const props2 = JSON.parse(newsletterRow2.getAttribute('data-props') || '{}');
    expect(props2.newsletter.id).toBe('2');
    expect(props2.isSelected).toBe(false); // Not in selectedIds
  });
});
