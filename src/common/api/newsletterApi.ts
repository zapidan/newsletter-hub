import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import { NewsletterWithRelations } from "../types";
import {
  NewsletterQueryParams,
  CreateNewsletterParams,
  UpdateNewsletterParams,
  BulkUpdateNewsletterParams,
  PaginatedResponse,
  BatchResult,
} from "../types/api";

// Transform raw Supabase response to our Newsletter type
const transformNewsletterResponse = (data: any): NewsletterWithRelations => {
  // Log the raw data we receive
  console.log("🔄 [transformNewsletterResponse] Raw data:", {
    id: data.id,
    newsletter_source_id: data.newsletter_source_id,
    hasSource: !!data.newsletter_sources,
    sourceType: typeof data.newsletter_sources,
    rawSource: data.newsletter_sources,
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
        name: sourceData.name || "Unknown",
        domain: sourceData.domain || null,
        created_at: sourceData.created_at || new Date().toISOString(),
        updated_at: sourceData.updated_at || new Date().toISOString(),
        user_id: sourceData.user_id || null,
      };
    }
  }
  // Fallback to direct source property for backward compatibility
  else if (data.source) {
    transformedSource = {
      id: data.source.id,
      name: data.source.name || "Unknown",
      domain: data.source.domain || null,
      created_at: data.source.created_at || new Date().toISOString(),
      updated_at: data.source.updated_at || new Date().toISOString(),
      user_id: data.source.user_id || null,
    };
  }

  // Transform tags if they exist
  const transformedTags = Array.isArray(data.tags)
    ? data.tags.map((t: any) => t.tag).filter(Boolean)
    : [];

  const result = {
    ...data,
    source: transformedSource,
    tags: transformedTags,
    // Ensure newsletter_source_id is always set, even if null
    newsletter_source_id: data.newsletter_source_id || null,
  };

  // Log the transformed data
  console.log("✅ [transformNewsletterResponse] Transformed data:", {
    id: result.id,
    title: result.title,
    sourceId: result.newsletter_source_id,
    hasSource: !!result.source,
    source: result.source,
    hasTags: result.tags.length > 0,
  });

  return result;
};

// Build query based on parameters
const buildNewsletterQuery = (params: NewsletterQueryParams = {}) => {
  // Start with base query
  let query = supabase.from("newsletters");

  // Build select clause
  let selectClause = "*";
  const relations = [];

  // Always include source relation when sourceIds is provided or includeSource is true
  const shouldIncludeSource =
    params.includeSource || (params.sourceIds && params.sourceIds.length > 0);
  if (shouldIncludeSource) {
    // Include the relation with the source filter
    relations.push("source:newsletter_sources(*)");
  }
  if (params.includeTags) relations.push("tags:newsletter_tags(tag:tags(*))");

  if (relations.length > 0) {
    selectClause = `*, ${relations.join(", ")}`;
  }

  // Start with select
  query = query.select(selectClause);

  // CRITICAL: Filter by user_id first to ensure data isolation
  if (params.user_id) {
    query = query.eq("user_id", params.user_id);
  }

  // Apply filters with proper chaining
  if (params.search) {
    query = query.or(
      `title.ilike.%${params.search}%, content.ilike.%${params.search}%, summary.ilike.%${params.search}%`,
    );
  }

  if (params.isRead !== undefined) {
    query = query.eq("is_read", params.isRead);
  }

  if (params.isArchived !== undefined) {
    query = query.eq("is_archived", params.isArchived);
  }

  if (params.isLiked !== undefined) {
    query = query.eq("is_liked", params.isLiked);
  }

  // Apply source filter if sourceIds is provided
  if (params.sourceIds && params.sourceIds.length > 0) {
    console.log("🔍 [buildNewsletterQuery] Applying source filter:", {
      sourceIds: params.sourceIds,
      count: params.sourceIds.length,
    });

    if (params.sourceIds.length === 1) {
      // Single source - use eq for better performance
      query = query.eq("newsletter_source_id", params.sourceIds[0]);
    } else {
      // Multiple sources - use in clause
      query = query.in("newsletter_source_id", params.sourceIds);
    }
  }

  if (params.dateFrom) {
    query = query.gte("received_at", params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte("received_at", params.dateTo);
  }

  // Apply ordering
  const orderColumn = params.orderBy || "received_at";
  const ascending = params.ascending ?? false;
  query = query.order(orderColumn, { ascending });

  // Apply pagination
  if (params.limit) {
    query = query.limit(params.limit);
  }

  if (params.offset !== undefined) {
    const end = params.limit
      ? params.offset + params.limit - 1
      : params.offset + 50 - 1;
    query = query.range(params.offset, end);
  }

  // Debug logging
  console.log("🔍 [buildNewsletterQuery] Final query params:", {
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
  });

  return query;
};

// Newsletter API Service
export const newsletterApi = {
  // Get all newsletters with filters and pagination
  async getAll(
    params: NewsletterQueryParams = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return withPerformanceLogging("newsletters.getAll", async () => {
      const user = await requireAuth();

      console.log("🔍 [getAll] Building query with params:", {
        ...params,
        sourceIds: params.sourceIds || null,
      });

      // Build the query using buildNewsletterQuery
      let query = buildNewsletterQuery({
        ...params,
        user_id: user.id, // Pass user_id to ensure it's included in the query
      });

      console.log("🔍 [getAll] Executing query with filters:", {
        userId: user.id,
        sourceIds: params.sourceIds || null,
        isArchived: params.isArchived,
        isRead: params.isRead,
      });

      const { data, error, count } = await query;

      if (error) {
        console.error("❌ [getAll] Query error:", error);
        handleSupabaseError(error);
      }

      console.log("🔍 [getAll] Query results:", {
        count: data?.length || 0,
        hasSourceIds: !!params.sourceIds,
        sourceIds: params.sourceIds || null,
        firstItem: data?.[0]
          ? {
              id: data[0].id,
              title: data[0].title,
              sourceId: data[0].newsletter_source_id,
              hasSource: !!data[0].source,
            }
          : null,
      });

      // Log the raw response for the first item if available
      if (data?.[0]) {
        console.log("🔍 [getAll] First item raw data:", {
          id: data[0].id,
          title: data[0].title,
          sourceId: data[0].newsletter_source_id,
          source: data[0].source,
          rawSource: data[0].source,
        });
      }

      // Transform the data
      let transformedData = (data || []).map(transformNewsletterResponse);

      // Log the transformed data for the first item if available
      if (transformedData[0]) {
        console.log("🔍 [getAll] First item transformed data:", {
          id: transformedData[0].id,
          title: transformedData[0].title,
          sourceId: transformedData[0].newsletter_source_id,
          source: transformedData[0].source,
          rawSource: transformedData[0].source,
        });
      }

      // Handle tag filtering post-query if needed
      if (params.tagIds?.length) {
        transformedData = transformedData.filter((newsletter) =>
          newsletter.tags?.some((tag) => params.tagIds!.includes(tag.id)),
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
  async getById(
    id: string,
    includeRelations = true,
  ): Promise<NewsletterWithRelations | null> {
    return withPerformanceLogging("newsletters.getById", async () => {
      const user = await requireAuth();

      let selectClause = "*";
      if (includeRelations) {
        selectClause = `
          *,
          source:newsletter_sources(*),
          tags:newsletter_tags(tag:tags(*))
        `;
      }

      const { data, error } = await supabase
        .from("newsletters")
        .select(selectClause)
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data ? transformNewsletterResponse(data) : null;
    });
  },

  // Create new newsletter
  async create(
    params: CreateNewsletterParams,
  ): Promise<NewsletterWithRelations> {
    return withPerformanceLogging("newsletters.create", async () => {
      const user = await requireAuth();

      const { tag_ids, ...newsletterData } = params;

      // Create the newsletter first
      const { data: newsletter, error: newsletterError } = await supabase
        .from("newsletters")
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

        const { error: tagError } = await supabase
          .from("newsletter_tags")
          .insert(tagAssociations);

        if (tagError) handleSupabaseError(tagError);
      }

      // Fetch the complete newsletter with relations
      const createdNewsletter = await this.getById(newsletter.id);
      if (!createdNewsletter) {
        throw new Error("Failed to retrieve created newsletter");
      }

      return createdNewsletter;
    });
  },

  // Update newsletter
  async update(
    params: UpdateNewsletterParams,
  ): Promise<NewsletterWithRelations> {
    return withPerformanceLogging("newsletters.update", async () => {
      const user = await requireAuth();

      // Validate user ID
      if (!user?.id) {
        throw new Error("User authentication required for newsletter updates");
      }

      const { id, tag_ids, ...updateData } = params;

      // Validate newsletter ID
      if (!id) {
        throw new Error("Newsletter ID is required for updates");
      }

      // First, verify the newsletter exists and belongs to the user
      const existingNewsletter = await this.getById(id, false);
      if (!existingNewsletter) {
        throw new Error(
          "Newsletter not found or you do not have permission to update it",
        );
      }

      // Update the newsletter
      const { data: newsletter, error: updateError } = await supabase
        .from("newsletters")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) handleSupabaseError(updateError);

      // Handle tag updates if provided
      if (tag_ids !== undefined) {
        try {
          // Remove existing tags (with user_id validation)
          const { error: deleteError } = await supabase
            .from("newsletter_tags")
            .delete()
            .eq("newsletter_id", id)
            .eq("user_id", user.id);

          if (deleteError) {
            throw new Error(
              `Failed to remove existing tags: ${deleteError.message}`,
            );
          }

          // Add new tags
          if (tag_ids.length > 0) {
            const tagAssociations = tag_ids.map((tagId) => ({
              newsletter_id: id,
              tag_id: tagId,
              user_id: user.id,
            }));

            const { error: tagError } = await supabase
              .from("newsletter_tags")
              .insert(tagAssociations);

            if (tagError) {
              throw new Error(`Failed to add new tags: ${tagError.message}`);
            }
          }
        } catch (error) {
          // If tag operations fail, we should still return the updated newsletter
          // but log the error for debugging
          console.error("Tag update failed for newsletter:", id, error);
          throw new Error(
            `Tag update failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      // Fetch the updated newsletter with relations
      const updatedNewsletter = await this.getById(id);
      if (!updatedNewsletter) {
        throw new Error("Failed to retrieve updated newsletter");
      }

      return updatedNewsletter;
    });
  },

  // Delete newsletter
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging("newsletters.delete", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("newsletters")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Bulk update newsletters
  async bulkUpdate(
    params: BulkUpdateNewsletterParams,
  ): Promise<BatchResult<NewsletterWithRelations>> {
    return withPerformanceLogging("newsletters.bulkUpdate", async () => {
      const user = await requireAuth();

      const { ids, updates } = params;
      const results: (NewsletterWithRelations | null)[] = [];
      const errors: (Error | null)[] = [];

      const { data, error } = await supabase
        .from("newsletters")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("user_id", user.id)
        .select();

      if (error) {
        // If bulk update fails, record error for all items
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        // Transform successful results
        const transformedResults = (data || []).map(
          transformNewsletterResponse,
        );
        ids.forEach((id) => {
          const result = transformedResults.find((r) => r.id === id);
          results.push(result || null);
          errors.push(
            result ? null : new Error("Newsletter not found or not updated"),
          );
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
      throw new Error("Newsletter not found");
    }

    return this.update({ id, is_archived: !newsletter.is_archived });
  },

  // Bulk archive
  async bulkArchive(
    ids: string[],
  ): Promise<BatchResult<NewsletterWithRelations>> {
    return this.bulkUpdate({ ids, updates: { is_archived: true } });
  },

  // Bulk unarchive
  async bulkUnarchive(
    ids: string[],
  ): Promise<BatchResult<NewsletterWithRelations>> {
    return this.bulkUpdate({ ids, updates: { is_archived: false } });
  },

  // Toggle like status
  async toggleLike(id: string): Promise<NewsletterWithRelations> {
    const newsletter = await this.getById(id, false);
    if (!newsletter) {
      throw new Error("Newsletter not found");
    }

    return this.update({ id, is_liked: !newsletter.is_liked });
  },

  // Get newsletters by tag
  async getByTag(
    tagId: string,
    params: Omit<NewsletterQueryParams, "tagIds"> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getAll({ ...params, tagIds: [tagId] });
  },

  // Get newsletters by source
  async getBySource(
    sourceId: string,
    params: Omit<NewsletterQueryParams, "sourceIds"> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getAll({ ...params, sourceIds: [sourceId] });
  },

  // Search newsletters
  async search(
    query: string,
    params: Omit<NewsletterQueryParams, "search"> = {},
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getAll({ ...params, search: query });
  },

  // Get reading statistics
  async getStats(): Promise<{
    total: number;
    read: number;
    unread: number;
    archived: number;
    liked: number;
  }> {
    return withPerformanceLogging("newsletters.getStats", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletters")
        .select("is_read, is_archived, is_liked")
        .eq("user_id", user.id);

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

  // Count newsletters by source
  async countBySource(): Promise<Record<string, number>> {
    return withPerformanceLogging("newsletters.countBySource", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletters")
        .select("newsletter_source_id")
        .eq("user_id", user.id)
        .eq("is_archived", false);

      if (error) handleSupabaseError(error);

      const counts: Record<string, number> = {};

      data?.forEach((newsletter) => {
        const sourceId = newsletter.newsletter_source_id || "unknown";
        counts[sourceId] = (counts[sourceId] || 0) + 1;
      });

      return counts;
    });
  },

  // Get unread counts grouped by source
  async getUnreadCountBySource(): Promise<Record<string, number>> {
    return withPerformanceLogging(
      "newsletters.getUnreadCountBySource",
      async () => {
        const user = await requireAuth();

        const { data, error } = await supabase
          .from("newsletters")
          .select("newsletter_source_id")
          .eq("user_id", user.id)
          .eq("is_read", false)
          .eq("is_archived", false);

        if (error) handleSupabaseError(error);

        const unreadCounts: Record<string, number> = {};

        data?.forEach((newsletter) => {
          const sourceId = newsletter.newsletter_source_id || "unknown";
          unreadCounts[sourceId] = (unreadCounts[sourceId] || 0) + 1;
        });

        return unreadCounts;
      },
    );
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
} = newsletterApi;

export default newsletterApi;
