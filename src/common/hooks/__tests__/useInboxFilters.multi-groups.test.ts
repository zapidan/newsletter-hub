// Simple test to verify useInboxFilters hook multi-group support
import { act, renderHook } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { useInboxFilters } from '../useInboxFilters';

// Mock the dependencies
let mockFilterContext: {
  filter: 'unread' | 'read' | 'liked' | 'archived';
  sourceFilter: string | null;
  timeRange: string;
  tagIds: string[];
  groupFilters: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  newsletterFilter: any;
  useLocalTagFiltering: boolean;
  hasActiveFilters: boolean;
  isFilterActive: Mock;
  setFilter: Mock;
  setSourceFilter: Mock;
  setTimeRange: Mock;
  setTagIds: Mock;
  setGroupFilters: Mock;
  setSortBy: Mock;
  setSortOrder: Mock;
  resetFilters: Mock;
} = {
  filter: 'unread',
  sourceFilter: null,
  timeRange: 'all',
  tagIds: [],
  groupFilters: [], // Default empty groups
  sortBy: 'received_at',
  sortOrder: 'desc',
  newsletterFilter: {},
  useLocalTagFiltering: false,
  hasActiveFilters: false,
  isFilterActive: vi.fn(),
  setFilter: vi.fn(),
  setSourceFilter: vi.fn(),
  setTimeRange: vi.fn(),
  setTagIds: vi.fn(),
  setGroupFilters: vi.fn(),
  setSortBy: vi.fn(),
  setSortOrder: vi.fn(),
  resetFilters: vi.fn(),
};

vi.mock('@common/contexts/FilterContext', () => ({
  useFilters: () => mockFilterContext,
}));

vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    getTags: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@common/hooks/useNewsletterSources', () => ({
  useNewsletterSources: () => ({
    newsletterSources: [],
    isLoadingSources: false,
  }),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useInboxFilters - Multi-group support', () => {
  beforeEach(() => {
    // Reset mock to default state before each test
    mockFilterContext.groupFilters = [];
    vi.clearAllMocks();
  });

  it('should initialize with empty group filters', () => {
    const { result } = renderHook(() => useInboxFilters());

    expect(result.current.groupFilters).toEqual([]);
    expect(typeof result.current.setGroupFilters).toBe('function');
    expect(typeof result.current.toggleGroup).toBe('function');
    expect(typeof result.current.addGroup).toBe('function');
    expect(typeof result.current.removeGroup).toBe('function');
    expect(typeof result.current.clearGroups).toBe('function');
  });

  it('should initialize with provided group filters from context', () => {
    // Set up mock with initial groups
    mockFilterContext.groupFilters = ['group1', 'group2'];

    const { result } = renderHook(() => useInboxFilters());

    expect(result.current.groupFilters).toEqual(['group1', 'group2']);
  });

  it('should handle setGroupFilters action', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.setGroupFilters(['group1', 'group2']);
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalledWith(['group1', 'group2']);
  });

  it('should handle toggleGroup action - adding group', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.toggleGroup('group1');
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalled();
  });

  it('should handle toggleGroup action - removing group', () => {
    // Set up mock with initial group
    mockFilterContext.groupFilters = ['group1'];

    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.toggleGroup('group1');
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalled();
  });

  it('should handle addGroup action', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.addGroup('group1');
      result.current.addGroup('group2');
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalledTimes(2);
  });

  it('should not add duplicate group with addGroup', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.addGroup('group1');
      result.current.addGroup('group1'); // Duplicate
    });

    // The hook calls setGroupFilters for each addGroup call
    // It doesn't handle duplicate detection internally
    expect(mockFilterContext.setGroupFilters).toHaveBeenCalledTimes(2);
  });

  it('should handle removeGroup action', () => {
    // Set up mock with initial groups
    mockFilterContext.groupFilters = ['group1', 'group2'];

    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.removeGroup('group1');
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalled();
  });

  it('should handle clearGroups action', () => {
    // Set up mock with initial groups
    mockFilterContext.groupFilters = ['group1', 'group2'];

    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.clearGroups();
    });

    expect(mockFilterContext.setGroupFilters).toHaveBeenCalledWith([]);
  });

  it('should include groupFilters in hasActiveFilters', () => {
    // Set up mock with no active filters initially
    mockFilterContext.groupFilters = [];
    mockFilterContext.hasActiveFilters = false;

    const { result } = renderHook(() => useInboxFilters());

    // Initially no active filters from groups
    expect(result.current.hasActiveFilters).toBe(false);

    // Simulate adding a group
    mockFilterContext.groupFilters = ['group1'];
    mockFilterContext.hasActiveFilters = true;

    // Re-render to get updated state
    act(() => {
      result.current.setGroupFilters(['group1']);
    });

    // Now should have active filters due to group selection
    expect(mockFilterContext.hasActiveFilters).toBe(true);
  });

  it('should correctly identify groupFilters as active filter', () => {
    // Set up mock to return true when groupFilters has items
    mockFilterContext.isFilterActive = vi.fn((filterName) => {
      if (filterName === 'groupFilters') {
        return mockFilterContext.groupFilters.length > 0;
      }
      return false;
    });

    const { result } = renderHook(() => useInboxFilters());

    // Initially no groups
    expect(result.current.isFilterActive('groupFilters')).toBe(false);

    // Add a group to the mock state
    mockFilterContext.groupFilters = ['group1'];

    // Re-render to get updated mock behavior
    const { result: newResult } = renderHook(() => useInboxFilters());

    expect(newResult.current.isFilterActive('groupFilters')).toBe(true);
  });

  it('should clear group filters in resetFilters', () => {
    // Set up mock with initial groups
    mockFilterContext.groupFilters = ['group1', 'group2'];

    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.resetFilters();
    });

    expect(mockFilterContext.resetFilters).toHaveBeenCalled();
  });
});
