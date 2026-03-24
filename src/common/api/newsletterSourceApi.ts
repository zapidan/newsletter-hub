import { NewsletterSource } from '../types';
import {
  BatchResult,
  CreateNewsletterSourceParams,
  NewsletterSourceQueryParams,
  PaginatedResponse,
  UpdateNewsletterSourceParams,
} from '../types/api';
import {
  handleSupabaseError,
  requireAuth,
  supabase,
  withPerformanceLogging,
} from './supabaseClient';

// Build query based on parameters
const buildNewsletterSourceQuery = (params: NewsletterSourceQueryParams = {}) => {
  let query = supabase.from('newsletter_sources').select(`
    id,
    name,
    from,
    is_archived,
    created_at,
    updated_at,
    user_id
  `);

  // Apply filters
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%, from.ilike.%${params.search}%`);
  }

  if (params.excludeArchived) {
    query = query.eq('is_archived', false);
  }

  // Ordering
  const orderColumn = params.orderBy || 'created_at';
  const ascending = params.orderDirection !== 'desc';
  query = query.order(orderColumn, { ascending });

  // Pagination
  if (params.limit) {
    query = query.limit(params.limit);
  }

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
  }

  return query;
};

// Get newsletter counts for sources
const getNewsletterCountsForSources = async (
  sourceIds: string[],
  userId: string,
  filters: {
    dateFrom?: string;
    dateTo?: string;
    isArchived?: boolean;
    isRead?: boolean;
    isLiked?: boolean;
    tagIds?: string[];
    sourceIds?: string[];
  }
): Promise<{
  totalCounts: Record<string, number>;
  unreadCounts: Record<string, number>;
}> => {
  if (sourceIds.length === 0) {
    return { totalCounts: {}, unreadCounts: {} };
  }

  let query = supabase
    .from('newsletters')
    .select('newsletter_source_id, is_read, is_archived, is_liked')
    .eq('user_id', userId);

  // Apply date filter
  if (filters.dateFrom) {
    query = query.gte('received_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('received_at', filters.dateTo);
  }

  // Apply newsletter-level filters
  if (filters.isArchived !== undefined) {
    query = query.eq('is_archived', filters.isArchived);
  }
  if (filters.isRead !== undefined) {
    query = query.eq('is_read', filters.isRead);
  }
  if (filters.isLiked !== undefined) {
    query = query.eq('is_liked', filters.isLiked);
  }

  // Apply source filter if provided (for individual source selection)
  if (filters.sourceIds && filters.sourceIds.length > 0) {
    query = query.in('newsletter_source_id', filters.sourceIds);
  }

  // Apply tag filter if provided
  if (filters.tagIds && filters.tagIds.length > 0) {
    // Get newsletters that have all specified tags
    const { data: newslettersWithTags, error: tagError } = await supabase
      .from('newsletter_tags')
      .select('newsletter_id')
      .in('tag_id', filters.tagIds);

    if (tagError) handleSupabaseError(tagError);

    if (newslettersWithTags && newslettersWithTags.length > 0) {
      // Count occurrences of each newsletter_id
      const tagCounts: Record<string, number> = {};
      newslettersWithTags.forEach(({ newsletter_id }) => {
        tagCounts[newsletter_id] = (tagCounts[newsletter_id] || 0) + 1;
      });

      // Get newsletters that have ALL specified tags
      const newsletterIdsWithAllTags = Object.entries(tagCounts)
        .filter(([_, count]) => count === filters.tagIds!.length)
        .map(([newsletter_id, _]) => newsletter_id);

      if (newsletterIdsWithAllTags.length === 0) {
        return { totalCounts: {}, unreadCounts: {} };
      }

      query = query.in('id', newsletterIdsWithAllTags);
    } else {
      return { totalCounts: {}, unreadCounts: {} };
    }
  }

  const { data: aggregatedData, error: aggregatedError } = await query;

  if (aggregatedError) handleSupabaseError(aggregatedError);

  // Debug: Show what filters were applied for count calculation
  console.log('=== Count Calculation Debug ===');
  console.log('Filters for counts:', filters);
  console.log('Newsletters found for counts:', aggregatedData?.length || 0);

  const totalCounts: Record<string, number> = {};
  const unreadCounts: Record<string, number> = {};

  aggregatedData?.forEach((newsletter: { newsletter_source_id: string | null; is_read: boolean; is_archived: boolean; is_liked: boolean }) => {
    if (newsletter.newsletter_source_id) {
      totalCounts[newsletter.newsletter_source_id] =
        (totalCounts[newsletter.newsletter_source_id] || 0) + 1;

      if (!newsletter.is_archived && !newsletter.is_read) {
        unreadCounts[newsletter.newsletter_source_id] =
          (unreadCounts[newsletter.newsletter_source_id] || 0) + 1;
      }
    }
  });

  return { totalCounts, unreadCounts };
};

// Transform raw Supabase response to our NewsletterSource type
const transformNewsletterSourceResponse = (
  data: NewsletterSource | null,
  totalCount = 0,
  unreadCount = 0
): NewsletterSource => {
  if (!data) {
    throw new Error('Newsletter source data is null');
  }

  return {
    ...data,
    newsletter_count: totalCount,
    unread_count: unreadCount,
    is_archived: data.is_archived || false,
  };
};

// Newsletter Source API Service
export const newsletterSourceApi = {
  // Get all newsletter sources with filters and pagination
  async getAll(
    params: NewsletterSourceQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.getAll', async () => {
      const user = await requireAuth();
      let query = buildNewsletterSourceQuery(params);
      query = query.eq('user_id', user.id);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      let transformedData: NewsletterSource[];

      if (params.includeCount && data && data.length > 0) {
        // Get counts for all sources (don't filter sources, just calculate counts)
        const sourceIds = data.map((source: NewsletterSource) => source.id);

        const { totalCounts, unreadCounts } = await getNewsletterCountsForSources(
          sourceIds,
          user.id,
          {
            dateFrom: params.timeFilter?.dateFrom,
            dateTo: params.timeFilter?.dateTo,
            isArchived: params.isArchived,
            isRead: params.isRead,
            isLiked: params.isLiked,
            tagIds: params.tagIds,
            sourceIds: params.sourceIds, // Pass sourceIds filter
          }
        );

        transformedData = data.map((source: NewsletterSource) => {
          const totalCount = totalCounts[source.id] || 0;
          const unreadCount = unreadCounts[source.id] || 0;

          return transformNewsletterSourceResponse(
            source as NewsletterSource,
            totalCount,
            unreadCount
          );
        });
      } else {
        transformedData = (data || []).map((source: NewsletterSource) =>
          transformNewsletterSourceResponse(source)
        );
      }

      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      return {
        data: transformedData,
        count: count || transformedData.length,
        page,
        limit,
        hasMore: transformedData.length === limit,
        nextPage: transformedData.length === limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };
    });
  },

  // Get newsletter source by ID
  async getById(id: string, includeCount = false): Promise<NewsletterSource | null> {
    return withPerformanceLogging('newsletter_sources.getById', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletter_sources')
        .select(`
          id,
          name,
          from,
          is_archived,
          created_at,
          updated_at,
          user_id
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      if (!data) return null;

      if (includeCount) {
        const { totalCounts, unreadCounts } = await getNewsletterCountsForSources([id], user.id);
        return transformNewsletterSourceResponse(data, totalCounts[id] || 0, unreadCounts[id] || 0);
      }

      return transformNewsletterSourceResponse(data);
    });
  },

  // Create new newsletter source
  async create(params: CreateNewsletterSourceParams): Promise<NewsletterSource> {
    return withPerformanceLogging('newsletter_sources.create', async () => {
      const user = await requireAuth();

      // Validate required fields
      if (!params.name?.trim()) {
        throw new Error('Newsletter source name is required');
      }

      if (!params.from?.trim()) {
        throw new Error('Newsletter source from email is required');
      }

      // Check for duplicate from email for this user
      const { data: existing } = await supabase
        .from('newsletter_sources')
        .select('id')
        .eq('from', params.from.trim().toLowerCase())
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .single();

      if (existing) {
        throw new Error('A newsletter source with this from email already exists');
      }

      const { data: source, error } = await supabase
        .from('newsletter_sources')
        .insert({
          name: params.name.trim(),
          from: params.from.trim().toLowerCase(),
          user_id: user.id,
          is_archived: false,
        })
        .select(`
          id,
          name,
          from,
          is_archived,
          created_at,
          updated_at,
          user_id
        `)
        .single();

      if (error) handleSupabaseError(error);

      return transformNewsletterSourceResponse(source);
    });
  },

  // Update newsletter source
  async update(params: UpdateNewsletterSourceParams): Promise<NewsletterSource> {
    return withPerformanceLogging('newsletter_sources.update', async () => {
      const user = await requireAuth();

      const { id, ...updateData } = params;

      // Validate name if provided
      if (updateData.name !== undefined && !updateData.name?.trim()) {
        throw new Error('Newsletter source name cannot be empty');
      }

      // Validate from email if provided and check for duplicates
      if (updateData.from !== undefined) {
        if (!updateData.from?.trim()) {
          throw new Error('Newsletter source from email cannot be empty');
        }

        const normalizedFrom = updateData.from.trim().toLowerCase();
        const { data: existing } = await supabase
          .from('newsletter_sources')
          .select('id')
          .eq('from', normalizedFrom)
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .neq('id', id)
          .single();

        if (existing) {
          throw new Error('A newsletter source with this from email already exists');
        }

        updateData.from = normalizedFrom;
      }

      const { data: source, error } = await supabase
        .from('newsletter_sources')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          id,
          name,
          from,
          is_archived,
          created_at,
          updated_at,
          user_id
        `)
        .single();

      if (error) handleSupabaseError(error);

      return transformNewsletterSourceResponse(source);
    });
  },

  // Delete newsletter source
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging('newsletter_sources.delete', async () => {
      const user = await requireAuth();

      // Check if source has associated newsletters
      const { data: newsletters, error: newsletterError } = await supabase
        .from('newsletters')
        .select('id')
        .eq('newsletter_source_id', id)
        .eq('user_id', user.id)
        .limit(1);

      if (newsletterError) handleSupabaseError(newsletterError);

      if (newsletters && newsletters.length > 0) {
        throw new Error(
          'Cannot delete newsletter source that has associated newsletters. Archive it instead.'
        );
      }

      const { error } = await supabase
        .from('newsletter_sources')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Archive newsletter source
  async archive(id: string): Promise<NewsletterSource> {
    return this.update({ id, is_archived: true });
  },

  // Unarchive newsletter source
  async unarchive(id: string): Promise<NewsletterSource> {
    return this.update({ id, is_archived: false });
  },

  // Toggle archive status
  async toggleArchive(id: string): Promise<NewsletterSource> {
    const source = await this.getById(id);
    if (!source) {
      throw new Error('Newsletter source not found');
    }

    return this.update({ id, is_archived: !source.is_archived });
  },

  // Bulk archive sources
  async bulkArchive(ids: string[]): Promise<BatchResult<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.bulkArchive', async () => {
      const user = await requireAuth();

      const results: (NewsletterSource | null)[] = [];
      const errors: (Error | null)[] = [];

      const { data, error } = await supabase
        .from('newsletter_sources')
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
        .eq('user_id', user.id)
        .select(`
          id,
          name,
          from,
          is_archived,
          created_at,
          updated_at,
          user_id
        `);

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map((source) =>
          transformNewsletterSourceResponse(source)
        );
        ids.forEach((id) => {
          const result = transformedResults.find((r) => r.id === id);
          results.push(result || null);
          errors.push(result ? null : new Error('Newsletter source not found or not updated'));
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

  // Bulk unarchive sources
  async bulkUnarchive(ids: string[]): Promise<BatchResult<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.bulkUnarchive', async () => {
      const user = await requireAuth();

      const results: (NewsletterSource | null)[] = [];
      const errors: (Error | null)[] = [];

      const { data, error } = await supabase
        .from('newsletter_sources')
        .update({
          is_archived: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
        .eq('user_id', user.id)
        .select(`
          id,
          name,
          from,
          is_archived,
          created_at,
          updated_at,
          user_id
        `);

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map((source) =>
          transformNewsletterSourceResponse(source)
        );
        ids.forEach((id) => {
          const result = transformedResults.find((r) => r.id === id);
          results.push(result || null);
          errors.push(result ? null : new Error('Newsletter source not found or not updated'));
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

  // Search newsletter sources
  async search(
    query: string,
    params: Omit<NewsletterSourceQueryParams, 'search'> = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, search: query });
  },

  // Get sources with newsletter counts
  async getWithCounts(
    params: Omit<NewsletterSourceQueryParams, 'includeCount'> = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, includeCount: true });
  },

  // Get active (non-archived) sources
  async getActive(
    params: Omit<NewsletterSourceQueryParams, 'excludeArchived'> = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, excludeArchived: true });
  },

  // Get archived sources
  async getArchived(
    params: NewsletterSourceQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.getArchived', async () => {
      const user = await requireAuth();

      let query = buildNewsletterSourceQuery(params);
      query = query.eq('user_id', user.id).eq('is_archived', true);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      const transformedData = (data || []).map((source) =>
        transformNewsletterSourceResponse(source)
      );

      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      return {
        data: transformedData,
        count: count || transformedData.length,
        page,
        limit,
        hasMore: transformedData.length === limit,
        nextPage: transformedData.length === limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };
    });
  },

  // Get newsletter source statistics
  async getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    totalNewsletters: number;
  }> {
    return withPerformanceLogging('newsletter_sources.getStats', async () => {
      const user = await requireAuth();

      const { data: sources, error: sourcesError } = await supabase
        .from('newsletter_sources')
        .select('is_archived')
        .eq('user_id', user.id);

      if (sourcesError) handleSupabaseError(sourcesError);

      const { data: newsletters, error: newslettersError } = await supabase
        .from('newsletters')
        .select('id')
        .eq('user_id', user.id)
        .not('newsletter_source_id', 'is', null);

      if (newslettersError) handleSupabaseError(newslettersError);

      const stats = {
        total: sources?.length || 0,
        active: sources?.filter((s) => !s.is_archived).length || 0,
        archived: sources?.filter((s) => s.is_archived).length || 0,
        totalNewsletters: newsletters?.length || 0,
      };

      return stats;
    });
  },

  // Bulk update newsletter sources
  async bulkUpdate(
    updates: Array<{ id: string; updates: UpdateNewsletterSourceParams }>
  ): Promise<BatchResult<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.bulkUpdate', async () => {
      const user = await requireAuth();

      const results: (NewsletterSource | null)[] = [];
      const errors: (Error | null)[] = [];

      // Process each update individually to maintain data consistency
      for (const update of updates) {
        try {
          const { data, error } = await supabase
            .from('newsletter_sources')
            .update({
              ...update.updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id)
            .eq('user_id', user.id)
            .select(`
              id,
              name,
              from,
              is_archived,
              created_at,
              updated_at,
              user_id
            `)
            .single();

          if (error) {
            results.push(null);
            errors.push(new Error(error.message));
          } else {
            results.push(transformNewsletterSourceResponse(data));
            errors.push(null);
          }
        } catch (error) {
          results.push(null);
          errors.push(error instanceof Error ? error : new Error('Unknown error'));
        }
      }

      return {
        results,
        errors,
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
      };
    });
  },

  // Bulk delete newsletter sources
  async bulkDelete(ids: string[]): Promise<BatchResult<boolean>> {
    return withPerformanceLogging('newsletter_sources.bulkDelete', async () => {
      const user = await requireAuth();

      const results: (boolean | null)[] = [];
      const errors: (Error | null)[] = [];

      // Process each deletion individually to maintain data consistency
      for (const id of ids) {
        try {
          const { error } = await supabase
            .from('newsletter_sources')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

          if (error) {
            results.push(null);
            errors.push(new Error(error.message));
          } else {
            results.push(true);
            errors.push(null);
          }
        } catch (error) {
          results.push(null);
          errors.push(error instanceof Error ? error : new Error('Unknown error'));
        }
      }

      return {
        results,
        errors,
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
      };
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getAll: getAllNewsletterSources,
  getById: getNewsletterSourceById,
  create: createNewsletterSource,
  update: updateNewsletterSource,
  delete: deleteNewsletterSource,
  archive: archiveNewsletterSource,
  unarchive: unarchiveNewsletterSource,
  toggleArchive: toggleArchiveNewsletterSource,
  bulkArchive: bulkArchiveNewsletterSources,
  bulkUnarchive: bulkUnarchiveNewsletterSources,
  bulkUpdate: bulkUpdateNewsletterSources,
  bulkDelete: bulkDeleteNewsletterSources,
  search: searchNewsletterSources,
  getWithCounts: getNewsletterSourcesWithCounts,
  getActive: getActiveNewsletterSources,
  getArchived: getArchivedNewsletterSources,
  getStats: getNewsletterSourceStats,
} = newsletterSourceApi;

export default newsletterSourceApi;
