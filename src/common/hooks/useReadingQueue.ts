import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { AuthContext } from '@common/contexts/AuthContext';
import { useContext, useCallback } from 'react';
import type { Tag } from '@common/types';
import type { Newsletter } from '@common/types';

export interface ReadingQueueItem {
  id: string;
  position: number;
  user_id: string;
  newsletter_id: string;
  created_at: string;
  updated_at: string;
  newsletter: Newsletter;
}

interface NewsletterFromDB {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  image_url: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_read: boolean;
  is_liked: boolean;
  is_archived: boolean;
  newsletter_source_id: string | null;
  word_count: number;
  estimated_read_time: number;
  newsletter_sources?: Array<{
    id: string;
    name: string;
    domain: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  }> | null;
}

interface QueueItemFromDB {
  id: string;
  position: number;
  user_id: string;
  newsletter_id: string;
  created_at: string;
  updated_at: string;
  newsletters: NewsletterFromDB[];
}

// Helper function to transform queue item from DB to our format
const transformQueueItem = (item: QueueItemFromDB): ReadingQueueItem | null => {
  // Get the first newsletter from the array (should only be one per queue item)
  const newsletter = item.newsletters?.[0];
  if (!newsletter) {
    console.warn('No newsletter found for queue item:', item.id);
    
    // If we're in development, log the full item for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('Queue item with missing newsletter:', item);
    }
    
    return null;
  }
  // Get the first source from the array (if any)
  const source = newsletter.newsletter_sources?.[0];
  
  // Create the newsletter object with all required fields
  const newsletterData = {
    id: newsletter.id,
    title: newsletter.title || '',
    content: newsletter.content || '',
    summary: newsletter.summary || '',
    image_url: newsletter.image_url || '',
    received_at: newsletter.received_at,
    updated_at: newsletter.updated_at,
    user_id: newsletter.user_id,
    is_read: newsletter.is_read || false,
    is_liked: newsletter.is_liked || false,
    is_archived: newsletter.is_archived || false,
    newsletter_source_id: newsletter.newsletter_source_id ?? null, // Use nullish coalescing
    word_count: newsletter.word_count || 0,
    estimated_read_time: newsletter.estimated_read_time || 0,
    source: source ? {
      id: source.id,
      name: source.name,
      domain: source.domain,
      user_id: source.user_id,
      created_at: source.created_at,
      updated_at: source.updated_at
    } : undefined,
    tags: []
  };

  return {
    id: item.id,
    position: item.position,
    user_id: item.user_id,
    newsletter_id: item.newsletter_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    newsletter: newsletterData
  } as ReadingQueueItem;
};

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Helper function to fetch reading queue
  const fetchReadingQueue = useCallback(async (userId: string): Promise<ReadingQueueItem[]> => {
    try {
      // First, get queue items with joined newsletter and source data
      const { data: queueItems, error: queueError } = await supabase
        .from('reading_queue')
        .select(`
          *,
          newsletters!inner(
            *,
            newsletter_sources!left(*)
          )
        `)
        .eq('user_id', userId)
        .order('position', { ascending: true });

      if (queueError) throw queueError;
      if (!queueItems?.length) return [];

      // Transform the queue items and filter out nulls
      const validItems = queueItems
        .map(transformQueueItem)
        .filter((item): item is ReadingQueueItem => item !== null);

      // Clean up any orphaned queue items (where the newsletter doesn't exist)
      if (validItems.length < queueItems.length) {
        // Find items that failed to transform (orphaned)
        const orphanedIds = queueItems
          .filter(item => !validItems.some(valid => valid.newsletter_id === item.newsletter_id))
          .map(item => item.id);

        // Delete orphaned items in the background
        if (orphanedIds.length > 0) {
          console.log(`Cleaning up ${orphanedIds.length} orphaned queue items`);
          const { error } = await supabase
            .from('reading_queue')
            .delete()
            .in('id', orphanedIds);
          
          if (error) {
            console.error('Error cleaning up orphaned queue items:', error);
          } else {
            console.log(`Successfully cleaned up ${orphanedIds.length} orphaned queue items`);
            // Invalidate the query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['readingQueue', userId] });
          }
        }
      }

      return validItems;
    } catch (error) {
      console.error('Error fetching reading queue:', error);
      throw error;
    }
  }, []);

  // Main query for reading queue
  const { 
    data: readingQueue = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ReadingQueueItem[]>({
    queryKey: ['readingQueue', user?.id],
    queryFn: () => user?.id ? fetchReadingQueue(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // First check if the newsletter is already in the queue
      const { data: existingItem } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId)
        .maybeSingle();

      if (existingItem) {
        console.log('Newsletter already in queue');
        return; // Already in queue
      }

      // Get the current max position with proper error handling
      let nextPosition = 0;
      try {
        const { data: maxPosition, error: positionError } = await supabase
          .from('reading_queue')
          .select('position')
          .eq('user_id', user.id)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        if (positionError && positionError.code !== 'PGRST116') { // PGRST116 is 'no rows found'
          console.error('Error getting max position:', positionError);
          throw positionError;
        }

        nextPosition = (maxPosition?.position ?? -1) + 1;
      } catch (error) {
        console.error('Error in position calculation:', error);
        // Default to 0 if there's an error getting the max position
        nextPosition = 0;
      }

      // First try to insert the item
      const { data: insertedData, error: insertError } = await supabase
        .from('reading_queue')
        .insert({
          user_id: user.id,
          newsletter_id: newsletterId,
          position: nextPosition,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') { // Unique violation
          // Item already exists in queue, fetch the existing one
          const { data: existing, error: fetchError } = await supabase
            .from('reading_queue')
            .select('*')
            .eq('user_id', user.id)
            .eq('newsletter_id', newsletterId)
            .single();
          
          if (fetchError) {
            console.error('Error fetching existing queue item:', fetchError);
            throw fetchError;
          }
          
          return existing;
        }
        console.error('Error inserting into reading queue:', insertError);
        throw insertError;
      }
      
      // If we get here, the insert was successful
      return insertedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Remove from reading queue
  const removeFromQueue = useMutation({
    mutationFn: async (queueItemId: string) => {
      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('id', queueItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Reorder reading queue
  const reorderQueue = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('reading_queue')
        .upsert(
          updates.map(({ id, position }) => ({
            id,
            position,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Toggle read status
  const toggleRead = useMutation({
    mutationFn: async ({ newsletterId, isRead }: { newsletterId: string; isRead: boolean }) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: isRead, updated_at: new Date().toISOString() })
        .eq('id', newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Toggle like status
  const toggleLike = useMutation({
    mutationFn: async ({ newsletterId, isLiked }: { newsletterId: string; isLiked: boolean }) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ is_liked: isLiked, updated_at: new Date().toISOString() })
        .eq('id', newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Toggle archive status
  const toggleArchive = useMutation({
    mutationFn: async ({ newsletterId, isArchived }: { newsletterId: string; isArchived: boolean }) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq('id', newsletterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  return {
    readingQueue,
    isLoading,
    error,
    refetch,
    addToQueue: addToQueue.mutateAsync,
    removeFromQueue: removeFromQueue.mutateAsync,
    reorderQueue: reorderQueue.mutateAsync,
    toggleRead: toggleRead.mutateAsync,
    toggleLike: toggleLike.mutateAsync,
    toggleArchive: toggleArchive.mutateAsync,
    isAdding: addToQueue.isPending,
    isRemoving: removeFromQueue.isPending,
    isReordering: reorderQueue.isPending,
    isTogglingRead: toggleRead.isPending,
    isTogglingLike: toggleLike.isPending,
    isTogglingArchive: toggleArchive.isPending,
  };
};

export default useReadingQueue;