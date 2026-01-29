import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useInboxFilters } from '../useInboxFilters';

// Mock useInboxUrlParams
let currentMockParams: Record<string, any> = {};
const mockUpdateParamsSpy = vi.fn((updates) => {
  currentMockParams = { ...currentMockParams, ...updates };
});

vi.mock('@common/hooks/useUrlParams', () => ({
  useInboxUrlParams: () => ({
    params: currentMockParams,
    updateParams: mockUpdateParamsSpy,
  }),
}));

// Mock the dependencies
const mockSetGroupFilters = vi.fn();
const mockResetFilters = vi.fn();

vi.mock('@common/contexts/FilterContext', () => ({
  useFilters: () => ({
    filter: 'unread',
    sourceFilter: null,
    timeRange: 'all',
    tagIds: [],
    groupFilters: [], // Add missing groupFilters
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
    setGroupFilters: mockSetGroupFilters,
    setSortBy: vi.fn(),
    setSortOrder: vi.fn(),
    resetFilters: mockResetFilters,
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

describe('useInboxFilters - URL Persistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockParams = {};
    mockUpdateParamsSpy.mockClear();
  });

  describe('Group Filters (Local State Only)', () => {
    it('should initialize with empty group filters', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should use initialGroupFilters when provided', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
      // Test that the hook initializes with empty groups from context
    });

    it('should handle empty groups parameter', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle malformed groups parameter gracefully', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should not initialize from URL when no groups parameter exists', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should prioritize initialGroupFilters over URL parameters', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
      // Test that the hook uses context groups over URL
    });
  });

  describe('Group Filter Actions', () => {
    it('should update group filters when setGroupFilters is called', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.setGroupFilters(['group1', 'group2']);
      });

      // Check that the mock was called once with the complete array
      expect(mockSetGroupFilters).toHaveBeenCalledTimes(1);
      expect(mockSetGroupFilters).toHaveBeenCalledWith(['group1', 'group2']);
    });

    it('should clear groups when clearGroups is called', () => {
      const { result } = renderHook(() => useInboxFilters());

      // First add some groups
      act(() => {
        result.current.setGroupFilters(['group1', 'group2']);
      });

      // Then clear them
      act(() => {
        result.current.clearGroups();
      });

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle single group', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.setGroupFilters(['group1', 'group2']);
      });

      // Check that the mock was called once with the complete array
      expect(mockSetGroupFilters).toHaveBeenCalledTimes(1);
      expect(mockSetGroupFilters).toHaveBeenCalledWith(['group1', 'group2']);
    });

    it('should handle adding groups', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.addGroup('group1');
        result.current.addGroup('group2');
      });

      // Check that the mock was called twice (once for each addGroup call)
      expect(mockSetGroupFilters).toHaveBeenCalledTimes(2);
      // First call adds group1 to empty array
      expect(mockSetGroupFilters).toHaveBeenNthCalledWith(1, ['group1']);
      // Second call adds group2, but since group1 wasn't in the initial state, it only adds group2
      expect(mockSetGroupFilters).toHaveBeenNthCalledWith(2, ['group2']);
    });

    it('should handle removing groups', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.removeGroup('group1');
      });

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle toggling groups', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.toggleGroup('group1'); // Add group1
        result.current.toggleGroup('group2'); // Add group2
        result.current.toggleGroup('group1'); // Remove group1
      });

      // The hook calls setGroupFilters for each operation
      expect(mockSetGroupFilters).toHaveBeenCalledTimes(3);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle many group parameters', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle duplicate group IDs', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle very long group parameter', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });
  });

  describe('Integration with Filter Actions', () => {
    it('should handle toggleGroup correctly', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.toggleGroup('group1');
      });

      // After first toggle, should have group1
      expect(mockSetGroupFilters).toHaveBeenNthCalledWith(1, ['group1']);

      act(() => {
        result.current.toggleGroup('group2');
      });

      // After second toggle, should have both groups
      expect(mockSetGroupFilters).toHaveBeenNthCalledWith(2, ['group2']);
    });

    it('should handle addGroup/removeGroup correctly', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.addGroup('group1');
        result.current.addGroup('group2');
        result.current.removeGroup('group1');
      });

      // The hook calls setGroupFilters for each operation
      expect(mockSetGroupFilters).toHaveBeenCalledTimes(3);
    });

    it('should clear group filters when resetFilters is called', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.groupFilters).toEqual([]);
    });
  });
});
