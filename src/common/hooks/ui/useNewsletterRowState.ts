import { useState, useCallback, useMemo } from "react";
import { NewsletterWithRelations } from "@common/types";

export interface NewsletterRowState {
  // Selection state
  isSelected: boolean;

  // Visibility state
  showTags: boolean;
  showCheckbox: boolean;

  // Interaction state
  isHovered: boolean;
  isDragging: boolean;

  // Loading states for individual actions
  isTogglingRead: boolean;
  isTogglingLike: boolean;
  isTogglingArchive: boolean;
  isTogglingQueue: boolean;
  isUpdatingTags: boolean;

  // Error states
  tagUpdateError: string | null;
}

export interface UseNewsletterRowStateOptions {
  newsletter: NewsletterWithRelations;
  initialSelected?: boolean;
  initialShowTags?: boolean;
  initialShowCheckbox?: boolean;
  onSelectionChange?: (newsletterId: string, isSelected: boolean) => void;
  onTagVisibilityChange?: (newsletterId: string, isVisible: boolean) => void;
}

export function useNewsletterRowState(options: UseNewsletterRowStateOptions) {
  const {
    newsletter,
    initialSelected = false,
    initialShowTags = false,
    initialShowCheckbox = false,
    onSelectionChange,
    onTagVisibilityChange,
  } = options;

  // Selection state
  const [isSelected, setIsSelected] = useState(initialSelected);

  // Visibility state
  const [showTags, setShowTags] = useState(initialShowTags);
  const [showCheckbox, setShowCheckbox] = useState(initialShowCheckbox);

  // Interaction state
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Loading states
  const [isTogglingRead, setIsTogglingRead] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [isTogglingArchive, setIsTogglingArchive] = useState(false);
  const [isTogglingQueue, setIsTogglingQueue] = useState(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);

  // Error states
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

  // Selection handlers
  const handleToggleSelect = useCallback(() => {
    const newSelected = !isSelected;
    setIsSelected(newSelected);
    onSelectionChange?.(newsletter.id, newSelected);
  }, [isSelected, newsletter.id, onSelectionChange]);

  const handleSetSelected = useCallback(
    (selected: boolean) => {
      setIsSelected(selected);
      onSelectionChange?.(newsletter.id, selected);
    },
    [newsletter.id, onSelectionChange],
  );

  // Tag visibility handlers
  const handleToggleTagVisibility = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const newShowTags = !showTags;
      setShowTags(newShowTags);
      onTagVisibilityChange?.(newsletter.id, newShowTags);
    },
    [showTags, newsletter.id, onTagVisibilityChange],
  );

  const handleSetTagVisibility = useCallback(
    (visible: boolean) => {
      setShowTags(visible);
      onTagVisibilityChange?.(newsletter.id, visible);
    },
    [newsletter.id, onTagVisibilityChange],
  );

  // Interaction handlers
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Loading state handlers
  const setLoadingState = useCallback((operation: string, loading: boolean) => {
    switch (operation) {
      case "read":
        setIsTogglingRead(loading);
        break;
      case "like":
        setIsTogglingLike(loading);
        break;
      case "archive":
        setIsTogglingArchive(loading);
        break;
      case "queue":
        setIsTogglingQueue(loading);
        break;
      case "tags":
        setIsUpdatingTags(loading);
        break;
    }
  }, []);

  // Error handlers
  const handleTagUpdateError = useCallback((error: string | null) => {
    setTagUpdateError(error);
  }, []);

  const handleDismissTagError = useCallback(() => {
    setTagUpdateError(null);
  }, []);

  // Computed state
  const state = useMemo<NewsletterRowState>(
    () => ({
      isSelected,
      showTags,
      showCheckbox,
      isHovered,
      isDragging,
      isTogglingRead,
      isTogglingLike,
      isTogglingArchive,
      isTogglingQueue,
      isUpdatingTags,
      tagUpdateError,
    }),
    [
      isSelected,
      showTags,
      showCheckbox,
      isHovered,
      isDragging,
      isTogglingRead,
      isTogglingLike,
      isTogglingArchive,
      isTogglingQueue,
      isUpdatingTags,
      tagUpdateError,
    ],
  );

  // Computed flags for UI logic
  const hasAnyLoading = useMemo(
    () =>
      isTogglingRead ||
      isTogglingLike ||
      isTogglingArchive ||
      isTogglingQueue ||
      isUpdatingTags,
    [
      isTogglingRead,
      isTogglingLike,
      isTogglingArchive,
      isTogglingQueue,
      isUpdatingTags,
    ],
  );

  const canInteract = useMemo(
    () => !hasAnyLoading && !isDragging,
    [hasAnyLoading, isDragging],
  );

  const showLoadingIndicator = useMemo(
    () => hasAnyLoading || isDragging,
    [hasAnyLoading, isDragging],
  );

  return {
    // Current state
    state,

    // Computed flags
    hasAnyLoading,
    canInteract,
    showLoadingIndicator,

    // Selection handlers
    toggleSelect: handleToggleSelect,
    setSelected: handleSetSelected,

    // Tag visibility handlers
    toggleTagVisibility: handleToggleTagVisibility,
    setTagVisibility: handleSetTagVisibility,

    // Interaction handlers
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,

    // Loading state handlers
    setLoadingState,

    // Error handlers
    setTagUpdateError: handleTagUpdateError,
    dismissTagError: handleDismissTagError,

    // Convenience setters for specific states
    setShowCheckbox,
    setShowTags,
  };
}
