
/**
 * Centralized URL parameter management for newsletter filters
 * Provides consistent handling of filter parameters across the application
 */

export interface FilterUrlParams {
  filter?: string;
  source?: string;
  groups?: string[];
  tags?: string[];
  time?: string;
  isRead?: boolean;
  isArchived?: boolean;
}

export interface ParsedUrlParams extends FilterUrlParams {
  hasParams: boolean;
}

/**
 * Parse URL search parameters into structured filter object
 */
export const parseFilterUrlParams = (searchParams: URLSearchParams): ParsedUrlParams => {
  const params: ParsedUrlParams = {
    hasParams: false,
  };

  const filter = searchParams.get('filter');
  const source = searchParams.get('source');
  const groups = searchParams.get('groups');
  const tags = searchParams.get('tags');
  const time = searchParams.get('time');
  const isRead = searchParams.get('isRead');
  const isArchived = searchParams.get('isArchived');

  if (filter) {
    params.filter = filter;
    params.hasParams = true;
  }

  if (source) {
    params.source = source;
    params.hasParams = true;
  }

  if (groups) {
    params.groups = groups.split(',').map(id => id.trim()).filter(Boolean);
    params.hasParams = true;
  }

  if (tags) {
    params.tags = tags.split(',').map(id => id.trim()).filter(Boolean);
    params.hasParams = true;
  }

  if (time && time !== 'all') {
    params.time = time;
    params.hasParams = true;
  }

  if (isRead !== null) {
    params.isRead = isRead === 'true';
    params.hasParams = true;
  }

  if (isArchived !== null) {
    params.isArchived = isArchived === 'true';
    params.hasParams = true;
  }

  return params;
};

/**
 * Build URL search parameters from filter object
 */
export const buildFilterUrlParams = (params: FilterUrlParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (params.filter && params.filter !== 'unread') {
    searchParams.set('filter', params.filter);
  }

  if (params.source) {
    searchParams.set('source', params.source);
  }

  if (params.groups && params.groups.length > 0) {
    searchParams.set('groups', params.groups.join(','));
  }

  if (params.tags && params.tags.length > 0) {
    searchParams.set('tags', params.tags.join(','));
  }

  if (params.time && params.time !== 'all') {
    searchParams.set('time', params.time);
  }

  if (params.isRead !== undefined) {
    searchParams.set('isRead', params.isRead.toString());
  }

  if (params.isArchived !== undefined) {
    searchParams.set('isArchived', params.isArchived.toString());
  }

  return searchParams;
};

/**
 * Update URL with new filter parameters
 */
export const updateFilterUrl = (params: FilterUrlParams, replace = true): void => {
  const searchParams = buildFilterUrlParams(params);
  const newUrl = `${window.location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  if (replace) {
    window.history.replaceState({}, '', newUrl);
  } else {
    window.history.pushState({}, '', newUrl);
  }
};

/**
 * Sync URL parameters with current filter state
 * Returns true if URL was updated, false if no changes needed
 */
export const syncFilterUrl = (
  currentParams: FilterUrlParams,
  currentFilter: string,
  currentSource: string | null,
  currentGroups: string[],
  currentTags: string[],
  currentTimeRange: string
): boolean => {
  const newParams: FilterUrlParams = {
    filter: currentFilter !== 'unread' ? currentFilter : undefined,
    source: currentSource || undefined,
    groups: currentGroups.length > 0 ? currentGroups : undefined,
    tags: currentTags.length > 0 ? currentTags : undefined,
    time: currentTimeRange !== 'all' ? currentTimeRange : undefined,
  };

  // Check if anything actually changed
  const hasChanges =
    (currentParams.filter !== newParams.filter) ||
    (currentParams.source !== newParams.source) ||
    (JSON.stringify(currentParams.groups?.sort() || []) !== JSON.stringify(newParams.groups?.sort() || [])) ||
    (JSON.stringify(currentParams.tags?.sort() || []) !== JSON.stringify(newParams.tags?.sort() || [])) ||
    (currentParams.time !== newParams.time);

  if (hasChanges) {
    updateFilterUrl(newParams);
    return true;
  }

  return false;
};

/**
 * Convert URL parameters to newsletter filter object
 */
import type { NewsletterFilter } from '../../common/types/cache';
export const urlParamsToNewsletterFilter = (params: ParsedUrlParams): NewsletterFilter => {
  const filter: NewsletterFilter = {};

  if (!params.hasParams) {
    return filter;
  }

  if (params.filter) {
    switch (params.filter) {
      case 'unread':
        filter.isRead = false;
        filter.isArchived = false;
        break;
      case 'read':
        filter.isRead = true;
        filter.isArchived = false;
        break;
      case 'archived':
        filter.isArchived = true;
        break;
      case 'liked':
        filter.isLiked = true;
        break;
    }
  }

  // Handle separate isRead and isArchived parameters (override filter if present)
  if (params.isRead !== undefined) {
    filter.isRead = params.isRead;
  }

  if (params.isArchived !== undefined) {
    filter.isArchived = params.isArchived;
  }

  if (params.source) {
    filter.sourceIds = [params.source];
  }

  if (params.tags && params.tags.length > 0) {
    filter.tagIds = params.tags;
  }

  if (params.groups && params.groups.length > 0) {
    filter.groupIds = params.groups;
  }

  if (params.time && params.time !== 'all') {
    // Use local time for date calculations so 'day' reflects the user's local day
    const now = new Date();
    let dateFrom: Date;

    switch (params.time) {
      case 'day': {
        // Start of the local day (local midnight)
        const startOfLocalDay = new Date(now);
        startOfLocalDay.setHours(0, 0, 0, 0);
        dateFrom = startOfLocalDay;
        break;
      }
      case 'week': {
        // Start of the current week (Monday 00:00 local time)
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay(); // 0=Sun,1=Mon,...6=Sat
        const diffSinceMonday = (day + 6) % 7; // days since Monday
        startOfWeek.setDate(startOfWeek.getDate() - diffSinceMonday);
        dateFrom = startOfWeek;
        break;
      }
      case 'month': {
        // Start of the current month at local midnight
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        dateFrom = startOfMonth;
        break;
      }
      case '2days': {
        // Rolling 2 days (48 hours) based on local time
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);
        dateFrom = twoDaysAgo;
        break;
      }
      default: {
        // For unsupported values, fall back to start of current week
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay();
        const diffSinceMonday = (day + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - diffSinceMonday);
        dateFrom = startOfWeek;
      }
    }

    filter.dateFrom = dateFrom.toISOString();
  }

  return filter;
};
