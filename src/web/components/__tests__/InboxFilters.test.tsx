import { render, screen, fireEvent } from '@testing-library/react';
import { InboxFilters, NewsletterSourceWithCount } from '../InboxFilters';
import type { FilterType, TimeRange } from '../InboxFilters';
import { vi } from 'vitest';

const mockNewsletterSources: NewsletterSourceWithCount[] = [
  { id: 'source1', name: 'Tech Weekly', count: 10, user_id: 'user1', from: 'tech@example.com', created_at: '', updated_at: '', is_archived: false },
  { id: 'source2', name: 'Design Daily', count: 5, user_id: 'user1', from: 'design@example.com', created_at: '', updated_at: '', is_archived: false },
];

describe('InboxFilters', () => {
  const mockOnFilterChange = vi.fn();
  const mockOnSourceFilterChange = vi.fn();
  const mockOnTimeRangeChange = vi.fn();

  const defaultProps = {
    filter: 'all' as FilterType,
    sourceFilter: null,
    timeRange: 'all' as TimeRange,
    newsletterSources: mockNewsletterSources,
    onFilterChange: mockOnFilterChange,
    onSourceFilterChange: mockOnSourceFilterChange,
    onTimeRangeChange: mockOnTimeRangeChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with default props', () => {
    render(<InboxFilters {...defaultProps} />);
    expect(screen.getByLabelText('Filter by time range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter by all newsletters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter by unread newsletters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter by liked newsletters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter by archived newsletters/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by newsletter source')).toBeInTheDocument();
  });

  test('calls onFilterChange when a filter button is clicked', () => {
    render(<InboxFilters {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Filter by unread newsletters/i }));
    expect(mockOnFilterChange).toHaveBeenCalledWith('unread');
  });

  test('calls onTimeRangeChange when time range is changed', () => {
    render(<InboxFilters {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Filter by time range'), { target: { value: 'week' } });
    expect(mockOnTimeRangeChange).toHaveBeenCalledWith('week');
  });

  test('opens source filter dropdown and calls onSourceFilterChange', () => {
    render(<InboxFilters {...defaultProps} />);
    const sourceFilterButton = screen.getByLabelText('Filter by newsletter source');
    fireEvent.click(sourceFilterButton);

    expect(screen.getByText('Tech Weekly')).toBeInTheDocument(); // Dropdown is open
    fireEvent.click(screen.getByText('Tech Weekly'));
    expect(mockOnSourceFilterChange).toHaveBeenCalledWith('source1');
  });

  test('selects "All Sources" from dropdown', () => {
    render(<InboxFilters {...defaultProps} sourceFilter="source1" />);
    const sourceFilterButton = screen.getByLabelText('Filter by newsletter source');
    fireEvent.click(sourceFilterButton);

    expect(screen.getByText('All Sources')).toBeInTheDocument();
    fireEvent.click(screen.getByText('All Sources'));
    expect(mockOnSourceFilterChange).toHaveBeenCalledWith(null);
  });

  test('hides time filter when showTimeFilter is false', () => {
    render(<InboxFilters {...defaultProps} showTimeFilter={false} />);
    expect(screen.queryByLabelText('Filter by time range')).not.toBeInTheDocument();
  });

  test('hides source filter when showSourceFilter is false', () => {
    render(<InboxFilters {...defaultProps} showSourceFilter={false} />);
    expect(screen.queryByLabelText('Filter by newsletter source')).not.toBeInTheDocument();
  });

  test('displays loading indicator when isLoading is true', () => {
    render(<InboxFilters {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Updating...')).toBeInTheDocument();
    // Check if buttons are disabled
    expect(screen.getByRole('button', { name: /Filter by unread newsletters/i })).toBeDisabled();
    expect(screen.getByLabelText('Filter by time range')).toBeDisabled();
    expect(screen.getByLabelText('Filter by newsletter source')).toBeDisabled();
  });

  test('displays source loading indicator when isLoadingSources is true', () => {
    render(<InboxFilters {...defaultProps} isLoadingSources={true} />);
    // The loading spinner is within the button, check for its presence via a class or structure if possible
    // For now, we'll check if the button is disabled as per implementation
    const sourceButton = screen.getByLabelText('Filter by newsletter source');
    expect(sourceButton).toBeDisabled();
    // A more robust check might involve querying for the spinner element if it has a specific test id or class
  });


  test('renders compact version when compact is true', () => {
    render(<InboxFilters {...defaultProps} compact={true} />);
    // Check for smaller text size or specific compact classes if they exist
    // For example, a button that would have text-sm normally, might have text-xs in compact
    const unreadButton = screen.getByRole('button', { name: /Filter by unread newsletters/i });
    expect(unreadButton).toHaveClass('text-xs');
  });

  test('shows filter counts when showFilterCounts is true and counts are available', () => {
    render(<InboxFilters {...defaultProps} showFilterCounts={true} newsletterSources={mockNewsletterSources} />);
    const sourceFilterButton = screen.getByLabelText('Filter by newsletter source');
    fireEvent.click(sourceFilterButton); // Open dropdown

    const techWeeklyOption = screen.getByText('Tech Weekly').closest('button');
    expect(techWeeklyOption).toHaveTextContent('10');

    const designDailyOption = screen.getByText('Design Daily').closest('button');
    expect(designDailyOption).toHaveTextContent('5');
  });
});
