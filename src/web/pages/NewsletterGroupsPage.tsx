import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  useNewsletters,
  useNewsletterSourceGroups,
  useNewsletterSources,
  useReadingQueue,
} from '@common/hooks';
import { useLogger } from '@common/utils/logger/useLogger';

import { newsletterApi } from '@common/api';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import {
  NewsletterSource,
  NewsletterSourceGroup,
} from '@common/types';
import { getCacheManager, prefetchQuery } from '@common/utils/cacheUtils';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';
import { CreateSourceGroupModal } from '@web/components/CreateSourceGroupModal';
// import NewsletterRow from '@web/components/NewsletterRow'; // Removed as individual newsletters are not shown
import { SourceGroupCard } from '@web/components/SourceGroupCard';
import { AlertTriangle, ArrowLeft, Check, FolderPlus, Loader2, X } from 'lucide-react';

const NewsletterGroupsPage: React.FC = () => {
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
  // const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set()); // Removed as individual newsletters are not shown
  // const [allTags, setAllTags] = useState<Tag[]>([]); // Removed as individual newsletters are not shown
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NewsletterSourceGroup | null>(null);

  // Fetch tags - No longer needed here as tags were for filtering individual newsletters
  // const { getTags } = useTags();
  // useEffect(() => {
  //   const fetchTags = async () => {
  //     try {
  //       const tags = await getTags();
  //       setAllTags(tags || []);
  //     } catch (error) {
  //       log.error('Failed to fetch tags', { error });
  //       setAllTags([]);
  //     }
  //   };
  //   fetchTags();
  // }, [getTags, log]);

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

  const { readingQueue: _readingQueue } = useReadingQueue(); // Renamed as it's not directly used for row display

  // Ref to track filter changes - must be outside useMemo
  const prevFilterKeyRef = React.useRef<string>();

  // Build newsletter filter with stable reference to prevent unnecessary refetches
  // This filter is for the useNewsletters hook, which is now only used for bulkArchive.
  // If other functionalities of useNewsletters were needed, this would be kept.
  // For now, it's simplified as its primary consumer (newsletter list) is gone.
  const newsletterFilter = useMemo(() => {
    const filter = {
      isArchived: false,
      sourceIds: selectedSourceId
        ? [selectedSourceId]
        : selectedGroupId
          ? selectedGroupSourceIds
          : undefined,
    };
    const filterKey = JSON.stringify(filter);
    if (prevFilterKeyRef.current !== filterKey) {
      log.debug('Newsletter filter built for potential operations (e.g., bulk archive)', {
        action: 'build_newsletter_filter',
        metadata: { selectedSourceId, selectedGroupId, selectedGroupSourceIds, filter },
      });
      prevFilterKeyRef.current = filterKey;
    }
    return filter;
  }, [selectedSourceId, selectedGroupId, selectedGroupSourceIds, log]);

  const {
    // newsletters: rawNewsletters = [], // No longer displaying individual newsletters
    // isLoadingNewsletters, // No longer displaying individual newsletters
    // isErrorNewsletters, // No longer displaying individual newsletters
    errorNewsletters, // Still potentially relevant if useNewsletters hook itself errors
    // errorTogglingLike, // Actions for individual newsletters removed
    bulkArchive, // Retained for source deletion logic
    // refetchNewsletters, // No longer displaying individual newsletters that would need refetching here
    // Extract mutations to pass to useSharedNewsletterActions
    markAsRead, // Actions for individual newsletters removed
    markAsUnread, // Actions for individual newsletters removed
    toggleLike, // Actions for individual newsletters removed
    toggleArchive, // Actions for individual newsletters removed
    deleteNewsletter, // Actions for individual newsletters removed
    toggleInQueue, // Actions for individual newsletters removed
    bulkMarkAsRead, // Actions for individual newsletters removed
    bulkMarkAsUnread, // Actions for individual newsletters removed
    bulkUnarchive, // Actions for individual newsletters removed
    bulkDeleteNewsletters, // Actions for individual newsletters removed
    updateNewsletterTags, // Actions for individual newsletters removed
  } = useNewsletters(newsletterFilter, {
    debug: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Kept to ensure hook behaves as before if other parts rely on it
  });

  // Memoize mutations object to prevent unnecessary re-renders
  // This is now simplified as many actions are no longer used on this page.
  const mutations = useMemo(() => ({
    markAsRead, // Kept in case any other part of useSharedNewsletterActions needs it
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkArchive, // This one is used
    bulkUnarchive,
    bulkDeleteNewsletters,
    updateNewsletterTags,
  }), [
    markAsRead, markAsUnread, toggleLike, toggleArchive, deleteNewsletter,
    toggleInQueue, bulkMarkAsRead, bulkMarkAsUnread, bulkArchive,
    bulkUnarchive, bulkDeleteNewsletters, updateNewsletterTags,
  ]);

  // Shared newsletter actions hook - primarily for bulkArchive now
  useSharedNewsletterActions( // Result not assigned as specific actions aren't called directly here
    mutations,
    {
      showToasts: true,
      optimisticUpdates: false,
      onSuccess: () => {/* Success handled by shared handlers */ },
      onError: (error) => { toast.error(error.message); },
    }
  );

  const [isActionInProgress, _setIsActionInProgress] = useState(false); // setIsActionInProgress might be unused now

  // Debug newsletters data - This section is no longer needed as individual newsletters are not fetched/displayed.
  // useEffect(() => {
  //   log.debug('Fetched newsletters updated', {
  //     action: 'newsletters_data_update',
  //     metadata: {
  //       count: fetchedNewsletters.length,
  //       selectedSourceId,
  //       selectedGroupId,
  //       newsletterIds: fetchedNewsletters.map((n) => n.id),
  //     },
  //   });
  // }, [fetchedNewsletters, selectedSourceId, selectedGroupId, log]);

  // Refetch when source or group filter changes - This is only for the list of newsletters, which is removed.
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
    // No longer refetching individual newsletters here.
    // log.debug('Source/Group filter changed, refetching newsletters', {
    //   action: 'source_filter_change_refetch',
    //   metadata: {
    //     selectedSourceId,
    //     selectedGroupId,
    //     selectedGroupSourceIds,
    //   },
    // });
    // refetchNewsletters(); // This was for the list of newsletters, now removed.
  }, [
    selectedSourceId,
    selectedGroupId,
    // selectedGroupSourceIds, // This is still used for filtering sources if a group is selected, but not for fetching newsletters
    // refetchNewsletters, // Removed
    isActionInProgress,
    log,
  ]);

  // handleTagClick is no longer needed as individual newsletters and their tags are not displayed.
  // const handleTagClick = useCallback(
  //   (tag: Tag, e: React.MouseEvent) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //
  //     setSelectedTagIds((prev) => {
  //       const newSet = new Set(prev);
  //       if (newSet.has(tag.id)) {
  //         newSet.delete(tag.id);
  //       } else {
  //         newSet.add(tag.id);
  //       }
  //       return newSet;
  //     });
  //
  //     log.debug('Tag filter toggled', {
  //       action: 'toggle_tag_filter',
  //       metadata: {
  //         tagId: tag.id,
  //         tagName: tag.name,
  //         isSelected: !selectedTagIds.has(tag.id),
  //       },
  //     });
  //   },
  //   [selectedTagIds, log]
  // );

  // Newsletter action wrappers are no longer needed as individual newsletters are not displayed.
  // const handleToggleLikeWrapper = ...
  // const handleToggleArchiveWrapper = ...
  // const handleToggleReadWrapper = ...
  // const handleToggleInQueueWrapper = ...
  // const handleTrashWrapper = ...
  // const handleNewsletterClick = ...


  useEffect(() => {
    if (errorNewsletters) { // This error is for the useNewsletters hook which is now minimal
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
            <h1 className="text-3xl font-bold text-primary-900">Manage Newsletter Groups</h1>
            <p className="text-gray-600 mt-1">
              Organize your newsletter sources into groups for easier management.
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

        {/* Remove newsletter sources grid and newsletter rows UI */}
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

export default NewsletterGroupsPage;
