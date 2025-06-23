/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInboxFilters } from '../useInboxFilters';

/* ─────────── hoisted mocks ─────────── */
const mocks = vi.hoisted(() => ({
  setFilter: vi.fn(),
  setSourceFilter: vi.fn(),
  setTimeRange: vi.fn(),
  setTagIds: vi.fn(),
  resetFilters: vi.fn(),
  getTags: vi.fn().mockResolvedValue([
    { id: 'tag1', name: 'Tag 1' },
    { id: 'tag2', name: 'Tag 2' },
  ]),
}));

vi.mock('@common/contexts/FilterContext', () => ({
  useFilters: () => ({
    filter: 'all',
    sourceFilter: null,
    timeRange: 'all',
    tagIds: [],
    newsletterFilter: {},

    setFilter: mocks.setFilter,
    setSourceFilter: mocks.setSourceFilter,
    setTimeRange: mocks.setTimeRange,
    setTagIds: mocks.setTagIds,
    resetFilters: mocks.resetFilters,
  }),
}));

vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({ getTags: mocks.getTags }),
}));

vi.mock('../useNewsletterSources', () => ({
  useNewsletterSources: () => ({ newsletterSources: [], isLoadingSources: false }),
}));

/* Stub the logger to avoid pulling in AuthContext */
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

/* ─────────── tests ─────────── */
describe('useInboxFilters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initialises with state coming from useFilters', () => {
    const { result } = renderHook(() => useInboxFilters({ autoLoadTags: false }));
    expect(result.current.filter).toBe('all');
    expect(result.current.sourceFilter).toBeNull();
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('debounces tag updates and eventually calls setTagIds', async () => {
    /**
     * No fake timers → we let real time pass but shrink the debounce to 20 ms
     * so the whole test still finishes in a few 10s of milliseconds.
     */
    const { result } = renderHook(() =>
      useInboxFilters({ debounceMs: 20, autoLoadTags: false }),
    );

    act(() => result.current.updateTagDebounced(['tag1']));

    // waitFor works because real timers are in use[8]
    await waitFor(() =>
      expect(result.current.debouncedTagIds).toEqual(['tag1']),
    );

    expect(mocks.setTagIds).toHaveBeenCalledTimes(1);
    expect(mocks.setTagIds).toHaveBeenCalledWith(['tag1']);
  });

  it('loads tags and toggles a tag via handleTagClick', async () => {
    const { result } = renderHook(() =>
      useInboxFilters({ debounceMs: 10 })   // small real-time debounce
    );

    // wait until mockGetTags resolves and the hook stores the tags
    await waitFor(() => expect(result.current.allTags.length).toBe(2));

    act(() => {
      result.current.handleTagClick('tag1');  // toggle Tag 1
    });

    // React re-render → pendingTagUpdates populated
    await waitFor(() =>
      expect(result.current.pendingTagUpdates).toEqual(['tag1'])
    );

    // debounce timer fires → debouncedTagIds populated
    await waitFor(() =>
      expect(result.current.debouncedTagIds).toEqual(['tag1'])
    );
  });
});
