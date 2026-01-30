import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSourceSearch } from '../useSourceSearch';

// Mock the newsletterSourceService
vi.mock('@common/services/newsletterSource/NewsletterSourceService', () => ({
  newsletterSourceService: {
    getSources: vi.fn(),
  },
}));

import { newsletterSourceService } from '@common/services/newsletterSource/NewsletterSourceService';

// Mock data
const mockSearchResults = [
  { 
    id: '1', 
    name: 'Test Source 1', 
    from: 'test1@example.com',
    user_id: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('useSourceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSourceSearch());

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchError).toBe(null);
  });

  it('should not search when query is too short', () => {
    const { result } = renderHook(() => useSourceSearch({ minQueryLength: 3 }));

    act(() => {
      result.current.setSearchQuery('Te');
    });

    expect(newsletterSourceService.getSources).not.toHaveBeenCalled();
    expect(result.current.searchResults).toEqual([]);
  });

  it('should clear search', () => {
    const { result } = renderHook(() => useSourceSearch());

    act(() => {
      result.current.setSearchQuery('Test');
    });

    expect(result.current.searchQuery).toBe('Test');

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchResults).toEqual([]);
  });

  it('should trigger debounced search', () => {
    const mockGetSources = vi.mocked(newsletterSourceService.getSources);
    mockGetSources.mockResolvedValue({
      data: mockSearchResults,
      count: mockSearchResults.length,
      hasMore: false,
    });

    const { result } = renderHook(() => useSourceSearch({ minQueryLength: 2 }));

    act(() => {
      result.current.setSearchQuery('Test');
    });

    // Should not trigger immediately
    expect(mockGetSources).not.toHaveBeenCalled();

    // Fast-forward timer to trigger debounced search
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockGetSources).toHaveBeenCalledWith({
      search: 'Test',
      excludeArchived: false,
      limit: 50,
      orderBy: 'name',
      orderDirection: 'asc',
      includeCount: false,
    });
  });
});
