// Simple test to verify useInboxFilters hook multi-group support
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useInboxFilters } from '../useInboxFilters';

// Mock the dependencies
vi.mock('@common/contexts/FilterContext', () => ({
  useFilters: () => ({
    filter: 'unread',
    sourceFilter: null,
    timeRange: 'all',
    tagIds: [],
    newsletterFilter: {},
    useLocalTagFiltering: false,
    setFilter: vi.fn(),
    setSourceFilter: vi.fn(),
    setTimeRange: vi.fn(),
    setTagIds: vi.fn(),
    resetFilters: vi.fn(),
  }),
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
  it('should initialize with empty group filters', () => {
    const { result } = renderHook(() => useInboxFilters());

    expect(result.current.groupFilters).toEqual([]);
    expect(typeof result.current.setGroupFilters).toBe('function');
    expect(typeof result.current.toggleGroup).toBe('function');
    expect(typeof result.current.addGroup).toBe('function');
    expect(typeof result.current.removeGroup).toBe('function');
    expect(typeof result.current.clearGroups).toBe('function');
  });

  it('should initialize with provided initial group filters', () => {
    const initialGroups = ['group1', 'group2'];
    const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: initialGroups }));

    expect(result.current.groupFilters).toEqual(initialGroups);
  });

  it('should handle setGroupFilters action', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.setGroupFilters(['group1', 'group2']);
    });

    expect(result.current.groupFilters).toEqual(['group1', 'group2']);
  });

  it('should handle toggleGroup action - adding group', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.toggleGroup('group1');
    });

    expect(result.current.groupFilters).toEqual(['group1']);
  });

  it('should handle toggleGroup action - removing group', () => {
    const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1'] }));

    act(() => {
      result.current.toggleGroup('group1');
    });

    expect(result.current.groupFilters).toEqual([]);
  });

  it('should handle addGroup action', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.addGroup('group1');
      result.current.addGroup('group2');
    });

    expect(result.current.groupFilters).toEqual(['group1', 'group2']);
  });

  it('should not add duplicate group with addGroup', () => {
    const { result } = renderHook(() => useInboxFilters());

    act(() => {
      result.current.addGroup('group1');
      result.current.addGroup('group1'); // Duplicate
    });

    expect(result.current.groupFilters).toEqual(['group1']);
  });

  it('should handle removeGroup action', () => {
    const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

    act(() => {
      result.current.removeGroup('group1');
    });

    expect(result.current.groupFilters).toEqual(['group2']);
  });

  it('should handle clearGroups action', () => {
    const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

    act(() => {
      result.current.clearGroups();
    });

    expect(result.current.groupFilters).toEqual([]);
  });

  it('should include groupFilters in hasActiveFilters', () => {
    const { result } = renderHook(() => useInboxFilters());

    // Initially no active filters from groups
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.addGroup('group1');
    });

    // Now should have active filters due to group selection
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('should correctly identify groupFilters as active filter', () => {
    const { result } = renderHook(() => useInboxFilters());

    expect(result.current.isFilterActive('groupFilters')).toBe(false);

    act(() => {
      result.current.addGroup('group1');
    });

    expect(result.current.isFilterActive('groupFilters')).toBe(true);
  });

  it('should clear group filters in resetFilters', () => {
    const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

    expect(result.current.groupFilters).toEqual(['group1', 'group2']);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.groupFilters).toEqual([]);
  });
});
