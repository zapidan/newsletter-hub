import { useCallback } from "react";
import { useNewsletters } from "./useNewsletters";
import { useReadingQueue } from "./useReadingQueue";
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
  onSuccess?: (newsletter?: NewsletterWithRelations) => void;
  onError?: (error: Error) => void;
}

export const useSharedNewsletterActions = (
  options?: UseSharedNewsletterActionsOptions,
) => {
  const { user } = useAuth();
  const {
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleBookmark,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkArchive,
    bulkUnarchive,
    bulkDeleteNewsletters,
    updateNewsletterTags,
    // Loading states
    isMarkingAsRead,
    isMarkingAsUnread,
    isDeletingNewsletter,
    isTogglingLike,
    isTogglingBookmark,
    isBulkMarkingAsRead,
    isBulkMarkingAsUnread,
    isBulkArchiving,
    isBulkUnarchiving,
    isBulkDeletingNewsletters,
    isUpdatingTags,
    // Error states
    errorTogglingLike,
    errorTogglingBookmark,
    errorUpdatingTags,
  } = useNewsletters();

  const { addToQueue, removeFromQueue } = useReadingQueue();

  // Create the handler interface
  const handlers: NewsletterActionHandlers = {
    markAsRead: useCallback(
      async (id: string) => {
        await markAsRead(id);
      },
      [markAsRead],
    ),

    markAsUnread: useCallback(
      async (id: string) => {
        await markAsUnread(id);
      },
      [markAsUnread],
    ),

    toggleLike: useCallback(
      async (id: string) => {
        await toggleLike(id);
      },
      [toggleLike],
    ),

    toggleBookmark: useCallback(
      async (id: string) => {
        await toggleBookmark(id);
      },
      [toggleBookmark],
    ),

    toggleArchive: useCallback(
      async (id: string) => {
        await toggleArchive(id);
      },
      [toggleArchive],
    ),

    deleteNewsletter: useCallback(
      async (id: string) => {
        await deleteNewsletter(id);
      },
      [deleteNewsletter],
    ),

    toggleInQueue: useCallback(
      async (id: string) => {
        await toggleInQueue(id);
      },
      [toggleInQueue],
    ),

    updateTags: useCallback(
      async (id: string, tagIds: string[]) => {
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

        try {
          // Use the updateNewsletterTags function from the useNewsletters hook
          await updateNewsletterTags(id, tagIds);
        } catch (error) {
          console.error("Failed to update newsletter tags:", error);
          if (error instanceof Error && "code" in error) {
            throw error; // Re-throw errors with codes
          }
          throw createErrorWithCode(
            ERROR_CODES.TAG_UPDATE_FAILED,
            error instanceof Error ? error.message : "Unknown error occurred",
          );
        }
      },
      [updateNewsletterTags, user?.id],
    ),

    bulkMarkAsRead: useCallback(
      async (ids: string[]) => {
        await bulkMarkAsRead(ids);
      },
      [bulkMarkAsRead],
    ),

    bulkMarkAsUnread: useCallback(
      async (ids: string[]) => {
        await bulkMarkAsUnread(ids);
      },
      [bulkMarkAsUnread],
    ),

    bulkArchive: useCallback(
      async (ids: string[]) => {
        await bulkArchive(ids);
      },
      [bulkArchive],
    ),

    bulkUnarchive: useCallback(
      async (ids: string[]) => {
        await bulkUnarchive(ids);
      },
      [bulkUnarchive],
    ),

    bulkDelete: useCallback(
      async (ids: string[]) => {
        await bulkDeleteNewsletters(ids);
      },
      [bulkDeleteNewsletters],
    ),
  };

  // Create shared handlers with options
  const sharedHandlers = createSharedNewsletterHandlers(handlers, options);

  // Individual action handlers
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

  const handleToggleBookmark = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleBookmark(newsletter, actionOptions);
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
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleInQueue(newsletter, actionOptions);
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
    (newsletter: NewsletterWithRelations) => {
      return {
        onToggleLike: () => handleToggleLike(newsletter),
        onToggleBookmark: () => handleToggleBookmark(newsletter),
        onToggleArchive: () => handleToggleArchive(newsletter),
        onToggleRead: () => handleToggleRead(newsletter),
        onTrash: () => handleDeleteNewsletter(newsletter.id),
        onToggleQueue: () => handleToggleInQueue(newsletter),
        onUpdateTags: (tagIds: string[]) =>
          handleUpdateTags(newsletter.id, tagIds),
      };
    },
    [
      handleToggleLike,
      handleToggleBookmark,
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
    handleToggleBookmark,
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

    // Loading states
    isMarkingAsRead,
    isMarkingAsUnread,
    isTogglingLike,
    isTogglingBookmark,
    isDeletingNewsletter,
    isBulkMarkingAsRead,
    isBulkMarkingAsUnread,
    isBulkArchiving,
    isBulkUnarchiving,
    isBulkDeletingNewsletters,
    isUpdatingTags,

    // Error states
    errorTogglingLike,
    errorTogglingBookmark,
    errorUpdatingTags,

    // Create handlers with specific options
    withOptions: sharedHandlers.withOptions.bind(sharedHandlers),
  };
};
