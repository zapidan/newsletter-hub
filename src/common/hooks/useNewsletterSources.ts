import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo, useContext } from 'react';
import { NewsletterSource } from '@common/types';
import { PaginatedResponse, NewsletterSourceQueryParams } from '@common/types/api';
import { AuthContext } from '@common/contexts/AuthContext';
import { newsletterSourceService } from '@common/services';
import { getCacheManagerSafe } from '@common/utils/cacheUtils';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Query keys
const queryKeys = {
  all: ['newsletterSources'],
  lists: () => [...queryKeys.all, 'list'],
  detail: (id: string) => [...queryKeys.all, 'detail', id],
  userSources: (userId: string, params?: NewsletterSourceQueryParams) => [
    ...queryKeys.all,
    'user',
    userId,
    ...(params ? [params] : []),
  ],
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

// Hook
export const useNewsletterSources = (params: NewsletterSourceQueryParams = {}) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const userId = user?.id || '';

  // Default parameters for getting active sources with counts
  const queryParams = useMemo(
    () => ({
      excludeArchived: true,
      includeCount: true,
      orderBy: 'created_at',
      ascending: false,
      ...params,
    }),
    [params]
  );

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Safe cache manager helper
  const safeCacheCall = useCallback(
    (fn: (manager: NonNullable<ReturnType<typeof getCacheManagerSafe>>) => void) => {
      if (cacheManager) {
        fn(cacheManager);
      }
    },
    [cacheManager]
  );

  // Query for newsletter sources using the API layer
  const {
    data: sourcesResponse,
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: errorSources,
    isFetching: isFetchingSources,
    isStale: isStaleSources,
    refetch: refetchSources,
  } = useQuery<PaginatedResponse<NewsletterSource>, Error>({
    queryKey: queryKeys.userSources(userId, queryParams),
    queryFn: async () => {
      const result = await newsletterSourceService.getSources(queryParams);
      return result;
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  // Extract newsletter sources from paginated response
  const newsletterSources = sourcesResponse?.data || [];

  // Invalidate and refetch
  const invalidateSources = useCallback(async () => {
    safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'newsletter-sources'));
  }, [safeCacheCall]);

  // Update mutation using API layer
  const updateMutation = useMutation<
    NewsletterSource,
    Error,
    UpdateNewsletterSourceVars,
    SourceContext
  >({
    mutationFn: async ({ id, name }) => {
      const result = await newsletterSourceService.updateSource(id, { name });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update source');
      }
      return result.source;
    },
    onMutate: async () => {
      // Use cache manager for optimistic update
      const previousSources = newsletterSources;

      // Apply optimistic update with the new name
      safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'source-update-optimistic'));

      return { previousSources };
    },
    onError: (_, __, context) => {
      // Revert optimistic update using cache manager
      if (context?.previousSources) {
        safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'source-update-error'));
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });

  // Archive mutation using API layer
  const archiveMutation = useMutation<
    NewsletterSource,
    Error,
    ArchiveNewsletterSourceVars,
    SourceContext
  >({
    mutationFn: async ({ id }) => {
      const result = await newsletterSourceService.toggleArchive(id);
      if (!result.success || !result.source) {
        throw new Error(result.error || 'Failed to toggle archive status');
      }
      return result.source;
    },
    onMutate: async ({ archive }) => {
      const previousSources = newsletterSources;

      // Use cache manager for optimistic update
      if (archive) {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], 'source-archive-optimistic')
        );
      } else {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], 'source-unarchive-optimistic')
        );
      }

      return { previousSources };
    },
    onError: (_, __, context) => {
      // Revert optimistic update using cache manager
      if (context?.previousSources) {
        safeCacheCall((manager) => manager.invalidateRelatedQueries([], 'source-archive-error'));
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });

  // Archive or unarchive a source
  const setSourceArchiveStatus = useCallback(
    async (sourceId: string, archive: boolean) => {
      return archiveMutation.mutateAsync({ id: sourceId, archive });
    },
    [archiveMutation]
  );

  return {
    // Source data
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    isFetchingSources,
    isStaleSources,
    refetchSources,

    // Source actions
    updateSource: updateMutation.mutateAsync,
    setSourceArchiveStatus,
    isArchivingSource: archiveMutation.isPending,

    // Raw query data
    sourcesResponse,
  };
};
