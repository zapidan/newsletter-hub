/**
 * @vitest-environment jsdom
 *
 * Unit-tests for FilterContext and the convenience hooks it exposes.
 * All previous timing/state issues were caused by a non-reactive mock
 * of `useInboxUrlParams`.  The mock below keeps its own React state
 * so every `updateParams` / `resetParams` call triggers a re-render
 * of the context provider, letting the assertions observe the changes.
 */
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FilterProvider,
  useFilters,
  useSourceFilter,
  useStatusFilter,
  useTagFilter,
  useTimeFilter,
} from '../FilterContext';

/* ────────────────────────────────────────────────────────────── *
 *  Reactive mock for `useInboxUrlParams`
 * ────────────────────────────────────────────────────────────── */
import { InboxFilterType } from '@common/hooks/useInboxFilters'; // Import the type

// Mock implementation state
interface MockParams {
  filter?: InboxFilterType;
  source?: string | null;
  time?: 'all' | 'day' | 'week' | 'month';
  tags?: string | string[];
}

let mockParams: MockParams = {};

const mockUpdateParams = vi.fn((updates: MockParams) => {
  mockParams = { ...mockParams, ...updates };
  return mockParams;
});

const mockResetParams = vi.fn(() => {
  mockParams = { filter: 'unread' }; // Reset to new default
  return { filter: 'unread' };
});

// Track the current mock state for assertions
interface MockState {
  filter: InboxFilterType;
  sourceFilter: string | null;
  timeRange: 'all' | 'day' | 'week' | 'month';
  tagIds: string[];
  hasActiveFilters: boolean;
}

let currentMockState: MockState = {
  filter: 'unread', // Initial default
  sourceFilter: null,
  timeRange: 'all',
  tagIds: [],
  hasActiveFilters: false, // Correctly false for default 'unread'
};

// Helper to update the mock state
const updateMockState = (updates: Partial<MockState>) => {
  // Ensure filter defaults to 'unread' if not specified in updates
  const newFilter = updates.filter === undefined && currentMockState.filter === undefined
    ? 'unread'
    : updates.filter !== undefined ? updates.filter : currentMockState.filter;

  currentMockState = {
    ...currentMockState,
    ...updates,
    filter: newFilter // Apply new default logic
  };

  currentMockState.hasActiveFilters =
    currentMockState.filter !== 'unread' || // Active if not 'unread'
    currentMockState.sourceFilter !== null ||
    currentMockState.timeRange !== 'all' ||
    currentMockState.tagIds.length > 0;

  // Sync mockParams with current state
  mockParams = {
    filter: currentMockState.filter !== 'unread' ? currentMockState.filter : undefined,
    source: currentMockState.sourceFilter || undefined,
    time: currentMockState.timeRange !== 'all' ? currentMockState.timeRange : undefined,
    tags: currentMockState.tagIds.length > 0 ? currentMockState.tagIds : undefined,
  };
};

vi.mock('@common/hooks/useUrlParams', () => {
  const React = require('react');

  const useInboxUrlParams = () => {
    /* keep params in React state so provider re-renders on updates */
    const [params, setParams] = React.useState(mockParams);

    const updateParams = (updates: MockParams) => {
      mockUpdateParams(updates);
      const tagIds = Array.isArray(updates.tags) ? updates.tags : updates.tags ? updates.tags.split(',') : [];
      updateMockState({
        filter: updates.filter,
        sourceFilter: updates.source,
        timeRange: updates.time || 'all',
        tagIds,
      });
      setParams((prev) => ({ ...prev, ...updates }));
    };

    const resetParams = () => {
      mockResetParams();
      updateMockState({
        filter: 'unread', // Ensure mock state also resets to 'unread'
        sourceFilter: null,
        timeRange: 'all',
        tagIds: [],
      });
      setParams({ filter: undefined }); // URL param for filter removed/undefined for default
    };

    // Mock setInitialParams
    const setInitialParams = (initialParams: MockParams) => {
      mockParams = initialParams;
      const tagIds = Array.isArray(initialParams.tags) ? initialParams.tags : initialParams.tags ? initialParams.tags.split(',') : [];
      setParams(initialParams);
      updateMockState({
        filter: initialParams.filter,
        sourceFilter: initialParams.source,
        timeRange: initialParams.time || 'all',
        tagIds,
      });
    };

    return { params, updateParams, resetParams, setInitialParams };
  };


  return { __esModule: true, useInboxUrlParams };
});

/* ────────────────────────────────────────────────────────────── *
 *  Helpers
 * ────────────────────────────────────────────────────────────── */
const createWrapper =
  (params: Record<string, any> = {}) =>
    ({ children }: { children: React.ReactNode }) => {
      const tagIds = Array.isArray(params.tags) ? params.tags : params.tags ? params.tags.split(',') : [];
      updateMockState({
        filter: params.filter,
        sourceFilter: params.source,
        timeRange: params.time,
        tagIds,
      });
      return <FilterProvider>{children}</FilterProvider>;
    };

const defaultWrapper = createWrapper();

describe('FilterContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to new defaults
    updateMockState({
      filter: 'unread',
      sourceFilter: null,
      timeRange: 'all',
      tagIds: [],
      hasActiveFilters: false, // Explicitly set for clarity
    });
    // mockParams should reflect default state (filter undefined)
    mockParams = { filter: undefined, source: undefined, time: undefined, tags: undefined };
    mockUpdateParams.mockClear();
    mockResetParams.mockClear();
  });

  /* ---------------------------------------------------------- */
  it('provides initial filter state', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });

    expect(result.current.filter).toBe('unread'); // Changed from 'all'
    expect(result.current.sourceFilter).toBeNull();
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  /* ---------------------------------------------------------- */
  it('initialises state from URL parameters', () => {
    const wrapper = createWrapper({
      /* component expects `filter`, not `status` */
      filter: 'unread',
      source: 'test-source',
      time: 'week',
      tags: ['tag1', 'tag2'],
    });

    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.filter).toBe('unread');
    expect(result.current.sourceFilter).toBe('test-source');
    expect(result.current.timeRange).toBe('week');
    expect(result.current.tagIds).toEqual(['tag1', 'tag2']);
  });

  /* ---------------------------------------------------------- */
  it('updates source filter', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });

    act(() => {
      result.current.setSourceFilter('source-1');
    });

    expect(result.current.sourceFilter).toBe('source-1');
    expect(mockUpdateParams).toHaveBeenCalledWith({ source: 'source-1' });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  /* ---------------------------------------------------------- */
  it('updates status filter from URL params', () => {
    const wrapper = createWrapper({ filter: 'unread' }); // Initializing with 'unread'
    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.filter).toBe('unread');
    // If 'unread' is the default, and no other filters are set, hasActiveFilters should be false.
    expect(result.current.hasActiveFilters).toBe(false);
    expect(mockUpdateParams).not.toHaveBeenCalled(); // Correct, as it's initialized via wrapper
  });

  /* ---------------------------------------------------------- */
  it('updates status filter via action', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper }); // Starts with 'unread' (default)

    // Setting to 'liked' (a non-default filter)
    act(() => {
      result.current.setFilter('liked');
    });

    expect(result.current.filter).toBe('liked');
    expect(result.current.hasActiveFilters).toBe(true); // 'liked' is an active filter
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'liked' });

    // Setting back to 'unread' (the default)
    act(() => {
      result.current.setFilter('unread');
    });
    expect(result.current.filter).toBe('unread');
    expect(result.current.hasActiveFilters).toBe(false); // Back to default, no other filters active
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'unread' }); // This will actually result in filter:undefined in URL
  });

  /* ---------------------------------------------------------- */
  it('resets all filters when `resetFilters` is called', () => {
    const wrapper = createWrapper({
      filter: 'unread',
      source: 'test-source',
      time: 'week',
      tags: ['tag1', 'tag2'],
    });

    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => result.current.resetFilters());

    expect(result.current.filter).toBe('unread'); // Changed from 'all'
    expect(result.current.sourceFilter).toBeNull();
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(mockResetParams).toHaveBeenCalled();
  });

  /* ---------------------------------------------------------- */
  /* ---------------------------------------------------------- */
  it('handles invalid time range values gracefully', () => {
    const wrapper = createWrapper({ time: 'invalid-range' });

    const { result } = renderHook(() => useFilters(), { wrapper });

    // SHOULD equal the raw value coming from the URL
    expect(result.current.timeRange).toBe('invalid-range');

    act(() => result.current.setTimeRange('week'));
    expect(result.current.timeRange).toBe('week');
    expect(mockUpdateParams).toHaveBeenCalledWith({ time: 'week' });
  });


  /* ---------------------------------------------------------- */
  it('updates time range through `useTimeFilter` hook', () => {
    const { result } = renderHook(
      () => ({ timeFilter: useTimeFilter(), filters: useFilters() }),
      { wrapper: defaultWrapper },
    );

    act(() => result.current.timeFilter.setTimeRange('week'));

    expect(result.current.filters.timeRange).toBe('week');
    expect(result.current.timeFilter.timeRange).toBe('week');
    expect(mockUpdateParams).toHaveBeenCalledWith({ time: 'week' });
  });

  /* ---------------------------------------------------------- */
  it('handles tag filter changes', () => {
    const { result } = renderHook(
      () => ({ tagFilter: useTagFilter(), filters: useFilters() }),
      { wrapper: defaultWrapper },
    );

    /* add two tags */
    act(() => result.current.tagFilter.setTagIds(['tag1', 'tag2']));
    expect(result.current.tagFilter.tagIds).toEqual(['tag1', 'tag2']);
    expect(mockUpdateParams).toHaveBeenCalledWith({ tags: ['tag1', 'tag2'] });

    /* toggle   – remove tag1 */
    act(() => result.current.tagFilter.toggleTag('tag1'));
    expect(result.current.tagFilter.tagIds).toEqual(['tag2']);
    expect(mockUpdateParams).toHaveBeenCalledWith({ tags: ['tag2'] });

    /* toggle again – add tag1 back */
    act(() => result.current.tagFilter.toggleTag('tag1'));
    expect(result.current.tagFilter.tagIds).toEqual(expect.arrayContaining(['tag1', 'tag2']));
  });

  /* ---------------------------------------------------------- */
  it('resets all filters via wrapper hooks', () => {
    const wrapper = createWrapper({
      filter: 'unread',
      source: 'test',
      time: 'week',
      tags: ['tag1'],
    });

    const { result } = renderHook(
      () => ({
        statusFilter: useStatusFilter(),
        sourceFilter: useSourceFilter(),
        timeFilter: useTimeFilter(),
        tagFilter: useTagFilter(),
        filters: useFilters(),
      }),
      { wrapper },
    );

    act(() => result.current.filters.resetFilters());

    expect(result.current.filters.filter).toBe('unread'); // Changed from 'all'
    expect(result.current.filters.sourceFilter).toBeNull();
    expect(result.current.filters.timeRange).toBe('all');
    expect(result.current.filters.tagIds).toEqual([]);
    expect(mockResetParams).toHaveBeenCalled();
  });

  /* ---------------------------------------------------------- */
  it('updates multiple filters at once', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });

    act(() => {
      result.current.updateFilters({
        filter: 'archived',
        sourceFilter: 'source-1',
        timeRange: 'week',
        tagIds: ['tag1', 'tag2'],
      });
    });

    expect(result.current.filter).toBe('archived');
    expect(result.current.sourceFilter).toBe('source-1');
    expect(result.current.timeRange).toBe('week');
    expect(result.current.tagIds).toEqual(['tag1', 'tag2']);
    expect(result.current.hasActiveFilters).toBe(true);

    expect(mockUpdateParams).toHaveBeenCalledWith({
      filter: 'archived',
      source: 'source-1',
      time: 'week',
      tags: ['tag1', 'tag2'],
    });
  });

  /* ---------------------------------------------------------- */
  it('toggles status filter with `useStatusFilter`', () => {
    const { result } = renderHook(
      () => ({ statusFilter: useStatusFilter(), filters: useFilters() }),
      { wrapper: defaultWrapper },
    );

    act(() => result.current.statusFilter.setFilter('unread')); // Set to default
    expect(result.current.filters.filter).toBe('unread');
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'unread' }); // Will result in filter:undefined in URL

    act(() => result.current.statusFilter.setFilter('liked')); // Set to non-default
    expect(result.current.filters.filter).toBe('liked');
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'liked' });
  });

  /* ---------------------------------------------------------- */
  it('keeps URL params in sync when filters change', () => {
    // supply initial params through the wrapper
    const wrapper = createWrapper({
      filter: 'unread',
      source: 'test-source',
      time: 'week',
      tags: ['tag1', 'tag2'],
    });

    const { result } = renderHook(() => useFilters(), { wrapper });

    /* initialisation from URL params */
    expect(result.current.filter).toBe('unread');

    /* user action */
    act(() => result.current.setFilter('archived'));

    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'archived' });
  });

  describe('newsletterFilter derivation', () => {
    it('should correctly derive newsletterFilter for status "unread"', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'unread' }) });
      expect(result.current.newsletterFilter.isRead).toBe(false);
      expect(result.current.newsletterFilter.isArchived).toBe(false);
    });

    it('should correctly derive newsletterFilter for status "liked"', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'liked' }) });
      expect(result.current.newsletterFilter.isLiked).toBe(true);
      expect(result.current.newsletterFilter.isArchived).toBe(false);
    });

    it('should correctly derive newsletterFilter for status "archived"', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'archived' }) });
      expect(result.current.newsletterFilter.isArchived).toBe(true);
    });

    // This test is no longer valid as "all" is not a filter state.
    // The default behavior (equivalent to old "all" but with isRead: false) is tested by "unread".
    // it('should correctly derive newsletterFilter for status "all"', () => {
    //   const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'all' }) });
    //   expect(result.current.newsletterFilter.isArchived).toBe(false);
    //   expect(result.current.newsletterFilter.isRead).toBeUndefined();
    //   expect(result.current.newsletterFilter.isLiked).toBeUndefined();
    // });

    it('should include sourceIds in newsletterFilter if sourceFilter is set', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ source: 'src-123' }) });
      expect(result.current.newsletterFilter.sourceIds).toEqual(['src-123']);
    });

    it('should include tagIds in newsletterFilter if set and useLocalTagFiltering is false', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FilterProvider useLocalTagFiltering={false}>{children}</FilterProvider>
      );
      const { result } = renderHook(() => useFilters(), { wrapper });
      act(() => {
        result.current.setTagIds(['tag1', 'tag2']);
      });
      expect(result.current.newsletterFilter.tagIds).toEqual(['tag1', 'tag2']);
    });

    it('should NOT include tagIds in newsletterFilter if useLocalTagFiltering is true', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FilterProvider useLocalTagFiltering={true}>{children}</FilterProvider>
      );
      const { result } = renderHook(() => useFilters(), { wrapper });
      act(() => {
        result.current.setTagIds(['tag1', 'tag2']);
      });
      expect(result.current.newsletterFilter.tagIds).toBeUndefined();
    });

    describe('timeRange to dateFrom derivation', () => {
      const systemTime = new Date('2024-03-15T12:00:00.000Z'); // Friday
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(systemTime);
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('should derive dateFrom for timeRange "day"', () => {
        const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ time: 'day' }) });
        // Start of the current day
        expect(new Date(result.current.newsletterFilter.dateFrom!)).toEqual(new Date('2024-03-15T00:00:00.000Z'));
      });

      it('should derive dateFrom for timeRange "week"', () => {
        const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ time: 'week' }) });
        // 7 days ago
        expect(new Date(result.current.newsletterFilter.dateFrom!)).toEqual(new Date('2024-03-08T12:00:00.000Z'));
      });

      it('should derive dateFrom for timeRange "month"', () => {
        const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ time: 'month' }) });
        // 1 month ago
        expect(new Date(result.current.newsletterFilter.dateFrom!)).toEqual(new Date('2024-02-15T12:00:00.000Z'));
      });

      it('should derive dateFrom for timeRange "2days"', () => {
        const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ time: '2days' }) });
        // 2 days ago
        expect(new Date(result.current.newsletterFilter.dateFrom!)).toEqual(new Date('2024-03-13T12:00:00.000Z'));
      });

      it('should not set dateFrom for timeRange "all"', () => {
        const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ time: 'all' }) });
        expect(result.current.newsletterFilter.dateFrom).toBeUndefined();
      });
    });
  });

  describe('hasActiveFilters and isFilterActive', () => {
    it('should correctly report no active filters initially (when filter is "unread")', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper }); // defaultWrapper initializes with 'unread'
      expect(result.current.hasActiveFilters).toBe(false); // 'unread' is default, so not active by itself
      expect(result.current.isFilterActive('filter')).toBe(false); // 'filter' itself is not a deviation from default
      expect(result.current.isFilterActive('sourceFilter')).toBe(false);
      expect(result.current.isFilterActive('timeRange')).toBe(false);
      expect(result.current.isFilterActive('tagIds')).toBe(false);
    });

    it('should correctly report active filters when set', () => {
      // Test with a non-default status filter
      let { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'liked', tags: ['tag1']}) });
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.isFilterActive('filter')).toBe(true); // 'liked' is a deviation
      expect(result.current.isFilterActive('tagIds')).toBe(true);

      // Test with default status filter ('unread') but other active filters
      ({ result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'unread', source: 'src-1' }) }));
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.isFilterActive('filter')).toBe(false); // 'unread' status is default
      expect(result.current.isFilterActive('sourceFilter')).toBe(true);

      ({ result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'unread', time: 'day' }) }));
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.isFilterActive('filter')).toBe(false);
      expect(result.current.isFilterActive('timeRange')).toBe(true);
    });
  });

  describe('Tag Actions', () => {
    it('toggleTag should add a tag if not present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });
      act(() => result.current.toggleTag('tag1'));
      expect(result.current.tagIds).toEqual(['tag1']);
    });

    it('toggleTag should remove a tag if present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ tags: ['tag1', 'tag2']}) });
      act(() => result.current.toggleTag('tag1'));
      expect(result.current.tagIds).toEqual(['tag2']);
    });

    it('addTag should add a tag if not present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });
      act(() => result.current.addTag('tag1'));
      expect(result.current.tagIds).toEqual(['tag1']);
    });

    it('addTag should not duplicate an existing tag', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ tags: ['tag1']}) });
      act(() => result.current.addTag('tag1'));
      expect(result.current.tagIds).toEqual(['tag1']);
    });

    it('removeTag should remove an existing tag', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ tags: ['tag1', 'tag2']}) });
      act(() => result.current.removeTag('tag1'));
      expect(result.current.tagIds).toEqual(['tag2']);
    });

    it('removeTag should do nothing if tag is not present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ tags: ['tag1']}) });
      act(() => result.current.removeTag('tagNonExistent'));
      expect(result.current.tagIds).toEqual(['tag1']);
    });

    it('clearTags should remove all tags', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ tags: ['tag1', 'tag2']}) });
      act(() => result.current.clearTags());
      expect(result.current.tagIds).toEqual([]);
    });
  });

  describe('onFilterChange callback', () => {
    it('should call onFilterChange when a filter is set', () => {
      const mockOnFilterChange = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FilterProvider onFilterChange={mockOnFilterChange}>{children}</FilterProvider>
      );
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => {
        result.current.setFilter('unread'); // Setting to current default
      });
      // onFilterChange is called on mount (1).
      // Setting to the same default 'unread' might not cause newsletterFilter string to change,
      // thus not triggering the callback again.
      // So, expecting 1 call initially after setting to default.
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
      let lastCallArgs = mockOnFilterChange.mock.calls[0]; // First call (mount)
      expect(lastCallArgs[0].filter).toBe('unread');
      expect(lastCallArgs[1].isRead).toBe(false);

      act(() => {
        result.current.setFilter('liked'); // Setting to a different filter
      });
      // Now it should be called again because 'liked' changes newsletterFilter. Total 2 calls.
      expect(mockOnFilterChange).toHaveBeenCalledTimes(2);
      lastCallArgs = mockOnFilterChange.mock.calls[1]; // Second call
      expect(lastCallArgs[0].filter).toBe('liked');
      expect(lastCallArgs[1].isLiked).toBe(true);
    });
  });
});
