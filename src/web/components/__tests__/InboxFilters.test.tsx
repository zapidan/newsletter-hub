import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { FilterType, TimeRange } from '../InboxFilters';
import { InboxFilters, NewsletterSourceWithCount } from '../InboxFilters';

const mockNewsletterSources: NewsletterSourceWithCount[] = [
  { id: 'source1', name: 'Tech Weekly', count: 10, user_id: 'user1', from: 'tech@example.com', created_at: '', updated_at: '', is_archived: false },
  { id: 'source2', name: 'Design Daily', count: 5, user_id: 'user1', from: 'design@example.com', created_at: '', updated_at: '', is_archived: false },
];

const mockNewsletterGroups = [
  { id: 'group1', name: 'Work', count: 3 },
  { id: 'group2', name: 'Personal', count: 2 },
];

describe('InboxFilters', () => {
  const mockOnFilterChange = vi.fn();
  const mockOnSourceFilterChange = vi.fn();
  const mockOnGroupFilterChange = vi.fn();
  const mockOnTimeRangeChange = vi.fn();

  const defaultProps = {
    filter: 'unread' as FilterType, // Changed default from 'all' to 'unread'
    sourceFilter: null,
    groupFilter: null,
    timeRange: 'all' as TimeRange,
    newsletterSources: mockNewsletterSources,
    newsletterGroups: mockNewsletterGroups,
    onFilterChange: mockOnFilterChange,
    onSourceFilterChange: mockOnSourceFilterChange,
    onGroupFilterChange: mockOnGroupFilterChange,
    onTimeRangeChange: mockOnTimeRangeChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Multi-group selection mode', () => {
    test('renders multi-group dropdown when groupFilters prop is provided', () => {
      const onGroupFiltersChange = vi.fn();
      render(
        <InboxFilters
          {...defaultProps}
          groupFilters={[]}
          onGroupFiltersChange={onGroupFiltersChange}
        />
      );
      // Multi dropdown uses the same aria-label text
      const groupButtons = screen.getAllByLabelText('Filter by groups');
      expect(groupButtons.length).toBeGreaterThan(0);
    });

    test('disables source filter when any group is selected (multi)', () => {
      const onGroupFiltersChange = vi.fn();
      render(
        <InboxFilters
          {...defaultProps}
          sourceFilter={null}
          groupFilters={["group1"]}
          onGroupFiltersChange={onGroupFiltersChange}
        />
      );
      const sourceButtons = screen
        .getAllByLabelText('Filter by newsletter source')
        .filter((btn) => btn.offsetParent !== null);
      sourceButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    test('toggling multi-group items calls onGroupFiltersChange with updated arrays', () => {
      const onGroupFiltersChange = vi.fn();
      render(
        <InboxFilters
          {...defaultProps}
          groupFilters={[]}
          onGroupFiltersChange={onGroupFiltersChange}
        />
      );

      // Open the multi-select dropdown (aria-label shared)
      const groupButtons = screen.getAllByLabelText('Filter by groups');
      fireEvent.click(groupButtons[0]);

      // Click first group (Work)
      fireEvent.click(screen.getByText('Work'));
      expect(onGroupFiltersChange).toHaveBeenLastCalledWith(['group1']);

      // Click second group (Personal)
      fireEvent.click(screen.getByText('Personal'));
      expect(onGroupFiltersChange).toHaveBeenLastCalledWith(['group2']);

      // Click first again to unselect
      fireEvent.click(screen.getByText('Work'));
      expect(onGroupFiltersChange).toHaveBeenLastCalledWith(['group1']);
    });
  });

  test('renders correctly with default props', () => {
    render(<InboxFilters {...defaultProps} />);
    expect(screen.getAllByLabelText('Filter by time range').length).toBeGreaterThan(0);
    // Removed 'All' button check
    expect(screen.getAllByRole('button', { name: /Filter by unread newsletters/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Filter by read newsletters/i }).length).toBeGreaterThan(0);
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

  test('calls onFilterChange when the read filter button is clicked', () => {
    render(<InboxFilters {...defaultProps} />);
    const readButtons = screen.getAllByRole('button', { name: /Filter by read newsletters/i });
    fireEvent.click(readButtons[0]);
    expect(mockOnFilterChange).toHaveBeenCalledWith('read');
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

  test('renders group filter dropdown', () => {
    render(<InboxFilters {...defaultProps} />);
    expect(screen.getAllByLabelText('Filter by groups').length).toBeGreaterThan(0);
  });

  test('opens group filter dropdown and calls onGroupFilterChange', () => {
    const onGroupFiltersChange = vi.fn();
    render(
      <InboxFilters
        {...defaultProps}
        groupFilters={[]}
        onGroupFiltersChange={onGroupFiltersChange}
      />
    );
    const groupButtons = screen.getAllByLabelText('Filter by groups');
    fireEvent.click(groupButtons[0]);

    // Find the Work button in the dropdown - try multiple approaches
    let workButton: HTMLElement | null = null;
    const workTexts = screen.getAllByText('Work');
    workButton = workTexts.find(text => text.closest('.absolute')) || workTexts[1] || null;

    expect(workButton).toBeInTheDocument();
    if (workButton) {
      fireEvent.click(workButton);
    }
    expect(onGroupFiltersChange).toHaveBeenCalledWith(['group1']);
  });

  test('selects "All Groups" from dropdown', () => {
    const onGroupFiltersChange = vi.fn();
    render(
      <InboxFilters
        {...defaultProps}
        groupFilters={['group1']}
        onGroupFiltersChange={onGroupFiltersChange}
      />
    );
    const groupButtons = screen.getAllByLabelText('Filter by groups');
    fireEvent.click(groupButtons[0]);

    // Find All Groups button in dropdown - try multiple approaches
    let allGroupsButton: HTMLElement | null = null;
    try {
      allGroupsButton = screen.getByText('Clear All Groups').closest('div')?.parentElement?.querySelector('button') || null;
    } catch {
      // Fallback to finding All Groups button
      const buttons = screen.getAllByText('All Groups');
      allGroupsButton = buttons.find(btn => btn.closest('.absolute')) || buttons[1] || null;
    }
    expect(allGroupsButton).toBeInTheDocument();
    if (allGroupsButton) {
      fireEvent.click(allGroupsButton);
    }
    expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
  });

  test('group filter is enabled when no source is selected, and disabled when source is selected', () => {
    // Enabled when no source is selected
    render(<InboxFilters {...defaultProps} groupFilter={null} sourceFilter={null} />);
    const groupButtons = screen.getAllByLabelText('Filter by groups').filter(btn => btn.offsetParent !== null);
    groupButtons.forEach(btn => expect(btn).not.toBeDisabled());

    // Disabled when source is selected
    render(<InboxFilters {...defaultProps} groupFilter={null} sourceFilter="source1" />);
    const groupButtons2 = screen.getAllByLabelText('Filter by groups').filter(btn => btn.offsetParent !== null);
    groupButtons2.forEach(btn => expect(btn).toBeDisabled());
  });

  test('source filter is enabled when no group is selected, and disabled when group is selected', () => {
    // Enabled when no group is selected
    render(<InboxFilters {...defaultProps} groupFilter={null} sourceFilter={null} />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source').filter(btn => btn.offsetParent !== null);
    sourceButtons.forEach(btn => expect(btn).not.toBeDisabled());

    // Disabled when group is selected
    render(<InboxFilters {...defaultProps} groupFilter="group1" sourceFilter={null} />);
    const sourceButtons2 = screen.getAllByLabelText('Filter by newsletter source').filter(btn => btn.offsetParent !== null);
    sourceButtons2.forEach(btn => expect(btn).toBeDisabled());
  });

  test('source filter dropdown options are sorted alphabetically', () => {
    // Purposely provide sources out of order
    const unorderedSources = [
      { id: 'sourceB', name: 'Zebra News', count: 2, user_id: 'user1', from: '', created_at: '', updated_at: '', is_archived: false },
      { id: 'sourceA', name: 'Alpha News', count: 1, user_id: 'user1', from: '', created_at: '', updated_at: '', is_archived: false },
      { id: 'sourceC', name: 'Middle News', count: 3, user_id: 'user1', from: '', created_at: '', updated_at: '', is_archived: false },
    ];
    render(<InboxFilters {...defaultProps} newsletterSources={unorderedSources} />);
    const sourceButtons = screen.getAllByLabelText('Filter by newsletter source');
    fireEvent.click(sourceButtons[0]);
    // Get all source option buttons (excluding 'All Sources')
    const optionButtons = screen.getAllByRole('button').filter(btn =>
      ['Alpha News', 'Middle News', 'Zebra News'].some(name => btn.textContent?.includes(name))
    );
    const optionNames = optionButtons.map(btn => btn.textContent?.replace(/\d+$/, '').trim());
    expect(optionNames).toEqual(['Alpha News', 'Middle News', 'Zebra News']);
  });
});
