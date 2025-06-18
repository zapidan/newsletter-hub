import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import { ReadingQueueItem, Tag } from "../types";
import { useLoggerStatic } from "../utils/logger/useLogger";

// Initialize logger
const log = useLoggerStatic();

// Transform raw Supabase response to ReadingQueueItem
const transformQueueItem = (data: {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  added_at: string;
  newsletters: {
    id: string;
    title: string;
    summary: string;
    content: string;
    image_url: string;
    received_at: string;
    updated_at: string;
    newsletter_source_id: string;
    user_id: string;
    is_read: boolean;
    is_archived: boolean;
    is_liked: boolean;
    word_count: number;
    estimated_read_time: number;
    newsletter_sources?: any;
    tags?: any[];
  };
}): ReadingQueueItem => {
  if (!data.newsletters) {
    const errorMsg = `Newsletter with id ${data.newsletter_id} not found in reading queue item ${data.id}. The newsletter may have been deleted.`;
    log.error(
      "Newsletter not found in reading queue item",
      {
        component: "ReadingQueueApi",
        action: "transform_queue_item",
        metadata: {
          queueItemId: data.id,
          newsletterId: data.newsletter_id,
          userId: data.user_id,
          position: data.position,
          addedAt: data.added_at,
        },
      },
      new Error(errorMsg),
    );
    throw new Error(errorMsg);
  }

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
      is_read: Boolean(data.newsletters.is_read),
      is_archived: Boolean(data.newsletters.is_archived),
      is_liked: Boolean(data.newsletters.is_liked),
      word_count: data.newsletters.word_count,
      estimated_read_time: data.newsletters.estimated_read_time,
      source: data.newsletters.newsletter_sources || null,
      tags: data.newsletters.tags || [],
    },
  };
};

// Reading Queue API Service
export const readingQueueApi = {
  // Get all reading queue items for the current user
  async getAll(): Promise<ReadingQueueItem[]> {
    return withPerformanceLogging("readingQueue.getAll", async () => {
      const user = await requireAuth();

      const { data: queueItems, error: queueError } = await supabase
        .from("reading_queue")
        .select(
          `
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      if (queueError) handleSupabaseError(queueError);
      if (!queueItems?.length) return [];

      // Filter out queue items with null newsletters first
      const invalidItems = queueItems.filter((item) => !item.newsletters);
      const validQueueItems = queueItems.filter((item) => item.newsletters);

      // Log data integrity issues and clean up orphaned items
      if (invalidItems.length > 0) {
        log.warn(
          `Found ${invalidItems.length} queue items with null newsletters, cleaning up`,
          {
            component: "ReadingQueueApi",
            action: "cleanup_invalid_items",
            metadata: {
              invalidItemsCount: invalidItems.length,
              invalidItems: invalidItems.map((item) => ({
                id: item.id,
                newsletter_id: item.newsletter_id,
                user_id: item.user_id,
                position: item.position,
              })),
            },
          },
        );

        // Automatically clean up orphaned items
        try {
          const orphanedIds = invalidItems.map((item) => item.id);
          const { error: cleanupError } = await supabase
            .from("reading_queue")
            .delete()
            .in("id", orphanedIds)
            .eq("user_id", user.id);

          if (cleanupError) {
            log.error(
              "Failed to cleanup orphaned items",
              {
                component: "ReadingQueueApi",
                action: "cleanup_orphaned_items",
                metadata: { orphanedIds },
              },
              cleanupError,
            );
          } else {
            log.info(
              `Successfully cleaned up ${orphanedIds.length} orphaned items`,
              {
                component: "ReadingQueueApi",
                action: "cleanup_orphaned_items_success",
                metadata: { cleanedCount: orphanedIds.length },
              },
            );
          }
        } catch (cleanupError) {
          log.error(
            "Cleanup error occurred",
            {
              component: "ReadingQueueApi",
              action: "cleanup_error",
            },
            cleanupError instanceof Error
              ? cleanupError
              : new Error(String(cleanupError)),
          );
        }
      }

      if (!validQueueItems.length) {
        if (queueItems.length > 0) {
          log.warn(
            `All ${queueItems.length} queue items had null newsletters`,
            {
              component: "ReadingQueueApi",
              action: "all_items_invalid",
              metadata: {
                userId: user.id,
                queueItemsCount: queueItems.length,
              },
            },
          );
        }
        return [];
      }

      // Fetch tags for all newsletters in the queue
      const newsletterIds = validQueueItems
        .map((item) => item.newsletter_id)
        .filter((id) => id != null); // Filter out null/undefined newsletter_ids

      let newsletterTags: Array<{ newsletter_id: string; tags: any }> = [];
      if (newsletterIds.length > 0) {
        const { data } = await supabase
          .from("newsletter_tags")
          .select("newsletter_id, tags(*)")
          .in("newsletter_id", newsletterIds);
        newsletterTags = data || [];
      }

      // Create a map of newsletter ID to tags
      const tagsMap = new Map<string, Tag[]>();
      newsletterTags.forEach((nt: { newsletter_id: string; tags: any }) => {
        if (!tagsMap.has(nt.newsletter_id)) {
          tagsMap.set(nt.newsletter_id, []);
        }
        // Handle both single tag object and array of tags
        const tags = Array.isArray(nt.tags) ? nt.tags : [nt.tags];
        tags.forEach((tag: any) => {
          if (tag && typeof tag === "object") {
            const transformedTag: Tag = {
              id: tag.id as string,
              name: tag.name as string,
              color: tag.color as string,
              user_id: tag.user_id as string,
              created_at: tag.created_at as string,
              newsletter_count: tag.newsletter_count,
            };
            tagsMap.get(nt.newsletter_id)!.push(transformedTag);
          }
        });
      });

      return validQueueItems.map((item) => {
        try {
          const transformedItem = transformQueueItem(item);
          // Add tags to the newsletter
          transformedItem.newsletter.tags =
            tagsMap.get(item.newsletter_id) || [];
          return transformedItem;
        } catch (error) {
          log.error(
            `Failed to transform queue item ${item.id}`,
            {
              component: "ReadingQueueApi",
              action: "transform_queue_item_error",
              metadata: { queueItemId: item.id },
            },
            error instanceof Error ? error : new Error(String(error)),
          );
          throw error;
        }
      });
    });
  },

  // Add a newsletter to the reading queue
  async add(newsletterId: string): Promise<ReadingQueueItem> {
    return withPerformanceLogging("readingQueue.add", async () => {
      const user = await requireAuth();

      // Validate newsletter ID
      if (!newsletterId) {
        throw new Error("Newsletter ID is required");
      }

      // Check if already in queue
      const { data: existingItem } = await supabase
        .from("reading_queue")
        .select("id")
        .eq("user_id", user.id)
        .eq("newsletter_id", newsletterId)
        .maybeSingle();

      if (existingItem) {
        throw new Error("Newsletter is already in reading queue");
      }

      // Get the current max position
      const { data: maxPosition } = await supabase
        .from("reading_queue")
        .select("position")
        .eq("user_id", user.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newPosition = (maxPosition?.position || 0) + 1;

      const { data: insertedData, error } = await supabase
        .from("reading_queue")
        .insert({
          user_id: user.id,
          newsletter_id: newsletterId,
          position: newPosition,
        })
        .select(
          `
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `,
        )
        .single();

      if (error) handleSupabaseError(error);

      // Fetch tags for the newsletter (only if newsletter ID is valid)
      let newsletterTags: Array<{ tags: any }> = [];
      if (newsletterId) {
        const { data } = await supabase
          .from("newsletter_tags")
          .select("tags(*)")
          .eq("newsletter_id", newsletterId);
        newsletterTags = data || [];
      }

      const transformedItem = transformQueueItem(insertedData);
      transformedItem.newsletter.tags =
        newsletterTags
          ?.map((nt: { tags: any }) => {
            if (nt.tags && typeof nt.tags === "object") {
              return {
                id: nt.tags.id as string,
                name: nt.tags.name as string,
                color: nt.tags.color as string,
                user_id: nt.tags.user_id as string,
                created_at: nt.tags.created_at as string,
                newsletter_count: nt.tags.newsletter_count,
              } as Tag;
            }
            return null;
          })
          .filter((tag): tag is Tag => tag !== null) || [];

      return transformedItem;
    });
  },

  // Remove an item from the reading queue
  async remove(queueItemId: string): Promise<boolean> {
    return withPerformanceLogging("readingQueue.remove", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("reading_queue")
        .delete()
        .eq("id", queueItemId)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Reorder reading queue items
  async reorder(updates: { id: string; position: number }[]): Promise<boolean> {
    return withPerformanceLogging("readingQueue.reorder", async () => {
      const user = await requireAuth();

      // Update the positions
      const { error } = await supabase.from("reading_queue").upsert(
        updates.map(({ id, position }) => ({
          id,
          position,
          user_id: user.id,
        })),
        { onConflict: "id" },
      );

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Clear all items from reading queue
  async clear(): Promise<boolean> {
    return withPerformanceLogging("readingQueue.clear", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("reading_queue")
        .delete()
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);

      return true;
    });
  },

  // Get reading queue item by ID
  async getById(id: string): Promise<ReadingQueueItem | null> {
    return withPerformanceLogging("readingQueue.getById", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("reading_queue")
        .select(
          `
          *,
          newsletters (
            *,
            newsletter_sources (
              *
            )
          )
        `,
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      if (!data) return null;

      // Fetch tags for the newsletter (only if newsletter ID is valid)
      let newsletterTags: Array<{ tags: any }> = [];
      if (data.newsletter_id) {
        const { data: tagsData } = await supabase
          .from("newsletter_tags")
          .select("tags(*)")
          .eq("newsletter_id", data.newsletter_id);
        newsletterTags = tagsData || [];
      }

      const transformedItem = transformQueueItem(data);
      transformedItem.newsletter.tags =
        newsletterTags
          ?.map((nt: { tags: any }) => {
            if (nt.tags && typeof nt.tags === "object") {
              return {
                id: nt.tags.id as string,
                name: nt.tags.name as string,
                color: nt.tags.color as string,
                user_id: nt.tags.user_id as string,
                created_at: nt.tags.created_at as string,
                newsletter_count: nt.tags.newsletter_count,
              } as Tag;
            }
            return null;
          })
          .filter((tag): tag is Tag => tag !== null) || [];

      return transformedItem;
    });
  },

  // Check if a newsletter is in the reading queue
  async isInQueue(newsletterId: string): Promise<boolean> {
    return withPerformanceLogging("readingQueue.isInQueue", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("reading_queue")
        .select("id")
        .eq("user_id", user.id)
        .eq("newsletter_id", newsletterId)
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
    return withPerformanceLogging("readingQueue.getStats", async () => {
      const items = await this.getAll();

      const stats = {
        total: items.length,
        unread: items.filter((item) => !item.newsletter.is_read).length,
        read: items.filter((item) => item.newsletter.is_read).length,
      };

      return stats;
    });
  },

  // Move item to specific position
  async moveToPosition(
    queueItemId: string,
    newPosition: number,
  ): Promise<boolean> {
    return withPerformanceLogging("readingQueue.moveToPosition", async () => {
      // Get all queue items to calculate new positions
      const items = await this.getAll();
      const itemToMove = items.find((item) => item.id === queueItemId);

      if (!itemToMove) {
        throw new Error("Queue item not found");
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

  // Clean up orphaned reading queue items (where newsletters have been deleted)
  async cleanupOrphanedItems(): Promise<{ removedCount: number }> {
    return withPerformanceLogging(
      "readingQueue.cleanupOrphanedItems",
      async () => {
        const user = await requireAuth();

        // Find queue items with null newsletters by doing a LEFT JOIN
        const { data: orphanedItems, error } = await supabase
          .from("reading_queue")
          .select(
            `
          id,
          newsletter_id,
          newsletters!left(id)
        `,
          )
          .eq("user_id", user.id)
          .is("newsletters.id", null);

        if (error) handleSupabaseError(error);

        if (!orphanedItems || orphanedItems.length === 0) {
          return { removedCount: 0 };
        }

        log.warn(
          `Found ${orphanedItems.length} orphaned queue items, cleaning up`,
          {
            component: "ReadingQueueApi",
            action: "cleanup_orphaned_items_detected",
            metadata: {
              orphanedItemsCount: orphanedItems.length,
              orphanedItems: orphanedItems.map((item) => ({
                id: item.id,
                newsletter_id: item.newsletter_id,
              })),
            },
          },
        );

        // Remove orphaned items
        const orphanedIds = orphanedItems.map((item) => item.id);
        const { error: deleteError } = await supabase
          .from("reading_queue")
          .delete()
          .in("id", orphanedIds)
          .eq("user_id", user.id);

        if (deleteError) handleSupabaseError(deleteError);

        return { removedCount: orphanedItems.length };
      },
    );
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

export const cleanupOrphanedReadingQueueItems =
  readingQueueApi.cleanupOrphanedItems;

export default readingQueueApi;
