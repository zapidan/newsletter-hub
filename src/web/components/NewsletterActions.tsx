import { NewsletterWithRelations } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import clsx from 'clsx';
import {
  Archive,
  ArchiveX,
  BookmarkIcon,
  Eye,
  EyeOff,
  Heart,
  MoreHorizontal,
  Trash,
} from 'lucide-react';
import React, { useState } from 'react';

interface NewsletterActionsProps {
  newsletter: NewsletterWithRelations;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue?: (newsletterId: string) => Promise<void>;
  _onToggleTagVisibility?: (e: React.MouseEvent) => void;
  loadingStates?: Record<string, string>;
  _errorTogglingLike?: Error | null;
  isInReadingQueue?: boolean;
  compact?: boolean;
}

// Action Button Component
const ActionButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  _isActive?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}> = ({
  onClick,
  disabled = false,
  isLoading = false,
  _isActive = false,
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  className,
}) => {
  const baseClasses = `
    inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed
    ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}
  `;

  const variantClasses = {
    primary: 'text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    secondary: 'text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    danger: 'text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
  };

  const finalClasses = className || variantClasses[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${finalClasses}`}
      aria-label={label}
      title={label}
    >
      {isLoading ? (
        <div
          className={`animate-spin rounded-full border-2 border-current border-t-transparent ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}
        />
      ) : (
        <span className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>{icon}</span>
      )}
    </button>
  );
};

const NewsletterActions: React.FC<NewsletterActionsProps> = ({
  newsletter,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  _onToggleTagVisibility,
  loadingStates = {},
  _errorTogglingLike,
  isInReadingQueue = false,
  compact = false,
}) => {
  const log = useLogger('NewsletterActions');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleToggleRead = async () => {
    try {
      await onToggleRead(newsletter.id);
    } catch (error) {
      log.error(
        'Failed to toggle read status',
        { newsletterId: newsletter.id },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const handleToggleLike = async () => {
    try {
      await onToggleLike(newsletter);
    } catch (error) {
      log.error(
        'Failed to toggle like',
        { newsletterId: newsletter.id },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const handleToggleArchive = async () => {
    try {
      await onToggleArchive(newsletter.id);
    } catch (error) {
      log.error(
        'Failed to toggle archive',
        { newsletterId: newsletter.id },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const handleToggleQueue = async () => {
    if (!onToggleQueue) return;
    try {
      await onToggleQueue(newsletter.id);
    } catch (error) {
      log.error(
        'Failed to toggle queue',
        { newsletterId: newsletter.id },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const handleTrash = () => {
    onTrash(newsletter.id);
  };

  const isRead = newsletter.is_read;
  const isLiked = newsletter.is_liked;
  const isArchived = newsletter.is_archived;
  const isLoading = Object.keys(loadingStates).length > 0;
  const size = compact ? 'sm' : 'md';

  // On mobile, show archive, queue, like as primary actions; move read and tag to more menu
  const primaryActions = [
    ...(onToggleQueue
      ? [
          {
            key: 'queue',
            action: handleToggleQueue,
            icon: (
              <BookmarkIcon
                size={14}
                className={isInReadingQueue ? 'fill-blue-500 text-blue-500' : 'text-gray-700'}
              />
            ),
            label: isInReadingQueue ? 'Remove from queue' : 'Add to queue',
            variant: 'secondary' as const,
            _isActive: isInReadingQueue,
            isLoading: loadingStates[newsletter.id] === 'queue',
          },
        ]
      : []),
    {
      key: 'archive',
      action: handleToggleArchive,
      icon: isArchived ? <ArchiveX size={14} /> : <Archive size={14} />,
      label: isArchived ? 'Unarchive' : 'Archive',
      variant: 'secondary' as const,
      isLoading: loadingStates[newsletter.id] === 'archive',
      className: isArchived ? 'text-green-600 hover:bg-green-100' : undefined,
    },
    {
      key: 'like',
      action: handleToggleLike,
      icon: <Heart size={14} className={isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700'} />,
      label: isLiked ? 'Unlike' : 'Like',
      variant: 'secondary' as const,
      _isActive: isLiked,
      isLoading: loadingStates[newsletter.id] === 'like',
    },
  ];

  // In secondaryActions, ensure all actions are () => void
  const secondaryActions = [
    {
      key: 'read',
      action: () => {
        handleToggleRead();
      },
      icon: isRead ? <EyeOff size={14} /> : <Eye size={14} className="text-gray-700" />,
      label: isRead ? 'Mark as unread' : 'Mark as read',
      variant: 'primary' as const,
      isLoading: loadingStates[newsletter.id] === 'read',
      className: undefined,
    },
    // Remove tags action from the more menu
    // Only show trash icon for archived newsletters
    ...(isArchived
      ? [
          {
            key: 'trash',
            action: handleTrash,
            icon: <Trash size={14} />,
            label: 'Delete',
            variant: 'danger' as const,
            isLoading: loadingStates[newsletter.id] === 'trash',
            className: 'text-red-600 hover:bg-red-100',
          },
        ]
      : []),
  ];

  return (
    <div className="flex items-center gap-1">
      {/* Primary Actions - Always visible */}
      {primaryActions.map((action) => (
        <ActionButton
          key={action.key}
          onClick={action.action}
          disabled={isLoading}
          isLoading={action.isLoading}
          _isActive={action._isActive}
          icon={action.icon}
          label={action.label}
          variant={action.variant}
          size={size}
          className={action.className}
        />
      ))}

      {/* Secondary Actions - Show on desktop, hide in more menu on mobile */}
      <div className="hidden sm:flex items-center gap-1">
        {secondaryActions.map((action) => (
          <ActionButton
            key={action.key}
            onClick={action.action}
            disabled={isLoading}
            isLoading={action.isLoading}
            icon={action.icon}
            label={action.label}
            variant={action.variant}
            size={size}
            className={action.className}
          />
        ))}
      </div>

      {/* More Menu for Mobile */}
      <div className="sm:hidden relative">
        <ActionButton
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          disabled={isLoading}
          icon={<MoreHorizontal size={14} />}
          label="More actions"
          variant="secondary"
          size={size}
        />

        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[100]" onClick={() => setShowMoreMenu(false)} />

            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-[110] py-1">
              {secondaryActions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => {
                    action.action();
                    setShowMoreMenu(false);
                  }}
                  disabled={isLoading || action.isLoading}
                  className={clsx(
                    'flex items-center justify-center p-2 hover:bg-gray-100 transition-colors',
                    'w-10 h-10 rounded-lg',
                    { 'opacity-50 cursor-not-allowed': isLoading || action.isLoading },
                    action.className
                  )}
                  title={action.label}
                  aria-label={action.label}
                >
                  {action.isLoading ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span className="w-4 h-4">{action.icon}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsletterActions;
