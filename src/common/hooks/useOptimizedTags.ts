import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useMemo } from 'react';

import { optimizedTagsApi } from '@common/api/optimizedTagsApi';
import { AuthContext } from '@common/contexts/AuthContext';
import { Tag, TagCreate, TagUpdate } from '@common/types';
import { getCacheManagerSafe, invalidateQueries } from '@common/utils/cacheUtils';
import { useLogger } from '@common/utils/logger/useLogger';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';

export const useOptimizedTags = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();
  const queryClient = useQueryClient();

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

  // Get all tags for the current user using React Query
  const {
    data: tags = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeyFactory.newsletters.tags(),
    queryFn: async (): Promise<Tag[]> => {
      if (!user) return [];

      try {
        return await optimizedTagsApi.getAll();
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to fetch optimized tags',
          {
            action: 'fetch_optimized_tags',
            metadata: { userId: user?.id },
          },
          error
        );
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const error = queryError?.message || null;

  // Stable getTags function that returns cached data
  const getTags = useCallback(async (): Promise<Tag[]> => {
    return tags;
  }, [tags]);

  // Create a new tag using mutation
  const createTagMutation = useMutation({
    mutationFn: async (tag: TagCreate): Promise<Tag> => {
      if (!user) throw new Error('User not authenticated');
      return await optimizedTagsApi.createTag({
        name: tag.name,
        color: tag.color || '#3b82f6', // Default color if not provided
      });
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData<Tag[]>(queryKeyFactory.newsletters.tags(), (oldTags = []) => [
        ...oldTags,
        data,
      ]);

      // Use cache manager for better tag cache management
      safeCacheCall((manager) => {
        manager.invalidateRelatedQueries([], 'tag-create');
        manager.invalidateTagQueries();
      });
      if (!cacheManager) {
        // Fallback to cache utils
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.lists(),
        });
      }
    },
    onError: (err: unknown) => {
      const error = err as Error;
      log.error(
        'Failed to create optimized tag',
        {
          action: 'create_optimized_tag',
          metadata: {
            userId: user?.id,
          },
        },
        error
      );
    },
  });

  const createTag = useCallback(
    async (tag: TagCreate): Promise<Tag | null> => {
      try {
        return await createTagMutation.mutateAsync(tag);
      } catch {
        return null;
      }
    },
    [createTagMutation]
  );

  // Update an existing tag using mutation
  const updateTagMutation = useMutation({
    mutationFn: async (_tag: TagUpdate): Promise<Tag> => {
      if (!user) throw new Error('User not authenticated');
      // In the optimized model, tag updates are handled differently
      // since tags are embedded in newsletters
      throw new Error('Tag updates not supported in optimized model - use updateNewsletterTags instead');
    },
    onError: (err: unknown) => {
      const error = err as Error;
      log.error(
        'Failed to update optimized tag',
        {
          action: 'update_optimized_tag',
          metadata: {
            userId: user?.id,
          },
        },
        error
      );
    },
  });

  const updateTag = useCallback(
    async (tag: TagUpdate): Promise<Tag | null> => {
      try {
        return await updateTagMutation.mutateAsync(tag);
      } catch {
        return null;
      }
    },
    [updateTagMutation]
  );

  // Delete a tag using mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated');
      await optimizedTagsApi.deleteTag(tagId);
    },
    onSuccess: (_, tagId) => {
      // Update cache
      queryClient.setQueryData<Tag[]>(queryKeyFactory.newsletters.tags(), (oldTags = []) =>
        oldTags.filter((t) => t.id !== tagId)
      );

      // Use cache manager for comprehensive tag deletion cache management
      safeCacheCall((manager) => {
        manager.invalidateRelatedQueries([tagId], 'tag-delete');
        manager.removeTagFromAllNewsletters(tagId);
      });
      if (!cacheManager) {
        // Fallback to cache utils
        invalidateQueries({
          predicate: (query: { queryKey: unknown[] }) => {
            return (
              queryKeyFactory.matchers?.isAffectedByTagChange?.(
                query.queryKey as unknown[],
                tagId
              ) || false
            );
          },
          refetchType: 'active',
        });
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.lists(),
        });
      }
    },
    onError: (err: unknown, tagId) => {
      const error = err as Error;
      log.error(
        'Failed to delete optimized tag',
        {
          action: 'delete_optimized_tag',
          metadata: {
            userId: user?.id,
            tagId: tagId,
          },
        },
        error
      );
    },
  });

  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      try {
        await deleteTagMutation.mutateAsync(tagId);
        return true;
      } catch {
        return false;
      }
    },
    [deleteTagMutation]
  );

  // Get tags for a specific newsletter
  const getTagsForNewsletter = useCallback(
    async (newsletterId: string): Promise<Tag[]> => {
      if (!user) return [];

      try {
        // In optimized model, tags are embedded in the newsletter
        // This would be handled by the newsletter API
        const { data: newsletter } = await queryClient.fetchQuery({
          queryKey: queryKeyFactory.newsletters.detail(newsletterId),
          queryFn: async () => {
            // This would call the newsletter API to get tags_json
            throw new Error('Not implemented - use newsletter API to get tags');
          },
        });

        return (newsletter as any)?.tags || [];
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to fetch newsletter optimized tags',
          {
            action: 'fetch_newsletter_optimized_tags',
            metadata: {
              userId: user?.id,
              newsletterId,
            },
          },
          error
        );
        return [];
      }
    },
    [user, log, queryClient]
  );

  // Update tags for a newsletter using mutation
  const updateNewsletterTagsMutation = useMutation({
    mutationFn: async ({
      newsletterId,
      tags,
    }: {
      newsletterId: string;
      tags: Tag[];
    }): Promise<void> => {
      if (!user) throw new Error('User not authenticated');
      await optimizedTagsApi.updateNewsletterTags(newsletterId, tags);
    },
    onSuccess: (_, { newsletterId, tags }) => {
      // Use cache manager for newsletter-tag relationship updates
      safeCacheCall((manager) => {
        manager.updateNewsletterTagsInCache(newsletterId, tags);
        manager.invalidateRelatedQueries([], 'newsletter-tag-update');
      });

      if (!cacheManager) {
        // Fallback to cache utils
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.detail(newsletterId),
        });
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.lists(),
        });
      }
    },
    onError: (err: unknown, { newsletterId, tags }) => {
      const error = err as Error;
      log.error(
        'Failed to update newsletter optimized tags',
        {
          action: 'update_newsletter_optimized_tags',
          metadata: {
            userId: user?.id,
            newsletterId,
            tagIds: tags.length,
          },
        },
        error
      );
    },
  });

  const updateNewsletterTags = useCallback(
    async (newsletterId: string, tags: Tag[]) => {
      try {
        await updateNewsletterTagsMutation.mutateAsync({ newsletterId, tags });
        return true;
      } catch {
        return false;
      }
    },
    [updateNewsletterTagsMutation]
  );

  // Get newsletters by tags (ANY match)
  const getNewslettersByTagsAny = useCallback(
    async (tagNames: string[], params = {}) => {
      try {
        return await optimizedTagsApi.getNewslettersByTagsAny(tagNames, params);
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to get newsletters by tags (any)',
          {
            action: 'get_newsletters_by_tags_any',
            metadata: {
              userId: user?.id,
              tagNames,
            },
          },
          error
        );
        throw error;
      }
    },
    [user, log]
  );

  // Get newsletters by tags (ALL match)
  const getNewslettersByTagsAll = useCallback(
    async (tagNames: string[], params = {}) => {
      try {
        return await optimizedTagsApi.getNewslettersByTagsAll(tagNames, params);
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to get newsletters by tags (all)',
          {
            action: 'get_newsletters_by_tags_all',
            metadata: {
              userId: user?.id,
              tagNames,
            },
          },
          error
        );
        throw error;
      }
    },
    [user, log]
  );

  // Get tag usage statistics
  const getTagUsageStats = useCallback(
    async () => {
      try {
        return await optimizedTagsApi.getTagUsageStats();
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to get tag usage stats',
          {
            action: 'get_tag_usage_stats',
            metadata: {
              userId: user?.id,
            },
          },
          error
        );
        throw error;
      }
    },
    [user, log]
  );

  return {
    loading:
      loading ||
      createTagMutation.isPending ||
      updateTagMutation.isPending ||
      deleteTagMutation.isPending ||
      updateNewsletterTagsMutation.isPending,
    error,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    getTagsForNewsletter,
    updateNewsletterTags,
    getNewslettersByTagsAny,
    getNewslettersByTagsAll,
    getTagUsageStats,
  };
};
