import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import {
  NewsletterWithRelations,
  Newsletter,
  NewsletterSource,
  Tag,
} from "../types";
import {
  NewsletterQueryParams,
  CreateNewsletterParams,
  UpdateNewsletterParams,
  BulkUpdateNewsletterParams,
  PaginatedResponse,
  CrudOperations,
  BatchResult,
} from "../types/api";

// Transform raw Supabase response to our Newsletter type
const transformNewsletterResponse = (data: any): NewsletterWithRelations => {
  return {
    ...data,
    source: data.source || null,
    tags: data.tags?.map((t: any) => t.tag).filter(Boolean) || [],
    newsletter_source_id: data.newsletter_source_id || null,
  };
};

// Build query based on parameters
const buildNewsletterQuery = (params: NewsletterQueryParams = {}) => {
  let query = supabase.from("newsletters");

  // Select clause
  let selectClause = "*";
  if (params.includeRelations || params.includeSource || params.includeTags) {
    const relations = [];
    if (params.includeSource) relations.push("source:newsletter_sources(*)");
    if (params.includeTags) relations.push("tags:newsletter_tags(tag:tags(*))");

    if (relations.length > 0) {
      selectClause = `*, ${relations.join(", ")}`;
    }
  }

  query = query.select(selectClause);

  // Apply filters
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

  if (params.isBookmarked !== undefined) {
    query = query.eq("is_bookmarked", params.isBookmarked);
  }

  if (params.sourceIds && params.sourceIds.length > 0) {
    query = query.in("newsletter_source_id", params.sourceIds);
  }

  if (params.dateFrom) {
    query = query.gte("received_at", params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte("received_at", params.dateTo);
  }

  // Tag filtering requires a different approach due to many-to-many relationship
  if (params.tagIds && params.tagIds.length > 0) {
    // This will need to be handled with a separate query or join
    // For now, we'll handle it in the post-processing
  }

  // Ordering
  const orderColumn = params.orderBy || "received_at";
  const ascending = params.ascending ?? false;
  query = query.order(orderColumn, { ascending });

  // Pagination
  if (params.limit) {
    query = query.limit(params.limit);
  }

  if (params.offset) {
    query = query.range(
      params.offset,
      params.offset + (params.limit || 50) - 1,
    );
  }

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

      let query = buildNewsletterQuery(params);
      query = query.eq("user_id", user.id);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      let transformedData = (data || []).map(transformNewsletterResponse);

      // Handle tag filtering post-query if needed
      if (params.tagIds && params.tagIds.length > 0) {
        transformedData = transformedData.filter((newsletter) =>
          newsletter.tags.some((tag) => params.tagIds!.includes(tag.id)),
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

  // Toggle bookmark status
  async toggleBookmark(id: string): Promise<NewsletterWithRelations> {
    const newsletter = await this.getById(id, false);
    if (!newsletter) {
      throw new Error("Newsletter not found");
    }

    return this.update({ id, is_bookmarked: !newsletter.is_bookmarked });
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
    bookmarked: number;
  }> {
    return withPerformanceLogging("newsletters.getStats", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletters")
        .select("is_read, is_archived, is_liked, is_bookmarked")
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);

      const stats = {
        total: data?.length || 0,
        read: data?.filter((n) => n.is_read).length || 0,
        unread: data?.filter((n) => !n.is_read).length || 0,
        archived: data?.filter((n) => n.is_archived).length || 0,
        liked: data?.filter((n) => n.is_liked).length || 0,
        bookmarked: data?.filter((n) => n.is_bookmarked).length || 0,
      };

      return stats;
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
  toggleBookmark,
  getByTag: getNewslettersByTag,
  getBySource: getNewslettersBySource,
  search: searchNewsletters,
  getStats: getNewsletterStats,
} = newsletterApi;

export default newsletterApi;
