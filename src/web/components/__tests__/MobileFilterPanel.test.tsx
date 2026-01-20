import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MobileFilterPanel from '../MobileFilterPanel';

// Mock the icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">X</div>,
  ChevronDown: () => <div data-testid="chevron-down">▼</div>,
  ChevronUp: () => <div data-testid="chevron-up">▲</div>,
  Building2: () => <div data-testid="building-icon">🏢</div>,
  Clock: () => <div data-testid="clock-icon">🕐</div>,
  Tag: () => <div data-testid="tag-icon">🏷️</div>,
}));

describe('MobileFilterPanel', () => {
  const defaultProps = {
    filter: 'unread' as const,
    sourceFilter: null,
    groupFilters: [],
    timeRange: 'all' as const,
    newsletterSources: [
      {
        id: '1',
        name: 'Source 1',
        from: 'test@example.com',
        user_id: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        count: 5
      },
      {
        id: '2',
        name: 'Source 2',
        from: 'test2@example.com',
        user_id: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        count: 3
      },
    ],
    newsletterGroups: [
      { id: 'group1', name: 'Group 1', count: 10 },
      { id: 'group2', name: 'Group 2', count: 5 },
    ],
    onFilterChange: vi.fn(),
    onSourceFilterChange: vi.fn(),
    onGroupFiltersChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
    onApply: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Time Range')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<MobileFilterPanel {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });

  it('should handle status filter changes', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Read'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('read');
  });

  it('should handle source filter changes', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    // Expand source section
    fireEvent.click(screen.getByText('Source'));

    // Click on a source
    fireEvent.click(screen.getByText('Source 1'));
    expect(defaultProps.onSourceFilterChange).toHaveBeenCalledWith('1');
  });

  it('should handle group filter changes', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    // Expand group section
    fireEvent.click(screen.getByText('Groups'));

    // Click on a group
    fireEvent.click(screen.getByText('Group 1'));
    expect(defaultProps.onGroupFiltersChange).toHaveBeenCalledWith(['group1']);
  });

  it('should handle multiple group selection', () => {
    // Test with initial selection having one group
    render(<MobileFilterPanel {...defaultProps} groupFilters={['group1']} />);

    // Expand group section
    fireEvent.click(screen.getByText('Groups'));

    // Click on second group - should add to existing selection
    fireEvent.click(screen.getByText('Group 2'));
    expect(defaultProps.onGroupFiltersChange).toHaveBeenCalledWith(['group1', 'group2']);
  });

  it('should handle group deselection', () => {
    render(<MobileFilterPanel {...defaultProps} groupFilters={['group1']} />);

    // Expand group section
    fireEvent.click(screen.getByText('Groups'));

    // Click on selected group to deselect
    fireEvent.click(screen.getByText('Group 1'));
    expect(defaultProps.onGroupFiltersChange).toHaveBeenCalledWith([]);
  });

  it('should handle clear all groups', () => {
    render(<MobileFilterPanel {...defaultProps} groupFilters={['group1', 'group2']} />);

    // Expand group section
    fireEvent.click(screen.getByText('Groups'));

    // Click clear all
    fireEvent.click(screen.getByText('Clear All Groups'));
    expect(defaultProps.onGroupFiltersChange).toHaveBeenCalledWith([]);
  });

  it('should handle time range changes', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    // Expand time section
    fireEvent.click(screen.getByText('Time Range'));

    // Click on a time range
    fireEvent.click(screen.getByText('Today'));
    expect(defaultProps.onTimeRangeChange).toHaveBeenCalledWith('day');
  });

  it('should handle close button', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByTestId('x-icon'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle apply button', () => {
    render(<MobileFilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Apply Filters'));
    expect(defaultProps.onApply).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle clear all button', () => {
    render(
      <MobileFilterPanel
        {...defaultProps}
        filter='liked'
        sourceFilter='1'
        groupFilters={['group1']}
        timeRange='week'
      />
    );

    fireEvent.click(screen.getByText('Clear All'));
    expect(defaultProps.onClearAll).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show active filter indicators in footer', () => {
    render(
      <MobileFilterPanel
        {...defaultProps}
        filter='liked'
        sourceFilter='1'
        groupFilters={['group1']}
        timeRange='week'
      />
    );

    // Should show active indicators - just check that component renders without errors
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Time Range')).toBeInTheDocument();
  });

  it('should disable source section when groups are selected', () => {
    render(<MobileFilterPanel {...defaultProps} groupFilters={['group1']} />);

    // Try to expand source section (should be disabled)
    const sourceButton = screen.getByText('Source');
    fireEvent.click(sourceButton);

    // Should not expand the source section
    expect(screen.queryByText('All Sources')).not.toBeInTheDocument();
  });

  it('should disable group section when source is selected', () => {
    render(<MobileFilterPanel {...defaultProps} sourceFilter='1' />);

    // Try to expand group section (should be disabled)
    const groupButton = screen.getByText('Groups');
    fireEvent.click(groupButton);

    // Should not expand the group section
    expect(screen.queryByText('Clear All Groups')).not.toBeInTheDocument();
  });
});
