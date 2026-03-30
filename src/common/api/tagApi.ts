import { Tag, TagCreate, TagUpdate } from '../types';
import {
  handleSupabaseError,
  requireAuth,
  supabase,
  withPerformanceLogging,
} from './supabaseClient';

// Tag API Service
export const tagApi = {
  // Get all tags for the current user
  async getAll(): Promise<Tag[]> {
    return withPerformanceLogging('tags.getAll', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color, created_at, updated_at, user_id')
        .eq('user_id', user.id)
        .order('name');

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Get tag by ID
  async getById(id: string): Promise<Tag | null> {
    return withPerformanceLogging('tags.getById', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color, created_at, updated_at, user_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data;
    });
  },

  // Create a new tag
  async create(tag: TagCreate): Promise<Tag> {
    return withPerformanceLogging('tags.create', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('tags')
        .insert([{ ...tag, user_id: user.id }])
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update an existing tag
  async update(tag: TagUpdate): Promise<Tag> {
    return withPerformanceLogging('tags.update', async () => {
      const user = await requireAuth();

      const { id, ...updates } = tag;
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Delete a tag
  async delete(tagId: string): Promise<boolean> {
    return withPerformanceLogging('tags.delete', async () => {
      const user = await requireAuth();

      const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('user_id', user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Get tags for a specific newsletter
  async getTagsForNewsletter(newsletterId: string): Promise<Tag[]> {
    return withPerformanceLogging('tags.getTagsForNewsletter', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('newsletter_tags')
        .select('tag:tags(*)')
        .eq('newsletter_id', newsletterId)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);
      return (
        data
          ?.map((item: { tag: any }) => {
            if (item.tag && typeof item.tag === 'object') {
              return {
                id: item.tag.id as string,
                name: item.tag.name as string,
                color: item.tag.color as string,
                user_id: item.tag.user_id as string,
                created_at: item.tag.created_at as string,
                newsletter_count: item.tag.newsletter_count,
              } as Tag;
            }
            return null;
          })
          .filter((tag): tag is Tag => tag !== null) || []
      );
    });
  },

  // Update tags for a newsletter
  async updateNewsletterTags(newsletterId: string, tags: Tag[]): Promise<boolean> {
    return withPerformanceLogging('tags.updateNewsletterTags', async () => {
      const user = await requireAuth();
      const tagIds = tags.map((t) => t.id);

      const { error } = await supabase.rpc('set_newsletter_tags', {
        p_newsletter_id: newsletterId,
        p_user_id: user.id,
        p_tag_ids: tagIds,
      });

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Add a tag to a newsletter
  async addToNewsletter(newsletterId: string, tagId: string): Promise<boolean> {
    return withPerformanceLogging('tags.addToNewsletter', async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from('newsletter_tags')
        .upsert(
          { newsletter_id: newsletterId, tag_id: tagId, user_id: user.id },
          { onConflict: 'newsletter_id,tag_id', ignoreDuplicates: true }
        );

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Remove a tag from a newsletter
  async removeFromNewsletter(newsletterId: string, tagId: string): Promise<boolean> {
    return withPerformanceLogging('tags.removeFromNewsletter', async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from('newsletter_tags')
        .delete()
        .eq('newsletter_id', newsletterId)
        .eq('tag_id', tagId)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Get or create a tag by name
  async getOrCreate(name: string, color?: string): Promise<Tag> {
    return withPerformanceLogging('tags.getOrCreate', async () => {
      const user = await requireAuth();

      // Try to find existing tag
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id, name, color, created_at, updated_at, user_id')
        .eq('name', name.trim())
        .eq('user_id', user.id)
        .single();

      if (existingTag) {
        return existingTag;
      }

      // Create new tag if not found
      const tagColor =
        color ||
        '#' +
          Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, '0');

      return this.create({
        name: name.trim(),
        color: tagColor,
      });
    });
  },

  // Bulk create tags
  async bulkCreate(tags: TagCreate[]): Promise<Tag[]> {
    return withPerformanceLogging('tags.bulkCreate', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('tags')
        .insert(tags.map((tag) => ({ ...tag, user_id: user.id })))
        .select();

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Get newsletter count for each tag using the same logic as filtering
  async getTagUsageStats(): Promise<Array<Tag & { newsletter_count: number }>> {
    return withPerformanceLogging('tags.getTagUsageStats', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase.rpc('get_tags_with_counts', {
        p_user_id: user.id,
      });

      if (error) handleSupabaseError(error);
      return data ?? [];
    });
  },

  // Search tags by name
  async search(query: string): Promise<Tag[]> {
    return withPerformanceLogging('tags.search', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color, created_at, updated_at, user_id')
        .eq('user_id', user.id)
        .ilike('name', `%${query}%`)
        .order('name');

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
      orderBy?: 'name' | 'created_at';
      ascending?: boolean;
    } = {}
  ): Promise<{
    data: Tag[];
    count: number;
    hasMore: boolean;
  }> {
    return withPerformanceLogging('tags.getPaginated', async () => {
      const user = await requireAuth();
      const { limit = 50, offset = 0, search, orderBy = 'name', ascending = true } = options;

      let query = supabase
        .from('tags')
        .select('id, name, color, created_at, updated_at, user_id', { count: 'exact' })
        .eq('user_id', user.id);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      query = query.order(orderBy, { ascending }).range(offset, offset + limit - 1);

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
