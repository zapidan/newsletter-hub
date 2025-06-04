import { useCallback } from 'react';
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  UseMutateAsyncFunction, 
  QueryObserverResult, 
  RefetchOptions,
  keepPreviousData
} from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';
import { Newsletter as NewsletterType, NewsletterUpdate, Tag } from '../types';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Query keys
const queryKeys = {
  all: ['newsletters'],
  lists: () => [...queryKeys.all, 'list'],
  list: (filters: Record<string, unknown> = {}) => [...queryKeys.lists(), filters],
  detail: (id: string) => [...queryKeys.all, 'detail', id],
  tags: (tagId?: string) => tagId ? [...queryKeys.all, 'tags', tagId] : [...queryKeys.all, 'tags'],
};

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

  // Generate a stable query key based on the current filters
  const getQueryKey = useCallback((tagIds?: string | string[]) => {
    return queryKeys.list(tagIds ? { tagIds } : {});
  }, []);

  const fetchNewslettersFn = useCallback(async (tagIds?: string | string[]): Promise<Newsletter[]> => {
    if (!user) throw new Error('User not authenticated');
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

    if (tagIds) {
      const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      
      // For each tag, find newsletters that have that tag
      const newsletterIdsByTag = await Promise.all(
        tagIdsArray.map(async (tagId) => {
          const { data: newsletterTagRows, error: tagError } = await supabase
            .from('newsletter_tags')
            .select('newsletter_id')
            .eq('tag_id', tagId);
          if (tagError) throw tagError;
          return (newsletterTagRows || []).map(row => row.newsletter_id);
        })
      );
      
      // Find the intersection of all newsletter IDs (newsletters that have ALL tags)
      if (newsletterIdsByTag.length > 0) {
        // Start with the first set of IDs
        let commonIds = new Set(newsletterIdsByTag[0]);
        
        // Intersect with each subsequent set
        for (let i = 1; i < newsletterIdsByTag.length; i++) {
          const currentSet = new Set(newsletterIdsByTag[i]);
          commonIds = new Set([...commonIds].filter(id => currentSet.has(id)));
        }
        
        if (commonIds.size > 0) {
          query = query.in('id', Array.from(commonIds));
        } else {
          return []; // No newsletters match all tags
        }
      }
    }

    query = query.order('received_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return transformNewsletterData(data);
  }, [user]);

  // Convert comma-separated tagIds to array if needed
  const normalizedTagId = tagId?.includes(',') ? tagId.split(',').filter(Boolean) : tagId;
  
  const queryKey = getQueryKey(normalizedTagId);

  const {
    data: newsletters = [],
    isLoading: isLoadingNewsletters,
    isError: isErrorNewsletters,
    error: errorNewsletters,
    refetch: refetchNewsletters,
  } = useQuery<Newsletter[], Error>({
    queryKey,
    queryFn: () => fetchNewslettersFn(normalizedTagId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    placeholderData: keepPreviousData, // Keep previous data while fetching new data,
    enabled: !!user,
  });

  // Helper function to update newsletter in cache
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<Newsletter>) => {
    queryClient.setQueriesData<Newsletter[]>({ queryKey: queryKeys.lists() }, (old) => {
      if (!old) return [];
      return old.map(item => 
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      );
    });
  }, [queryClient]);

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
        queryKey: queryKey
      });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_liked: !previousNewsletters.find(n => n.id === id)?.is_liked });
      }
      
      return { previousNewsletters };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    // Always refetch after error or success:
    onSettled: () => {
      // Invalidate both the main query and any individual newsletter queries
      queryClient.invalidateQueries({
        queryKey: queryKey
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
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_read: true });
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
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
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_read: false });
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
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
    onMutate: async (ids: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { is_read: true }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _ids: string[], context: { previousNewsletters?: Newsletter[] } | undefined) => {
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
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
    onMutate: async (ids: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { is_read: false }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _ids: string[], context: { previousNewsletters?: Newsletter[] } | undefined) => {
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Function to get a single newsletter (not a direct query in this hook, but uses a mutation)
  const getNewsletter = useCallback(async (id: string): Promise<Newsletter | null> => {
    // First try to get from any existing query
    const queryCache = queryClient.getQueryCache();
    const query = queryCache.find({
      queryKey: queryKeys.detail(id),
      exact: true,
    });

    // If we have it in cache, return it
    if (query?.state.data) {
      return query.state.data as Newsletter;
    }

    // Check if it's in any of the list caches
    const listQueries = queryCache.findAll({ queryKey: queryKeys.lists() });
    for (const listQuery of listQueries) {
      const newsletters = listQuery.state.data as Newsletter[] | undefined;
      const found = newsletters?.find(n => n.id === id);
      if (found) return found;
    }

    // If not in cache, fetch from API
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
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        const transformed = transformNewsletterData([data]);
        const newsletter = transformed[0];
        
        // Update the detail cache
        queryClient.setQueryData(queryKeys.detail(id), newsletter);
        
        // Update any list caches that might contain this newsletter
        listQueries.forEach(query => {
          queryClient.setQueryData<Newsletter[]>(query.queryKey, (old = []) => {
            const exists = old.some(n => n.id === id);
            return exists 
              ? old.map(n => n.id === id ? newsletter : n)
              : [...old, newsletter];
          });
        });
        
        return newsletter;
      }
      return null;
    } catch (error) {

      return null;
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