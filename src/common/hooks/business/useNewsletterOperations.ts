import { newsletterService } from "@common/services";
import { NewsletterWithRelations } from "@common/types";
import { useLogger } from "@common/utils/logger";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "react-hot-toast";

interface UseNewsletterOperationsOptions {
  onSuccess?: (operation: string, newsletter?: NewsletterWithRelations) => void;
  onError?: (operation: string, error: string) => void;
  showToasts?: boolean;
}

interface NewsletterOperationResult {
  success: boolean;
  error?: string;
  newsletter?: NewsletterWithRelations;
}

export function useNewsletterOperations(options: UseNewsletterOperationsOptions = {}) {
  const queryClient = useQueryClient();
  const log = useLogger();
  const { onSuccess, onError, showToasts = true } = options;

  // Utility function to invalidate related queries
  const invalidateRelatedQueries = useCallback(
    (newsletterIds?: string[]) => {
      const queriesToInvalidate = [
        queryKeyFactory.newsletters.all(),
        queryKeyFactory.newsletters.inbox(),
        queryKeyFactory.readingQueue.all(),
      ];

      if (newsletterIds) {
        newsletterIds.forEach(id => {
          queriesToInvalidate.push(queryKeyFactory.newsletters.detail(id));
        });
      }

      return Promise.all(
        queriesToInvalidate.map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      );
    },
    [queryClient]
  );

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsRead(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("markAsRead", result.newsletter);
        if (showToasts) {
          toast.success("Newsletter marked as read");
        }
      } else {
        onError?.("markAsRead", result.error || "Failed to mark as read");
        if (showToasts) {
          toast.error(result.error || "Failed to mark as read");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to mark newsletter as read", {
        component: "useNewsletterOperations",
        action: "markAsRead",
        error,
      });
      onError?.("markAsRead", errorMessage);
      if (showToasts) {
        toast.error("Failed to mark newsletter as read");
      }
    },
  });

  // Mark as unread mutation
  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsUnread(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("markAsUnread", result.newsletter);
        if (showToasts) {
          toast.success("Newsletter marked as unread");
        }
      } else {
        onError?.("markAsUnread", result.error || "Failed to mark as unread");
        if (showToasts) {
          toast.error(result.error || "Failed to mark as unread");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to mark newsletter as unread", {
        component: "useNewsletterOperations",
        action: "markAsUnread",
        error,
      });
      onError?.("markAsUnread", errorMessage);
      if (showToasts) {
        toast.error("Failed to mark newsletter as unread");
      }
    },
  });

  // Bulk mark as read mutation
  const bulkMarkAsReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Early return for empty array
      if (ids.length === 0) {
        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          errors: [],
        };
      }
      return newsletterService.bulkMarkAsRead(ids);
    },
    onSuccess: async (result, ids) => {
      await invalidateRelatedQueries(ids);

      if (result.success) {
        onSuccess?.("bulkMarkAsRead");
        if (showToasts) {
          toast.success(`Marked ${result.processedCount} newsletters as read`);
        }
      } else {
        const message = `Marked ${result.processedCount} as read, ${result.failedCount} failed`;
        onError?.("bulkMarkAsRead", message);
        if (showToasts) {
          toast.error(message);
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to bulk mark newsletters as read", {
        component: "useNewsletterOperations",
        action: "bulkMarkAsRead",
        error,
      });
      onError?.("bulkMarkAsRead", errorMessage);
      if (showToasts) {
        toast.error("Failed to mark newsletters as read");
      }
    },
  });

  // Bulk mark as unread mutation
  const bulkMarkAsUnreadMutation = useMutation({
    mutationFn: (ids: string[]) => newsletterService.bulkMarkAsUnread(ids),
    onSuccess: async (result, ids) => {
      await invalidateRelatedQueries(ids);

      if (result.success) {
        onSuccess?.("bulkMarkAsUnread");
        if (showToasts) {
          toast.success(`Marked ${result.processedCount} newsletters as unread`);
        }
      } else {
        const message = `Marked ${result.processedCount} as unread, ${result.failedCount} failed`;
        onError?.("bulkMarkAsUnread", message);
        if (showToasts) {
          toast.error(message);
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to bulk mark newsletters as unread", {
        component: "useNewsletterOperations",
        action: "bulkMarkAsUnread",
        error,
      });
      onError?.("bulkMarkAsUnread", errorMessage);
      if (showToasts) {
        toast.error("Failed to mark newsletters as unread");
      }
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleLike(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("toggleLike", result.newsletter);
        if (showToasts && result.newsletter) {
          const action = result.newsletter.is_liked ? "liked" : "unliked";
          toast.success(`Newsletter ${action}`);
        }
      } else {
        onError?.("toggleLike", result.error || "Failed to toggle like");
        if (showToasts) {
          toast.error(result.error || "Failed to toggle like");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to toggle newsletter like", {
        component: "useNewsletterOperations",
        action: "toggleLike",
        error,
      });
      onError?.("toggleLike", errorMessage);
      if (showToasts) {
        toast.error("Failed to toggle like");
      }
    },
  });

  // Toggle archive mutation
  const toggleArchiveMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleArchive(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("toggleArchive", result.newsletter);
        if (showToasts && result.newsletter) {
          const action = result.newsletter.is_archived ? "archived" : "unarchived";
          toast.success(`Newsletter ${action}`);
        }
      } else {
        onError?.("toggleArchive", result.error || "Failed to toggle archive");
        if (showToasts) {
          toast.error(result.error || "Failed to toggle archive");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to toggle newsletter archive", {
        component: "useNewsletterOperations",
        action: "toggleArchive",
        error,
      });
      onError?.("toggleArchive", errorMessage);
      if (showToasts) {
        toast.error("Failed to toggle archive");
      }
    },
  });

  // Add to reading queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: (id: string) => newsletterService.addToReadingQueue(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("addToQueue", result.newsletter);
        if (showToasts) {
          toast.success("Added to reading queue");
        }
      } else {
        onError?.("addToQueue", result.error || "Failed to add to reading queue");
        if (showToasts) {
          toast.error(result.error || "Failed to add to reading queue");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to add newsletter to reading queue", {
        component: "useNewsletterOperations",
        action: "addToQueue",
        error,
      });
      onError?.("addToQueue", errorMessage);
      if (showToasts) {
        toast.error("Failed to add to reading queue");
      }
    },
  });

  // Remove from reading queue mutation
  const removeFromQueueMutation = useMutation({
    mutationFn: (id: string) => newsletterService.removeFromReadingQueue(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("removeFromQueue");
        if (showToasts) {
          toast.success("Removed from reading queue");
        }
      } else {
        onError?.("removeFromQueue", result.error || "Failed to remove from reading queue");
        if (showToasts) {
          toast.error(result.error || "Failed to remove from reading queue");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to remove newsletter from reading queue", {
        component: "useNewsletterOperations",
        action: "removeFromQueue",
        error,
      });
      onError?.("removeFromQueue", errorMessage);
      if (showToasts) {
        toast.error("Failed to remove from reading queue");
      }
    },
  });

  const deleteNewsletterMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteNewsletter(id),
    onSuccess: async (result, id) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        onSuccess?.("deleteNewsletter");
        if (showToasts) {
          toast.success("Newsletter deleted successfully");
        }
      } else {
        onError?.("deleteNewsletter", result.error || "Failed to delete newsletter");
        if (showToasts) {
          toast.error(result.error || "Failed to delete newsletter");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to delete newsletter", {
        component: "useNewsletterOperations",
        action: "deleteNewsletter",
        error,
      });
      onError?.("deleteNewsletter", errorMessage);
      if (showToasts) {
        toast.error("Failed to delete newsletter");
      }
    },
  });

  const deleteNewsletter = useCallback(
    async (id: string): Promise<NewsletterOperationResult> => {
      if (!window.confirm("Are you sure you want to delete this newsletter?")) {
        return { success: false, error: "Deletion cancelled" };
      }

      try {
        const result = await deleteNewsletterMutation.mutateAsync(id);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete newsletter";
        return { success: false, error: errorMessage };
      }
    },
    [deleteNewsletterMutation],
  );

  // Update tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      newsletterService.updateTags(id, tagIds),
    onSuccess: async (result, { id }) => {
      if (result.success) {
        await invalidateRelatedQueries([id]);
        // Also invalidate tag-related queries
        await queryClient.invalidateQueries({
          queryKey: queryKeyFactory.tags.all()
        });
        onSuccess?.("updateTags", result.newsletter);
        if (showToasts) {
          toast.success("Tags updated");
        }
      } else {
        onError?.("updateTags", result.error || "Failed to update tags");
        if (showToasts) {
          toast.error(result.error || "Failed to update tags");
        }
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log.error("Failed to update newsletter tags", {
        component: "useNewsletterOperations",
        action: "updateTags",
        error,
      });
      onError?.("updateTags", errorMessage);
      if (showToasts) {
        toast.error("Failed to update tags");
      }
    },
  });

  return {
    // Single newsletter operations
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    markAsUnread: markAsUnreadMutation.mutateAsync,
    isMarkingAsUnread: markAsUnreadMutation.isPending,
    deleteNewsletter,
    isDeleting: deleteNewsletterMutation.isPending,
    deleteError: deleteNewsletterMutation.error,
    resetDeleteError: deleteNewsletterMutation.reset,

    // Bulk operations
    bulkMarkAsRead: bulkMarkAsReadMutation.mutateAsync,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    bulkMarkAsUnread: bulkMarkAsUnreadMutation.mutateAsync,
    isBulkMarkingAsUnread: bulkMarkAsUnreadMutation.isPending,

    // Like operations
    toggleLike: toggleLikeMutation.mutateAsync,
    isTogglingLike: toggleLikeMutation.isPending,

    // Archive operations
    toggleArchive: toggleArchiveMutation.mutateAsync,
    isTogglingArchive: toggleArchiveMutation.isPending,

    // Reading queue operations
    addToQueue: addToQueueMutation.mutateAsync,
    isAddingToQueue: addToQueueMutation.isPending,
    removeFromQueue: removeFromQueueMutation.mutateAsync,
    isRemovingFromQueue: removeFromQueueMutation.isPending,

    // Tag operations
    updateTags: updateTagsMutation.mutateAsync,
    isUpdatingTags: updateTagsMutation.isPending,

    // Error states
    errorMarkingAsRead: markAsReadMutation.error,
    errorMarkingAsUnread: markAsUnreadMutation.error,
    errorBulkMarkingAsRead: bulkMarkAsReadMutation.error,
    errorBulkMarkingAsUnread: bulkMarkAsUnreadMutation.error,
    errorTogglingLike: toggleLikeMutation.error,
    errorTogglingArchive: toggleArchiveMutation.error,
    errorAddingToQueue: addToQueueMutation.error,
    errorRemovingFromQueue: removeFromQueueMutation.error,
    errorUpdatingTags: updateTagsMutation.error,

    // Reset functions
    resetMarkAsReadError: markAsReadMutation.reset,
    resetMarkAsUnreadError: markAsUnreadMutation.reset,
    resetBulkMarkAsReadError: bulkMarkAsReadMutation.reset,
    resetBulkMarkAsUnreadError: bulkMarkAsUnreadMutation.reset,
    resetToggleLikeError: toggleLikeMutation.reset,
    resetToggleArchiveError: toggleArchiveMutation.reset,
    resetAddToQueueError: addToQueueMutation.reset,
    resetRemoveFromQueueError: removeFromQueueMutation.reset,
    resetUpdateTagsError: updateTagsMutation.reset,
  };
}
