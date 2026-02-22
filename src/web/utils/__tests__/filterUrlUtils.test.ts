import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFilterUrlParams,
  parseFilterUrlParams,
  syncFilterUrl,
  updateFilterUrl,
  urlParamsToNewsletterFilter,
  type FilterUrlParams,
  type ParsedUrlParams,
} from '../filterUrlUtils';

// Mock window.location and window.history
const mockLocation = {
  pathname: '/inbox',
  search: '',
  href: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

const mockHistory = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('window', {
    location: mockLocation,
    history: mockHistory,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('filterUrlUtils', () => {
  describe('parseFilterUrlParams', () => {
    it('should parse empty URL search params', () => {
      const searchParams = new URLSearchParams();
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        hasParams: false,
      });
    });

    it('should parse basic filter parameter', () => {
      const searchParams = new URLSearchParams('filter=archived');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        filter: 'archived',
        hasParams: true,
      });
    });

    it('should parse multiple parameters', () => {
      const searchParams = new URLSearchParams('filter=unread&source=source1&time=day&isRead=false&isArchived=true');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        filter: 'unread',
        source: 'source1',
        time: 'day',
        isRead: false,
        isArchived: true,
        hasParams: true,
      });
    });

    it('should parse array parameters (groups and tags)', () => {
      const searchParams = new URLSearchParams('groups=group1,group2,group3&tags=tag1,tag2');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        groups: ['group1', 'group2', 'group3'],
        tags: ['tag1', 'tag2'],
        hasParams: true,
      });
    });

    it('should handle empty array parameters', () => {
      const searchParams = new URLSearchParams('groups=&tags=');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        hasParams: false,
      });
    });

    it('should filter out empty values in array parameters', () => {
      const searchParams = new URLSearchParams('groups=group1,,group3&tags=,tag2,');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        groups: ['group1', 'group3'],
        tags: ['tag2'],
        hasParams: true,
      });
    });

    it('should ignore time=all parameter', () => {
      const searchParams = new URLSearchParams('time=all');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        hasParams: false,
      });
    });

    it('should parse boolean parameters correctly', () => {
      const searchParams = new URLSearchParams('isRead=true&isArchived=false');
      const result = parseFilterUrlParams(searchParams);

      expect(result).toEqual({
        isRead: true,
        isArchived: false,
        hasParams: true,
      });
    });
  });

  describe('buildFilterUrlParams', () => {
    it('should build empty URL search params', () => {
      const params: FilterUrlParams = {};
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('');
    });

    it('should build basic filter parameter', () => {
      const params: FilterUrlParams = { filter: 'archived' };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('filter=archived');
    });

    it('should exclude filter=unread from URL', () => {
      const params: FilterUrlParams = { filter: 'unread' };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('');
    });

    it('should build multiple parameters', () => {
      const params: FilterUrlParams = {
        filter: 'archived',
        source: 'source1',
        time: 'day',
        isRead: false,
        isArchived: true,
      };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('filter=archived&source=source1&time=day&isRead=false&isArchived=true');
    });

    it('should build array parameters', () => {
      const params: FilterUrlParams = {
        groups: ['group1', 'group2', 'group3'],
        tags: ['tag1', 'tag2'],
      };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('groups=group1%2Cgroup2%2Cgroup3&tags=tag1%2Ctag2');
    });

    it('should exclude empty arrays from URL', () => {
      const params: FilterUrlParams = {
        groups: [],
        tags: [],
      };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('');
    });

    it('should exclude time=all from URL', () => {
      const params: FilterUrlParams = { time: 'all' };
      const result = buildFilterUrlParams(params);

      expect(result.toString()).toBe('');
    });
  });

  describe('updateFilterUrl', () => {
    it('should replace URL by default', () => {
      const params: FilterUrlParams = { filter: 'archived' };
      updateFilterUrl(params);

      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/inbox?filter=archived');
      expect(mockHistory.pushState).not.toHaveBeenCalled();
    });

    it('should push to history when replace=false', () => {
      const params: FilterUrlParams = { filter: 'archived' };
      updateFilterUrl(params, false);

      expect(mockHistory.pushState).toHaveBeenCalledWith({}, '', '/inbox?filter=archived');
      expect(mockHistory.replaceState).not.toHaveBeenCalled();
    });

    it('should handle empty parameters', () => {
      const params: FilterUrlParams = {};
      updateFilterUrl(params);

      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/inbox');
    });
  });

  describe('syncFilterUrl', () => {
    it('should return false when no changes needed', () => {
      const currentParams: FilterUrlParams = {
        filter: 'archived',
        source: 'source1',
      };
      const currentFilter = 'archived';
      const currentSource = 'source1';
      const currentGroups: string[] = [];
      const currentTags: string[] = [];
      const currentTimeRange = 'all';

      const result = syncFilterUrl(
        currentParams,
        currentFilter,
        currentSource,
        currentGroups,
        currentTags,
        currentTimeRange
      );

      expect(result).toBe(false);
      expect(mockHistory.replaceState).not.toHaveBeenCalled();
    });

    it('should return true and update URL when changes detected', () => {
      const currentParams: FilterUrlParams = { filter: 'archived' };
      const currentFilter = 'unread';
      const currentSource = null;
      const currentGroups: string[] = [];
      const currentTags: string[] = [];
      const currentTimeRange = 'all';

      const result = syncFilterUrl(
        currentParams,
        currentFilter,
        currentSource,
        currentGroups,
        currentTags,
        currentTimeRange
      );

      expect(result).toBe(true);
      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/inbox');
    });

    it('should handle group order changes', () => {
      const currentParams: FilterUrlParams = { groups: ['group1', 'group2'] };
      const currentFilter = 'unread';
      const currentSource = null;
      const currentGroups = ['group2', 'group1']; // Different order
      const currentTags: string[] = [];
      const currentTimeRange = 'all';

      const result = syncFilterUrl(
        currentParams,
        currentFilter,
        currentSource,
        currentGroups,
        currentTags,
        currentTimeRange
      );

      // Arrays are sorted before comparison, so order change is NOT detected
      // currentParams.groups sorted: ['group1', 'group2']
      // currentGroups sorted: ['group1', 'group2'] (same after sorting)
      // newParams.groups will be ['group2', 'group1'] but comparison uses sorted arrays
      expect(result).toBe(false);
      expect(mockHistory.replaceState).not.toHaveBeenCalled();
    });

    it('should handle tag order changes', () => {
      const currentParams: FilterUrlParams = { tags: ['tag1', 'tag2'] };
      const currentFilter = 'unread';
      const currentSource = null;
      const currentGroups: string[] = [];
      const currentTags = ['tag2', 'tag1']; // Different order
      const currentTimeRange = 'all';

      const result = syncFilterUrl(
        currentParams,
        currentFilter,
        currentSource,
        currentGroups,
        currentTags,
        currentTimeRange
      );

      // Arrays are sorted before comparison, so order change is NOT detected
      // currentParams.tags sorted: ['tag1', 'tag2']
      // currentTags sorted: ['tag1', 'tag2'] (same after sorting)
      // newParams.tags will be ['tag2', 'tag1'] but comparison uses sorted arrays
      expect(result).toBe(false);
      expect(mockHistory.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('urlParamsToNewsletterFilter', () => {
    it('should return empty filter for no params', () => {
      const params: ParsedUrlParams = { hasParams: false };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({});
    });

    it('should convert filter=unread', () => {
      const params: ParsedUrlParams = { hasParams: true, filter: 'unread' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        isRead: false,
        isArchived: false,
      });
    });

    it('should convert filter=read', () => {
      const params: ParsedUrlParams = { hasParams: true, filter: 'read' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        isRead: true,
        isArchived: false,
      });
    });

    it('should convert filter=archived', () => {
      const params: ParsedUrlParams = { hasParams: true, filter: 'archived' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        isArchived: true,
      });
    });

    it('should convert filter=liked', () => {
      const params: ParsedUrlParams = { hasParams: true, filter: 'liked' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        isLiked: true,
      });
    });

    it('should override filter with explicit isRead and isArchived', () => {
      const params: ParsedUrlParams = {
        hasParams: true,
        filter: 'unread',
        isRead: true,
        isArchived: true,
      };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        isRead: true,
        isArchived: true,
      });
    });

    it('should convert source parameter', () => {
      const params: ParsedUrlParams = { hasParams: true, source: 'source1' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        sourceIds: ['source1'],
      });
    });

    it('should convert groups parameter', () => {
      const params: ParsedUrlParams = {
        hasParams: true,
        groups: ['group1', 'group2'],
      };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        groupIds: ['group1', 'group2'],
      });
    });

    it('should convert tags parameter', () => {
      const params: ParsedUrlParams = {
        hasParams: true,
        tags: ['tag1', 'tag2'],
      };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({
        tagIds: ['tag1', 'tag2'],
      });
    });

    it('should convert time=day with local date calculation', () => {
      const params: ParsedUrlParams = { hasParams: true, time: 'day' };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const startOfLocalDay = new Date(now);
      startOfLocalDay.setHours(0, 0, 0, 0);

      expect(result).toEqual({
        dateFrom: startOfLocalDay.toISOString(),
      });
    });

    it('should convert time=week with Monday start', () => {
      const params: ParsedUrlParams = { hasParams: true, time: 'week' };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      const diffSinceMonday = (day + 6) % 7;
      startOfWeek.setDate(startOfWeek.getDate() - diffSinceMonday);

      expect(result).toEqual({
        dateFrom: startOfWeek.toISOString(),
      });
    });

    it('should convert time=month with first day of month', () => {
      const params: ParsedUrlParams = { hasParams: true, time: 'month' };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      expect(result).toEqual({
        dateFrom: startOfMonth.toISOString(),
      });
    });

    it('should convert time=2days with rolling 2 days', () => {
      const params: ParsedUrlParams = { hasParams: true, time: '2days' };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      expect(result).toEqual({
        dateFrom: twoDaysAgo.toISOString(),
      });
    });

    it('should handle unsupported time values by falling back to week', () => {
      const params: ParsedUrlParams = { hasParams: true, time: 'unsupported' };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      const diffSinceMonday = (day + 6) % 7;
      startOfWeek.setDate(startOfWeek.getDate() - diffSinceMonday);

      expect(result).toEqual({
        dateFrom: startOfWeek.toISOString(),
      });
    });

    it('should ignore time=all', () => {
      const params: ParsedUrlParams = { hasParams: true, time: 'all' };
      const result = urlParamsToNewsletterFilter(params);

      expect(result).toEqual({});
    });

    it('should combine multiple parameters correctly', () => {
      const params: ParsedUrlParams = {
        hasParams: true,
        filter: 'archived',
        source: 'source1',
        groups: ['group1'],
        tags: ['tag1'],
        time: 'day',
        isRead: true,
      };
      const result = urlParamsToNewsletterFilter(params);

      const now = new Date();
      const startOfLocalDay = new Date(now);
      startOfLocalDay.setHours(0, 0, 0, 0);

      expect(result).toEqual({
        isArchived: true,
        isRead: true,
        sourceIds: ['source1'],
        groupIds: ['group1'],
        tagIds: ['tag1'],
        dateFrom: startOfLocalDay.toISOString(),
      });
    });
  });

  describe('Integration tests', () => {
    it('should round-trip URL parameters correctly', () => {
      // Start with URL params
      const searchParams = new URLSearchParams('filter=archived&source=source1&groups=group1,group2&time=day');

      // Parse them
      const parsed = parseFilterUrlParams(searchParams);

      // Convert to newsletter filter
      const filter = urlParamsToNewsletterFilter(parsed);

      // Should have expected structure
      expect(filter.isArchived).toBe(true);
      expect(filter.sourceIds).toEqual(['source1']);
      expect(filter.groupIds).toEqual(['group1', 'group2']);
      expect(filter.dateFrom).toBeDefined();
    });

    it('should handle complex filter scenarios', () => {
      const params: FilterUrlParams = {
        filter: 'unread',
        source: 'source1',
        groups: ['group1', 'group2'],
        tags: ['tag1', 'tag2'],
        time: 'week',
        isRead: false,
        isArchived: false,
      };

      // Build URL params
      const searchParams = buildFilterUrlParams(params);
      expect(searchParams.toString()).toBe('source=source1&groups=group1%2Cgroup2&tags=tag1%2Ctag2&time=week&isRead=false&isArchived=false');

      // Parse back
      const parsed = parseFilterUrlParams(searchParams);
      expect(parsed).toEqual({
        source: 'source1',
        groups: ['group1', 'group2'],
        tags: ['tag1', 'tag2'],
        time: 'week',
        isRead: false,
        isArchived: false,
        hasParams: true,
      });

      // Convert to newsletter filter
      const filter = urlParamsToNewsletterFilter(parsed);
      expect(filter.isRead).toBe(false);
      expect(filter.isArchived).toBe(false);
      expect(filter.sourceIds).toEqual(['source1']);
      expect(filter.groupIds).toEqual(['group1', 'group2']);
      expect(filter.tagIds).toEqual(['tag1', 'tag2']);
      expect(filter.dateFrom).toBeDefined();
    });
  });
});
