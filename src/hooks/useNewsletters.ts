import { useCallback } from 'react'; // Removed unused useMemo
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  UseMutateAsyncFunction, 
  QueryObserverResult, 
  RefetchOptions
} from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import { Newsletter as NewsletterType, NewsletterUpdate, Tag } from '../types';

// Cache time in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

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
  // Trash (permanent delete) functionality
  deleteNewsletter: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isDeletingNewsletter: boolean;
  errorDeletingNewsletter: Error | null;
  bulkDeleteNewsletters: UseMutateAsyncFunction<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>;
  isBulkDeletingNewsletters: boolean;
  errorBulkDeletingNewsletters: Error | null;
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
  archiveNewsletter: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isArchiving: boolean;
  errorArchiving: Error | null;
  unarchiveNewsletter: UseMutateAsyncFunction<boolean, Error, string, { previousNewsletters?: Newsletter[] }>;
  isUnarchiving: boolean;
  errorUnarchiving: Error | null;
  bulkArchive: UseMutateAsyncFunction<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>;
  isBulkArchiving: boolean;
  errorBulkArchiving: Error | null;
  bulkUnarchive: UseMutateAsyncFunction<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>;
  isBulkUnarchiving: boolean;
  errorBulkUnarchiving: Error | null;
  getNewsletter: (id: string) => Promise<Newsletter | null>;
  refetchNewsletters: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<Newsletter[], Error>>;
}

// Helper function to transform newsletter data
const transformNewsletterData = (data: any[] | null): Newsletter[] => {
  return data
    ? data.map((item) => {
        // Extract tags if they exist
        const tags = item.newsletter_tags?.map((nt: any) => nt.tag ? {
          id: nt.tag.id,
          name: nt.tag.name,
          color: nt.tag.color,
          user_id: nt.tag.user_id,
          created_at: nt.tag.created_at,
        } : null).filter(Boolean) as Tag[] || [];

        // Extract source if it exists
        const source = item.source ? {
          id: item.source.id,
          name: item.source.name,
          domain: item.source.domain,
          user_id: item.source.user_id,
          created_at: item.source.created_at,
          updated_at: item.source.updated_at
        } : undefined;

        // Remove the newsletter_tags and source fields from the base object
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { newsletter_tags, ...rest } = item;
        
        return {
          ...rest,
          tags,
          source,
          newsletter_source_id: item.newsletter_source_id || null
        };
      })
    : [];
};

export const useNewsletters = (tagId?: string, filter: string = 'all', sourceId?: string): UseNewslettersReturn => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Generate a stable query key based on the current filters
  const getQueryKey = useCallback((tagIds?: string | string[]) => {
    const filters: Record<string, unknown> = { 
      filter,
      sourceId: sourceId || null,
      // Always include archive status in the key to force a refetch when it changes
      isArchiveFilter: filter === 'archived'
    };
    
    if (tagIds) {
      filters.tagIds = tagIds;
    }
    
    console.log('Generated query key with filters:', filters);
    return queryKeys.list(filters);
  }, [sourceId, filter]);

  const fetchNewslettersFn = useCallback(async (tagIds?: string | string[]): Promise<Newsletter[]> => {
    if (!user) throw new Error('User not authenticated');

    console.log('Fetching newsletters with filters:', { sourceId, filter, tagIds });

    // Start with base query - fetch everything and let the query function handle filtering
    let query = supabase
      .from('newsletters')
      .select(
        `
        *,
        newsletter_source:newsletter_sources(*),
        newsletter_tags (
          tag:tags (id, name, color)
        )
      `
      )
      .eq('user_id', user.id)
      .order('received_at', { ascending: false });

    // Don't apply any server-side filtering here - let the query function handle it
    // This ensures we have all the data we need for different filter combinations

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
    const newsletters = transformNewsletterData(data);

    // Fetch all sources in one query and attach them
    const sourceIds = Array.from(new Set(newsletters.map(n => n.newsletter_source_id).filter(Boolean)));
    let sourcesMap: Record<string, any> = {};
    if (sourceIds.length > 0) {
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('newsletter_sources')
        .select('*')
        .in('id', sourceIds);
      if (!sourcesError && sourcesData) {
        sourcesMap = Object.fromEntries(sourcesData.map((s: any) => [s.id, s]));
      }
    }
    // Attach the source object to each newsletter
    const newslettersWithSources = newsletters.map(n => ({
      ...n,
      source: n.newsletter_source_id ? sourcesMap[n.newsletter_source_id] || null : null
    }));
    return newslettersWithSources;
  }, [user]);

  // Convert comma-separated tagIds to array if needed
  const normalizedTagId = tagId?.includes(',') ? tagId.split(',').filter(Boolean) : tagId;
  
  const queryKey = getQueryKey(normalizedTagId);

  // Apply filters based on the current view
  const fetchNewsletters = useCallback(async (tagIds?: string | string[]) => {
    console.log('Fetching newsletters with filter:', filter, 'sourceId:', sourceId);
    const data = await fetchNewslettersFn(tagIds);
    console.log('Fetched newsletters count:', data.length);
    return data;
  }, [fetchNewslettersFn, filter, sourceId]);

  // Main query for newsletters
  const { 
    data: newsletters = [], 
    isLoading: isLoadingNewsletters, 
    isError: isErrorNewsletters, 
    error: errorNewsletters, 
    refetch: refetchNewsletters 
  } = useQuery<Newsletter[], Error>({
    queryKey: getQueryKey(tagId ? [tagId] : undefined),
    queryFn: async () => {
      console.log('Running query with sourceId:', sourceId, 'and filter:', filter);
      const result = await fetchNewsletters(tagId ? [tagId] : undefined);
      console.log('Query result count:', result.length, { sourceId, filter });
      // Apply client-side filtering as a fallback
      let filtered = [...result];
      if (sourceId) {
        filtered = filtered.filter(n => n.newsletter_source_id === sourceId);
      }
      if (filter === 'unread') {
        filtered = filtered.filter(n => !n.is_read);
      } else if (filter === 'liked') {
        filtered = filtered.filter(n => n.is_liked);
      } else if (filter === 'archived') {
        filtered = filtered.filter(n => n.is_archived);
      } else {
        filtered = filtered.filter(n => !n.is_archived);
      }
      console.log('Filtered result count:', filtered.length);
      return filtered;
    },
    enabled: !!user,
    // Cache settings for optimal filter switching
    staleTime: 0, // Always consider data stale to trigger refetches
    gcTime: CACHE_DURATION, // Keep cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });

  // Helper function to update newsletter in cache
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<Newsletter>) => {
    queryClient.setQueriesData<Newsletter[]>({ queryKey: queryKeys.lists() }, (old) => {
      if (!old) return old;
      return old.map((n) => (n.id === id ? { ...n, ...updates } : n));
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

  // Mutation for archiving a newsletter
  const archiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.lists() }),
        queryClient.cancelQueries({ queryKey: ['newsletters'] }),
        queryClient.cancelQueries({ queryKey: ['newslettersBySource'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'inbox'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'archived'] })
      ]);
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { 
          is_archived: true,
          updated_at: new Date().toISOString()
        });
      }
      
      return { previousNewsletters };
    },
    onError: (_err, _id, context) => {
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['newslettersBySource'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'archived'] });
      // Invalidate newsletter sources to update counts
      queryClient.invalidateQueries({ queryKey: ['newsletter_sources', 'user', user?.id] });
      
      // Force refetch of the current view to ensure UI is in sync
      queryClient.refetchQueries({ 
        queryKey: filter === 'archived' 
          ? ['newsletters', 'archived'] 
          : ['newsletters', 'inbox'] 
      });
    },
  });

  // Mutation for unarchiving a newsletter
  const unarchiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.lists() }),
        queryClient.cancelQueries({ queryKey: ['newsletters'] }),
        queryClient.cancelQueries({ queryKey: ['newslettersBySource'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'inbox'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'archived'] })
      ]);
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { 
          is_archived: false,
          updated_at: new Date().toISOString()
        });
      }
      
      return { previousNewsletters };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.lists() }),
        queryClient.cancelQueries({ queryKey: ['newsletters'] }),
        queryClient.cancelQueries({ queryKey: ['newslettersBySource'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'inbox'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'archived'] })
      ]);
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { 
          is_archived: true,
          updated_at: new Date().toISOString()
        }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['newslettersBySource'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'archived'] });
      // Invalidate newsletter sources to update counts
      queryClient.invalidateQueries({ queryKey: ['newsletter_sources', 'user', user?.id] });
    },
  });

  // Bulk unarchive mutation
  const bulkUnarchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false,
          updated_at: new Date().toISOString()
        })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.lists() }),
        queryClient.cancelQueries({ queryKey: ['newsletters'] }),
        queryClient.cancelQueries({ queryKey: ['newslettersBySource'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'inbox'] }),
        queryClient.cancelQueries({ queryKey: ['newsletters', 'archived'] })
      ]);
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { 
          is_archived: false,
          updated_at: new Date().toISOString()
        }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['newslettersBySource'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'archived'] });
      // Invalidate newsletter sources to update counts
      queryClient.invalidateQueries({ queryKey: ['newsletter_sources', 'user', user?.id] });
    },
  });

  // Permanent delete (trash) mutation
  const deleteNewsletterMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.lists() });
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      if (previousNewsletters) {
        queryClient.setQueryData(queryKey, previousNewsletters.filter(n => n.id !== id));
      }
      return { previousNewsletters };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
    },
  });

  // Bulk permanent delete (trash) mutation
  const bulkDeleteNewslettersMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.lists() });
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(queryKey);
      if (previousNewsletters) {
        queryClient.setQueryData(queryKey, previousNewsletters.filter(n => !ids.includes(n.id)));
      }
      return { previousNewsletters };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(queryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
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

  // (Removed) Function to load archived newsletters

  return {
    newsletters, // from useQuery
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    errorMarkingAsRead: markAsReadMutation.error,

    markAsUnread: markAsUnreadMutation.mutateAsync,
    isMarkingAsUnread: markAsUnreadMutation.isPending,
    errorMarkingAsUnread: markAsUnreadMutation.error,

    toggleLike,
    isTogglingLike,
    errorTogglingLike,

    bulkMarkAsRead: bulkMarkAsReadMutation.mutateAsync,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,

    bulkMarkAsUnread: bulkMarkAsUnreadMutation.mutateAsync,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending,
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,

      // Archive functionality
    archiveNewsletter: archiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
    errorArchiving: archiveMutation.error,
    
    unarchiveNewsletter: unarchiveMutation.mutateAsync,
    isUnarchiving: unarchiveMutation.isPending,
    errorUnarchiving: unarchiveMutation.error,
    
    bulkArchive: bulkArchiveMutation.mutateAsync,
    isBulkArchiving: bulkArchiveMutation.isPending,
    errorBulkArchiving: bulkArchiveMutation.error,
    
    bulkUnarchive: bulkUnarchiveMutation.mutateAsync,
    isBulkUnarchiving: bulkUnarchiveMutation.isPending,
    errorBulkUnarchiving: bulkUnarchiveMutation.error,
    
    getNewsletter,
    refetchNewsletters,

    // Trash (permanent delete) functionality
    deleteNewsletter: deleteNewsletterMutation.mutateAsync,
    isDeletingNewsletter: deleteNewsletterMutation.isPending,
    errorDeletingNewsletter: deleteNewsletterMutation.error,
    bulkDeleteNewsletters: bulkDeleteNewslettersMutation.mutateAsync,
    isBulkDeletingNewsletters: bulkDeleteNewslettersMutation.isPending,
    errorBulkDeletingNewsletters: bulkDeleteNewslettersMutation.error,
  };
};