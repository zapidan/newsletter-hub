import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutateAsyncFunction, QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';
import { Newsletter as NewsletterType, NewsletterUpdate, Tag } from '../types';

export type Newsletter = NewsletterType;

// Define the return type for the useNewsletters hook
interface UseNewslettersReturn {
  newsletters: Newsletter[];
  isLoadingNewsletters: boolean;
  isErrorNewsletters: boolean;
  errorNewsletters: Error | null;
  markAsRead: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isMarkingAsRead: boolean;
  errorMarkingAsRead: Error | null;
  markAsUnread: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isMarkingAsUnread: boolean;
  errorMarkingAsUnread: Error | null;
  toggleLike: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;
  bulkMarkAsRead: UseMutateAsyncFunction<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>;
  isBulkMarkingAsRead: boolean;
  errorBulkMarkingAsRead: Error | null;
  bulkMarkAsUnread: UseMutateAsyncFunction<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>;
  isBulkMarkingAsUnread: boolean;
  errorBulkMarkingAsUnread: Error | null;
  getNewsletter: (id: string) => Promise<Newsletter | null>;
  refetchNewsletters: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<Newsletter[], Error>>;
}

// Helper function to transform newsletter data
const transformNewsletterData = (data: any[] | null): Newsletter[] => {
  return data
    ? data.map((item) => ({
        ...item,
        tags:
          item.newsletter_tags?.map((nt: any) => nt.tag ? {
            id: nt.tag.id,
            name: nt.tag.name,
            color: nt.tag.color,
            user_id: nt.tag.user_id,
            created_at: nt.tag.created_at,
          } : null).filter(Boolean) as Tag[] || [],
      }))
    : [];
};

export const useNewsletters = (tagId?: string): UseNewslettersReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchNewslettersFn = async (currentTagId?: string): Promise<Newsletter[]> => {
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('newsletters')
      .select(
        `
        *,
        newsletter_tags (
          tag:tags (id, name, color)
        )
      `
      )
      .eq('user_id', user.id);

    if (currentTagId) {
      const { data: newsletterTagRows, error: tagError } = await supabase
        .from('newsletter_tags')
        .select('newsletter_id')
        .eq('tag_id', currentTagId);
      if (tagError) throw tagError;
      const ids = (newsletterTagRows || []).map((row) => row.newsletter_id);
      if (ids.length > 0) {
        query = query.in('id', ids);
      } else {
        return []; // No newsletters for this tag
      }
    }

    query = query.order('received_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return transformNewsletterData(data);
  };

  const queryResult = useQuery<Newsletter[], Error>({
    queryKey: ['newsletters', user?.id, tagId],
    queryFn: () => fetchNewslettersFn(tagId),
    enabled: !!user,
  });

  const newsletters: Newsletter[] = queryResult.data ? queryResult.data : ([] as Newsletter[]);
  const isLoadingNewsletters: boolean = queryResult.isLoading;
  const isErrorNewsletters: boolean = queryResult.isError;
  const errorNewsletters: Error | null = queryResult.error;
  const refetchNewsletters = queryResult.refetch;

  // Mutation for toggling like
  const { 
    mutateAsync: toggleLike, 
    isPending: isTogglingLike, 
    error: errorTogglingLike 
  } = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) return false;
      
      // First get the current like status
      const { data: currentNewsletter } = await supabase
        .from('newsletters')
        .select('is_liked')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      if (!currentNewsletter) throw new Error('Newsletter not found');
      
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_liked: !currentNewsletter.is_liked
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return !currentNewsletter.is_liked;
    },
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: ['newsletters', user?.id, tagId]
      });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(['newsletters', user?.id, tagId]);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        queryClient.setQueryData<Newsletter[]>(
          ['newsletters', user?.id, tagId],
          previousNewsletters.map(newsletter =>
            newsletter.id === id 
              ? { 
                  ...newsletter, 
                  is_liked: !newsletter.is_liked
                } 
              : newsletter
          )
        );
      }
      
      return { previousNewsletters };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(['newsletters', user?.id, tagId], context.previousNewsletters);
      }
    },
    // Always refetch after error or success:
    onSettled: () => {
      // Invalidate both the main query and any individual newsletter queries
      queryClient.invalidateQueries({
        queryKey: ['newsletters', user?.id, tagId]
      });
      queryClient.invalidateQueries({
        queryKey: ['newsletters', user?.id]
      });
    },
  });

  // Mutation for marking a newsletter as read
  const markAsReadMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: true } as NewsletterUpdate)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', user?.id, tagId] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Mutation for marking a newsletter as unread
  const markAsUnreadMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: false } as NewsletterUpdate)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', user?.id, tagId] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Mutation for bulk marking newsletters as read
  const bulkMarkAsReadMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: true } as NewsletterUpdate)
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', user?.id, tagId] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Mutation for bulk marking newsletters as unread
  const bulkMarkAsUnreadMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: false } as NewsletterUpdate)
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', user?.id, tagId] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Function to get a single newsletter (not a direct query in this hook, but uses a mutation)
  const getNewsletter = useCallback(async (id: string): Promise<Newsletter | null> => {
    if (!user) {
      // Or throw new Error('User not authenticated');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select(
          `
          *,
          newsletter_tags (
            tag:tags (id, name, color)
          )
        `
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (!data) return null;

      const transformed = transformNewsletterData([data])[0];
      
      if (!transformed.is_read) {
        // Use the mutation to mark as read, which will also trigger list refresh
        await markAsReadMutation.mutateAsync(id);
        // The list will update via query invalidation. 
        // To get the absolute latest for this specific item immediately,
        // you might need to refetch it or trust the optimistic update if implemented.
        // For simplicity, we assume the list update is sufficient or a detail page would have its own query.
        return { ...transformed, is_read: true }; 
      }
      return transformed;
    } catch (err: any) {
      console.error('Error fetching single newsletter:', err);
      // This error is for the getNewsletter operation itself, not the main list query
      throw err; 
    }
  }, [user, queryClient, tagId, markAsReadMutation]); // Added markAsReadMutation to dependencies

  return {
    newsletters, // from useQuery
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending, // Changed from isLoading to isPending
    errorMarkingAsRead: markAsReadMutation.error,

    markAsUnread: markAsUnreadMutation.mutateAsync,
    isMarkingAsUnread: markAsUnreadMutation.isPending, // Changed from isLoading to isPending
    errorMarkingAsUnread: markAsUnreadMutation.error,

    toggleLike,
    isTogglingLike,
    errorTogglingLike,

    bulkMarkAsRead: bulkMarkAsReadMutation.mutateAsync,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending, // Changed from isLoading to isPending
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,

    bulkMarkAsUnread: bulkMarkAsUnreadMutation.mutateAsync,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending, // Changed from isLoading to isPending
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,
    
    getNewsletter, // Remains an async function
    refetchNewsletters, // Add refetchNewsletters to the return object
  };
};