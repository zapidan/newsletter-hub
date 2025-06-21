import { TestProviders } from '@common/components/providers/AppProviders';
import { NewsletterWithRelations } from '@common/types';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { InfiniteNewsletterList } from '../InfiniteScroll/InfiniteNewsletterList';

// Mock the date formatting function to ensure consistent snapshots
vi.mock('@/common/utils/date', () => ({
  formatDate: vi.fn().mockImplementation((date) => `Formatted: ${new Date(date).toISOString()}`),
  formatRelativeTime: vi.fn().mockReturnValue('2 days ago'),
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

    // Verify the loading spinner is present with the correct classes
    const loadingSpinner = container.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();

    // Check for the SVG element and its classes
    const svgElement = loadingSpinner?.closest('svg');
    expect(svgElement).toHaveClass('w-6', 'h-6', 'text-blue-500');

    // Verify the loading text is present
    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();

    // Verify the snapshot matches
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
});
