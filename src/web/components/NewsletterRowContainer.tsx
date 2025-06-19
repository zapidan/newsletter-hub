import { useNewsletterOperations } from "@common/hooks/business/useNewsletterOperations";
import { useTagOperations } from "@common/hooks/business/useTagOperations";
import { useNewsletterRowState } from "@common/hooks/ui/useNewsletterRowState";
import { NewsletterWithRelations, Tag } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import React, { useCallback, useMemo } from "react";
import NewsletterRowPresentation from "./NewsletterRowPresentation";

interface NewsletterRowContainerProps {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onTagClick: (tag: Tag, e: React.MouseEvent) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, id: string) => void;
  onNewsletterClick?: (newsletter: NewsletterWithRelations) => void;
  onRowClick?: (
    newsletter: NewsletterWithRelations,
    e: React.MouseEvent,
  ) => void;
  onMouseEnter?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue: boolean;
  showCheckbox?: boolean;
  showTags?: boolean;
  visibleTags: Set<string>;
  readingQueue: Array<{ newsletter_id: string }>;
  className?: string;
}

const NewsletterRowContainer: React.FC<NewsletterRowContainerProps> = ({
  newsletter,
  isSelected = false,
  onToggleSelect,
  onTagClick,
  onRemoveFromQueue,
  onNewsletterClick,
  onRowClick,
  onMouseEnter,
  isInReadingQueue = false,
  showCheckbox = false,
  showTags = false,
  visibleTags,
  readingQueue,
  className,
}) => {
  const log = useLogger();

  // Business logic hooks
  const newsletterOps = useNewsletterOperations({
    showToasts: true,
    onSuccess: (operation, newsletter) => {
      log.debug("Newsletter operation completed", {
        component: "NewsletterRowContainer",
        action: operation,
        metadata: { newsletterId: newsletter?.id },
      });
    },
    onError: (operation, error) => {
      log.error("Newsletter operation failed", {
        component: "NewsletterRowContainer",
        action: operation,
        error,
      });
    },
  });

  const tagOps = useTagOperations({
    showToasts: true,
    onSuccess: (operation) => {
      log.debug("Tag operation completed", {
        component: "NewsletterRowContainer",
        action: operation,
        metadata: { newsletterId: newsletter.id },
      });
    },
    onError: (operation, error) => {
      log.error("Tag operation failed", {
        component: "NewsletterRowContainer",
        action: operation,
        error,
        metadata: { newsletterId: newsletter.id },
      });
    },
  });

  // UI state hook
  const rowState = useNewsletterRowState({
    newsletter,
    initialSelected: isSelected,
    initialShowTags: showTags || visibleTags.has(newsletter.id),
    initialShowCheckbox: showCheckbox,
    onSelectionChange: onToggleSelect,
    onTagVisibilityChange: (newsletterId, isVisible) => {
      log.debug("Tag visibility changed", {
        component: "NewsletterRowContainer",
        action: "toggle_tag_visibility",
        metadata: { newsletterId, isVisible },
      });
    },
  });

  // Business logic handlers
  const handleToggleLike = useCallback(async () => {
    if (!rowState.canInteract) return;

    rowState.setLoadingState('like', true);
    try {
      await newsletterOps.toggleLike(newsletter.id);
    } finally {
      rowState.setLoadingState('like', false);
    }
  }, [newsletter.id, newsletterOps, rowState]);

  const handleToggleArchive = useCallback(async () => {
    if (!rowState.canInteract) return;

    rowState.setLoadingState('archive', true);
    try {
      await newsletterOps.toggleArchive(newsletter.id);
    } finally {
      rowState.setLoadingState('archive', false);
    }
  }, [newsletter.id, newsletterOps, rowState]);

  const handleToggleRead = useCallback(async () => {
    if (!rowState.canInteract) return;

    rowState.setLoadingState('read', true);
    try {
      if (newsletter.is_read) {
        await newsletterOps.markAsUnread(newsletter.id);
      } else {
        await newsletterOps.markAsRead(newsletter.id);
      }
    } finally {
      rowState.setLoadingState('read', false);
    }
  }, [newsletter.id, newsletter.is_read, newsletterOps, rowState]);

  const handleTrash = useCallback(() => {
    // For now, just archive the newsletter
    // In the future, this could move to trash/deleted state
    handleToggleArchive();
  }, [handleToggleArchive]);

  const handleToggleQueue = useCallback(async () => {
    if (!rowState.canInteract) return;

    rowState.setLoadingState('queue', true);
    try {
      if (isInReadingQueue) {
        await newsletterOps.removeFromQueue(newsletter.id);
      } else {
        await newsletterOps.addToQueue(newsletter.id);
      }
    } finally {
      rowState.setLoadingState('queue', false);
    }
  }, [newsletter.id, isInReadingQueue, newsletterOps, rowState]);

  const handleUpdateTags = useCallback(
    async (tagIds: string[]) => {
      if (!rowState.canInteract) return;

      rowState.setLoadingState('tags', true);
      rowState.setTagUpdateError(null);

      try {
        await tagOps.updateNewsletterTags({
          newsletterId: newsletter.id,
          tagIds,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update tags";
        rowState.setTagUpdateError(errorMessage);
      } finally {
        rowState.setLoadingState('tags', false);
      }
    },
    [newsletter.id, tagOps, rowState]
  );

  // Computed loading states for backward compatibility
  const loadingStates = useMemo(() => {
    const states: Record<string, string> = {};

    if (rowState.state.isTogglingRead) states[newsletter.id] = 'read';
    if (rowState.state.isTogglingLike) states[newsletter.id] = 'like';
    if (rowState.state.isTogglingArchive) states[newsletter.id] = 'archive';
    if (rowState.state.isTogglingQueue) states[newsletter.id] = 'queue';
    if (rowState.state.isUpdatingTags) states[newsletter.id] = 'tags';

    return states;
  }, [
    newsletter.id,
    rowState.state.isTogglingRead,
    rowState.state.isTogglingLike,
    rowState.state.isTogglingArchive,
    rowState.state.isTogglingQueue,
    rowState.state.isUpdatingTags,
  ]);

  // Get error states from hooks
  const errorTogglingLike = newsletterOps.errorTogglingLike;

  return (
    <NewsletterRowPresentation
      newsletter={newsletter}
      isSelected={rowState.state.isSelected}
      onToggleSelect={rowState.toggleSelect}
      onToggleLike={handleToggleLike}
      onToggleArchive={handleToggleArchive}
      onToggleRead={handleToggleRead}
      onTrash={handleTrash}
      onToggleQueue={handleToggleQueue}
      onToggleTagVisibility={rowState.toggleTagVisibility}
      onUpdateTags={handleUpdateTags}
      onTagClick={onTagClick}
      onRemoveFromQueue={onRemoveFromQueue}
      onNewsletterClick={onNewsletterClick}
      onRowClick={onRowClick}
      onMouseEnter={(newsletter) => {
        rowState.onMouseEnter();
        onMouseEnter?.(newsletter);
      }}
      isInReadingQueue={isInReadingQueue}
      showCheckbox={rowState.state.showCheckbox}
      showTags={rowState.state.showTags}
      visibleTags={visibleTags}
      readingQueue={readingQueue}
      isDeletingNewsletter={false} // This would come from a deletion service
      loadingStates={loadingStates}
      errorTogglingLike={errorTogglingLike}
      isUpdatingTags={rowState.state.isUpdatingTags}
      tagUpdateError={rowState.state.tagUpdateError}
      onDismissTagError={rowState.dismissTagError}
      className={className}
    />
  );
};

export default NewsletterRowContainer;
