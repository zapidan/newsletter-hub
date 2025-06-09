import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { AuthContext } from '@common/contexts/AuthContext';
import { useContext } from 'react';
import { Tag, ReadingQueueItem, NewsletterWithRelations, NewsletterSource } from '@common/types';

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
}

interface QueueItemFromDB {
  id: string;
  position: number;
  user_id: string;
  newsletter_id: string;
  created_at: string;
  updated_at: string;
  newsletters: NewsletterFromDB;
}

export const useReadingQueue = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
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
      console.log('Fetching reading queue for user:', user?.id);
      if (!user) {
        console.log('No user, returning empty array');
        return [];
      }

      try {
        // Get the reading queue items with basic newsletter info
        const { data: queueItemsRaw, error } = await supabase
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
              newsletter_source_id
            )
          `)
          .eq('user_id', user.id)
          .order('position', { ascending: true });

        if (error) {
          console.error('Error fetching reading queue:', error);
          throw error;
        }

        
        console.log('Raw queue items from database:', queueItemsRaw);
        
        if (!queueItemsRaw || !Array.isArray(queueItemsRaw) || queueItemsRaw.length === 0) {
          console.log('No queue items found for user');
          return [];
        }

        // Cast queueItems to correct type
        const queueItems: QueueItemFromDB[] = queueItemsRaw as any;

        // Get unique newsletter and source IDs
        const newsletterIds = Array.from(new Set(queueItems.map(item => item.newsletter_id)));
        const sourceIds = Array.from(
          new Set(
            queueItems
              .map(item => item.newsletters.newsletter_source_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        console.log('Newsletter IDs:', newsletterIds);
        console.log('Source IDs:', sourceIds);

        // Fetch sources in a single query
        const sourcesData = new Map<string, NewsletterSource>();
        if (sourceIds.length > 0) {
          const { data: sources, error: sourcesError } = await supabase
            .from('newsletter_sources')
            .select('*')
            .in('id', sourceIds);

          if (sourcesError) {
            console.error('Error fetching sources:', sourcesError);
          } else if (sources && Array.isArray(sources)) {
            (sources as NewsletterSource[]).forEach((source) => {
              sourcesData.set(source.id, source);
            });
          }
        }

        // Fetch tags in a single query
        const tagsByNewsletterId = new Map<string, Tag[]>();
        if (newsletterIds.length > 0) {
          const { data: tags, error: tagsError } = await supabase
            .from('newsletter_tags')
            .select('newsletter_id, tags!inner(*)')
            .in('newsletter_id', newsletterIds);

          if (tagsError) {
            console.error('Error fetching tags:', tagsError);
          } else if (tags && Array.isArray(tags)) {
            // Convert the response to the expected type
            const typedTags = tags as unknown as Array<{ newsletter_id: string; tags: Tag }>;
            typedTags.forEach((tag) => {
              if (!tagsByNewsletterId.has(tag.newsletter_id)) {
                tagsByNewsletterId.set(tag.newsletter_id, []);
              }
              // Only push a single Tag, not an array
              const tagList = tagsByNewsletterId.get(tag.newsletter_id);
              if (tagList) {
                // Ensure we're pushing a valid Tag object
                if (tag.tags && typeof tag.tags === 'object' && 'id' in tag.tags) {
                  tagList.push(tag.tags);
                } else {
                  console.warn('Invalid tag data:', tag.tags);
                }
              }
            });
          }
        }


        // Combine all the data
        const result = queueItems.map(queueItem => {
          const newsletter: NewsletterWithRelations = {
            ...queueItem.newsletters,
            newsletter_source_id: queueItem.newsletters.newsletter_source_id,
            source: queueItem.newsletters.newsletter_source_id ? {
              id: queueItem.newsletters.newsletter_source_id,
              name: (queueItem.newsletters as any).newsletter_sources?.name || 'Unknown Source',
              domain: (queueItem.newsletters as any).newsletter_sources?.domain || '',
              user_id: queueItem.newsletters.user_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } : null,
            tags: ((queueItem.newsletters as any).newsletter_tags?.map((tag: any) => ({
              id: tag.tag_id,
              name: tag.tags?.name || 'Unknown Tag',
              color: tag.tags?.color || '#6B7280',
              user_id: queueItem.newsletters.user_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })) || []) as Tag[],
            is_archived: queueItem.newsletters.is_archived || false,
            word_count: 0, // Default value, can be calculated if needed
            estimated_read_time: 0, // Default value, can be calculated if needed
            summary: queueItem.newsletters.summary || '',
            image_url: queueItem.newsletters.image_url || ''
          } as NewsletterWithRelations;

          return {
            id: queueItem.id,
            user_id: queueItem.user_id,
            newsletter_id: queueItem.newsletter_id,
            position: queueItem.position,
            created_at: queueItem.created_at,
            updated_at: queueItem.updated_at,
            newsletter: newsletter
          };
        });

        console.log('Processed reading queue items:', result);
        return result;
      } catch (error) {
        console.error('Error in useReadingQueue query:', error);
        throw error;
      }
    },
    enabled: !!user,
  });

  // Add to reading queue
  const addToQueue = useMutation({
    mutationFn: async (newsletterId: string) => {
      if (!user) throw new Error('User not authenticated');
      // Get current max position
      const { data: maxPosition } = await supabase
        .from('reading_queue')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      const position = maxPosition ? maxPosition.position + 1 : 0;
      const { error } = await supabase
        .from('reading_queue')
        .insert({
          user_id: user.id,
          newsletter_id: newsletterId,
          position,
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
    mutationFn: async (queueItemId: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('id', queueItemId);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue', user?.id] });
    }
  });

  // Toggle item in reading queue
  const toggleInQueue = async (newsletterId: string) => {
    const existingItem = readingQueue.find((item) => item.newsletter_id === newsletterId);
    if (existingItem) {
      await removeFromQueue.mutateAsync(existingItem.id);
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
      

      try {
        // Use a transaction to update all positions at once
        const { error } = await supabase.rpc('reorder_reading_queue', {
          updates: updates.map(update => ({
            id: update.id,
            position: update.position
          }))
        });
        
        if (error) throw error;
        
return true;
      } catch (error) {
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
    onError: (err, _variables, context) => {
      console.error('Error reordering queue:', err);
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
