import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useCallback, useMemo, useContext } from "react";
import { NewsletterSource } from "@common/types";
import {
  PaginatedResponse,
  NewsletterSourceQueryParams,
} from "@common/types/api";
import { AuthContext } from "@common/contexts/AuthContext";
import { newsletterSourceApi } from "@common/api/newsletterSourceApi";
import { getCacheManagerSafe } from "@common/utils/cacheUtils";

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Query keys
const queryKeys = {
  all: ["newsletterSources"],
  lists: () => [...queryKeys.all, "list"],
  detail: (id: string) => [...queryKeys.all, "detail", id],
  userSources: (userId: string, params?: NewsletterSourceQueryParams) => [
    ...queryKeys.all,
    "user",
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
export const useNewsletterSources = (
  params: NewsletterSourceQueryParams = {},
) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const userId = user?.id || "";

  // Default parameters for getting active sources with counts
  const queryParams = useMemo(
    () => ({
      excludeArchived: true,
      includeCount: true,
      orderBy: "created_at",
      ascending: false,
      ...params,
    }),
    [params],
  );

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Safe cache manager helper
  const safeCacheCall = useCallback(
    (
      fn: (
        manager: NonNullable<ReturnType<typeof getCacheManagerSafe>>,
      ) => void,
    ) => {
      if (cacheManager) {
        fn(cacheManager);
      }
    },
    [cacheManager],
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
    queryFn: () => newsletterSourceApi.getAll(queryParams),
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
    safeCacheCall((manager) =>
      manager.invalidateRelatedQueries([], "newsletter-sources"),
    );
  }, [safeCacheCall]);

  // Prefetch a single source by ID
  const prefetchSourceById = useCallback(() => {
    if (!user) return;
    // Implementation would use cache manager if needed
    return Promise.resolve();
  }, [user]);

  // Update mutation using API layer
  const updateMutation = useMutation<
    NewsletterSource,
    Error,
    UpdateNewsletterSourceVars,
    SourceContext
  >({
    mutationFn: async ({ id, name }) => {
      return newsletterSourceApi.update({ id, name });
    },
    onMutate: async ({ id, name }) => {
      // Use cache manager for optimistic update
      const previousSources = newsletterSources;

      // Apply optimistic update with the new name
      safeCacheCall((manager) =>
        manager.invalidateRelatedQueries([], "source-update-optimistic"),
      );

      return { previousSources };
    },
    onError: (_, __, context) => {
      // Revert optimistic update using cache manager
      if (context?.previousSources) {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], "source-update-error"),
        );
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
    mutationFn: async ({ id, archive }) => {
      return archive
        ? newsletterSourceApi.archive(id)
        : newsletterSourceApi.unarchive(id);
    },
    onMutate: async ({ archive }) => {
      const previousSources = newsletterSources;

      // Use cache manager for optimistic update
      if (archive) {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], "source-archive-optimistic"),
        );
      } else {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], "source-unarchive-optimistic"),
        );
      }

      return { previousSources };
    },
    onError: (_, __, context) => {
      // Revert optimistic update using cache manager
      if (context?.previousSources) {
        safeCacheCall((manager) =>
          manager.invalidateRelatedQueries([], "source-archive-error"),
        );
      }
    },
    onSettled: () => {
      invalidateSources();
    },
  });

  // Archive a source (soft delete)
  const archiveSource = useCallback(
    async (sourceId: string) => {
      return archiveMutation.mutateAsync({ id: sourceId, archive: true });
    },
    [archiveMutation],
  );

  // Unarchive a source
  const unarchiveSource = useCallback(
    async (sourceId: string) => {
      return archiveMutation.mutateAsync({ id: sourceId, archive: false });
    },
    [archiveMutation],
  );

  // Wrapper functions
  const updateSource = useCallback(
    (id: string, name: string) => {
      return updateMutation.mutateAsync({ id, name });
    },
    [updateMutation],
  );

  // Keep deleteSource for backward compatibility, but it will now archive instead of delete
  const deleteSource = useCallback(
    (sourceId: string) => {
      return archiveMutation.mutateAsync({ id: sourceId, archive: true });
    },
    [archiveMutation],
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

    // Pagination data from API response
    sourcesCount: sourcesResponse?.count || 0,
    sourcesPage: sourcesResponse?.page || 1,
    sourcesLimit: sourcesResponse?.limit || 50,
    sourcesHasMore: sourcesResponse?.hasMore || false,
    sourcesNextPage: sourcesResponse?.nextPage,
    sourcesPrevPage: sourcesResponse?.prevPage,

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
};
