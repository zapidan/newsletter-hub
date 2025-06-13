import { supabase, handleSupabaseError, requireAuth, withPerformanceLogging } from './supabaseClient';
import { ReadingQueueItem, Tag } from '../types';

// Transform raw Supabase response to ReadingQueueItem
const transformQueueItem = (data: {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  added_at: string;
  newsletters: any;
}): ReadingQueueItem => {
  return {
    id: data.id,
    user_id: data.user_id,
    newsletter_id: data.newsletter_id,
    position: data.position,
    added_at: data.added_at,
    newsletter: {
      id: data.newsletters.id,
      title: data.newsletters.title,
      summary: data.newsletters.summary,
      content: data.newsletters.content,
      image_url: data.newsletters.image_url,
      received_at: data.newsletters.received_at,
      updated_at: data.newsletters.updated_at,
      newsletter_source_id: data.newsletters.newsletter_source_id,
      user_id: data.newsletters.user_id,
      is_read: data.newsletters.is_read,
      is_archived: data.newsletters.is_archived,
      is_liked: data.newsletters.is_liked,
      is_bookmarked: data.newsletters.is_bookmarked,
      word_count: data.newsletters.word_count,
      estimated_read_time: data.newsletters.estimated_read_time,
      source: data.newsletters.newsletter_sources || null,
      tags: []
    }
  };
};

// Reading Queue API Service
export const readingQueueApi = {
  // Get all reading queue items for the current user
  async getAll(): Promise<ReadingQueueItem[]> {
    return withPerformanceLogging('readingQueue.getAll', async () => {
      const user = await requireAuth();

      const { data: queueItems, error: queueError } = await supabase
        .from('reading_queue')
        .select(`
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `)
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (queueError) handleSupabaseError(queueError);
      if (!queueItems?.length) return [];

      // Fetch tags for all newsletters in the queue
      const newsletterIds = queueItems.map((item) => item.newsletter_id);
      const { data: newsletterTags } = await supabase
        .from('newsletter_tags')
        .select('newsletter_id, tags(*)')
        .in('newsletter_id', newsletterIds);

      // Create a map of newsletter ID to tags
      const tagsMap = new Map<string, Tag[]>();
      newsletterTags?.forEach((nt: any) => {
        if (!tagsMap.has(nt.newsletter_id)) {
          tagsMap.set(nt.newsletter_id, []);
        }
        if (nt.tags) {
          tagsMap.get(nt.newsletter_id)!.push(nt.tags as Tag);
        }
      });

      return queueItems.map((item) => {
        const transformedItem = transformQueueItem(item);
        // Add tags to the newsletter
        transformedItem.newsletter.tags = tagsMap.get(item.newsletter_id) || [];
        return transformedItem;
      });
    });
  },

  // Add a newsletter to the reading queue
  async add(newsletterId: string): Promise<ReadingQueueItem> {
    return withPerformanceLogging('readingQueue.add', async () => {
      const user = await requireAuth();

      // Check if already in queue
      const { data: existingItem } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId)
        .maybeSingle();

      if (existingItem) {
        throw new Error('Newsletter is already in reading queue');
      }

      // Get the current max position
      const { data: maxPosition } = await supabase
        .from('reading_queue')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newPosition = (maxPosition?.position || 0) + 1;

      const { data: insertedData, error } = await supabase
        .from('reading_queue')
        .insert({
          user_id: user.id,
          newsletter_id: newsletterId,
          position: newPosition,
        })
        .select(`
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `)
        .single();

      if (error) handleSupabaseError(error);

      // Fetch tags for the newsletter
      const { data: newsletterTags } = await supabase
        .from('newsletter_tags')
        .select('tags(*)')
        .eq('newsletter_id', newsletterId);

      const transformedItem = transformQueueItem(insertedData);
      transformedItem.newsletter.tags = newsletterTags?.map((nt: any) => nt.tags as Tag).filter(Boolean) || [];

      return transformedItem;
    });
  },

  // Remove an item from the reading queue
  async remove(queueItemId: string): Promise<boolean> {
    return withPerformanceLogging('readingQueue.remove', async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('id', queueItemId)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Reorder reading queue items
  async reorder(updates: { id: string; position: number }[]): Promise<boolean> {
    return withPerformanceLogging('readingQueue.reorder', async () => {
      const user = await requireAuth();

      // Update the positions
      const { error } = await supabase
        .from('reading_queue')
        .upsert(
          updates.map(({ id, position }) => ({
            id,
            position,
            user_id: user.id,
          })),
          { onConflict: 'id' }
        );

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Clear all items from reading queue
  async clear(): Promise<boolean> {
    return withPerformanceLogging('readingQueue.clear', async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Get reading queue item by ID
  async getById(id: string): Promise<ReadingQueueItem | null> {
    return withPerformanceLogging('readingQueue.getById', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('reading_queue')
        .select(`
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
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

      // Fetch tags for the newsletter
      const { data: newsletterTags } = await supabase
        .from('newsletter_tags')
        .select('tags(*)')
        .eq('newsletter_id', data.newsletter_id);

      const transformedItem = transformQueueItem(data);
      transformedItem.newsletter.tags = newsletterTags?.map((nt: any) => nt.tags as Tag).filter(Boolean) || [];

      return transformedItem;
    });
  },

  // Check if a newsletter is in the reading queue
  async isInQueue(newsletterId: string): Promise<boolean> {
    return withPerformanceLogging('readingQueue.isInQueue', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId)
        .maybeSingle();

      if (error) handleSupabaseError(error);

      return !!data;
    });
  },

  // Get reading queue statistics
  async getStats(): Promise<{
    total: number;
    unread: number;
    read: number;
  }> {
    return withPerformanceLogging('readingQueue.getStats', async () => {
      const items = await this.getAll();

      const stats = {
        total: items.length,
        unread: items.filter(item => !item.newsletter.is_read).length,
        read: items.filter(item => item.newsletter.is_read).length,
      };

      return stats;
    });
  },

  // Move item to specific position
  async moveToPosition(queueItemId: string, newPosition: number): Promise<boolean> {
    return withPerformanceLogging('readingQueue.moveToPosition', async () => {
      // Get all queue items to calculate new positions
      const items = await this.getAll();
      const itemToMove = items.find(item => item.id === queueItemId);

      if (!itemToMove) {
        throw new Error('Queue item not found');
      }

      // Calculate new positions for all items
      const updates: { id: string; position: number }[] = [];
      let currentPosition = 1;

      for (const item of items) {
        if (item.id === queueItemId) {
          continue; // Skip the item we're moving
        }

        if (currentPosition === newPosition) {
          // Insert the moved item here
          updates.push({ id: queueItemId, position: newPosition });
          currentPosition++;
        }

        updates.push({ id: item.id, position: currentPosition });
        currentPosition++;
      }

      // If newPosition is at the end
      if (newPosition >= items.length) {
        updates.push({ id: queueItemId, position: items.length });
      }

      return this.reorder(updates);
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getAll: getReadingQueue,
  add: addToReadingQueue,
  remove: removeFromReadingQueue,
  reorder: reorderReadingQueue,
  clear: clearReadingQueue,
  getById: getReadingQueueItemById,
  isInQueue: isNewsletterInQueue,
  getStats: getReadingQueueStats,
  moveToPosition: moveQueueItemToPosition,
} = readingQueueApi;

export default readingQueueApi;
