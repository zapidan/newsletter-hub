import { useCallback, useMemo, useRef } from 'react';
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  QueryObserverResult, 
  RefetchOptions,
  UseMutateAsyncFunction,
  QueryKey
} from '@tanstack/react-query';

type NewsletterFilter = 'all' | 'unread' | 'liked' | 'archived';

const buildQueryKey = (params: {
  scope: 'list' | 'detail' | 'tags';
  userId?: string;
  id?: string;
  filter?: NewsletterFilter;
  tagId?: string;
  sourceId?: string | null;
  groupSourceIds?: string[];
  timeRange?: string;
}): QueryKey => {
  const { scope, userId, id, filter, tagId, sourceId, groupSourceIds, timeRange } = params;
  
  const queryKey: unknown[] = ['newsletters', scope];
  
  // Add filter parameters
  const filters: Record<string, unknown> = {};
  if (userId) filters.userId = userId;
  if (id) filters.id = id;
  if (filter) filters.filter = filter;
  if (tagId) filters.tagId = tagId;
  if (sourceId !== undefined) filters.sourceId = sourceId;
  if (groupSourceIds?.length) filters.groupSourceIds = groupSourceIds;
  if (timeRange) filters.timeRange = timeRange;
  
  if (Object.keys(filters).length > 0) {
    queryKey.push(filters);
  }
  
  return queryKey;
};
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { NewsletterWithRelations, Tag } from '../types';

type PreviousNewslettersState = { 
  previousNewsletters?: NewsletterWithRelations[] 
};

// Query keys and constants defined at module level to prevent recreation
const queryKeys = {
  all: ['newsletters'],
  lists: () => [...queryKeys.all, 'list'],
  list: (filters: Record<string, unknown> = {}) => [...queryKeys.lists(), filters],
  detail: (id: string) => [...queryKeys.all, 'detail', id],
  tags: (tagId?: string) => tagId ? [...queryKeys.all, 'tags', tagId] : [...queryKeys.all, 'tags'],
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to update newsletter in cache
// Removed unused updateNewsletterInCache function

interface UseNewslettersReturn {
  // Single newsletter operations
  getNewsletter: (id: string) => Promise<NewsletterWithRelations | null>;
  
  // Newsletter list and query
  newsletters: NewsletterWithRelations[];
  isLoadingNewsletters: boolean;
  isErrorNewsletters: boolean;
  errorNewsletters: Error | null;
  refetchNewsletters: (options?: RefetchOptions) => Promise<QueryObserverResult<NewsletterWithRelations[], Error>>;
  
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
  toggleLike: (id: string, isLikedParam?: boolean, options?: any) => Promise<boolean>;
  isTogglingLike: boolean;
  errorTogglingLike: Error | null;
  
  // Archive mutations
  toggleArchive: (id: string, isArchived: boolean, options?: any) => Promise<boolean>;
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
const transformNewsletterData = (data: any[] | null): NewsletterWithRelations[] => {
  if (!data) return [];
  
  return data.map((item) => {
    const tags = (item.newsletter_tags || []).map((nt: { tag: Tag }) => 
      nt.tag ? {
        id: nt.tag.id,
        name: nt.tag.name,
        color: nt.tag.color,
        user_id: nt.tag.user_id,
        created_at: nt.tag.created_at || new Date().toISOString(),
      } : null
    ).filter(Boolean) as Tag[];

    const source = item.source || item.newsletter_source || null;

    // Explicitly check if is_archived exists on the item before setting a default
    const isArchived = 'is_archived' in item ? item.is_archived : false;
    
    return {
      ...item,
      newsletter_source_id: item.newsletter_source_id || null,
      source,
      tags,
      is_archived: isArchived,
      is_read: item.is_read || false,
      is_liked: item.is_liked || false,
    } as NewsletterWithRelations;
  });
};



export const useNewsletters = (
  tagId?: string, 
  filter: NewsletterFilter = 'all', 
  sourceId?: string | null, 
  groupSourceIds: string[] = [],
  timeRange?: string
): UseNewslettersReturn => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  if (!user?.id) {
    throw new Error('useNewsletters must be used within an AuthProvider with a logged-in user');
  }

  // Build query key with all filter parameters
  const queryKey = useMemo(
    () => buildQueryKey({
      scope: 'list',
      userId: user.id,
      tagId,
      filter,
      sourceId,
      groupSourceIds: groupSourceIds.length ? groupSourceIds : undefined,
      timeRange
    }),
    [user.id, tagId, filter, sourceId, groupSourceIds, timeRange]
  );

  // Helper function to fetch all newsletters with proper typing
  const fetchAllNewsletters = useCallback(async (): Promise<NewsletterWithRelations[]> => {
    if (!user?.id) {
      console.warn('[useNewsletters] No user ID available, skipping newsletter fetch');
      return [];
    }
    
    try {
      // First, ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No active session found or session error:', sessionError);
        // Attempt to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshedSession) {
          console.error('Failed to refresh session:', refreshError);
          throw new Error('Session expired. Please sign in again.');
        }
      }
      
      console.log('Fetching newsletters with user ID:', user.id);
      
      // Add a timeout to the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await supabase
          .from('newsletters')
          .select(`
            *,
            source:newsletter_sources(*),
            newsletter_tags!left(
              tag:tags(*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal);
          
        clearTimeout(timeoutId);
        
        // Check if we got a response with an error
        if (response.error) {
          console.error('Supabase error fetching newsletters:', {
            message: response.error.message,
            details: response.error.details,
            hint: response.error.hint,
            code: response.error.code
          });
          
          // If we get an auth error, try to refresh the session and retry once
          if (response.error.code === 'PGRST301' || response.error.message.includes('JWT')) {
            console.log('Auth error detected, attempting to refresh session...');
            const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !newSession) {
              console.error('Failed to refresh session:', refreshError);
              throw new Error('Session expired. Please sign in again.');
            }
            
            // Retry the request with the new session
            console.log('Session refreshed, retrying request...');
            const retryResponse = await supabase
              .from('newsletters')
              .select(`
                *,
                source:newsletter_sources(*),
                newsletter_tags!left(
                  tag:tags(*)
                )
              `)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
              
            if (retryResponse.error) {
              console.error('Error on retry after session refresh:', retryResponse.error);
              throw retryResponse.error;
            }
            
            return transformNewsletterData(retryResponse.data || []);
          }
          
          throw response.error;
        }

        return transformNewsletterData(response.data || []);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        // Check for network errors
        if (error.name === 'AbortError') {
          console.error('Request timed out');
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        
        // Check for HTML response errors
        if (error.message.includes('Unexpected token') && error.message.includes('<!doctype')) {
          console.error('Received HTML response instead of JSON. This usually indicates an authentication or server error.');
          throw new Error('Server error: Received invalid response. The server might be experiencing issues.');
        }
        
        // Check for network connectivity issues
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.error('Network error:', error);
          throw new Error('Network error: Unable to connect to the server. Please check your internet connection.');
        }
      }
      
      // Log the full error for debugging
      console.error('Error in fetchAllNewsletters:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw with a user-friendly message
      throw new Error('Failed to load newsletters. Please try again later.');
    }
  }, [user?.id]);
  
  // Main query for newsletters
  const { 
    data: allNewsletters = [], 
    isLoading, 
    isError, 
    error: errorNewsletters, 
    refetch: refetchNewsletters 
  } = useQuery<NewsletterWithRelations[], Error>({
    queryKey,
    queryFn: fetchAllNewsletters,
    staleTime: CACHE_DURATION,
    gcTime: CACHE_DURATION,
    enabled: !!user?.id,
  });

  // Convert comma-separated tagIds to array if needed
  const normalizedTagId = tagId?.includes(',') ? tagId.split(',').filter(Boolean) : tagId;

  // Filtering and sorting (client-side)
  const filterNewsletters = useCallback((newsletters: NewsletterWithRelations[], tagIds?: string | string[]) => {
    let filtered = [...newsletters];
    
    if (tagIds && tagIds.length > 0) {
      const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      filtered = filtered.filter(newsletter => 
        newsletter.tags?.some(tag => tag.id && tagIdsArray.includes(tag.id))
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

  // Helper function to update newsletter in cache (exported for potential future use)
  const updateNewsletterInCache = useCallback((id: string, updates: Partial<NewsletterWithRelations>) => {
    const listKey = buildQueryKey({ scope: 'list' });
    queryClient.setQueryData<NewsletterWithRelations[]>(listKey, (old = []) => {
      return old.map(item => {
        if (item.id === id) {
          const now = new Date().toISOString();
          return { 
            ...item, 
            ...updates,
            newsletter_source_id: updates.newsletter_source_id ?? item.newsletter_source_id,
            source: updates.source ?? item.source,
            tags: updates.tags ?? item.tags ?? [],
            is_archived: updates.is_archived ?? item.is_archived ?? false,
            is_read: updates.is_read ?? item.is_read ?? false,
            is_liked: updates.is_liked ?? item.is_liked ?? false,
            updated_at: updates.updated_at || now 
          } as NewsletterWithRelations;
        }
        return item;
      });
    });
    
    // Also update the detail cache if it exists
    const detailKey = buildQueryKey({ scope: 'detail', id });
    const currentDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
    if (currentDetail) {
      queryClient.setQueryData(detailKey, {
        ...currentDetail,
        ...updates,
        updated_at: updates.updated_at || new Date().toISOString()
      });
    }
  }, [queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (newsletterId) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', newsletterId);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (newsletterId) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id: newsletterId });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listKey) || [];
      const previousDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
      
      // Find the newsletter to check if it's archived
      const newsletter = previousNewsletters.find(n => n.id === newsletterId);
      
      // Don't update read status for archived newsletters
      if (newsletter?.is_archived) {
        return { previousNewsletters };
      }
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.map(n => n.id === newsletterId ? { ...n, is_read: true } : n)
      );
      
      // Also update the individual newsletter cache
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { ...previousDetail, is_read: true });
      }
      
      return { previousNewsletters };
    },
    onError: (err, newsletterId, context) => {
      console.error('Error marking as read:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(buildQueryKey({ scope: 'list' }), context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, newsletterId) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: buildQueryKey({ scope: 'list' }) });
      queryClient.invalidateQueries({ queryKey: buildQueryKey({ scope: 'detail', id: newsletterId }) });
    },
  });

  // Mark as unread mutation
  const markAsUnreadMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_read: false
        })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (id: string) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listKey) || [];
      const previousDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
      
      // Find the newsletter to check if it's archived
      const newsletter = previousNewsletters.find(n => n.id === id);
      
      // Don't update read status for archived newsletters
      if (newsletter?.is_archived) {
        return { previousNewsletters };
      }
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.map(n => n.id === id ? { ...n, is_read: false } : n)
      );
      
      // Also update the individual newsletter cache
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { ...previousDetail, is_read: false });
      }
      
      return { previousNewsletters };
    },
    onError: (err, id, context) => {
      console.error('Error marking as unread:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(buildQueryKey({ scope: 'list' }), context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, id) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: buildQueryKey({ scope: 'list' }) });
      queryClient.invalidateQueries({ queryKey: buildQueryKey({ scope: 'detail', id }) });
    },
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (newsletterId: string) => {
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', newsletterId);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (newsletterId) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id: newsletterId });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listKey) || [];
      
      // Optimistically update the list cache by removing the deleted newsletter
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.filter(n => n.id !== newsletterId)
      );
      
      // Remove the individual newsletter cache
      queryClient.removeQueries({ queryKey: detailKey, exact: true });
      
      return { previousNewsletters };
    },
    onError: (err, newsletterId, context) => {
      console.error('Error deleting newsletter:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        const listKey = buildQueryKey({ scope: 'list' });
        queryClient.setQueryData(listKey, context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, newsletterId) => {
      // Invalidate both list and detail queries
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id: newsletterId });
      
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ 
        queryKey: detailKey,
        refetchType: 'none' // Don't refetch if the item was deleted
      });
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation<boolean, Error, { id: string; isLiked: boolean }, PreviousNewslettersState>({
    mutationFn: async ({ id, isLiked }) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_liked: isLiked
        })
        .eq('id', id);
      
      if (error) throw error;
      return isLiked;
    },
    onMutate: async ({ id, isLiked }) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listKey) || [];
      const previousDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.map(n => n.id === id ? { ...n, is_liked: isLiked } : n)
      );
      
      // Also update the individual newsletter cache
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { ...previousDetail, is_liked: isLiked });
      }
      
      return { previousNewsletters };
    },
    onError: (err, { id }, context) => {
      console.error('Error toggling like:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        const listKey = buildQueryKey({ scope: 'list' });
        queryClient.setQueryData(listKey, context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate both list and detail queries
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id });
      
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });

  // Archive mutation
  const toggleArchiveMutation = useMutation<NewsletterWithRelations, Error, { id: string; isArchived: boolean }, PreviousNewslettersState>({
    mutationFn: async ({ id, isArchived }) => {
      const { data, error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: isArchived
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return transformNewsletterData([data])[0];
    },
    onMutate: async ({ id, isArchived }) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(
        listKey
      ) || [];
      const previousDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.map(n => n.id === id ? { ...n, is_archived: isArchived } : n)
      );

      // Also update the individual newsletter cache
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { 
          ...previousDetail, 
          is_archived: isArchived,
          updated_at: new Date().toISOString()
        });
      }

      return { previousNewsletters };
    },
    onError: (err, { id }, context) => {
      console.error('Error toggling archive status:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(buildQueryKey({ scope: 'list' }), context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ 
        queryKey: buildQueryKey({ scope: 'list' }),
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: buildQueryKey({ scope: 'detail', id }),
        refetchType: 'active'
      });
    },
  });

  // Unarchive mutation (now handled by toggleArchive with isArchived: false)
  const unarchiveMutation = useMutation<boolean, Error, string, PreviousNewslettersState>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false  
        })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (id) => {
      const listKey = buildQueryKey({ scope: 'list' });
      const detailKey = buildQueryKey({ scope: 'detail', id });
      
      // Cancel any outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey })
      ]);
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listKey) || [];
      const previousDetail = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listKey,
        (old = []) => old.map(n => n.id === id ? { ...n, is_archived: false } : n)
      );
      
      // Also update the individual newsletter cache
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { 
          ...previousDetail, 
          is_archived: false,
          updated_at: new Date().toISOString()
        });
      }
      
      return { previousNewsletters };
    },
    onError: (err, id, context) => {
      console.error('Error unarchiving newsletter:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        queryClient.setQueryData(buildQueryKey({ scope: 'list' }), context.previousNewsletters);
      }
    },
    onSettled: (_data, _error, id) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ 
        queryKey: buildQueryKey({ scope: 'list' }),
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: buildQueryKey({ scope: 'detail', id }),
        refetchType: 'active'
      });
    },
  });

  // Bulk archive and unarchive mutations are defined at the end of the file

  // Cache to store newsletter data by ID and track in-flight requests
  const newsletterCache = useRef<{
    data: Map<string, NewsletterWithRelations | null>;
    inFlight: Map<string, Promise<NewsletterWithRelations | null>>;
  }>({ 
    data: new Map(),
    inFlight: new Map()
  });
  
  // Memoize the getNewsletter function with stable reference
  const getNewsletter = useCallback(async (id: string): Promise<NewsletterWithRelations | null> => {
    if (!user?.id) {
      console.log('No user ID, skipping fetch');
      return null;
    }
    
    // Return from cache if available
    if (newsletterCache.current.data.has(id)) {
      console.log('Returning newsletter from cache:', id);
      return newsletterCache.current.data.get(id) || null;
    }
    
    // Return existing promise if there's already a request in flight
    if (newsletterCache.current.inFlight.has(id)) {
      console.log('Returning existing in-flight request for:', id);
      return newsletterCache.current.inFlight.get(id) || null;
    }
    
    console.log('Creating new fetch for newsletter:', id, 'for user:', user.id);
    
    // Create a new promise for this request
    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('newsletters')
          .select(`
            *,
            source:newsletter_sources(*),
            newsletter_tags!left(
              tag:tags(*)
            )
          `)
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        if (!data) {
          console.log('No newsletter found for ID:', id);
          newsletterCache.current.data.set(id, null);
          return null;
        }

        // Transform the data only if we have it
        const result = transformNewsletterData([data])[0];
        console.log('Successfully fetched newsletter:', result?.id);
        
        // Cache the result
        if (result) {
          newsletterCache.current.data.set(id, result);
        }
        
        return result;
      } catch (error) {
        console.error('Error in getNewsletter:', error);
        throw error;
      } finally {
        // Remove from in-flight cache when done
        newsletterCache.current.inFlight.delete(id);
      }
    })();
    
    // Store the promise in the in-flight cache
    newsletterCache.current.inFlight.set(id, fetchPromise);
    
    // Return the promise
    return fetchPromise;
  }, [user?.id]); // Only depends on user.id

  // Filter newsletters based on current filters
  const filteredNewsletters: NewsletterWithRelations[] = useMemo(() => {
    if (!allNewsletters) return [];
    let filtered = [...allNewsletters];
    
    // Apply tag filter if provided
    if (tagId) {
      filtered = filtered.filter(newsletter => 
        newsletter.tags?.some((tag: Tag) => tag && tag.id === tagId)
      );
    }
    
    // Apply source filter if provided
    if (sourceId) {
      filtered = filtered.filter(newsletter => 
        newsletter.newsletter_source_id === sourceId
      );
    }
    
    // Apply group source filter if provided
    if (groupSourceIds && groupSourceIds.length > 0) {
      filtered = filtered.filter(newsletter => 
        newsletter.newsletter_source_id && groupSourceIds.includes(newsletter.newsletter_source_id)
      );
    }
    
    // Apply status filter
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(n => !n.is_read && !n.is_archived);
        break;
      case 'liked':
        filtered = filtered.filter(n => n.is_liked && !n.is_archived);
        break;
      case 'archived':
        filtered = filtered.filter(n => n.is_archived);
        break;
      default:
        filtered = filtered.filter(n => !n.is_archived);
    }
    
    // Sort by received_at descending
    return filtered.sort((a, b) => 
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
  }, [allNewsletters, filter, tagId, sourceId, groupSourceIds]);

  // Define missing mutation callbacks
  const deleteNewsletter = useCallback(async (id: string, options?: any) => {
    return deleteNewsletterMutation.mutateAsync(id, options);
  }, [deleteNewsletterMutation]);

  const markAsRead = useCallback(async (id: string, options?: any) => {
    return markAsReadMutation.mutateAsync(id, options);
  }, [markAsReadMutation]);

  const markAsUnread = useCallback(async (id: string, options?: Parameters<typeof markAsUnreadMutation.mutateAsync>[1]) => {
    return markAsUnreadMutation.mutateAsync(id, options);
  }, [markAsUnreadMutation]);

  const toggleLike: (id: string, isLikedParam?: boolean, options?: any) => Promise<boolean> = useCallback(async (id: string, isLikedParam?: boolean, options?: any) => {
    // If isLiked is not provided, we'll toggle the current state
    let isLiked = isLikedParam;
    if (isLiked === undefined) {
      const newsletter = allNewsletters?.find(n => n.id === id);
      isLiked = !newsletter?.is_liked;
    }
    return toggleLikeMutation.mutateAsync({ id, isLiked: isLiked ?? false }, options);
  }, [toggleLikeMutation, allNewsletters]);

  const toggleArchive = useCallback(async (newsletterId: string, isArchived: boolean, options?: any): Promise<boolean> => {
    if (isArchived) {
      return unarchiveMutation.mutateAsync(newsletterId, options);
    } else {
      const result = await toggleArchiveMutation.mutateAsync({ id: newsletterId, isArchived: false }, options);
      return !!result; // Ensure we return a boolean
    }
  }, [unarchiveMutation, toggleArchiveMutation]);

  const bulkMarkAsReadMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString() 
        })
        .in('id', ids);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (ids) => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listQueryKey) || [];
      const updatedAt = new Date().toISOString();
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listQueryKey,
        (old = []) => old.map(n => 
          ids.includes(n.id) && !n.is_archived
            ? { ...n, is_read: true, updated_at: updatedAt }
            : n
        )
      );
      
      // Also update individual newsletter caches
      ids.forEach(id => {
        const detailKey = buildQueryKey({ scope: 'detail', id });
        const previous = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
        if (previous && !previous.is_archived) {
          queryClient.setQueryData(detailKey, { 
            ...previous, 
            is_read: true,
            updated_at: updatedAt
          });
        }
      });
      
      return { previousNewsletters };
    },
    onError: (err, _ids, context) => {
      console.error('Error bulk marking as read:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        const listQueryKey = buildQueryKey({
          scope: 'list',
          userId: user?.id,
          filter,
          tagId,
          sourceId,
          groupSourceIds,
          timeRange
        });
        queryClient.setQueryData(listQueryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      // Force a refetch to ensure cache is in sync
      queryClient.invalidateQueries({ 
        queryKey: listQueryKey,
        refetchType: 'active'
      });
    },
  });

  // Bulk mark as unread mutation
  const bulkMarkAsUnreadMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_read: false,
          updated_at: new Date().toISOString() 
        })
        .in('id', ids);
      
      if (error) throw error;
      return true;
    },
    onMutate: async (ids) => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      
      // Snapshot the previous values
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listQueryKey) || [];
      const updatedAt = new Date().toISOString();
      
      // Optimistically update the list cache
      queryClient.setQueryData<NewsletterWithRelations[]>(
        listQueryKey,
        (old = []) => old.map(n => 
          ids.includes(n.id) && !n.is_archived
            ? { ...n, is_read: false, updated_at: updatedAt }
            : n
        )
      );
      
      // Also update individual newsletter caches
      ids.forEach(id => {
        const detailKey = buildQueryKey({ scope: 'detail', id });
        const previous = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
        if (previous && !previous.is_archived) {
          queryClient.setQueryData(detailKey, { 
            ...previous, 
            is_read: false,
            updated_at: updatedAt
          });
        }
      });
      
      return { previousNewsletters };
    },
    onError: (err, _ids, context) => {
      console.error('Error bulk marking as unread:', err);
      // Revert on error
      if (context?.previousNewsletters) {
        const listQueryKey = buildQueryKey({
          scope: 'list',
          userId: user?.id,
          filter,
          tagId,
          sourceId,
          groupSourceIds,
          timeRange
        });
        queryClient.setQueryData(listQueryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      // Force a refetch to ensure cache is in sync
      queryClient.invalidateQueries({ 
        queryKey: listQueryKey,
        refetchType: 'active'
      });
    },
  });

  const bulkArchiveMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: true      
        })
        .in('id', ids);
      
      if (error) {
        console.error('Error archiving newsletters:', error);
        throw error;
      }
      return true;
    },
    onMutate: async (ids) => {
      // Build the query key for the current list view
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listQueryKey);
      
      if (previousNewsletters) {
        // Update the list view
        // Update the list view cache
        queryClient.setQueryData(
          listQueryKey,
          previousNewsletters.map(n => 
            ids.includes(n.id) 
              ? { ...n, is_archived: true }
              : n
          )
        );
        
        // Update individual newsletter caches
        ids.forEach(id => {
          const detailKey = buildQueryKey({ scope: 'detail', id, userId: user?.id });
          const previous = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
          if (previous) {
            queryClient.setQueryData(detailKey, { ...previous, is_archived: true });
          }
        });
      }
      
      return { previousNewsletters };
    },
    onError: (err, _ids, context) => {
      console.error('Error bulk archiving newsletters:', err);
      if (context?.previousNewsletters) {
        const listQueryKey = buildQueryKey({
          scope: 'list',
          userId: user?.id,
          filter,
          tagId,
          sourceId,
          groupSourceIds,
          timeRange
        });
        queryClient.setQueryData(listQueryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      // Force a refetch to ensure cache is in sync
      queryClient.invalidateQueries({ 
        queryKey: listQueryKey,
        refetchType: 'active' 
      });
    },
  });

  const bulkUnarchiveMutation = useMutation<boolean, Error, string[], PreviousNewslettersState>({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ 
          is_archived: false       
        })
        .in('id', ids);
      
      if (error) {
        console.error('Error unarchiving newsletters:', error);
        throw error;
      }
      return true;
    },
    onMutate: async (ids) => {
      // Build the query key for the current list view
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previousNewsletters = queryClient.getQueryData<NewsletterWithRelations[]>(listQueryKey);
      
      if (previousNewsletters) {
        // Update the list view cache
        queryClient.setQueryData(
          listQueryKey,
          previousNewsletters.map(n => 
            ids.includes(n.id) 
              ? { ...n, is_archived: false }
              : n
          )
        );
        
        // Update individual newsletter caches
        ids.forEach(id => {
          const detailKey = buildQueryKey({ scope: 'detail', id, userId: user?.id });
          const previous = queryClient.getQueryData<NewsletterWithRelations>(detailKey);
          if (previous) {
            queryClient.setQueryData(detailKey, { ...previous, is_archived: false });
          }
        });
      }
      
      return { previousNewsletters };
    },
    onError: (err, _ids, context) => {
      console.error('Error bulk unarchiving newsletters:', err);
      if (context?.previousNewsletters) {
        const listQueryKey = buildQueryKey({
          scope: 'list',
          userId: user?.id,
          filter,
          tagId,
          sourceId,
          groupSourceIds,
          timeRange
        });
        queryClient.setQueryData(listQueryKey, context.previousNewsletters);
      }
    },
    onSettled: () => {
      const listQueryKey = buildQueryKey({
        scope: 'list',
        userId: user?.id,
        filter,
        tagId,
        sourceId,
        groupSourceIds,
        timeRange
      });
      // Force a refetch to ensure cache is in sync
      queryClient.invalidateQueries({ 
        queryKey: listQueryKey,
        refetchType: 'active' 
      });
    },
  });

  const bulkMarkAsRead = useCallback(async (ids: string[], options?: any) => {
    return bulkMarkAsReadMutation.mutateAsync(ids, options);
  }, [bulkMarkAsReadMutation]);

  const bulkMarkAsUnread = useCallback(async (ids: string[], options?: any) => {
    return bulkMarkAsUnreadMutation.mutateAsync(ids, options);
  }, [bulkMarkAsUnreadMutation]);

  const bulkArchive = useCallback(async (ids: string[], options?: any) => {
    return bulkArchiveMutation.mutateAsync(ids, options);
  }, [bulkArchiveMutation]);

  const bulkUnarchive = useCallback(async (ids: string[], options?: any) => {
    return bulkUnarchiveMutation.mutateAsync(ids, options);
  }, [bulkUnarchiveMutation]);

  return {
    // Single newsletter operations
    getNewsletter,
    deleteNewsletter,
    isDeletingNewsletter: deleteNewsletterMutation.isPending,
    errorDeletingNewsletter: deleteNewsletterMutation.error,
    
    // Newsletter list and query
    newsletters: filteredNewsletters,
    isLoadingNewsletters: isLoading,
    isErrorNewsletters: !!errorNewsletters,
    errorNewsletters,
    refetchNewsletters,
    
    // Read status mutations
    markAsRead: markAsRead as UseMutateAsyncFunction<boolean, Error, string, PreviousNewslettersState>,
    markAsUnread,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    isMarkingAsRead: markAsReadMutation.isPending,
    errorMarkingAsRead: markAsReadMutation.error,
    isMarkingAsUnread: markAsUnreadMutation.isPending,
    errorMarkingAsUnread: markAsUnreadMutation.error,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending,
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,
    
    // Like mutation
    toggleLike,
    isTogglingLike: toggleLikeMutation.isPending,
    errorTogglingLike: toggleLikeMutation.error,
    
    // Archive mutations
    toggleArchive,
    bulkArchive,
    bulkUnarchive,
    isArchiving: toggleArchiveMutation.isPending,
    errorArchiving: toggleArchiveMutation.error,
    isUnarchiving: unarchiveMutation.isPending,
    errorUnarchiving: unarchiveMutation.error,
    isBulkArchiving: bulkArchiveMutation.isPending,
    errorBulkArchiving: bulkArchiveMutation.error,
    isBulkUnarchiving: bulkUnarchiveMutation.isPending,
    errorBulkUnarchiving: bulkUnarchiveMutation.error,
    
    // Queue mutations
    toggleInQueue: async (newsletterId: string) => {
      if (!user?.id) {
        console.error('Cannot toggle queue: User not authenticated');
        throw new Error('User not authenticated');
      }

      // Check if the newsletter is already in the queue
      const { data: existingItem, error: checkError } = await supabase
        .from('reading_queue')
        .select('id, newsletter_id, position')
        .eq('user_id', user.id)
        .eq('newsletter_id', newsletterId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking queue status:', checkError);
        throw checkError;
      }

      if (existingItem) {
        // Remove from queue
        const { error: deleteError } = await supabase
          .from('reading_queue')
          .delete()
          .eq('id', existingItem.id)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error removing from queue:', deleteError);
          throw deleteError;
        }
        
        console.log('Removed from reading queue:', newsletterId);
        return false;
      } else {
        // Add to queue - get the current max position
        const { data: maxPosition, error: positionError } = await supabase
          .from('reading_queue')
          .select('position')
          .eq('user_id', user.id)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (positionError && positionError.code !== 'PGRST116') { // PGRST116 is 'no rows found'
          console.error('Error getting max position:', positionError);
          throw positionError;
        }

        const nextPosition = (maxPosition?.position ?? -1) + 1;

        // Add to queue
        const { data: insertedItem, error: insertError } = await supabase
          .from('reading_queue')
          .insert({
            user_id: user.id,
            newsletter_id: newsletterId,
            position: nextPosition,
          })
          .select()
          .single();

        if (insertError) {
          // If it's a unique violation, the item might have been added by another request
          if (insertError.code === '23505') {
            console.log('Queue item already exists, fetching existing item');
            const { data: existing } = await supabase
              .from('reading_queue')
              .select('*')
              .eq('user_id', user.id)
              .eq('newsletter_id', newsletterId)
              .single();
            
            if (!existing) {
              throw new Error('Failed to resolve queue item conflict');
            }
            
            return true;
          }
          
          console.error('Error adding to queue:', insertError);
          throw insertError;
        }
        
        console.log('Added to reading queue:', insertedItem);
        return true;
      }
    },
    isTogglingInQueue: false,
    errorTogglingInQueue: null,
    
    // Delete mutations
    bulkDeleteNewsletters: async (_ids: string[]) => {
      console.warn('bulkDeleteNewsletters not implemented');
      return false;
    },
    isBulkDeletingNewsletters: false,
    errorBulkDeletingNewsletters: null,
  } as const;
};
