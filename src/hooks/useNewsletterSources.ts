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

// Define the type for the variables passed to the mutation
interface NewsletterSourceVars {
  name: string;
  domain: string;
  id?: string;
}

interface AddNewsletterSourceVars extends Omit<NewsletterSourceVars, 'id'> {}

interface UpdateNewsletterSourceVars extends NewsletterSourceVars {
  id: string;
}

// Function to fetch newsletter sources
const fetchNewsletterSourcesFn = async (): Promise<NewsletterSource[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for fetching sources');
  }
  const user = userData.user;

  const { data, error } = await supabase
    .from('newsletter_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data || [];
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

// Function to add a newsletter source
const cleanDomain = (domain: string): string => {
  let cleaned = domain.toLowerCase().trim();
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  return cleaned.replace(/\/$/, '');
};

const addNewsletterSourceFn = async ({ name, domain }: AddNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for adding source');
  }
  const user = userData.user;

  const cleanedDomain = cleanDomain(domain);

  if (!name.trim() || !cleanedDomain) {
    throw new Error('Newsletter name and domain cannot be empty.');
  }

  const { data, error } = await supabase
    .from('newsletter_sources')
    .insert([{ name: name.trim(), domain: cleanedDomain, user_id: user.id }])
    .select()
    .single();

  if (error) {

    throw error;
  }
  if (!data) {
    throw new Error('Failed to add newsletter source, no data returned.');
  }
  return data;
};

// Function to update a newsletter source
const updateNewsletterSourceFn = async ({ id, name, domain }: UpdateNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for updating source');
  }

  const cleanedDomain = cleanDomain(domain);

  if (!name.trim() || !cleanedDomain) {
    throw new Error('Newsletter name and domain cannot be empty.');
  }

  const { data, error } = await supabase
    .from('newsletter_sources')
    .update({ 
      name: name.trim(), 
      domain: cleanedDomain,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();

  if (error) {

    throw error;
  }
  if (!data) {
    throw new Error('Failed to update newsletter source, no data returned.');
  }
  return data;
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

  // Add mutation with optimistic updates
  const addMutation = useMutation<NewsletterSource, PostgrestError | Error, AddNewsletterSourceVars, SourceContext>({
    mutationFn: addNewsletterSourceFn,
    onMutate: async (newSource) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(queryKey) || [];
      
      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: NewsletterSource[] = []) => [
        { ...newSource, id: 'temp-id', created_at: new Date().toISOString() },
        ...old
      ]);
      
      return { previousSources };
    },
    onError: (_err, _newSource, context) => {
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

  // Update mutation with optimistic updates
  const updateMutation = useMutation<NewsletterSource, PostgrestError | Error, UpdateNewsletterSourceVars, SourceContext>({
    mutationFn: updateNewsletterSourceFn,
    onMutate: async (updatedSource) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(queryKey) || [];
      
      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: NewsletterSource[] = []) =>
        old.map(source => 
          source.id === updatedSource.id 
            ? { ...source, ...updatedSource, updated_at: new Date().toISOString() }
            : source
        )
      );
      
      return { previousSources };
    },
    onError: (_err, _variables, context) => {
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

  // Delete mutation with optimistic updates
  const deleteMutation = useMutation<void, PostgrestError | Error, string, SourceContext>({
    mutationFn: deleteNewsletterSourceFn,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(queryKey) || [];
      
      // Optimistically remove the source
      queryClient.setQueryData(queryKey, (old: NewsletterSource[] = []) =>
        old.filter(source => source.id !== id)
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

  // Optimize cache updates
  const updateCache = useCallback((updatedSource: NewsletterSource) => {
    queryClient.setQueryData<NewsletterSource[]>(queryKey, (old = []) => {
      const index = old.findIndex(s => s.id === updatedSource.id);
      if (index >= 0) {
        const newData = [...old];
        newData[index] = updatedSource;
        return newData;
      }
      return [updatedSource, ...old];
    });
  }, [queryClient, queryKey]);

  // Optimize cache removal
  const removeFromCache = useCallback((id: string) => {
    queryClient.setQueryData<NewsletterSource[]>(queryKey, (old = []) => 
      old.filter(source => source.id !== id)
    );
  }, [queryClient, queryKey]);

  return {
    // Sources data
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    isFetchingSources,
    isStaleSources,
    refetchSources,
    
    // Add source
    addNewsletterSource: addMutation.mutate,
    addNewsletterSourceAsync: addMutation.mutateAsync,
    isAddingSource: addMutation.isPending,
    isErrorAddingSource: addMutation.isError,
    errorAddingSource: addMutation.error,
    isSuccessAddingSource: addMutation.isSuccess,
    
    // Update source
    updateNewsletterSource: updateMutation.mutate,
    updateNewsletterSourceAsync: updateMutation.mutateAsync,
    isUpdatingSource: updateMutation.isPending,
    isErrorUpdatingSource: updateMutation.isError,
    errorUpdatingSource: updateMutation.error,
    isSuccessUpdatingSource: updateMutation.isSuccess,
    
    // Delete source
    deleteNewsletterSource: deleteMutation.mutate,
    deleteNewsletterSourceAsync: deleteMutation.mutateAsync,
    isDeletingSource: deleteMutation.isPending,
    isErrorDeletingSource: deleteMutation.isError,
    errorDeletingSource: deleteMutation.error,
    isSuccessDeletingSource: deleteMutation.isSuccess,
    
    // Cache utilities
    invalidateSources,
    prefetchSource: prefetchSourceById,
    updateCache,
    removeFromCache,
  } as const;
}
