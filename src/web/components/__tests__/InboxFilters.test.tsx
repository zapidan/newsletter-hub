import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { FilterType, TimeRange } from '../InboxFilters';
import { InboxFilters, NewsletterSourceWithCount } from '../InboxFilters';

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
    expect(screen.getAllByLabelText('Filter by time range').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Filter by all newsletters/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Filter by unread newsletters/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Filter by liked newsletters/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Filter by archived newsletters/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Filter by newsletter source').length).toBeGreaterThan(0);
  });

  test('calls onFilterChange when a filter button is clicked', () => {
    render(<InboxFilters {...defaultProps} />);
    const unreadButtons = screen.getAllByRole('button', { name: /Filter by unread newsletters/i });
    fireEvent.click(unreadButtons[0]); // Click the first unread button
    expect(mockOnFilterChange).toHaveBeenCalledWith('unread');
  });

  test('calls onTimeRangeChange when time range is changed', () => {
    render(<InboxFilters {...defaultProps} />);
    const selects = screen.getAllByLabelText('Filter by time range');
    fireEvent.change(selects[0], { target: { value: 'week' } });
    expect(mockOnTimeRangeChange).toHaveBeenCalledWith('week');
  });

  test('opens source filter dropdown and calls onSourceFilterChange', () => {
    render(<InboxFilters {...defaultProps} />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source');
    fireEvent.click(sourceButtons[0]);

    expect(screen.getByText('Tech Weekly')).toBeInTheDocument(); // Dropdown is open
    fireEvent.click(screen.getByText('Tech Weekly'));
    expect(mockOnSourceFilterChange).toHaveBeenCalledWith('source1');
  });

  test('selects "All Sources" from dropdown', () => {
    render(<InboxFilters {...defaultProps} sourceFilter="source1" />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source');
    fireEvent.click(sourceButtons[0]);

    expect(screen.getByText('All Sources')).toBeInTheDocument();
    fireEvent.click(screen.getByText('All Sources'));
    expect(mockOnSourceFilterChange).toHaveBeenCalledWith(null);
  });

  test('hides time filter when showTimeFilter is false', () => {
    render(<InboxFilters {...defaultProps} showTimeFilter={false} />);
    expect(screen.queryAllByLabelText('Filter by time range').length).toBe(0);
  });

  test('hides source filter when showSourceFilter is false', () => {
    render(<InboxFilters {...defaultProps} showSourceFilter={false} />);
    expect(screen.queryAllByLabelText('Filter by newsletter source').length).toBe(0);
  });

  test('displays loading indicator when isLoading is true', () => {
    render(<InboxFilters {...defaultProps} isLoading={true} />);
    // Check that all filter buttons and selects are disabled
    screen.getAllByLabelText('Filter by time range').forEach(el => expect(el).toBeDisabled());
    screen.getAllByLabelText('Filter by newsletter source').forEach(el => expect(el).toBeDisabled());
    const unreadButtons = screen.getAllByRole('button', { name: /Filter by unread newsletters/i });
    unreadButtons.forEach(button => expect(button).toBeDisabled());
  });

  test('displays source loading indicator when isLoadingSources is true', () => {
    render(<InboxFilters {...defaultProps} isLoadingSources={true} />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source');
    sourceButtons.forEach(btn => expect(btn).toBeDisabled());
    // Optionally, check for spinner by class if needed
  });

  test('renders compact version when compact is true', () => {
    render(<InboxFilters {...defaultProps} compact={true} />);
    // Check for smaller text size or specific compact classes if they exist
    // For example, a button that would have text-sm normally, might have text-xs in compact
    const unreadButtons = screen.getAllByRole('button', { name: /Filter by unread newsletters/i });
    unreadButtons.forEach(button => expect(button).toHaveClass('text-xs'));
  });

  test('shows filter counts when showFilterCounts is true and counts are available', () => {
    render(<InboxFilters {...defaultProps} showFilterCounts={true} newsletterSources={mockNewsletterSources} />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source');
    fireEvent.click(sourceButtons[0]); // Open dropdown

    const techWeeklyOption = screen.getByText('Tech Weekly').closest('button');
    expect(techWeeklyOption).toHaveTextContent('10');

    const designDailyOption = screen.getByText('Design Daily').closest('button');
    expect(designDailyOption).toHaveTextContent('5');
  });
});
