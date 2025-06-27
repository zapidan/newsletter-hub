import { useToastActions } from '@common/contexts/ToastContext';
import {
  createSharedNewsletterHandlers,
  NewsletterActionHandlers,
} from '@common/utils/newsletterActionHandlers';
import { useCallback } from 'react';
import { useErrorHandling } from './useErrorHandling';
import { useBulkLoadingStates, useNewsletterLoadingStates } from './useLoadingStates';
import { useReadingQueue } from './useReadingQueue';

import { createErrorWithCode, ERROR_CODES, getErrorMessage } from '@common/constants/errorMessages';
import { useAuth } from '@common/contexts';
import type { NewsletterWithRelations } from '@common/types';
import type { UseMutateAsyncFunction } from '@tanstack/react-query';

export interface UseSharedNewsletterActionsOptions {
  showToasts?: boolean;
  optimisticUpdates?: boolean;
  enableErrorHandling?: boolean;
  enableLoadingStates?: boolean;
  preserveFilters?: boolean;
  onSuccess?: (newsletter?: NewsletterWithRelations) => void;
  onError?: (error: Error) => void;
  onFilterChange?: () => void;
}

export interface NewsletterMutations {
  markAsRead: UseMutateAsyncFunction<boolean, Error, string, any>;
  markAsUnread: UseMutateAsyncFunction<boolean, Error, string, any>;
  toggleLike: UseMutateAsyncFunction<boolean, Error, string, any>;
  toggleArchive: UseMutateAsyncFunction<boolean, Error, string, any>;
  deleteNewsletter: UseMutateAsyncFunction<boolean, Error, string, any>;
  toggleInQueue: UseMutateAsyncFunction<boolean, Error, string, any>;
  updateNewsletterTags: (id: string, tagIds: string[], options?: any) => Promise<void>;
  // Bulk operations are optional
  bulkMarkAsRead?: UseMutateAsyncFunction<boolean, Error, string[], any>;
  bulkMarkAsUnread?: UseMutateAsyncFunction<boolean, Error, string[], any>;
  bulkArchive?: UseMutateAsyncFunction<boolean, Error, string[], any>;
  bulkUnarchive?: UseMutateAsyncFunction<boolean, Error, string[], any>;
  bulkDeleteNewsletters?: UseMutateAsyncFunction<boolean, Error, string[], any>;
}

export const useSharedNewsletterActions = (
  mutations?: NewsletterMutations,
  options: UseSharedNewsletterActionsOptions = {}
) => {
  const {
    showToasts = true,
    enableErrorHandling = true,
    enableLoadingStates = true,
    onSuccess,
    onError,
    onFilterChange,
  } = options;

  const { user } = useAuth();
  const { addToQueue, removeFromQueue } = useReadingQueue();

  // New infrastructure hooks
  const { handleError } = useErrorHandling({
    enableToasts: showToasts && enableErrorHandling,
    enableLogging: true,
    onError,
  });

  const newsletterLoadingStates = useNewsletterLoadingStates();
  const bulkLoadingStates = useBulkLoadingStates();

  const { toastSuccess } = useToastActions();

  // Create the handler interface with enhanced actions
  const handlers: NewsletterActionHandlers = {
    markAsRead: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.markAsRead) {
          throw new Error('markAsRead mutation not available');
        }
        await mutations.markAsRead(id);
        if (showToasts) {
          toastSuccess('Newsletter marked as read');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.markAsRead, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    markAsUnread: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.markAsUnread) {
          throw new Error('markAsUnread mutation not available');
        }
        await mutations.markAsUnread(id);
        if (showToasts) {
          toastSuccess('Newsletter marked as unread');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.markAsUnread, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    toggleLike: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.toggleLike) {
          throw new Error('toggleLike mutation not available');
        }
        await mutations.toggleLike(id);
        if (showToasts) {
          toastSuccess('Newsletter like toggled');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.toggleLike, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    toggleArchive: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.toggleArchive) {
          throw new Error('toggleArchive mutation not available');
        }
        await mutations.toggleArchive(id);
        if (showToasts) {
          toastSuccess('Newsletter archive status toggled');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.toggleArchive, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    deleteNewsletter: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.deleteNewsletter) {
          throw new Error('deleteNewsletter mutation not available');
        }
        await mutations.deleteNewsletter(id);
        if (showToasts) {
          toastSuccess('Newsletter deleted');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.deleteNewsletter, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    toggleInQueue: useCallback(
      async (id: string): Promise<void> => {
        if (!mutations?.toggleInQueue) {
          throw new Error('toggleInQueue mutation not available');
        }
        await mutations.toggleInQueue(id);
        if (showToasts) {
          toastSuccess('Reading queue updated');
        }
        onSuccess?.();
      },
      [mutations?.toggleInQueue, showToasts, toastSuccess, onSuccess]
    ),

    updateTags: useCallback(
      async (id: string, tagIds: string[]): Promise<void> => {
        if (!user?.id) {
          throw createErrorWithCode(ERROR_CODES.AUTH_REQUIRED);
        }

        if (!id) {
          throw createErrorWithCode(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            'Newsletter ID is required'
          );
        }

        if (!Array.isArray(tagIds)) {
          throw createErrorWithCode(ERROR_CODES.INVALID_TAG_IDS, 'Tag IDs must be an array');
        }

        if (!mutations?.updateNewsletterTags) {
          throw new Error('updateNewsletterTags mutation not available');
        }

        await mutations.updateNewsletterTags(id, tagIds);
        if (showToasts) {
          toastSuccess('Newsletter tags updated');
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.updateNewsletterTags, user?.id, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    bulkMarkAsRead: useCallback(
      async (ids: string[]) => {
        if (!mutations?.bulkMarkAsRead) {
          throw new Error('bulkMarkAsRead mutation not available');
        }
        await mutations.bulkMarkAsRead(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters marked as read`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.bulkMarkAsRead, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    bulkMarkAsUnread: useCallback(
      async (ids: string[]) => {
        if (!mutations?.bulkMarkAsUnread) {
          throw new Error('bulkMarkAsUnread mutation not available');
        }
        await mutations.bulkMarkAsUnread(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters marked as unread`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.bulkMarkAsUnread, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    bulkArchive: useCallback(
      async (ids: string[]) => {
        if (!mutations?.bulkArchive) {
          throw new Error('bulkArchive mutation not available');
        }
        await mutations.bulkArchive(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters archived`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.bulkArchive, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    bulkUnarchive: useCallback(
      async (ids: string[]) => {
        if (!mutations?.bulkUnarchive) {
          throw new Error('bulkUnarchive mutation not available');
        }
        await mutations.bulkUnarchive(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters unarchived`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.bulkUnarchive, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),

    bulkDelete: useCallback(
      async (ids: string[]) => {
        if (!mutations?.bulkDeleteNewsletters) {
          throw new Error('bulkDeleteNewsletters mutation not available');
        }
        await mutations.bulkDeleteNewsletters(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters deleted`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [mutations?.bulkDeleteNewsletters, showToasts, toastSuccess, onSuccess, onFilterChange]
    ),
  };

  // Create shared handlers with options
  const sharedHandlers = createSharedNewsletterHandlers(handlers, options);

  // Individual action handlers with enhanced error handling and loading states
  const handleMarkAsRead = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.markAsRead(id, actionOptions);
    },
    [sharedHandlers]
  );

  const handleMarkAsUnread = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.markAsUnread(id, actionOptions);
    },
    [sharedHandlers]
  );

  const handleToggleLike = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions
    ) => {
      return sharedHandlers.toggleLike(newsletter, actionOptions);
    },
    [sharedHandlers]
  );

  const handleToggleArchive = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions
    ) => {
      return sharedHandlers.toggleArchive(newsletter, actionOptions);
    },
    [sharedHandlers]
  );

  const handleDeleteNewsletter = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.deleteNewsletter(id, actionOptions);
    },
    [sharedHandlers]
  );

  const handleToggleInQueue = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      isInQueue: boolean,
      actionOptions?: UseSharedNewsletterActionsOptions
    ) => {
      // Merge options with provided actionOptions
      const mergedOptions = {
        ...options,
        ...actionOptions,
      };

      try {
        // Call the handler with the full newsletter object and isInQueue state
        await sharedHandlers.toggleInQueue(newsletter, isInQueue, mergedOptions);

        // Call success callback if provided
        mergedOptions.onSuccess?.(newsletter);
      } catch (error) {
        // Call error callback if provided
        mergedOptions.onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    [sharedHandlers, options]
  );

  const handleUpdateTags = useCallback(
    async (id: string, tagIds: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      try {
        const result = await sharedHandlers.updateTags(id, tagIds, actionOptions);
        actionOptions?.onSuccess?.();
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : getErrorMessage(ERROR_CODES.TAG_UPDATE_FAILED);
        actionOptions?.onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [sharedHandlers]
  );

  // Bulk action handlers
  const handleBulkMarkAsRead = useCallback(
    async (ids: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.bulkMarkAsRead(ids, actionOptions);
    },
    [sharedHandlers]
  );

  const handleBulkMarkAsUnread = useCallback(
    async (ids: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.bulkMarkAsUnread(ids, actionOptions);
    },
    [sharedHandlers]
  );

  const handleBulkArchive = useCallback(
    async (ids: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.bulkArchive(ids, actionOptions);
    },
    [sharedHandlers]
  );

  const handleBulkUnarchive = useCallback(
    async (ids: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.bulkUnarchive(ids, actionOptions);
    },
    [sharedHandlers]
  );

  const handleBulkDelete = useCallback(
    async (ids: string[], actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.bulkDelete(ids, actionOptions);
    },
    [sharedHandlers]
  );

  // Specialized handlers for reading queue operations
  const handleRemoveFromQueue = useCallback(
    async (queueItemId: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      try {
        await removeFromQueue(queueItemId);
        if (actionOptions?.showToasts !== false) {
          // Toast is handled by removeFromQueue
        }
        actionOptions?.onSuccess?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        actionOptions?.onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [removeFromQueue]
  );

  const handleAddToQueue = useCallback(
    async (newsletterId: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      try {
        await addToQueue(newsletterId);
        if (actionOptions?.showToasts !== false) {
          // Toast is handled by addToQueue
        }
        actionOptions?.onSuccess?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        actionOptions?.onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [addToQueue]
  );

  // Toggle read/unread based on current state
  const handleToggleRead = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions
    ) => {
      if (newsletter.is_read) {
        return handleMarkAsUnread(newsletter.id, actionOptions);
      } else {
        return handleMarkAsRead(newsletter.id, actionOptions);
      }
    },
    [handleMarkAsRead, handleMarkAsUnread]
  );

  // Newsletter row action handlers (for use in newsletter lists)
  const handleNewsletterRowActions = useCallback(
    (newsletter: NewsletterWithRelations, isInQueue: boolean = false) => {
      return {
        onToggleLike: () => handleToggleLike(newsletter),
        onToggleArchive: () => handleToggleArchive(newsletter),
        onToggleRead: () => handleToggleRead(newsletter),
        onTrash: () => handleDeleteNewsletter(newsletter.id),
        onToggleQueue: () => handleToggleInQueue(newsletter, isInQueue),
        onUpdateTags: (tagIds: string[]) => handleUpdateTags(newsletter.id, tagIds),
      };
    },
    [
      handleToggleLike,
      handleToggleArchive,
      handleToggleRead,
      handleDeleteNewsletter,
      handleToggleInQueue,
      handleUpdateTags,
    ]
  );

  return {
    // Individual actions
    handleMarkAsRead,
    handleMarkAsUnread,
    handleToggleLike,
    handleToggleArchive,
    handleDeleteNewsletter,
    handleToggleInQueue,
    handleUpdateTags,
    handleToggleRead,

    // Bulk actions
    handleBulkMarkAsRead,
    handleBulkMarkAsUnread,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkDelete,

    // Reading queue specific
    handleRemoveFromQueue,
    handleAddToQueue,

    // Utility
    handleNewsletterRowActions,

    // Enhanced loading states
    isMarkingAsRead: enableLoadingStates ? newsletterLoadingStates.isLoading('markAsRead') : false,
    isMarkingAsUnread: enableLoadingStates
      ? newsletterLoadingStates.isLoading('markAsUnread')
      : false,
    isTogglingLike: enableLoadingStates ? newsletterLoadingStates.isLoading('toggleLike') : false,
    isDeletingNewsletter: enableLoadingStates
      ? newsletterLoadingStates.isLoading('deleteNewsletter')
      : false,
    isUpdatingTags: enableLoadingStates ? newsletterLoadingStates.isLoading('updateTags') : false,

    // Bulk loading states
    isBulkMarkingAsRead: enableLoadingStates ? bulkLoadingStates.isBulkMarkingAsRead : false,
    isBulkMarkingAsUnread: enableLoadingStates ? bulkLoadingStates.isBulkMarkingAsUnread : false,
    isBulkArchiving: enableLoadingStates ? bulkLoadingStates.isBulkArchiving : false,
    isBulkUnarchiving: enableLoadingStates ? bulkLoadingStates.isBulkUnarchiving : false,
    isBulkDeletingNewsletters: enableLoadingStates ? bulkLoadingStates.isBulkDeleting : false,

    // Enhanced loading state helpers
    isNewsletterLoading: newsletterLoadingStates.isNewsletterLoading,
    isAnyNewsletterLoading: newsletterLoadingStates.isAnyNewsletterLoading,
    isBulkActionInProgress: enableLoadingStates ? bulkLoadingStates.isBulkActionInProgress : false,

    // Error handling
    // Enhanced loading state helpers
    handleError: enableErrorHandling
      ? handleError
      : (error: unknown) => {
        throw error;
      },
    lastError: enableErrorHandling ? undefined : undefined, // Could expose error state if needed

    // Create handlers with specific options
    withOptions: sharedHandlers.withOptions.bind(sharedHandlers),
  };
};
