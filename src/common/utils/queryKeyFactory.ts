import type { NewsletterFilter } from "../types/cache";

export interface QueryKeyFactoryParams {
  userId?: string;
  id?: string;
  filter?: NewsletterFilter;
  tagIds?: string[];
  sourceId?: string | null;
  groupSourceIds?: string[];
  timeRange?: string;
  position?: number;
}

/**
 * Centralized query key factory for consistent cache key generation
 * across all newsletter and reading queue operations
 */
export const queryKeyFactory = {
  // Root keys
  all: ["newsletters"] as const,
  readingQueue: ["readingQueue"] as const,

  // Newsletter keys
  newsletters: {
    all: () => [...queryKeyFactory.all] as const,
    lists: () => [...queryKeyFactory.newsletters.all(), "list"] as const,
    list: (params: QueryKeyFactoryParams = {}) => {
      const baseKey = [...queryKeyFactory.newsletters.lists()] as const;

      // Build filters object excluding undefined values
      const filters: Record<string, unknown> = {};
      if (params.userId) filters.userId = params.userId;
      if (params.filter && params.filter !== "all")
        filters.filter = params.filter;
      if (params.tagIds?.length) filters.tagIds = [...params.tagIds].sort(); // Sort for consistency
      if (params.sourceId !== undefined) filters.sourceId = params.sourceId;
      if (params.groupSourceIds?.length)
        filters.groupSourceIds = [...params.groupSourceIds].sort();
      if (params.timeRange && params.timeRange !== "all")
        filters.timeRange = params.timeRange;

      return Object.keys(filters).length > 0
        ? ([...baseKey, filters] as const)
        : baseKey;
    },
    details: () => [...queryKeyFactory.newsletters.all(), "detail"] as const,
    detail: (id: string) =>
      [...queryKeyFactory.newsletters.details(), id] as const,
    tags: () => [...queryKeyFactory.newsletters.all(), "tags"] as const,
    tag: (tagId: string) =>
      [...queryKeyFactory.newsletters.tags(), tagId] as const,
    tagLists: () => [...queryKeyFactory.newsletters.tags(), "list"] as const,
    tagList: (userId?: string) => {
      const baseKey = [...queryKeyFactory.newsletters.tagLists()] as const;
      return userId ? ([...baseKey, userId] as const) : baseKey;
    },
    tagDetails: () =>
      [...queryKeyFactory.newsletters.tags(), "detail"] as const,
    tagDetail: (tagId: string) =>
      [...queryKeyFactory.newsletters.tagDetails(), tagId] as const,
    tagCounts: () => [...queryKeyFactory.newsletters.tags(), "counts"] as const,
    sources: () => [...queryKeyFactory.newsletters.all(), "sources"] as const,
    source: (sourceId: string) =>
      [...queryKeyFactory.newsletters.sources(), sourceId] as const,
  },

  // Reading queue keys
  queue: {
    all: () => [...queryKeyFactory.readingQueue] as const,
    lists: () => [...queryKeyFactory.queue.all(), "list"] as const,
    list: (userId: string) =>
      [...queryKeyFactory.queue.lists(), userId] as const,
    details: () => [...queryKeyFactory.queue.all(), "detail"] as const,
    detail: (id: string) => [...queryKeyFactory.queue.details(), id] as const,
    positions: () => [...queryKeyFactory.queue.all(), "positions"] as const,
    position: (userId: string) =>
      [...queryKeyFactory.queue.positions(), userId] as const,
  },

  // Cross-feature keys for related data
  related: {
    // Keys for newsletter-queue relationships
    newsletterQueue: (newsletterId: string) =>
      [...queryKeyFactory.all, "queue-status", newsletterId] as const,

    // Keys for tag-newsletter relationships
    tagNewsletters: (tagId: string) =>
      [...queryKeyFactory.newsletters.tags(), tagId, "newsletters"] as const,

    // Keys for newsletter-tag relationships
    newsletterTags: (newsletterId: string) =>
      [...queryKeyFactory.newsletters.details(), newsletterId, "tags"] as const,

    // Keys for tag operations
    tagOperations: (tagId: string) =>
      [...queryKeyFactory.newsletters.tags(), tagId, "operations"] as const,

    // Keys for tag statistics and counts
    tagStats: () => [...queryKeyFactory.newsletters.tags(), "stats"] as const,

    // Keys for source-newsletter relationships
    sourceNewsletters: (sourceId: string) =>
      [
        ...queryKeyFactory.newsletters.sources(),
        sourceId,
        "newsletters",
      ] as const,
  },

  // Utility functions for query key matching
  matchers: {
    // Check if a query key matches newsletter list pattern
    isNewsletterListKey: (queryKey: unknown[]): boolean => {
      return (
        queryKey.length >= 2 &&
        queryKey[0] === "newsletters" &&
        queryKey[1] === "list"
      );
    },

    // Check if a query key matches reading queue pattern
    isReadingQueueKey: (queryKey: unknown[]): boolean => {
      return queryKey.length >= 1 && queryKey[0] === "readingQueue";
    },

    // Check if a query key is for a specific newsletter
    isNewsletterDetailKey: (
      queryKey: unknown[],
      newsletterId?: string,
    ): boolean => {
      const isDetailKey =
        queryKey.length >= 3 &&
        queryKey[0] === "newsletters" &&
        queryKey[1] === "detail";

      if (!newsletterId) return isDetailKey;
      return isDetailKey && queryKey[2] === newsletterId;
    },

    // Check if a query key is tag-related
    isTagKey: (queryKey: unknown[]): boolean => {
      return (
        queryKey.length >= 2 &&
        queryKey[0] === "newsletters" &&
        queryKey[1] === "tags"
      );
    },

    // Check if a query key is for a specific tag
    isTagDetailKey: (queryKey: unknown[], tagId?: string): boolean => {
      const isTagKey =
        queryKey.length >= 4 &&
        queryKey[0] === "newsletters" &&
        queryKey[1] === "tags" &&
        queryKey[2] === "detail";

      if (!tagId) return isTagKey;
      return isTagKey && queryKey[3] === tagId;
    },

    // Check if a query key is for tag lists
    isTagListKey: (queryKey: unknown[]): boolean => {
      return (
        queryKey.length >= 3 &&
        queryKey[0] === "newsletters" &&
        queryKey[1] === "tags" &&
        queryKey[2] === "list"
      );
    },

    // Check if a query key involves a specific filter
    hasFilter: (queryKey: unknown[], filter: NewsletterFilter): boolean => {
      if (!queryKeyFactory.matchers.isNewsletterListKey(queryKey)) return false;

      const filtersObj = queryKey[2];
      if (typeof filtersObj !== "object" || !filtersObj)
        return filter === "all";

      return (filtersObj as Record<string, unknown>).filter === filter;
    },

    // Check if a query key involves specific tags
    hasTags: (queryKey: unknown[], tagIds: string[]): boolean => {
      if (!queryKeyFactory.matchers.isNewsletterListKey(queryKey)) return false;

      const filtersObj = queryKey[2];
      if (typeof filtersObj !== "object" || !filtersObj)
        return tagIds.length === 0;

      const keyTagIds = (filtersObj as Record<string, unknown>).tagIds;
      if (!Array.isArray(keyTagIds)) return tagIds.length === 0;

      return (
        keyTagIds.length === tagIds.length &&
        keyTagIds.every((id) => tagIds.includes(id))
      );
    },

    // Check if a query key involves any of the specified tags
    hasAnyTags: (queryKey: unknown[], tagIds: string[]): boolean => {
      if (!queryKeyFactory.matchers.isNewsletterListKey(queryKey)) return false;

      const filtersObj = queryKey[2];
      if (typeof filtersObj !== "object" || !filtersObj) return false;

      const keyTagIds = (filtersObj as Record<string, unknown>).tagIds;
      if (!Array.isArray(keyTagIds)) return false;

      return keyTagIds.some((id) => tagIds.includes(id));
    },

    // Check if a query key is affected by tag changes
    isAffectedByTagChange: (queryKey: unknown[], tagId: string): boolean => {
      // Tag-related queries
      if (queryKeyFactory.matchers.isTagKey(queryKey)) {
        return queryKey.includes(tagId);
      }

      // Newsletter queries that might be filtered by tags
      if (queryKeyFactory.matchers.isNewsletterListKey(queryKey)) {
        return queryKeyFactory.matchers.hasAnyTags(queryKey, [tagId]);
      }

      // Newsletter detail queries might have tag relationships
      if (queryKeyFactory.matchers.isNewsletterDetailKey(queryKey)) {
        return true; // Tags might be part of the newsletter details
      }

      return false;
    },

    // Check if a query key involves a specific source
    hasSource: (queryKey: unknown[], sourceId: string | null): boolean => {
      if (!queryKeyFactory.matchers.isNewsletterListKey(queryKey)) return false;

      const filtersObj = queryKey[2];
      if (typeof filtersObj !== "object" || !filtersObj)
        return sourceId === null;

      return (filtersObj as Record<string, unknown>).sourceId === sourceId;
    },
  },
};

/**
 * Legacy compatibility function - maintains backward compatibility
 * with existing buildQueryKey usage while encouraging migration to new factory
 * @deprecated Use queryKeyFactory.newsletters.list() instead
 */
export const buildQueryKey = (params: {
  scope: "list" | "detail" | "tags";
  userId?: string;
  id?: string;
  filter?: NewsletterFilter;
  tagId?: string;
  sourceId?: string | null;
  groupSourceIds?: string[];
  timeRange?: string;
}) => {
  const {
    scope,
    userId,
    id,
    filter,
    tagId,
    sourceId,
    groupSourceIds,
    timeRange,
  } = params;

  if (scope === "list") {
    return queryKeyFactory.newsletters.list({
      userId,
      filter,
      tagIds: tagId ? [tagId] : undefined,
      sourceId,
      groupSourceIds,
      timeRange,
    });
  }

  if (scope === "detail" && id) {
    return queryKeyFactory.newsletters.detail(id);
  }

  if (scope === "tags") {
    return tagId
      ? queryKeyFactory.newsletters.tag(tagId)
      : queryKeyFactory.newsletters.tags();
  }

  // Fallback to basic key
  return [scope];
};

/**
 * Type-safe query key generator with validation
 */
export const createQueryKey = (
  category: keyof typeof queryKeyFactory,
  ...args: unknown[]
): readonly unknown[] => {
  const factory = queryKeyFactory[category];

  if (typeof factory === "function") {
    return (factory as (...args: unknown[]) => readonly unknown[])(...args);
  }

  if (typeof factory === "object" && args.length > 0) {
    const method = (factory as Record<string, unknown>)[args[0] as string];
    if (typeof method === "function") {
      return (method as (...args: unknown[]) => readonly unknown[])(
        ...args.slice(1),
      );
    }
  }

  throw new Error(`Invalid query key configuration: ${String(category)}`);
};

/**
 * Utility to normalize query keys for comparison and caching
 */
export const normalizeQueryKey = (queryKey: unknown[]): string => {
  return JSON.stringify(queryKey, (_, value) => {
    // Sort arrays for consistent string representation
    if (Array.isArray(value)) {
      return [...value].sort();
    }
    // Sort object keys for consistent string representation
    if (typeof value === "object" && value !== null) {
      const sorted: Record<string, unknown> = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          sorted[k] = (value as Record<string, unknown>)[k];
        });
      return sorted;
    }
    return value;
  });
};

/**
 * Debug utility to help identify query key patterns
 */
export const debugQueryKey = (queryKey: unknown[]): string => {
  const patterns = [];

  if (queryKeyFactory.matchers.isNewsletterListKey(queryKey)) {
    patterns.push("newsletter-list");
  }

  if (queryKeyFactory.matchers.isReadingQueueKey(queryKey)) {
    patterns.push("reading-queue");
  }

  if (queryKeyFactory.matchers.isNewsletterDetailKey(queryKey)) {
    patterns.push("newsletter-detail");
  }

  return `QueryKey: ${JSON.stringify(queryKey)} | Patterns: [${patterns.join(", ")}]`;
};
