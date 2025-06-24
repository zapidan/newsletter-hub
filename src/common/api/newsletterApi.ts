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

// Transform raw Supabase response to our Newsletter type
const transformNewsletterResponse = (data: any): NewsletterWithRelations => {
  // Log the raw data we receive
  log.debug('Newsletter response transformation started', {
    component: 'NewsletterApi',
    action: 'transform_response',
    metadata: {
      id: data.id,
      newsletter_source_id: data.newsletter_source_id,
      hasSource: !!data.newsletter_sources,
      sourceType: typeof data.newsletter_sources,
    },
  });

  // Transform the source data if it exists
  let transformedSource = null;

  // Check for the source in the nested newsletter_sources object
  if (data.newsletter_sources) {
    const sourceData = Array.isArray(data.newsletter_sources)
      ? data.newsletter_sources[0]
      : data.newsletter_sources;

    if (sourceData) {
      transformedSource = {
        id: sourceData.id,
        name: sourceData.name || 'Unknown',
        from: sourceData.from || null,
        created_at: sourceData.created_at || new Date().toISOString(),
        updated_at: sourceData.updated_at || new Date().toISOString(),
        user_id: sourceData.user_id || null,
      };
    }
  }
  // Fallback to direct source property for backward compatibility
  else if (data.source && typeof data.source === 'object') {
    const source = data.source as any;
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
  const transformedTags: Tag[] = Array.isArray(data.tags)
    ? data.tags
      .map((t: { tag: any }) => {
        if (t.tag && typeof t.tag === 'object') {
          return {
            id: t.tag.id as string,
            name: t.tag.name as string,
            color: t.tag.color as string,
            user_id: t.tag.user_id as string,
            created_at: t.tag.created_at as string,
            newsletter_count: t.tag.newsletter_count as number | undefined,
          } as Tag;
        }
        return null;
      })
      .filter((tag: Tag | null): tag is Tag => tag !== null)
    : [];

  const { newsletter_sources, source: rawSource, tags: rawTags, ...restOfData } = data;

  const result: NewsletterWithRelations = {
    // Include all base Newsletter properties first
    ...restOfData,

    // Then include the transformed relations
    source: transformedSource,
    tags: transformedTags,
    is_archived: Boolean(data.is_archived), // Convert to boolean
    newsletter_source_id: data.newsletter_source_id as string,

    // Ensure all required Newsletter properties are present
    id: data.id as string,
    title: data.title as string,
    content: data.content as string,
    summary: data.summary as string,
    image_url: data.image_url as string,
    received_at: data.received_at as string,
    updated_at: data.updated_at as string,
    is_read: Boolean(data.is_read),
    is_liked: Boolean(data.is_liked),
    user_id: data.user_id as string,
    word_count: Number(data.word_count) || 0,
    estimated_read_time: Number(data.estimated_read_time) || 0,
  };

  // Log the transformed data
  log.debug('Newsletter response transformation completed', {
    component: 'NewsletterApi',
    action: 'transform_response_complete',
    metadata: {
      id: result.id,
      title: result.title,
      sourceId: result.newsletter_source_id,
      hasSource: !!result.source,
      hasTags: result.tags.length > 0,
    },
  });

  return result;
};

// Build query based on parameters
const buildNewsletterQuery = (params: NewsletterQueryParams = {}) => {
  // Build select clause
  let selectClause = '*, newsletter_source_id'; // Ensure newsletter_source_id is always selected
  const relations = [];

  // Always include source relation when sourceIds is provided or includeSource is true
  const shouldIncludeSource =
    params.includeSource || (params.sourceIds && params.sourceIds.length > 0);
  if (shouldIncludeSource) {
    // Include the relation with the source filter
    relations.push('source:newsletter_sources(id, name, from, created_at, updated_at, user_id)'); // Select specific source fields
  }
  if (params.includeTags) {
    relations.push('tags:newsletter_tags(tag:tags(id, name, color, user_id, created_at))'); // Select specific tag fields
  }

  if (relations.length > 0) {
    selectClause = `*, newsletter_source_id, ${relations.join(', ')}`;
  }

  // Start with base query and select
  let query = supabase.from('newsletters').select(selectClause, { count: 'exact' });

  // CRITICAL: Filter by user_id first to ensure data isolation
  if (params.user_id) {
    query = query.eq('user_id', params.user_id);
  }

  // Apply filters with proper chaining
  if (params.search) {
    query = query.or(
      `title.ilike.%${params.search}%, content.ilike.%${params.search}%, summary.ilike.%${params.search}%`
    );
  }

  if (params.isRead !== undefined) {
    query = query.eq('is_read', params.isRead);
  }

  if (params.isArchived !== undefined) {
    query = query.eq('is_archived', params.isArchived);
  }

  if (params.isLiked !== undefined) {
    query = query.eq('is_liked', params.isLiked);
  }

  // Apply source filter if sourceIds is provided
  if (params.sourceIds && params.sourceIds.length > 0) {
    log.debug('Applying source filter to newsletter query', {
      component: 'NewsletterApi',
      action: 'build_query_source_filter',
      metadata: {
        sourceIds: params.sourceIds,
        count: params.sourceIds.length,
      },
    });

    if (params.sourceIds.length === 1) {
      // Single source - use eq for better performance
      query = query.eq('newsletter_source_id', params.sourceIds[0]);
    } else {
      // Multiple sources - use in clause
      query = query.in('newsletter_source_id', params.sourceIds);
    }
  }

  if (params.dateFrom) {
    query = query.gte('received_at', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('received_at', params.dateTo);
  }

  // Apply ordering
  const orderColumn = params.orderBy || 'received_at';
  const ascending = params.ascending ?? false;
  query = query.order(orderColumn, { ascending });

  // Apply pagination
  if (params.limit) {
    query = query.limit(params.limit);
  }

  if (params.offset !== undefined) {
    const end = params.limit ? params.offset + params.limit - 1 : params.offset + 50 - 1;
    query = query.range(params.offset, end);
  }

  // Debug logging
  log.debug('Newsletter query build completed', {
    component: 'NewsletterApi',
    action: 'build_query_complete',
    metadata: {
      select: selectClause,
      filters: {
        sourceIds: params.sourceIds,
        isArchived: params.isArchived,
        isRead: params.isRead,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      },
      order: { column: orderColumn, ascending },
      limit: params.limit,
      offset: params.offset,
    },
  });

  return query;
};

// Newsletter API Service
export const newsletterApi = {
  // Get all newsletters with filters and pagination
  async getAll(
    params: NewsletterQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return withPerformanceLogging('newsletters.getAll', async () => {
      const user = await requireAuth();

      log.debug('Building newsletter query', {
        component: 'NewsletterApi',
        action: 'get_all_build_query',
        metadata: {
          ...params,
          sourceIds: params.sourceIds || null,
        },
      });

      // Build the query using buildNewsletterQuery
      const query = buildNewsletterQuery({
        ...params,
        user_id: user.id, // Pass user_id to ensure it's included in the query
      });

      log.debug('Executing newsletter query', {
        component: 'NewsletterApi',
        action: 'get_all_execute_query',
        metadata: {
          userId: user.id,
          sourceIds: params.sourceIds || null,
          isArchived: params.isArchived,
          isRead: params.isRead,
        },
      });

      const queryResult = await query;
      const { data, error, count } = queryResult;

      if (error) {
        log.error(
          'Newsletter query failed',
          {
            component: 'NewsletterApi',
            action: 'get_all_query_error',
            metadata: { userId: user.id, params },
          },
          error
        );
        handleSupabaseError(error);
      }

      log.debug('Newsletter query results retrieved', {
        component: 'NewsletterApi',
        action: 'get_all_query_results',
        metadata: {
          count: data?.length || 0,
          hasSourceIds: !!params.sourceIds,
          sourceIds: params.sourceIds || null,
          firstItem: data?.[0]
            ? {
              id: (data[0] as any).id,
              title: (data[0] as any).title,
              sourceId: (data[0] as any).newsletter_source_id,
              hasSource: !!(data[0] as any).source,
            }
            : null,
        },
      });

      // Log the raw response for the first item if available
      if (data?.[0]) {
        const firstItem = data[0] as any;
        log.debug('Newsletter raw data sample', {
          component: 'NewsletterApi',
          action: 'get_all_raw_data_sample',
          metadata: {
            id: firstItem.id,
            title: firstItem.title,
            sourceId: firstItem.newsletter_source_id,
            hasSource: !!firstItem.source,
          },
        });
      }

      // Transform the data
      let transformedData = (data || [])
        .map((item: any) => transformNewsletterResponse(item))
        .filter(Boolean);

      // Log the transformed data for the first item if available
      if (transformedData[0]) {
        log.debug('Newsletter transformed data sample', {
          component: 'NewsletterApi',
          action: 'get_all_transformed_data_sample',
          metadata: {
            id: transformedData[0].id,
            title: transformedData[0].title,
            sourceId: transformedData[0].newsletter_source_id,
            hasSource: !!transformedData[0].source,
          },
        });
      }

      // Handle tag filtering post-query with AND logic (newsletters must have ALL specified tags)
      if (params.tagIds?.length) {
        transformedData = transformedData.filter((newsletter) =>
          params.tagIds!.every((tagId) => newsletter.tags?.some((tag) => tag.id === tagId))
        );
      }

      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      const result = {
        data: transformedData,
        count: count || transformedData.length,
        page,
        limit,
        hasMore: transformedData.length === limit,
        nextPage: transformedData.length === limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };

      return result;
    });
  },

  // Get newsletter by ID
  async getById(id: string, includeRelations = true): Promise<NewsletterWithRelations | null> {
    return withPerformanceLogging('newsletters.getById', async () => {
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

      return data ? transformNewsletterResponse(data as any) : null;
    });
  },

  // Create new newsletter
  async create(params: CreateNewsletterParams): Promise<NewsletterWithRelations> {
    return withPerformanceLogging('newsletters.create', async () => {
      const user = await requireAuth();

      const { tag_ids, ...newsletterData } = params;

      // Create the newsletter first
      const { data: newsletter, error: newsletterError } = await supabase
        .from('newsletters')
        .insert({
          ...newsletterData,
          user_id: user.id,
          received_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (newsletterError) handleSupabaseError(newsletterError);

      // Add tags if provided
      if (tag_ids && tag_ids.length > 0) {
        const tagAssociations = tag_ids.map((tagId) => ({
          newsletter_id: newsletter.id,
          tag_id: tagId,
        }));

        const { error: tagError } = await supabase.from('newsletter_tags').insert(tagAssociations);

        if (tagError) handleSupabaseError(tagError);
      }

      // Fetch the complete newsletter with relations
      const createdNewsletter = await this.getById(newsletter.id);
      if (!createdNewsletter) {
        throw new Error('Failed to retrieve created newsletter');
      }

      return createdNewsletter;
    });
  },

  // Update newsletter
  async update(params: UpdateNewsletterParams): Promise<NewsletterWithRelations> {
    return withPerformanceLogging('newsletters.update', async () => {
      const user = await requireAuth();

      // Validate user ID
      if (!user?.id) {
        throw new Error('User authentication required for newsletter updates');
      }

      const { id, tag_ids, ...updateData } = params;

      // Validate newsletter ID
      if (!id) {
        throw new Error('Newsletter ID is required for updates');
      }

      // First, verify the newsletter exists and belongs to the user
      const existingNewsletter = await this.getById(id, false);
      if (!existingNewsletter) {
        throw new Error('Newsletter not found or you do not have permission to update it');
      }

      // Update the newsletter
      const { error: updateError } = await supabase
        .from('newsletters')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) handleSupabaseError(updateError);

      // Handle tag updates if provided
      if (tag_ids !== undefined) {
        try {
          // Remove existing tags (with user_id validation)
          const { error: deleteError } = await supabase
            .from('newsletter_tags')
            .delete()
            .eq('newsletter_id', id)
            .eq('user_id', user.id);

          if (deleteError) {
            throw new Error(`Failed to remove existing tags: ${deleteError.message}`);
          }

          // Add new tags
          if (tag_ids.length > 0) {
            const tagAssociations = tag_ids.map((tagId) => ({
              newsletter_id: id,
              tag_id: tagId,
              user_id: user.id,
            }));

            const { error: tagError } = await supabase
              .from('newsletter_tags')
              .insert(tagAssociations);

            if (tagError) {
              throw new Error(`Failed to add new tags: ${tagError.message}`);
            }
          }
        } catch (error) {
          // If tag operations fail, we should still return the updated newsletter
          // but log the error for debugging
          log.error(
            'Tag update failed for newsletter',
            {
              component: 'NewsletterApi',
              action: 'update_newsletter_tags',
              metadata: { newsletterId: id },
            },
            error instanceof Error ? error : new Error(String(error))
          );
          throw new Error(
            `Tag update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Fetch the updated newsletter with relations
      const updatedNewsletter = await this.getById(id);
      if (!updatedNewsletter) {
        throw new Error('Failed to retrieve updated newsletter');
      }

      return updatedNewsletter;
    });
  },

  // Delete newsletter (hard delete)
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging('newsletters.delete', async () => {
      try {
        const user = await requireAuth();
        const logContext = {
          newsletterId: id,
          userId: user.id,
          timestamp: new Date().toISOString()
        };

        log.debug('🔍 Starting delete operation', logContext);

        // Validate the ID format first
        if (!id || typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          log.error('❌ Invalid newsletter ID format', {
            ...logContext,
            id,
            type: typeof id
          });
          return false;
        }

        // Verify the newsletter exists and check ownership
        log.debug('🔍 Verifying newsletter ownership', logContext);
        const { data: existingNewsletter, error: fetchError } = await supabase
          .from('newsletters')
          .select('id, user_id')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) {
          log.error('❌ Error fetching newsletter', {
            ...logContext,
            error: fetchError
          });
          return false;
        }

        if (!existingNewsletter) {
          log.warn('⚠️ Newsletter not found', logContext);
          return false;
        }

        if (existingNewsletter.user_id !== user.id) {
          log.warn('⚠️ Access denied: Newsletter does not belong to user', {
            ...logContext,
            ownerId: existingNewsletter.user_id,
            requestingUserId: user.id
          });
          return false;
        }

        // Perform the delete
        log.debug('🗑️ Attempting to delete newsletter', logContext);
        const { error: deleteError } = await supabase
          .from('newsletters')
          .delete()
          .eq('id', id);

        if (deleteError) {
          log.error('❌ Delete operation failed', {
            ...logContext,
            error: deleteError
          });
          return false;
        }

        // Verify the newsletter was actually deleted
        log.debug('🔍 Verifying newsletter deletion', logContext);
        const { data: deletedNewsletter, error: verifyError } = await supabase
          .from('newsletters')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (verifyError) {
          log.error('❌ Error verifying deletion', {
            ...logContext,
            error: verifyError
          });
          return false;
        }

        if (deletedNewsletter) {
          log.error('❌ Newsletter still exists after delete operation', logContext);
          return false;
        }

        log.info('✅ Newsletter successfully deleted', logContext);
        return true;

      } catch (error) {
        log.error('❌ Unexpected error in delete operation', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error
        });
        return false;
      }
    });
  },

  // Bulk update newsletters
  async bulkUpdate(
    params: BulkUpdateNewsletterParams,
  ): Promise<BatchResult<NewsletterWithRelations>> {
    return withPerformanceLogging('newsletters.bulkUpdate', async () => {
      const user = await requireAuth();

      const { ids, updates } = params;
      const results: (NewsletterWithRelations | null)[] = [];
      const errors: (Error | null)[] = [];

      const { data, error } = await supabase
        .from('newsletters')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
        .eq('user_id', user.id)
        .select();

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map(transformNewsletterResponse);
        ids.forEach((id) => {
          const result = transformedResults.find((r) => r.id === id);
          results.push(result || null);
          errors.push(result ? null : new Error('Newsletter not found or not updated'));
        });
      }

      return {
        results,
        errors,
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
      };
    });
  },

  // Mark as read
  async markAsRead(id: string): Promise<NewsletterWithRelations> {
    return this.update({ id, is_read: true });
  },

  // Mark as unread
  async markAsUnread(id: string): Promise<NewsletterWithRelations> {
    return this.update({ id, is_read: false });
  },

  // Toggle archive status
  async toggleArchive(id: string): Promise<NewsletterWithRelations> {
    const newsletter = await this.getById(id, false);
    if (!newsletter) {
      throw new Error('Newsletter not found');
    }

    return this.update({ id, is_archived: !newsletter.is_archived });
  },

  // Bulk archive
  async bulkArchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    return this.bulkUpdate({ ids, updates: { is_archived: true } });
  },

  // Bulk unarchive
  async bulkUnarchive(ids: string[]): Promise<BatchResult<NewsletterWithRelations>> {
    return this.bulkUpdate({ ids, updates: { is_archived: false } });
  },

  // Toggle like status
  async toggleLike(id: string): Promise<NewsletterWithRelations> {
    const newsletter = await this.getById(id, false);
    if (!newsletter) {
      throw new Error('Newsletter not found');
    }

    return this.update({ id, is_liked: !newsletter.is_liked });
  },

  // Get newsletters by tag
  async getByTag(
    tagId: string,
    params: Omit<NewsletterQueryParams, 'tagIds'> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getAll({ ...params, tagIds: [tagId] });
  },

  // Get newsletters by source
  async getBySource(
    sourceId: string,
    params: Omit<NewsletterQueryParams, 'sourceIds'> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getAll({ ...params, sourceIds: [sourceId] });
  },

  // Search newsletters
  async search(
    query: string,
    params: Omit<NewsletterQueryParams, 'search'> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return newsletterApi.getAll({ ...params, search: query });
  },

  // Get reading statistics
  async getStats(): Promise<{
    total: number;
    read: number;
    unread: number;
    archived: number;
    liked: number;
  }> {
    return withPerformanceLogging('newsletters.getStats', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletters')
        .select('is_read, is_archived, is_liked')
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);

      const stats = {
        total: data?.length || 0,
        read: data?.filter((n) => n.is_read).length || 0,
        unread: data?.filter((n) => !n.is_read).length || 0,
        archived: data?.filter((n) => n.is_archived).length || 0,
        liked: data?.filter((n) => n.is_liked).length || 0,
      };

      return stats;
    });
  },

  // Count newsletters by source (excluding archived)
  async countBySource(): Promise<Record<string, number>> {
    return withPerformanceLogging('newsletters.countBySource', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletters')
        .select('newsletter_source_id')
        .eq('user_id', user.id)
        .eq('is_archived', false);

      if (error) handleSupabaseError(error);

      const counts: Record<string, number> = {};

      data?.forEach((newsletter: { newsletter_source_id: string | null }) => {
        const sourceId = newsletter.newsletter_source_id || 'unknown';
        counts[sourceId] = (counts[sourceId] || 0) + 1;
      });

      log.debug('Newsletter counts by source retrieved', {
        component: 'NewsletterApi',
        action: 'count_by_source',
        metadata: { counts },
      });

      return counts;
    });
  },

  // Get total counts grouped by source (excluding archived)
  async getTotalCountBySource(): Promise<Record<string, number>> {
    return withPerformanceLogging('newsletters.getTotalCountBySource', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletters')
        .select('newsletter_source_id')
        .eq('user_id', user.id)
        .eq('is_archived', false);

      if (error) handleSupabaseError(error);

      const totalCounts: Record<string, number> = {};

      data?.forEach((newsletter: { newsletter_source_id: string | null }) => {
        const sourceId = newsletter.newsletter_source_id || 'unknown';
        totalCounts[sourceId] = (totalCounts[sourceId] || 0) + 1;
      });

      log.debug('Total newsletter counts by source retrieved', {
        component: 'NewsletterApi',
        action: 'total_count_by_source',
        metadata: { totalCounts },
      });

      return totalCounts;
    });
  },

  // Get unread counts grouped by source
  async getUnreadCountBySource(): Promise<Record<string, number>> {
    return withPerformanceLogging('newsletters.getUnreadCountBySource', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletters')
        .select('newsletter_source_id')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) handleSupabaseError(error);

      const unreadCounts: Record<string, number> = {};

      data?.forEach((newsletter: { newsletter_source_id: string | null }) => {
        const sourceId = newsletter.newsletter_source_id || 'unknown';
        unreadCounts[sourceId] = (unreadCounts[sourceId] || 0) + 1;
      });

      return unreadCounts;
    });
  },

  // Get unread count for a specific source or all sources
  async getUnreadCount(sourceId?: string | null): Promise<number> {
    return withPerformanceLogging('newsletters.getUnreadCount', async () => {
      const user = await requireAuth();

      let query = supabase
        .from('newsletters')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false);

      // Apply source filter if provided
      if (sourceId) {
        query = query.eq('newsletter_source_id', sourceId);
      }

      const { count, error } = await query;

      if (error) {
        log.error(
          'Failed to get unread count',
          {
            component: 'NewsletterApi',
            action: 'get_unread_count',
            metadata: { sourceId, userId: user.id },
          },
          error,
        );
        handleSupabaseError(error);
      }

      log.debug('Unread count retrieved', {
        component: 'NewsletterApi',
        action: 'get_unread_count',
        metadata: { count, sourceId },
      });

      return count || 0;
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getAll: getAllNewsletters,
  getById: getNewsletterById,
  create: createNewsletter,
  update: updateNewsletter,
  delete: deleteNewsletter,
  bulkUpdate: bulkUpdateNewsletters,
  markAsRead,
  markAsUnread,
  toggleArchive,
  bulkArchive,
  bulkUnarchive,
  toggleLike,
  getByTag: getNewslettersByTag,
  getBySource: getNewslettersBySource,
  search: searchNewsletters,
  getStats: getNewsletterStats,
  countBySource,
  getUnreadCountBySource,
  getUnreadCount,
} = newsletterApi;

export default newsletterApi;
