import { supabase, handleSupabaseError, requireAuth, withPerformanceLogging } from './supabaseClient';
import { NewsletterSource } from '../types';
import {
  NewsletterSourceQueryParams,
  CreateNewsletterSourceParams,
  UpdateNewsletterSourceParams,
  PaginatedResponse,
  BatchResult
} from '../types/api';

// Build query based on parameters
const buildNewsletterSourceQuery = (params: NewsletterSourceQueryParams = {}) => {
  let query = supabase.from('newsletter_sources');

  // Select clause
  let selectClause = '*';
  if (params.includeCount) {
    selectClause = `
      *,
      newsletter_count:newsletters(count)
    `;
  }

  query = query.select(selectClause);

  // Apply filters
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%, domain.ilike.%${params.search}%`);
  }

  if (params.excludeArchived) {
    query = query.eq('is_archived', false);
  }

  // Ordering
  const orderColumn = params.orderBy || 'created_at';
  const ascending = params.ascending ?? false;
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

// Transform raw Supabase response to our NewsletterSource type
const transformNewsletterSourceResponse = (data: any): NewsletterSource => {
  return {
    ...data,
    newsletter_count: data.newsletter_count?.[0]?.count || data.newsletter_count || 0,
    is_archived: data.is_archived || false,
  };
};

// Newsletter Source API Service
export const newsletterSourceApi = {
  // Get all newsletter sources with filters and pagination
  async getAll(params: NewsletterSourceQueryParams = {}): Promise<PaginatedResponse<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.getAll', async () => {
      const user = await requireAuth();

      let query = buildNewsletterSourceQuery(params);
      query = query.eq('user_id', user.id);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      const transformedData = (data || []).map(transformNewsletterSourceResponse);

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

      let selectClause = '*';
      if (includeCount) {
        selectClause = `
          *,
          newsletter_count:newsletters(count)
        `;
      }

      const { data, error } = await supabase
        .from('newsletter_sources')
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

      return data ? transformNewsletterSourceResponse(data) : null;
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

      if (!params.domain?.trim()) {
        throw new Error('Newsletter source domain is required');
      }

      // Check for duplicate domain for this user
      const { data: existing } = await supabase
        .from('newsletter_sources')
        .select('id')
        .eq('domain', params.domain.trim().toLowerCase())
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .single();

      if (existing) {
        throw new Error('A newsletter source with this domain already exists');
      }

      const { data: source, error } = await supabase
        .from('newsletter_sources')
        .insert({
          name: params.name.trim(),
          domain: params.domain.trim().toLowerCase(),
          user_id: user.id,
          is_archived: false,
        })
        .select()
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

      // Validate domain if provided and check for duplicates
      if (updateData.domain !== undefined) {
        if (!updateData.domain?.trim()) {
          throw new Error('Newsletter source domain cannot be empty');
        }

        const normalizedDomain = updateData.domain.trim().toLowerCase();
        const { data: existing } = await supabase
          .from('newsletter_sources')
          .select('id')
          .eq('domain', normalizedDomain)
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .neq('id', id)
          .single();

        if (existing) {
          throw new Error('A newsletter source with this domain already exists');
        }

        updateData.domain = normalizedDomain;
      }

      const { data: source, error } = await supabase
        .from('newsletter_sources')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
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
        throw new Error('Cannot delete newsletter source that has associated newsletters. Archive it instead.');
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
        .select();

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map(transformNewsletterSourceResponse);
        ids.forEach(id => {
          const result = transformedResults.find(r => r.id === id);
          results.push(result || null);
          errors.push(result ? null : new Error('Newsletter source not found or not updated'));
        });
      }

      return {
        results,
        errors,
        successCount: results.filter(r => r !== null).length,
        errorCount: errors.filter(e => e !== null).length,
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
        .select();

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map(transformNewsletterSourceResponse);
        ids.forEach(id => {
          const result = transformedResults.find(r => r.id === id);
          results.push(result || null);
          errors.push(result ? null : new Error('Newsletter source not found or not updated'));
        });
      }

      return {
        results,
        errors,
        successCount: results.filter(r => r !== null).length,
        errorCount: errors.filter(e => e !== null).length,
      };
    });
  },

  // Search newsletter sources
  async search(query: string, params: Omit<NewsletterSourceQueryParams, 'search'> = {}): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, search: query });
  },

  // Get sources with newsletter counts
  async getWithCounts(params: Omit<NewsletterSourceQueryParams, 'includeCount'> = {}): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, includeCount: true });
  },

  // Get active (non-archived) sources
  async getActive(params: Omit<NewsletterSourceQueryParams, 'excludeArchived'> = {}): Promise<PaginatedResponse<NewsletterSource>> {
    return this.getAll({ ...params, excludeArchived: true });
  },

  // Get archived sources
  async getArchived(params: NewsletterSourceQueryParams = {}): Promise<PaginatedResponse<NewsletterSource>> {
    return withPerformanceLogging('newsletter_sources.getArchived', async () => {
      const user = await requireAuth();

      let query = buildNewsletterSourceQuery(params);
      query = query.eq('user_id', user.id).eq('is_archived', true);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      const transformedData = (data || []).map(transformNewsletterSourceResponse);

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
        active: sources?.filter(s => !s.is_archived).length || 0,
        archived: sources?.filter(s => s.is_archived).length || 0,
        totalNewsletters: newsletters?.length || 0,
      };

      return stats;
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
  search: searchNewsletterSources,
  getWithCounts: getNewsletterSourcesWithCounts,
  getActive: getActiveNewsletterSources,
  getArchived: getArchivedNewsletterSources,
  getStats: getNewsletterSourceStats,
} = newsletterSourceApi;

export default newsletterSourceApi;
