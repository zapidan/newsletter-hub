import { TestProviders } from '@common/components/providers/AppProviders';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { InfiniteNewsletterList } from '../InfiniteScroll/InfiniteNewsletterList';
import { createMockNewsletter, setupIntersectionObserverMock } from './test-utils';

// Mock NewsletterRowContainer to reduce test complexity
vi.mock('../NewsletterRowContainer', () => ({
  default: vi.fn(({ newsletter, isSelected, showCheckbox, showTags }) => {
    // Ensure we have a valid newsletter object with an id
    const newsletterId = newsletter?.id || 'unknown';
    return (
      <div
        data-testid={`newsletter-row-${newsletterId}`}
        data-props={JSON.stringify({
          newsletter,
          isSelected,
          showCheckbox,
          showTags
        })}
      >
        {newsletter?.title || `Newsletter ${newsletterId}`}
      </div>
    );
  }),
}));

// Mock LoadingSentinel
vi.mock('../InfiniteScroll/LoadingSentinel', () => ({
  LoadingSentinel: () => <div data-testid="loading-sentinel" />,
}));

describe('InfiniteNewsletterList - Basic Rendering', () => {
  const mockNewsletters = [
    createMockNewsletter('1', { title: 'Test Newsletter 1' }),
    createMockNewsletter('2', { title: 'Test Newsletter 2' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    setupIntersectionObserverMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(
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

    expect(screen.getByText('Loading newsletters...')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
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

    expect(screen.getByText(/no newsletters found/i)).toBeInTheDocument();
  });

  it('renders newsletter items', () => {
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
          onToggleLike={async () => { }}
          onRowClick={() => { }}
        />
      </TestProviders>
    );

    expect(screen.getByText('Test Newsletter 1')).toBeInTheDocument();
    expect(screen.getByText('Test Newsletter 2')).toBeInTheDocument();
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
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
        />
      </TestProviders>
    );
    expect(screen.getByText('Failed to load newsletters')).toBeInTheDocument();
    expect(screen.getByText(mockError.message)).toBeInTheDocument();
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
          onLoadMore={() => { }}
          onToggleLike={async () => { }}
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
