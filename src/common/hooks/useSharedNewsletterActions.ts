import { useCallback } from "react";
import { useNewsletters } from "./useNewsletters";
import { useReadingQueue } from "./useReadingQueue";
import { useErrorHandling } from "./useErrorHandling";
import {
  useNewsletterLoadingStates,
  useBulkLoadingStates,
} from "./useLoadingStates";
import { useToastActions } from "@common/contexts/ToastContext";
import {
  createSharedNewsletterHandlers,
  NewsletterActionHandlers,
} from "@common/utils/newsletterActionHandlers";
import { useAuth } from "@common/contexts";
import {
  ERROR_CODES,
  getErrorMessage,
  createErrorWithCode,
} from "@common/constants/errorMessages";
import type { NewsletterWithRelations } from "@common/types";

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

export const useSharedNewsletterActions = (
  options: UseSharedNewsletterActionsOptions = {},
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
  const {
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkArchive,
    bulkUnarchive,
    bulkDeleteNewsletters,
    updateNewsletterTags,
  } = useNewsletters();

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
        await markAsRead(id);
        if (showToasts) {
          toastSuccess("Newsletter marked as read");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [markAsRead, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    markAsUnread: useCallback(
      async (id: string): Promise<void> => {
        await markAsUnread(id);
        if (showToasts) {
          toastSuccess("Newsletter marked as unread");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [markAsUnread, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    toggleLike: useCallback(
      async (id: string): Promise<void> => {
        await toggleLike(id);
        if (showToasts) {
          toastSuccess("Newsletter like toggled");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [toggleLike, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    toggleArchive: useCallback(
      async (id: string): Promise<void> => {
        await toggleArchive(id);
        if (showToasts) {
          toastSuccess("Newsletter archive status toggled");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [toggleArchive, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    deleteNewsletter: useCallback(
      async (id: string): Promise<void> => {
        await deleteNewsletter(id);
        if (showToasts) {
          toastSuccess("Newsletter deleted");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [deleteNewsletter, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    toggleInQueue: useCallback(
      async (id: string): Promise<void> => {
        await toggleInQueue(id);
        if (showToasts) {
          toastSuccess("Reading queue updated");
        }
        onSuccess?.();
      },
      [toggleInQueue, showToasts, toastSuccess, onSuccess],
    ),

    updateTags: useCallback(
      async (id: string, tagIds: string[]): Promise<void> => {
        if (!user?.id) {
          throw createErrorWithCode(ERROR_CODES.AUTH_REQUIRED);
        }

        if (!id) {
          throw createErrorWithCode(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            "Newsletter ID is required",
          );
        }

        if (!Array.isArray(tagIds)) {
          throw createErrorWithCode(
            ERROR_CODES.INVALID_TAG_IDS,
            "Tag IDs must be an array",
          );
        }

        await updateNewsletterTags(id, tagIds);
        if (showToasts) {
          toastSuccess("Newsletter tags updated");
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [
        updateNewsletterTags,
        user?.id,
        showToasts,
        toastSuccess,
        onSuccess,
        onFilterChange,
      ],
    ),

    bulkMarkAsRead: useCallback(
      async (ids: string[]) => {
        await bulkMarkAsRead(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters marked as read`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [bulkMarkAsRead, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    bulkMarkAsUnread: useCallback(
      async (ids: string[]) => {
        await bulkMarkAsUnread(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters marked as unread`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [bulkMarkAsUnread, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    bulkArchive: useCallback(
      async (ids: string[]) => {
        await bulkArchive(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters archived`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [bulkArchive, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    bulkUnarchive: useCallback(
      async (ids: string[]) => {
        await bulkUnarchive(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters unarchived`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [bulkUnarchive, showToasts, toastSuccess, onSuccess, onFilterChange],
    ),

    bulkDelete: useCallback(
      async (ids: string[]) => {
        await bulkDeleteNewsletters(ids);
        if (showToasts) {
          toastSuccess(`${ids.length} newsletters deleted`);
        }
        onSuccess?.();
        onFilterChange?.();
      },
      [
        bulkDeleteNewsletters,
        showToasts,
        toastSuccess,
        onSuccess,
        onFilterChange,
      ],
    ),
  };

  // Create shared handlers with options
  const sharedHandlers = createSharedNewsletterHandlers(handlers, options);

  // Individual action handlers with enhanced error handling and loading states
  const handleMarkAsRead = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.markAsRead(id, actionOptions);
    },
    [sharedHandlers],
  );

  const handleMarkAsUnread = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.markAsUnread(id, actionOptions);
    },
    [sharedHandlers],
  );

  const handleToggleLike = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleLike(newsletter, actionOptions);
    },
    [sharedHandlers],
  );

  const handleToggleArchive = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleArchive(newsletter, actionOptions);
    },
    [sharedHandlers],
  );

  const handleDeleteNewsletter = useCallback(
    async (id: string, actionOptions?: UseSharedNewsletterActionsOptions) => {
      return sharedHandlers.deleteNewsletter(id, actionOptions);
    },
    [sharedHandlers],
  );

  const handleToggleInQueue = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      isInQueue: boolean,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleInQueue(newsletter, isInQueue, actionOptions);
    },
    [sharedHandlers],
  );

  const handleUpdateTags = useCallback(
    async (
      id: string,
      tagIds: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      try {
        const result = await sharedHandlers.updateTags(
          id,
          tagIds,
          actionOptions,
        );
        actionOptions?.onSuccess?.();
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : getErrorMessage(ERROR_CODES.TAG_UPDATE_FAILED);
        actionOptions?.onError?.(
          error instanceof Error ? error : new Error(errorMessage),
        );
        throw error;
      }
    },
    [sharedHandlers],
  );

  // Bulk action handlers
  const handleBulkMarkAsRead = useCallback(
    async (
      ids: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.bulkMarkAsRead(ids, actionOptions);
    },
    [sharedHandlers],
  );

  const handleBulkMarkAsUnread = useCallback(
    async (
      ids: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.bulkMarkAsUnread(ids, actionOptions);
    },
    [sharedHandlers],
  );

  const handleBulkArchive = useCallback(
    async (
      ids: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.bulkArchive(ids, actionOptions);
    },
    [sharedHandlers],
  );

  const handleBulkUnarchive = useCallback(
    async (
      ids: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.bulkUnarchive(ids, actionOptions);
    },
    [sharedHandlers],
  );

  const handleBulkDelete = useCallback(
    async (
      ids: string[],
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.bulkDelete(ids, actionOptions);
    },
    [sharedHandlers],
  );

  // Specialized handlers for reading queue operations
  const handleRemoveFromQueue = useCallback(
    async (
      queueItemId: string,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      try {
        await removeFromQueue(queueItemId);
        if (actionOptions?.showToasts !== false) {
          // Toast is handled by removeFromQueue
        }
        actionOptions?.onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        actionOptions?.onError?.(
          error instanceof Error ? error : new Error(errorMessage),
        );
        throw error;
      }
    },
    [removeFromQueue],
  );

  const handleAddToQueue = useCallback(
    async (
      newsletterId: string,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      try {
        await addToQueue(newsletterId);
        if (actionOptions?.showToasts !== false) {
          // Toast is handled by addToQueue
        }
        actionOptions?.onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        actionOptions?.onError?.(
          error instanceof Error ? error : new Error(errorMessage),
        );
        throw error;
      }
    },
    [addToQueue],
  );

  // Toggle read/unread based on current state
  const handleToggleRead = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      if (newsletter.is_read) {
        return handleMarkAsUnread(newsletter.id, actionOptions);
      } else {
        return handleMarkAsRead(newsletter.id, actionOptions);
      }
    },
    [handleMarkAsRead, handleMarkAsUnread],
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
        onUpdateTags: (tagIds: string[]) =>
          handleUpdateTags(newsletter.id, tagIds),
      };
    },
    [
      handleToggleLike,
      handleToggleArchive,
      handleToggleRead,
      handleDeleteNewsletter,
      handleToggleInQueue,
      handleUpdateTags,
    ],
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
    isMarkingAsRead: enableLoadingStates
      ? newsletterLoadingStates.isLoading("markAsRead")
      : false,
    isMarkingAsUnread: enableLoadingStates
      ? newsletterLoadingStates.isLoading("markAsUnread")
      : false,
    isTogglingLike: enableLoadingStates
      ? newsletterLoadingStates.isLoading("toggleLike")
      : false,
    isDeletingNewsletter: enableLoadingStates
      ? newsletterLoadingStates.isLoading("deleteNewsletter")
      : false,
    isUpdatingTags: enableLoadingStates
      ? newsletterLoadingStates.isLoading("updateTags")
      : false,

    // Bulk loading states
    isBulkMarkingAsRead: enableLoadingStates
      ? bulkLoadingStates.isBulkMarkingAsRead
      : false,
    isBulkMarkingAsUnread: enableLoadingStates
      ? bulkLoadingStates.isBulkMarkingAsUnread
      : false,
    isBulkArchiving: enableLoadingStates
      ? bulkLoadingStates.isBulkArchiving
      : false,
    isBulkUnarchiving: enableLoadingStates
      ? bulkLoadingStates.isBulkUnarchiving
      : false,
    isBulkDeletingNewsletters: enableLoadingStates
      ? bulkLoadingStates.isBulkDeleting
      : false,

    // Enhanced loading state helpers
    isNewsletterLoading: newsletterLoadingStates.isNewsletterLoading,
    isAnyNewsletterLoading: newsletterLoadingStates.isAnyNewsletterLoading,
    isBulkActionInProgress: enableLoadingStates
      ? bulkLoadingStates.isBulkActionInProgress
      : false,

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
