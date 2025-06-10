import { useCallback, useMemo, useContext, useEffect } from 'react';
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  UseMutateAsyncFunction, 
  QueryObserverResult, 
  RefetchOptions
} from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';

import { Newsletter, NewsletterSource, Tag } from '../types';

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


// Helper type for the previous state in mutations
type PreviousNewslettersState = { previousNewsletters?: Newsletter[] };

interface UseNewslettersReturn {
  // Single newsletter operations
  getNewsletter: (id: string) => Promise<Newsletter | null>;
  
  // Newsletter list and query
  newsletters: Newsletter[];
  isLoadingNewsletters: boolean;
  isErrorNewsletters: boolean;
  errorNewsletters: Error | null;
  refetchNewsletters: (options?: RefetchOptions) => Promise<QueryObserverResult<Newsletter[], Error>>;
  
  // Read status mutations
  markAsRead: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isMarkingAsRead: boolean;
  errorMarkingAsRead: Error | null;
  markAsUnread: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isMarkingAsUnread: boolean;
  errorMarkingAsUnread: Error | null;
  
  // Bulk read status mutations
  bulkMarkAsRead: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkMarkingAsRead: boolean;
  errorBulkMarkingAsRead: Error | null;
  bulkMarkAsUnread: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkMarkingAsUnread: boolean;
  errorBulkMarkingAsUnread: Error | null;
  
  // Like mutations
  toggleLike: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;
  
  // Archive mutations
  archiveNewsletter: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  unarchiveNewsletter: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isArchiving: boolean;
  errorArchiving: Error | null;
  isUnarchiving: boolean;
  errorUnarchiving: Error | null;
  
  // Bulk archive mutations
  bulkArchive: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  bulkUnarchive: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkArchiving: boolean;
  errorBulkArchiving: Error | null;
  isBulkUnarchiving: boolean;
  errorBulkUnarchiving: Error | null;
  
  // Queue mutations
  toggleInQueue: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isTogglingInQueue: boolean;
  errorTogglingInQueue: Error | null;
  
  // Delete mutations
  deleteNewsletter: UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>;
  isDeletingNewsletter: boolean;
  errorDeletingNewsletter: Error | null;
  bulkDeleteNewsletters: UseMutateAsyncFunction<boolean, Error, string[], PreviousNewslettersState>;
  isBulkDeletingNewsletters: boolean;
  errorBulkDeletingNewsletters: Error | null;
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

export const useNewsletters = (tagId?: string, filter: string = 'all', sourceId?: string | null, groupSourceIds?: string[]): UseNewslettersReturn => {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useNewsletters must be used within an AuthProvider');
  }
  const { user, loading: authLoading } = auth;
  const queryClient = useQueryClient();

  // Convert comma-separated tagIds to array if needed
  const normalizedTagId = tagId?.includes(',') ? tagId.split(',').filter(Boolean) : tagId;

  // Cache key includes user ID to properly separate caches between users
  const CACHE_KEY = ['newsletters', 'all', user?.id || 'unauthorized'];

  // Check if we should enable the query
  const isEnabled = !!user?.id && !authLoading;

  // Fetch all newsletters from the database without any sorting (let client handle it)
  const fetchAllNewsletters = useCallback(async (): Promise<Newsletter[]> => {
    if (!user?.id) {
      console.warn('[useNewsletters] No user ID available, skipping newsletter fetch');
      return [];
    }
    
    if (authLoading) {
      console.log('[useNewsletters] Auth is still loading, waiting for user session...');
      return [];
    }

    console.log('[DEBUG] Fetching newsletters for user:', user.id);
    
    try {
      const query = supabase
        .from('newsletters')
        .select(`
          *,
          newsletter_source:newsletter_sources(*),
          newsletter_tags (
            tag:tags (id, name, color)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('[DEBUG] Supabase query:', {
        table: 'newsletters',
        select: '*',
        eq: { user_id: user.id },
        order: { created_at: 'desc' }
      });

      const { data, error, status, statusText } = await query;
      
      console.log('[DEBUG] Supabase response:', {
        status,
        statusText,
        error,
        dataCount: data?.length || 0,
        firstItem: data?.[0] || null
      });

      if (error) {
        console.error('[ERROR] Supabase query error:', error);
        throw error;
      }

      if (!data) {
        console.warn('[WARN] No data returned from Supabase');
        return [];
      }

      console.log(`[DEBUG] Retrieved ${data.length} newsletters`);
      
      // Process the data
      const processedData = data as Newsletter[];
      
      // Fetch all sources in one query and attach them
      const sourceIds = Array.from(new Set(processedData
        .map((n: Newsletter) => n.newsletter_source_id)
        .filter(Boolean) as string[]
      ));
      
      let sourcesMap: Record<string, any> = {};
      
      if (sourceIds.length > 0) {
        console.log('[DEBUG] Fetching sources for newsletters:', sourceIds);
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('newsletter_sources')
          .select('*')
          .in('id', sourceIds);
          
        console.log('[DEBUG] Sources response:', { 
          sourcesCount: sourcesData?.length,
          error: sourcesError 
        });
        
        if (sourcesError) {
          console.error('[ERROR] Error fetching sources:', sourcesError);
          throw sourcesError;
        }
        
        if (sourcesData) {
          sourcesMap = Object.fromEntries(sourcesData.map((s: any) => [s.id, s]));
        }
      }
      
      // Attach the source object to each newsletter
      const newslettersWithSources = processedData.map((n: Newsletter) => {
        const source = n.newsletter_source_id ? sourcesMap[n.newsletter_source_id] || null : null;
        console.log(`[DEBUG] Processing newsletter ${n.id} with source:`, 
          { 
            hasSource: !!source,
            sourceId: n.newsletter_source_id,
            sourceData: source 
          }
        );
        
        return {
          ...n,
          source: source,
          newsletter_source: source // Keep both for backward compatibility
        };
      });
      
      const transformed = transformNewsletterData(newslettersWithSources);
      console.log('[DEBUG] Transformed newsletters:', transformed);
      
      return transformed;
    } catch (error) {
      console.error('[ERROR] Error in fetchAllNewsletters:', error);
      throw error;
    }
  }, [user]);

  // Main query - SINGLE CACHE KEY
  const { 
    data: allNewsletters = [], 
    isLoading: isLoadingNewsletters, 
    isError: isErrorNewsletters, 
    error: errorNewsletters, 
    refetch: refetchNewsletters 
  } = useQuery<Newsletter[]>({
    queryKey: CACHE_KEY,
    queryFn: fetchAllNewsletters,
    staleTime: 5 * 60 * 1000,
    gcTime: CACHE_DURATION,
    refetchOnWindowFocus: true, // Refresh data when window regains focus
    refetchOnMount: true, // Ensure fresh data on mount
    refetchOnReconnect: true, // Refresh on reconnect
    enabled: isEnabled, // Only enable the query if we have a user ID and auth is not loading
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retrying
  });

  // Log authentication state changes
  useEffect(() => {
    console.log('[useNewsletters] Auth state changed:', { 
      hasUser: !!user, 
      userId: user?.id,
      authLoading,
      isEnabled
    });
    
    if (user?.id) {
      console.log('[useNewsletters] User authenticated, query enabled:', isEnabled);
    } else if (!authLoading) {
      console.log('[useNewsletters] No authenticated user and auth loading complete');
    }
  }, [user?.id, authLoading, isEnabled, user]);

  // Invalidate and refetch when user changes
  useEffect(() => {
    console.log('[DEBUG] Auth state changed:', { 
      hasUser: !!user,
      userId: user?.id,
      isAuthenticated: !!user?.id
    });
    
    if (user?.id) {
      console.log('[DEBUG] User authenticated, invalidating newsletter cache');
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } else {
      console.log('[DEBUG] No user authenticated, clearing newsletter cache');
      queryClient.setQueryData(CACHE_KEY, []);
    }
  }, [user?.id, queryClient]);

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
    if (filter === 'liked' || filter === 'archived') {
      // Sort by updated_at descending for liked/archived
      filtered.sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      });
    } else {
      // Sort by received_at descending for all others
      filtered.sort((a, b) => {
        const aTime = a.received_at ? new Date(a.received_at).getTime() : 0;
        const bTime = b.received_at ? new Date(b.received_at).getTime() : 0;
        return bTime - aTime;
      });
    }
    
    return filtered;
  }, [filter, sourceId]);

  const newsletters = useMemo(() => {
    if (!allNewsletters.length) return [];
    let filtered = filterNewsletters(allNewsletters, normalizedTagId);
    
    // Filter by group sources if provided
    if (groupSourceIds && groupSourceIds.length > 0) {
      filtered = filtered.filter(newsletter => 
        newsletter.newsletter_source_id && groupSourceIds.includes(newsletter.newsletter_source_id)
      );
    }
    
    return filtered;
  }, [allNewsletters, filterNewsletters, normalizedTagId, groupSourceIds]);

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

  // Helper: update newsletter in cache - CONSISTENT CACHE KEY
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<Newsletter>) => {
    queryClient.setQueryData<Newsletter[]>(CACHE_KEY, (old = []) => {
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
  }, [queryClient]);

  const updateUnreadCountInCache = useCallback((delta: number) => {
    if (!user?.id) return;
    const unreadCountKey = ['unreadCount', user.id];
    
    queryClient.setQueryData<number>(unreadCountKey, (currentCount) => {
      const newCount = Math.max(0, (currentCount || 0) + delta);
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
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
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.wasUnread) {
          updateUnreadCountInCache(1);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
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
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.wasRead) {
          updateUnreadCountInCache(-1);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
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
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.unreadCount && context.unreadCount > 0) {
          updateUnreadCountInCache(context.unreadCount);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
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
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.readCount && context.readCount > 0) {
          updateUnreadCountInCache(-context.readCount);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
    },
  });

  // ARCHIVE
  const archiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; sourceId: string | null; wasUnread?: boolean }>({
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const newsletterToArchive = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToArchive?.newsletter_source_id || null;
      const wasUnread = newsletterToArchive && !newsletterToArchive.is_read && !newsletterToArchive.is_archived;
      
      if (previousNewsletters) {
        const now = new Date().toISOString();
        updateNewsletterInCache(id, { is_archived: true, updated_at: now });
        if (sourceId) updateSourceCountInCache(sourceId, -1);
        if (wasUnread) updateUnreadCountInCache(-1);
      }
      return { previousNewsletters, sourceId, wasUnread };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, 1);
        if (context.wasUnread) updateUnreadCountInCache(1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['unreadCount', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // UNARCHIVE
  const unarchiveMutation = useMutation<boolean, Error, string, { previousNewsletters?: Newsletter[]; sourceId: string | null }>({
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const newsletterToUnarchive = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToUnarchive?.newsletter_source_id || null;
      
      if (previousNewsletters) {
        const now = new Date().toISOString();
        updateNewsletterInCache(id, { is_archived: false, updated_at: now });
        if (sourceId) updateSourceCountInCache(sourceId, 1);
      }
      return { previousNewsletters, sourceId };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, -1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Bulk archive mutation
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const sourceIdToCount: Record<string, number> = {};
      
      if (previousNewsletters) {
        const now = new Date().toISOString();
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
          updateNewsletterInCache(id, { is_archived: true, updated_at: now });
        });
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
      return { previousNewsletters, sourceIdToCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Bulk unarchive mutation
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const sourceIdToCount: Record<string, number> = {};
      
      if (previousNewsletters) {
        const now = new Date().toISOString();
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
          updateNewsletterInCache(id, { is_archived: false, updated_at: now });
        });
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
      return { previousNewsletters, sourceIdToCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Toggle like status
  const toggleLikeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      
      if (previousNewsletters) {
        const now = new Date().toISOString();
        updateNewsletterInCache(id, { 
          is_liked: !previousNewsletters.find(n => n.id === id)?.is_liked,
          updated_at: now
        });
      }
      
      return { previousNewsletters };
    },
    onError: (err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const newsletterToDelete = previousNewsletters?.find(n => n.id === id);
      const sourceId = newsletterToDelete?.newsletter_source_id || null;
      
      if (previousNewsletters) {
        queryClient.setQueryData<Newsletter[]>(CACHE_KEY, (old = []) => {
          return old.filter(n => n.id !== id);
        });
        
        if (sourceId) updateSourceCountInCache(sourceId, -1);
      }
      return { previousNewsletters, sourceId };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNewsletters) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        if (context.sourceId) updateSourceCountInCache(context.sourceId, 1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
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
      await queryClient.cancelQueries({ queryKey: CACHE_KEY });
      
      const previousNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
      const sourceIdToCount: Record<string, number> = {};
      
      if (previousNewsletters) {
        ids.forEach(id => {
          const n = previousNewsletters.find(nl => nl.id === id);
          if (n && n.newsletter_source_id) {
            sourceIdToCount[n.newsletter_source_id] = (sourceIdToCount[n.newsletter_source_id] || 0) + 1;
          }
        });
        
        queryClient.setQueryData<Newsletter[]>(CACHE_KEY, (old = []) => {
          return old.filter(n => !ids.includes(n.id));
        });
        
        Object.entries(sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, -count));
      }
      return { previousNewsletters, sourceIdToCount };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousNewsletters && context.sourceIdToCount) {
        queryClient.setQueryData(CACHE_KEY, context.previousNewsletters);
        Object.entries(context.sourceIdToCount).forEach(([sid, count]) => updateSourceCountInCache(sid, count));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
      queryClient.invalidateQueries({ queryKey: ['newsletterSources', 'user', user?.id] });
    },
  });

  // Function to get a single newsletter
  const getNewsletter = useCallback(async (id: string): Promise<Newsletter | null> => {
    const cachedNewsletters = queryClient.getQueryData<Newsletter[]>(CACHE_KEY);
    const found = cachedNewsletters?.find(n => n.id === id);
    if (found) return found;

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
        
        queryClient.setQueryData<Newsletter[]>(CACHE_KEY, (old = []) => {
          const exists = old.some(n => n.id === id);
          return exists 
            ? old.map(n => n.id === id ? newsletter : n)
            : [...old, newsletter];
        });
        
        return newsletter;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [user, queryClient]);

  // Toggle in queue mutation
  const toggleInQueueMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (newsletterId) => {
      const { data, error } = await supabase.rpc('toggle_newsletter_in_queue', {
        p_newsletter_id: newsletterId
      });
      
      if (error) throw error;
      return !!data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingQueue'] });
      queryClient.invalidateQueries({ queryKey: CACHE_KEY });
    },
  });

  return {
    // Single newsletter operations
    getNewsletter,
    
    // Newsletter list and query
    newsletters,
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    refetchNewsletters,
    
    // Read status mutations
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    errorMarkingAsRead: markAsReadMutation.error,
    markAsUnread: markAsUnreadMutation.mutateAsync,
    isMarkingAsUnread: markAsUnreadMutation.isPending,
    errorMarkingAsUnread: markAsUnreadMutation.error,
    
    // Bulk read status mutations
    bulkMarkAsRead: bulkMarkAsReadMutation.mutateAsync,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,
    bulkMarkAsUnread: bulkMarkAsUnreadMutation.mutateAsync,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending,
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,
    
    // Like mutations
    toggleLike: toggleLikeMutation.mutateAsync,
    isTogglingLike: toggleLikeMutation.isPending,
    errorTogglingLike: toggleLikeMutation.error,
    
    // Archive mutations
    archiveNewsletter: archiveMutation.mutateAsync,
    unarchiveNewsletter: unarchiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
    errorArchiving: archiveMutation.error,
    isUnarchiving: unarchiveMutation.isPending,
    errorUnarchiving: unarchiveMutation.error,
    
    // Bulk archive mutations
    bulkArchive: bulkArchiveMutation.mutateAsync,
    bulkUnarchive: bulkUnarchiveMutation.mutateAsync,
    isBulkArchiving: bulkArchiveMutation.isPending,
    errorBulkArchiving: bulkArchiveMutation.error,
    isBulkUnarchiving: bulkUnarchiveMutation.isPending,
    errorBulkUnarchiving: bulkUnarchiveMutation.error,
    
    // Queue mutations
    toggleInQueue: toggleInQueueMutation.mutateAsync,
    isTogglingInQueue: toggleInQueueMutation.isPending,
    errorTogglingInQueue: toggleInQueueMutation.error,
    
    // Delete mutations
    deleteNewsletter: deleteNewsletterMutation.mutateAsync,
    isDeletingNewsletter: deleteNewsletterMutation.isPending,
    errorDeletingNewsletter: deleteNewsletterMutation.error,
    bulkDeleteNewsletters: bulkDeleteNewslettersMutation.mutateAsync,
    isBulkDeletingNewsletters: bulkDeleteNewslettersMutation.isPending,
    errorBulkDeletingNewsletters: bulkDeleteNewslettersMutation.error,
  };
};
