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

import { NewsletterSource, Newsletter as NewsletterType, NewsletterUpdate, Tag } from '../types';

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

  // Fetch all newsletters from the database without any sorting (let client handle it)
  const fetchAllNewsletters = useCallback(async (): Promise<Newsletter[]> => {
    if (!user) throw new Error('User not authenticated');

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
    
    if (error) throw error;

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

  // Main query for all newsletters - fetch once, no sorting
  const { 
    data: allNewsletters = [], 
    isLoading: isLoadingNewsletters, 
    isError: isErrorNewsletters, 
    error: errorNewsletters, 
    refetch: refetchNewsletters 
  } = useQuery<Newsletter[]>({
    queryKey: ['newsletters', 'all', user?.id],
    queryFn: fetchAllNewsletters,
    staleTime: 5 * 60 * 1000,
    gcTime: CACHE_DURATION,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !!user,
  });

  // Filtering and sorting (client-side)
  const filterNewsletters = useCallback((newsletters: Newsletter[], tagIds?: string | string[]) => {
    let filtered = [...newsletters];
    if (tagIds && tagIds.length > 0) {
      const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      filtered = filtered.filter(newsletter => 
        newsletter.tags?.some(tag => tag && tag.id && tagIdsArray.includes(tag.id))
      );
    }
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.is_read && !n.is_archived);
    } else if (filter === 'liked') {
      filtered = filtered.filter(n => n.is_liked && !n.is_archived);
    } else if (filter === 'archived') {
      filtered = filtered.filter(n => n.is_archived);
    } else {
      filtered = filtered.filter(n => !n.is_archived);
    }
    if (sourceId) {
      filtered = filtered.filter(n => n.newsletter_source_id === sourceId);
    }
    // CLIENT-SIDE SORTING based on filter
    if (filter === 'all') {
      filtered.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    } else if (filter === 'liked' || filter === 'archived') {
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else {
      filtered.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    }
    return filtered;
  }, [filter, sourceId]);

  const newsletters = useMemo(() => {
    if (!allNewsletters.length) return [];
    return filterNewsletters(allNewsletters, normalizedTagId);
  }, [allNewsletters, filterNewsletters, normalizedTagId]);

 // Helper: update newsletter count for a source in cache
const updateSourceCountInCache = useCallback((sourceId: string | null, delta: number) => {
  if (!sourceId || !user?.id) return;
  const sourcesKey = ['newsletterSources', 'user', user.id];
  
  queryClient.setQueryData<NewsletterSource[]>(sourcesKey, (currentSources) => {
    if (!currentSources) return [];
    
    return currentSources.map(source => {
      if (source.id === sourceId) {
        return {
          ...source,
          newsletter_count: Math.max(0, (source.newsletter_count || 0) + delta)
        };
      }
      return source;
    });
  });
}, [queryClient, user?.id]);



  // Helper: update newsletter in cache
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<Newsletter>) => {
    const cacheKey = ['newsletters', 'all', user?.id];
    queryClient.setQueryData<Newsletter[]>(cacheKey, (old = []) => {
      if (!old) return [];
      return old.map(item => {
        if (item.id === id) {
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

  const updateUnreadCountInCache = useCallback((delta: number) => {
    if (!user?.id) return;
    const unreadCountKey = ['unreadCount', user.id];
    
    queryClient.setQueryData<number>(unreadCountKey, (currentCount) => {
      const newCount = Math.max(0, (currentCount || 0) + delta);
      console.log(`Updating unread count: ${currentCount} -> ${newCount} (delta: ${delta})`);
      return newCount;
    });
  }, [queryClient, user?.id]);

  // MARK AS READ
  const markAsReadMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; wasUnread?: boolean }>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      await queryClient.cancelQueries({ queryKey: ['unreadCount', user?.id] });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      const newsletter = previousNewsletters?.find(n => n.id === id);
      const wasUnread = newsletter && !newsletter.is_read && !newsletter.is_archived;
      
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_read: true });
        if (wasUnread) {
          updateUnreadCountInCache(-1);
        }
      }
      return { previousNewsletters, wasUnread };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(['newsletters', 'all', user?.id], context.previousNewsletters);
        if (context.wasUnread) {
          updateUnreadCountInCache(1);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // MARK AS UNREAD
  const markAsUnreadMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; wasRead?: boolean }>({
  mutationFn: async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('newsletters')
      .update({ is_read: false })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    return true;
  },
  onMutate: async (id: string) => {
    const cacheKey = ['newsletters', 'all', user?.id];
    await queryClient.cancelQueries({ queryKey: cacheKey });
    await queryClient.cancelQueries({ queryKey: ['unreadCount', user?.id] });
    
    const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
    const newsletter = previousNewsletters?.find(n => n.id === id);
    const wasRead = newsletter && newsletter.is_read && !newsletter.is_archived;
    
    if (previousNewsletters) {
      updateNewsletterInCache(id, { is_read: false });
      if (wasRead) {
        updateUnreadCountInCache(1);
      }
    }
    return { previousNewsletters, wasRead };
  },
  onError: (_err, _id, context) => {
    if (context?.previousNewsletters) {
      queryClient.setQueryData(['newsletters', 'all', user?.id], context.previousNewsletters);
      if (context.wasRead) {
        updateUnreadCountInCache(-1);
      }
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
  },
});

  // BULK MARK AS READ
  const bulkMarkAsReadMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[]; unreadCount?: number }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: true })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      await queryClient.cancelQueries({ queryKey: ['unreadCount', user?.id] });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      let unreadCount = 0;
      
      if (previousNewsletters) {
        ids.forEach(id => {
          const newsletter = previousNewsletters.find(n => n.id === id);
          if (newsletter && !newsletter.is_read && !newsletter.is_archived) {
            unreadCount++;
          }
          updateNewsletterInCache(id, { is_read: true });
        });
        
        if (unreadCount > 0) {
          updateUnreadCountInCache(-unreadCount);
        }
      }
      return { previousNewsletters, unreadCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(['newsletters', 'all', user?.id], context.previousNewsletters);
        if (context.unreadCount && context.unreadCount > 0) {
          updateUnreadCountInCache(context.unreadCount);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // BULK MARK AS UNREAD
  const bulkMarkAsUnreadMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[]; readCount?: number }>({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('User not authenticated');
      if (ids.length === 0) return true;
      const { error } = await supabase
        .from('newsletters')
        .update({ is_read: false })
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      return true;
    },
    onMutate: async (ids: string[]) => {
      const cacheKey = ['newsletters', 'all', user?.id];
      await queryClient.cancelQueries({ queryKey: cacheKey });
      await queryClient.cancelQueries({ queryKey: ['unreadCount', user?.id] });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(cacheKey);
      let readCount = 0;
      
      if (previousNewsletters) {
        ids.forEach(id => {
          const newsletter = previousNewsletters.find(n => n.id === id);
          if (newsletter && newsletter.is_read && !newsletter.is_archived) {
            readCount++;
          }
          updateNewsletterInCache(id, { is_read: false });
        });
        
        if (readCount > 0) {
          updateUnreadCountInCache(readCount);
        }
      }
      return { previousNewsletters, readCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(['newsletters', 'all', user?.id], context.previousNewsletters);
        if (context.readCount && context.readCount > 0) {
          updateUnreadCountInCache(-context.readCount);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // ARCHIVE
  const archiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; sourceId: string | null; now?: string; wasUnread?: boolean }>({
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
      const newsletterToArchive = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToArchive?.newsletter_source_id || null;
      const newsletter = previousNewsletters?.find(n => n.id === id);
      const wasUnread = newsletter && !newsletter.is_read && !newsletter.is_archived;
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_archived: true, updated_at: now });
        if (sourceId) updateSourceCountInCache(sourceId, -1);
        if (wasUnread) updateUnreadCountInCache(-1)
      }
      return { previousNewsletters, sourceId, wasUnread, now };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, 1);
        if (context.wasUnread) updateUnreadCountInCache(1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // UNARCHIVE
  const unarchiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; sourceId: string | null; now?: string }>({
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
      const newsletterToUnarchive = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToUnarchive?.newsletter_source_id || null;
      if (previousNewsletters) {
        updateNewsletterInCache(id, { is_archived: false, updated_at: now });
        if (sourceId) updateSourceCountInCache(sourceId, 1);
      }
      return { previousNewsletters, sourceId, now };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, -1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Bulk archive mutation (with source count update)
  const bulkArchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[]; sourceIdToCount?: Record<string, number> }>({
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
      const sourceIdToCount: Record<string, number> = {};
      if (previousNewsletters) {
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
        });
        ids.forEach(id => updateNewsletterInCache(id, { is_archived: true, updated_at: now }));
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
      return { previousNewsletters, sourceIdToCount, now };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Bulk unarchive mutation (with source count update)
  const bulkUnarchiveMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[]; sourceIdToCount?: Record<string, number> }>({
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
      const sourceIdToCount: Record<string, number> = {};
      if (previousNewsletters) {
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
        });
        ids.forEach(id => updateNewsletterInCache(id, { is_archived: false, updated_at: now }));
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
      return { previousNewsletters, sourceIdToCount, now };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Toggle like status
  const toggleLikeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      
      // Get current newsletter to check current like status
      const { data: currentNewsletter } = await supabase
        .from('newsletters')
        .select('is_liked')
        .eq('id', id)
        .single();
      
      if (!currentNewsletter) throw new Error('Newsletter not found');
      
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_liked: !currentNewsletter.is_liked,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      return true;
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['newsletters', 'all', user?.id] });
      
      // Snapshot the previous value
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(['newsletters', 'all', user?.id]);
      
      // Optimistically update the cache
      if (previousNewsletters) {
        queryClient.setQueryData<Newsletter[]>(['newsletters', 'all', user?.id], (old = []) => {
          if (!old) return [];
          return old.map(item => {
            if (item.id === id) {
              return { 
                ...item, 
                is_liked: !item.is_liked,
                updated_at: new Date().toISOString()
              };
            }
            return item;
          });
        });
      }
      
      return { previousNewsletters };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(['newsletters', 'all', user?.id], context.previousNewsletters);
      }
      console.error('Error toggling like status:', err);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
    },
  });

  // DELETE (permanent delete)
  const deleteNewsletterMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; sourceId: string | null }>({
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
      const newsletterToDelete = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToDelete?.newsletter_source_id || null;
      if (previousNewsletters) {
        queryClient.setQueryData(cacheKey, previousNewsletters.filter(n => n.id !== id));
        if (sourceId) updateSourceCountInCache(sourceId, -1);
      }
      return { previousNewsletters, sourceId };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, 1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // BULK DELETE (permanent delete)
  const bulkDeleteNewslettersMutation = useMutation<boolean, Error, string[], { previousNewsletters?: Newsletter[]; sourceIdToCount?: Record<string, number> }>({
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
      const sourceIdToCount: Record<string, number> = {};
      if (previousNewsletters) {
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
        });
        queryClient.setQueryData(cacheKey, previousNewsletters.filter(n => !ids.includes(n.id)));
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
      return { previousNewsletters, sourceIdToCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        const cacheKey = ['newsletters', 'all', user?.id];
        queryClient.setQueryData(cacheKey, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters', 'all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
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
    toggleLike: toggleLikeMutation.mutateAsync,
    isTogglingLike: toggleLikeMutation.isPending,
    errorTogglingLike: toggleLikeMutation.error,
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
