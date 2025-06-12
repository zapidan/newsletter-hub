import React, { useCallback, useState } from "react";
import {
  Heart,
  Bookmark as BookmarkIcon,
  Archive,
  ArchiveX,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNewsletters } from "@common/hooks/useNewsletters";
import { useReadingQueue } from "@common/hooks/useReadingQueue";
import { getCacheManager } from "@common/utils/cacheUtils";
import type { NewsletterWithRelations } from "@common/types";

interface NewsletterDetailActionsProps {
  newsletter: NewsletterWithRelations;
  onNewsletterUpdate: (updatedNewsletter: NewsletterWithRelations) => void;
  isFromReadingQueue?: boolean;
}

export const NewsletterDetailActions: React.FC<
  NewsletterDetailActionsProps
> = ({ newsletter, onNewsletterUpdate, isFromReadingQueue = false }) => {
  const {
    markAsRead,
    markAsUnread,
    toggleLike,
    toggleArchive,
    deleteNewsletter,
    toggleInQueue,
    isMarkingAsRead,
    isMarkingAsUnread,
    isDeletingNewsletter,
    getNewsletter,
  } = useNewsletters(undefined, "all", undefined, []);

  const { refetch: refetchReadingQueue } = useReadingQueue();

  // Local loading states for better UX
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);

  // Get cache manager for optimistic updates
  const cacheManager = React.useMemo(() => {
    try {
      return getCacheManager();
    } catch {
      return null;
    }
  }, []);

  const handleToggleReadStatus = useCallback(async () => {
    if (!newsletter?.id || isTogglingReadStatus) return;

    setIsTogglingReadStatus(true);

    // Optimistic update
    const optimisticNewsletter = {
      ...newsletter,
      is_read: !newsletter.is_read,
    };
    onNewsletterUpdate(optimisticNewsletter);

    // Update cache optimistically
    if (cacheManager) {
      cacheManager.optimisticUpdate(
        newsletter.id,
        { is_read: !newsletter.is_read },
        "read-status-toggle",
      );
    }

    try {
      if (newsletter.is_read) {
        await markAsUnread(newsletter.id);
      } else {
        await markAsRead(newsletter.id);
      }

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(newsletter.id);
      if (updated) {
        onNewsletterUpdate(updated);
      }

      toast.success(newsletter.is_read ? "Marked as unread" : "Marked as read");
    } catch (error) {
      console.error("Error toggling read status:", error);
      // Revert optimistic update
      onNewsletterUpdate(newsletter);
      if (cacheManager) {
        cacheManager.updateNewsletterInCache(
          { id: newsletter.id, updates: newsletter },
          { optimistic: true },
        );
      }
      toast.error("Failed to update read status");
    } finally {
      setIsTogglingReadStatus(false);
    }
  }, [
    newsletter,
    isTogglingReadStatus,
    markAsRead,
    markAsUnread,
    onNewsletterUpdate,
    getNewsletter,
    cacheManager,
  ]);

  const handleToggleLike = useCallback(async () => {
    if (!newsletter?.id || isLiking) return;

    setIsLiking(true);

    // Optimistic update
    const optimisticNewsletter = {
      ...newsletter,
      is_liked: !newsletter.is_liked,
    };
    onNewsletterUpdate(optimisticNewsletter);

    // Update cache optimistically
    if (cacheManager) {
      cacheManager.optimisticUpdate(
        newsletter.id,
        { is_liked: !newsletter.is_liked },
        "like-toggle",
      );
    }

    try {
      await toggleLike(newsletter.id);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(newsletter.id);
      if (updated) {
        onNewsletterUpdate(updated);
      }

      toast.success(
        newsletter.is_liked ? "Removed from liked" : "Added to liked",
      );
    } catch (error) {
      console.error("Failed to update like status:", error);
      // Revert optimistic update
      onNewsletterUpdate(newsletter);
      if (cacheManager) {
        cacheManager.updateNewsletterInCache(
          { id: newsletter.id, updates: newsletter },
          { optimistic: true },
        );
      }
      toast.error("Failed to update like status");
    } finally {
      setIsLiking(false);
    }
  }, [
    newsletter,
    isLiking,
    toggleLike,
    onNewsletterUpdate,
    getNewsletter,
    cacheManager,
  ]);

  const handleToggleBookmark = useCallback(async () => {
    if (!newsletter?.id || isBookmarking) return;

    setIsBookmarking(true);

    // Optimistic update
    const optimisticNewsletter = {
      ...newsletter,
      is_bookmarked: !newsletter.is_bookmarked,
    };
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await toggleInQueue(newsletter.id);

      // Refresh reading queue and newsletter data
      if (refetchReadingQueue) {
        await refetchReadingQueue();
      }

      const updated = await getNewsletter(newsletter.id);
      if (updated) {
        onNewsletterUpdate(updated);
      }

      toast.success(
        newsletter.is_bookmarked
          ? "Removed from reading queue"
          : "Added to reading queue",
      );
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      // Revert optimistic update
      onNewsletterUpdate(newsletter);
      toast.error("Failed to update reading queue");
    } finally {
      setIsBookmarking(false);
    }
  }, [
    newsletter,
    isBookmarking,
    toggleInQueue,
    onNewsletterUpdate,
    refetchReadingQueue,
    getNewsletter,
  ]);

  const handleArchive = useCallback(async () => {
    if (!newsletter?.id || isArchiving || newsletter.is_archived) return;

    setIsArchiving(true);

    // Optimistic update
    const optimisticNewsletter = {
      ...newsletter,
      is_archived: true,
    };
    onNewsletterUpdate(optimisticNewsletter);

    // Update cache optimistically
    if (cacheManager) {
      cacheManager.optimisticUpdate(
        newsletter.id,
        { is_archived: true },
        "archive",
      );
    }

    try {
      await toggleArchive(newsletter.id, true);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(newsletter.id);
      if (updated) {
        onNewsletterUpdate(updated);
      }

      toast.success("Newsletter archived");
    } catch (error) {
      console.error("Error archiving newsletter:", error);
      // Revert optimistic update
      onNewsletterUpdate(newsletter);
      if (cacheManager) {
        cacheManager.updateNewsletterInCache(
          { id: newsletter.id, updates: newsletter },
          { optimistic: true },
        );
      }
      toast.error("Failed to archive newsletter");
    } finally {
      setIsArchiving(false);
    }
  }, [
    newsletter,
    isArchiving,
    toggleArchive,
    onNewsletterUpdate,
    getNewsletter,
    cacheManager,
  ]);

  const handleUnarchive = useCallback(async () => {
    if (!newsletter?.id || isArchiving || !newsletter.is_archived) return;

    setIsArchiving(true);

    // Optimistic update
    const optimisticNewsletter = {
      ...newsletter,
      is_archived: false,
    };
    onNewsletterUpdate(optimisticNewsletter);

    // Update cache optimistically
    if (cacheManager) {
      cacheManager.optimisticUpdate(
        newsletter.id,
        { is_archived: false },
        "unarchive",
      );
    }

    try {
      await toggleArchive(newsletter.id, false);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(newsletter.id);
      if (updated) {
        onNewsletterUpdate(updated);
      }

      toast.success("Newsletter unarchived");
    } catch (error) {
      console.error("Error unarchiving newsletter:", error);
      // Revert optimistic update
      onNewsletterUpdate(newsletter);
      if (cacheManager) {
        cacheManager.updateNewsletterInCache(
          { id: newsletter.id, updates: newsletter },
          { optimistic: true },
        );
      }
      toast.error("Failed to unarchive newsletter");
    } finally {
      setIsArchiving(false);
    }
  }, [
    newsletter,
    isArchiving,
    toggleArchive,
    onNewsletterUpdate,
    getNewsletter,
    cacheManager,
  ]);

  const handleTrash = useCallback(async () => {
    if (!newsletter?.id) return;

    if (
      !window.confirm(
        "Are you sure? This action is final and cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteNewsletter(newsletter.id);
      toast.success("Newsletter deleted permanently");

      // Navigate back after deletion
      if (isFromReadingQueue) {
        window.location.href = "/reading-queue";
      } else {
        window.location.href = "/inbox?filter=archived";
      }
    } catch (error) {
      console.error("Error deleting newsletter:", error);
      toast.error("Failed to delete newsletter");
    }
  }, [newsletter?.id, deleteNewsletter, isFromReadingQueue]);

  return (
    <div className="flex items-center gap-2">
      {/* Read Status Toggle */}
      <button
        onClick={handleToggleReadStatus}
        disabled={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          newsletter?.is_read
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
        }`}
        aria-label={newsletter?.is_read ? "Mark as unread" : "Mark as read"}
      >
        {(isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread) && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{newsletter?.is_read ? "Mark Unread" : "Mark Read"}</span>
      </button>

      {/* Like Toggle */}
      <button
        onClick={handleToggleLike}
        disabled={isLiking}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          newsletter?.is_liked
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        aria-label={newsletter?.is_liked ? "Unlike" : "Like"}
      >
        {isLiking && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <Heart
          className={`h-4 w-4 ${newsletter?.is_liked ? "fill-red-500" : "fill-none"}`}
          stroke={newsletter?.is_liked ? "currentColor" : "currentColor"}
        />
        <span className="ml-1">{newsletter?.is_liked ? "Liked" : "Like"}</span>
      </button>

      {/* Bookmark Toggle */}
      <button
        onClick={handleToggleBookmark}
        disabled={isBookmarking}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          newsletter?.is_bookmarked
            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        aria-label={
          newsletter?.is_bookmarked ? "Remove from queue" : "Add to queue"
        }
      >
        {isBookmarking && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <BookmarkIcon
          className={`h-4 w-4 ${newsletter?.is_bookmarked ? "fill-yellow-500" : "fill-none"}`}
          stroke="currentColor"
        />
        <span>{newsletter?.is_bookmarked ? "Saved" : "Save for later"}</span>
      </button>

      {/* Archive/Unarchive Toggle */}
      {!newsletter?.is_archived ? (
        <button
          onClick={handleArchive}
          disabled={isArchiving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-amber-100 text-amber-700 hover:bg-amber-200"
          aria-label="Archive newsletter"
        >
          {isArchiving && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          <Archive className="h-4 w-4" />
          <span>Archive</span>
        </button>
      ) : (
        <>
          <button
            onClick={handleUnarchive}
            disabled={isArchiving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-100 text-blue-700 hover:bg-blue-200"
            aria-label="Unarchive newsletter"
          >
            {isArchiving && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            <ArchiveX className="h-4 w-4" />
            <span>Unarchive</span>
          </button>

          {/* Trash button for archived newsletters */}
          <button
            onClick={handleTrash}
            disabled={isDeletingNewsletter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-100 text-red-700 hover:bg-red-200"
            aria-label="Delete newsletter permanently"
          >
            {isDeletingNewsletter && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h16"
              />
            </svg>
            <span>Delete Permanently</span>
          </button>
        </>
      )}
    </div>
  );
};

export default NewsletterDetailActions;
