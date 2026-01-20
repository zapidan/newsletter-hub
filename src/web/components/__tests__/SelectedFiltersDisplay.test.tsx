import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SelectedFiltersDisplay } from '../SelectedFiltersDisplay';

describe('SelectedFiltersDisplay', () => {
  const groups = [
    { id: 'group1', name: 'Work' },
    { id: 'group2', name: 'Personal' },
  ];

  test('renders nothing when no groups selected', () => {
    const onClearGroup = vi.fn();
    const onClearAll = vi.fn();
    const { container } = render(
      <SelectedFiltersDisplay selectedGroups={[]} groups={groups} onClearGroup={onClearGroup} onClearAll={onClearAll} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders chips for selected groups and allows clearing one', () => {
    const onClearGroup = vi.fn();
    const onClearAll = vi.fn();
    render(
      <SelectedFiltersDisplay selectedGroups={['group1']} groups={groups} onClearGroup={onClearGroup} onClearAll={onClearAll} />
    );

    expect(screen.getByTestId('selected-group-chip-group1')).toBeInTheDocument();

    // Click the clear button on the chip
    const chipClearBtn = screen.getByRole('button', { name: 'Remove Work filter' });
    fireEvent.click(chipClearBtn);
    expect(onClearGroup).toHaveBeenCalledWith('group1');

    // Clear all should not appear with only one selected
    expect(screen.queryByTestId('clear-all-groups')).not.toBeInTheDocument();
  });

  test('shows clear all when multiple groups selected and triggers handler', () => {
    const onClearGroup = vi.fn();
    const onClearAll = vi.fn();
    render(
      <SelectedFiltersDisplay selectedGroups={['group1', 'group2']} groups={groups} onClearGroup={onClearGroup} onClearAll={onClearAll} />
    );

    const clearAllBtn = screen.getByTestId('clear-all-groups');
    fireEvent.click(clearAllBtn);
    expect(onClearAll).toHaveBeenCalled();
  });
});
