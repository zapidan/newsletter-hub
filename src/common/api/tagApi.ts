import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import { Tag, TagCreate, TagUpdate } from "../types";

// Tag API Service
export const tagApi = {
  // Get all tags for the current user
  async getAll(): Promise<Tag[]> {
    return withPerformanceLogging("tags.getAll", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Get tag by ID
  async getById(id: string): Promise<Tag | null> {
    return withPerformanceLogging("tags.getById", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data;
    });
  },

  // Create a new tag
  async create(tag: TagCreate): Promise<Tag> {
    return withPerformanceLogging("tags.create", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .insert([{ ...tag, user_id: user.id }])
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update an existing tag
  async update(tag: TagUpdate): Promise<Tag> {
    return withPerformanceLogging("tags.update", async () => {
      const user = await requireAuth();

      const { id, ...updates } = tag;
      const { data, error } = await supabase
        .from("tags")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Delete a tag
  async delete(tagId: string): Promise<boolean> {
    return withPerformanceLogging("tags.delete", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("tags")
        .delete()
        .eq("id", tagId)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Get tags for a specific newsletter
  async getTagsForNewsletter(newsletterId: string): Promise<Tag[]> {
    return withPerformanceLogging("tags.getTagsForNewsletter", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletter_tags")
        .select("tag:tags(*)")
        .eq("newsletter_id", newsletterId)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return data?.map((item: { tag: Tag }) => item.tag).filter(Boolean) || [];
    });
  },

  // Update tags for a newsletter
  async updateNewsletterTags(
    newsletterId: string,
    tags: Tag[],
  ): Promise<boolean> {
    return withPerformanceLogging("tags.updateNewsletterTags", async () => {
      const user = await requireAuth();

      // Get current tags
      const { data: currentTags, error: currentTagsError } = await supabase
        .from("newsletter_tags")
        .select("tag_id")
        .eq("newsletter_id", newsletterId)
        .eq("user_id", user.id);

      if (currentTagsError) handleSupabaseError(currentTagsError);

      // Compute tags to add and remove
      const currentTagIds = (currentTags || []).map(
        (t: { tag_id: string }) => t.tag_id,
      );
      const newTagIds = tags.map((tag) => tag.id);
      const tagsToAdd = newTagIds.filter(
        (id: string) => !currentTagIds.includes(id),
      );
      const tagsToRemove = currentTagIds.filter(
        (id: string) => !newTagIds.includes(id),
      );

      // Add new tags
      if (tagsToAdd.length > 0) {
        const { error: addError } = await supabase
          .from("newsletter_tags")
          .insert(
            tagsToAdd.map((tagId) => ({
              newsletter_id: newsletterId,
              tag_id: tagId,
              user_id: user.id,
            })),
          );

        if (addError) handleSupabaseError(addError);
      }

      // Remove tags
      if (tagsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("newsletter_tags")
          .delete()
          .eq("newsletter_id", newsletterId)
          .eq("user_id", user.id)
          .in("tag_id", tagsToRemove);

        if (removeError) handleSupabaseError(removeError);
      }

      return true;
    });
  },

  // Add a tag to a newsletter
  async addToNewsletter(newsletterId: string, tagId: string): Promise<boolean> {
    return withPerformanceLogging("tags.addToNewsletter", async () => {
      const user = await requireAuth();

      // Check if the relationship already exists
      const { data: existing } = await supabase
        .from("newsletter_tags")
        .select("id")
        .eq("newsletter_id", newsletterId)
        .eq("tag_id", tagId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        return true; // Already exists
      }

      const { error } = await supabase.from("newsletter_tags").insert({
        newsletter_id: newsletterId,
        tag_id: tagId,
        user_id: user.id,
      });

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Remove a tag from a newsletter
  async removeFromNewsletter(
    newsletterId: string,
    tagId: string,
  ): Promise<boolean> {
    return withPerformanceLogging("tags.removeFromNewsletter", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("newsletter_tags")
        .delete()
        .eq("newsletter_id", newsletterId)
        .eq("tag_id", tagId)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Get or create a tag by name
  async getOrCreate(name: string, color?: string): Promise<Tag> {
    return withPerformanceLogging("tags.getOrCreate", async () => {
      const user = await requireAuth();

      // Try to find existing tag
      const { data: existingTag } = await supabase
        .from("tags")
        .select("*")
        .eq("name", name.trim())
        .eq("user_id", user.id)
        .single();

      if (existingTag) {
        return existingTag;
      }

      // Create new tag if not found
      const tagColor =
        color ||
        "#" +
          Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0");

      return this.create({
        name: name.trim(),
        color: tagColor,
      });
    });
  },

  // Bulk create tags
  async bulkCreate(tags: TagCreate[]): Promise<Tag[]> {
    return withPerformanceLogging("tags.bulkCreate", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .insert(tags.map((tag) => ({ ...tag, user_id: user.id })))
        .select();

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Get newsletter count for each tag
  async getTagUsageStats(): Promise<Array<Tag & { newsletter_count: number }>> {
    return withPerformanceLogging("tags.getTagUsageStats", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .select(
          `
          *,
          newsletter_tags!inner(newsletter_id)
        `,
        )
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);

      // Count newsletters for each tag
      const tagsWithCounts = (data || []).map(
        (tag: Tag & { newsletter_tags?: unknown[] }) => ({
          ...tag,
          newsletter_count: tag.newsletter_tags?.length || 0,
        }),
      );

      // Remove the newsletter_tags property as it's no longer needed
      return tagsWithCounts.map(
        ({ newsletter_tags, ...tag }) => tag,
      ) as (Tag & { newsletter_count: number })[];
    });
  },

  // Search tags by name
  async search(query: string): Promise<Tag[]> {
    return withPerformanceLogging("tags.search", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .ilike("name", `%${query}%`)
        .order("name");

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Get tags with pagination
  async getPaginated(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      orderBy?: "name" | "created_at";
      ascending?: boolean;
    } = {},
  ): Promise<{
    data: Tag[];
    count: number;
    hasMore: boolean;
  }> {
    return withPerformanceLogging("tags.getPaginated", async () => {
      const user = await requireAuth();
      const {
        limit = 50,
        offset = 0,
        search,
        orderBy = "name",
        ascending = true,
      } = options;

      let query = supabase
        .from("tags")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      query = query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) handleSupabaseError(error);

      return {
        data: data || [],
        count: count || 0,
        hasMore: (data?.length || 0) === limit,
      };
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getAll: getAllTags,
  getById: getTagById,
  create: createTag,
  update: updateTag,
  delete: deleteTag,
  getTagsForNewsletter,
  updateNewsletterTags,
  addToNewsletter: addTagToNewsletter,
  removeFromNewsletter: removeTagFromNewsletter,
  getOrCreate: getOrCreateTag,
  bulkCreate: bulkCreateTags,
  getTagUsageStats,
  search: searchTags,
  getPaginated: getPaginatedTags,
} = tagApi;

export default tagApi;
