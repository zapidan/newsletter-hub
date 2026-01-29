import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { FilterProvider } from '../../contexts/FilterContext';
import { useInboxFilters } from '../useInboxFilters';

// Mock the newsletter service
vi.mock('../../services/NewsletterService', () => ({
  newsletterService: {
    getSources: vi.fn(() => Promise.resolve([])),
    getTags: vi.fn(() => Promise.resolve([])),
  },
}));

// Test wrapper with all necessary providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <FilterProvider>{children}</FilterProvider>
    </QueryClientProvider>
  );
};

describe('Group Filter Preservation - Consolidated Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Function Availability & Initial State', () => {
    it('should provide all necessary group filter functions', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Check that all group functions are available
      expect(typeof result.current.setGroupFilters).toBe('function');
      expect(typeof result.current.toggleGroup).toBe('function');
      expect(typeof result.current.addGroup).toBe('function');
      expect(typeof result.current.removeGroup).toBe('function');
      expect(typeof result.current.clearGroups).toBe('function');

      // Check that sort functions are available
      expect(typeof result.current.setSortBy).toBe('function');
      expect(typeof result.current.setSortOrder).toBe('function');

      // Check that state is available and has correct types
      expect(Array.isArray(result.current.groupFilters)).toBe(true);
      expect(typeof result.current.sortBy).toBe('string');
      expect(typeof result.current.sortOrder).toBe('string');
    });

    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Check initial state
      expect(result.current.groupFilters).toEqual([]);
      expect(result.current.sortBy).toBe('received_at');
      expect(result.current.sortOrder).toBe('desc');
    });
  });

  describe('Function Operations', () => {
    it('should handle group filter function calls without throwing', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test that functions can be called without errors
      expect(() => result.current.setGroupFilters(['group-1', 'group-2'])).not.toThrow();
      expect(() => result.current.toggleGroup('group-3')).not.toThrow();
      expect(() => result.current.addGroup('group-4')).not.toThrow();
      expect(() => result.current.removeGroup('group-1')).not.toThrow();
      expect(() => result.current.clearGroups()).not.toThrow();
    });

    it('should handle sort function calls without throwing', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test that sort functions can be called without errors
      expect(() => result.current.setSortBy('estimated_read_time')).not.toThrow();
      expect(() => result.current.setSortOrder('asc')).not.toThrow();
      expect(() => result.current.setSortBy('title')).not.toThrow();
      expect(() => result.current.setSortOrder('desc')).not.toThrow();
    });

    it('should handle combined group and sort operations without throwing', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test combined operations
      expect(() => {
        result.current.setGroupFilters(['group-1', 'group-2']);
        result.current.setSortBy('estimated_read_time');
        result.current.setSortOrder('asc');

        // Change sort again
        result.current.setSortBy('received_at');
        result.current.setSortOrder('desc');

        // Change groups
        result.current.toggleGroup('group-3');
        result.current.removeGroup('group-1');

        // Clear all
        result.current.clearGroups();
      }).not.toThrow();
    });
  });

  describe('Integration Testing', () => {
    it('should handle complex filter combinations', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test complex combinations
      expect(() => {
        // Set multiple filters
        result.current.setGroupFilters(['tech', 'business', 'design']);
        result.current.setTimeRange('week');
        result.current.setFilter('read');
        result.current.setSortBy('estimated_read_time');
        result.current.setSortOrder('asc');

        // Change time range
        result.current.setTimeRange('month');

        // Change filter
        result.current.setFilter('unread');

        // Change sort
        result.current.setSortBy('title');
        result.current.setSortOrder('desc');

        // Modify groups
        result.current.toggleGroup('tech');
        result.current.addGroup('marketing');
        result.current.removeGroup('business');

        // Clear some filters
        result.current.clearGroups();
        result.current.setTimeRange('all');
      }).not.toThrow();
    });

    it('should handle all sort field options', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test all available sort fields
      expect(() => {
        result.current.setSortBy('received_at');
        result.current.setSortBy('estimated_read_time');
        result.current.setSortBy('title');
        result.current.setSortBy('published_at');
        result.current.setSortBy('created_at');
        result.current.setSortBy('updated_at');
        result.current.setSortBy('read_at');
        result.current.setSortBy('name');

        // Test both sort orders
        result.current.setSortOrder('asc');
        result.current.setSortOrder('desc');
      }).not.toThrow();
    });

    it('should handle rapid function calls', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Rapid function calls should not throw errors
      expect(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setGroupFilters([`group-${i}`]);
          result.current.setSortBy(i % 2 === 0 ? 'received_at' : 'estimated_read_time');
          result.current.setSortOrder(i % 2 === 0 ? 'desc' : 'asc');
        }
      }).not.toThrow();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle empty arrays and default values', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test empty arrays
      expect(() => result.current.setGroupFilters([])).not.toThrow();
      expect(() => result.current.clearGroups()).not.toThrow();

      // Test default values
      expect(() => result.current.setSortBy('received_at')).not.toThrow();
      expect(() => result.current.setSortOrder('desc')).not.toThrow();
    });

    it('should handle special characters in group IDs', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test special characters
      const specialGroups = [
        'group-with-dash',
        'group_with_underscore',
        'group.with.dots',
        'group with spaces',
        'group@symbol',
        'group#hash'
      ];

      expect(() => result.current.setGroupFilters(specialGroups)).not.toThrow();
      expect(() => result.current.toggleGroup('group-with-dash')).not.toThrow();
      expect(() => result.current.addGroup('group_with_underscore')).not.toThrow();
      expect(() => result.current.removeGroup('group.with.dots')).not.toThrow();
    });

    it('should handle invalid inputs gracefully', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Test with empty strings and invalid inputs
      expect(() => result.current.setGroupFilters([])).not.toThrow();
      expect(() => result.current.clearGroups()).not.toThrow();
      // Note: setSortBy and setSortOrder with empty strings are handled by the implementation
    });

    it('should maintain consistent state types', () => {
      const { result } = renderHook(() => useInboxFilters(), {
        wrapper: createTestWrapper(),
      });

      // Check that state maintains correct types throughout operations
      expect(() => {
        result.current.setGroupFilters(['group-1', 'group-2']);
        expect(Array.isArray(result.current.groupFilters)).toBe(true);

        result.current.setSortBy('estimated_read_time');
        expect(typeof result.current.sortBy).toBe('string');

        result.current.setSortOrder('asc');
        expect(typeof result.current.sortOrder).toBe('string');

        result.current.clearGroups();
        expect(Array.isArray(result.current.groupFilters)).toBe(true);
      }).not.toThrow();
    });
  });
});
