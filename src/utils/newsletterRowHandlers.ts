import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Newsletter, Tag } from '../types';
import { supabase } from '../services/supabaseClient';

type UseNewsletterRowHandlersProps = {
  queryClient: ReturnType<typeof useQueryClient>;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  navigateToInboxWithTag?: (tagId: string) => void;
};

export const useNewsletterRowHandlers = ({
  queryClient,
  searchParams,
  setSearchParams,
  navigateToInboxWithTag,
}: UseNewsletterRowHandlersProps) => {
  // Toggle like status for a newsletter
  const handleToggleLike = async (newsletter: Newsletter): Promise<void> => {
    try {
      const { error } = await supabase
        .from('newsletters')
        .update({ is_liked: !newsletter.is_liked })
        .eq('id', newsletter.id);

      if (error) throw error;

      // Invalidate the newsletters query to refetch data
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like status');
      throw error;
    }
  };

  // Toggle archive status for a newsletter
  const handleToggleArchive = async (id: string): Promise<void> => {
    try {
      // First get the current archive status
      const { data: newsletter } = await supabase
        .from('newsletters')
        .select('is_archived')
        .eq('id', id)
        .single();

      if (!newsletter) throw new Error('Newsletter not found');

      const { error } = await supabase
        .from('newsletters')
        .update({ is_archived: !newsletter.is_archived })
        .eq('id', id);

      if (error) throw error;

      // Invalidate the newsletters query to refetch data
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } catch (error) {
      console.error('Error toggling archive status:', error);
      toast.error('Failed to update archive status');
      throw error;
    }
  };

  // Toggle read status for a newsletter
  const handleToggleRead = async (id: string): Promise<void> => {
    try {
      // First get the current read status
      const { data: newsletter } = await supabase
        .from('newsletters')
        .select('is_read')
        .eq('id', id)
        .single();

      if (!newsletter) throw new Error('Newsletter not found');

      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: !newsletter.is_read })
        .eq('id', id);

      if (error) throw error;

      // Invalidate the newsletters query to refetch data
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } catch (error) {
      console.error('Error toggling read status:', error);
      toast.error('Failed to update read status');
      throw error;
    }
  };

  // Toggle reading queue status for a newsletter
  const handleToggleQueue = async (newsletter: Newsletter): Promise<void> => {
    try {
      // Check if newsletter is already in the queue
      const { data: existing } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('newsletter_id', newsletter.id)
        .maybeSingle();

      if (existing) {
        // Remove from queue
        const { error } = await supabase
          .from('reading_queue')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Add to queue
        const { error } = await supabase
        .from('reading_queue')
        .insert([{ 
          newsletter_id: newsletter.id,
          user_id: (await supabase.auth.getUser()).data.user?.id 
        }]);

        if (error) throw error;
      }

      // Invalidate the reading queue query to refetch data
      await queryClient.invalidateQueries({ queryKey: ['readingQueue'] });
    } catch (error) {
      console.error('Error toggling reading queue:', error);
      toast.error('Failed to update reading queue');
      throw error;
    }
  };

  // Update tags for a newsletter
  const handleUpdateTags = async (newsletterId: string, tagIds: string[]): Promise<void> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // First delete existing tags for this newsletter
      const { error: updateError } = await supabase
        .from('newsletter_tags')
        .delete()
        .eq('newsletter_id', newsletterId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      if (tagIds.length > 0) {
        // Insert new tags with user_id
        const { error: insertError } = await supabase
          .from('newsletter_tags')
          .insert(tagIds.map(tagId => ({
            newsletter_id: newsletterId,
            tag_id: tagId,
            user_id: user.id  // Include user_id for RLS
          })));

        if (insertError) throw insertError;
      }

      // Invalidate the newsletters query to refetch data
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error('Failed to update tags');
      throw error;
    }
  };

  // Handle tag click to filter by tag
  const handleTagClick = (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If navigateToInboxWithTag is provided, use it for navigation
    if (navigateToInboxWithTag) {
      navigateToInboxWithTag(tag.id);
      return;
    }
    
    // Otherwise, use the existing tag filtering logic
    const currentTags = new Set(searchParams.get('tag')?.split(',').filter(Boolean) || []);
    
    if (currentTags.has(tag.id)) {
      currentTags.delete(tag.id);
    } else {
      currentTags.add(tag.id);
    }
    
    const newParams = new URLSearchParams(searchParams);
    if (currentTags.size > 0) {
      newParams.set('tag', Array.from(currentTags).join(','));
    } else {
      newParams.delete('tag');
    }
    
    setSearchParams(newParams);
  };

  return {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleToggleQueue,
    handleUpdateTags,
    handleTagClick,
  };
};
