import { useState, useCallback, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { AuthContext } from '@common/contexts/AuthContext';
import { Tag, TagCreate, TagUpdate } from '@common/types';

export const useTags = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all tags for the current user
  const getTags = useCallback(async (): Promise<Tag[]> => {
    if (!user) return [];
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error fetching tags:', err);
      setError(err.message || 'Failed to load tags');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new tag
  const createTag = useCallback(async (tag: TagCreate): Promise<Tag | null> => {
    if (!user) return null;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .insert([{ ...tag, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
        queryClient.invalidateQueries({ queryKey: ['newsletter_tags'] })
      ]);
      
      return data;
    } catch (err: any) {
      console.error('Error creating tag:', err);
      setError(err.message || 'Failed to create tag');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, queryClient]);

  // Update an existing tag
  const updateTag = useCallback(async (tag: TagUpdate): Promise<Tag | null> => {
    if (!user) return null;
    
    try {
      setLoading(true);
      const { id, ...updates } = tag;
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
        queryClient.invalidateQueries({ queryKey: ['newsletter_tags'] }),
        queryClient.invalidateQueries({ queryKey: ['newsletters'] })
      ]);
      
      return data;
    } catch (err: any) {
      console.error('Error updating tag:', err);
      setError(err.message || 'Failed to update tag');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, queryClient]);

  // Delete a tag
  const deleteTag = useCallback(async (tagId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
        queryClient.invalidateQueries({ queryKey: ['newsletter_tags'] }),
        queryClient.invalidateQueries({ queryKey: ['newsletters'] })
      ]);
      
      return true;
    } catch (err: any) {
      console.error('Error deleting tag:', err);
      setError(err.message || 'Failed to delete tag');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, queryClient]);

  // Get tags for a specific newsletter
  interface NewsletterTagJoin {
    tag: Tag;
  }

  const getTagsForNewsletter = useCallback(async (newsletterId: string): Promise<Tag[]> => {
    if (!user) return [];
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('newsletter_tags')
        .select('tag:tags(*)')
        .eq('newsletter_id', newsletterId) as { data: NewsletterTagJoin[] | null; error: any };

      if (error) throw error;
      return data?.map(item => item.tag) || [];
    } catch (err: any) {
      console.error('Error fetching newsletter tags:', err);
      setError(err.message || 'Failed to load newsletter tags');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update tags for a newsletter
  const updateNewsletterTags = useCallback(
    async (newsletterId: string, tags: Tag[]) => {
      if (!user) return false;
      
      try {
        setLoading(true);
        
        // Get current tags
        const { data: currentTags, error: currentTagsError } = await supabase
          .from('newsletter_tags')
          .select('tag_id')
          .eq('newsletter_id', newsletterId);
        
        if (currentTagsError) throw currentTagsError;
        
        // Compute tags to add and remove
        const currentTagIds = (currentTags || []).map((t: any) => t.tag_id);
        const newTagIds = tags.map(tag => tag.id);
        const tagsToAdd = newTagIds.filter((id: string) => !currentTagIds.includes(id));
        const tagsToRemove = currentTagIds.filter((id: string) => !newTagIds.includes(id));

        // Add new tags
        if (tagsToAdd.length > 0) {
          const { error: addError } = await supabase
            .from('newsletter_tags')
            .insert(tagsToAdd.map(tagId => ({
              newsletter_id: newsletterId,
              tag_id: tagId,
              user_id: user.id
            })));

          if (addError) throw addError;
        }

        // Remove tags
        if (tagsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('newsletter_tags')
            .delete()
            .eq('newsletter_id', newsletterId)
            .in('tag_id', tagsToRemove);

          if (removeError) throw removeError;
        }

        // Invalidate relevant queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['newsletter_tags'] }),
          queryClient.invalidateQueries({ queryKey: ['newsletters'] }),
          queryClient.invalidateQueries({ queryKey: ['tags'] }),
          queryClient.invalidateQueries({ queryKey: ['newsletter', newsletterId] })
        ]);
        
        return true;
      } catch (err: any) {
        console.error('Error updating newsletter tags:', err);
        setError(err.message || 'Failed to update newsletter tags');
        return false;
      } finally {
        setLoading(false);
      }
    }, [user, queryClient]
  );

  return {
    loading,
    error,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    getTagsForNewsletter,
    updateNewsletterTags,
  };
};
