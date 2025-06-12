import { useCallback } from "react";
import { useNewsletters } from "./useNewsletters";
import { useReadingQueue } from "./useReadingQueue";
import {
  createSharedNewsletterHandlers,
  NewsletterActionHandlers,
} from "@common/utils/newsletterActionHandlers";
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
    // Loading states
    isMarkingAsRead,
    isMarkingAsUnread,
    isDeletingNewsletter,
    isBulkMarkingAsRead,
    isBulkMarkingAsUnread,
    isBulkArchiving,
    isBulkUnarchiving,
    isBulkDeletingNewsletters,
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

    toggleArchive: useCallback(
      async (id: string, archive?: boolean) => {
        await toggleArchive(id, archive ?? true);
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

    updateTags: useCallback(async (id: string, tagIds: string[]) => {
      // For now, this needs to be implemented or imported from elsewhere
      console.warn("updateTags not implemented in useNewsletters", {
        id,
        tagIds,
      });
      throw new Error("updateTags not available");
    }, []),

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

  const handleToggleArchive = useCallback(
    async (
      newsletter: NewsletterWithRelations,
      archive?: boolean,
      actionOptions?: UseSharedNewsletterActionsOptions,
    ) => {
      return sharedHandlers.toggleArchive(newsletter, archive, actionOptions);
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
      return sharedHandlers.updateTags(id, tagIds, actionOptions);
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

    // Loading states
    isMarkingAsRead,
    isMarkingAsUnread,
    isDeletingNewsletter,
    isBulkMarkingAsRead,
    isBulkMarkingAsUnread,
    isBulkArchiving,
    isBulkUnarchiving,
    isBulkDeletingNewsletters,

    // Create handlers with specific options
    withOptions: sharedHandlers.withOptions.bind(sharedHandlers),
  };
};
