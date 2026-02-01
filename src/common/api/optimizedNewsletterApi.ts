import { NewsletterWithRelations, Tag } from '../types';
import {
  BatchResult,
  BulkUpdateNewsletterParams,
  CreateNewsletterParams,
  NewsletterQueryParams,
  PaginatedResponse,
  UpdateNewsletterParams,
} from '../types/api';
import { logger } from '../utils/logger';
import {
  handleSupabaseError,
  requireAuth,
  supabase,
  withPerformanceLogging,
} from './supabaseClient';

// Initialize logger
const log = logger;

// Transform the optimized response to match existing NewsletterWithRelations interface
const transformOptimizedResponse = (data: any): NewsletterWithRelations => {
  // The optimized function returns data in the same format as the original
  // but with pre-joined source and tags as JSON
  const { source, tags, ...newsletterData } = data;

  // Transform source if it exists
  let transformedSource = null;
  if (source && typeof source === 'object') {
    transformedSource = {
      id: source.id,
      name: source.name || 'Unknown',
      from: source.from || null,
      created_at: source.created_at || new Date().toISOString(),
      updated_at: source.updated_at || new Date().toISOString(),
      user_id: source.user_id || null,
    };
  }

  // Transform tags if they exist
  let transformedTags: Tag[] = [];
  if (tags && Array.isArray(tags)) {
    transformedTags = tags.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      user_id: tag.user_id,
      created_at: tag.created_at,
      newsletter_count: tag.newsletter_count,
    }));
  }

  return {
    ...newsletterData,
    source: transformedSource,
    tags: transformedTags,
    is_archived: Boolean(newsletterData.is_archived),
    newsletter_source_id: newsletterData.newsletter_source_id,
    // Ensure all required properties
    id: newsletterData.id as string,
    title: newsletterData.title as string,
    content: newsletterData.content as string,
    summary: newsletterData.summary as string,
    image_url: newsletterData.image_url as string,
    received_at: newsletterData.received_at as string,
    updated_at: newsletterData.updated_at as string,
    is_read: Boolean(newsletterData.is_read),
    is_liked: Boolean(newsletterData.is_liked),
    user_id: newsletterData.user_id as string,
    word_count: Number(newsletterData.word_count) || 0,
    estimated_read_time: Number(newsletterData.estimated_read_time) || 0,
  };
};

// Optimized Newsletter API Service using the new database functions
export const optimizedNewsletterApi = {
  async getAll(
    params: NewsletterQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return withPerformanceLogging('optimizedNewsletters.getAll', async () => {
      const user = await requireAuth();

      log.debug('Using optimized newsletter query', {
        component: 'OptimizedNewsletterApi',
        action: 'get_all_optimized',
        metadata: {
          ...params,
          userId: user.id,
        },
      });

      // Map the parameters to the optimized function parameters
      const rpcParams = {
        p_user_id: user.id,
        p_source_id: params.sourceIds?.length === 1 ? params.sourceIds[0] : null,
        p_is_read: params.isRead ?? null,
        p_is_archived: params.isArchived ?? null,
        p_received_from: params.dateFrom || null,
        p_received_to: params.dateTo || null,
        p_source_ids: params.sourceIds && params.sourceIds.length > 1 ? params.sourceIds : null,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0,
        p_order_by: params.orderBy || 'received_at',
        p_order_direction: params.ascending ? 'asc' : 'desc',
      };

      // Call the optimized function
      const { data, error } = await supabase.rpc('get_newsletters_with_sources_tags', rpcParams);

      if (error) {
        log.error('Optimized newsletter query failed', {
          component: 'OptimizedNewsletterApi',
          action: 'get_all_error',
          metadata: { userId: user.id, params: rpcParams, error },
        });
        handleSupabaseError(error);
        throw error;
      }

      // Transform the data
      const transformedData = data ? data.map(transformOptimizedResponse) : [];

      // Get the total count using the optimized count function
      const { data: countData, error: countError } = await supabase.rpc('count_newsletters_with_sources_tags', {
        p_user_id: user.id,
        p_source_id: params.sourceIds?.length === 1 ? params.sourceIds[0] : null,
        p_is_read: params.isRead ?? null,
        p_is_archived: params.isArchived ?? null,
        p_received_from: params.dateFrom || null,
        p_received_to: params.dateTo || null,
        p_source_ids: params.sourceIds && params.sourceIds.length > 1 ? params.sourceIds : null,
      });

      if (countError) {
        log.warn('Failed to get count, using data length', { countError });
      }

      const totalCount = countData || transformedData.length;
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const page = Math.floor(offset / limit) + 1;
      const hasMore = totalCount ? offset + limit < totalCount : false;

      const result = {
        data: transformedData,
        count: totalCount,
        page,
        limit,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };

      log.debug('Optimized newsletter query completed', {
        component: 'OptimizedNewsletterApi',
        action: 'get_all_success',
        metadata: {
          dataCount: transformedData.length,
          totalCount,
          page,
          hasMore,
        },
      });

      return result;
    });
  },

  // Get newsletter by ID - still use the original method for single items
  async getById(id: string, includeRelations = true): Promise<NewsletterWithRelations | null> {
    return withPerformanceLogging('optimizedNewsletters.getById', async () => {
      const user = await requireAuth();

      let selectClause = '*';
      if (includeRelations) {
        selectClause = `
          *,
          source:newsletter_sources(*),
          tags:newsletter_tags(tag:tags(*))
        `;
      }

      const { data, error } = await supabase
        .from('newsletters')
        .select(selectClause)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data ? transformOptimizedResponse(data as any) : null;
    });
  },

  // Other methods remain the same as they don't benefit from the optimization
  async create(params: CreateNewsletterParams): Promise<NewsletterWithRelations> {
    // Delegate to original API for create operations
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.create(params);
  },

  async update(params: UpdateNewsletterParams): Promise<NewsletterWithRelations> {
    // Delegate to original API for update operations
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.update(params);
  },

  async delete(id: string): Promise<boolean> {
    // Delegate to original API for delete operations
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.delete(id);
  },

  async bulkUpdate(
    params: BulkUpdateNewsletterParams
  ): Promise<BatchResult<NewsletterWithRelations>> {
    // Delegate to original API for bulk operations
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.bulkUpdate(params);
  },

  async markAsRead(id: string): Promise<NewsletterWithRelations> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.markAsRead(id);
  },

  async markAsUnread(id: string): Promise<NewsletterWithRelations> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.markAsUnread(id);
  },

  async toggleArchive(id: string): Promise<NewsletterWithRelations> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.toggleArchive(id);
  },

  async bulkArchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.bulkArchive(ids);
  },

  async bulkUnarchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.bulkUnarchive(ids);
  },

  async toggleLike(id: string): Promise<NewsletterWithRelations> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.toggleLike(id);
  },

  async getByTags(
    tagIds: string[],
    params: Omit<NewsletterQueryParams, 'tagIds'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    // Delegate to original API for tag filtering (this could be optimized later)
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.getByTags(tagIds, params);
  },

  async getBySource(
    sourceId: string,
    params: Omit<NewsletterQueryParams, 'sourceIds'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    // Use optimized API for source filtering
    return this.getAll({ ...params, sourceIds: [sourceId] });
  },

  async search(
    query: string,
    params: Omit<NewsletterQueryParams, 'search'> = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    // Delegate to original API for search (this could be optimized later)
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.search(query, params);
  },

  async getStats(): Promise<{
    total: number;
    read: number;
    unread: number;
    archived: number;
    liked: number;
  }> {
    // Delegate to original API for stats
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.getStats();
  },

  async countBySource(): Promise<Record<string, number>> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.countBySource();
  },

  async getTotalCountBySource(): Promise<Record<string, number>> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.getTotalCountBySource();
  },

  async getUnreadCountBySource(): Promise<Record<string, number>> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.getUnreadCountBySource();
  },

  async getUnreadCount(sourceId?: string | null): Promise<number> {
    // Delegate to original API
    const { newsletterApi } = await import('./newsletterApi');
    return newsletterApi.getUnreadCount(sourceId);
  },
};
