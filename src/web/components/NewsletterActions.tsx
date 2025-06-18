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
import { useLogger } from "@common/utils/logger/useLogger";

interface NewsletterActionsProps {
  newsletter: NewsletterWithRelations;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue?: (newsletterId: string) => Promise<void>;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  isInReadingQueue?: boolean;
  showTrashButton?: boolean;
  showQueueButton?: boolean;
  showReadButton?: boolean;
  compact?: boolean;
}

const NewsletterActions: React.FC<NewsletterActionsProps> = ({
  newsletter,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  loadingStates = {},
  errorTogglingLike,
  isInReadingQueue = false,
  showTrashButton = true,
  showQueueButton = true,
  showReadButton = true,
  compact = false,
}) => {
  const log = useLogger("NewsletterActions");
  const buttonClass = compact
    ? "btn btn-ghost btn-xs p-1.5 rounded-lg hover:bg-gray-200 transition-all"
    : "btn btn-ghost btn-sm p-2 rounded-lg hover:bg-gray-200 transition-all";

  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const loadingIconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  const isLoading = (action: string) => loadingStates[newsletter.id] === action;
  const isDisabled = (action: string) => isLoading(action);

  const LoadingSpinner = ({ size = loadingIconSize }: { size?: string }) => (
    <div
      className={`${size} animate-spin rounded-full border-2 border-gray-400 border-t-transparent`}
    />
  );

  return (
    <div
      className={`flex items-center ${compact ? "gap-0.5" : "gap-1"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Read/Unread Toggle Button */}
      {showReadButton && (
        <button
          type="button"
          className={`${buttonClass} ${isDisabled("read") ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDisabled("read")) return;
            try {
              await onToggleRead(newsletter.id);
            } catch (error) {
              log.error(
                "Error toggling read status",
                {
                  action: "toggle_read",
                  metadata: { newsletterId: newsletter.id },
                },
                error instanceof Error ? error : new Error(String(error)),
              );
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
        className={`${buttonClass} ${isDisabled("like") ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isDisabled("like")) return;
          try {
            await onToggleLike(newsletter);
          } catch (error) {
            log.error(
              "Error toggling like",
              {
                action: "toggle_like",
                metadata: { newsletterId: newsletter.id },
              },
              error instanceof Error ? error : new Error(String(error)),
            );
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
          className={`${buttonClass} ${isDisabled("queue") ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDisabled("queue")) return;
            try {
              await onToggleQueue(newsletter.id);
            } catch (error) {
              log.error(
                "Error toggling queue",
                {
                  action: "toggle_queue",
                  metadata: { newsletterId: newsletter.id },
                },
                error instanceof Error ? error : new Error(String(error)),
              );
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
        className={`${buttonClass} ${isDisabled("archive") ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isDisabled("archive")) return;
          try {
            await onToggleArchive(newsletter.id);
          } catch (error) {
            log.error(
              "Error toggling archive",
              {
                action: "toggle_archive",
                metadata: { newsletterId: newsletter.id },
              },
              error instanceof Error ? error : new Error(String(error)),
            );
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
          className={`${buttonClass} ${isDisabled("delete") ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDisabled("delete")) return;
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
    </div>
  );
};

export default NewsletterActions;
