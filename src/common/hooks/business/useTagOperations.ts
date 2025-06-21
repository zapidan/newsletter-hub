import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { tagService } from '@common/services';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { useLogger } from '@common/utils/logger';
import { Tag, TagCreate, TagUpdate } from '@common/types';

interface UseTagOperationsOptions {
  onSuccess?: (operation: string, tag?: Tag) => void;
  onError?: (operation: string, error: string) => void;
  showToasts?: boolean;
}

export function useTagOperations(options: UseTagOperationsOptions = {}) {
  const queryClient = useQueryClient();
  const log = useLogger();
  const { onSuccess, onError, showToasts = true } = options;

  // Utility function to invalidate related queries
  const invalidateRelatedQueries = useCallback(
    (tagIds?: string[]) => {
      const queriesToInvalidate = [
        queryKeyFactory.tags.all(),
        queryKeyFactory.newsletters.all(),
        queryKeyFactory.newsletters.inbox(),
      ];

      if (tagIds) {
        tagIds.forEach((id) => {
          queriesToInvalidate.push(queryKeyFactory.tags.detail(id));
        });
      }

      return Promise.all(
        queriesToInvalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
    },
    [queryClient]
  );

  // Get all tags query
  const tagsQuery = useQuery({
    queryKey: queryKeyFactory.tags.all(),
    queryFn: () => tagService.getAllTags(true),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (tagData: Omit<TagCreate, 'user_id'>) => tagService.createTag(tagData),
    onSuccess: async (result) => {
      if (result.success) {
        await invalidateRelatedQueries();
        onSuccess?.('createTag', result.tag);
        if (showToasts) {
          toast.success(`Tag "${result.tag?.name}" created`);
        }
      } else {
        onError?.('createTag', result.error || 'Failed to create tag');
        if (showToasts) {
          toast.error(result.error || 'Failed to create tag');
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to create tag', {
        component: 'useTagOperations',
        action: 'createTag',
        error,
      });
      onError?.('createTag', errorMessage);
      if (showToasts) {
        toast.error('Failed to create tag');
      }
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: (tagData: TagUpdate) => tagService.updateTag(tagData),
    onSuccess: async (result, tagData) => {
      if (result.success) {
        await invalidateRelatedQueries([tagData.id]);
        onSuccess?.('updateTag', result.tag);
        if (showToasts) {
          toast.success(`Tag "${result.tag?.name}" updated`);
        }
      } else {
        onError?.('updateTag', result.error || 'Failed to update tag');
        if (showToasts) {
          toast.error(result.error || 'Failed to update tag');
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to update tag', {
        component: 'useTagOperations',
        action: 'updateTag',
        error,
      });
      onError?.('updateTag', errorMessage);
      if (showToasts) {
        toast.error('Failed to update tag');
      }
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: (tagId: string) => tagService.deleteTag(tagId),
    onSuccess: async (result, tagId) => {
      if (result.success) {
        await invalidateRelatedQueries([tagId]);
        onSuccess?.('deleteTag', result.tag);
        if (showToasts) {
          toast.success(`Tag "${result.tag?.name}" deleted`);
        }
      } else {
        onError?.('deleteTag', result.error || 'Failed to delete tag');
        if (showToasts) {
          toast.error(result.error || 'Failed to delete tag');
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to delete tag', {
        component: 'useTagOperations',
        action: 'deleteTag',
        error,
      });
      onError?.('deleteTag', errorMessage);
      if (showToasts) {
        toast.error('Failed to delete tag');
      }
    },
  });

  // Get or create tag mutation
  const getOrCreateTagMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      tagService.getOrCreateTag(name, color),
    onSuccess: async (result) => {
      if (result.success) {
        await invalidateRelatedQueries();
        onSuccess?.('getOrCreateTag', result.tag);
        if (showToasts) {
          toast.success(`Tag "${result.tag?.name}" ready`);
        }
      } else {
        onError?.('getOrCreateTag', result.error || 'Failed to get or create tag');
        if (showToasts) {
          toast.error(result.error || 'Failed to get or create tag');
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to get or create tag', {
        component: 'useTagOperations',
        action: 'getOrCreateTag',
        error,
      });
      onError?.('getOrCreateTag', errorMessage);
      if (showToasts) {
        toast.error('Failed to get or create tag');
      }
    },
  });

  // Update newsletter tags mutation
  const updateNewsletterTagsMutation = useMutation({
    mutationFn: ({ newsletterId, tagIds }: { newsletterId: string; tagIds: string[] }) =>
      tagService.updateNewsletterTagsWithIds(newsletterId, tagIds),
    onSuccess: async (result, { newsletterId }) => {
      if (result.success) {
        await invalidateRelatedQueries();
        // Also invalidate newsletter-specific queries
        await queryClient.invalidateQueries({
          queryKey: queryKeyFactory.newsletters.detail(newsletterId),
        });
        onSuccess?.('updateNewsletterTags');
        if (showToasts) {
          toast.success('Newsletter tags updated');
        }
      } else {
        onError?.('updateNewsletterTags', result.error || 'Failed to update newsletter tags');
        if (showToasts) {
          toast.error(result.error || 'Failed to update newsletter tags');
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to update newsletter tags', {
        component: 'useTagOperations',
        action: 'updateNewsletterTags',
        error,
      });
      onError?.('updateNewsletterTags', errorMessage);
      if (showToasts) {
        toast.error('Failed to update newsletter tags');
      }
    },
  });

  // Query factory functions for dynamic queries
  const createSearchTagsQuery = useCallback(
    (query: string) => ({
      queryKey: queryKeyFactory.tags.search(query),
      queryFn: () => tagService.searchTags(query),
      enabled: query.trim().length > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }),
    []
  );

  const createTagSuggestionsQuery = useCallback(
    (context?: { newsletterContent?: string; existingTags?: Tag[]; sourceId?: string }) => ({
      queryKey: queryKeyFactory.tags.suggestions(context),
      queryFn: () => tagService.getTagSuggestions(context),
      staleTime: 10 * 60 * 1000, // 10 minutes
      enabled: !!context,
    }),
    []
  );

  const createTagUsageStatsQuery = useCallback(
    (tagId: string) => ({
      queryKey: queryKeyFactory.tags.usageStats(tagId),
      queryFn: () => tagService.getTagUsageStats(tagId),
      enabled: !!tagId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
    []
  );

  // Bulk create tags mutation
  const bulkCreateTagsMutation = useMutation({
    mutationFn: (tagDataArray: Array<Omit<TagCreate, 'user_id'>>) =>
      tagService.bulkCreateTags(tagDataArray),
    onSuccess: async (result) => {
      await invalidateRelatedQueries();

      if (result.success) {
        onSuccess?.('bulkCreateTags');
        if (showToasts) {
          toast.success(`Created ${result.processedCount} tags`);
        }
      } else {
        const message = `Created ${result.processedCount} tags, ${result.failedCount} failed`;
        onError?.('bulkCreateTags', message);
        if (showToasts) {
          toast.error(message);
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to bulk create tags', {
        component: 'useTagOperations',
        action: 'bulkCreateTags',
        error,
      });
      onError?.('bulkCreateTags', errorMessage);
      if (showToasts) {
        toast.error('Failed to create tags');
      }
    },
  });

  return {
    // Query data
    tags: tagsQuery.data || [],
    isLoadingTags: tagsQuery.isLoading,
    isErrorTags: tagsQuery.isError,
    errorTags: tagsQuery.error,
    refetchTags: tagsQuery.refetch,

    // Single tag operations
    createTag: createTagMutation.mutateAsync,
    isCreatingTag: createTagMutation.isPending,
    updateTag: updateTagMutation.mutateAsync,
    isUpdatingTag: updateTagMutation.isPending,
    deleteTag: deleteTagMutation.mutateAsync,
    isDeletingTag: deleteTagMutation.isPending,

    // Smart tag operations
    getOrCreateTag: getOrCreateTagMutation.mutateAsync,
    isGettingOrCreatingTag: getOrCreateTagMutation.isPending,

    // Newsletter tag operations
    updateNewsletterTags: updateNewsletterTagsMutation.mutateAsync,
    isUpdatingNewsletterTags: updateNewsletterTagsMutation.isPending,

    // Bulk operations
    bulkCreateTags: bulkCreateTagsMutation.mutateAsync,
    isBulkCreatingTags: bulkCreateTagsMutation.isPending,

    // Query helpers
    createSearchTagsQuery,
    createTagSuggestionsQuery,
    createTagUsageStatsQuery,

    // Error states
    errorCreatingTag: createTagMutation.error,
    errorUpdatingTag: updateTagMutation.error,
    errorDeletingTag: deleteTagMutation.error,
    errorGettingOrCreatingTag: getOrCreateTagMutation.error,
    errorUpdatingNewsletterTags: updateNewsletterTagsMutation.error,
    errorBulkCreatingTags: bulkCreateTagsMutation.error,

    // Reset functions
    resetCreateTagError: createTagMutation.reset,
    resetUpdateTagError: updateTagMutation.reset,
    resetDeleteTagError: deleteTagMutation.reset,
    resetGetOrCreateTagError: getOrCreateTagMutation.reset,
    resetUpdateNewsletterTagsError: updateNewsletterTagsMutation.reset,
    resetBulkCreateTagsError: bulkCreateTagsMutation.reset,
  };
}
