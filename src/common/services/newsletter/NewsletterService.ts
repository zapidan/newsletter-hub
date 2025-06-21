import { BaseService, NotFoundError } from '../base/BaseService';
import { newsletterApi } from '@common/api/newsletterApi';
import { readingQueueApi } from '@common/api/readingQueueApi';
import { tagApi } from '@common/api/tagApi';
import {
  NewsletterWithRelations,
  Tag,
  NewsletterQueryParams,
  NewsletterFilter,
  PaginatedResponse,
} from '@common/types';
import { logger } from '@common/utils/logger';

export interface NewsletterOperationResult {
  success: boolean;
  newsletter?: NewsletterWithRelations;
  error?: string;
}

export interface BulkNewsletterOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

export interface NewsletterServiceOptions {
  enableOptimisticUpdates?: boolean;
  batchSize?: number;
}

export class NewsletterService extends BaseService {
  private newsletterOptions: NewsletterServiceOptions;

  constructor(options: NewsletterServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.newsletterOptions = {
      enableOptimisticUpdates: true,
      batchSize: 50,
      ...options,
    };
  }

  /**
   * Get a single newsletter by ID
   */
  async getNewsletter(id: string): Promise<NewsletterWithRelations | null> {
    this.validateString(id, 'newsletter ID');

    return this.withRetry(async () => {
      const newsletter = await newsletterApi.getById(id);
      if (!newsletter) {
        throw new NotFoundError(`Newsletter with ID ${id} not found`);
      }
      return newsletter;
    }, 'getNewsletter');
  }

  /**
   * Get newsletters with filtering and pagination
   */
  async getNewsletters(
    params: NewsletterQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.withRetry(async () => {
      // Apply business logic for default parameters
      const processedParams = this.processNewsletterParams(params);
      return await newsletterApi.getAll(processedParams);
    }, 'getNewsletters');
  }

  /**
   * Alias for getNewsletters for backward compatibility
   */
  async getAll(
    params: NewsletterQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    return this.getNewsletters(params);
  }

  /**
   * Alias for getNewsletter for backward compatibility
   */
  async getById(id: string): Promise<NewsletterWithRelations | null> {
    return this.getNewsletter(id);
  }

  /**
   * Mark newsletter as read
   */
  async markAsRead(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          const newsletter = await this.withRetry(() => newsletterApi.markAsRead(id), 'markAsRead');

          // Apply business logic - update related data if needed
          await this.handleReadStatusChange(id, true);

          return {
            success: true,
            newsletter,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'markAsRead',
      { id }
    );
  }

  /**
   * Mark newsletter as unread
   */
  async markAsUnread(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          const newsletter = await this.withRetry(
            () => newsletterApi.markAsUnread(id),
            'markAsUnread'
          );

          // Apply business logic - update related data if needed
          await this.handleReadStatusChange(id, false);

          return {
            success: true,
            newsletter,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'markAsUnread',
      { id }
    );
  }

  /**
   * Bulk mark newsletters as read
   */
  async bulkMarkAsRead(ids: string[]): Promise<BulkNewsletterOperationResult> {
    this.validateArray(ids, 'newsletter IDs', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const batchProcessor = this.createBatchProcessor(
          this.newsletterOptions.batchSize!,
          async (batch: string[]) => {
            const results = await Promise.allSettled(
              batch.map((id) => newsletterApi.markAsRead(id))
            );
            return results.map((result, index) => ({
              id: batch[index],
              success: result.status === 'fulfilled' && result.value,
              error: result.status === 'rejected' ? result.reason?.message : undefined,
            }));
          }
        );

        const results = await batchProcessor(ids);
        const processedCount = results.filter((r) => r.success).length;
        const failedCount = results.length - processedCount;
        const errors = results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, error: r.error || 'Unknown error' }));

        // Apply business logic for successful updates
        const successfulIds = results.filter((r) => r.success).map((r) => r.id);
        await Promise.allSettled(successfulIds.map((id) => this.handleReadStatusChange(id, true)));

        return {
          success: failedCount === 0,
          processedCount,
          failedCount,
          errors,
        };
      },
      'bulkMarkAsRead',
      { count: ids.length }
    );
  }

  /**
   * Bulk mark newsletters as unread
   */
  async bulkMarkAsUnread(ids: string[]): Promise<BulkNewsletterOperationResult> {
    this.validateArray(ids, 'newsletter IDs', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const batchProcessor = this.createBatchProcessor(
          this.newsletterOptions.batchSize!,
          async (batch: string[]) => {
            const results = await Promise.allSettled(
              batch.map((id) => newsletterApi.markAsUnread(id))
            );
            return results.map((result, index) => ({
              id: batch[index],
              success: result.status === 'fulfilled' && result.value,
              error: result.status === 'rejected' ? result.reason?.message : undefined,
            }));
          }
        );

        const results = await batchProcessor(ids);
        const processedCount = results.filter((r) => r.success).length;
        const failedCount = results.length - processedCount;
        const errors = results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, error: r.error || 'Unknown error' }));

        // Apply business logic for successful updates
        const successfulIds = results.filter((r) => r.success).map((r) => r.id);
        await Promise.allSettled(successfulIds.map((id) => this.handleReadStatusChange(id, false)));

        return {
          success: failedCount === 0,
          processedCount,
          failedCount,
          errors,
        };
      },
      'bulkMarkAsUnread',
      { count: ids.length }
    );
  }

  /**
   * Toggle like status
   */
  async toggleLike(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Get current newsletter to determine new like status
          const currentNewsletter = await this.withRetry(
            () => newsletterApi.getById(id),
            'getNewsletterForToggleLike'
          );

          if (!currentNewsletter) {
            return {
              success: false,
              error: 'Newsletter not found',
            };
          }

          const newsletter = await this.withRetry(() => newsletterApi.toggleLike(id), 'toggleLike');

          // Apply business logic
          await this.handleLikeStatusChange(id, !currentNewsletter.is_liked);

          return {
            success: true,
            newsletter,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'toggleLike',
      { id }
    );
  }

  /**
   * Toggle archive status
   */
  async toggleArchive(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Get current newsletter to determine new archive status
          const newsletter = await this.getNewsletter(id);
          if (!newsletter) {
            return {
              success: false,
              error: 'Newsletter not found',
            };
          }

          const newArchiveStatus = !newsletter.is_archived;
          const success = await this.withRetry(
            () => newsletterApi.toggleArchive(id),
            'toggleArchive'
          );

          if (!success) {
            return {
              success: false,
              error: 'Failed to toggle archive status',
            };
          }

          // Apply business logic - remove from reading queue if archived
          if (newArchiveStatus) {
            await this.removeFromReadingQueueIfExists(id);
          }

          return {
            success: true,
            newsletter: { ...newsletter, is_archived: newArchiveStatus },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'toggleArchive',
      { newsletterId: id }
    );
  }

  /**
   * Add newsletter to reading queue
   */
  async addToReadingQueue(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Validate newsletter exists and is not archived
          const newsletter = await this.getNewsletter(id);
          if (!newsletter) {
            return {
              success: false,
              error: 'Newsletter not found',
            };
          }

          if (newsletter.is_archived) {
            return {
              success: false,
              error: 'Cannot add archived newsletter to reading queue',
            };
          }

          const success = await this.withRetry(() => readingQueueApi.add(id), 'addToReadingQueue');

          if (!success) {
            return {
              success: false,
              error: 'Failed to add newsletter to reading queue',
            };
          }

          return { success: true, newsletter };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'addToReadingQueue',
      { newsletterId: id }
    );
  }

  /**
   * Remove newsletter from reading queue
   */
  async removeFromReadingQueue(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Get newsletter before removing
          const newsletter = await this.withRetry(
            () => newsletterApi.getById(id),
            'getNewsletterForReadingQueueRemoval'
          );

          await this.withRetry(() => readingQueueApi.remove(id), 'removeFromReadingQueue');

          // Apply business logic
          // Future: Add any business logic for reading queue changes

          return {
            success: true,
            newsletter,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'removeFromReadingQueue',
      { id }
    );
  }

  async deleteNewsletter(id: string): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');

    return this.executeWithLogging(async () => {
      try {
        await this.withRetry(() => newsletterApi.delete(id), 'deleteNewsletter');

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete newsletter',
        };
      }
    }, 'deleteNewsletter');
  }

  /**
   * Update newsletter tags
   */
  async updateTags(id: string, tagIds: string[]): Promise<NewsletterOperationResult> {
    this.validateString(id, 'newsletter ID');
    this.validateArray(tagIds, 'tag IDs');

    return this.executeWithLogging(
      async () => {
        try {
          // Validate newsletter exists
          const newsletter = await this.getNewsletter(id);
          if (!newsletter) {
            return {
              success: false,
              error: 'Newsletter not found',
            };
          }

          // Get tag objects for validation
          const tags: Tag[] = [];
          for (const tagId of tagIds) {
            const tag = await tagApi.getById(tagId);
            if (!tag) {
              return {
                success: false,
                error: `Tag with ID ${tagId} not found`,
              };
            }
            tags.push(tag);
          }

          const success = await this.withRetry(
            () => tagApi.updateNewsletterTags(id, tags),
            'updateNewsletterTags'
          );

          if (!success) {
            return {
              success: false,
              error: 'Failed to update newsletter tags',
            };
          }

          return {
            success: true,
            newsletter: { ...newsletter, tags },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateTags',
      { newsletterId: id, tagCount: tagIds.length }
    );
  }

  /**
   * Search newsletters
   */
  async searchNewsletters(
    query: string,
    filters?: NewsletterFilter
  ): Promise<PaginatedResponse<NewsletterWithRelations>> {
    this.validateString(query, 'search query', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const baseParams: NewsletterQueryParams = {
          search: query.trim(),
          isRead: filters?.is_read,
          isArchived: filters?.is_archived,
          isLiked: filters?.is_liked,
          tagIds: filters?.tag_ids,
          sourceIds: filters?.source_id ? [filters.source_id] : undefined,
          dateFrom: filters?.start_date,
          dateTo: filters?.end_date,
        };

        const searchParams = this.processNewsletterParams(baseParams);

        return await this.withRetry(() => newsletterApi.getAll(searchParams), 'searchNewsletters');
      },
      'searchNewsletters',
      { query, filters }
    );
  }

  /**
   * Get unread count for all newsletters or specific source
   */
  async getUnreadCount(sourceId?: string | null): Promise<number> {
    return this.withRetry(async () => {
      return await newsletterApi.getUnreadCount(sourceId);
    }, 'getUnreadCount');
  }

  /**
   * Get unread counts grouped by source
   */
  async getUnreadCountBySource(): Promise<Record<string, number>> {
    return this.withRetry(async () => {
      return await newsletterApi.getUnreadCountBySource();
    }, 'getUnreadCountBySource');
  }

  /**
   * Bulk update newsletters
   */
  async bulkUpdate(params: {
    ids: string[];
    updates: any;
  }): Promise<{ successCount: number; failedCount: number }> {
    this.validateArray(params.ids, 'newsletter IDs', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results = await Promise.allSettled(
          params.ids.map(async (id) => {
            if (params.updates.is_read !== undefined) {
              return params.updates.is_read ? this.markAsRead(id) : this.markAsUnread(id);
            }
            // Add other update types as needed
            throw new Error('Unsupported bulk update type');
          })
        );

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        return {
          successCount,
          failedCount: results.length - successCount,
        };
      },
      'bulkUpdate',
      { count: params.ids.length }
    );
  }

  /**
   * Bulk archive newsletters
   */
  async bulkArchive(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    this.validateArray(ids, 'newsletter IDs', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results = await Promise.allSettled(ids.map((id) => this.toggleArchive(id)));

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        return {
          successCount,
          failedCount: results.length - successCount,
        };
      },
      'bulkArchive',
      { count: ids.length }
    );
  }

  /**
   * Bulk unarchive newsletters
   */
  async bulkUnarchive(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    this.validateArray(ids, 'newsletter IDs', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results = await Promise.allSettled(ids.map((id) => this.toggleArchive(id)));

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        return {
          successCount,
          failedCount: results.length - successCount,
        };
      },
      'bulkUnarchive',
      { count: ids.length }
    );
  }

  /**
   * Delete newsletter (alias for deleteNewsletter)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.deleteNewsletter(id);
    return result.success;
  }

  /**
   * Update newsletter
   */
  async update(params: { id: string; is_archived?: boolean }): Promise<boolean> {
    this.validateString(params.id, 'newsletter ID');

    if (params.is_archived !== undefined) {
      const result = await this.toggleArchive(params.id);
      return result.success;
    }

    throw new Error('Unsupported update parameters');
  }

  /**
   * Process newsletter parameters with business logic
   */
  private processNewsletterParams(params: NewsletterQueryParams): NewsletterQueryParams {
    const processed = { ...params };

    // Apply default sorting if not specified
    if (!processed.orderBy) {
      processed.orderBy = 'received_at';
      processed.orderDirection = 'desc';
    }

    // Apply default pagination if not specified
    if (!processed.limit) {
      processed.limit = 50;
    }

    // Ensure we include necessary relations
    processed.includeSource = true;
    processed.includeTags = true;

    return processed;
  }

  /**
   * Handle business logic when read status changes
   */
  private async handleReadStatusChange(id: string, isRead: boolean): Promise<void> {
    // Business logic: If marked as read, could trigger analytics, recommendations, etc.
    logger.debug('Newsletter read status changed', {
      component: 'NewsletterService',
      action: 'read_status_change',
      metadata: { newsletterId: id, isRead },
    });

    // Future: Add analytics tracking, recommendation updates, etc.
  }

  /**
   * Handle business logic when like status changes
   */
  private async handleLikeStatusChange(id: string, isLiked: boolean): Promise<void> {
    // Business logic: Update recommendation algorithms, user preferences, etc.
    logger.debug('Newsletter like status changed', {
      component: 'NewsletterService',
      action: 'like_status_change',
      metadata: { newsletterId: id, isLiked },
    });

    // Future: Add recommendation algorithm updates, preference learning, etc.
  }

  /**
   * Remove newsletter from reading queue if it exists
   */
  private async removeFromReadingQueueIfExists(id: string): Promise<void> {
    try {
      await readingQueueApi.remove(id);
    } catch {
      // Ignore errors - newsletter might not be in queue
      logger.debug('Newsletter not in reading queue or removal failed', {
        component: 'NewsletterService',
        action: 'remove_from_queue_cleanup',
        metadata: { newsletterId: id },
      });
    }
  }
}

// Export singleton instance
export const newsletterService = new NewsletterService();
