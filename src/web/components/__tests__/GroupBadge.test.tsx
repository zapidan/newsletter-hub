import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupBadge from '../GroupBadge';

describe('GroupBadge', () => {
  const defaultProps = {
    id: 'test-group-1',
    name: 'Test Group',
    color: '#3B82F6',
  };

  it('renders group badge with correct name', () => {
    render(<GroupBadge {...defaultProps} />);
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('applies correct color styling', () => {
    render(<GroupBadge {...defaultProps} />);
    const badge = screen.getByTestId('group-badge-test-group-1');
    expect(badge).toHaveStyle({
      backgroundColor: '#3B82F6CC',
      color: '#3B82F6',
    });
  });

  it('shows active state when isActive is true', () => {
    render(<GroupBadge {...defaultProps} isActive={true} />);
    const badge = screen.getByTestId('group-badge-test-group-1');
    expect(badge).toHaveAttribute('data-active', 'true');
    expect(badge).toHaveStyle({
      backgroundColor: '#3B82F6FF',
      color: '#FFFFFF',
    });
  });

  it('handles click events when clickable', () => {
    const handleClick = vi.fn();
    render(<GroupBadge {...defaultProps} onClick={handleClick} />);

    const badge = screen.getByTestId('group-badge-test-group-1');
    fireEvent.click(badge);

    expect(handleClick).toHaveBeenCalledWith('test-group-1');
  });

  it('does not handle click when not clickable', () => {
    const handleClick = vi.fn();
    render(<GroupBadge {...defaultProps} isClickable={false} onClick={handleClick} />);

    const badge = screen.getByTestId('group-badge-test-group-1');
    fireEvent.click(badge);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows remove button in filter variant', () => {
    const handleRemove = vi.fn();
    render(
      <GroupBadge
        {...defaultProps}
        variant="filter"
        onRemove={handleRemove}
      />
    );

    const removeButton = screen.getByTestId('group-badge-remove-test-group-1');
    expect(removeButton).toBeInTheDocument();

    fireEvent.click(removeButton);
    expect(handleRemove).toHaveBeenCalledWith('test-group-1');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<GroupBadge {...defaultProps} size="sm" />);
    let badge = screen.getByTestId('group-badge-test-group-1');
    expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');

    rerender(<GroupBadge {...defaultProps} size="md" />);
    badge = screen.getByTestId('group-badge-test-group-1');
    expect(badge).toHaveClass('px-3', 'py-1', 'text-sm');

    rerender(<GroupBadge {...defaultProps} size="lg" />);
    badge = screen.getByTestId('group-badge-test-group-1');
    expect(badge).toHaveClass('px-4', 'py-1.5', 'text-base');
  });
});
