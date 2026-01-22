import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { InboxFilters } from '../../web/components/InboxFilters';

describe('InboxFilters dark mode dropdowns', () => {
  beforeEach(() => {
    document.documentElement.classList.add('dark');
  });

  const baseProps = {
    filter: 'unread' as const,
    sourceFilter: null as string | null,
    groupFilter: null as string | null,
    groupFilters: [] as string[],
    timeRange: 'all' as const,
    newsletterSources: [
      { id: 's1', name: 'Source A', count: 3, from: 'test', user_id: 'test', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's2', name: 'Source B', count: 0, from: 'test', user_id: 'test', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    newsletterGroups: [
      { id: 'g1', name: 'Group 1', count: 2 },
      { id: 'g2', name: 'Group 2', count: 0 },
    ],
    onFilterChange: () => { },
    onSourceFilterChange: () => { },
    onGroupFilterChange: () => { },
    onGroupFiltersChange: () => { },
    onTimeRangeChange: () => { },
    isLoading: false,
    isLoadingSources: false,
    isLoadingGroups: false,
    disabled: false,
    showTimeFilter: true,
    showSourceFilter: true,
    showGroupFilter: true,
    showFilterCounts: true,
  };

  it('applies dark classes to time select and source menu', () => {
    render(<InboxFilters {...baseProps} />);

    // Time select should include dark classes - use the first select element
    const timeSelect = screen.getAllByLabelText('Filter by time range')[0];
    expect(timeSelect).toBeInTheDocument();
    expect(timeSelect).toHaveClass('dark:bg-neutral-900');

    // Open source dropdown - there might be multiple, use the first one
    const sourceBtns = screen.getAllByRole('button', { name: 'Filter by newsletter source' });
    const sourceBtn = sourceBtns[0];
    fireEvent.click(sourceBtn);

    // Dropdown menu should be rendered with dark classes
    const menu = document.querySelector('.absolute.right-0.mt-1');
    expect(menu).toBeTruthy();
    if (menu) {
      expect(menu).toHaveClass('dark:bg-neutral-900');
      expect(menu).toHaveClass('dark:border-neutral-800');
    }
  });

  it('applies dark classes to the groups menu', () => {
    render(<InboxFilters {...baseProps} />);

    const groupBtns = screen.getAllByRole('button', { name: /filter by group/i });
    const trigger = groupBtns[groupBtns.length - 1] || groupBtns[0];
    fireEvent.click(trigger);

    const menu = document.querySelector('.absolute.right-0.mt-1');
    expect(menu).toBeTruthy();
    if (menu) {
      expect(menu).toHaveClass('dark:bg-neutral-900');
      expect(menu).toHaveClass('dark:border-neutral-800');
    }
  });
});
