import { AuthContext } from '@common/contexts/AuthContext';
import { useCache } from '@common/hooks/useCache';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useTags } from '@common/hooks/useTags';
import { NewsletterSource, NewsletterWithRelations, ReadingQueueItem, Tag } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SortableNewsletterRow } from '../components/reading-queue/SortableNewsletterRow';

import { useReadingQueueCacheOptimizer } from '@common/hooks/useReadingQueueCacheOptimizer';
import { newsletterService } from '@common/services';
import { getCacheManager } from '@common/utils/cacheUtils';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';

const ReadingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { setQueryData } = useCache();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();

  const {
    readingQueue = [],
    isLoading,
    error,
    refetch,
    removeFromQueue,
    reorderQueue,
  } = useReadingQueue() || {};

  // Create mutations for useSharedNewsletterActions
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsRead(id),
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsUnread(id),
  });

  const toggleLikeMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleLike(id),
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleArchive(id),
  });

  const deleteNewsletterMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteNewsletter(id),
  });

  const addToQueueMutation = useMutation({
    mutationFn: (id: string) => newsletterService.addToReadingQueue(id),
  });

  const updateTagsMutation = useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      newsletterService.updateTags(id, tagIds),
  });

  // Create wrapper functions to convert NewsletterOperationResult to boolean
  const markAsRead = useCallback(async (id: string) => {
    const result = await markAsReadMutation.mutateAsync(id);
    return result.success;
  }, [markAsReadMutation]);

  const markAsUnread = useCallback(async (id: string) => {
    const result = await markAsUnreadMutation.mutateAsync(id);
    return result.success;
  }, [markAsUnreadMutation]);

  const toggleLike = useCallback(async (id: string) => {
    const result = await toggleLikeMutation.mutateAsync(id);
    return result.success;
  }, [toggleLikeMutation]);

  const toggleArchive = useCallback(async (id: string) => {
    const result = await toggleArchiveMutation.mutateAsync(id);
    return result.success;
  }, [toggleArchiveMutation]);

  const deleteNewsletter = useCallback(async (id: string) => {
    const result = await deleteNewsletterMutation.mutateAsync(id);
    return result.success;
  }, [deleteNewsletterMutation]);

  const toggleInQueueForActions = useCallback(async (id: string) => {
    const result = await addToQueueMutation.mutateAsync(id);
    return result.success;
  }, [addToQueueMutation]);

  const updateNewsletterTags = useCallback(async (id: string, tagIds: string[]) => {
    await updateTagsMutation.mutateAsync({ id, tagIds });
  }, [updateTagsMutation]);

  // Memoize mutations object to prevent unnecessary re-renders
  const mutations = useMemo(() => ({
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue: toggleInQueueForActions,
    updateNewsletterTags,
  }), [
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueueForActions,
    updateNewsletterTags,
  ]);

  // Use shared newsletter actions for consistent cache management
  const { handleMarkAsRead, handleMarkAsUnread, handleToggleLike, handleToggleArchive } =
    useSharedNewsletterActions(
      mutations,
      {
        showToasts: true,
        optimisticUpdates: false,
        onSuccess: () => {
          // Invalidate reading queue after successful actions
          if (cacheManager) {
            cacheManager.smartInvalidate({
              operation: 'queue-action',
              newsletterIds: [],
              priority: 'high',
            });
          }
        },
        onError: (error) => {
          log.error(
            'Reading queue action failed',
            {
              action: 'reading_queue_action',
              metadata: { userId: user?.id },
            },
            error
          );
        },
      }
    );

  const { getTags } = useTags();
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Initialize cache manager for advanced operations
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      // Cache manager not initialized yet - will be available after first hook usage
      return null;
    }
  }, []);

  // Use the new hook for cache optimization
  useReadingQueueCacheOptimizer(cacheManager, user, readingQueue);

  // Load all tags when component mounts
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getTags();
        setAllTags(tags);
      } catch (error) {
        log.error(
          'Failed to load tags for reading queue',
          {
            action: 'load_tags',
            metadata: { userId: user?.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error('Failed to load tags');
      }
    };

    loadTags();
  }, [getTags, readingQueue, log, user?.id]);

  // Check if a newsletter is in the reading queue
  const isInQueue = useCallback(
    (newsletterId: string) => {
      return readingQueue.some((item) => item.newsletter_id === newsletterId);
    },
    [readingQueue]
  );

  // Toggle a newsletter in/out of the reading queue with optimized cache management
  const toggleInQueue = useCallback(
    async (newsletterId: string) => {
      const currentlyInQueue = isInQueue(newsletterId);

      try {
        if (currentlyInQueue) {
          // Find the queue item to remove
          const queueItem = readingQueue.find((item) => item.newsletter_id === newsletterId);
          if (queueItem) {
            await removeFromQueue(queueItem.id);

            // Use smart cache invalidation
            if (cacheManager) {
              cacheManager.smartInvalidate({
                operation: 'remove-from-queue',
                newsletterIds: [newsletterId],
                priority: 'high',
              });
            }
          }
        } else {
          // This shouldn't happen in reading queue context, but handle gracefully
          log.warn('Attempted to add newsletter to queue from reading queue page', {
            action: 'toggle_reading_queue',
            metadata: {
              newsletterId: newsletterId,
              context: 'reading_queue_page',
            },
          });
        }
      } catch (error) {
        log.error(
          'Failed to toggle reading queue status',
          {
            action: 'toggle_reading_queue',
            metadata: {
              newsletterId: newsletterId,
              userId: user?.id,
            },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error('Failed to update reading queue');
      }
    },
    [readingQueue, isInQueue, removeFromQueue, cacheManager, log, user?.id]
  );

  const [sortByDate, setSortByDate] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter out any null items from the queue
  const validQueueItems = useMemo(
    () => readingQueue.filter((item): item is ReadingQueueItem => item !== null),
    [readingQueue]
  );

  // Apply local tag filtering
  const filteredQueueItems = useMemo(() => {
    if (selectedTagIds.size === 0) {
      return validQueueItems;
    }

    return validQueueItems.filter((item) => {
      if (!item.newsletter.tags || item.newsletter.tags.length === 0) {
        return false;
      }

      // Newsletter must have ALL selected tags (AND logic)
      return Array.from(selectedTagIds).every((tagId) =>
        item.newsletter.tags?.some((tag) => tag.id === tagId)
      );
    });
  }, [validQueueItems, selectedTagIds]);

  const handleBrowseNewsletters = () => {
    navigate('/');
  };

  // Handle toggling read status with shared actions
  const handleToggleRead = useCallback(
    async (newsletterId: string) => {
      try {
        const item = validQueueItems.find((item) => item.newsletter.id === newsletterId);
        if (!item) return;

        if (item.newsletter.is_read) {
          await handleMarkAsUnread(newsletterId);
        } else {
          await handleMarkAsRead(newsletterId);
        }

        // Smart cache invalidation
        if (cacheManager) {
          cacheManager.smartInvalidate({
            operation: 'queue-mark-read',
            newsletterIds: [newsletterId],
            priority: 'high',
          });
        }
      } catch (error) {
        log.error(
          'Failed to toggle read status',
          {
            action: 'toggle_read_status',
            metadata: {
              newsletterId: newsletterId,
              userId: user?.id,
            },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleMarkAsRead, handleMarkAsUnread, validQueueItems, cacheManager, log, user?.id]
  );

  // Handle newsletter click with proper navigation state
  const handleNewsletterClick = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        // Mark as read if unread (but don't archive in reading queue)
        if (!newsletter.is_read) {
          try {
            await handleToggleRead(newsletter.id);
          } catch (readError) {
            log.error(
              'Failed to mark newsletter as read',
              {
                action: 'mark_as_read',
                metadata: {
                  newsletterId: newsletter.id,
                  userId: user?.id,
                },
              },
              readError instanceof Error ? readError : new Error(String(readError))
            );
          }
        }

        // Navigate to the newsletter detail
        navigate(`/newsletters/${newsletter.id}`, {
          state: {
            fromReadingQueue: true,
            from: '/queue',
          },
        });
      } catch (error) {
        log.error(
          'Unexpected error in newsletter click handler',
          {
            action: 'newsletter_click',
            metadata: {
              newsletterId: newsletter.id,
              userId: user?.id,
            },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Still navigate even if marking as read fails
        navigate(`/newsletters/${newsletter.id}`, {
          state: {
            fromReadingQueue: true,
            from: '/queue',
          },
        });
      }
    },
    [navigate, handleToggleRead, log, user?.id]
  );

  // Handle error state with toast notifications
  React.useEffect(() => {
    if (error) {
      toast.error(
        `Error loading reading queue: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [error]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
        const oldIndex = validQueueItems.findIndex((item) => item.id === active.id);
        const newIndex = validQueueItems.findIndex((item) => item.id === over?.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Reorder the items
        const reorderedItems = [...validQueueItems];
        const [movedItem] = reorderedItems.splice(oldIndex, 1);
        reorderedItems.splice(newIndex, 0, movedItem!);

        // Update positions in the database
        const updates = reorderedItems.map((item, index) => ({
          id: item.id,
          position: index,
        }));

        try {
          await reorderQueue(updates);
          // The query will automatically refetch due to the invalidation in the mutation
        } catch (error) {
          log.error(
            'Failed to update queue order',
            {
              action: 'reorder_queue',
              metadata: {
                userId: user?.id,
                newOrderCount: updates.length,
              },
            },
            error instanceof Error ? error : new Error(String(error))
          );
          toast.error('Failed to update queue order');
        }
      }
    },
    [validQueueItems, reorderQueue, log, user?.id]
  );

  // Handle toggling like status with shared actions
  const handleToggleLikeAction = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        // Handle both signatures: (id: string) and (newsletter: Newsletter)
        let newsletterObj: NewsletterWithRelations;

        if (typeof newsletter === 'string') {
          const item = validQueueItems.find((item: any) => item.newsletter.id === newsletter);
          if (!item) return;
          newsletterObj = item.newsletter;
        } else {
          newsletterObj = newsletter;
        }

        await handleToggleLike(newsletterObj);

        // Smart cache invalidation
        if (cacheManager) {
          cacheManager.smartInvalidate({
            operation: 'toggle-like',
            newsletterIds: [newsletterObj.id],
            priority: 'high',
          });
        }
      } catch (error) {
        log.error(
          'Failed to toggle like status',
          {
            action: 'toggle_like',
            metadata: {
              newsletterId: newsletter.id,
              userId: user?.id,
            },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleToggleLike, validQueueItems, cacheManager, log, user?.id]
  );

  // Handle toggling archive status with shared actions
  const handleToggleArchiveAction = useCallback(
    async (id: string) => {
      try {
        const item = validQueueItems.find((item) => item.newsletter.id === id);
        if (!item) return;

        await handleToggleArchive(item.newsletter);

        // Smart cache invalidation
        if (cacheManager) {
          cacheManager.smartInvalidate({
            operation: 'toggle-archive',
            newsletterIds: [id],
            priority: 'high',
          });
        }
      } catch (error) {
        log.error(
          'Failed to toggle archive status',
          {
            action: 'toggle_archive',
            metadata: {
              newsletterId: id,
              userId: user?.id,
            },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    [handleToggleArchive, validQueueItems, cacheManager, log, user?.id]
  );

  // Toggle sort mode between manual and date
  const toggleSortMode = useCallback(() => {
    setSortByDate((prev) => !prev);
  }, []);

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Sort items based on sort mode
  const sortedItems = useMemo(() => {
    const items = [...filteredQueueItems];

    return items.sort((a, b) => {
      if (!sortByDate) {
        // In manual sort mode, sort by position
        return a.position - b.position;
      } else {
        // In date sort mode, sort by received date
        const dateA = new Date(a.newsletter.received_at);
        const dateB = new Date(b.newsletter.received_at);
        return sortDirection === 'asc'
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }
    });
  }, [filteredQueueItems, sortByDate, sortDirection]);

  // Show error UI
  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">Failed to load reading queue. Please try again.</p>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div role="progressbar" className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Handle empty queue
  if (validQueueItems.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No newsletters in queue</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding some newsletters to your reading queue.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleBrowseNewsletters}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Browse Newsletters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/inbox')}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inbox
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reading Queue</h1>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {filteredQueueItems.length} {filteredQueueItems.length === 1 ? 'item' : 'items'}
            {selectedTagIds.size > 0 && validQueueItems.length !== filteredQueueItems.length && (
              <span className="ml-1 text-xs">({validQueueItems.length} total)</span>
            )}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleSortMode}
              className={`px-3 py-1 text-sm rounded-md ${sortByDate ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
            >
              {sortByDate ? 'Sort by Position' : 'Sort by Date'}
            </button>
            {sortByDate && (
              <button
                onClick={toggleSortDirection}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                title={sortDirection === 'asc' ? 'Oldest first' : 'Newest first'}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tag Filter Display */}
      {selectedTagIds.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Filtering by tags:</span>
              {Array.from(selectedTagIds).map((tagId) => {
                const tag = allTags.find((t) => t.id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedTagIds((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(tag.id);
                        return newSet;
                      });
                    }}
                  >
                    {tag.name}
                    <span className="ml-1">×</span>
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => setSelectedTagIds(new Set())}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Clear tags
            </button>
          </div>
        </div>
      )}

      {filteredQueueItems.length === 0 && selectedTagIds.size > 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No newsletters match the selected tags.</p>
          <button
            onClick={() => setSelectedTagIds(new Set())}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear tag filter
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 w-full">
              {sortedItems.map((item) => {
                // Convert NewsletterWithRelations to Newsletter type for SortableNewsletterRow
                const newsletter = {
                  ...item.newsletter,
                  newsletter_source_id: item.newsletter.newsletter_source_id || null,
                  source: item.newsletter.source || null,
                  tags: item.newsletter.tags || [],
                } as {
                  [key: string]: unknown;
                  source?: NewsletterSource | null;
                  newsletter_source_id?: string | null;
                  tags?: Tag[];
                  user_newsletter_tags?: Tag[];
                } & typeof item.newsletter;

                return (
                  <SortableNewsletterRow
                    key={item.id}
                    id={item.id}
                    newsletter={newsletter}
                    onToggleRead={handleToggleRead}
                    onToggleLike={async (id: string) => {
                      const newsletterToToggle = sortedItems.find(
                        (item: any) => item.newsletter.id === id
                      )?.newsletter;
                      if (newsletterToToggle) {
                        await handleToggleLikeAction(newsletterToToggle);
                      }
                    }}
                    onToggleArchive={handleToggleArchiveAction}
                    onToggleQueue={toggleInQueue}
                    onTrash={() => { }}
                    onNewsletterClick={(newsletter) => {
                      // Convert back to NewsletterWithRelations for handleNewsletterClick
                      const newsletterWithRelations = {
                        ...newsletter,
                        newsletter_source_id: newsletter.newsletter_source_id || null,
                        source: newsletter.source || null,
                        tags: newsletter.tags || [],
                        is_archived: newsletter.is_archived || false,
                      } as NewsletterWithRelations;
                      handleNewsletterClick(newsletterWithRelations);
                    }}
                    onUpdateTags={async (newsletterId, tagIds) => {
                      try {
                        const queueItem = readingQueue.find(
                          (item) => item.newsletter.id === newsletterId
                        );
                        if (!queueItem) {
                          toast.error('Newsletter not found in queue');
                          return;
                        }

                        // Optimistically update the UI with the new tags
                        const updatedTags = allTags.filter((tag) => tagIds.includes(tag.id));

                        // Update the cache with the new tags
                        setQueryData(['readingQueue', user?.id], (old: ReadingQueueItem[] = []) =>
                          old.map((item) => {
                            if (item.newsletter.id === newsletterId) {
                              return {
                                ...item,
                                newsletter: {
                                  ...item.newsletter,
                                  tags: updatedTags,
                                  // Update the user_newsletter_tags array if it exists
                                  user_newsletter_tags: updatedTags.map((tag) => ({
                                    id: `${newsletterId}-${tag.id}`,
                                    newsletter_id: newsletterId,
                                    tag_id: tag.id,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  })),
                                },
                              };
                            }
                            return item;
                          })
                        );

                        // Get current tag IDs for the newsletter
                        const currentTagIds =
                          queueItem.newsletter.tags?.map((tag: Tag) => tag.id) || [];

                        // Update tags in the database
                        if (user) {
                          try {
                            const result = await updateNewsletterTags(
                              newsletterId,
                              tagIds,
                              currentTagIds,
                              user.id
                            );

                            // Show success message with details
                            const message = [
                              result.added > 0 &&
                              `${result.added} tag${result.added !== 1 ? 's' : ''} added`,
                              result.removed > 0 &&
                              `${result.removed} tag${result.removed !== 1 ? 's' : ''} removed`,
                            ]
                              .filter(Boolean)
                              .join(', ');

                            toast.success(`Tags updated: ${message || 'No changes'}`);

                            // Refresh the queue to ensure we have the latest data
                            await refetch();
                          } catch (error) {
                            log.error(
                              'Failed to update newsletter tags',
                              {
                                action: 'update_tags',
                                metadata: {
                                  newsletterId: item.newsletter.id,
                                  userId: user?.id,
                                },
                              },
                              error instanceof Error ? error : new Error(String(error))
                            );
                            toast.error(
                              error instanceof Error ? error.message : 'Failed to update tags'
                            );
                            // Revert optimistic update on error
                            await refetch();
                          }
                        } else {
                          throw new Error('User not authenticated');
                        }
                      } catch (error) {
                        log.error(
                          'Failed to update newsletter tags',
                          {
                            action: 'update_tags',
                            metadata: {
                              newsletterId: item.newsletter.id,
                              userId: user?.id,
                            },
                          },
                          error instanceof Error ? error : new Error(String(error))
                        );
                        toast.error('Failed to update tags');
                        // Revert optimistic update on error
                        await refetch();
                      }
                    }}
                    onTagClick={(tag, e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      setSelectedTagIds((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(tag.id)) {
                          newSet.delete(tag.id);
                        } else {
                          newSet.add(tag.id);
                        }
                        return newSet;
                      });

                      log.debug('Tag filter toggled', {
                        action: 'toggle_tag_filter',
                        metadata: {
                          tagId: tag.id,
                          tagName: tag.name,
                          isSelected: !selectedTagIds.has(tag.id),
                        },
                      });
                    }}
                    onToggleTagVisibility={(id, e) => {
                      e.stopPropagation();
                      setVisibleTags((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(id)) {
                          newSet.delete(id);
                        } else {
                          newSet.add(id);
                        }
                        return newSet;
                      });
                    }}
                    onRemoveFromQueue={async (e, id) => {
                      e.stopPropagation();
                      await toggleInQueue(id);
                      await refetch();
                    }}
                    className={`${!sortByDate ? 'cursor-grab active:cursor-grabbing' : ''} bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow`}
                    isDraggable={!sortByDate}
                    showCheckbox={false}
                    showTags={true}
                    visibleTags={visibleTags}
                    readingQueue={readingQueue}
                    isDeletingNewsletter={false}
                    isInReadingQueue={true}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default ReadingQueuePage;
