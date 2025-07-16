import { useReadingQueue } from '@common/hooks/useReadingQueue';
import type { NewsletterMutations } from '@common/hooks/useSharedNewsletterActions';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import type { NewsletterWithRelations } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import { Archive, ArchiveX, Bookmark as BookmarkIcon, Eye, EyeOff, Heart, MoreHorizontal, Trash2 as TrashIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface NewsletterDetailActionsProps {
  newsletter: NewsletterWithRelations;
  onNewsletterUpdate: (updatedNewsletter: NewsletterWithRelations) => void;
  isFromReadingQueue?: boolean;
  mutations?: NewsletterMutations;
}

// Action Button Component
const DetailActionButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  className: string;
  ariaLabel: string;
  icon?: React.ReactNode;
  text: string;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  dataTestId?: string;
}> = ({ onClick, disabled, className, ariaLabel, icon, text, isLoading, variant = "secondary", dataTestId }) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`
      flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium 
      transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
      focus:outline-none focus:ring-2 focus:ring-offset-1
      ${className}
      ${variant === "primary" ? "focus:ring-blue-500" : variant === "danger" ? "focus:ring-red-500" : "focus:ring-gray-500"}
    `}
    aria-label={ariaLabel}
    {...(ariaLabel === 'Mark as read' ? { 'data-testid': 'mark-as-read-btn' } : {})}
    {...(dataTestId ? { 'data-testid': dataTestId } : {})}
  >
    {isLoading && (
      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
    )}
    {/* Desktop: icon + text */}
    <span className="hidden sm:inline-flex items-center">
      {icon && !isLoading && <span className="mr-2">{icon}</span>}
      {text}
    </span>
    {/* Mobile: icon only */}
    <span className="inline-flex sm:hidden items-center">
      {icon && !isLoading && icon}
    </span>
  </button>
);

export const NewsletterDetailActions: React.FC<NewsletterDetailActionsProps> = ({
  newsletter,
  onNewsletterUpdate,
  isFromReadingQueue = false,
  mutations,
}) => {
  const log = useLogger();
  const { isInQueue: checkIsInQueue } = useReadingQueue();
  const {
    handleMarkAsRead, handleMarkAsUnread, handleToggleLike, handleToggleArchive,
    handleDeleteNewsletter, handleToggleInQueue, isMarkingAsRead, isMarkingAsUnread,
    isDeletingNewsletter,
  } = useSharedNewsletterActions(
    mutations,
    {
      showToasts: false,
      optimisticUpdates: false,
      onSuccess: (updatedNl) => { if (updatedNl) onNewsletterUpdate(updatedNl); },
      onError: (error) => log.error('Newsletter action failed', { action: 'newsletter_action', metadata: { newsletterId: newsletter.id } }, error),
    }
  );

  const [localNewsletter, setLocalNewsletter] = useState<NewsletterWithRelations>(newsletter);
  const [isLiking, setIsLiking] = useState(false);
  const [isTogglingQueue, setIsTogglingQueue] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [isInQueue, setIsInQueue] = useState<boolean>(isFromReadingQueue);
  const [isCheckingQueue, setIsCheckingQueue] = useState(false);
  const hasCheckedQueue = useRef<{ [key: string]: boolean }>({});
  const checkDebounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalNewsletter(newsletter);
    if (newsletter?.id !== localNewsletter?.id) {
      const currentId = newsletter?.id;
      hasCheckedQueue.current = currentId ? { [currentId]: hasCheckedQueue.current[currentId] || false } : {};
    }
  }, [newsletter, localNewsletter?.id]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    const checkQueueStatus = async () => {
      if (!newsletter?.id || !mounted || hasCheckedQueue.current[newsletter.id]) return;
      hasCheckedQueue.current[newsletter.id] = true;
      setIsCheckingQueue(true);
      const timeoutPromise = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Queue check timeout')), 3000); });
      try {
        const inQueueResult = await Promise.race([checkIsInQueue(newsletter.id), timeoutPromise]);
        if (mounted) setIsInQueue(inQueueResult);
      } catch (error) {
        if (mounted) {
          log.error('Failed to check queue status', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
          setIsInQueue(isFromReadingQueue); // Fallback
        }
      } finally {
        if (mounted) setIsCheckingQueue(false);
        clearTimeout(timeoutId);
      }
    };

    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);
    if (newsletter?.id !== localNewsletter?.id && isFromReadingQueue && newsletter?.id) {
      setIsInQueue(true);
      hasCheckedQueue.current[newsletter.id] = true;
      return;
    }
    checkDebounceRef.current = setTimeout(checkQueueStatus, 250);
    return () => { mounted = false; clearTimeout(timeoutId); if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current); };
  }, [newsletter?.id]);

  const handleToggleReadStatus = useCallback(async () => {
    if (!localNewsletter?.id || isTogglingReadStatus) return;
    setIsTogglingReadStatus(true);
    const optimisticNewsletter = { ...localNewsletter, is_read: !localNewsletter.is_read };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);
    try {
      if (localNewsletter.is_read) {
        await handleMarkAsUnread(localNewsletter.id);
      } else {
        await handleMarkAsRead(localNewsletter.id);
      }
    } catch (error) {
      log.error('Failed to toggle read status', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error('Failed to update read status');
    } finally {
      setIsTogglingReadStatus(false);
    }
  }, [localNewsletter, isTogglingReadStatus, handleMarkAsRead, handleMarkAsUnread, onNewsletterUpdate, newsletter, log]);

  const handleToggleLikeAction = useCallback(async () => {
    if (!localNewsletter?.id || isLiking) return;
    setIsLiking(true);
    try {
      await handleToggleLike(localNewsletter, {
        optimisticUpdates: false,
        showToasts: true,
        onSuccess: (updatedNewsletter) => {
          if (updatedNewsletter) {
            setLocalNewsletter(updatedNewsletter);
            onNewsletterUpdate(updatedNewsletter);
          }
        },
      });
    } catch (error) {
      log.error('Failed to update like status', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to update like status');
    } finally {
      setIsLiking(false);
    }
  }, [localNewsletter, isLiking, handleToggleLike, newsletter, onNewsletterUpdate, log]);

  const handleToggleQueue = useCallback(async () => {
    if (!localNewsletter?.id || isTogglingQueue) return;
    setIsTogglingQueue(true);
    const previousQueueStatus = isInQueue;
    const newQueueStatus = !isInQueue;
    setIsInQueue(newQueueStatus);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      await handleToggleInQueue(localNewsletter, previousQueueStatus);
      clearTimeout(timeoutId);
    } catch (error) {
      if (controller.signal.aborted) {
        log.error('Toggle queue operation timed out', { metadata: { newsletterId: newsletter.id } }, new Error('Operation timed out'));
        toast.error('Operation timed out. Please try again.');
      } else {
        log.error('Failed to toggle reading queue', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
        toast.error('Failed to update reading queue');
      }
      setIsInQueue(previousQueueStatus);
    } finally {
      clearTimeout(timeoutId);
      setIsTogglingQueue(false);
    }
  }, [localNewsletter, isTogglingQueue, isInQueue, handleToggleInQueue, newsletter.id, log]);

  const handleArchive = useCallback(async () => {
    if (!localNewsletter?.id || isArchiving || localNewsletter.is_archived) return;
    setIsArchiving(true);
    const optimisticNewsletter = { ...localNewsletter, is_archived: true };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);
    try {
      await handleToggleArchive(localNewsletter);
    } catch (error) {
      log.error('Failed to archive newsletter', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
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
    const optimisticNewsletter = { ...localNewsletter, is_archived: false };
    setLocalNewsletter(optimisticNewsletter);
    onNewsletterUpdate(optimisticNewsletter);
    try {
      await handleToggleArchive(localNewsletter);
    } catch (error) {
      log.error('Failed to unarchive newsletter', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      setLocalNewsletter(newsletter);
      onNewsletterUpdate(newsletter);
      toast.error('Failed to unarchive newsletter');
    } finally {
      setIsArchiving(false);
    }
  }, [localNewsletter, isArchiving, handleToggleArchive, onNewsletterUpdate, newsletter, log]);

  const handleTrash = useCallback(async () => {
    if (!localNewsletter?.id) return;
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    try {
      await handleDeleteNewsletter(localNewsletter.id);
      if (isFromReadingQueue) {
        window.location.href = '/reading-queue';
      } else {
        window.location.href = '/inbox?filter=archived';
      }
    } catch (error) {
      log.error('Failed to delete newsletter', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to delete newsletter');
    }
  }, [localNewsletter?.id, handleDeleteNewsletter, isFromReadingQueue, log, newsletter.id]);

  // Primary actions (always visible)
  const primaryActions = [
    {
      key: "read",
      onClick: handleToggleReadStatus,
      disabled: isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread,
      isLoading: isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread,
      className: localNewsletter?.is_read ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
      ariaLabel: localNewsletter?.is_read ? 'Mark as unread' : 'Mark as read',
      icon: localNewsletter?.is_read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
      text: localNewsletter?.is_read ? 'Mark Unread' : 'Mark Read',
      variant: "primary" as const,
    },
    {
      key: "like",
      onClick: handleToggleLikeAction,
      disabled: isLiking,
      isLoading: isLiking,
      className: localNewsletter?.is_liked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
      ariaLabel: localNewsletter?.is_liked ? 'Unlike' : 'Like',
      icon: <Heart className={`w-4 h-4 ${localNewsletter?.is_liked ? 'fill-red-500' : 'fill-none'}`} stroke="currentColor" />,
      text: localNewsletter?.is_liked ? 'Liked' : 'Like',
      variant: "secondary" as const,
    },
    {
      key: "queue",
      onClick: handleToggleQueue,
      disabled: isTogglingQueue || isCheckingQueue,
      isLoading: isTogglingQueue || isCheckingQueue,
      className: isInQueue ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
      ariaLabel: isInQueue ? 'Remove from queue' : 'Add to queue',
      icon: <BookmarkIcon className={`w-4 h-4 ${isInQueue ? 'fill-yellow-500' : 'fill-none'}`} stroke="currentColor" />,
      text: isCheckingQueue ? 'Checking...' : isInQueue ? 'Saved' : 'Save',
      variant: "secondary" as const,
      dataTestId: isInQueue ? 'remove-from-queue-btn' : 'add-to-queue-btn',
    },
    ...(!localNewsletter?.is_archived ? [{
      key: "archive",
      onClick: handleArchive,
      disabled: isArchiving,
      isLoading: isArchiving,
      className: "bg-amber-100 text-amber-700 hover:bg-amber-200",
      ariaLabel: "Archive newsletter",
      icon: <Archive className="w-4 h-4" />,
      text: "Archive",
      variant: "secondary" as const,
    }] : [{
      key: "unarchive",
      onClick: handleUnarchive,
      disabled: isArchiving,
      isLoading: isArchiving,
      className: "bg-blue-100 text-blue-700 hover:bg-blue-200",
      ariaLabel: "Unarchive newsletter",
      icon: <ArchiveX className="w-4 h-4" />,
      text: "Unarchive",
      variant: "secondary" as const,
    }]),
  ];

  // Secondary actions (only destructive actions for More menu on mobile)
  const secondaryActions = [
    ...((localNewsletter?.is_archived) ? [{
      key: "trash",
      onClick: handleTrash,
      disabled: isDeletingNewsletter,
      isLoading: isDeletingNewsletter,
      className: "bg-red-100 text-red-700 hover:bg-red-200",
      ariaLabel: "Delete newsletter permanently",
      icon: <TrashIcon className="w-4 h-4" />,
      text: "Delete",
      variant: "danger" as const,
    }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Primary Actions - Desktop */}
      <div className="hidden sm:flex items-center gap-2">
        {primaryActions.map((action) => (
          <DetailActionButton
            key={action.key}
            onClick={action.onClick}
            disabled={action.disabled}
            isLoading={action.isLoading}
            className={action.className}
            ariaLabel={action.ariaLabel}
            icon={action.icon}
            text={action.text}
            variant={action.variant}
            dataTestId={action.dataTestId}
          />
        ))}
      </div>
      {/* Primary Actions - Mobile */}
      <div className="flex sm:hidden items-center gap-2">
        {primaryActions.map((action) => (
          <DetailActionButton
            key={action.key}
            onClick={action.onClick}
            disabled={action.disabled}
            isLoading={action.isLoading}
            className={action.className}
            ariaLabel={action.ariaLabel}
            icon={action.icon}
            text={action.text}
            variant={action.variant}
            dataTestId={action.dataTestId}
          />
        ))}
      </div>
      {/* Secondary Actions - Show on desktop, hide in more menu on mobile */}
      <div className="hidden sm:flex items-center gap-2">
        {secondaryActions.map((action) => (
          <DetailActionButton
            key={action.key}
            onClick={action.onClick}
            disabled={action.disabled}
            isLoading={action.isLoading}
            className={action.className}
            ariaLabel={action.ariaLabel}
            icon={action.icon}
            text={action.text}
            variant={action.variant}
          />
        ))}
      </div>
      {/* More Menu for Mobile */}
      {secondaryActions.length > 0 && (
        <div className="sm:hidden relative">
          <DetailActionButton
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            disabled={false}
            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            ariaLabel="More actions"
            icon={<MoreHorizontal className="w-4 h-4" />}
            text="More"
            variant="secondary"
          />
          {showMoreMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMoreMenu(false)}
              />
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                {secondaryActions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => {
                      action.onClick();
                      setShowMoreMenu(false);
                    }}
                    disabled={action.disabled}
                    className={`
                      w-full text-left px-3 py-2 text-sm flex items-center gap-2
                      hover:bg-gray-50 transition-colors disabled:opacity-50
                      ${action.className.replace('hover:', '')}
                    `}
                  >
                    {action.isLoading ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <span className="w-4 h-4">{action.icon}</span>
                    )}
                    {action.text}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsletterDetailActions;
