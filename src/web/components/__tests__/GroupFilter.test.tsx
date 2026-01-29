import { NewsletterGroup } from '@common/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupFilter from '../GroupFilter';

// Mock GroupBadgeList component
vi.mock('../GroupBadgeList', () => ({
  default: vi.fn(({ groups, activeGroupIds, variant, size, onGroupClick, onGroupRemove, maxVisible }) => (
    <div data-testid="group-badge-list-mock" data-variant={variant} data-size={size}>
      {groups.map((group: NewsletterGroup) => (
        <button
          key={group.id}
          data-testid={`group-badge-${group.id}`}
          data-active={activeGroupIds.includes(group.id)}
          onClick={() => onGroupClick?.(group.id)}
        >
          {group.name}
          {variant === 'filter' && (
            <button
              data-testid={`remove-${group.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onGroupRemove?.(group.id);
              }}
            >
              Remove
            </button>
          )}
        </button>
      ))}
    </div>
  )),
}));

describe('GroupFilter', () => {
  const mockGroups: NewsletterGroup[] = [
    {
      id: 'group1',
      name: 'Tech News',
      color: '#3B82F6',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
    {
      id: 'group2',
      name: 'Business',
      color: '#10B981',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
    {
      id: 'group3',
      name: 'Design',
      color: '#F59E0B',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
    {
      id: 'group4',
      name: 'Science',
      color: '#EF4444',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
    {
      id: 'group5',
      name: 'Sports',
      color: '#8B5CF6',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
    {
      id: 'group6',
      name: 'Politics',
      color: '#EC4899',
      user_id: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      sources: []
    },
  ];

  const defaultProps = {
    groups: mockGroups,
    activeGroupIds: [],
    onGroupFilterChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders group filter with header', () => {
      render(<GroupFilter {...defaultProps} />);

      expect(screen.getByText('Groups')).toBeInTheDocument();
      expect(screen.getByTestId('group-filter')).toBeInTheDocument();
    });

    it('renders all groups when no active filters', () => {
      render(<GroupFilter {...defaultProps} />);

      expect(screen.getByText('All Groups')).toBeInTheDocument();
      expect(screen.getByTestId('group-badge-list-mock')).toBeInTheDocument();
    });

    it('renders active filters section when groups are selected', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2']} />);

      expect(screen.getByText('Active Filters')).toBeInTheDocument();
      expect(screen.getByText('2 active')).toBeInTheDocument();
      expect(screen.getByText('More Groups')).toBeInTheDocument();
    });

    it('renders clear all button when active filters exist', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} />);

      expect(screen.getByTestId('clear-group-filters')).toBeInTheDocument();
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('does not render clear all button when no active filters', () => {
      render(<GroupFilter {...defaultProps} />);

      expect(screen.queryByTestId('clear-group-filters')).not.toBeInTheDocument();
    });
  });

  describe('Group Selection', () => {
    it('calls onGroupFilterChange when group is clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} onGroupFilterChange={mockOnChange} />);

      const groupBadge = screen.getByTestId('group-badge-group1');
      fireEvent.click(groupBadge);

      expect(mockOnChange).toHaveBeenCalledWith(['group1']);
    });

    it('adds group to active filters when clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} onGroupFilterChange={mockOnChange} />);

      const groupBadge = screen.getByTestId('group-badge-group2');
      fireEvent.click(groupBadge);

      expect(mockOnChange).toHaveBeenCalledWith(['group1', 'group2']);
    });

    it('removes group from active filters when active group is clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2']} onGroupFilterChange={mockOnChange} />);

      const groupBadge = screen.getByTestId('group-badge-group1');
      fireEvent.click(groupBadge);

      expect(mockOnChange).toHaveBeenCalledWith(['group2']);
    });

    it('removes group when remove button is clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2']} onGroupFilterChange={mockOnChange} />);

      const removeButton = screen.getByTestId('remove-group1');
      fireEvent.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith(['group2']);
    });

    it('clears all filters when clear all button is clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2', 'group3']} onGroupFilterChange={mockOnChange} />);

      const clearButton = screen.getByTestId('clear-group-filters');
      fireEvent.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Show More/Less Functionality', () => {
    it('shows show more button when groups exceed maxVisible', () => {
      render(<GroupFilter {...defaultProps} maxVisible={3} />);

      expect(screen.getByTestId('show-more-groups')).toBeInTheDocument();
      expect(screen.getByText(/Show 3 more groups/)).toBeInTheDocument();
    });

    it('does not show show more button when groups do not exceed maxVisible', () => {
      render(<GroupFilter {...defaultProps} maxVisible={10} />);

      expect(screen.queryByTestId('show-more-groups')).not.toBeInTheDocument();
    });

    it('expands to show all groups when show more is clicked', () => {
      render(<GroupFilter {...defaultProps} maxVisible={3} />);

      const showMoreButton = screen.getByTestId('show-more-groups');
      fireEvent.click(showMoreButton);

      expect(screen.getByTestId('show-less-groups')).toBeInTheDocument();
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('collapses when show less is clicked', () => {
      render(<GroupFilter {...defaultProps} maxVisible={3} />);

      // First expand
      const showMoreButton = screen.getByTestId('show-more-groups');
      fireEvent.click(showMoreButton);

      // Then collapse
      const showLessButton = screen.getByTestId('show-less-groups');
      fireEvent.click(showLessButton);

      expect(screen.getByTestId('show-more-groups')).toBeInTheDocument();
      expect(screen.queryByTestId('show-less-groups')).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state when isLoading is true', () => {
      render(<GroupFilter {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading groups...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows loading spinner', () => {
      render(<GroupFilter {...defaultProps} isLoading={true} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin', 'rounded-full', 'h-4', 'w-4', 'border-b-2', 'border-primary-600');
    });

    it('does not show group lists when loading', () => {
      render(<GroupFilter {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('All Groups')).not.toBeInTheDocument();
      expect(screen.queryByText('Active Filters')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('returns null when groups array is empty and not loading', () => {
      const { container } = render(<GroupFilter {...defaultProps} groups={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('shows loading state even when no groups', () => {
      render(<GroupFilter {...defaultProps} groups={[]} isLoading={true} />);

      expect(screen.getByText('Loading groups...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables clear all button when disabled', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} disabled={true} />);

      const clearButton = screen.getByTestId('clear-group-filters');
      expect(clearButton).toBeDisabled();
      expect(clearButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('disables show more/less buttons when disabled', () => {
      render(<GroupFilter {...defaultProps} maxVisible={3} disabled={true} />);

      const showMoreButton = screen.getByTestId('show-more-groups');
      expect(showMoreButton).toBeDisabled();
      expect(showMoreButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('does not call onGroupFilterChange when disabled and group is clicked', () => {
      const mockOnChange = vi.fn();
      render(<GroupFilter {...defaultProps} disabled={true} onGroupFilterChange={mockOnChange} />);

      const groupBadge = screen.getByTestId('group-badge-group1');
      fireEvent.click(groupBadge);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Active Filter Count', () => {
    it('shows correct count for single active filter', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} />);

      expect(screen.getByText('1 active')).toBeInTheDocument();
    });

    it('shows correct count for multiple active filters', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2', 'group3']} />);

      expect(screen.getByText('3 active')).toBeInTheDocument();
    });

    it('updates count when filters change', () => {
      const { rerender } = render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} />);

      expect(screen.getByText('1 active')).toBeInTheDocument();

      rerender(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2', 'group3', 'group4']} />);
      expect(screen.getByText('4 active')).toBeInTheDocument();
    });
  });

  describe('Custom Class Name', () => {
    it('applies custom class name', () => {
      render(<GroupFilter {...defaultProps} className="custom-class" />);

      const container = screen.getByTestId('group-filter');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Group Filtering Logic', () => {
    it('separates active and inactive groups correctly', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2']} />);

      // Should have two GroupBadgeList components: one for active, one for inactive
      const badgeLists = screen.getAllByTestId('group-badge-list-mock');
      expect(badgeLists).toHaveLength(2);

      // Active filters list should have variant="filter"
      expect(badgeLists[0]).toHaveAttribute('data-variant', 'filter');

      // Available groups list should have variant="default"
      expect(badgeLists[1]).toHaveAttribute('data-variant', 'default');
    });

    it('does not show active groups in available groups list', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1', 'group2']} />);

      // Check that active groups are not clickable in the "More Groups" section
      // This would be verified through the GroupBadgeList mock filtering
      expect(screen.getByTestId('group-badge-group1')).toHaveAttribute('data-active', 'true');
      expect(screen.getByTestId('group-badge-group2')).toHaveAttribute('data-active', 'true');
    });
  });

  describe('Accessibility', () => {
    it('has proper button types', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} maxVisible={3} />);

      expect(screen.getByTestId('clear-group-filters')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('show-more-groups')).toHaveAttribute('type', 'button');
    });

    it('has proper data-testid attributes for testing', () => {
      render(<GroupFilter {...defaultProps} activeGroupIds={['group1']} />);

      expect(screen.getByTestId('group-filter')).toBeInTheDocument();
      expect(screen.getByTestId('clear-group-filters')).toBeInTheDocument();
    });
  });
});
