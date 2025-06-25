import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import type { NewsletterWithRelations } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import { Archive, ArchiveX, Bookmark as BookmarkIcon, Heart, Trash2 as TrashIcon } from 'lucide-react'; // Changed Trash to Trash2
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface NewsletterDetailActionsProps {
  newsletter: NewsletterWithRelations;
  onNewsletterUpdate: (updatedNewsletter: NewsletterWithRelations) => void;
  isFromReadingQueue?: boolean;
}

// A smaller, reusable button component for this context
const DetailActionButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  className: string;
  ariaLabel: string;
  icon?: React.ReactNode;
  text: string;
  isLoading?: boolean;
}> = ({ onClick, disabled, className, ariaLabel, icon, text, isLoading }) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`flex items-center justify-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className} mb-2 sm:mb-0`}
    aria-label={ariaLabel}
  >
    {isLoading && <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
    {icon && !isLoading && <span className="mr-1.5">{icon}</span>}
    <span>{text}</span>
  </button>
);


export const NewsletterDetailActions: React.FC<NewsletterDetailActionsProps> = ({
  newsletter,
  onNewsletterUpdate,
  isFromReadingQueue = false,
}) => {
  const log = useLogger();
  const { isInQueue: checkIsInQueue } = useReadingQueue();
  const {
    handleMarkAsRead, handleMarkAsUnread, handleToggleLike, handleToggleArchive,
    handleDeleteNewsletter, handleToggleInQueue, isMarkingAsRead, isMarkingAsUnread,
    isDeletingNewsletter: isDeletingShared, // Renamed to avoid conflict
  } = useSharedNewsletterActions({
    showToasts: false, optimisticUpdates: true,
    onSuccess: (updatedNl) => { if (updatedNl) onNewsletterUpdate(updatedNl); },
    onError: (error) => log.error('Newsletter action failed', { action: 'newsletter_action', metadata: { newsletterId: newsletter.id } }, error),
  });

  const [localNewsletter, setLocalNewsletter] = useState<NewsletterWithRelations>(newsletter);
  const [isLiking, setIsLiking] = useState(false);
  const [isTogglingQueue, setIsTogglingQueue] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false); // Local deleting state

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
  }, [newsletter?.id, checkIsInQueue, isFromReadingQueue, log, localNewsletter?.id]);

  const createActionHandler = (actionName: string, stateSetter: React.Dispatch<React.SetStateAction<boolean>>, actionFn: () => Promise<any>, optimisticUpdate?: Partial<NewsletterWithRelations>) => async () => {
    if (!localNewsletter?.id) return;
    stateSetter(true);
    if (optimisticUpdate) {
      const updatedOptimistic = { ...localNewsletter, ...optimisticUpdate };
      setLocalNewsletter(updatedOptimistic);
      onNewsletterUpdate(updatedOptimistic);
    }
    try {
      const result = await actionFn();
      // If actionFn returns an updated newsletter (like from useSharedNewsletterActions), use it
      if (result && typeof result === 'object' && 'id' in result) {
         setLocalNewsletter(result as NewsletterWithRelations);
         onNewsletterUpdate(result as NewsletterWithRelations);
      } else if (optimisticUpdate && actionName !== 'delete') {
        // For actions that don't return the full object but succeeded, ensure local matches optimistic
         setLocalNewsletter(prev => ({...prev, ...optimisticUpdate}));
         onNewsletterUpdate({...localNewsletter, ...optimisticUpdate});
      }
    } catch (error) {
      log.error(`Failed to ${actionName}`, { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      setLocalNewsletter(newsletter); // Revert on error
      onNewsletterUpdate(newsletter);
      toast.error(`Failed to ${actionName.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    } finally {
      stateSetter(false);
    }
  };

  const toggleReadHandler = createActionHandler('toggle read status', setIsTogglingReadStatus, () => localNewsletter.is_read ? handleMarkAsUnread(localNewsletter.id) : handleMarkAsRead(localNewsletter.id), { is_read: !localNewsletter.is_read });
  const toggleLikeHandler = createActionHandler('toggle like', setIsLiking, () => handleToggleLike(localNewsletter, { optimisticUpdates: true, showToasts: true, onSuccess: (updNl) => { if(updNl) setLocalNewsletter(updNl); onNewsletterUpdate(updNl); } }), { is_liked: !localNewsletter.is_liked });
  const toggleQueueHandler = createActionHandler('toggle queue', setIsTogglingQueue, () => handleToggleInQueue(localNewsletter, isInQueue), {}); // Optimistic update handled by setIsInQueue

  // Special handling for queue optimistic update as it relies on `isInQueue` state
   const handleOptimisticToggleQueue = async () => {
    if (!localNewsletter?.id || isTogglingQueue) return;
    setIsTogglingQueue(true);
    const previousQueueStatus = isInQueue;
    setIsInQueue(!previousQueueStatus); // Optimistic UI update
    try {
      await handleToggleInQueue(localNewsletter, previousQueueStatus);
    } catch (error) {
      log.error('Failed to toggle reading queue', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      setIsInQueue(previousQueueStatus); // Revert
      toast.error('Failed to update reading queue');
    } finally {
      setIsTogglingQueue(false);
    }
  };

  const archiveHandler = createActionHandler('archive', setIsArchiving, () => handleToggleArchive(localNewsletter), { is_archived: true });
  const unarchiveHandler = createActionHandler('unarchive', setIsArchiving, () => handleToggleArchive(localNewsletter), { is_archived: false });

  const trashHandler = async () => {
    if (!localNewsletter?.id || isDeletingLocal || isDeletingShared) return;
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    setIsDeletingLocal(true);
    try {
      await handleDeleteNewsletter(localNewsletter.id);
      toast.success("Newsletter deleted.");
      // Navigate back after deletion
      if (isFromReadingQueue) window.location.href = '/queue';
      else window.location.href = '/inbox?filter=archived';
    } catch (error) {
      log.error('Failed to delete newsletter', { metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to delete newsletter');
    } finally {
      setIsDeletingLocal(false);
    }
  };

  const effectiveIsDeleting = isDeletingLocal || isDeletingShared;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DetailActionButton
        onClick={toggleReadHandler}
        disabled={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
        isLoading={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
        className={localNewsletter?.is_read ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}
        ariaLabel={localNewsletter?.is_read ? 'Mark as unread' : 'Mark as read'}
        text={localNewsletter?.is_read ? 'Mark Unread' : 'Mark Read'}
      />
      <DetailActionButton
        onClick={toggleLikeHandler}
        disabled={isLiking}
        isLoading={isLiking}
        className={localNewsletter?.is_liked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
        ariaLabel={localNewsletter?.is_liked ? 'Unlike' : 'Like'}
        icon={<Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${localNewsletter?.is_liked ? 'fill-red-500' : 'fill-none'}`} stroke="currentColor" />}
        text={localNewsletter?.is_liked ? 'Liked' : 'Like'}
      />
      <DetailActionButton
        onClick={handleOptimisticToggleQueue}
        disabled={isTogglingQueue || isCheckingQueue}
        isLoading={isTogglingQueue || isCheckingQueue}
        className={isInQueue ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
        ariaLabel={isInQueue ? 'Remove from queue' : 'Add to queue'}
        icon={!(isTogglingQueue || isCheckingQueue) ? <BookmarkIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInQueue ? 'fill-yellow-500' : 'fill-none'}`} stroke="currentColor" /> : undefined}
        text={isCheckingQueue ? 'Checking...' : isInQueue ? 'Saved' : 'Save'}
      />
      {!localNewsletter?.is_archived ? (
        <DetailActionButton
          onClick={archiveHandler}
          disabled={isArchiving}
          isLoading={isArchiving}
          className="bg-amber-100 text-amber-700 hover:bg-amber-200"
          ariaLabel="Archive newsletter"
          icon={<Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          text="Archive"
        />
      ) : (
        <>
          <DetailActionButton
            onClick={unarchiveHandler}
            disabled={isArchiving}
            isLoading={isArchiving}
            className="bg-blue-100 text-blue-700 hover:bg-blue-200"
            ariaLabel="Unarchive newsletter"
            icon={<ArchiveX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            text="Unarchive"
          />
          <DetailActionButton
            onClick={trashHandler}
            disabled={effectiveIsDeleting}
            isLoading={effectiveIsDeleting}
            className="bg-red-100 text-red-700 hover:bg-red-200"
            ariaLabel="Delete newsletter permanently"
            icon={<TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            text="Delete"
          />
        </>
      )}
    </div>
  );
};

export default NewsletterDetailActions;
