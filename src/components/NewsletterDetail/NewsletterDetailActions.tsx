import React, { useCallback, useState, useEffect } from "react";
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

  // Local optimistic state to ensure UI consistency
  const [localNewsletter, setLocalNewsletter] =
    useState<NewsletterWithRelations>(newsletter);

  // Local loading states for better UX
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);

  // Get cache manager for optimistic updates
  const cacheManager = React.useMemo(() => {
    return getCacheManager();
  }, []);

  // Sync local state with props when newsletter changes
  useEffect(() => {
    setLocalNewsletter(newsletter);
  }, [newsletter]);

  const handleToggleReadStatus = useCallback(async () => {
    if (!localNewsletter?.id || isTogglingReadStatus) return;

    setIsTogglingReadStatus(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_read: !localNewsletter.is_read,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      if (localNewsletter.is_read) {
        await markAsUnread(localNewsletter.id);
      } else {
        await markAsRead(localNewsletter.id);
      }

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(localNewsletter.id);
      if (updated) {
        setLocalNewsletter(updated);
        onNewsletterUpdate(updated);
      }

      toast.success(
        localNewsletter.is_read ? "Marked as unread" : "Marked as read",
      );
    } catch (error) {
      console.error("Error toggling read status:", error);
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error("Failed to update read status");
    } finally {
      setIsTogglingReadStatus(false);
    }
  }, [
    localNewsletter,
    isTogglingReadStatus,
    markAsRead,
    markAsUnread,
    onNewsletterUpdate,
    getNewsletter,
    newsletter,
  ]);

  const handleToggleLike = useCallback(async () => {
    if (!localNewsletter?.id || isLiking) return;

    setIsLiking(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_liked: !localNewsletter.is_liked,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await toggleLike(localNewsletter.id);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(localNewsletter.id);
      if (updated) {
        setLocalNewsletter(updated);
        onNewsletterUpdate(updated);
      }

      toast.success(
        localNewsletter.is_liked ? "Removed from liked" : "Added to liked",
      );
    } catch (error) {
      console.error("Failed to update like status:", error);
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error("Failed to update like status");
    } finally {
      setIsLiking(false);
    }
  }, [
    localNewsletter,
    isLiking,
    toggleLike,
    onNewsletterUpdate,
    getNewsletter,
    newsletter,
  ]);

  const handleToggleBookmark = useCallback(async () => {
    if (!localNewsletter?.id || isBookmarking) return;

    setIsBookmarking(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_bookmarked: !localNewsletter.is_bookmarked,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await toggleInQueue(localNewsletter.id);

      // Refresh reading queue and newsletter data
      if (refetchReadingQueue) {
        await refetchReadingQueue();
      }

      const updated = await getNewsletter(localNewsletter.id);
      if (updated) {
        setLocalNewsletter(updated);
        onNewsletterUpdate(updated);
      }

      toast.success(
        localNewsletter.is_bookmarked
          ? "Removed from reading queue"
          : "Added to reading queue",
      );
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error("Failed to update reading queue");
    } finally {
      setIsBookmarking(false);
    }
  }, [
    localNewsletter,
    isBookmarking,
    toggleInQueue,
    onNewsletterUpdate,
    refetchReadingQueue,
    getNewsletter,
    newsletter,
  ]);

  const handleArchive = useCallback(async () => {
    if (!localNewsletter?.id || isArchiving || localNewsletter.is_archived)
      return;

    setIsArchiving(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_archived: true,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await toggleArchive(localNewsletter.id, true);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(localNewsletter.id);
      if (updated) {
        setLocalNewsletter(updated);
        onNewsletterUpdate(updated);
      }

      toast.success("Newsletter archived");
    } catch (error) {
      console.error("Error archiving newsletter:", error);
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error("Failed to archive newsletter");
    } finally {
      setIsArchiving(false);
    }
  }, [
    localNewsletter,
    isArchiving,
    toggleArchive,
    onNewsletterUpdate,
    getNewsletter,
    newsletter,
  ]);

  const handleUnarchive = useCallback(async () => {
    if (!localNewsletter?.id || isArchiving || !localNewsletter.is_archived)
      return;

    setIsArchiving(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_archived: false,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await toggleArchive(localNewsletter.id, false);

      // Refresh from server to ensure consistency
      const updated = await getNewsletter(localNewsletter.id);
      if (updated) {
        setLocalNewsletter(updated);
        onNewsletterUpdate(updated);
      }

      toast.success("Newsletter unarchived");
    } catch (error) {
      console.error("Error unarchiving newsletter:", error);
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error("Failed to unarchive newsletter");
    } finally {
      setIsArchiving(false);
    }
  }, [
    localNewsletter,
    isArchiving,
    toggleArchive,
    onNewsletterUpdate,
    getNewsletter,
    newsletter,
  ]);

  const handleTrash = useCallback(async () => {
    if (!localNewsletter?.id) return;

    if (
      !window.confirm(
        "Are you sure? This action is final and cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteNewsletter(localNewsletter.id);
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
  }, [localNewsletter?.id, deleteNewsletter, isFromReadingQueue]);

  return (
    <div className="flex items-center gap-2">
      {/* Read Status Toggle */}
      <button
        onClick={handleToggleReadStatus}
        disabled={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          localNewsletter?.is_read
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
        }`}
        aria-label={
          localNewsletter?.is_read ? "Mark as unread" : "Mark as read"
        }
      >
        {(isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread) && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{localNewsletter?.is_read ? "Mark Unread" : "Mark Read"}</span>
      </button>

      {/* Like Toggle */}
      <button
        onClick={handleToggleLike}
        disabled={isLiking}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          localNewsletter?.is_liked
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        aria-label={localNewsletter?.is_liked ? "Unlike" : "Like"}
      >
        {isLiking && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <Heart
          className={`h-4 w-4 ${localNewsletter?.is_liked ? "fill-red-500" : "fill-none"}`}
          stroke={localNewsletter?.is_liked ? "currentColor" : "currentColor"}
        />
        <span className="ml-1">
          {localNewsletter?.is_liked ? "Liked" : "Like"}
        </span>
      </button>

      {/* Bookmark Toggle */}
      <button
        onClick={handleToggleBookmark}
        disabled={isBookmarking}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          localNewsletter?.is_bookmarked
            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        aria-label={
          localNewsletter?.is_bookmarked ? "Remove from queue" : "Add to queue"
        }
      >
        {isBookmarking && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <BookmarkIcon
          className={`h-4 w-4 ${localNewsletter?.is_bookmarked ? "fill-yellow-500" : "fill-none"}`}
          stroke="currentColor"
        />
        <span>
          {localNewsletter?.is_bookmarked ? "Saved" : "Save for later"}
        </span>
      </button>

      {/* Archive/Unarchive Toggle */}
      {!localNewsletter?.is_archived ? (
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
