import { newsletterApi } from '../api/newsletterApi';
import { optimizedNewsletterApi } from '../api/optimizedNewsletterApi';
import { NewsletterWithRelations } from '../types';
import {
  BatchResult,
  BulkUpdateNewsletterParams,
  CreateNewsletterParams,
  NewsletterQueryParams,
  PaginatedResponse,
  UpdateNewsletterParams,
} from '../types/api';
import { logger } from '../utils/logger';

const log = logger;

// Configuration for when to use optimized vs original API
const OPTIMIZATION_CONFIG = {
  // Use optimized API for list queries with relations
  useOptimizedForListQueries: true,

  // Use optimized API for single queries with relations
  useOptimizedForSingleQueries: true,

  // Use optimized API for source filtering (most common case)
  useOptimizedForSourceFiltering: true,

  // Never use optimized API for complex operations (create, update, delete, bulk operations)
  useOptimizedForMutations: false,

  // Never use optimized API for search and tag filtering (not yet optimized)
  useOptimizedForSearch: false,
  useOptimizedForTagFiltering: false,
};

// Determine if we should use the optimized API for a given query
const shouldUseOptimizedApi = (
  operation: 'getAll' | 'getById' | 'create' | 'update' | 'delete' | 'bulkUpdate' | 'markAsRead' | 'markAsUnread' | 'toggleArchive' | 'bulkArchive' | 'bulkUnarchive' | 'toggleLike' | 'getByTags' | 'getBySource' | 'search' | 'getStats' | 'countBySource' | 'getTotalCountBySource' | 'getUnreadCountBySource' | 'getUnreadCount',
  _params: NewsletterQueryParams = {}
): boolean => {
  // Never use optimized API for mutations
  if (OPTIMIZATION_CONFIG.useOptimizedForMutations === false) {
    if (['create', 'update', 'delete', 'bulkUpdate', 'markAsRead', 'markAsUnread', 'toggleArchive', 'bulkArchive', 'bulkUnarchive', 'toggleLike'].includes(operation)) {
      return false;
    }
  }

  // Never use optimized API for search and tag filtering
  if (OPTIMIZATION_CONFIG.useOptimizedForSearch === false && operation === 'search') {
    return false;
  }

  if (OPTIMIZATION_CONFIG.useOptimizedForTagFiltering === false && operation === 'getByTags') {
    return false;
  }

  // Use optimized API for list queries
  if (operation === 'getAll' && OPTIMIZATION_CONFIG.useOptimizedForListQueries) {
    return true;
  }

  // Use optimized API for single queries with relations
  if (operation === 'getById' && OPTIMIZATION_CONFIG.useOptimizedForSingleQueries) {
    return true;
  }

  // Use optimized API for source filtering
  if (operation === 'getBySource' && OPTIMIZATION_CONFIG.useOptimizedForSourceFiltering) {
    return true;
  }

  return false;
};

// Optimized Newsletter Service that intelligently chooses between APIs
export const optimizedNewsletterService = {
  async getAll(
    params: NewsletterQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    const useOptimized = shouldUseOptimizedApi('getAll', params);

    log.debug('Choosing API for getAll', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: {
        useOptimized,
        hasSourceIds: !!(params.sourceIds && params.sourceIds.length > 0),
        hasTagIds: !!(params.tagIds && params.tagIds.length > 0),
        hasSearch: !!params.search,
      },
    });

    if (useOptimized) {
      return optimizedNewsletterApi.getAll(params);
    } else {
      return newsletterApi.getAll(params);
    }
  },

  async getById(id: string, includeRelations = true): Promise<NewsletterWithRelations | null> {
    const useOptimized = shouldUseOptimizedApi('getById', { includeRelations });

    log.debug('Choosing API for getById', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: {
        useOptimized,
        includeRelations,
        id,
      },
    });

    if (useOptimized) {
      return optimizedNewsletterApi.getById(id, includeRelations);
    } else {
      return newsletterApi.getById(id, includeRelations);
    }
  },

  async create(params: CreateNewsletterParams): Promise<NewsletterWithRelations> {
    log.debug('Using original API for create', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'create' },
    });

    return newsletterApi.create(params);
  },

  async update(params: UpdateNewsletterParams): Promise<NewsletterWithRelations> {
    log.debug('Using original API for update', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'update' },
    });

    return newsletterApi.update(params);
  },

  async delete(id: string): Promise<boolean> {
    log.debug('Using original API for delete', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'delete' },
    });

    return newsletterApi.delete(id);
  },

  async bulkUpdate(
    params: BulkUpdateNewsletterParams
  ): Promise<BatchResult<NewsletterWithRelations>> {
    log.debug('Using original API for bulkUpdate', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'bulkUpdate' },
    });

    return newsletterApi.bulkUpdate(params);
  },

  async markAsRead(id: string): Promise<NewsletterWithRelations> {
    log.debug('Using original API for markAsRead', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'markAsRead' },
    });

    return newsletterApi.markAsRead(id);
  },

  async markAsUnread(id: string): Promise<NewsletterWithRelations> {
    log.debug('Using original API for markAsUnread', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'markAsUnread' },
    });

    return newsletterApi.markAsUnread(id);
  },

  async toggleArchive(id: string): Promise<NewsletterWithRelations> {
    log.debug('Using original API for toggleArchive', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'toggleArchive' },
    });

    return newsletterApi.toggleArchive(id);
  },

  async bulkArchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    log.debug('Using original API for bulkArchive', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'bulkArchive' },
    });

    return newsletterApi.bulkArchive(ids);
  },

  async bulkUnarchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    log.debug('Using original API for bulkUnarchive', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'bulkUnarchive' },
    });

    return newsletterApi.bulkUnarchive(ids);
  },

  async toggleLike(id: string): Promise<NewsletterWithRelations> {
    log.debug('Using original API for toggleLike', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'toggleLike' },
    });

    return newsletterApi.toggleLike(id);
  },

  async getByTags(
    tagIds: string[],
    params: Omit<NewsletterQueryParams, 'tagIds'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    const useOptimized = shouldUseOptimizedApi('getByTags', { ...params, tagIds });

    log.debug('Choosing API for getByTags', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: {
        useOptimized,
        tagIds,
        params,
      },
    });

    if (useOptimized) {
      return optimizedNewsletterApi.getByTags(tagIds, params);
    } else {
      return newsletterApi.getByTags(tagIds, params);
    }
  },

  async getBySource(
    sourceId: string,
    params: Omit<NewsletterQueryParams, 'sourceIds'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    const useOptimized = shouldUseOptimizedApi('getBySource', { ...params, sourceIds: [sourceId] });

    log.debug('Choosing API for getBySource', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: {
        useOptimized,
        sourceId,
        params,
      },
    });

    if (useOptimized) {
      return optimizedNewsletterApi.getBySource(sourceId, params);
    } else {
      return newsletterApi.getBySource(sourceId, params);
    }
  },

  async search(
    query: string,
    params: Omit<NewsletterQueryParams, 'search'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    const useOptimized = shouldUseOptimizedApi('search', { ...params, search: query });

    log.debug('Choosing API for search', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: {
        useOptimized,
        query,
        params,
      },
    });

    if (useOptimized) {
      return optimizedNewsletterApi.search(query, params);
    } else {
      return newsletterApi.search(query, params);
    }
  },

  async getStats(): Promise<{
    total: number;
    read: number;
    unread: number;
    archived: number;
    liked: number;
  }> {
    log.debug('Using original API for getStats', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'getStats' },
    });

    return newsletterApi.getStats();
  },

  async countBySource(): Promise<Record<string, number>> {
    log.debug('Using original API for countBySource', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'countBySource' },
    });

    return newsletterApi.countBySource();
  },

  async getTotalCountBySource(): Promise<Record<string, number>> {
    log.debug('Using original API for getTotalCountBySource', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'getTotalCountBySource' },
    });

    return newsletterApi.getTotalCountBySource();
  },

  async getUnreadCountBySource(): Promise<Record<string, number>> {
    log.debug('Using original API for getUnreadCountBySource', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'getUnreadCountBySource' },
    });

    return newsletterApi.getUnreadCountBySource();
  },

  async getUnreadCount(sourceId?: string | null): Promise<number> {
    log.debug('Using original API for getUnreadCount', {
      component: 'OptimizedNewsletterService',
      action: 'choose_api',
      metadata: { operation: 'getUnreadCount', sourceId },
    });

    return newsletterApi.getUnreadCount(sourceId);
  },
};

// Export the configuration for testing and debugging
export { OPTIMIZATION_CONFIG };
