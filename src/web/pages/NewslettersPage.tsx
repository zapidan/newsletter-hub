import React, {
  useState,
  useEffect,
  useCallback,
  Fragment,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { toast } from "react-hot-toast";
import { supabase } from "@common/services/supabaseClient";
import {
  updateNewsletterTags,
  handleTagClickWithNavigation,
} from "@common/utils/tagUtils";
import {
  useNewsletters,
  useNewsletterSources,
  useNewsletterSourceGroups,
  useReadingQueue,
} from "@common/hooks";
import { useSharedNewsletterActions } from "@common/hooks/useSharedNewsletterActions";
import {
  NewsletterSource,
  NewsletterSourceGroup,
  NewsletterWithRelations,
  Tag,
} from "@common/types";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  X,
  Check,
  FolderPlus,
} from "lucide-react";
import NewsletterRow from "@web/components/NewsletterRow";
import { CreateSourceGroupModal } from "@web/components/CreateSourceGroupModal";
import { SourceGroupCard } from "@web/components/SourceGroupCard";
import {
  getCacheManager,
  prefetchQuery,
  invalidateQueries,
} from "@common/utils/cacheUtils";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";

const NewslettersPage: React.FC = () => {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalSourceId, setEditModalSourceId] = useState<string | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [sourcesWithCounts, setSourcesWithCounts] = useState<
    NewsletterSource[]
  >([]);

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
      cacheManager.warmCache("newsletters-page", "medium");
    }
  }, [cacheManager]);

  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    updateSource,
    archiveNewsletterSource,
    isArchivingSource,
  } = useNewsletterSources();

  useEffect(() => {
    if (newsletterSources && newsletterSources.length > 0) {
      setSourcesWithCounts(newsletterSources);
      setIsLoadingCounts(false);
    } else if (!isLoadingSources) {
      setIsLoadingCounts(false);
    }
  }, [newsletterSources, isLoadingSources]);

  // Performance optimization: Preload newsletter data for popular sources
  useEffect(() => {
    if (cacheManager && sourcesWithCounts.length > 0) {
      // Preload data for sources with high newsletter counts
      const popularSources = sourcesWithCounts
        .filter(
          (source) =>
            (source as NewsletterSource & { newsletter_count?: number })
              .newsletter_count &&
            (source as NewsletterSource & { newsletter_count?: number })
              .newsletter_count! > 5,
        )
        .slice(0, 3);

      popularSources.forEach(async (source) => {
        await prefetchQuery(
          [
            ...queryKeyFactory.newsletters.list({
              sourceId: source.id,
              filter: "unread",
            }),
          ],
          async () => {
            // This would be replaced with actual fetch function
            return [];
          },
          { staleTime: 30000 },
        );
      });
    }
  }, [cacheManager, sourcesWithCounts]);

  const [formData, setFormData] = useState({
    name: "",
    domain: "",
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
      domain: source.domain,
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
    if (!name || typeof name !== "string" || !name.trim()) {
      toast.error("Please enter a valid name");
      return;
    }
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateSource(editingId, formData.name);
      toast.success("Source updated successfully");
      setShowEditModal(false);
      setEditModalSourceId(null);
    } catch (error) {
      console.error("Error updating source:", error);
      setUpdateError(error as Error);
      toast.error("Failed to update source");
    } finally {
      setIsUpdating(false);
    }
  };

  // State for selected source and groups
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] =
    useState<NewsletterSourceGroup | null>(null);
  const { bulkArchive } = useNewsletters();

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
        console.error("Error deleting group:", error);
        toast.error("Failed to delete group");
      }
    },
    [deleteGroup, selectedGroupId],
  );

  // Memoize the groups to prevent unnecessary re-renders
  const groups = React.useMemo(() => sourceGroups, [sourceGroups]);

  // Get source IDs from selected group for filtering
  const selectedGroupSourceIds = React.useMemo(() => {
    if (!selectedGroupId) return [];
    const group = groups.find((g) => g.id === selectedGroupId);
    return group?.sources?.map((s) => s.id) || [];
  }, [selectedGroupId, groups]);

  // Clear group filter
  const clearGroupFilter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroupId(null);
  }, []);

  // Debug modal states
  React.useEffect(() => {
    console.log("Modal states:", {
      isGroupModalOpen,
      showEditModal,
      deleteConfirmId: !!deleteConfirmId,
      anyModalOpen: isGroupModalOpen || showEditModal || !!deleteConfirmId,
    });
  }, [isGroupModalOpen, showEditModal, deleteConfirmId]);

  // Handle archive source (delete confirmation)
  const handleArchiveSource = async (sourceId: string) => {
    setDeleteConfirmId(sourceId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { data: newsletters, error: fetchError } = await supabase
        .from("newsletters")
        .select("id")
        .eq("newsletter_source_id", deleteConfirmId)
        .eq("is_archived", false);
      if (fetchError) throw fetchError;
      if (newsletters && newsletters.length > 0) {
        const newsletterIds = newsletters.map((nl) => nl.id);
        await bulkArchive(newsletterIds);
      }
      await archiveNewsletterSource(deleteConfirmId);
      toast.success("Source and its newsletters have been archived");
      if (selectedSourceId === deleteConfirmId) {
        setSelectedSourceId(null);
      }
    } catch (error) {
      console.error("Error archiving source:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to archive source";
      toast.error(errorMessage);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => setDeleteConfirmId(null);

  const { readingQueue } = useReadingQueue();

  const {
    newsletters: fetchedNewsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    errorTogglingLike,
  } = useNewsletters(
    undefined,
    selectedSourceId ? "all" : "all",
    selectedSourceId || undefined,
    selectedGroupId ? selectedGroupSourceIds : undefined,
  ) as {
    newsletters: NewsletterWithRelations[];
    isLoadingNewsletters: boolean;
    isErrorNewsletters: boolean;
    errorNewsletters: Error | null;
    errorTogglingLike: Error | null;
  };

  // Shared newsletter action handlers
  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleDeleteNewsletter,
    handleToggleInQueue,
  } = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
    onSuccess: () => {
      // Success handled by shared handlers
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [newsletters, setNewsletters] = useState<NewsletterWithRelations[]>(
    fetchedNewsletters || [],
  );
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());

  // Update local state when fetchedNewsletters changes, but only if the data is different
  useEffect(() => {
    if (
      fetchedNewsletters &&
      JSON.stringify(fetchedNewsletters) !== JSON.stringify(newsletters)
    ) {
      setNewsletters(fetchedNewsletters);
    }
  }, [fetchedNewsletters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTagClick = useCallback(
    (tag: Tag, e: React.MouseEvent) => {
      handleTagClickWithNavigation(tag, navigate, "/inbox", e);
    },
    [navigate],
  );

  // Newsletter action wrapper handlers
  const handleToggleLikeWrapper = useCallback(
    async (newsletter: NewsletterWithRelations) => {
      await handleToggleLike(newsletter);
    },
    [handleToggleLike],
  );

  const handleToggleSelect = useCallback(async () => {
    // Implementation
  }, []);

  const handleToggleArchiveWrapper = useCallback(
    async (id: string) => {
      const newsletter = newsletters.find((n) => n.id === id);
      if (!newsletter) return;

      // For source view, always archive (since we only show unarchived)
      const willArchive = selectedSourceId ? true : !newsletter.is_archived;

      // Optimistically update local state
      setNewsletters((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_archived: willArchive } : n)),
      );

      try {
        await handleToggleArchive(newsletter, willArchive);
      } catch (error) {
        // Revert optimistic update on error
        setNewsletters(fetchedNewsletters || []);
        throw error;
      }
    },
    [
      handleToggleArchive,
      newsletters,
      selectedSourceId,
      setNewsletters,
      fetchedNewsletters,
    ],
  );

  const handleToggleReadWrapper = useCallback(
    async (id: string) => {
      const newsletter = newsletters.find((n) => n.id === id);
      if (!newsletter) return;
      await handleToggleRead(newsletter);
    },
    [handleToggleRead, newsletters],
  );

  const handleToggleQueueWrapper = useCallback(
    async (newsletterId: string) => {
      const newsletter = newsletters.find((n) => n.id === newsletterId);
      if (!newsletter) return;
      await handleToggleInQueue(newsletter);
    },
    [handleToggleInQueue, newsletters],
  );

  const handleTrashWrapper = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Are you sure? This action is final and cannot be undone.",
        )
      ) {
        return;
      }

      // Optimistically remove from local state
      setNewsletters((prev) => prev.filter((n) => n.id !== id));

      try {
        await handleDeleteNewsletter(id);
      } catch (error) {
        // Restore newsletter on error
        setNewsletters(fetchedNewsletters || []);
        throw error;
      }
    },
    [handleDeleteNewsletter, setNewsletters, fetchedNewsletters],
  );

  const handleUpdateTags = useCallback(
    async (newsletterId: string, tagIds: string[]): Promise<void> => {
      try {
        // Get the current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("User not authenticated");
          toast.error("You must be logged in to update tags");
          return;
        }

        // Get current tags for the newsletter to calculate what changed
        const { data: currentTags } = await supabase
          .from("newsletter_tags")
          .select("tag_id")
          .eq("newsletter_id", newsletterId)
          .eq("user_id", user.id);

        const currentTagIds = currentTags?.map((t) => t.tag_id) || [];

        // Use the updateNewsletterTags utility function to handle the update
        await updateNewsletterTags(
          newsletterId,
          tagIds,
          currentTagIds,
          user.id,
        );

        // Invalidate the newsletters query to refresh the UI
        await invalidateQueries({ queryKey: ["newsletters"] });
        toast.success("Tags updated successfully");
      } catch (error) {
        console.error("Error updating tags:", error);
        toast.error("Failed to update tags");
      }
    },
    [],
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
    [],
  );

  useEffect(() => {
    if (errorNewsletters) {
      console.error("Error loading newsletters:", errorNewsletters);
    }
  }, [errorNewsletters]);

  // Debug overlay and modal state tracking
  const anyModalOpen = isGroupModalOpen || showEditModal || !!deleteConfirmId;

  // Log modal state changes in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Modal state changed:", {
        isGroupModalOpen,
        showEditModal,
        deleteConfirmId,
        anyModalOpen,
      });
    }
  }, [isGroupModalOpen, showEditModal, deleteConfirmId, anyModalOpen]);

  // Create a stable key for the SourceGroupsList to force re-render when modal state changes
  const modalStateKey = React.useMemo(
    () => ({
      isGroupModalOpen,
      showEditModal,
      hasDeleteConfirmId: !!deleteConfirmId,
      anyModalOpen,
    }),
    [isGroupModalOpen, showEditModal, deleteConfirmId, anyModalOpen],
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <main className="max-w-6xl w-full mx-auto p-6 bg-neutral-50">
        <button
          onClick={(e) => {
            e.preventDefault();
            // Use React Router's navigate for client-side navigation
            navigate("/inbox");
          }}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </button>

        <header className="mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary-900">
              Manage Newsletter Sources
            </h1>
            <p className="text-gray-600 mt-1">
              Define your newsletter sources by name and their primary email
              domain.
            </p>
          </div>
        </header>

        {/* Groups Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-800">
                Your Groups
              </h2>
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
                padding: "2px",
                background: "linear-gradient(45deg, #3b82f6, #1d4ed8)",
                borderRadius: "0.375rem",
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              }}
            >
              <button
                onClick={() => {
                  console.log("New Group button clicked");
                  setEditingGroup(null);
                  setIsGroupModalOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem 1rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  borderRadius: "0.25rem",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  lineHeight: "1.25rem",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#1d4ed8";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb";
                }}
              >
                <FolderPlus
                  className="mr-2 h-4 w-4"
                  style={{ color: "white" }}
                />
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
                          <label
                            htmlFor="domain"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Domain
                          </label>
                          <div className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 p-2 text-sm text-gray-600">
                            {formData.domain}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="submit"
                            className={`inline-flex items-center px-4 py-2 font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              isUpdating
                                ? "bg-gray-200 text-gray-700 cursor-not-allowed"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300"
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
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
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
                          <AlertTriangle
                            size={18}
                            className="mr-2 flex-shrink-0"
                          />
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
                        Are you sure you want to delete this source? This will
                        archive all newsletters from this source.
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
          {!isLoadingSources &&
            !isErrorSources &&
            sourcesWithCounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-2 relative z-50">
                {sourcesWithCounts.map((source: NewsletterSource) => {
                  const isEditing = editModalSourceId === source.id;
                  const isDeleting = deleteConfirmId === source.id;
                  // Only show buttons if not editing/deleting any card, or if this is the card being edited/deleted
                  const showButtons =
                    !(showEditModal || !!deleteConfirmId) ||
                    isEditing ||
                    isDeleting;
                  return (
                    <div
                      key={source.id}
                      className={`group relative rounded-xl border transition-colors shadow-sm p-4 bg-white hover:border-blue-300 hover:shadow-md flex flex-col justify-between cursor-pointer ${
                        selectedSourceId === source.id
                          ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50"
                          : "border-neutral-200"
                      }`}
                      style={{ minHeight: 170 }}
                      onClick={() => setSelectedSourceId(source.id)}
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
                          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                            selectedSourceId === source.id
                              ? "bg-blue-200"
                              : "bg-gray-100"
                          }`}
                        >
                          <span
                            className={`text-lg font-bold ${
                              selectedSourceId === source.id
                                ? "text-blue-800"
                                : "text-gray-600"
                            }`}
                          >
                            {source.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <h3
                          className={`font-medium text-xs truncate mb-1 max-w-full px-2 ${
                            selectedSourceId === source.id
                              ? "text-blue-900"
                              : "text-neutral-900"
                          }`}
                          title={source.name}
                        >
                          {source.name}
                        </h3>
                        <p
                          className={`text-xs truncate max-w-full ${
                            selectedSourceId === source.id
                              ? "text-blue-700"
                              : "text-neutral-500"
                          }`}
                          title={source.domain}
                        >
                          {source.domain}
                        </p>
                      </div>
                      <div className="flex justify-center">
                        {isLoadingCounts ? (
                          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {source.newsletter_count || 0}{" "}
                            {source.newsletter_count === 1
                              ? "newsletter"
                              : "newsletters"}
                          </span>
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
              <h3 className="text-lg font-semibold text-primary-800">
                {selectedSourceId
                  ? `Newsletters from this Source`
                  : `Newsletters in this Group`}
              </h3>
              {(selectedGroupId || selectedSourceId) && (
                <button
                  onClick={() => {
                    setSelectedSourceId(null);
                    setSelectedGroupId(null);
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            {isLoadingNewsletters ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : isErrorNewsletters ? (
              <div className="text-center text-red-500 p-4">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p>
                  Error loading newsletters:{" "}
                  {errorNewsletters?.message || "Unknown error"}
                </p>
              </div>
            ) : newsletters.length === 0 ? (
              <p className="text-gray-500 italic">
                No newsletters found for this source.
              </p>
            ) : (
              <div className="space-y-2">
                {newsletters.map((newsletter: NewsletterWithRelations) => (
                  <NewsletterRow
                    key={newsletter.id}
                    newsletter={newsletter}
                    isSelected={false}
                    onToggleSelect={handleToggleSelect}
                    onToggleLike={handleToggleLikeWrapper}
                    onToggleArchive={handleToggleArchiveWrapper}
                    onToggleRead={handleToggleReadWrapper}
                    onToggleQueue={handleToggleQueueWrapper}
                    onTrash={handleTrashWrapper}
                    onToggleTagVisibility={toggleTagVisibility}
                    onUpdateTags={handleUpdateTags}
                    onTagClick={handleTagClick}
                    visibleTags={visibleTags}
                    readingQueue={readingQueue}
                    isInReadingQueue={readingQueue.some(
                      (item) => item.newsletter_id === newsletter.id,
                    )}
                    isDeletingNewsletter={false}
                    loadingStates={{}}
                    errorTogglingLike={errorTogglingLike}
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
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Rendering SourceGroupsList with isAnyModalOpen:",
        isAnyModalOpen,
      );
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
                onGroupClick(""); // Clear the selected group
              }
              onDeleteGroup(group.id);
            }}
            isAnyModalOpen={isAnyModalOpen}
          />
        ))}
      </div>
    );
  },
);

export default NewslettersPage;
