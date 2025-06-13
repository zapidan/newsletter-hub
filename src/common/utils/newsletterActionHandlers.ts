import { toast } from "react-hot-toast";
import { getCacheManager } from "./cacheUtils";
import type { NewsletterWithRelations } from "@common/types";

export interface NewsletterActionHandlers {
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  deleteNewsletter: (id: string) => Promise<void>;
  toggleInQueue: (id: string) => Promise<void>;
  updateTags: (id: string, tagIds: string[]) => Promise<void>;
  bulkMarkAsRead: (ids: string[]) => Promise<void>;
  bulkMarkAsUnread: (ids: string[]) => Promise<void>;
  bulkArchive: (ids: string[]) => Promise<void>;
  bulkUnarchive: (ids: string[]) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
}

export interface NewsletterActionOptions {
  showToasts?: boolean;
  optimisticUpdates?: boolean;
  onSuccess?: (newsletter?: NewsletterWithRelations) => void;
  onError?: (error: Error) => void;
}

export class SharedNewsletterActionHandlers {
  private cacheManager: ReturnType<typeof getCacheManager>;
  private handlers: NewsletterActionHandlers;
  private defaultOptions: NewsletterActionOptions = {
    showToasts: true,
    optimisticUpdates: true,
  };

  constructor(
    handlers: NewsletterActionHandlers,
    options?: Partial<NewsletterActionOptions>,
  ) {
    this.handlers = handlers;
    this.cacheManager = getCacheManager();
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  private async withOptimisticUpdate<T>(
    newsletterId: string,
    updates: Partial<NewsletterWithRelations>,
    operation: () => Promise<T>,
    operationType: string,
    options: NewsletterActionOptions = {},
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let originalData: NewsletterWithRelations | null = null;

    try {
      // Apply optimistic update if enabled
      if (opts.optimisticUpdates) {
        originalData = await this.cacheManager.optimisticUpdate(
          newsletterId,
          updates,
          operationType,
        );
      }

      // Perform the actual operation
      const result = await operation();

      // Invalidate related queries to ensure consistency
      await this.cacheManager.invalidateRelatedQueries(
        [newsletterId],
        operationType,
      );

      opts.onSuccess?.();
      return result;
    } catch (error) {
      // Revert optimistic update on error
      if (opts.optimisticUpdates && originalData) {
        this.cacheManager.updateNewsletterInCache({
          id: newsletterId,
          updates: originalData,
        });
      }

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (opts.showToasts) {
        toast.error(
          `Failed to ${operationType.replace("-", " ")}: ${errorMessage}`,
        );
      }

      opts.onError?.(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  private async withBulkOptimisticUpdate<T>(
    newsletterIds: string[],
    updates: Partial<NewsletterWithRelations>,
    operation: () => Promise<T>,
    operationType: string,
    options: NewsletterActionOptions = {},
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Apply bulk optimistic updates if enabled
      if (opts.optimisticUpdates) {
        this.cacheManager.batchUpdateNewsletters(
          newsletterIds.map((id) => ({ id, updates })),
        );
      }

      // Perform the actual operation
      const result = await operation();

      // Invalidate related queries to ensure consistency
      await this.cacheManager.invalidateRelatedQueries(
        newsletterIds,
        operationType,
      );

      opts.onSuccess?.();
      return result;
    } catch (error) {
      // For bulk operations, we invalidate the entire cache on error
      // as reverting individual optimistic updates is complex
      if (opts.optimisticUpdates) {
        await this.cacheManager.invalidateRelatedQueries(
          newsletterIds,
          "error-recovery",
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (opts.showToasts) {
        toast.error(
          `Failed to ${operationType.replace("-", " ")}: ${errorMessage}`,
        );
      }

      opts.onError?.(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  async markAsRead(
    newsletterId: string,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withOptimisticUpdate(
      newsletterId,
      { is_read: true },
      () => this.handlers.markAsRead(newsletterId),
      "mark-read",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success("Marked as read");
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async markAsUnread(
    newsletterId: string,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withOptimisticUpdate(
      newsletterId,
      { is_read: false },
      () => this.handlers.markAsUnread(newsletterId),
      "mark-unread",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success("Marked as unread");
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async toggleLike(
    newsletter: NewsletterWithRelations,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    const newLikedState = !newsletter.is_liked;
    return this.withOptimisticUpdate(
      newsletter.id,
      { is_liked: newLikedState },
      () => this.handlers.toggleLike(newsletter.id),
      "toggle-like",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(
              newLikedState ? "Added to liked" : "Removed from liked",
            );
          }
          options?.onSuccess?.(newsletter);
        },
      },
    );
  }

  async toggleBookmark(
    newsletter: NewsletterWithRelations,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    const newBookmarkedState = !newsletter.is_bookmarked;
    return this.withOptimisticUpdate(
      newsletter.id,
      { is_bookmarked: newBookmarkedState },
      () => this.handlers.toggleBookmark(newsletter.id),
      "toggle-bookmark",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(
              newBookmarkedState
                ? "Added to bookmarks"
                : "Removed from bookmarks",
            );
          }
          options?.onSuccess?.(newsletter);
        },
      },
    );
  }

  async toggleArchive(
    newsletter: NewsletterWithRelations,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    const newArchivedState = !newsletter.is_archived;
    return this.withOptimisticUpdate(
      newsletter.id,
      { is_archived: newArchivedState },
      () => this.handlers.toggleArchive(newsletter.id),
      newArchivedState ? "archive" : "unarchive",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(
              newArchivedState
                ? "Newsletter archived"
                : "Newsletter unarchived",
            );
          }
          options?.onSuccess?.(newsletter);
        },
      },
    );
  }

  async deleteNewsletter(
    newsletterId: string,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    if (
      !window.confirm(
        "Are you sure? This action is final and cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await this.handlers.deleteNewsletter(newsletterId);

      // Remove from cache immediately
      await this.cacheManager.invalidateRelatedQueries(
        [newsletterId],
        "delete",
      );

      if (options?.showToasts !== false) {
        toast.success("Newsletter deleted permanently");
      }
      options?.onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (options?.showToasts !== false) {
        toast.error(`Failed to delete newsletter: ${errorMessage}`);
      }
      options?.onError?.(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    }
  }

  async toggleInQueue(
    newsletter: NewsletterWithRelations,
    options?: NewsletterActionOptions,
  ): Promise<void> {
    const newQueueState = !newsletter.is_bookmarked;
    return this.withOptimisticUpdate(
      newsletter.id,
      { is_bookmarked: newQueueState },
      () => this.handlers.toggleInQueue(newsletter.id),
      "toggle-queue",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(
              newQueueState
                ? "Added to reading queue"
                : "Removed from reading queue",
            );
          }
          options?.onSuccess?.(newsletter);
        },
      },
    );
  }

  async updateTags(
    newsletterId: string,
    tagIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    try {
      await this.handlers.updateTags(newsletterId, tagIds);

      // Invalidate tag-related queries
      await this.cacheManager.invalidateRelatedQueries(
        [newsletterId],
        "tag-update",
      );

      if (options?.showToasts !== false) {
        toast.success("Tags updated successfully");
      }
      options?.onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (options?.showToasts !== false) {
        toast.error(`Failed to update tags: ${errorMessage}`);
      }
      options?.onError?.(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    }
  }

  // Bulk operations
  async bulkMarkAsRead(
    newsletterIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withBulkOptimisticUpdate(
      newsletterIds,
      { is_read: true },
      () => this.handlers.bulkMarkAsRead(newsletterIds),
      "bulk-mark-read",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(`Marked ${newsletterIds.length} newsletters as read`);
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async bulkMarkAsUnread(
    newsletterIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withBulkOptimisticUpdate(
      newsletterIds,
      { is_read: false },
      () => this.handlers.bulkMarkAsUnread(newsletterIds),
      "bulk-mark-unread",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(
              `Marked ${newsletterIds.length} newsletters as unread`,
            );
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async bulkArchive(
    newsletterIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withBulkOptimisticUpdate(
      newsletterIds,
      { is_archived: true },
      () => this.handlers.bulkArchive(newsletterIds),
      "bulk-archive",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(`Archived ${newsletterIds.length} newsletters`);
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async bulkUnarchive(
    newsletterIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    return this.withBulkOptimisticUpdate(
      newsletterIds,
      { is_archived: false },
      () => this.handlers.bulkUnarchive(newsletterIds),
      "bulk-unarchive",
      {
        ...options,
        onSuccess: () => {
          if (options?.showToasts !== false) {
            toast.success(`Unarchived ${newsletterIds.length} newsletters`);
          }
          options?.onSuccess?.();
        },
      },
    );
  }

  async bulkDelete(
    newsletterIds: string[],
    options?: NewsletterActionOptions,
  ): Promise<void> {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${newsletterIds.length} newsletters? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await this.handlers.bulkDelete(newsletterIds);

      // Invalidate related queries
      await this.cacheManager.invalidateRelatedQueries(
        newsletterIds,
        "bulk-delete",
      );

      if (options?.showToasts !== false) {
        toast.success(
          `Deleted ${newsletterIds.length} newsletters permanently`,
        );
      }
      options?.onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (options?.showToasts !== false) {
        toast.error(`Failed to delete newsletters: ${errorMessage}`);
      }
      options?.onError?.(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    }
  }

  // Utility method to create handlers with specific options
  withOptions(
    options: Partial<NewsletterActionOptions>,
  ): SharedNewsletterActionHandlers {
    return new SharedNewsletterActionHandlers(this.handlers, {
      ...this.defaultOptions,
      ...options,
    });
  }
}

// Factory function to create shared handlers
export function createSharedNewsletterHandlers(
  handlers: NewsletterActionHandlers,
  options?: Partial<NewsletterActionOptions>,
): SharedNewsletterActionHandlers {
  return new SharedNewsletterActionHandlers(handlers, options);
}
