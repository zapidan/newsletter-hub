import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { AuthContext } from '@common/contexts/AuthContext';
import { useContext, useCallback } from 'react';
import { ReadingQueueItem, Tag } from '@common/types';

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
const transformQueueItem = (item: QueueItemFromDB): ReadingQueueItem => {
  // Get the first newsletter from the array (should only be one per queue item)
  const newsletter = item.newsletters[0];
  if (!newsletter) {
    throw new Error('No newsletter found for queue item');
  }
  // Get the first source from the array (if any)
  const source = newsletter.newsletter_sources?.[0] || null;
  
  return {
    id: item.id,
    position: item.position,
    user_id: item.user_id,
    newsletter_id: item.newsletter_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    newsletter: {
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
      newsletter_source_id: newsletter.newsletter_source_id || null,
      word_count: newsletter.word_count || 0,
      estimated_read_time: newsletter.estimated_read_time || 0,
      source: source ? {
        id: source.id,
        name: source.name,
        domain: source.domain,
        user_id: source.user_id,
        created_at: source.created_at,
        updated_at: source.updated_at
      } : null,
      tags: []
    }
  };
};

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Helper function to fetch reading queue
  const fetchReadingQueue = useCallback(async (userId: string) => {
    try {
      // Get the reading queue items with basic newsletter info
      const { data: queueItems, error } = await supabase
        .from('reading_queue')
        .select(`
          id,
          position,
          user_id,
          newsletter_id,
          created_at,
          updated_at,
          newsletters!inner(
            id,
            title,
            content,
            summary,
            image_url,
            received_at,
            created_at,
            updated_at,
            user_id,
            is_read,
            is_liked,
            is_archived,
            newsletter_source_id,
            word_count,
            estimated_read_time,
            newsletter_sources (
              id,
              name,
              domain,
              user_id,
              created_at,
              updated_at
            )
          )
        `)
        .eq('user_id', userId)
        .order('position', { ascending: true });

      if (error) throw error;
      if (!queueItems) return [];

      // Transform the data using our helper function
      return queueItems.map(transformQueueItem);
    } catch (error) {
      console.error('Error fetching reading queue:', error);
      throw error;
    }
  }, []);

  // Fetch reading queue using React Query
  const {
    data: readingQueue = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['readingQueue', user?.id],
    queryFn: () => user?.id ? fetchReadingQueue(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  // Add newsletter to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Get current max position
      const { data: maxPosition } = await supabase
        .from('reading_queue')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (maxPosition?.position || 0) + 1;

      const { data, error } = await supabase
        .from('reading_queue')
        .insert([
          {
            user_id: user.id,
            newsletter_id: newsletterId,
            position: nextPosition,
          },
        ])
        .select('*');

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    },
  });

  // Remove newsletter from reading queue
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
