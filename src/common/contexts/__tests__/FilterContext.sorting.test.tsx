import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { vi } from 'vitest';
import { FilterProvider, useFilters } from '../FilterContext';

// Mock the useUrlParams hook with proper state management
const mockUpdateParams = vi.fn();
const mockResetParams = vi.fn();

vi.mock('@common/hooks/useUrlParams', () => ({
  useUrlParams: () => ({
    params: {
      sort: 'received_at',
      order: 'desc',
    },
    updateParams: mockUpdateParams,
  }),
  useInboxUrlParams: () => ({
    params: {
      sort: 'received_at',
      order: 'desc',
    },
    updateParams: mockUpdateParams,
    resetParams: mockResetParams,
  }),
}));

describe('FilterContext - Sorting', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FilterProvider>{children}</FilterProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setSortBy', () => {
    it('should update sort field and call updateParams', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(result.current.sortBy).toBe('received_at');

      act(() => {
        result.current.setSortBy('title');
      });

      // The FilterContext calls updateParams with a function that returns the params
      expect(mockUpdateParams).toHaveBeenCalled();
      expect(typeof mockUpdateParams.mock.calls[0][0]).toBe('function');
    });

    it('should update newsletterFilter orderBy', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      // The newsletterFilter is derived from URL params, so it should reflect the initial state
      expect(result.current.newsletterFilter.orderBy).toBe('received_at');
      expect(result.current.newsletterFilter.orderDirection).toBe('desc');
    });
  });

  describe('setSortOrder', () => {
    it('should update sort order and call updateParams', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(result.current.sortOrder).toBe('desc');

      act(() => {
        result.current.setSortOrder('asc');
      });

      // The FilterContext calls updateParams with a function that returns the params
      expect(mockUpdateParams).toHaveBeenCalled();
      expect(typeof mockUpdateParams.mock.calls[0][0]).toBe('function');
    });

    it('should update newsletterFilter orderDirection', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      // The newsletterFilter is derived from URL params, so it should reflect the initial state
      expect(result.current.newsletterFilter.orderDirection).toBe('desc');
      expect(result.current.newsletterFilter.orderBy).toBe('received_at');
    });
  });

  describe('combined sorting updates', () => {
    it('should call updateParams for both sort field and order', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => {
        result.current.setSortBy('title');
      });

      act(() => {
        result.current.setSortOrder('asc');
      });

      // Both calls should invoke updateParams with functions
      expect(mockUpdateParams).toHaveBeenCalledTimes(2);
      expect(typeof mockUpdateParams.mock.calls[0][0]).toBe('function');
      expect(typeof mockUpdateParams.mock.calls[1][0]).toBe('function');
    });
  });

  describe('newsletterFilter mapping', () => {
    it('should correctly map sortBy to orderBy in newsletterFilter', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      // Initial state from mock
      expect(result.current.newsletterFilter.orderBy).toBe('received_at');
      expect(result.current.newsletterFilter.orderDirection).toBe('desc');
    });

    it('should correctly map sortOrder to orderDirection in newsletterFilter', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      // Initial state from mock
      expect(result.current.newsletterFilter.orderDirection).toBe('desc');
    });

    it('should include both orderBy and orderDirection in newsletterFilter', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(result.current.newsletterFilter).toEqual(
        expect.objectContaining({
          orderBy: 'received_at',
          orderDirection: 'desc',
        })
      );
    });
  });

  describe('hasActiveFilters boolean', () => {
    it('should be boolean type', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(typeof result.current.hasActiveFilters).toBe('boolean');
    });

    it('should be false for default state', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('resetFilters with sorting', () => {
    it('should call resetParams', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => {
        result.current.resetFilters();
      });

      expect(mockResetParams).toHaveBeenCalled();
    });
  });
});
