import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { FilterProvider } from '../../../common/contexts/FilterContext';
import { InboxFilters } from '../../../web/components/InboxFilters';

// Mock the newsletter service and hooks
vi.mock('../../../services/NewsletterService', () => ({
  newsletterService: {
    getSources: vi.fn(() => Promise.resolve([])),
    getTags: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../../web/hooks/useNewsletterSourceGroups', () => ({
  useNewsletterSourceGroups: () => ({
    groups: [
      { id: 'group-1', name: 'Tech', color: '#blue' },
      { id: 'group-2', name: 'Business', color: '#green' },
      { id: 'group-3', name: 'Design', color: '#purple' },
    ],
    isLoading: false,
  }),
}));

// Test wrapper with all necessary providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FilterProvider>
          {children}
        </FilterProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('InboxFilters Group Preservation', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    vi.clearAllMocks();
  });

  it('should render without errors when no groups are selected', () => {
    render(
      <InboxFilters
        filter="unread"
        sourceFilter={null}
        timeRange="day"
        groupFilters={[]}
        sortBy="received_at"
        sortOrder="desc"
        newsletterSources={[]}
        newsletterGroups={[
          { id: 'group-1', name: 'Tech' },
          { id: 'group-2', name: 'Business' },
          { id: 'group-3', name: 'Design' },
        ]}
        isLoadingGroups={false}
        onFilterChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onTimeRangeChange={vi.fn()}
        onGroupFiltersChange={vi.fn()}
        onSortByChange={vi.fn()}
        onSortOrderChange={vi.fn()}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should render without errors and show basic elements
    expect(screen.getAllByText('All Groups')).toHaveLength(2); // Button + dropdown option
    expect(screen.getAllByText('Date')).toHaveLength(2); // Sort button + dropdown option
    expect(screen.getAllByText('Unread')).toHaveLength(2); // Button + mobile button
  });

  it('should render correctly when groups are selected', () => {
    render(
      <InboxFilters
        filter="unread"
        sourceFilter={null}
        timeRange="day"
        groupFilters={['group-1', 'group-2']}
        sortBy="received_at"
        sortOrder="desc"
        newsletterSources={[]}
        newsletterGroups={[
          { id: 'group-1', name: 'Tech' },
          { id: 'group-2', name: 'Business' },
          { id: 'group-3', name: 'Design' },
        ]}
        isLoadingGroups={false}
        onFilterChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onTimeRangeChange={vi.fn()}
        onGroupFiltersChange={vi.fn()}
        onSortByChange={vi.fn()}
        onSortOrderChange={vi.fn()}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should render without errors - use getAllByText to handle multiple elements
    expect(screen.getAllByText('2 Groups')).toHaveLength(2); // Button + dropdown option
    expect(screen.getAllByText('Date')).toHaveLength(2);
    expect(screen.getAllByText('Unread')).toHaveLength(2);
  });

  it('should render correctly when groups are loading', () => {
    render(
      <InboxFilters
        filter="unread"
        sourceFilter={null}
        timeRange="day"
        groupFilters={['group-1', 'group-2']}
        sortBy="received_at"
        sortOrder="desc"
        newsletterSources={[]}
        newsletterGroups={[
          { id: 'group-1', name: 'Tech' },
          { id: 'group-2', name: 'Business' },
          { id: 'group-3', name: 'Design' },
        ]}
        isLoadingGroups={true}
        onFilterChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onTimeRangeChange={vi.fn()}
        onGroupFiltersChange={vi.fn()}
        onSortByChange={vi.fn()}
        onSortOrderChange={vi.fn()}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should render without errors even when loading
    expect(screen.getAllByText('2 Groups')).toHaveLength(2);
    expect(screen.getAllByText('Date')).toHaveLength(2);
    expect(screen.getAllByText('Unread')).toHaveLength(2);
  });

  it('should render correctly with single group selected', () => {
    render(
      <InboxFilters
        filter="unread"
        sourceFilter={null}
        timeRange="day"
        groupFilters={['group-1']}
        sortBy="received_at"
        sortOrder="desc"
        newsletterSources={[]}
        newsletterGroups={[
          { id: 'group-1', name: 'Tech' },
          { id: 'group-2', name: 'Business' },
          { id: 'group-3', name: 'Design' },
        ]}
        isLoadingGroups={false}
        onFilterChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onTimeRangeChange={vi.fn()}
        onGroupFiltersChange={vi.fn()}
        onSortByChange={vi.fn()}
        onSortOrderChange={vi.fn()}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should show the group name when single group is selected
    expect(screen.getAllByText('Tech')).toHaveLength(2); // Button + dropdown option
    expect(screen.getAllByText('Date')).toHaveLength(2);
    expect(screen.getAllByText('Unread')).toHaveLength(2);
  });

  it('should have all required controls available', () => {
    render(
      <InboxFilters
        filter="unread"
        sourceFilter={null}
        timeRange="day"
        groupFilters={['group-1', 'group-2']}
        sortBy="received_at"
        sortOrder="desc"
        newsletterSources={[]}
        newsletterGroups={[
          { id: 'group-1', name: 'Tech' },
          { id: 'group-2', name: 'Business' },
          { id: 'group-3', name: 'Design' },
        ]}
        isLoadingGroups={false}
        onFilterChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onTimeRangeChange={vi.fn()}
        onGroupFiltersChange={vi.fn()}
        onSortByChange={vi.fn()}
        onSortOrderChange={vi.fn()}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should have all the main controls
    expect(screen.getAllByText('2 Groups')).toHaveLength(2);
    expect(screen.getAllByText('Date')).toHaveLength(2);
    expect(screen.getAllByText('↓')).toHaveLength(2); // Sort order arrows (desktop + mobile)
    expect(screen.getAllByText('Unread')).toHaveLength(2);
    expect(screen.getAllByText('Read')).toHaveLength(2);
    expect(screen.getAllByText('Liked')).toHaveLength(2);
    expect(screen.getAllByText('Archived')).toHaveLength(2);
  });
});
