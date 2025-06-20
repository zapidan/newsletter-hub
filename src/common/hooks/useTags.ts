import { useCallback, useContext, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { AuthContext } from '@common/contexts/AuthContext';
import { Tag, TagCreate, TagUpdate } from '@common/types';
import { getCacheManagerSafe, invalidateQueries } from '@common/utils/cacheUtils';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { tagApi } from '@common/api/tagApi';
import { useLogger } from '@common/utils/logger/useLogger';

export const useTags = () => {
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
        return await tagApi.getAll();
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to fetch tags',
          {
            action: 'fetch_tags',
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
      return await tagApi.create(tag);
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
        invalidateQueries({ queryKey: ['newsletter_tags'] });
      }
    },
    onError: (err: unknown) => {
      const error = err as Error;
      log.error(
        'Failed to create tag',
        {
          action: 'create_tag',
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
    mutationFn: async (tag: TagUpdate): Promise<Tag> => {
      if (!user) throw new Error('User not authenticated');
      return await tagApi.update(tag);
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData<Tag[]>(queryKeyFactory.newsletters.tags(), (oldTags = []) =>
        oldTags.map((t) => (t.id === data.id ? data : t))
      );

      // Use cache manager for cross-feature cache synchronization
      safeCacheCall((manager) => {
        manager.invalidateRelatedQueries([data.id], 'tag-update');
        manager.invalidateTagQueries();
      });
      if (!cacheManager) {
        // Fallback to cache utils
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.lists(),
        });
        invalidateQueries({ queryKey: ['newsletter_tags'] });
      }
    },
    onError: (err: unknown) => {
      const error = err as Error;
      log.error(
        'Failed to update tag',
        {
          action: 'update_tag',
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
      await tagApi.delete(tagId);
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
        invalidateQueries({ queryKey: ['newsletter_tags'] });
      }
    },
    onError: (err: unknown, tagId) => {
      const error = err as Error;
      log.error(
        'Failed to delete tag',
        {
          action: 'delete_tag',
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
        return await tagApi.getTagsForNewsletter(newsletterId);
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          'Failed to fetch newsletter tags',
          {
            action: 'fetch_newsletter_tags',
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
    [user, log]
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
      await tagApi.updateNewsletterTags(newsletterId, tags);
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
        invalidateQueries({ queryKey: ['newsletter_tags'] });
        invalidateQueries({
          queryKey: queryKeyFactory.newsletters.lists(),
        });
      }
    },
    onError: (err: unknown, { newsletterId, tags }) => {
      const error = err as Error;
      log.error(
        'Failed to update newsletter tags',
        {
          action: 'update_newsletter_tags',
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
  };
};
