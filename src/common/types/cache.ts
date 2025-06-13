import { NewsletterWithRelations } from "./index";

// Updated NewsletterFilter to support object-based filtering
export interface NewsletterFilter {
  // Search and text filtering
  search?: string;

  // Status filters
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;

  // Relationship filters
  tagIds?: string[];
  sourceIds?: string[];
  groupIds?: string[];

  // Date filtering
  dateFrom?: string;
  dateTo?: string;

  // Pagination
  limit?: number;
  offset?: number;
  page?: number;

  // Sorting
  orderBy?: string;
  ascending?: boolean;

  // Legacy support - can be used for quick filtering
  status?: "all" | "unread" | "liked" | "archived" | "bookmarked";
}

// Legacy type for backward compatibility
export type LegacyNewsletterFilter = "all" | "unread" | "liked" | "archived";

// Utility to convert legacy filter to new format
export const convertLegacyFilter = (
  legacyFilter: LegacyNewsletterFilter,
): NewsletterFilter => {
  switch (legacyFilter) {
    case "unread":
      return { isRead: false, isArchived: false };
    case "liked":
      return { isLiked: true, isArchived: false };
    case "archived":
      return { isArchived: true };
    case "all":
    default:
      return { isArchived: false };
  }
};

export interface NewsletterQueryKey {
  entity: "newsletters";
  scope: "list" | "detail" | "tags" | "sources";
  params: {
    userId?: string;
    id?: string;
    filters?: NewsletterFilter;
    // Legacy support
    filter?: LegacyNewsletterFilter;
    tagIds?: string[];
    sourceId?: string | null;
    groupSourceIds?: string[];
    timeRange?: string;
  };
}

export interface NewsletterCacheUpdate {
  id: string;
  updates: Partial<NewsletterWithRelations>;
}

export interface NewsletterBulkUpdate {
  ids: string[];
  updates: Partial<NewsletterWithRelations>;
}

// Source-related cache types
export interface NewsletterSourceFilter {
  search?: string;
  isArchived?: boolean;
  excludeArchived?: boolean;
  includeCount?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface NewsletterSourceQueryKey {
  entity: "newsletter_sources";
  scope: "list" | "detail" | "stats";
  params: {
    userId?: string;
    id?: string;
    filters?: NewsletterSourceFilter;
  };
}

// Tag-related cache types
export interface TagFilter {
  search?: string;
  includeCount?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface TagQueryKey {
  entity: "tags";
  scope: "list" | "detail" | "stats";
  params: {
    userId?: string;
    id?: string;
    filters?: TagFilter;
  };
}

// Cache invalidation patterns
export interface CacheInvalidationPattern {
  entity: string;
  scope?: string;
  operation: string;
  affectedIds?: string[];
}

// Performance monitoring
export interface CachePerformanceMetrics {
  operation: string;
  cacheHit: boolean;
  duration: number;
  timestamp: number;
  keyPattern: string;
}

// Cache configuration
export const CACHE_DURATION = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  DAY: 24 * 60 * 60 * 1000, // 24 hours
};

export const CACHE_CONFIG = {
  // Newsletter-specific cache times
  NEWSLETTER_LIST_STALE_TIME: 2 * 60 * 1000, // 2 minutes
  NEWSLETTER_LIST_CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  NEWSLETTER_DETAIL_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  NEWSLETTER_DETAIL_CACHE_TIME: 15 * 60 * 1000, // 15 minutes

  // Source-specific cache times
  SOURCE_LIST_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  SOURCE_LIST_CACHE_TIME: 30 * 60 * 1000, // 30 minutes

  // Tag-specific cache times
  TAG_LIST_STALE_TIME: 10 * 60 * 1000, // 10 minutes
  TAG_LIST_CACHE_TIME: 60 * 60 * 1000, // 1 hour

  // Error retry configuration
  RETRY_DELAY_BASE: 1000, // 1 second base delay
  MAX_RETRY_DELAY: 30000, // 30 second max delay
  MAX_RETRIES: 3,
};

// Query key matchers for cache invalidation
export const CACHE_KEY_MATCHERS = {
  isNewsletterListKey: (key: unknown[]): boolean => {
    return key.length >= 2 && key[0] === "newsletters" && key[1] === "list";
  },

  isNewsletterDetailKey: (key: unknown[], id?: string): boolean => {
    if (key.length >= 3 && key[0] === "newsletters" && key[1] === "detail") {
      return id ? key[2] === id : true;
    }
    return false;
  },

  isNewsletterSourceKey: (key: unknown[]): boolean => {
    return key.length >= 1 && key[0] === "newsletter_sources";
  },

  isTagKey: (key: unknown[]): boolean => {
    return key.length >= 1 && key[0] === "tags";
  },

  isReadingQueueKey: (key: unknown[]): boolean => {
    return key.length >= 1 && key[0] === "reading_queue";
  },
};
