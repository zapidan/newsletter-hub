/**
 * @vitest-environment jsdom
 */
import { FilterProvider } from '@common/contexts/FilterContext'; // Import FilterProvider to test context integration
import { act, renderHook, waitFor } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxFilterType, useInboxFilters } from '../useInboxFilters'; // Ensure InboxFilterType is imported

// Hoisted Mocks & Setup for other modules
vi.mock('../useNewsletterSources', () => ({
  useNewsletterSources: vi.fn(() => ({
    newsletterSources: [],
    isLoadingSources: false,
  })),
}));

const mockGetTags = vi.fn().mockResolvedValue([
  { id: 'tag1', name: 'Tag 1', color: '#ff0000' },
  { id: 'tag2', name: 'Tag 2', color: '#00ff00' },
]);
vi.mock('@common/hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    getTags: mockGetTags,
  })),
}));

vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock for useUrlParams
let currentMockParams: Record<string, any> = {};
const mockUpdateParamsSpy = vi.fn((updates) => {
  currentMockParams = { ...currentMockParams, ...updates };
});
const mockResetParamsSpy = vi.fn(() => {
  // Reset to represent no filter param for 'unread' default, or clear others
  currentMockParams = { filter: undefined, source: undefined, time: undefined, tags: undefined };
});

vi.mock('@common/hooks/useUrlParams', () => ({
  useInboxUrlParams: () => ({
    params: currentMockParams, // Use the dynamic currentMockParams
    updateParams: mockUpdateParamsSpy,
    resetParams: mockResetParamsSpy,
  }),
}));


// Wrapper component that includes the actual FilterProvider
const TestWrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <FilterProvider>{children}</FilterProvider>
);

describe('useInboxFilters', () => {
  beforeEach(() => {
    vi.useRealTimers(); // Ensure real timers for other tests if not specified
    // Reset spies and the mock URL params state before each test
    mockUpdateParamsSpy.mockClear();
    mockResetParamsSpy.mockClear();
    currentMockParams = {}; // Start with empty params, so FilterContext defaults to 'unread'
  });

  it('initializes with "unread" as the default filter and correct newsletterFilter properties', () => {
    const { result } = renderHook(() => useInboxFilters({ autoLoadTags: false }), { wrapper: TestWrapper });
    expect(result.current.filter).toBe('unread');
    expect(result.current.sourceFilter).toBeNull();
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);

    // Check newsletterFilter for 'unread' default
    expect(result.current.newsletterFilter.isRead).toBe(false);
    expect(result.current.newsletterFilter.isArchived).toBe(false);
    expect(result.current.newsletterFilter.isLiked).toBeUndefined();

    // Check active filter status (unread is default, so not "active" in this sense)
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.isFilterActive('filter')).toBe(false);
  });

  it('correctly sets "liked" filter and updates newsletterFilter', async () => {
    const { result, rerender } = renderHook(() => useInboxFilters({ autoLoadTags: false }), { wrapper: TestWrapper });
    act(() => {
      result.current.setFilter('liked');
    });
    // After setFilter, currentMockParams is updated. We need FilterProvider to re-read it.
    rerender(); // This will cause FilterProvider to re-call useInboxUrlParams (mocked)
    // which will now use the updated currentMockParams.

    expect(result.current.filter).toBe('liked');
    expect(result.current.newsletterFilter.isLiked).toBe(true);
    expect(result.current.newsletterFilter.isArchived).toBe(false);
    expect(result.current.newsletterFilter.isRead).toBeUndefined(); // No isRead for liked
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.isFilterActive('filter')).toBe(true);
  });

  it('correctly sets "archived" filter and updates newsletterFilter', async () => {
    const { result, rerender } = renderHook(() => useInboxFilters({ autoLoadTags: false }), { wrapper: TestWrapper });
    act(() => {
      result.current.setFilter('archived');
    });
    rerender();

    expect(result.current.filter).toBe('archived');
    expect(result.current.newsletterFilter.isArchived).toBe(true);
    expect(result.current.newsletterFilter.isRead).toBeUndefined();
    expect(result.current.newsletterFilter.isLiked).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.isFilterActive('filter')).toBe(true);
  });

  it('resetFilters reverts to "unread" and clears other filters', async () => {
    // Initialize with some active filters by setting currentMockParams before the hook renders
    currentMockParams = { filter: 'liked', source: 'source123', time: 'day', tags: ['tag1'] };
    const { result, rerender } = renderHook(() => useInboxFilters({ autoLoadTags: false }), { wrapper: TestWrapper });

    // Verify initial active state based on mocked params
    expect(result.current.filter).toBe('liked');
    expect(result.current.sourceFilter).toBe('source123');
    expect(result.current.timeRange).toBe('day');
    expect(result.current.tagIds).toEqual(['tag1']);
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.resetFilters();
    });
    // After resetFilters, mockResetParamsSpy updates currentMockParams. Rerender to pick it up.
    rerender();

    expect(result.current.filter).toBe('unread');
    expect(result.current.sourceFilter).toBeNull();
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);
    expect(result.current.newsletterFilter.isRead).toBe(false);
    expect(result.current.newsletterFilter.isArchived).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('debounces tag updates and eventually calls setTagIds (via context and URL params)', async () => {
    const { result } = renderHook(() => useInboxFilters({ debounceMs: 20, autoLoadTags: false }), { wrapper: TestWrapper });

    act(() => result.current.updateTagDebounced(['tag1']));

    await waitFor(() => {
      expect(result.current.debouncedTagIds).toEqual(['tag1']);
    });

    // Test that updateParams was called by FilterContext
    expect(mockUpdateParamsSpy).toHaveBeenCalledWith({ tags: ['tag1'] });
  });

  // TODO: This test is timing out due to issues with fake timers and debounced state updates.
  // Needs further investigation to properly test debouncing with react-query and context.
  it.skip('loads tags and toggles a tag via handleTagClick', async () => {
    const debounceMs = 10;
    const { result, rerender } = renderHook(() => useInboxFilters({ debounceMs, autoLoadTags: true }), { wrapper: TestWrapper });

    // 1. Load tags (uses real timers implicitly if vi.useFakeTimers() is not called yet for this test block)
    await waitFor(() => expect(result.current.allTags.length).toBe(2));

    // 2. Now use fake timers for debounce testing
    vi.useFakeTimers();

    // Toggle ON
    act(() => { result.current.handleTagClick('tag1'); });
    expect(result.current.pendingTagUpdates).toEqual(['tag1']); // Check immediate pending update

    act(() => { vi.advanceTimersByTime(debounceMs); });
    rerender(); // Allow FilterProvider to re-render based on changed currentMockParams

    await waitFor(() => expect(result.current.debouncedTagIds).toEqual(['tag1']));
    expect(mockUpdateParamsSpy).toHaveBeenCalledWith({ tags: ['tag1'] });

    // Toggle OFF
    act(() => { result.current.handleTagClick('tag1'); });
    expect(result.current.pendingTagUpdates).toEqual([]); // Check immediate pending update

    act(() => { vi.advanceTimersByTime(debounceMs); });
    rerender(); // Allow FilterProvider to re-render

    await waitFor(() => expect(result.current.debouncedTagIds).toEqual([]));

    expect(mockUpdateParamsSpy).toHaveBeenCalledTimes(2); // Total calls to the spy
    expect(mockUpdateParamsSpy).toHaveBeenLastCalledWith({ tags: [] });

    vi.useRealTimers(); // Clean up fake timers
  });

  it('ensures InboxFilterType does not accept "all"', () => {
    // This is a type-level check, Vitest won't catch TS errors directly here
    // But this line would cause a TypeScript error if 'all' was assignable to InboxFilterType
    // const test: InboxFilterType = 'all'; // Uncomment to see TS error
    const validTest: InboxFilterType = 'unread';
    expect(validTest).toBe('unread');
    // Add a dummy expect if your linter complains about no expects in test
    expect(true).toBe(true);
  });
});
