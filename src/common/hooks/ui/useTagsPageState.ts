import { useState, useCallback, useMemo } from "react";
import { Tag, TagWithCount } from "@common/types";

export interface TagsPageState {
  // Create new tag state
  isCreating: boolean;
  newTagName: string;
  newTagColor: string;

  // Edit existing tag state
  editingTagId: string | null;
  editTagName: string;
  editTagColor: string;

  // Search and filter state
  searchQuery: string;
  selectedTags: Set<string>;
  sortBy: "name" | "usage" | "created_at";
  sortOrder: "asc" | "desc";

  // UI state
  showCreateForm: boolean;
  showBulkActions: boolean;
  isSelectMode: boolean;

  // Loading states
  isCreatingTag: boolean;
  isUpdatingTag: boolean;
  isDeletingTag: string | null;
  isBulkOperationInProgress: boolean;

  // Error states
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
  bulkError: string | null;
}

export interface UseTagsPageStateOptions {
  initialSortBy?: "name" | "usage" | "created_at";
  initialSortOrder?: "asc" | "desc";
  defaultTagColor?: string;
  onTagCreated?: (tag: Tag) => void;
  onTagUpdated?: (tag: Tag) => void;
  onTagDeleted?: (tagId: string) => void;
  onBulkOperation?: (operation: string, tagIds: string[]) => void;
}

export function useTagsPageState(options: UseTagsPageStateOptions = {}) {
  const {
    initialSortBy = "name",
    initialSortOrder = "asc",
    defaultTagColor = "#3b82f6",
    onTagCreated,
    onTagUpdated,
    onTagDeleted,
    onBulkOperation,
  } = options;

  // Create new tag state
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(defaultTagColor);

  // Edit existing tag state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "usage" | "created_at">(
    initialSortBy,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Loading states
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState<string | null>(null);
  const [isBulkOperationInProgress, setIsBulkOperationInProgress] =
    useState(false);

  // Error states
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Create tag handlers
  const handleStartCreate = useCallback(() => {
    setIsCreating(true);
    setShowCreateForm(true);
    setNewTagName("");
    setNewTagColor(defaultTagColor);
    setCreateError(null);
  }, [defaultTagColor]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setShowCreateForm(false);
    setNewTagName("");
    setNewTagColor(defaultTagColor);
    setCreateError(null);
  }, [defaultTagColor]);

  const handleCreateTagStart = useCallback(() => {
    setIsCreatingTag(true);
    setCreateError(null);
  }, []);

  const handleCreateTagSuccess = useCallback(
    (tag: Tag) => {
      setIsCreatingTag(false);
      setIsCreating(false);
      setShowCreateForm(false);
      setNewTagName("");
      setNewTagColor(defaultTagColor);
      setCreateError(null);
      onTagCreated?.(tag);
    },
    [defaultTagColor, onTagCreated],
  );

  const handleCreateTagError = useCallback((error: string) => {
    setIsCreatingTag(false);
    setCreateError(error);
  }, []);

  // Edit tag handlers
  const handleStartEdit = useCallback((tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setUpdateError(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("");
    setUpdateError(null);
  }, []);

  const handleUpdateTagStart = useCallback(() => {
    setIsUpdatingTag(true);
    setUpdateError(null);
  }, []);

  const handleUpdateTagSuccess = useCallback(
    (tag: Tag) => {
      setIsUpdatingTag(false);
      setEditingTagId(null);
      setEditTagName("");
      setEditTagColor("");
      setUpdateError(null);
      onTagUpdated?.(tag);
    },
    [onTagUpdated],
  );

  const handleUpdateTagError = useCallback((error: string) => {
    setIsUpdatingTag(false);
    setUpdateError(error);
  }, []);

  // Delete tag handlers
  const handleDeleteTagStart = useCallback((tagId: string) => {
    setIsDeletingTag(tagId);
    setDeleteError(null);
  }, []);

  const handleDeleteTagSuccess = useCallback(
    (tagId: string) => {
      setIsDeletingTag(null);
      setDeleteError(null);
      // Remove from selected tags if it was selected
      setSelectedTags((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
      onTagDeleted?.(tagId);
    },
    [onTagDeleted],
  );

  const handleDeleteTagError = useCallback((error: string) => {
    setIsDeletingTag(null);
    setDeleteError(error);
  }, []);

  // Selection handlers
  const handleToggleSelect = useCallback((tagId: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((tagIds: string[]) => {
    setSelectedTags(new Set(tagIds));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTags(new Set());
  }, []);

  const handleToggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) {
        // Exiting select mode, clear selection
        setSelectedTags(new Set());
      }
      return !prev;
    });
  }, []);

  // Search and filter handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSortChange = useCallback(
    (newSortBy: "name" | "usage" | "created_at") => {
      if (sortBy === newSortBy) {
        // Toggle sort order if same field
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(newSortBy);
        setSortOrder("asc");
      }
    },
    [sortBy],
  );

  // Bulk operation handlers
  const handleBulkOperationStart = useCallback(() => {
    setIsBulkOperationInProgress(true);
    setBulkError(null);
  }, []);

  const handleBulkOperationSuccess = useCallback(
    (_operation: string, tagIds: string[]) => {
      setIsBulkOperationInProgress(false);
      setBulkError(null);
      setSelectedTags(new Set()); // Clear selection after bulk operation
      onBulkOperation?.(_operation, tagIds);
    },
    [onBulkOperation],
  );

  const handleBulkOperationError = useCallback((error: string) => {
    setIsBulkOperationInProgress(false);
    setBulkError(error);
  }, []);

  // Error dismissal handlers
  const handleDismissCreateError = useCallback(() => {
    setCreateError(null);
  }, []);

  const handleDismissUpdateError = useCallback(() => {
    setUpdateError(null);
  }, []);

  const handleDismissDeleteError = useCallback(() => {
    setDeleteError(null);
  }, []);

  const handleDismissBulkError = useCallback(() => {
    setBulkError(null);
  }, []);

  // Filter and sort tags
  const filterAndSortTags = useCallback(
    (tags: TagWithCount[]) => {
      let filtered = tags;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((tag) =>
          tag.name.toLowerCase().includes(query),
        );
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "usage":
            comparison = (a.newsletter_count || 0) - (b.newsletter_count || 0);
            break;
          case "created_at":
            comparison =
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime();
            break;
        }

        return sortOrder === "desc" ? -comparison : comparison;
      });

      return filtered;
    },
    [searchQuery, sortBy, sortOrder],
  );

  // Computed state
  const state = useMemo<TagsPageState>(
    () => ({
      isCreating,
      newTagName,
      newTagColor,
      editingTagId,
      editTagName,
      editTagColor,
      searchQuery,
      selectedTags,
      sortBy,
      sortOrder,
      showCreateForm,
      showBulkActions: selectedTags.size > 0,
      isSelectMode,
      isCreatingTag,
      isUpdatingTag,
      isDeletingTag,
      isBulkOperationInProgress,
      createError,
      updateError,
      deleteError,
      bulkError,
    }),
    [
      isCreating,
      newTagName,
      newTagColor,
      editingTagId,
      editTagName,
      editTagColor,
      searchQuery,
      selectedTags,
      sortBy,
      sortOrder,
      showCreateForm,
      isSelectMode,
      isCreatingTag,
      isUpdatingTag,
      isDeletingTag,
      isBulkOperationInProgress,
      createError,
      updateError,
      deleteError,
      bulkError,
    ],
  );

  // Computed flags
  const hasSelection = useMemo(
    () => selectedTags.size > 0,
    [selectedTags.size],
  );
  const hasMultipleSelection = useMemo(
    () => selectedTags.size > 1,
    [selectedTags.size],
  );
  const canPerformBulkActions = useMemo(
    () => hasSelection && !isBulkOperationInProgress,
    [hasSelection, isBulkOperationInProgress],
  );
  const hasAnyError = useMemo(
    () => !!(createError || updateError || deleteError || bulkError),
    [createError, updateError, deleteError, bulkError],
  );
  const hasAnyLoading = useMemo(
    () =>
      isCreatingTag ||
      isUpdatingTag ||
      !!isDeletingTag ||
      isBulkOperationInProgress,
    [isCreatingTag, isUpdatingTag, isDeletingTag, isBulkOperationInProgress],
  );

  return {
    // Current state
    state,

    // Computed flags
    hasSelection,
    hasMultipleSelection,
    canPerformBulkActions,
    hasAnyError,
    hasAnyLoading,

    // Create tag handlers
    startCreate: handleStartCreate,
    cancelCreate: handleCancelCreate,
    setNewTagName,
    setNewTagColor,

    // Edit tag handlers
    startEdit: handleStartEdit,
    cancelEdit: handleCancelEdit,
    setEditTagName,
    setEditTagColor,

    // Selection handlers
    toggleSelect: handleToggleSelect,
    selectAll: handleSelectAll,
    clearSelection: handleClearSelection,
    toggleSelectMode: handleToggleSelectMode,

    // Search and filter handlers
    setSearchQuery: handleSearchChange,
    setSortBy: handleSortChange,
    filterAndSortTags,

    // Operation state handlers
    onCreateStart: handleCreateTagStart,
    onCreateSuccess: handleCreateTagSuccess,
    onCreateError: handleCreateTagError,
    onUpdateStart: handleUpdateTagStart,
    onUpdateSuccess: handleUpdateTagSuccess,
    onUpdateError: handleUpdateTagError,
    onDeleteStart: handleDeleteTagStart,
    onDeleteSuccess: handleDeleteTagSuccess,
    onDeleteError: handleDeleteTagError,
    onBulkStart: handleBulkOperationStart,
    onBulkSuccess: handleBulkOperationSuccess,
    onBulkError: handleBulkOperationError,

    // Error dismissal handlers
    dismissCreateError: handleDismissCreateError,
    dismissUpdateError: handleDismissUpdateError,
    dismissDeleteError: handleDismissDeleteError,
    dismissBulkError: handleDismissBulkError,

    // Utility getters
    getSelectedTagIds: () => Array.from(selectedTags),
    isTagSelected: (tagId: string) => selectedTags.has(tagId),
    isTagBeingDeleted: (tagId: string) => isDeletingTag === tagId,
    isTagBeingEdited: (tagId: string) => editingTagId === tagId,
  };
}
