import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  QueryClient,
  keepPreviousData
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { NewsletterSource } from '../types';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import { supabase } from '../services/supabaseClient';

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

// Types
interface UpdateNewsletterSourceVars {
  id: string;
  name: string;
}

interface ArchiveNewsletterSourceVars {
  id: string;
  archive: boolean;
}

type SourceContext = {
  previousSources?: NewsletterSource[];
};

// API functions
const updateNewsletterSourceFn = async ({ id, name }: UpdateNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for updating source');
  }
  
  if (!name.trim()) {
    throw new Error('Newsletter source name cannot be empty.');
  }
  
  const { data, error } = await supabase
    .from('newsletter_sources')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();
    
  if (error) throw error;
  if (!data) throw new Error('Failed to update source');
  return data;
};

const archiveNewsletterSourceFn = async ({ id, archive }: ArchiveNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for archiving source');
  }
  
  const { data, error } = await supabase
    .from('newsletter_sources')
    .update({ 
      is_archived: archive,
    })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();
    
  if (error) throw error;
  if (!data) throw new Error('Failed to update source archive status');
  return data;
};

const fetchNewsletterSourcesFn = async (): Promise<NewsletterSource[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for fetching sources');
  }

  // First, get all non-archived sources for the user
  const { data: sources, error } = await supabase
    .from('newsletter_sources')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!sources || sources.length === 0) return [];

  // Get the count of newsletters for each source using a direct query
  const { data: counts, error: countError } = await supabase
    .from('newsletters')
    .select('newsletter_source_id')
    .eq('user_id', userData.user.id)
    .eq('is_archived', false)
    .not('newsletter_source_id', 'is', null);

  if (countError) throw countError;

  // Count newsletters per source
  const countMap = new Map<string, number>();
  (counts || []).forEach(item => {
    const sourceId = item.newsletter_source_id;
    if (sourceId) {
      countMap.set(sourceId, (countMap.get(sourceId) || 0) + 1);
    }
  });

  // Map the sources and add the counts
  return sources.map((source) => ({
    ...source,
    newsletter_count: countMap.get(source.id) || 0
  }));
};

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
      if (!data) throw new Error('Source not found');
      return data;
    },
    staleTime: STALE_TIME,
  });
};

// Hook
export const useNewsletterSources = () => {
  const queryClient = useQueryClient();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const userId = user?.id || '';
  
  // Query for newsletter sources
  const {
    data: newsletterSources = [],
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: errorSources,
    isFetching: isFetchingSources,
    isStale: isStaleSources,
    refetch: refetchSources,
  } = useQuery<NewsletterSource[], Error>({
    queryKey: queryKeys.userSources(userId),
    queryFn: fetchNewsletterSourcesFn,
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  // Invalidate and refetch
  const invalidateSources = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.userSources(userId),
      refetchType: 'active',
    });
  }, [queryClient, userId]);

  // Prefetch a single source by ID
  const prefetchSourceById = useCallback((id: string) => {
    if (!user) return;
    return prefetchSource(queryClient, id);
  }, [queryClient, user]);

  // Update mutation
  const updateMutation = useMutation<NewsletterSource, Error, UpdateNewsletterSourceVars, SourceContext>({
    mutationFn: updateNewsletterSourceFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.userSources(userId) });
      
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(
        queryKeys.userSources(userId)
      ) || [];

      queryClient.setQueryData<NewsletterSource[]>(
        queryKeys.userSources(userId),
        previousSources.map(source => 
          source.id === variables.id ? { ...source, name: variables.name } : source
        )
      );

      return { previousSources };
    },
    onError: (_, __, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(
          queryKeys.userSources(userId),
          context.previousSources
        );
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });

  // Archive mutation
  const archiveMutation = useMutation<NewsletterSource, Error, ArchiveNewsletterSourceVars, SourceContext>({
    mutationFn: archiveNewsletterSourceFn,
    onMutate: async ({ id, archive }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.userSources(userId) });
      
      const previousSources = queryClient.getQueryData<NewsletterSource[]>(
        queryKeys.userSources(userId)
      ) || [];

      // Remove the source from the list when archiving
      if (archive) {
        queryClient.setQueryData<NewsletterSource[]>(
          queryKeys.userSources(userId),
          previousSources.filter(source => source.id !== id)
        );
      } else {
        // When unarchiving, we'll just invalidate the query to refetch
        await queryClient.invalidateQueries({ queryKey: queryKeys.userSources(userId) });
      }

      return { previousSources };
    },
    onError: (_, __, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(
          queryKeys.userSources(userId),
          context.previousSources
        );
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });
  
  // Archive a source (soft delete)
  const archiveSource = useCallback(async (id: string) => {
    return archiveMutation.mutateAsync({ id, archive: true });
  }, [archiveMutation]);
  
  // Unarchive a source
  const unarchiveSource = useCallback(async (id: string) => {
    return archiveMutation.mutateAsync({ id, archive: false });
  }, [archiveMutation]);

  // Wrapper functions
  const updateSource = useCallback((id: string, name: string) => {
    return updateMutation.mutateAsync({ id, name });
  }, [updateMutation]);
  
  // Keep deleteSource for backward compatibility, but it will now archive instead of delete
  const deleteSource = useCallback((id: string) => {
    return archiveMutation.mutateAsync({ id, archive: true });
  }, [archiveMutation]);

  return {
    // Source data
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    isFetchingSources,
    isStaleSources,
    refetchSources,
    
    // Update source
    updateSource,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    isUpdateSuccess: updateMutation.isSuccess,
    resetUpdate: updateMutation.reset,
    
    // Archive source (soft delete)
    archiveNewsletterSource: archiveSource,
    isArchivingSource: archiveMutation.isPending,
    isErrorArchivingSource: archiveMutation.isError,
    errorArchivingSource: archiveMutation.error,
    isSuccessArchivingSource: archiveMutation.isSuccess,
    
    // Unarchive source
    unarchiveNewsletterSource: unarchiveSource,
    isUnarchivingSource: archiveMutation.isPending,
    isErrorUnarchivingSource: archiveMutation.isError,
    errorUnarchivingSource: archiveMutation.error,
    isSuccessUnarchivingSource: archiveMutation.isSuccess,
    
    // For backward compatibility
    deleteNewsletterSource: deleteSource,
    isDeletingSource: archiveMutation.isPending,
    isErrorDeletingSource: archiveMutation.isError,
    errorDeletingSource: archiveMutation.error,
    isSuccessDeletingSource: archiveMutation.isSuccess,
    
    // Cache utilities
    invalidateSources,
    prefetchSource: prefetchSourceById,
  } as const;
}
