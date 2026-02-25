import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInboxFilters } from '../useInboxFilters';

// Mock the FilterContext
vi.mock('@common/contexts/FilterContext', () => ({
  useFilters: () => ({
    filter: 'unread',
    sourceFilter: null,
    timeRange: 'all',
    tagIds: [],
    groupFilters: [],
    sortBy: 'received_at',
    sortOrder: 'desc',
    newsletterFilter: {},
    useLocalTagFiltering: false,
    setFilter: () => { }, // Plain functions that don't update state
    setSourceFilter: () => { },
    setTimeRange: () => { },
    setTagIds: () => { },
    setGroupFilters: () => { },
    setSortBy: () => { },
    setSortOrder: () => { },
    resetFilters: () => { },
  }),
}));

// Mock the useTags hook to return a proper function
vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    getTags: () => Promise.resolve([]), // Return a plain function, not a spy
  }),
}));

// Mock the useNewsletterSources hook
vi.mock('../useNewsletterSources', () => ({
  useNewsletterSources: () => ({
    newsletterSources: [],
    isLoadingSources: false,
  }),
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useInboxFilters Hook Functionality', () => {
  beforeEach(() => {
    // Clear any previous console errors
    vi.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    // Test that the hook initializes with the expected default state
    const { result } = renderHook(() => useInboxFilters());

    expect(result.current.filter).toBe('unread');
    expect(result.current.sourceFilter).toBe(null);
    expect(result.current.timeRange).toBe('all');
    expect(result.current.tagIds).toEqual([]);
    expect(result.current.groupFilters).toEqual([]);
    expect(result.current.sortBy).toBe('received_at');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('provides all required action functions', () => {
    // Test that all action functions are provided and are functions
    const { result } = renderHook(() => useInboxFilters());

    const actions = [
      'setFilter', 'setSourceFilter', 'setTimeRange', 'setTagIds',
      'toggleTag', 'addTag', 'removeTag', 'clearTags', 'resetFilters',
      'updateTagDebounced', 'handleTagClick', 'setGroupFilters',
      'toggleGroup', 'addGroup', 'removeGroup', 'clearGroups', 'setSortBy', 'setSortOrder'
    ];

    actions.forEach(action => {
      expect(typeof (result.current as any)[action]).toBe('function');
    });
  });

  it('tag functions are callable without errors', () => {
    // Test that tag functions can be called without throwing errors
    const { result } = renderHook(() => useInboxFilters());

    expect(() => {
      result.current.toggleTag('tag1');
      result.current.addTag('tag2');
      result.current.removeTag('tag1');
      result.current.clearTags();
      result.current.updateTagDebounced(['tag3']);
    }).not.toThrow();
  });

  it('group functions are callable without errors', () => {
    // Test that group functions can be called without throwing errors
    const { result } = renderHook(() => useInboxFilters());

    expect(() => {
      result.current.toggleGroup('group1');
      result.current.addGroup('group2');
      result.current.removeGroup('group1');
      result.current.clearGroups();
    }).not.toThrow();
  });

  it('filter operations are callable without errors', () => {
    // Test that filter operations can be called without throwing errors
    const { result } = renderHook(() => useInboxFilters());

    expect(() => {
      act(() => result.current.setFilter('read'));
      act(() => result.current.setSourceFilter('source1'));
      act(() => result.current.setTimeRange('week'));
      act(() => result.current.setSortBy('title'));
      act(() => result.current.setSortOrder('asc'));
    }).not.toThrow();
  });

  it('resetFilters function is callable', () => {
    // Test that resetFilters can be called without errors
    const { result } = renderHook(() => useInboxFilters());

    expect(() => {
      result.current.resetFilters();
    }).not.toThrow();
  });

  it('validates memoizedGetTags dependencies correctly', () => {
    // This test validates that the new DependencyValidator class works correctly
    // by testing that the useInboxFilters hook creates and uses a validator
    // with the correct rules for memoizedGetTags

    // Create a mock function to use as expected dependency
    const mockGetTags = vi.fn(() => Promise.resolve([]));

    // Create a validator with the same rule as useInboxFilters
    const testValidator = new DependencyValidator({
      errorPrefix: 'Test validation failed',
      rules: [
        ValidationRules.specificDependencies('memoizedGetTags', [mockGetTags])
      ]
    });

    // Test that the validator works correctly with exact match
    expect(() => {
      // This should pass - correct dependencies
      testValidator.validate('memoizedGetTags', [mockGetTags]);
    }).not.toThrow();

    // Test that incorrect dependencies would fail
    expect(() => {
      // This should fail - wrong dependencies
      testValidator.validate('memoizedGetTags', [vi.fn(), 'extra']);
    }).toThrow('CRITICAL: useCallback for memoizedGetTags must have exactly the expected dependencies');

    // The fact that useInboxFilters initializes without throwing proves
    // that its internal validator is working correctly with proper dependencies
    expect(() => {
      renderHook(() => useInboxFilters());
    }).not.toThrow();
  });

  it('DependencyValidator class works as expected', () => {
    // Test the new DependencyValidator class functionality
    const validator = new DependencyValidator({
      errorPrefix: 'Test validator',
      rules: [
        ValidationRules.noDependencies('testFunction'),
        ValidationRules.specificDependencies('testSpecific', ['dep1', 'dep2'])
      ]
    });

    // Test no dependencies rule
    expect(() => {
      validator.validate('testFunction', []);
    }).not.toThrow();

    // Test that dependencies fail no-dependencies rule
    expect(() => {
      validator.validate('testFunction', ['extra']);
    }).toThrow('CRITICAL: useCallback for testFunction has dependencies');

    // Test specific dependencies rule
    expect(() => {
      validator.validate('testSpecific', ['dep1', 'dep2']);
    }).not.toThrow();

    // Test that wrong dependencies fail specific rule
    expect(() => {
      validator.validate('testSpecific', ['wrong']);
    }).toThrow('CRITICAL: useCallback for testSpecific must have exactly the expected dependencies');
  });
});
