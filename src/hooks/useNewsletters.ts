import { useCallback, useMemo, useContext } from 'react';
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
        const tags = item.newsletter_tags?.map((nt: any) => nt.tag ? {
          id: nt.tag.id,
          name: nt.tag.name,
          color: nt.tag.color,
          user_id: nt.tag.user_id,
          created_at: nt.tag.created_at,
        } : null).filter(Boolean) as Tag[] || [];

        const source = item.source ? {
          id: item.source.id,
          name: item.source.name,
          domain: item.source.domain,
          user_id: item.source.user_id,
          created_at: item.source.created_at,
          updated_at: item.source.updated_at
        } : undefined;

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

  // Convert comma-separated tagIds to array if needed
  const normalizedTagId = tagId?.includes(',') ? tagId.split(',').filter(Boolean) : tagId;

  // Generate a stable query key - include filter, tagId, and sourceId for proper cache separation
  const getQueryKey = useCallback(() => {
    return queryKeys.list({ 
      type: 'all-newsletters', 
      filter, 
      tagId: normalizedTagId, 
      sourceId 
    });
  }, [filter, normalizedTagId, sourceId]);

  // Fetch all newsletters from the database without any sorting (let client handle it)
  const fetchAllNewsletters = useCallback(async (): Promise<Newsletter[]> => {
    if (!user) throw new Error('User not authenticated');

    console.log('Fetching all newsletters');

    // Fetch all newsletters with their related data - NO SORTING on backend
    const { data, error } = await supabase
      .from('newsletters')
      .select(`
        *,
        newsletter_source:newsletter_sources(*),
        newsletter_tags (
          tag:tags (id, name, color)
        )
      `)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error fetching newsletters:', error);
      throw error;
    }

    // Fetch all sources in one query and attach them
    const sourceIds = Array.from(new Set(data.map(n => n.newsletter_source_id).filter(Boolean)));
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
    const newslettersWithSources = data.map(n => ({
      ...n,
      source: n.newsletter_source_id ? sourcesMap[n.newsletter_source_id] || null : null
    }));
    return transformNewsletterData(newslettersWithSources);
  }, [user]);

  const queryKey = getQueryKey();

  // Apply filters and sorting to the newsletters
  const filterNewsletters = useCallback((newsletters: Newsletter[], tagIds?: string | string[]) => {
    let filtered = [...newsletters];
    
    // Apply tag filter if provided
    if (tagIds && tagIds.length > 0) {
      const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      filtered = filtered.filter(newsletter => 
        newsletter.tags?.some(tag => tag && tag.id && tagIdsArray.includes(tag.id))
      );
      console.log(`Filtered to ${filtered.length} newsletters with tags:`, tagIdsArray);
    }
    
    // Apply status filters
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.is_read && !n.is_archived);
    } else if (filter === 'liked') {
      filtered = filtered.filter(n => n.is_liked && !n.is_archived);
    } else if (filter === 'archived') {
      filtered = filtered.filter(n => n.is_archived);
    } else {
      // Default: show unarchived items
      filtered = filtered.filter(n => !n.is_archived);
    }
    
    // Apply source filter if active
    if (sourceId) {
      filtered = filtered.filter(n => n.newsletter_source_id === sourceId);
    }
    
    // CLIENT-SIDE SORTING based on filter
    if (filter === 'all') {
      // Sort by received_at descending for "all"
      filtered.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    } else if (filter === 'liked' || filter === 'archived') {
      // Sort by updated_at descending for "liked" and "archived"
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else {
      // Default: sort by received_at descending for other filters
      filtered.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    }
    
    console.log(`Filtered to ${filtered.length} newsletters with filter:`, { filter, sourceId });
    return filtered;
  }, [filter, sourceId]);

  // Main query for all newsletters - fetch once, no sorting
  const { 
    data: allNewsletters = [], 
    isLoading: isLoadingNewsletters, 
    isError: isErrorNewsletters, 
    error: errorNewsletters, 
    refetch: refetchNewsletters 
  } = useQuery<Newsletter[]>({
    queryKey: ['newsletters', 'all', user?.id], // Simple cache key for raw data
    queryFn: fetchAllNewsletters,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: CACHE_DURATION, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !!user,
  });

  // Apply filters and sorting to the cached data
  const newsletters = useMemo(() => {
    if (!allNewsletters.length) return [];
    return filterNewsletters(allNewsletters, normalizedTagId);
  }, [allNewsletters, filterNewsletters, normalizedTagId]);

  // Helper function to update newsletter in cache
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<Newsletter>) => {
    const cacheKey = ['newsletters', 'all', user?.id];
    queryClient.setQueryData<Newsletter[]>(cacheKey, (old = []) => {
      if (!old) return [];
      return old.map(item => {
        if (item.id === id) {
          // Always update updated_at when any update happens
          const now = new Date().toISOString();
          return { 
            ...item, 
            ...updates, 
            updated_at: updates.updated_at !== undefined ? updates.updated_at : now 
          };
        }
        return item;
      });
    });
  }, [queryClient, user?.id]);

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
      const cacheKey = ['newsletters', 'all', user?.id];
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      // Optimistically update to the new value
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_liked: !previousNewsletters.find(n => n.id === id)?.is_liked });
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      // Invalidate the main cache
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_read: true });
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_read: false });
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _id: string, context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { is_read: true }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _ids: string[], context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { is_read: false }));
      }
      
      return { previousNewsletters };
    },
    onError: (_err: Error, _ids: string[], context: { previousNewsletters?: Newsletter[] } | undefined) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // Mutation for archiving a newsletter
  const archiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; now?: string }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: true,
          updated_at: now
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      const now = new Date().toISOString();
      const cacheKey = ['newsletters', 'all', user?.id];
      
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        updateNewsletterInCache(id, { 
          is_archived: true,
          updated_at: now
        });
      }
      
      return { previousNewsletters, now };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletter_sources', 'user', user?.id] });
    },
  });

  // Mutation for unarchiving a newsletter
  const unarchiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; now?: string }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false,
          updated_at: now
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      const now = new Date().toISOString();
      const cacheKey = ['newsletters', 'all', user?.id];
      
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        updateNewsletterInCache(id, { 
          is_archived: false,
          updated_at: now
        });
      }
      
      return { previousNewsletters, now };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: true,
          updated_at: now
        })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      const now = new Date().toISOString();
      const cacheKey = ['newsletters', 'all', user?.id];
      
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { 
          is_archived: true,
          updated_at: now
        }));
      }
      
      return { previousNewsletters, now };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletter_sources', 'user', user?.id] });
    },
  });

  // Bulk unarchive mutation
  const bulkUnarchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[] }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false,
          updated_at: now
        })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      const now = new Date().toISOString();
      const cacheKey = ['newsletters', 'all', user?.id];
      
      await queryClient.cancelQueries({ queryKey: cacheKey });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      
      if (previousNewsletters) {
        ids.forEach(id => updateNewsletterInCache(id, { 
          is_archived: false,
          updated_at: now
        }));
      }
      
      return { previousNewsletters, now };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      if (previousNewsletters) {
        queryClient.setQueryData(cacheKey, previousNewsletters.filter(n => n.id !== id));
      }
      return { previousNewsletters };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
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
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      if (previousNewsletters) {
        queryClient.setQueryData(cacheKey, previousNewsletters.filter(n => !ids.includes(n.id)));
      }
      return { previousNewsletters };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
    },
  });

  // Function to get a single newsletter
  const getNewsletter = useCallback(async (id: string): Promise<Newsletter | null> => {
    // First try to get from cache
    const cacheKey = ['newsletters', 'all', user?.id];
    const cachedNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
    const found = cachedNewsletters?.find(n => n.id === id);
    if (found) return found;

    // If not in cache, fetch from API
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select(`
          *,
          newsletter_tags (
            tag:tags (id, name, color)
          )
        `)
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        const transformed = transformNewsletterData([data]);
        const newsletter = transformed[0];
        
        // Update the cache
        if (cachedNewsletters) {
          queryClient.setQueryData<Newsletter[]>(cacheKey, (old = []) => {
            const exists = old.some(n => n.id === id);
            return exists 
              ? old.map(n => n.id === id ? newsletter : n)
              : [...old, newsletter];
          });
        }
        
        return newsletter;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [user, queryClient]);

  return {
    newsletters,
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

    deleteNewsletter: deleteNewsletterMutation.mutateAsync,
    isDeletingNewsletter: deleteNewsletterMutation.isPending,
    errorDeletingNewsletter: deleteNewsletterMutation.error,
    bulkDeleteNewsletters: bulkDeleteNewslettersMutation.mutateAsync,
    isBulkDeletingNewsletters: bulkDeleteNewslettersMutation.isPending,
    errorBulkDeletingNewsletters: bulkDeleteNewslettersMutation.error,
  };
};
