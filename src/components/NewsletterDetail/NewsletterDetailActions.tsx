import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Heart, Bookmark as BookmarkIcon, Archive, ArchiveX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useLogger } from '@common/utils/logger/useLogger';
import type { NewsletterWithRelations } from '@common/types';

interface NewsletterDetailActionsProps {
  newsletter: NewsletterWithRelations;
  onNewsletterUpdate: (updatedNewsletter: NewsletterWithRelations) => void;
  isFromReadingQueue?: boolean;
}

export const NewsletterDetailActions: React.FC<NewsletterDetailActionsProps> = ({
  newsletter,
  onNewsletterUpdate,
  isFromReadingQueue = false,
}) => {
  const log = useLogger();

  // Use reading queue hook for queue operations
  const { isInQueue: checkIsInQueue } = useReadingQueue();

  // Use shared newsletter actions for consistent cache management
  const {
    handleMarkAsRead,
    handleMarkAsUnread,
    handleToggleLike,
    handleToggleArchive,
    handleDeleteNewsletter,
    handleToggleInQueue,
    isMarkingAsRead,
    isMarkingAsUnread,
    isDeletingNewsletter,
  } = useSharedNewsletterActions({
    showToasts: false, // We'll handle our own toasts for better UX
    optimisticUpdates: true,
    onSuccess: (updatedNewsletter) => {
      if (updatedNewsletter) {
        onNewsletterUpdate(updatedNewsletter);
      }
    },
    onError: (error) => {
      log.error(
        'Newsletter action failed',
        {
          action: 'newsletter_action',
          metadata: { newsletterId: newsletter.id },
        },
        error
      );
    },
  });

  // Optimistic local state for immediate UI feedback
  const [localNewsletter, setLocalNewsletter] = useState<NewsletterWithRelations>(newsletter);

  // Enhanced loading states
  const [isLiking, setIsLiking] = useState(false);
  const [isTogglingQueue, setIsTogglingQueue] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);

  // Track actual queue status
  const [isInQueue, setIsInQueue] = useState<boolean>(isFromReadingQueue);
  const [isCheckingQueue, setIsCheckingQueue] = useState(false);

  // Sync local state with props when newsletter changes
  useEffect(() => {
    setLocalNewsletter(newsletter);
    // Reset queue check when newsletter changes
    if (newsletter?.id !== localNewsletter?.id) {
      // Clear all stored checks except current newsletter
      const currentId = newsletter?.id;
      hasCheckedQueue.current = currentId
        ? { [currentId]: hasCheckedQueue.current[currentId] || false }
        : {};
    }
  }, [newsletter, localNewsletter?.id]);

  // Check actual queue status when newsletter changes
  const hasCheckedQueue = useRef<{ [key: string]: boolean }>({});
  const checkDebounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkQueueStatus = async () => {
      // Only check once per newsletter
      if (!newsletter?.id || !mounted || hasCheckedQueue.current[newsletter.id]) return;

      // Mark as checked immediately to prevent re-runs
      hasCheckedQueue.current[newsletter.id] = true;
      setIsCheckingQueue(true);

      // Add timeout to prevent infinite waiting
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Queue check timeout')), 5000);
      });

      try {
        const inQueue = await Promise.race([checkIsInQueue(newsletter.id), timeoutPromise]);

        if (mounted) {
          setIsInQueue(inQueue);
        }
      } catch (error) {
        if (mounted) {
          log.error(
            'Failed to check queue status',
            {
              action: 'check_queue_status',
              metadata: { newsletterId: newsletter.id },
            },
            error instanceof Error ? error : new Error(String(error))
          );
          // Fallback to prop value if API fails
          setIsInQueue(isFromReadingQueue);
        }
      } finally {
        if (mounted) {
          setIsCheckingQueue(false);
        }
        clearTimeout(timeoutId);
      }
    };

    // Clear any existing debounce timer
    if (checkDebounceRef.current) {
      clearTimeout(checkDebounceRef.current);
    }

    // Reset check flag when newsletter changes
    if (newsletter?.id !== localNewsletter?.id) {
      // Skip queue check if we already know the status
      if (isFromReadingQueue && newsletter?.id) {
        setIsInQueue(true);
        hasCheckedQueue.current[newsletter.id] = true;
        return;
      }
    }

    // Debounce the queue check to prevent rapid checks
    checkDebounceRef.current = setTimeout(() => {
      checkQueueStatus();
    }, 300); // 300ms debounce

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (checkDebounceRef.current) {
        clearTimeout(checkDebounceRef.current);
      }
    };
  }, [newsletter?.id, checkIsInQueue, isFromReadingQueue, log, localNewsletter?.id]);

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
        await handleMarkAsUnread(localNewsletter.id);
      } else {
        await handleMarkAsRead(localNewsletter.id);
      }
    } catch (error) {
      log.error(
        'Failed to toggle read status',
        {
          action: 'toggle_read_status',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error('Failed to update read status');
    } finally {
      setIsTogglingReadStatus(false);
    }
  }, [
    localNewsletter,
    isTogglingReadStatus,
    handleMarkAsRead,
    handleMarkAsUnread,
    onNewsletterUpdate,
    newsletter,
    log,
  ]);

  const handleToggleLikeAction = useCallback(async () => {
    if (!localNewsletter?.id || isLiking) return;

    setIsLiking(true);

    try {
      // Let the shared action handler manage optimistic updates
      await handleToggleLike(localNewsletter, {
        optimisticUpdates: true,
        showToasts: true,
        onSuccess: (updatedNewsletter) => {
          // Update local state with the result
          if (updatedNewsletter) {
            setLocalNewsletter(updatedNewsletter);
            onNewsletterUpdate(updatedNewsletter);
          }
        },
      });
    } catch (error) {
      log.error(
        'Failed to update like status',
        {
          action: 'toggle_like_status',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      toast.error('Failed to update like status');
    } finally {
      setIsLiking(false);
    }
  }, [localNewsletter, isLiking, handleToggleLike, newsletter, onNewsletterUpdate, log]);

  const handleToggleQueue = useCallback(async () => {
    if (!localNewsletter?.id || isTogglingQueue) return;

    setIsTogglingQueue(true);

    // Store current state for potential rollback
    const previousQueueStatus = isInQueue;

    // Optimistic update for immediate UI feedback
    const newQueueStatus = !isInQueue;
    setIsInQueue(newQueueStatus);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      await handleToggleInQueue(localNewsletter, previousQueueStatus);

      // If successful, the new status should stick
      clearTimeout(timeoutId);
    } catch (error) {
      // Check if it was aborted
      if (controller.signal.aborted) {
        log.error(
          'Toggle queue operation timed out',
          {
            action: 'toggle_reading_queue_timeout',
            metadata: { newsletterId: newsletter.id },
          },
          new Error('Operation timed out')
        );
        toast.error('Operation timed out. Please try again.');
      } else {
        log.error(
          'Failed to toggle reading queue',
          {
            action: 'toggle_reading_queue',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error('Failed to update reading queue');
      }
      // Revert optimistic update on error
      setIsInQueue(previousQueueStatus);
    } finally {
      clearTimeout(timeoutId);
      setIsTogglingQueue(false);
    }
  }, [localNewsletter, isTogglingQueue, isInQueue, handleToggleInQueue, newsletter.id, log]);

  const handleArchive = useCallback(async () => {
    if (!localNewsletter?.id || isArchiving || localNewsletter.is_archived) return;

    setIsArchiving(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_archived: true,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await handleToggleArchive(localNewsletter);
    } catch (error) {
      log.error(
        'Failed to archive newsletter',
        {
          action: 'archive_newsletter',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error('Failed to archive newsletter');
    } finally {
      setIsArchiving(false);
    }
  }, [localNewsletter, isArchiving, handleToggleArchive, onNewsletterUpdate, newsletter, log]);

  const handleUnarchive = useCallback(async () => {
    if (!localNewsletter?.id || isArchiving || !localNewsletter.is_archived) return;

    setIsArchiving(true);

    // Optimistic update to local state
    const optimisticNewsletter = {
      ...localNewsletter,
      is_archived: false,
    };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);

    try {
      await handleToggleArchive(localNewsletter);
    } catch (error) {
      log.error(
        'Failed to unarchive newsletter',
        {
          action: 'unarchive_newsletter',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      // Revert optimistic update
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error('Failed to unarchive newsletter');
    } finally {
      setIsArchiving(false);
    }
  }, [localNewsletter, isArchiving, handleToggleArchive, onNewsletterUpdate, newsletter, log]);

  const handleTrash = useCallback(async () => {
    if (!localNewsletter?.id) return;

    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) {
      return;
    }

    try {
      await handleDeleteNewsletter(localNewsletter.id);

      // Navigate back after deletion
      if (isFromReadingQueue) {
        window.location.href = '/reading-queue';
      } else {
        window.location.href = '/inbox?filter=archived';
      }
    } catch (error) {
      log.error(
        'Failed to delete newsletter',
        {
          action: 'delete_newsletter',
          metadata: { newsletterId: newsletter.id },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      toast.error('Failed to delete newsletter');
    }
  }, [localNewsletter?.id, handleDeleteNewsletter, isFromReadingQueue, log, newsletter.id]);

  return (
    <div className="flex items-center gap-2">
      {/* Read Status Toggle */}
      <button
        onClick={handleToggleReadStatus}
        disabled={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          localNewsletter?.is_read
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
        }`}
        aria-label={localNewsletter?.is_read ? 'Mark as unread' : 'Mark as read'}
      >
        {(isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread) && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{localNewsletter?.is_read ? 'Mark Unread' : 'Mark Read'}</span>
      </button>

      {/* Like Toggle */}
      <button
        onClick={handleToggleLikeAction}
        disabled={isLiking}
        className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          localNewsletter?.is_liked
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-label={localNewsletter?.is_liked ? 'Unlike' : 'Like'}
      >
        {isLiking && (
          <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <Heart
          className={`h-4 w-4 ${localNewsletter?.is_liked ? 'fill-red-500' : 'fill-none'}`}
          stroke={localNewsletter?.is_liked ? 'currentColor' : 'currentColor'}
        />
        <span className="ml-1">{localNewsletter?.is_liked ? 'Liked' : 'Like'}</span>
      </button>

      {/* Bookmark Toggle */}
      <button
        onClick={handleToggleQueue}
        disabled={isTogglingQueue || isCheckingQueue}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isInQueue
            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-label={isInQueue ? 'Remove from queue' : 'Add to queue'}
      >
        {(isTogglingQueue || isCheckingQueue) && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {!isTogglingQueue && !isCheckingQueue && (
          <BookmarkIcon
            className={`h-4 w-4 ${isInQueue ? 'fill-yellow-500' : 'fill-none'}`}
            stroke="currentColor"
          />
        )}
        <span>{isCheckingQueue ? 'Checking...' : isInQueue ? 'Saved' : 'Save for later'}</span>
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
