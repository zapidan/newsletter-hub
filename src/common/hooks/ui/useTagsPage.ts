import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTagOperations } from '@common/hooks/business/useTagOperations';
import { useCache } from '@common/hooks/useCache';
import { newsletterService } from '@common/services';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { useLogger } from '@common/utils/logger';
import type { Tag, TagCreate, TagWithCount, Newsletter } from '@common/types';

interface UseTagsPageOptions {
  showToasts?: boolean;
  onSuccess?: (operation: string, tag?: Tag) => void;
  onError?: (operation: string, error: string) => void;
}

interface UseTagsPageState {
  isCreating: boolean;
  newTag: Omit<TagCreate, 'user_id'>;
  editingTagId: string | null;
  editTagData: Partial<Tag>;
}

interface UseTagsPageActions {
  setIsCreating: (creating: boolean) => void;
  setNewTag: (tag: Omit<TagCreate, 'user_id'>) => void;
  setEditingTagId: (id: string | null) => void;
  setEditTagData: (data: Partial<Tag>) => void;
  handleCreateTag: () => Promise<void>;
  handleUpdateTag: () => Promise<void>;
  handleDeleteTag: (tagId: string) => Promise<void>;
  resetCreateForm: () => void;
  resetEditForm: () => void;
}

interface UseTagsPageReturn extends UseTagsPageState, UseTagsPageActions {
  // Data
  tags: TagWithCount[];
  tagNewsletters: Record<string, Newsletter[]>;
  newsletters: Newsletter[];

  // Loading states
  isLoading: boolean;
  isLoadingTags: boolean;
  isLoadingNewsletters: boolean;
  isLoadingTagUsage: boolean;

  // Error states
  error: string | null;
  isError: boolean;

  // Mutation states
  isCreatingTag: boolean;
  isUpdatingTag: boolean;
  isDeletingTag: boolean;

  // Refresh function
  refreshData: () => Promise<void>;
}

const DEFAULT_NEW_TAG: Omit<TagCreate, 'user_id'> = {
  name: '',
  color: '#3b82f6',
};

export function useTagsPage(options: UseTagsPageOptions = {}): UseTagsPageReturn {
  const { showToasts = true, onSuccess, onError } = options;
  const log = useLogger();
  const { batchInvalidate } = useCache();

  // State management
  const [state, setState] = useState<UseTagsPageState>({
    isCreating: false,
    newTag: { ...DEFAULT_NEW_TAG },
    editingTagId: null,
    editTagData: {},
  });

  // Use the business logic hook for tag operations
  const {
    tags: baseTags,
    isLoadingTags,
    createTag,
    updateTag,
    deleteTag,
    isCreatingTag,
    isUpdatingTag,
    isDeletingTag,
    refetchTags,
  } = useTagOperations({
    showToasts: false, // We'll handle toasts ourselves for better UX
    onSuccess: (operation, tag) => {
      onSuccess?.(operation, tag);
    },
    onError: (operation, error) => {
      log.error(`Tag operation failed: ${operation}`, {
        component: 'useTagsPage',
        action: operation,
        error,
      });
      onError?.(operation, error);
    },
  });

  // Fetch tag usage statistics
  const {
    data: tagUsageStats = [],
    isLoading: isLoadingTagUsage,
    error: tagUsageError,
  } = useQuery({
    queryKey: queryKeyFactory.tags.usageStats('all'),
    queryFn: async () => {
      try {
        const stats = await newsletterService.getTagUsageStats();
        return stats;
      } catch (error) {
        log.error('Failed to fetch tag usage stats', {
          component: 'useTagsPage',
          action: 'fetchTagUsageStats',
          error,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all newsletters with tags for computing tag relationships
  const {
    data: newslettersResponse,
    isLoading: isLoadingNewsletters,
    error: newslettersError,
  } = useQuery({
    queryKey: queryKeyFactory.newsletters.all(),
    queryFn: async () => {
      try {
        return await newsletterService.getAll({
          includeSource: true,
          includeTags: true,
          limit: 1000, // Get a large number for tags page
        });
      } catch (error) {
        log.error('Failed to fetch newsletters', {
          component: 'useTagsPage',
          action: 'fetchNewsletters',
          error,
        });
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const newsletters = newslettersResponse?.data || [];

  // Compute tags with usage counts and newsletter relationships
  const { tagsWithCount, newslettersByTag } = useMemo(() => {
    // Map tag_id to array of newsletters (excluding archived ones)
    const newslettersMap: Record<string, Newsletter[]> = {};

    if (Array.isArray(newsletters)) {
      newsletters.forEach((newsletter: Newsletter) => {
        // Skip archived newsletters
        if (newsletter.is_archived) return;

        if (newsletter.tags && Array.isArray(newsletter.tags)) {
          newsletter.tags.forEach((tag: Tag) => {
            if (!newslettersMap[tag.id]) {
              newslettersMap[tag.id] = [];
            }
            newslettersMap[tag.id].push(newsletter);
          });
        }
      });
    }

    // Use tag usage stats if available, otherwise compute from newsletters
    const tagsWithCount: TagWithCount[] =
      tagUsageStats.length > 0
        ? tagUsageStats.map((stat) => ({
            ...stat,
            newsletter_count: stat.newsletter_count || newslettersMap[stat.id]?.length || 0,
          }))
        : baseTags.map((tag: Tag) => ({
            ...tag,
            newsletter_count: newslettersMap[tag.id]?.length || 0,
          }));

    return { tagsWithCount, newslettersByTag: newslettersMap };
  }, [baseTags, tagUsageStats, newsletters]);

  // Compute loading and error states
  const isLoading = isLoadingTags || isLoadingTagUsage || isLoadingNewsletters;
  const error = tagUsageError?.message || newslettersError?.message || null;
  const isError = !!error;

  // Action handlers
  const setIsCreating = useCallback((creating: boolean) => {
    setState((prev) => ({ ...prev, isCreating: creating }));
  }, []);

  const setNewTag = useCallback((tag: Omit<TagCreate, 'user_id'>) => {
    setState((prev) => ({ ...prev, newTag: tag }));
  }, []);

  const setEditingTagId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, editingTagId: id }));
  }, []);

  const setEditTagData = useCallback((data: Partial<Tag>) => {
    setState((prev) => ({ ...prev, editTagData: data }));
  }, []);

  const resetCreateForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isCreating: false,
      newTag: { ...DEFAULT_NEW_TAG },
    }));
  }, []);

  const resetEditForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      editingTagId: null,
      editTagData: {},
    }));
  }, []);

  const handleCreateTag = useCallback(async () => {
    if (!state.newTag.name.trim()) return;

    try {
      await createTag({
        ...state.newTag,
        name: state.newTag.name.trim(),
      });

      resetCreateForm();

      // Invalidate all relevant queries
      await batchInvalidate([
        { queryKey: queryKeyFactory.tags.all() },
        { queryKey: queryKeyFactory.newsletters.all() },
        { queryKey: queryKeyFactory.newsletters.inbox() },
        { queryKey: queryKeyFactory.newsletters.readingQueue() },
      ]);

      if (showToasts) {
        toast.success('Tag created successfully');
      }
    } catch (error) {
      log.error('Failed to create tag', {
        component: 'useTagsPage',
        action: 'createTag',
        tagName: state.newTag.name,
        error,
      });
      if (showToasts) {
        toast.error('Failed to create tag');
      }
    }
  }, [state.newTag, createTag, resetCreateForm, batchInvalidate, showToasts, log]);

  const handleUpdateTag = useCallback(async () => {
    if (!state.editingTagId || !state.editTagData.name?.trim()) {
      resetEditForm();
      return;
    }

    try {
      await updateTag({
        id: state.editingTagId,
        ...state.editTagData,
        name: state.editTagData.name.trim(),
      });

      resetEditForm();

      // Invalidate all relevant queries
      await batchInvalidate([
        { queryKey: queryKeyFactory.tags.all() },
        { queryKey: queryKeyFactory.newsletters.all() },
        { queryKey: queryKeyFactory.newsletters.inbox() },
        { queryKey: queryKeyFactory.newsletters.readingQueue() },
      ]);

      if (showToasts) {
        toast.success('Tag updated successfully');
      }
    } catch (error) {
      log.error('Failed to update tag', {
        component: 'useTagsPage',
        action: 'updateTag',
        tagId: state.editingTagId,
        error,
      });
      if (showToasts) {
        toast.error('Failed to update tag');
      }
    }
  }, [
    state.editingTagId,
    state.editTagData,
    updateTag,
    resetEditForm,
    batchInvalidate,
    showToasts,
    log,
  ]);

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      if (
        !window.confirm(
          'Are you sure you want to delete this tag? This will remove it from all newsletters.'
        )
      ) {
        return;
      }

      try {
        await deleteTag(tagId);

        // Invalidate all relevant queries
        await batchInvalidate([
          { queryKey: queryKeyFactory.tags.all() },
          { queryKey: queryKeyFactory.newsletters.all() },
          { queryKey: queryKeyFactory.newsletters.inbox() },
          { queryKey: queryKeyFactory.newsletters.readingQueue() },
        ]);

        if (showToasts) {
          toast.success('Tag deleted successfully');
        }
      } catch (error) {
        log.error('Failed to delete tag', {
          component: 'useTagsPage',
          action: 'deleteTag',
          tagId,
          error,
        });
        if (showToasts) {
          toast.error('Failed to delete tag');
        }
      }
    },
    [deleteTag, batchInvalidate, showToasts, log]
  );

  const refreshData = useCallback(async () => {
    try {
      await batchInvalidate([
        { queryKey: queryKeyFactory.tags.all() },
        { queryKey: queryKeyFactory.newsletters.all() },
        { queryKey: queryKeyFactory.tags.usageStats('all') },
      ]);
      await refetchTags();
    } catch (error) {
      log.error('Failed to refresh tags page data', {
        component: 'useTagsPage',
        action: 'refreshData',
        error,
      });
    }
  }, [batchInvalidate, refetchTags, log]);

  // Refresh data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    // State
    ...state,

    // Data
    tags: tagsWithCount,
    tagNewsletters: newslettersByTag,
    newsletters,

    // Loading states
    isLoading,
    isLoadingTags,
    isLoadingNewsletters,
    isLoadingTagUsage,

    // Error states
    error,
    isError,

    // Mutation states
    isCreatingTag,
    isUpdatingTag,
    isDeletingTag,

    // Actions
    setIsCreating,
    setNewTag,
    setEditingTagId,
    setEditTagData,
    handleCreateTag,
    handleUpdateTag,
    handleDeleteTag,
    resetCreateForm,
    resetEditForm,

    // Refresh
    refreshData,
  };
}
