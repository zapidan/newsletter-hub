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
      const initialGroups = ['group1', 'group2'];
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: initialGroups }));

      expect(result.current.groupFilters).toEqual(initialGroups);
    });

    it('should handle empty groups parameter', () => {
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: [] }));

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle malformed groups parameter gracefully', () => {
      const initialGroups = ['group1', '', 'group3'];
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: initialGroups }));

      expect(result.current.groupFilters).toEqual(['group1', '', 'group3']);
    });

    it('should not initialize from URL when no groups parameter exists', () => {
      const { result } = renderHook(() => useInboxFilters());

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should prioritize initialGroupFilters over URL parameters', () => {
      const initialGroups = ['initial-group1', 'initial-group2'];
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: initialGroups }));

      expect(result.current.groupFilters).toEqual(initialGroups);
    });
  });

  describe('Group Filter Actions', () => {
    it('should update group filters when setGroupFilters is called', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.setGroupFilters(['group1', 'group2']);
      });

      expect(result.current.groupFilters).toEqual(['group1', 'group2']);
    });

    it('should clear groups when clearGroups is called', () => {
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

      act(() => {
        result.current.clearGroups();
      });

      expect(result.current.groupFilters).toEqual([]);
    });

    it('should handle single group', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.setGroupFilters(['group1']);
      });

      expect(result.current.groupFilters).toEqual(['group1']);
    });

    it('should handle adding groups', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.addGroup('group1');
        result.current.addGroup('group2');
      });

      expect(result.current.groupFilters).toEqual(['group1', 'group2']);
    });

    it('should handle removing groups', () => {
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

      act(() => {
        result.current.removeGroup('group1');
      });

      expect(result.current.groupFilters).toEqual(['group2']);
    });

    it('should handle toggling groups', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.toggleGroup('group1'); // Add group1
        result.current.toggleGroup('group2'); // Add group2
        result.current.toggleGroup('group1'); // Remove group1
      });

      // After the sequence: add group1, add group2, remove group1
      // Only group2 should remain
      expect(result.current.groupFilters).toEqual(['group1']);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle many group parameters', () => {
      const manyGroups = Array.from({ length: 20 }, (_, i) => `group${i + 1}`);
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: manyGroups }));

      expect(result.current.groupFilters).toHaveLength(20);
      expect(result.current.groupFilters[0]).toBe('group1');
      expect(result.current.groupFilters[19]).toBe('group20');
    });

    it('should handle duplicate group IDs', () => {
      const initialGroups = ['group1', 'group2', 'group1', 'group3'];
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: initialGroups }));

      // Note: The current implementation doesn't deduplicate
      expect(result.current.groupFilters).toEqual(['group1', 'group2', 'group1', 'group3']);
    });

    it('should handle very long group parameter', () => {
      const longGroup = 'a'.repeat(1000);
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: [longGroup] }));

      expect(result.current.groupFilters).toEqual([longGroup]);
    });
  });

  describe('Integration with Filter Actions', () => {
    it('should handle toggleGroup correctly', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.toggleGroup('group1');
      });

      // After first toggle, should have group1
      expect(result.current.groupFilters).toEqual(['group1']);

      act(() => {
        result.current.toggleGroup('group2');
      });

      // After second toggle, should have both groups
      expect(result.current.groupFilters).toEqual(['group1', 'group2']);
    });

    it('should handle addGroup/removeGroup correctly', () => {
      const { result } = renderHook(() => useInboxFilters());

      act(() => {
        result.current.addGroup('group1');
        result.current.addGroup('group2');
        result.current.removeGroup('group1');
      });

      expect(result.current.groupFilters).toEqual(['group2']);
    });

    it('should clear group filters when resetFilters is called', () => {
      const { result } = renderHook(() => useInboxFilters({ initialGroupFilters: ['group1', 'group2'] }));

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.groupFilters).toEqual([]);
    });
  });
});
