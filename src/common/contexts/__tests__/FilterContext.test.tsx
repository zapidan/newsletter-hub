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
// Mock implementation state
interface MockParams {
  filter?: 'all' | 'unread' | 'liked' | 'archived';
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
  mockParams = {};
  return {};
});

// Track the current mock state for assertions
interface MockState {
  filter: 'all' | 'unread' | 'liked' | 'archived';
  sourceFilter: string | null;
  timeRange: 'all' | 'day' | 'week' | 'month';
  tagIds: string[];
  hasActiveFilters: boolean;
}

let currentMockState: MockState = {
  filter: 'all',
  sourceFilter: null,
  timeRange: 'all',
  tagIds: [],
  hasActiveFilters: false,
};

// Helper to update the mock state
const updateMockState = (updates: Partial<MockState>) => {
  currentMockState = { ...currentMockState, ...updates };
  currentMockState.hasActiveFilters =
    currentMockState.filter !== 'all' ||
    currentMockState.sourceFilter !== null ||
    currentMockState.timeRange !== 'all' ||
    currentMockState.tagIds.length > 0;

  // Sync mockParams with current state
  mockParams = {
    filter: currentMockState.filter !== 'all' ? currentMockState.filter : undefined,
    source: currentMockState.sourceFilter || undefined,
    time: currentMockState.timeRange !== 'all' ? currentMockState.timeRange : undefined,
    // keep it an array so FilterProvider receives string[]
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
        filter: 'all',
        sourceFilter: null,
        timeRange: 'all',
        tagIds: [],
      });
      setParams({});
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
    updateMockState({
      filter: 'all',
      sourceFilter: null,
      timeRange: 'all',
      tagIds: [],
    });
    mockParams = {};
    mockUpdateParams.mockClear();
    mockResetParams.mockClear();
  });

  /* ---------------------------------------------------------- */
  it('provides initial filter state', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });

    expect(result.current.filter).toBe('all');
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
    const wrapper = createWrapper({ filter: 'unread' });
    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.filter).toBe('unread');
    expect(result.current.hasActiveFilters).toBe(true);
    expect(mockUpdateParams).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------- */
  it('updates status filter via action', () => {
    const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });

    act(() => {
      result.current.setFilter('unread');
    });

    expect(result.current.filter).toBe('unread');
    expect(result.current.hasActiveFilters).toBe(true);
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'unread' });
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

    expect(result.current.filter).toBe('all');
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

    expect(result.current.filters.filter).toBe('all');
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

    act(() => result.current.statusFilter.setFilter('unread'));
    expect(result.current.filters.filter).toBe('unread');
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'unread' });

    act(() => result.current.statusFilter.setFilter('all'));
    expect(result.current.filters.filter).toBe('all');
    expect(mockUpdateParams).toHaveBeenCalledWith({ filter: 'all' });
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

    it('should correctly derive newsletterFilter for status "all"', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'all' }) });
      expect(result.current.newsletterFilter.isArchived).toBe(false);
      expect(result.current.newsletterFilter.isRead).toBeUndefined();
      expect(result.current.newsletterFilter.isLiked).toBeUndefined();
    });

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
    it('should correctly report no active filters initially', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: defaultWrapper });
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.isFilterActive('filter')).toBe(false);
      expect(result.current.isFilterActive('sourceFilter')).toBe(false);
      expect(result.current.isFilterActive('timeRange')).toBe(false);
      expect(result.current.isFilterActive('tagIds')).toBe(false);
    });

    it('should correctly report active filters when set', () => {
      const { result } = renderHook(() => useFilters(), { wrapper: createWrapper({ filter: 'unread', tags: ['tag1']}) });
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.isFilterActive('filter')).toBe(true);
      expect(result.current.isFilterActive('sourceFilter')).toBe(false);
      expect(result.current.isFilterActive('timeRange')).toBe(false);
      expect(result.current.isFilterActive('tagIds')).toBe(true);
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
        result.current.setFilter('unread');
      });

      expect(mockOnFilterChange).toHaveBeenCalledTimes(2); // Once on mount, once on change
      const lastCallArgs = mockOnFilterChange.mock.calls[mockOnFilterChange.mock.calls.length - 1];
      expect(lastCallArgs[0].filter).toBe('unread'); // filterState
      expect(lastCallArgs[1].isRead).toBe(false); // newsletterFilter
    });
  });
});
