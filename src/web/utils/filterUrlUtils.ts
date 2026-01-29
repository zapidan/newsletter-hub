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
export const urlParamsToNewsletterFilter = (params: ParsedUrlParams) => {
  const filter: any = {};

  if (!params.hasParams) {
    return filter;
  }

  if (params.filter) {
    switch (params.filter) {
      case 'unread':
        filter.isRead = false;
        break;
      case 'read':
        filter.isRead = true;
        break;
      case 'archived':
        filter.isArchived = true;
        break;
      case 'liked':
        filter.isLiked = true;
        break;
    }
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

  return filter;
};
