import { BaseService } from "../base/BaseService";
import { readingQueueApi } from "@common/api/readingQueueApi";
import { newsletterApi } from "@common/api/newsletterApi";
import { ReadingQueueItem, NewsletterWithRelations } from "@common/types";
import { logger } from "@common/utils/logger";

export interface ReadingQueueOperationResult {
  success: boolean;
  item?: ReadingQueueItem;
  newsletter?: NewsletterWithRelations;
  error?: string;
}

export interface BulkReadingQueueOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

export interface ReadingQueueStats {
  totalItems: number;
  unreadItems: number;
  averageReadTime: number;
  oldestItem?: ReadingQueueItem;
  estimatedReadTime: number;
}

export interface ReadingQueueServiceOptions {
  maxQueueSize?: number;
  autoRemoveRead?: boolean;
  priorityOrdering?: boolean;
}

export class ReadingQueueService extends BaseService {
  private queueOptions: ReadingQueueServiceOptions;

  constructor(options: ReadingQueueServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.queueOptions = {
      maxQueueSize: 100,
      autoRemoveRead: true,
      priorityOrdering: true,
      ...options,
    };
  }

  /**
   * Get all items in reading queue
   */
  async getReadingQueue(): Promise<ReadingQueueItem[]> {
    return this.executeWithLogging(async () => {
      const items = await this.withRetry(
        () => readingQueueApi.getAll(),
        "getReadingQueue",
      );

      // Apply business logic for ordering
      return this.applyQueueOrdering(items);
    }, "getReadingQueue");
  }

  /**
   * Get reading queue with full newsletter details
   */
  async getReadingQueueWithDetails(): Promise<NewsletterWithRelations[]> {
    return this.executeWithLogging(async () => {
      const queueItems = await this.getReadingQueue();
      const newsletters: NewsletterWithRelations[] = [];

      // Fetch newsletter details for each queue item
      for (const item of queueItems) {
        try {
          const newsletter = await newsletterApi.getById(item.newsletter_id);
          if (newsletter) {
            newsletters.push(newsletter);
          }
        } catch (error) {
          logger.warn(
            "Failed to fetch newsletter details for queue item",
            {
              component: "ReadingQueueService",
              action: "get_queue_with_details",
              metadata: { newsletterId: item.newsletter_id },
            },
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }

      return newsletters;
    }, "getReadingQueueWithDetails");
  }

  /**
   * Add newsletter to reading queue
   */
  async addToQueue(newsletterId: string): Promise<ReadingQueueOperationResult> {
    this.validateString(newsletterId, "newsletter ID");

    return this.executeWithLogging(
      async () => {
        try {
          // Validate newsletter exists and is not archived
          const newsletter = await newsletterApi.getById(newsletterId);
          if (!newsletter) {
            return {
              success: false,
              error: "Newsletter not found",
            };
          }

          if (newsletter.is_archived) {
            return {
              success: false,
              error: "Cannot add archived newsletter to reading queue",
            };
          }

          // Check if already in queue
          const existingItems = await readingQueueApi.getAll();
          const alreadyInQueue = existingItems.find(
            (item) => item.newsletter_id === newsletterId,
          );

          if (alreadyInQueue) {
            return {
              success: false,
              error: "Newsletter is already in reading queue",
            };
          }

          // Check queue size limit
          if (existingItems.length >= this.queueOptions.maxQueueSize!) {
            return {
              success: false,
              error: `Reading queue is full (maximum ${this.queueOptions.maxQueueSize} items)`,
            };
          }

          const success = await this.withRetry(
            () => readingQueueApi.add(newsletterId),
            "addToQueue",
          );

          if (!success) {
            return {
              success: false,
              error: "Failed to add newsletter to reading queue",
            };
          }

          // Get the newly created queue item
          const updatedItems = await readingQueueApi.getAll();
          const newItem = updatedItems.find(
            (item) => item.newsletter_id === newsletterId,
          );

          return {
            success: true,
            item: newItem,
            newsletter,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
      "addToQueue",
      { newsletterId },
    );
  }

  /**
   * Remove newsletter from reading queue
   */
  async removeFromQueue(
    newsletterId: string,
  ): Promise<ReadingQueueOperationResult> {
    this.validateString(newsletterId, "newsletter ID");

    return this.executeWithLogging(
      async () => {
        try {
          // Check if item exists in queue
          const existingItems = await readingQueueApi.getAll();
          const queueItem = existingItems.find(
            (item) => item.newsletter_id === newsletterId,
          );

          if (!queueItem) {
            return {
              success: false,
              error: "Newsletter is not in reading queue",
            };
          }

          const success = await this.withRetry(
            () => readingQueueApi.remove(newsletterId),
            "removeFromQueue",
          );

          if (!success) {
            return {
              success: false,
              error: "Failed to remove newsletter from reading queue",
            };
          }

          return {
            success: true,
            item: queueItem,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
      "removeFromQueue",
      { newsletterId },
    );
  }

  /**
   * Bulk add newsletters to reading queue
   */
  async bulkAddToQueue(
    newsletterIds: string[],
  ): Promise<BulkReadingQueueOperationResult> {
    this.validateArray(newsletterIds, "newsletter IDs", { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results: Array<{ id: string; success: boolean; error?: string }> =
          [];

        for (const newsletterId of newsletterIds) {
          try {
            const result = await this.addToQueue(newsletterId);
            results.push({
              id: newsletterId,
              success: result.success,
              error: result.error,
            });
          } catch (error) {
            results.push({
              id: newsletterId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const processedCount = results.filter((r) => r.success).length;
        const failedCount = results.length - processedCount;
        const errors = results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, error: r.error || "Unknown error" }));

        return {
          success: failedCount === 0,
          processedCount,
          failedCount,
          errors,
        };
      },
      "bulkAddToQueue",
      { count: newsletterIds.length },
    );
  }

  /**
   * Bulk remove newsletters from reading queue
   */
  async bulkRemoveFromQueue(
    newsletterIds: string[],
  ): Promise<BulkReadingQueueOperationResult> {
    this.validateArray(newsletterIds, "newsletter IDs", { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results: Array<{ id: string; success: boolean; error?: string }> =
          [];

        for (const newsletterId of newsletterIds) {
          try {
            const result = await this.removeFromQueue(newsletterId);
            results.push({
              id: newsletterId,
              success: result.success,
              error: result.error,
            });
          } catch (error) {
            results.push({
              id: newsletterId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const processedCount = results.filter((r) => r.success).length;
        const failedCount = results.length - processedCount;
        const errors = results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, error: r.error || "Unknown error" }));

        return {
          success: failedCount === 0,
          processedCount,
          failedCount,
          errors,
        };
      },
      "bulkRemoveFromQueue",
      { count: newsletterIds.length },
    );
  }

  /**
   * Clear all items from reading queue
   */
  async clearQueue(): Promise<ReadingQueueOperationResult> {
    return this.executeWithLogging(async () => {
      try {
        const existingItems = await readingQueueApi.getAll();

        if (existingItems.length === 0) {
          return {
            success: true,
            error: "Reading queue is already empty",
          };
        }

        const success = await this.withRetry(
          () => readingQueueApi.clear(),
          "clearQueue",
        );

        if (!success) {
          return {
            success: false,
            error: "Failed to clear reading queue",
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }, "clearQueue");
  }

  /**
   * Reorder reading queue items
   */
  async reorderQueue(
    orderedNewsletterIds: string[],
  ): Promise<ReadingQueueOperationResult> {
    this.validateArray(orderedNewsletterIds, "ordered newsletter IDs", {
      minLength: 1,
    });

    return this.executeWithLogging(
      async () => {
        try {
          // Validate all newsletters are in the queue
          const existingItems = await readingQueueApi.getAll();
          const existingIds = new Set(
            existingItems.map((item) => item.newsletter_id),
          );

          for (const newsletterId of orderedNewsletterIds) {
            if (!existingIds.has(newsletterId)) {
              return {
                success: false,
                error: `Newsletter ${newsletterId} is not in reading queue`,
              };
            }
          }

          // Create the reorder updates with positions
          const reorderUpdates = orderedNewsletterIds.map(
            (newsletterId, index) => {
              const item = existingItems.find(
                (item) => item.newsletter_id === newsletterId,
              );
              return {
                id: item!.id,
                position: index + 1,
              };
            },
          );

          const success = await this.withRetry(
            () => readingQueueApi.reorder(reorderUpdates),
            "reorderQueue",
          );

          if (!success) {
            return {
              success: false,
              error: "Failed to reorder reading queue",
            };
          }

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
      "reorderQueue",
      { count: orderedNewsletterIds.length },
    );
  }

  /**
   * Get reading queue statistics
   */
  async getQueueStats(): Promise<ReadingQueueStats> {
    return this.executeWithLogging(async () => {
      const items = await this.getReadingQueue();
      const newsletters = await this.getReadingQueueWithDetails();

      const unreadItems = newsletters.filter((n) => !n.is_read).length;
      const totalEstimatedTime = newsletters.reduce(
        (sum, n) => sum + (n.estimated_read_time || 5),
        0,
      );

      const averageReadTime =
        newsletters.length > 0
          ? Math.round(totalEstimatedTime / newsletters.length)
          : 0;

      const oldestItem =
        items.length > 0
          ? items.sort(
              (a, b) =>
                new Date(a.added_at).getTime() - new Date(b.added_at).getTime(),
            )[0]
          : undefined;

      return {
        totalItems: items.length,
        unreadItems,
        averageReadTime,
        oldestItem,
        estimatedReadTime: totalEstimatedTime,
      };
    }, "getQueueStats");
  }

  /**
   * Auto-cleanup reading queue (remove read newsletters if enabled)
   */
  async autoCleanup(): Promise<BulkReadingQueueOperationResult> {
    if (!this.queueOptions.autoRemoveRead) {
      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    return this.executeWithLogging(async () => {
      const newsletters = await this.getReadingQueueWithDetails();
      const readNewsletterIds = newsletters
        .filter((n) => n.is_read)
        .map((n) => n.id);

      if (readNewsletterIds.length === 0) {
        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      return await this.bulkRemoveFromQueue(readNewsletterIds);
    }, "autoCleanup");
  }

  /**
   * Check if newsletter is in reading queue
   */
  async isInQueue(newsletterId: string): Promise<boolean> {
    this.validateString(newsletterId, "newsletter ID");

    return this.executeWithLogging(
      async () => {
        const items = await readingQueueApi.getAll();
        return items.some((item) => item.newsletter_id === newsletterId);
      },
      "isInQueue",
      { newsletterId },
    );
  }

  /**
   * Private helper methods
   */

  private applyQueueOrdering(items: ReadingQueueItem[]): ReadingQueueItem[] {
    if (!this.queueOptions.priorityOrdering) {
      return items;
    }

    // Apply business logic for queue ordering
    // Priority: creation date (older items first), then priority if available
    return items.sort((a, b) => {
      // First sort by creation date (oldest first)
      const dateComparison =
        new Date(a.added_at).getTime() - new Date(b.added_at).getTime();

      // Future: Add priority field to ReadingQueueItem and sort by priority
      // if (a.priority !== b.priority) {
      //   return (b.priority || 0) - (a.priority || 0);
      // }

      return dateComparison;
    });
  }
}

// Export singleton instance
export const readingQueueService = new ReadingQueueService();
