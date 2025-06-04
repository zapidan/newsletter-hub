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
  } = useQuery<ReadingQueueItem[], Error>({
    queryKey: ['readingQueue', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reading_queue')
        .select(`
          *,
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
      return data.map(item => ({
        ...item,
        newsletter: {
          ...item.newsletter,
          tags: ((item.newsletter as any)?.newsletter_tags || []).map((nt: any) => ({
            id: nt.tag.id,
            name: nt.tag.name,
            color: nt.tag.color,
            user_id: user.id,
            created_at: new Date().toISOString(),
          }))
        }
      }));
    },
    enabled: !!user,
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string): Promise<boolean> => {
      if (!user) throw new Error('User not authenticated');
      
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

  // Reorder queue
  const reorderQueue = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]): Promise<boolean> => {
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('reading_queue')
        .upsert(
          updates.map(({ id, position }) => ({
            id,
            position,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
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
