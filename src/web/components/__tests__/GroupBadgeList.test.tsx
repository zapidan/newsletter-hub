import { NewsletterGroup } from '@common/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupBadgeList from '../GroupBadgeList';

describe('GroupBadgeList', () => {
  const mockGroups: NewsletterGroup[] = [
    { id: 'group-1', name: 'Tech', color: '#3B82F6', user_id: 'user-1', created_at: '2023-01-01', updated_at: '2023-01-01' },
    { id: 'group-2', name: 'News', color: '#10B981', user_id: 'user-1', created_at: '2023-01-01', updated_at: '2023-01-01' },
    { id: 'group-3', name: 'Business', color: '#F59E0B', user_id: 'user-1', created_at: '2023-01-01', updated_at: '2023-01-01' },
  ];

  it('renders all groups when no maxVisible is set', () => {
    render(<GroupBadgeList groups={mockGroups} />);

    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
  });

  it('limits visible groups with maxVisible prop', () => {
    render(<GroupBadgeList groups={mockGroups} maxVisible={2} />);

    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.queryByText('Business')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('highlights active groups', () => {
    render(
      <GroupBadgeList
        groups={mockGroups}
        activeGroupIds={['group-1', 'group-3']}
      />
    );

    const techBadge = screen.getByTestId('group-badge-group-1');
    const newsBadge = screen.getByTestId('group-badge-group-2');
    const businessBadge = screen.getByTestId('group-badge-group-3');

    expect(techBadge).toHaveAttribute('data-active', 'true');
    expect(newsBadge).toHaveAttribute('data-active', 'false');
    expect(businessBadge).toHaveAttribute('data-active', 'true');
  });

  it('handles group clicks', () => {
    const handleClick = vi.fn();
    render(<GroupBadgeList groups={mockGroups} onGroupClick={handleClick} />);

    fireEvent.click(screen.getByTestId('group-badge-group-2'));
    expect(handleClick).toHaveBeenCalledWith('group-2');
  });

  it('shows add button when showAddButton is true', () => {
    const handleAdd = vi.fn();
    render(
      <GroupBadgeList
        groups={mockGroups}
        showAddButton={true}
        onAddGroup={handleAdd}
      />
    );

    const addButton = screen.getByTestId('add-group-filter-button');
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(handleAdd).toHaveBeenCalled();
  });

  it('applies correct variant styling', () => {
    render(
      <GroupBadgeList
        groups={mockGroups}
        activeGroupIds={['group-1']}
        variant="filter"
      />
    );

    const activeBadge = screen.getByTestId('group-badge-group-1');
    expect(activeBadge).toHaveAttribute('data-variant', 'filter');
    expect(activeBadge).toHaveAttribute('data-active', 'true');
  });

  it('handles group removal in filter variant', () => {
    const handleRemove = vi.fn();
    render(
      <GroupBadgeList
        groups={mockGroups}
        activeGroupIds={['group-1']}
        variant="filter"
        onGroupRemove={handleRemove}
      />
    );

    const removeButton = screen.getByTestId('group-badge-remove-group-1');
    fireEvent.click(removeButton);

    expect(handleRemove).toHaveBeenCalledWith('group-1');
  });
});
