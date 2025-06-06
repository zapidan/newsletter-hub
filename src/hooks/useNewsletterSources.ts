import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  keepPreviousData,
  QueryClient
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { NewsletterSource } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Query keys
const queryKeys = {
  all: ['newsletterSources'],
  lists: () => [...queryKeys.all, 'list'],
  detail: (id: string) => [...queryKeys.all, 'detail', id],
  userSources: (userId: string) => [...queryKeys.all, 'user', userId],
};

// Function to update a newsletter source's name/title only
interface UpdateNewsletterSourceVars {
  id: string;
  name: string;
}

const updateNewsletterSourceFn = async ({ id, name }: UpdateNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for updating source');
  }
  const user = userData.user;
  if (!name.trim()) {
    throw new Error('Newsletter source name cannot be empty.');
  }
  const { data, error } = await supabase
    .from('newsletter_sources')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Failed to update source');
  return data;
};

// Optimized function to fetch newsletter sources with newsletter count in one query
const fetchNewsletterSourcesFn = async (): Promise<NewsletterSource[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for fetching sources');
  }
  const user = userData.user;

  // Fetch sources and their newsletter counts in one query using PostgREST's count aggregation
  // This will return an array of sources, each with a newsletters field containing the count
  const { data: sources, error } = await supabase
    .from('newsletter_sources')
    .select('*, newsletters(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!sources || sources.length === 0) return [];

  // Map the result to flatten the newsletter_count
  return sources.map((source: any) => ({
    ...source,
    newsletter_count: source.newsletters?.[0]?.count ?? 0
  }));
};

// Function to prefetch a single source
const prefetchSource = async (queryClient: QueryClient, id: string): Promise<void> => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_sources')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME,
  });
};

// Function to delete a newsletter source
const deleteNewsletterSourceFn = async (id: string): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for deleting source');
  }

  const { error } = await supabase
    .from('newsletter_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);

  if (error) {

    throw error;
  }
};

// Optimistic update types
type SourceContext = {
  previousSources?: NewsletterSource[];
};

export function useNewsletterSources() {
  const queryClient = useQueryClient();
  const { data: userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.getUser(),
    select: (response) => response.data.user,
    staleTime: STALE_TIME,
  });

  const queryKey = queryKeys.userSources(userData?.id || 'default');

  const { 
    data: newsletterSources = [],
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: errorSources,
    isFetching: isFetchingSources,
    isStale: isStaleSources,
    refetch: refetchSources,
  } = useQuery<NewsletterSource[], Error>({
    queryKey,
    queryFn: fetchNewsletterSourcesFn,
    enabled: !!userData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    placeholderData: keepPreviousData,
  });

  // Invalidate and refetch
  const invalidateSources = useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.userSources(userData?.id || '') }),
    ]);
  }, [queryClient, userData?.id]);
  
  // Prefetch a single source
  const prefetchSourceById = useCallback(async (id: string) => {
    await prefetchSource(queryClient, id);
  }, [queryClient]);


  
  // Update source mutation
  const updateMutation = useMutation<NewsletterSource, PostgrestError | Error, UpdateNewsletterSourceVars, SourceContext>({
    mutationFn: updateNewsletterSourceFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(queryKey) || [];
      // Optimistically update the name in the cache
      queryClient.setQueryData(queryKey, previousSources.map(source =>
        source.id === vars.id ? { ...source, name: vars.name } : source
      ));
      return { previousSources };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(queryKey, context.previousSources);
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });

  // Delete source mutation
  const deleteMutation = useMutation<void, PostgrestError | Error, string, SourceContext>({
    mutationFn: deleteNewsletterSourceFn,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(queryKey) || [];
      
      // Optimistically remove the source
      queryClient.setQueryData(queryKey, 
        previousSources.filter(source => source.id !== id)
      );
      
      return { previousSources };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousSources) {
        queryClient.setQueryData(queryKey, context.previousSources);
      }
    },
    onSettled: () => {
      // Invalidate and refetch
      invalidateSources();
    },
  });

  // Handle delete source with confirmation
  const deleteNewsletterSource = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this source? This will not delete any existing newsletters.')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting source:', error);
        throw error;
      }
    }
  }, [deleteMutation]);
  
  // Alias for deleteNewsletterSource that takes an object with id
  const deleteSource = useCallback(async ({ id }: { id: string }) => {
    return deleteNewsletterSource(id);
  }, [deleteNewsletterSource]);

  return {
    // Sources data
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    isFetchingSources,
    isStaleSources,
    refetchSources,
    
    // Update source
    updateNewsletterSource: updateMutation.mutate,
    updateNewsletterSourceAsync: updateMutation.mutateAsync,
    isUpdatingSource: updateMutation.isPending,
    isErrorUpdatingSource: updateMutation.isError,
    errorUpdatingSource: updateMutation.error,
    isSuccessUpdatingSource: updateMutation.isSuccess,
    
    // Delete source
    deleteNewsletterSource: deleteSource,
    isDeletingSource: deleteMutation.isPending,
    isErrorDeletingSource: deleteMutation.isError,
    errorDeletingSource: deleteMutation.error,
    isSuccessDeletingSource: deleteMutation.isSuccess,
    
    // Cache utilities
    invalidateSources,
    prefetchSource: prefetchSourceById,
  } as const;
}
