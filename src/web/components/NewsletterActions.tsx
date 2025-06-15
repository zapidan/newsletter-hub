import React from "react";
import {
  Heart,
  BookmarkIcon,
  Archive,
  ArchiveX,
  Trash,
  Eye,
  EyeOff,
} from "lucide-react";
import { NewsletterWithRelations } from "@common/types";

interface NewsletterActionsProps {
  newsletter: NewsletterWithRelations;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleBookmark: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue?: (newsletterId: string) => Promise<void>;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  errorTogglingBookmark?: Error | null;
  isInReadingQueue?: boolean;
  showTrashButton?: boolean;
  showQueueButton?: boolean;
  showReadButton?: boolean;
  compact?: boolean;
}

const NewsletterActions: React.FC<NewsletterActionsProps> = ({
  newsletter,
  onToggleLike,
  onToggleBookmark,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  loadingStates = {},
  errorTogglingLike,
  errorTogglingBookmark,
  isInReadingQueue = false,
  showTrashButton = true,
  showQueueButton = true,
  showReadButton = true,
  compact = false,
}) => {
  const buttonClass = compact
    ? "p-1 rounded-full hover:bg-gray-200 transition-colors"
    : "p-2 rounded-full hover:bg-gray-200 transition-colors";

  const iconSize = compact ? "h-4 w-4" : "h-5 w-5";
  const loadingIconSize = compact ? "h-4 w-4" : "h-5 w-5";

  const isLoading = (action: string) => loadingStates[newsletter.id] === action;
  const isDisabled = (action: string) => isLoading(action);

  const LoadingSpinner = ({ size = loadingIconSize }: { size?: string }) => (
    <div
      className={`${size} animate-spin rounded-full border-2 border-gray-400 border-t-transparent`}
    />
  );

  return (
    <div
      className={`flex items-center space-x-1 ${compact ? "space-x-0.5" : "space-x-1"}`}
    >
      {/* Read/Unread Toggle Button */}
      {showReadButton && (
        <button
          type="button"
          className={`${buttonClass} ${isDisabled("read") ? "opacity-50" : ""}`}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await onToggleRead(newsletter.id);
            } catch (error) {
              console.error("Error toggling read status:", error);
            }
          }}
          disabled={isDisabled("read")}
          title={newsletter.is_read ? "Mark as unread" : "Mark as read"}
        >
          {isLoading("read") ? (
            <LoadingSpinner />
          ) : newsletter.is_read ? (
            <EyeOff className={`${iconSize} text-gray-600`} />
          ) : (
            <Eye className={`${iconSize} text-blue-600`} />
          )}
        </button>
      )}

      {/* Like Button */}
      <button
        type="button"
        className={`${buttonClass} ${isDisabled("like") ? "opacity-50" : ""}`}
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await onToggleLike(newsletter);
          } catch (error) {
            console.error("Error toggling like:", error);
          }
        }}
        disabled={isDisabled("like")}
        title={newsletter.is_liked ? "Unlike" : "Like"}
      >
        {isLoading("like") ? (
          <LoadingSpinner />
        ) : (
          <Heart
            className={`${iconSize} ${
              newsletter.is_liked
                ? "text-red-500 fill-current"
                : "text-gray-600 hover:text-red-500"
            }`}
          />
        )}
      </button>

      {/* Queue Button */}
      {showQueueButton && onToggleQueue && (
        <button
          type="button"
          className={`${buttonClass} ${isDisabled("queue") ? "opacity-50" : ""}`}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await onToggleQueue(newsletter.id);
            } catch (error) {
              console.error("Error toggling queue:", error);
            }
          }}
          disabled={isDisabled("queue")}
          title={isInReadingQueue ? "Remove from queue" : "Add to queue"}
        >
          {isLoading("queue") ? (
            <LoadingSpinner />
          ) : (
            <BookmarkIcon
              className={`${iconSize} rounded border-2 ${
                isInReadingQueue
                  ? "text-yellow-500 fill-current"
                  : "text-gray-600 hover:text-yellow-500"
              }`}
            />
          )}
        </button>
      )}

      {/* Archive/Unarchive Button */}
      <button
        type="button"
        className={`${buttonClass} ${isDisabled("archive") ? "opacity-50" : ""}`}
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await onToggleArchive(newsletter.id);
          } catch (error) {
            console.error("Error toggling archive:", error);
          }
        }}
        disabled={isDisabled("archive")}
        title={newsletter.is_archived ? "Unarchive" : "Archive"}
      >
        {isLoading("archive") ? (
          <LoadingSpinner />
        ) : newsletter.is_archived ? (
          <ArchiveX className={`${iconSize} text-green-700`} />
        ) : (
          <Archive className={`${iconSize} text-amber-700`} />
        )}
      </button>

      {/* Trash Button - Only show for archived newsletters */}
      {showTrashButton && newsletter.is_archived && (
        <button
          type="button"
          className={`${buttonClass} ${isDisabled("delete") ? "opacity-50" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrash(newsletter.id);
          }}
          disabled={isDisabled("delete")}
          title="Delete permanently"
        >
          {isLoading("delete") ? (
            <LoadingSpinner />
          ) : (
            <Trash className={`${iconSize} text-red-600`} />
          )}
        </button>
      )}

      {/* Error States */}
      {errorTogglingLike && (
        <div className="text-red-500 text-xs" title="Error toggling like">
          ⚠️
        </div>
      )}
      {errorTogglingBookmark && (
        <div className="text-red-500 text-xs" title="Error toggling bookmark">
          ⚠️
        </div>
      )}
    </div>
  );
};

export default NewsletterActions;
