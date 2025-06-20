import { QueryClient } from '@tanstack/react-query';
import { queryKeyFactory } from './queryKeyFactory';
import { logger } from './logger';
import type {
  NewsletterWithRelations,
  ReadingQueueItem,
  Tag,
  PaginatedResponse,
} from '@common/types';

interface CacheManagerConfig {
  enableOptimisticUpdates?: boolean;
  enableCrossFeatureSync?: boolean;
  enablePerformanceLogging?: boolean;
}

export class SimpleCacheManager {
  public queryClient: QueryClient;
  private config: CacheManagerConfig;
  private log = logger;

  constructor(queryClient: QueryClient, config: CacheManagerConfig = {}) {
    this.queryClient = queryClient;
    this.config = {
      enableOptimisticUpdates: true,
      enableCrossFeatureSync: true,
      enablePerformanceLogging: false,
      ...config,
    };
  }

  // Update newsletter in cache
  updateNewsletterInCache(update: { id: string; updates: Partial<NewsletterWithRelations> }): void {
    try {
      this.log.debug('Updating newsletter in cache', {
        action: 'update_newsletter_cache_start',
        metadata: {
          newsletterId: update.id,
          updates: update.updates,
          updateFields: Object.keys(update.updates),
        },
      });

      // Update in all newsletter list queries using predicate
      this.queryClient.setQueriesData<PaginatedResponse<NewsletterWithRelations>>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'newsletters' &&
              key[1] === 'list' &&
              key[2] !== 'infinite'
            );
          },
        },
        (oldData: PaginatedResponse<NewsletterWithRelations> | undefined) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((newsletter: NewsletterWithRelations) =>
              newsletter.id === update.id ? { ...newsletter, ...update.updates } : newsletter
            ),
          };
        }
      );

      // Update in infinite queries (for Inbox view) using predicate
      this.queryClient.setQueriesData<{ pages: PaginatedResponse<NewsletterWithRelations>[] }>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'newsletters' &&
              key[1] === 'list' &&
              key[2] === 'infinite'
            );
          },
        },
        (oldData) => {
          if (!oldData || !oldData.pages) return oldData;

          let foundAndUpdated = false;
          const updatedData = {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: page.data.map((newsletter: NewsletterWithRelations) => {
                if (newsletter.id === update.id) {
                  foundAndUpdated = true;
                  this.log.debug('Found newsletter in infinite query page', {
                    action: 'update_infinite_query',
                    metadata: {
                      newsletterId: update.id,
                      oldValues: {
                        is_read: newsletter.is_read,
                        is_liked: newsletter.is_liked,
                        is_archived: newsletter.is_archived,
                      },
                      newValues: update.updates,
                    },
                  });
                  return { ...newsletter, ...update.updates };
                }
                return newsletter;
              }),
            })),
          };

          if (!foundAndUpdated) {
            this.log.warn('Newsletter not found in infinite query', {
              action: 'update_infinite_query_not_found',
              metadata: { newsletterId: update.id },
            });
          }

          return updatedData;
        }
      );

      // Update individual newsletter query if it exists
      const detailQueryKey = queryKeyFactory.newsletters.detail(update.id);
      this.queryClient.setQueryData<NewsletterWithRelations | undefined>(
        detailQueryKey,
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, ...update.updates };
        }
      );

      // Cross-feature sync: Update newsletter in reading queue if it exists there
      if (this.config.enableCrossFeatureSync) {
        this.queryClient.setQueriesData<ReadingQueueItem[] | undefined>(
          { queryKey: queryKeyFactory.queue.all() },
          (oldData) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((queueItem) =>
              queueItem.newsletter?.id === update.id
                ? {
                    ...queueItem,
                    newsletter: { ...queueItem.newsletter, ...update.updates },
                  }
                : queueItem
            );
          }
        );
      }

      if (this.config.enablePerformanceLogging) {
        this.log.debug('Newsletter cache updated', {
          action: 'update_newsletter_cache',
          metadata: {
            newsletterId: update.id,
            updatedFields: Object.keys(update.updates),
          },
        });
      }
    } catch (error) {
      this.log.error(
        'Failed to update newsletter in cache',
        {
          action: 'update_newsletter_cache_error',
          metadata: { newsletterId: update.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Batch update newsletters in cache
  batchUpdateNewsletters(
    updates: Array<{ id: string; updates: Partial<NewsletterWithRelations> }>
  ): void {
    try {
      this.log.debug('Starting batch newsletter update', {
        action: 'batch_update_start',
        metadata: {
          count: updates.length,
          newsletterIds: updates.map((u) => u.id),
          updateFields: updates.length > 0 ? Object.keys(updates[0].updates) : [],
        },
      });

      // Create a map for efficient lookup
      const updateMap = new Map(updates.map((u) => [u.id, u.updates]));

      // Update in all newsletter list queries using predicate
      this.queryClient.setQueriesData<PaginatedResponse<NewsletterWithRelations>>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'newsletters' &&
              key[1] === 'list' &&
              key[2] !== 'infinite'
            );
          },
        },
        (oldData) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((newsletter: NewsletterWithRelations) => {
              const updates = updateMap.get(newsletter.id);
              return updates ? { ...newsletter, ...updates } : newsletter;
            }),
          };
        }
      );

      // Update in infinite queries (for Inbox view) using predicate
      this.queryClient.setQueriesData<{ pages: PaginatedResponse<NewsletterWithRelations>[] }>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'newsletters' &&
              key[1] === 'list' &&
              key[2] === 'infinite'
            );
          },
        },
        (oldData) => {
          if (!oldData || !oldData.pages) return oldData;

          let updateCount = 0;
          const updatedData = {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: page.data.map((newsletter: NewsletterWithRelations) => {
                const updates = updateMap.get(newsletter.id);
                if (updates) {
                  updateCount++;
                }
                return updates ? { ...newsletter, ...updates } : newsletter;
              }),
            })),
          };

          this.log.debug('Batch update in infinite queries', {
            action: 'batch_update_infinite',
            metadata: {
              totalPages: oldData.pages.length,
              updatedCount: updateCount,
              requestedCount: updates.length,
            },
          });

          return updatedData;
        }
      );

      // Update individual newsletter queries
      updates.forEach(({ id, updates }) => {
        const detailQueryKey = queryKeyFactory.newsletters.detail(id);
        this.queryClient.setQueryData<NewsletterWithRelations | undefined>(
          detailQueryKey,
          (oldData) => {
            if (!oldData) return oldData;
            return { ...oldData, ...updates };
          }
        );
      });

      // Cross-feature sync: Update newsletters in reading queue
      if (this.config.enableCrossFeatureSync) {
        this.queryClient.setQueriesData<ReadingQueueItem[] | undefined>(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === 'queue';
            },
          },
          (oldData) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((queueItem) => {
              if (queueItem.newsletter) {
                const updates = updateMap.get(queueItem.newsletter.id);
                if (updates) {
                  return {
                    ...queueItem,
                    newsletter: { ...queueItem.newsletter, ...updates },
                  };
                }
              }
              return queueItem;
            });
          }
        );
      }

      if (this.config.enablePerformanceLogging) {
        this.log.debug('Batch newsletter cache updated', {
          action: 'batch_update_newsletter_cache',
          metadata: {
            count: updates.length,
            newsletterIds: updates.map((u) => u.id),
          },
        });
      }
    } catch (error) {
      this.log.error(
        'Failed to batch update newsletters in cache',
        {
          action: 'batch_update_newsletter_cache_error',
          metadata: { updateCount: updates.length },
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Reading queue operations
  updateReadingQueueInCache(operation: {
    type: 'add' | 'remove' | 'reorder' | 'updateTags' | 'revert';
    newsletterId?: string;
    queueItemId?: string;
    updates?: { id: string; position: number }[];
    tagIds?: string[];
    queueItems?: ReadingQueueItem[];
    userId: string;
  }): void {
    const queueQueryKey = queryKeyFactory.queue.list(operation.userId);

    switch (operation.type) {
      case 'add':
        // For add operations, we'll just invalidate to refetch
        // since we need full newsletter data
        this.queryClient.invalidateQueries({ queryKey: queueQueryKey });
        break;

      case 'remove':
        if (operation.queueItemId) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(queueQueryKey, (oldData = []) =>
            oldData.filter((item) => item.id !== operation.queueItemId)
          );
        }
        break;

      case 'reorder':
        if (operation.updates) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(queueQueryKey, (oldData = []) => {
            const reorderedData = [...oldData];
            operation.updates!.forEach(({ id, position }) => {
              const itemIndex = reorderedData.findIndex((item) => item.id === id);
              if (itemIndex !== -1) {
                reorderedData[itemIndex] = {
                  ...reorderedData[itemIndex],
                  position,
                };
              }
            });
            return reorderedData.sort((a, b) => a.position - b.position);
          });
        }
        break;

      case 'updateTags':
        if (operation.newsletterId && operation.tagIds) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(queueQueryKey, (oldData = []) =>
            oldData.map((item) =>
              item.newsletter_id === operation.newsletterId
                ? {
                    ...item,
                    newsletter: {
                      ...item.newsletter,
                      tags: operation.tagIds!.map((tagId) => ({
                        id: tagId,
                        name: '',
                        color: '#808080',
                        user_id: operation.userId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      })),
                    },
                  }
                : item
            )
          );
        }
        break;

      case 'revert':
        if (operation.queueItems) {
          this.queryClient.setQueryData<ReadingQueueItem[]>(queueQueryKey, operation.queueItems);
        }
        break;
    }
  }

  // Smart invalidation with operation types
  invalidateRelatedQueries(newsletterIds: string[], operationType: string): void {
    const invalidationPromises: Promise<void>[] = [];

    switch (operationType) {
      case 'mark-read':
      case 'mark-unread':
      case 'bulk-mark-read':
      case 'bulk-mark-unread':
        // Only invalidate unread count, keep newsletter lists with optimistic updates
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ['unreadCount'],
            refetchType: 'active',
          })
        );
        break;

      case 'toggle-archive':
      case 'archive':
      case 'unarchive':
      case 'bulk-archive':
      case 'bulk-unarchive':
        // For archive operations, we need to remove items from filtered views
        // and invalidate unread counts
        this.handleArchiveInvalidation(newsletterIds, operationType);
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ['unreadCount'],
            refetchType: 'active',
          })
        );
        break;

      case 'delete':
      case 'bulk-delete':
        // For delete operations, remove from all caches completely
        this.handleDeleteInvalidation(newsletterIds);
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ['unreadCount'],
            refetchType: 'active',
          })
        );
        break;

      case 'toggle-like':
        // For like operations, rely on optimistic updates only
        // No cache invalidation needed since optimistic updates handle the UI
        // This preserves filter state and prevents unnecessary refetches
        break;

      case 'toggle-queue':
      case 'queue-add':
      case 'queue-remove':
      case 'queue-reorder':
      case 'queue-clear':
      case 'queue-mark-read':
      case 'queue-mark-unread':
      case 'queue-update-tags':
      case 'queue-cleanup':
        // For all queue operations, invalidate reading queue and newsletter lists
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.queue.all(),
            refetchType: 'active',
          })
        );
        // Also refresh the newsletter lists to reflect any queue changes
        setTimeout(() => {
          this.queryClient.refetchQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            type: 'active',
          });
        }, 100);
        break;

      case 'toggle-like-error':
        // For like error cases, rely on rollback mechanism from optimistic updates
        // Avoid broad invalidation to preserve filter state
        // The mutation's onError callback handles rollbacks
        break;

      case 'toggle-queue-error':
        // For queue error cases, force refresh of both lists and queue
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            refetchType: 'active',
          }),
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.queue.all(),
            refetchType: 'active',
          })
        );
        break;

      case 'tag-update':
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
            refetchType: 'active',
          })
        );
        break;

      case 'newsletter-sources':
      case 'source-update-optimistic':
      case 'source-update-error':
      case 'source-archive-optimistic':
      case 'source-unarchive-optimistic':
      case 'source-archive-error':
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            predicate: (query) => {
              return query.queryKey[0] === 'newsletterSources';
            },
            refetchType: 'active',
          })
        );
        break;

      case 'unread-count-change':
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: ['unreadCount'],
            refetchType: 'active',
          })
        );
        break;

      default:
        // Fallback: invalidate general newsletter queries
        invalidationPromises.push(
          this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
            refetchType: 'active',
          })
        );
        break;
    }

    Promise.all(invalidationPromises).catch((error) => {
      this.log.error(
        'Failed to invalidate related queries',
        {
          action: 'invalidate_related_queries',
          metadata: {
            newsletterIds,
            invalidationCount: invalidationPromises.length,
          },
        },
        error
      );
    });
  }

  // Smart invalidation that respects filter context
  smartInvalidate(options: {
    operation: string;
    newsletterIds?: string[];
    filterContext?: unknown;
    priority: 'high' | 'medium' | 'low';
  }): void {
    const { operation, newsletterIds = [], filterContext, priority } = options;

    this.log.debug('Smart cache invalidation triggered', {
      action: 'smart_invalidation',
      metadata: {
        operation,
        newsletterCount: newsletterIds.length,
        filterContext,
        priority,
      },
    });

    switch (operation) {
      case 'newsletter-action':
        // For newsletter actions, preserve the current filter state
        // Only invalidate unread counts, let optimistic updates handle the rest
        this.queryClient.invalidateQueries({
          queryKey: ['unreadCount'],
          refetchType: priority === 'high' ? 'active' : 'none',
        });

        // Gentle refresh of current newsletter list after a delay
        if (priority === 'high') {
          setTimeout(() => {
            this.queryClient.refetchQueries({
              queryKey: queryKeyFactory.newsletters.lists(),
              type: 'active',
            });
          }, 500);
        }
        break;

      case 'queue-action':
        // For reading queue actions, invalidate queue and unread counts
        this.queryClient.invalidateQueries({
          queryKey: queryKeyFactory.queue.all(),
          refetchType: priority === 'high' ? 'active' : 'none',
        });
        this.queryClient.invalidateQueries({
          queryKey: ['unreadCount'],
          refetchType: 'active',
        });
        break;

      default:
        // Fallback to standard invalidation
        this.invalidateRelatedQueries(newsletterIds, operation);
        break;
    }
  }

  // Handle archive operations with filter-aware cache updates
  private handleArchiveInvalidation(newsletterIds: string[], operationType: string): void {
    const isArchiving =
      operationType === 'toggle-archive' ||
      operationType === 'archive' ||
      operationType === 'bulk-archive';

    // Update all newsletter list queries to remove/add archived items based on filter context
    this.queryClient.setQueriesData<PaginatedResponse<NewsletterWithRelations>>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData) => {
        if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;

        // Get the filter context from the query key to understand if archived items should be shown
        const shouldShowArchived = this.shouldShowArchivedInQuery(oldData);

        if (isArchiving && !shouldShowArchived) {
          // Remove archived newsletters from non-archived views
          const filteredData = oldData.data.filter(
            (newsletter: NewsletterWithRelations) => !newsletterIds.includes(newsletter.id)
          );
          return {
            ...oldData,
            data: filteredData,
            count: Math.max(0, (oldData.count || 0) - newsletterIds.length),
          };
        } else if (!isArchiving && shouldShowArchived) {
          // For unarchive operations in archived view, let optimistic updates handle it
          // The newsletters will still show until the actual refetch happens
          return oldData;
        }

        return oldData;
      }
    );
  }

  // Handle delete operations by completely removing items from all caches
  private handleDeleteInvalidation(newsletterIds: string[]): void {
    // Remove from all newsletter list queries
    this.queryClient.setQueriesData<unknown>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData: unknown) => {
        if (!oldData || !(oldData as any)?.data || !Array.isArray((oldData as any).data))
          return oldData;

        const filteredData = (oldData as any).data.filter(
          (newsletter: NewsletterWithRelations) => !newsletterIds.includes(newsletter.id)
        );

        return {
          ...(oldData as any),
          data: filteredData,
          count: Math.max(0, ((oldData as any).count || 0) - newsletterIds.length),
        };
      }
    );

    // Remove individual newsletter detail caches
    newsletterIds.forEach((id) => {
      this.queryClient.removeQueries({
        queryKey: queryKeyFactory.newsletters.detail(id),
        exact: true,
      });
    });

    // Remove from reading queue if present
    this.queryClient.setQueriesData<ReadingQueueItem[]>(
      { queryKey: queryKeyFactory.queue.all() },
      (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((item) => !newsletterIds.includes(item.newsletter_id));
      }
    );
  }

  // Determine if a query should show archived newsletters based on its filter context
  private shouldShowArchivedInQuery(
    queryData: PaginatedResponse<NewsletterWithRelations>
  ): boolean {
    // This is a heuristic - in a real implementation, you'd parse the query key
    // to understand the filter context. For now, we assume if the data contains
    // archived newsletters, it's an "all" or "archived" view
    if (!(queryData as any)?.data || !Array.isArray((queryData as any).data)) return false;

    const hasArchivedNewsletters = (queryData as any).data.some(
      (newsletter: NewsletterWithRelations) => newsletter.is_archived === true
    );

    return hasArchivedNewsletters;
  }

  // Optimistic update with rollback support
  async optimisticUpdate(
    newsletterId: string,
    updates: Partial<NewsletterWithRelations>,
    operation: string
  ): Promise<NewsletterWithRelations | null> {
    try {
      this.log.debug('Starting optimistic update', {
        action: 'optimistic_update_start',
        metadata: {
          newsletterId,
          operation,
          updates,
          updateFields: Object.keys(updates),
        },
      });

      // Get all query keys that might contain this newsletter
      const queryCache = this.queryClient.getQueryCache();
      const queries = queryCache.findAll({
        predicate: (query) => {
          const key = query.queryKey;
          // Match any query key that's for newsletter lists or infinite lists
          if (!Array.isArray(key) || key.length < 2) return false;

          // Check for regular list queries
          if (key[0] === 'newsletters' && key[1] === 'list' && key[2] !== 'infinite') {
            return true;
          }

          // Check for infinite queries
          if (key[0] === 'newsletters' && key[1] === 'list' && key[2] === 'infinite') {
            return true;
          }

          return false;
        },
      });

      // Find the first query that contains our newsletter
      let currentData: NewsletterWithRelations | null = null;

      for (const query of queries) {
        // Check if it's an infinite query
        const queryKey = query.queryKey;
        if (
          Array.isArray(queryKey) &&
          queryKey.length >= 3 &&
          queryKey[0] === 'newsletters' &&
          queryKey[1] === 'list' &&
          queryKey[2] === 'infinite'
        ) {
          const data = this.queryClient.getQueryData<{
            pages: PaginatedResponse<NewsletterWithRelations>[];
          }>(query.queryKey);

          if (data?.pages) {
            for (const page of data.pages) {
              const newsletter = page.data.find((n) => n.id === newsletterId);
              if (newsletter) {
                currentData = newsletter;
                break;
              }
            }
            if (currentData) break;
          }
        } else {
          // Regular list query
          const data = this.queryClient.getQueryData<
            PaginatedResponse<NewsletterWithRelations> | NewsletterWithRelations[] | undefined
          >(query.queryKey);

          if (data) {
            const newsletters = Array.isArray(data) ? data : data.data;
            if (Array.isArray(newsletters)) {
              const newsletter = newsletters.find((n) => n.id === newsletterId);
              if (newsletter) {
                currentData = newsletter;
                break;
              }
            }
          }
        }
      }

      // Update newsletter in all relevant caches
      this.updateNewsletterInCache({ id: newsletterId, updates });

      // Don't invalidate queries immediately for optimistic updates
      // The calling code will handle invalidation after the API call

      this.log.debug('Optimistic update completed', {
        action: 'optimistic_update_complete',
        metadata: {
          newsletterId,
          operation,
          foundOriginalData: currentData !== null,
          originalValues: currentData
            ? {
                is_read: currentData.is_read,
                is_liked: currentData.is_liked,
                is_archived: currentData.is_archived,
              }
            : null,
        },
      });

      return currentData;
    } catch (error) {
      this.log.error(
        'Failed to perform optimistic update',
        {
          action: 'optimistic_update',
          metadata: { operation },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  // Warm cache by prefetching common queries
  warmCache(userId: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (!userId) return;

    const prefetchOptions = {
      staleTime: priority === 'high' ? 10 * 60 * 1000 : 5 * 60 * 1000, // 10 min for high, 5 min for others
    };

    // Prefetch newsletters
    this.queryClient.prefetchQuery({
      queryKey: queryKeyFactory.newsletters.list({ userId }),
      queryFn: () => Promise.resolve([]), // Would be actual fetch function
      ...prefetchOptions,
    });

    // Prefetch reading queue if high priority
    if (priority === 'high') {
      this.queryClient.prefetchQuery({
        queryKey: queryKeyFactory.queue.list(userId),
        queryFn: () => Promise.resolve([]), // Would be actual fetch function
        ...prefetchOptions,
      });
    }

    // Prefetch unread count
    this.queryClient.prefetchQuery({
      queryKey: ['unreadCount', userId],
      queryFn: () => Promise.resolve(0), // Would be actual fetch function
      ...prefetchOptions,
    });
  }

  // Clear specific cache sections
  clearNewsletterCache(): void {
    this.queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.lists(),
      refetchType: 'active',
    });
  }

  clearReadingQueueCache(): void {
    this.queryClient.invalidateQueries({
      queryKey: queryKeyFactory.queue.all(),
      refetchType: 'active',
    });
  }

  // Tag-specific cache operations
  invalidateTagQueries(): void {
    this.queryClient.invalidateQueries({
      queryKey: queryKeyFactory.newsletters.tags(),
      refetchType: 'active',
    });
    this.queryClient.invalidateQueries({
      queryKey: ['newsletter_tags'],
      refetchType: 'active',
    });
  }

  updateNewsletterTagsInCache(newsletterId: string, tags: Tag[]): void {
    // Update newsletter with new tags in all caches
    this.updateNewsletterInCache({
      id: newsletterId,
      updates: { tags },
    });

    // Invalidate tag-related queries
    this.invalidateTagQueries();
  }

  removeTagFromAllNewsletters(tagId: string): void {
    // Update all newsletter list queries to remove the deleted tag
    this.queryClient.setQueriesData<NewsletterWithRelations[]>(
      { queryKey: queryKeyFactory.newsletters.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((newsletter) => ({
          ...newsletter,
          tags: newsletter.tags?.filter((tag) => tag.id !== tagId) || [],
        }));
      }
    );

    // Update individual newsletter queries
    this.queryClient
      .getQueryCache()
      .findAll()
      .forEach((query) => {
        if (query.queryKey[0] === 'newsletters' && query.queryKey[1] === 'detail') {
          const newsletterData = query.state.data as NewsletterWithRelations;
          if (newsletterData?.tags?.some((tag) => tag.id === tagId)) {
            this.queryClient.setQueryData<NewsletterWithRelations>(query.queryKey, (oldData) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                tags: oldData.tags?.filter((tag) => tag.id !== tagId) || [],
              };
            });
          }
        }
      });

    // Invalidate tag-related queries
    this.invalidateTagQueries();
  }

  // Enhanced cache invalidation for granular control
  invalidateNewsletterListQueries(filters?: Record<string, any>): Promise<void> {
    const queryKey = filters
      ? queryKeyFactory.newsletters.list(filters)
      : queryKeyFactory.newsletters.lists();

    return this.queryClient.invalidateQueries({
      queryKey,
      refetchType: 'active',
    });
  }

  // Batch invalidation for multiple operations
  async batchInvalidateQueries(
    operations: Array<{
      type: string;
      ids: string[];
      filters?: Record<string, any>;
    }>
  ): Promise<void> {
    const promises = operations.map(({ type, ids, filters }) => {
      switch (type) {
        case 'newsletter-list':
          return this.invalidateNewsletterListQueries(filters);
        case 'newsletter-detail':
          return Promise.all(
            ids.map((id) =>
              this.queryClient.invalidateQueries({
                queryKey: queryKeyFactory.newsletters.detail(id),
                refetchType: 'active',
              })
            )
          );
        case 'reading-queue':
          return this.queryClient.invalidateQueries({
            queryKey: queryKeyFactory.queue.all(),
            refetchType: 'active',
          });
        case 'unread-count':
          return this.queryClient.invalidateQueries({
            queryKey: ['unreadCount'],
            refetchType: 'active',
          });
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  // Optimistic update with enhanced rollback
  async optimisticUpdateWithRollback<T>(
    queryKey: unknown[],
    updater: (data: T) => T,
    rollbackData?: T
  ): Promise<{ rollback: () => void; previousData: T | undefined }> {
    const previousData = this.queryClient.getQueryData<T>(queryKey);

    // Apply optimistic update
    this.queryClient.setQueryData<T>(queryKey, updater as any);

    const rollback = () => {
      if (rollbackData !== undefined) {
        this.queryClient.setQueryData<T>(queryKey, rollbackData);
      } else if (previousData !== undefined) {
        this.queryClient.setQueryData<T>(queryKey, previousData);
      }
    };

    return { rollback, previousData };
  }
}

// Singleton instance
let cacheManagerInstance: SimpleCacheManager | null = null;

export const createCacheManager = (
  queryClient: QueryClient,
  config?: CacheManagerConfig
): SimpleCacheManager => {
  cacheManagerInstance = new SimpleCacheManager(queryClient, config);
  return cacheManagerInstance;
};

export const getCacheManager = (): SimpleCacheManager => {
  if (!cacheManagerInstance) {
    throw new Error('Cache manager not initialized. Call createCacheManager first.');
  }
  return cacheManagerInstance;
};

export const getCacheManagerSafe = (): SimpleCacheManager | null => {
  return cacheManagerInstance;
};

// Additional cache utility methods
export const prefetchQuery = async <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: { staleTime?: number; gcTime?: number } = {}
): Promise<void> => {
  const manager = getCacheManager();
  await manager.queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options.staleTime || 5 * 60 * 1000,
    gcTime: options.gcTime || 30 * 60 * 1000,
  });
};

export const getQueryData = <T>(queryKey: readonly unknown[]): T | undefined => {
  const manager = getCacheManager();
  return manager.queryClient.getQueryData<T>(queryKey);
};

export const getQueriesData = <T>(
  queryKey: readonly unknown[]
): [readonly unknown[], T | undefined][] => {
  const manager = getCacheManager();
  return manager.queryClient.getQueriesData<T>({ queryKey });
};

export const getQueryState = (queryKey: readonly unknown[]) => {
  const manager = getCacheManager();
  return manager.queryClient.getQueryState(queryKey);
};

export const invalidateQueries = async (options: {
  queryKey?: readonly unknown[];
  predicate?: (query: { queryKey: unknown[] }) => boolean;
  refetchType?: 'active' | 'inactive' | 'all';
}): Promise<void> => {
  const manager = getCacheManager();
  await manager.queryClient.invalidateQueries(
    options as Parameters<typeof manager.queryClient.invalidateQueries>[0]
  );
};

export const setQueryData = <T>(
  queryKey: readonly unknown[],
  data: T | ((oldData: T | undefined) => T)
): void => {
  const manager = getCacheManager();
  manager.queryClient.setQueryData<T>(queryKey, data);
};

export const cancelQueries = async (options: {
  queryKey?: readonly unknown[];
  predicate?: (query: { queryKey: unknown[] }) => boolean;
  refetchType?: 'active' | 'inactive' | 'all';
}): Promise<void> => {
  const manager = getCacheManager();
  await manager.queryClient.cancelQueries(
    options as Parameters<typeof manager.queryClient.cancelQueries>[0]
  );
};

// Utility functions for backward compatibility
export const updateCachedNewsletter = (
  newsletterId: string,
  updates: Partial<NewsletterWithRelations>
) => {
  const manager = getCacheManager();
  manager.updateNewsletterInCache({ id: newsletterId, updates });
};

export const updateMultipleCachedNewsletters = async (
  updates: { id: string; updates: Partial<NewsletterWithRelations> }[]
) => {
  const manager = getCacheManager();
  await manager.batchUpdateNewsletters(updates);
};

export const invalidateNewsletterQueries = (newsletterIds: string[], operationType: string) => {
  const manager = getCacheManager();
  manager.invalidateRelatedQueries(newsletterIds, operationType);
};
