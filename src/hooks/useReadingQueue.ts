import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';
import { Newsletter } from '../types';

export interface ReadingQueueItem {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  created_at: string;
  updated_at: string;
  newsletter: Newsletter;
}

export const useReadingQueue = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch reading queue
  const {
    data: readingQueue = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ReadingQueueItem[]>({
    queryKey: ['readingQueue', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reading_queue')
        .select(`
          id,
          position,
          user_id,
          newsletter_id,
          created_at,
          updated_at,
          newsletter:newsletters (
            *,
            newsletter_tags (
              tag:tags (id, name, color)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      // Transform the data to match the ReadingQueueItem type
      return data.map(item => {
        // Safely cast the newsletter object
        const newsletter = item.newsletter as unknown as {
          id: string;
          title: string;
          sender: string;
          content: string;
          summary: string;
          image_url: string | null;
          received_at: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          is_read: boolean;
          is_archived?: boolean;
          is_liked: boolean;
          newsletter_tags: Array<{ tag: { id: string; name: string; color: string } }>;
        };
        
        // Create the newsletter object with only the fields defined in the Newsletter type
        const newsletterItem: Newsletter = {
          id: newsletter.id,
          title: newsletter.title,
          sender: newsletter.sender,
          content: newsletter.content,
          summary: newsletter.summary,
          image_url: newsletter.image_url || '',
          received_at: newsletter.received_at,
          is_read: newsletter.is_read,
          is_liked: newsletter.is_liked,
          user_id: newsletter.user_id,
          tags: (newsletter.newsletter_tags || []).map(nt => ({
            id: nt.tag.id,
            name: nt.tag.name,
            color: nt.tag.color,
            user_id: user.id,
            created_at: new Date().toISOString(),
          }))
        };
        
        // Create the queue item with the properly typed newsletter
        const queueItem: ReadingQueueItem = {
          id: item.id,
          position: item.position,
          user_id: item.user_id,
          newsletter_id: item.newsletter_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
          newsletter: newsletterItem
        };
        
        return queueItem;
      });
    },
    enabled: !!user,
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string): Promise<boolean> => {
      if (!user) throw new Error('User not authenticated');
      
      // Check if already in queue
      const { data: existing } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId)
        .single();
      
      if (existing) return true; // Already in queue
      
      // Get current max position
      const { data: maxPosData } = await supabase
        .from('reading_queue')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      const nextPosition = (maxPosData?.position || 0) + 1;
      
      const { error } = await supabase
        .from('reading_queue')
        .insert({
          user_id: user.id,
          newsletter_id: newsletterId,
          position: nextPosition,
        });
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    }
  });

  // Remove from reading queue
  const removeFromQueue = useMutation({
    mutationFn: async (newsletterId: string): Promise<boolean> => {
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    }
  });

  // Toggle item in reading queue
  const toggleInQueue = async (newsletterId: string, isInQueue: boolean) => {
    if (isInQueue) {
      await removeFromQueue.mutateAsync(newsletterId);
    } else {
      await addToQueue.mutateAsync(newsletterId);
    }
  };

  // Define the type for the mutation context
  type ReorderContext = {
    previousQueue?: ReadingQueueItem[];
  };

  // Reorder queue items
  const reorderQueue = useMutation<boolean, Error, { id: string; position: number }[], ReorderContext>({
    mutationFn: async (updates: { id: string; position: number }[]): Promise<boolean> => {
      if (!user) throw new Error('User not authenticated');
      
      console.log('Updating positions:', updates);
      
      try {
        // Use a transaction to update all positions at once
        const { error } = await supabase.rpc('reorder_reading_queue', {
          updates: updates.map(update => ({
            id: update.id,
            position: update.position
          }))
        });
        
        if (error) throw error;
        
        console.log('All positions updated successfully');
        return true;
      } catch (error) {
        console.error('Error updating positions:', error);
        throw error;
      }
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['readingQueue', user?.id] });
      
      // Snapshot the previous value
      const previousQueue = queryClient.getQueryData<ReadingQueueItem[]>(['readingQueue', user?.id]);
      
      // Optimistically update to the new value
      if (previousQueue) {
        const updatedQueue = [...previousQueue];
        
        // Apply all position updates
        updates.forEach(({ id, position }) => {
          const itemIndex = updatedQueue.findIndex(item => item.id === id);
          if (itemIndex > -1) {
            updatedQueue[itemIndex] = {
              ...updatedQueue[itemIndex],
              position
            };
          }
        });
        
        // Sort by new positions
        updatedQueue.sort((a, b) => a.position - b.position);
        
        // Update the query data
        queryClient.setQueryData(['readingQueue', user?.id], updatedQueue);
      }
      
      return { previousQueue };
    },
    onError: (error, _variables, context) => {
      console.error('Error reordering queue:', error);
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(['readingQueue', user?.id], context.previousQueue);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    }
  });

  return {
    readingQueue,
    isLoading,
    error,
    refetch,
    addToQueue: addToQueue.mutateAsync,
    removeFromQueue: removeFromQueue.mutateAsync,
    toggleInQueue,
    reorderQueue: reorderQueue.mutateAsync,
    isAdding: addToQueue.isPending,
    isRemoving: removeFromQueue.isPending,
    isReordering: reorderQueue.isPending,
  };
};

export default useReadingQueue;
