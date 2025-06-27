import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  useNewsletters,
  useNewsletterSourceGroups,
  useNewsletterSources,
  useReadingQueue,
  useTags,
} from '@common/hooks';
import { useLogger } from '@common/utils/logger/useLogger';

import { newsletterApi } from '@common/api';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import {
  NewsletterSource,
  NewsletterSourceGroup,
  NewsletterWithRelations,
  Tag,
} from '@common/types';
import { getCacheManager, prefetchQuery } from '@common/utils/cacheUtils';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { CreateSourceGroupModal } from '@web/components/CreateSourceGroupModal';
import NewsletterRow from '@web/components/NewsletterRow';
import { SourceGroupCard } from '@web/components/SourceGroupCard';
import { AlertTriangle, ArrowLeft, Check, FolderPlus, Loader2, X } from 'lucide-react';

const NewslettersPage: React.FC = () => {
  const navigate = useNavigate();
  const log = useLogger();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalSourceId, setEditModalSourceId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initialize cache manager for advanced operations
  const cacheManager = useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      // Cache manager not initialized yet - will be available after first hook usage
      return null;
    }
  }, []);

  // Cache warming on component mount
  useEffect(() => {
    if (cacheManager) {
      // Warm up critical caches for better performance
      cacheManager.warmCache('newsletters-page', 'medium');
    }
  }, [cacheManager]);

  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    updateSource,
    setSourceArchiveStatus,
    isArchivingSource,
  } = useNewsletterSources();

  // Performance optimization: Preload newsletter data for popular sources
  useEffect(() => {
    if (cacheManager && newsletterSources.length > 0) {
      // Preload data for sources with high newsletter counts
      const popularSources = newsletterSources
        .filter((source) => source.newsletter_count && source.newsletter_count > 5)
        .slice(0, 3);

      popularSources.forEach(async (source) => {
        await prefetchQuery(
          [
            ...queryKeyFactory.newsletters.list({
              sourceId: source.id,
              filter: { isRead: false },
            }),
          ],
          async () => {
            // This would be replaced with actual fetch function
            return [];
          },
          { staleTime: 30000 }
        );
      });
    }
  }, [cacheManager, newsletterSources]);

  const [formData, setFormData] = useState({
    name: '',
    from: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle editing a source
  const handleEdit = (source: NewsletterSource) => {
    setFormData({
      name: source.name,
      from: source.from,
    });
    setEditingId(source.id);
    setEditModalSourceId(source.id);
    setShowEditModal(true);
    setUpdateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const name = formData?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      toast.error('Please enter a valid name');
      return;
    }
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateSource({
        id: editingId,
        name: formData.name,
      });
      toast.success('Source updated successfully');
      setShowEditModal(false);
      setEditModalSourceId(null);
    } catch (error) {
      log.error(
        'Failed to update newsletter source',
        {
          action: 'update_source',
          metadata: { sourceId: editModalSourceId },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      setUpdateError(error as Error);
      toast.error('Failed to update source');
    } finally {
      setIsUpdating(false);
    }
  };

  // State for selected source and groups
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NewsletterSourceGroup | null>(null);

  // Fetch tags
  const { getTags } = useTags();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tags = await getTags();
        setAllTags(tags || []);
      } catch (error) {
        log.error('Failed to fetch tags', { error });
        setAllTags([]);
      }
    };
    fetchTags();
  }, [getTags, log]);

  // Reset source selection when group is selected and vice versa
  useEffect(() => {
    if (selectedGroupId) {
      setSelectedSourceId(null);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedSourceId) {
      setSelectedGroupId(null);
    }
  }, [selectedSourceId]);

  // Fetch source groups
  const {
    groups: sourceGroups = [] as NewsletterSourceGroup[],
    isLoading: isLoadingGroups,
    isError: isGroupsError,
    deleteGroup,
  } = useNewsletterSourceGroups();

  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      try {
        await deleteGroup.mutateAsync(groupId);
        // If the deleted group was selected, clear the selection
        if (selectedGroupId === groupId) {
          setSelectedGroupId(null);
        }
      } catch (error) {
        log.error(
          'Failed to delete source group',
          {
            action: 'delete_group',
            metadata: { groupId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error('Failed to delete group');
      }
    },
    [deleteGroup, selectedGroupId, log]
  );

  // Memoize the groups to prevent unnecessary re-renders
  const groups = React.useMemo(() => sourceGroups, [sourceGroups]);

  // Get source IDs from selected group for filtering
  const selectedGroupSourceIds = React.useMemo(() => {
    if (!selectedGroupId) return [];

    const group = groups.find((g) => g.id === selectedGroupId);
    const sourceIds = group?.sources?.map((s) => s.id) || [];

    // Only log if there's a meaningful change to reduce log spam
    if (sourceIds.length > 0 || selectedGroupId) {
      log.debug('Selected group sources computed', {
        action: 'compute_group_sources',
        metadata: {
          selectedGroupId,
          foundGroup: group
            ? {
              id: group.id,
              name: group.name,
              sourceCount: group.sources?.length || 0,
            }
            : null,
          sourceIds,
          totalGroups: groups.length,
        },
      });
    }

    return sourceIds;
  }, [selectedGroupId, groups, log]);

  // Clear group filter
  const clearGroupFilter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroupId(null);
  }, []);

  // Debug modal states
  React.useEffect(() => {
    log.debug('Modal states changed', {
      action: 'modal_state_change',
      metadata: {
        isGroupModalOpen,
        showEditModal,
        deleteConfirmId: !!deleteConfirmId,
        anyModalOpen: isGroupModalOpen || showEditModal || !!deleteConfirmId,
      },
    });
  }, [isGroupModalOpen, showEditModal, deleteConfirmId, log]);

  // Handle archive source (delete confirmation)
  const handleArchiveSource = async (sourceId: string) => {
    setDeleteConfirmId(sourceId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const newslettersResponse = await newsletterApi.getAll({
        sourceIds: [deleteConfirmId],
        isArchived: false,
        limit: 1000, // Get all newsletters for this source
      });

      if (newslettersResponse.data && newslettersResponse.data.length > 0) {
        const newsletterIds = newslettersResponse.data.map((nl) => nl.id);
        await bulkArchive(newsletterIds);
      }
      await setSourceArchiveStatus(deleteConfirmId, true);
      toast.success('Source and its newsletters have been archived');
      if (selectedSourceId === deleteConfirmId) {
        setSelectedSourceId(null);
      }
    } catch (error) {
      log.error(
        'Failed to archive newsletter source',
        {
          action: 'archive_source',
          metadata: { deleteConfirmId },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive source';
      toast.error(errorMessage);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => setDeleteConfirmId(null);

  const { readingQueue } = useReadingQueue();

  // Ref to track filter changes - must be outside useMemo
  const prevFilterKeyRef = React.useRef<string>();

  // Build newsletter filter with stable reference to prevent unnecessary refetches
  const newsletterFilter = useMemo(() => {
    const filter = {
      isArchived: false, // Explicitly exclude archived newsletters
      sourceIds: selectedSourceId
        ? [selectedSourceId]
        : selectedGroupId
          ? selectedGroupSourceIds
          : undefined,
    };

    // Only log when filter actually changes to reduce log spam
    const filterKey = JSON.stringify(filter);

    if (prevFilterKeyRef.current !== filterKey) {
      log.debug('Newsletter filter built', {
        action: 'build_newsletter_filter',
        metadata: {
          selectedSourceId,
          selectedGroupId,
          selectedGroupSourceIds,
          filter,
        },
      });
      prevFilterKeyRef.current = filterKey;
    }

    return filter;
  }, [selectedSourceId, selectedGroupId, selectedGroupSourceIds, log]);

  const {
    newsletters: rawNewsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    errorTogglingLike,
    bulkArchive,
    refetchNewsletters,
    // Extract mutations to pass to useSharedNewsletterActions
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkUnarchive,
    bulkDeleteNewsletters,
    updateNewsletterTags,
  } = useNewsletters(newsletterFilter, {
    debug: true,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Use 30 second stale time to prevent excessive refetches
  });

  // Stable newsletter list with preserved order
  const [stableNewsletters, setStableNewsletters] = useState<NewsletterWithRelations[]>([]);

  // Update stable newsletter list while preserving order
  useEffect(() => {
    if (rawNewsletters.length === 0 && !isLoadingNewsletters) {
      setStableNewsletters([]);
      return;
    }

    if (rawNewsletters.length > 0) {
      setStableNewsletters((prevStable) => {
        const updatedNewsletters: NewsletterWithRelations[] = [];

        // First, add existing newsletters in their current order
        const existingIds = new Set(rawNewsletters.map((n) => n.id));

        // Keep existing newsletters in their current order
        prevStable.forEach((newsletter) => {
          if (existingIds.has(newsletter.id)) {
            const updated = rawNewsletters.find((n) => n.id === newsletter.id);
            if (updated) {
              updatedNewsletters.push(updated);
            }
          }
        });

        // Add new newsletters at the end
        rawNewsletters.forEach((newsletter) => {
          if (!updatedNewsletters.find((n) => n.id === newsletter.id)) {
            updatedNewsletters.push(newsletter);
          }
        });
        return updatedNewsletters;
      });
    }
  }, [rawNewsletters, isLoadingNewsletters]);

  // Apply local tag filtering
  const filteredNewsletters = useMemo(() => {
    if (selectedTagIds.size === 0) {
      return stableNewsletters;
    }

    return stableNewsletters.filter((newsletter) => {
      if (!newsletter.tags || newsletter.tags.length === 0) {
        return false;
      }

      // Newsletter must have ALL selected tags (AND logic)
      return Array.from(selectedTagIds).every((tagId) =>
        newsletter.tags?.some((tag) => tag.id === tagId)
      );
    });
  }, [stableNewsletters, selectedTagIds]);

  const fetchedNewsletters = filteredNewsletters;

  // Shared newsletter action handlers
  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleDeleteNewsletter,
    handleToggleInQueue,
    isUpdatingTags,
  } = useSharedNewsletterActions(
    {
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
    },
    {
      showToasts: true,
      optimisticUpdates: true,
      onSuccess: () => {
        // Success handled by shared handlers
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );

  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Stable keys for newsletter rows to prevent unnecessary re-renders
  const [stableKeys, setStableKeys] = useState<Map<string, string>>(new Map());

  // Generate stable keys for newsletters
  const newsletterIds = useMemo(
    () => fetchedNewsletters.map((n) => n.id).join(','),
    [fetchedNewsletters]
  );
  useEffect(() => {
    setStableKeys((prev) => {
      const newKeys = new Map(prev);
      fetchedNewsletters.forEach((newsletter) => {
        if (!newKeys.has(newsletter.id)) {
          newKeys.set(newsletter.id, `${newsletter.id}-${Date.now()}`);
        }
      });
      return newKeys;
    });
  }, [newsletterIds, fetchedNewsletters]);

  // Debug newsletters data
  // Debug fetched newsletters and trigger refetch on filter changes
  useEffect(() => {
    log.debug('Fetched newsletters updated', {
      action: 'newsletters_data_update',
      metadata: {
        count: fetchedNewsletters.length,
        selectedSourceId,
        selectedGroupId,
        newsletterIds: fetchedNewsletters.map((n) => n.id),
      },
    });
  }, [fetchedNewsletters, selectedSourceId, selectedGroupId, log]);

  // Refetch when source or group filter changes (but not for tag changes)
  useEffect(() => {
    // Skip refetch if action is in progress to preserve optimistic updates
    if (isActionInProgress) {
      log.debug('Skipping refetch - action in progress', {
        action: 'source_filter_change_refetch',
        metadata: { isActionInProgress },
      });
      return;
    }

    // Only refetch for source/group changes, not tag changes
    log.debug('Source/Group filter changed, refetching newsletters', {
      action: 'source_filter_change_refetch',
      metadata: {
        selectedSourceId,
        selectedGroupId,
        selectedGroupSourceIds,
      },
    });
    refetchNewsletters();
  }, [
    selectedSourceId,
    selectedGroupId,
    selectedGroupSourceIds,
    refetchNewsletters,
    isActionInProgress,
    log,
  ]);

  const handleTagClick = useCallback(
    (tag: Tag, e: React.MouseEvent) => {
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
    },
    [selectedTagIds, log]
  );

  // Newsletter action wrapper handlers with optimistic updates
  const handleToggleLikeWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      setIsActionInProgress(true);

      // Optimistic update for immediate feedback
      setStableNewsletters((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((n) => n.id === newsletter.id);
        if (index > -1) {
          updated[index] = {
            ...updated[index],
            is_liked: !updated[index].is_liked,
          };
        }
        return updated;
      });

      try {
        await handleToggleLike(newsletter);
        toast.success(newsletter.is_liked ? 'Newsletter unliked' : 'Newsletter liked');
      } catch (error) {
        // Revert optimistic update on error
        setStableNewsletters((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((n) => n.id === newsletter.id);
          if (index > -1) {
            updated[index] = {
              ...updated[index],
              is_liked: !updated[index].is_liked,
            };
          }
          return updated;
        });
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [handleToggleLike]
  );

  const handleToggleSelect = useCallback(async () => {
    // Implementation
  }, []);

  const handleToggleArchiveWrapper = useCallback(
    async (id: string) => {
      setIsActionInProgress(true);

      const newsletter = fetchedNewsletters.find((n) => n.id === id);
      if (!newsletter) {
        setIsActionInProgress(false);
        return;
      }

      const isCurrentlyArchived = newsletter.is_archived;
      const willBeArchived = !isCurrentlyArchived;

      // Optimistic update - remove from current view since this page shows non-archived
      if (willBeArchived) {
        // Archiving - remove from list since this page shows non-archived
        setStableNewsletters((prev) => prev.filter((n) => n.id !== id));
      } else {
        // Unarchiving - newsletter should appear if it matches current filters
        // For now, just update the status
        setStableNewsletters((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((n) => n.id === id);
          if (index > -1) {
            updated[index] = {
              ...updated[index],
              is_archived: false,
            };
          }
          return updated;
        });
      }

      try {
        await handleToggleArchive(newsletter);
        const successMessage = willBeArchived ? 'Newsletter archived' : 'Newsletter unarchived';
        toast.success(successMessage);
      } catch (error) {
        // Revert optimistic update on error
        if (willBeArchived) {
          // Restore newsletter to list if archive failed
          setStableNewsletters((prev) => [newsletter, ...prev]);
        } else {
          // Revert unarchive
          setStableNewsletters((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((n) => n.id === id);
            if (index > -1) {
              updated[index] = {
                ...updated[index],
                is_archived: true,
              };
            }
            return updated;
          });
        }
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [handleToggleArchive, fetchedNewsletters]
  );

  const handleToggleReadWrapper = useCallback(
    async (id: string) => {
      setIsActionInProgress(true);

      const newsletter = fetchedNewsletters.find((n) => n.id === id);
      if (!newsletter) {
        setIsActionInProgress(false);
        return;
      }

      // Optimistic update for immediate feedback
      setStableNewsletters((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((n) => n.id === id);
        if (index > -1) {
          updated[index] = {
            ...updated[index],
            is_read: !updated[index].is_read,
          };
        }
        return updated;
      });

      try {
        await handleToggleRead(newsletter);
        toast.success(newsletter.is_read ? 'Marked as unread' : 'Marked as read');
      } catch (error) {
        // Revert optimistic update on error
        setStableNewsletters((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((n) => n.id === id);
          if (index > -1) {
            updated[index] = {
              ...updated[index],
              is_read: !updated[index].is_read,
            };
          }
          return updated;
        });
        throw error;
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [handleToggleRead, fetchedNewsletters]
  );

  const handleToggleInQueueWrapper = useCallback(
    async (newsletterId: string) => {
      setIsActionInProgress(true);

      const newsletter = fetchedNewsletters.find((n) => n.id === newsletterId);
      if (!newsletter) {
        setIsActionInProgress(false);
        return;
      }

      // Check current queue status using actual reading queue data
      const isCurrentlyInQueue = readingQueue.some((item) => item.newsletter_id === newsletterId);

      try {
        await handleToggleInQueue(newsletter, isCurrentlyInQueue);
        toast.success(isCurrentlyInQueue ? 'Removed from queue' : 'Added to queue');
      } catch (error) {
        log.error(
          'Failed to toggle queue status',
          {
            action: 'toggle_queue',
            metadata: { newsletterId },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error('Failed to update queue status');
      } finally {
        setTimeout(() => setIsActionInProgress(false), 100);
      }
    },
    [handleToggleInQueue, fetchedNewsletters, readingQueue, log]
  );

  const handleTrashWrapper = useCallback(
    async (id: string) => {
      if (!window.confirm('Are you sure? This action is final and cannot be undone.')) {
        return;
      }

      await handleDeleteNewsletter(id);
    },
    [handleDeleteNewsletter]
  );

  const toggleTagVisibility = useCallback(
    (newsletterId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setVisibleTags((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(newsletterId)) {
          newSet.delete(newsletterId);
        } else {
          newSet.add(newsletterId);
        }
        return newSet;
      });
    },
    [setVisibleTags]
  );

  // Handle newsletter click with proper navigation state
  const handleNewsletterClick = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      try {
        // Mark as read if unread
        if (!newsletter.is_read) {
          try {
            await handleToggleRead(newsletter);
          } catch (readError) {
            log.error(
              'Failed to mark newsletter as read',
              {
                action: 'mark_as_read',
                metadata: { newsletterId: newsletter.id },
              },
              readError instanceof Error ? readError : new Error(String(readError))
            );
          }
        }

        // Archive the newsletter when opened from sources
        if (!newsletter.is_archived) {
          try {
            await handleToggleArchive(newsletter);
          } catch (archiveError) {
            log.error(
              'Failed to archive newsletter',
              {
                action: 'archive_newsletter',
                metadata: { newsletterId: newsletter.id },
              },
              archiveError instanceof Error ? archiveError : new Error(String(archiveError))
            );
          }
        }

        // Navigate to the newsletter detail with source context
        navigate(`/newsletters/${newsletter.id}`, {
          state: {
            fromNewsletterSources: true,
            from: '/newsletters',
            sourceId: newsletter.source?.id || newsletter.newsletter_source_id,
          },
        });
      } catch (error) {
        log.error(
          'Unexpected error in newsletter click handler',
          {
            action: 'newsletter_click',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Still navigate even if other actions fail
        navigate(`/newsletters/${newsletter.id}`, {
          state: {
            fromNewsletterSources: true,
            from: '/newsletters',
            sourceId: newsletter.source?.id || newsletter.newsletter_source_id,
          },
        });
      }
    },
    [navigate, handleToggleRead, handleToggleArchive, log]
  );

  useEffect(() => {
    if (errorNewsletters) {
      log.error(
        'Failed to load newsletters',
        {
          action: 'load_newsletters',
          metadata: { selectedSourceId, selectedGroupId },
        },
        errorNewsletters instanceof Error ? errorNewsletters : new Error(String(errorNewsletters))
      );
    }
  }, [errorNewsletters, log, selectedGroupId, selectedSourceId]);

  // Debug overlay and modal state tracking
  const anyModalOpen = isGroupModalOpen || showEditModal || !!deleteConfirmId;

  // Log modal state changes in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      log.debug('Modal state changed', {
        action: 'debug_modal_state',
        metadata: {
          isGroupModalOpen,
          showEditModal,
          deleteConfirmId,
          anyModalOpen,
        },
      });
    }
  }, [isGroupModalOpen, showEditModal, deleteConfirmId, anyModalOpen, log]);

  // Create a stable key for the SourceGroupsList to force re-render when modal state changes
  const modalStateKey = React.useMemo(
    () => ({
      isGroupModalOpen,
      showEditModal,
      hasDeleteConfirmId: !!deleteConfirmId,
      anyModalOpen,
    }),
    [isGroupModalOpen, showEditModal, deleteConfirmId, anyModalOpen]
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <main className="max-w-6xl w-full mx-auto p-6 bg-neutral-50">
        <button
          onClick={(e) => {
            e.preventDefault();
            // Use React Router's navigate for client-side navigation
            navigate('/inbox');
          }}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </button>

        <header className="mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary-900">Manage Newsletter Sources</h1>
            <p className="text-gray-600 mt-1">
              Define your newsletter sources by name and their primary email from.
            </p>
          </div>
        </header>

        {/* Groups Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-800">Your Groups</h2>
              {selectedGroupId && (
                <button
                  onClick={clearGroupFilter}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div
              style={{
                padding: '2px',
                background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                borderRadius: '0.375rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              <button
                onClick={() => {
                  log.debug('New Group button clicked', {
                    action: 'new_group_button_click',
                    metadata: {},
                  });
                  setEditingGroup(null);
                  setIsGroupModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '0.25rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  lineHeight: '1.25rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" style={{ color: 'white' }} />
                <span>New Group</span>
              </button>
            </div>
          </div>

          {isLoadingGroups ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Loading groups...
            </div>
          ) : isGroupsError ? (
            <div className="text-red-600 text-sm">Error loading groups</div>
          ) : groups.length === 0 ? (
            <div className="text-gray-500 text-sm">No groups created yet</div>
          ) : (
            <SourceGroupsList
              key={JSON.stringify(modalStateKey)}
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupClick={setSelectedGroupId}
              onEditGroup={(group) => {
                setEditingGroup(group);
                setIsGroupModalOpen(true);
              }}
              onDeleteGroup={handleDeleteGroup}
              isAnyModalOpen={modalStateKey.anyModalOpen}
            />
          )}
        </div>

        {/* Edit Modal */}
        <Transition.Root show={showEditModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => {
              setShowEditModal(false);
              setEditModalSourceId(null);
            }}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
            </Transition.Child>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="w-full bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
                    <div className="p-6">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 mb-4"
                      >
                        Edit Newsletter Source
                      </Dialog.Title>
                      <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                          <label
                            htmlFor="name"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Name
                          </label>
                          <input
                            type="text"
                            id="name"
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring focus:ring-blue-200"
                            value={formData.name}
                            onChange={handleInputChange}
                            name="name"
                            required
                          />
                        </div>
                        <div className="mb-4">
                          <label htmlFor="from" className="block text-sm font-medium text-gray-700">
                            From Email
                          </label>
                          <div className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 p-2 text-sm text-gray-600">
                            {formData.from}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="submit"
                            className={`inline-flex items-center px-4 py-2 font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${isUpdating
                              ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300'
                              }`}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Update Source
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                            onClick={() => {
                              setShowEditModal(false);
                              setEditModalSourceId(null);
                            }}
                            disabled={isUpdating}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </form>
                      {updateError && (
                        <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md mt-4">
                          <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                          <span>Error: {updateError.message}</span>
                        </div>
                      )}
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Delete Confirmation Modal */}
        <Transition.Root show={!!deleteConfirmId} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-[9999] overflow-y-auto"
            onClose={cancelDelete}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
            </Transition.Child>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="w-full bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
                    <div className="p-6">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 mb-4"
                      >
                        Delete Newsletter Source
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mb-6">
                        Are you sure you want to delete this source? This will archive all
                        newsletters from this source.
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 font-semibold rounded-md shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                          onClick={cancelDelete}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          onClick={confirmDelete}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Responsive Grid for Sources */}
        <section className="relative">
          {/* Gray overlay when editing */}
          {(showEditModal || !!deleteConfirmId) && (
            <div className="fixed inset-0 bg-gray-400 bg-opacity-40 z-40 pointer-events-auto transition-opacity" />
          )}
          {!isLoadingSources && !isErrorSources && newsletterSources.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-2 relative">
              {newsletterSources.map((source: NewsletterSource) => {
                const isEditing = editModalSourceId === source.id;
                const isDeleting = deleteConfirmId === source.id;
                // Only show buttons if not editing/deleting any card, or if this is the card being edited/deleted
                const showButtons =
                  !(showEditModal || !!deleteConfirmId) || isEditing || isDeleting;
                return (
                  <div
                    key={source.id}
                    className={`group relative rounded-xl border transition-colors shadow-sm p-4 bg-white hover:border-blue-300 hover:shadow-md flex flex-col justify-between cursor-pointer ${selectedSourceId === source.id
                      ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50'
                      : 'border-neutral-200'
                      }`}
                    style={{ minHeight: 170 }}
                    onClick={() => {
                      log.debug('Source selected', {
                        action: 'source_selection',
                        metadata: {
                          sourceId: source.id,
                          sourceName: source.name,
                          previousSelection: selectedSourceId,
                        },
                      });
                      setSelectedSourceId(source.id);
                    }}
                  >
                    {/* Edit/Delete icons on the right, only if allowed */}
                    {showButtons && !(isEditing || isDeleting) && (
                      <div className="absolute top-3 right-3 flex space-x-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(source);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 focus:outline-none rounded-full bg-white shadow"
                          title="Edit source"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveSource(source.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 focus:outline-none rounded-full bg-white shadow"
                          title="Delete source"
                          disabled={isArchivingSource}
                        >
                          {isArchivingSource ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                    <div className="flex-1 flex flex-col items-center justify-center pt-2 pb-4">
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3 ${selectedSourceId === source.id
                          ? 'bg-blue-200'
                          : 'bg-gray-100'
                          }`}
                      >
                        <span
                          className={`text-base sm:text-lg font-bold ${selectedSourceId === source.id ? 'text-blue-800' : 'text-gray-600'
                            }`}
                        >
                          {source.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3
                        className={`font-medium text-sm sm:text-sm truncate mb-0.5 max-w-full px-1 ${selectedSourceId === source.id ? 'text-blue-900' : 'text-neutral-900'
                          }`}
                        title={source.name}
                      >
                        {source.name}
                      </h3>
                      <p
                        className={`text-xs sm:text-xs truncate max-w-full px-1 ${selectedSourceId === source.id ? 'text-blue-700' : 'text-neutral-500'
                          }`}
                        title={source.from}
                      >
                        {source.from}
                      </p>
                    </div>
                    <div className="flex justify-center flex-col gap-0.5 sm:gap-1 mt-2">
                      {isLoadingSources ? (
                        <div className="h-4 sm:h-5 w-16 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        <>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {source.newsletter_count || 0}{' '}
                            {(source.newsletter_count || 0) === 1 ? 'newsletter' : 'newsletters'}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${source.unread_count ? 'bg-orange-100 text-orange-800' : 'bg-white text-gray-500'}`}
                          >
                            {source.unread_count || 0} unread
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Newsletters for selected source or group */}
        {(selectedSourceId || selectedGroupId) && (
          <section className="mt-12">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {selectedSourceId ? `Newsletters from this Source` : `Newsletters in this Group`}
              </h3>
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
                          onClick={(e) => handleTagClick(tag, e)}
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

            {isLoadingNewsletters ? (
              <div data-testid="loader-container" className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : isErrorNewsletters ? (
              <div className="text-center text-red-500 p-4">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p>Error loading newsletters: {errorNewsletters?.message || 'Unknown error'}</p>
              </div>
            ) : fetchedNewsletters.length === 0 ? (
              <div className="text-gray-500 italic">
                <p>No newsletters found for this {selectedSourceId ? 'source' : 'group'}.</p>
                <p className="text-xs mt-1">
                  Filter:{' '}
                  {selectedSourceId
                    ? `Source ID: ${selectedSourceId}`
                    : selectedGroupId
                      ? `Group ID: ${selectedGroupId}`
                      : 'None'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fetchedNewsletters.map((newsletter: NewsletterWithRelations) => (
                  <NewsletterRow
                    key={stableKeys.get(newsletter.id) || newsletter.id}
                    newsletter={newsletter}
                    isSelected={false}
                    onToggleSelect={handleToggleSelect}
                    onToggleLike={handleToggleLikeWrapper}
                    onToggleArchive={handleToggleArchiveWrapper}
                    onToggleRead={handleToggleReadWrapper}
                    onToggleQueue={handleToggleInQueueWrapper}
                    onTrash={handleTrashWrapper}
                    onToggleTagVisibility={toggleTagVisibility}
                    onTagClick={handleTagClick}
                    onNewsletterClick={handleNewsletterClick}
                    visibleTags={visibleTags}
                    readingQueue={readingQueue}
                    isInReadingQueue={readingQueue.some(
                      (item) => item.newsletter_id === newsletter.id
                    )}
                    isDeletingNewsletter={false}
                    loadingStates={{}}
                    errorTogglingLike={errorTogglingLike}
                    isUpdatingTags={isUpdatingTags}
                  />
                ))}
              </div>
            )}
          </section>
        )}
        {/* Create/Edit Group Modal */}
        <CreateSourceGroupModal
          isOpen={isGroupModalOpen}
          onClose={() => {
            setIsGroupModalOpen(false);
            setEditingGroup(null);
          }}
          sources={newsletterSources}
          groupToEdit={
            editingGroup
              ? {
                id: editingGroup.id,
                name: editingGroup.name,
                sources: editingGroup.sources || [],
              }
              : undefined
          }
        />
      </main>
    </div>
  );
};

// Separate component to force re-renders when modal state changes
const SourceGroupsList = React.memo(
  ({
    groups,
    selectedGroupId,
    onGroupClick,
    onEditGroup,
    isAnyModalOpen,
    onDeleteGroup,
  }: {
    groups: NewsletterSourceGroup[];
    selectedGroupId: string | null;
    onGroupClick: (groupId: string) => void;
    onEditGroup: (group: NewsletterSourceGroup) => void;
    isAnyModalOpen: boolean;
    onDeleteGroup: (groupId: string) => void;
  }) => {
    const log = useLogger();

    if (process.env.NODE_ENV === 'development') {
      log.debug('Rendering SourceGroupsList', {
        action: 'debug_component_render',
        metadata: { isAnyModalOpen },
      });
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {groups.map((group) => (
          <SourceGroupCard
            key={group.id}
            group={group}
            isSelected={group.id === selectedGroupId}
            onClick={() => onGroupClick(group.id)}
            onEdit={onEditGroup}
            onDelete={() => {
              if (selectedGroupId === group.id) {
                onGroupClick(''); // Clear the selected group
              }
              onDeleteGroup(group.id);
            }}
            isAnyModalOpen={isAnyModalOpen}
          />
        ))}
      </div>
    );
  }
);

export default NewslettersPage;
