import { TestProviders } from '@common/components/providers/AppProviders';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { mockNewslettersWithRelations } from '../../../__tests__/mocks/data.ts';
import { InfiniteNewsletterList } from '../InfiniteScroll/InfiniteNewsletterList';
import { createMockNewsletter } from './test-utils';


// Mock IntersectionObserver
let capturedIntersectionObserverCallback: IntersectionObserverCallback | null = null;
let mockUnobserveFn: ReturnType<typeof vi.fn>;
let mockDisconnectFn: ReturnType<typeof vi.fn>;
let mockObserveInstance: ReturnType<typeof vi.fn>;
let IntersectionObserverMock: ReturnType<typeof vi.fn>;

// Simple mock for NewsletterRow
vi.mock('../NewsletterRow', () => ({
  default: vi.fn(({ newsletter }) => (
    <div data-testid={`newsletter-row-${newsletter.id}`}>
      {newsletter.title}
    </div>
  )),
}));


// Mock LoadingSentinel with the implementation inside the mock factory
vi.mock('../InfiniteScroll/LoadingSentinel', () => ({
  LoadingSentinel: vi.fn(({ isLoading, error, onRetry }: any) => {
    if (error) {
      return (
        <div data-testid="loading-sentinel">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-red-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">
                Failed to load newsletters
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {error.message}
              </p>
              <button
                onClick={onRetry}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                data-testid="retry-button"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <div data-testid="loading-sentinel">{isLoading ? 'Loading more newsletters...' : 'No more items'}</div>;
  })
}));

beforeEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset all mocks and state before each test
  mockUnobserveFn = vi.fn();
  mockDisconnectFn = vi.fn();
  capturedIntersectionObserverCallback = null;

  mockObserveInstance = vi.fn(element => {
    if (capturedIntersectionObserverCallback && element && element.dataset.testid === 'loading-sentinel') {
      act(() => {
        capturedIntersectionObserverCallback!([{ isIntersecting: true, target: element } as any], {} as IntersectionObserver);
      });
    }
  });

  IntersectionObserverMock = vi.fn((cb, options) => {
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

  global.IntersectionObserver = IntersectionObserverMock;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('InfiniteNewsletterList - Infinite Scroll', () => {
  const mockLoadMore = vi.fn();
  const mockRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onLoadMore when scrolled to bottom', async () => {
    const initialNewsletters = Array(10)
      .fill(0)
      .map((_, i) => createMockNewsletter(String(i + 1), { received_at: new Date().toISOString() }));

    // Create a mock for the IntersectionObserver
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: IntersectionObserverCallback = () => { };

    // Mock the global IntersectionObserver
    const IntersectionObserverMock = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
      callback = cb;
      return {
        observe,
        disconnect,
      };
    });

    // @ts-ignore - Mocking global object
    global.IntersectionObserver = IntersectionObserverMock;

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={initialNewsletters}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={true}
          totalCount={20}
          error={null}
          onLoadMore={mockLoadMore}
          onRetry={mockRetry}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Wait for any async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Find the loading sentinel
    const sentinel = screen.getByTestId('loading-sentinel');
    expect(sentinel).toBeInTheDocument();

    // Manually trigger the intersection
    await act(async () => {
      callback(
        [{
          isIntersecting: true,
          target: sentinel,
          intersectionRatio: 1,
          boundingClientRect: sentinel.getBoundingClientRect(),
          intersectionRect: sentinel.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry],
        { disconnect: vi.fn() } as unknown as IntersectionObserver
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify the callback was called
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when loading more items', () => {
    const initialNewsletters = Array(10)
      .fill(0)
      .map((_, i) => createMockNewsletter(String(i + 1), { received_at: new Date().toISOString() }));

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={initialNewsletters}
          isLoading={false}
          isLoadingMore={true}
          hasNextPage={true}
          totalCount={20}
          error={null}
          onLoadMore={mockLoadMore}
          onRetry={mockRetry}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();
  });

  it('shows error state when loading more items fails', async () => {
    const error = new Error('Test error message');

    const { container } = render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={[]}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={true}
          totalCount={0}
          error={error}
          onLoadMore={mockLoadMore}
          onRetry={mockRetry}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Debug: Log the rendered component
    console.log('Rendered HTML:', container.innerHTML);

    // Check for error message
    const errorMessage = screen.getByText('Failed to load newsletters');
    expect(errorMessage).toBeInTheDocument();

    const errorDescription = screen.getByText('Test error message');
    expect(errorDescription).toBeInTheDocument();

    // Try multiple ways to find the retry button
    let retryButton;

    // First try by role and name
    try {
      retryButton = screen.getByRole('button', { name: /try again/i });
    } catch (e) {
      console.log('Could not find button by role and name, trying by test-id');
      // If that fails, try by test-id
      retryButton = screen.getByTestId('retry-button');
    }

    // Debug: Log button information
    console.log('Retry button found:', {
      textContent: retryButton?.textContent,
      outerHTML: retryButton?.outerHTML,
      attributes: retryButton ?
        Array.from(retryButton.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        })) : 'Button not found'
    });

    // Verify the button is in the document and clickable
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toBeEnabled();

    // Click the button
    fireEvent.click(retryButton);

    // Verify the retry callback was called
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });


  it('shows loading more indicator when fetching next page', () => {
    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewslettersWithRelations}
          isLoading={false}
          isLoadingMore={true}
          hasNextPage={true}
          totalCount={mockNewslettersWithRelations.length}
          error={null}
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Verify the loading sentinel is rendered correctly
    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-sentinel')).toBeInTheDocument();
  });

  it('calls onLoadMore when sentinel is intersected', async () => { // TODO: Fix IntersectionObserver timeout
    const mockOnLoadMore = vi.fn();

    render(
      <TestProviders>
        <InfiniteNewsletterList
          newsletters={mockNewslettersWithRelations}
          isLoading={false}
          isLoadingMore={false}
          hasNextPage={true}
          totalCount={mockNewslettersWithRelations.length + 5} // Simulate more items available
          error={null}
          onLoadMore={mockOnLoadMore}
          onToggleLike={async () => { }}
          onRowClick={() => { }}
          onNewsletterClick={() => { }}
        />
      </TestProviders>
    );

    // Ensure the sentinel has been rendered and that IntersectionObserver.observe was called
    await waitFor(() => expect(mockObserveInstance).toHaveBeenCalled());
    const sentinelElement = screen.getByTestId('loading-sentinel');
    // Check that mockObserveInstance was called with an element that has data-testid="loading-sentinel"
    const observedElement = mockObserveInstance.mock.calls[0][0];
    expect(observedElement).toBeInstanceOf(HTMLElement);

    // Manually trigger the intersection callback
    // Ensure the callback has been captured by the mock
    if (!capturedIntersectionObserverCallback) {
      throw new Error('IntersectionObserver callback was not captured by the mock.');
    }

    await act(async () => { // Make act async
      // Simulate the sentinel intersecting
      capturedIntersectionObserverCallback!([{ isIntersecting: true, target: sentinelElement }] as any, {} as IntersectionObserver);
      await new Promise(resolve => setTimeout(resolve, 0)); // Ensure event loop ticks
    });

    await waitFor(() => expect(mockOnLoadMore).toHaveBeenCalledTimes(1), { timeout: 5000 }); // Increased timeout for CI
  });
});
