import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Tag as TagIcon, Loader2 } from "lucide-react";
import { NewsletterWithRelations, Tag } from "@common/types";
import { usePrefetchNewsletterDetail } from "@common/hooks/useNewsletterDetail";
import TagSelector from "./TagSelector";
import NewsletterActions from "./NewsletterActions";
import { getErrorMessage, ERROR_CODES } from "@common/constants/errorMessages";

interface NewsletterRowProps {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleBookmark: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue: (newsletterId: string) => Promise<void>;
  onToggleTagVisibility: (id: string, e: React.MouseEvent) => void;
  onUpdateTags: (newsletterId: string, tagIds: string[]) => Promise<void>;
  onTagClick: (tag: Tag, e: React.MouseEvent) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, id: string) => void;
  onNewsletterClick?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue: boolean;
  showCheckbox?: boolean;
  showTags?: boolean;
  visibleTags: Set<string>;
  readingQueue: Array<{ newsletter_id: string }>;
  isDeletingNewsletter: boolean;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  errorTogglingBookmark?: Error | null;
  isUpdatingTags?: boolean;
}

const NewsletterRow: React.FC<NewsletterRowProps> = ({
  newsletter,
  isSelected = false,
  onToggleSelect,
  onToggleLike,
  onToggleBookmark,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  onToggleTagVisibility,
  onUpdateTags,
  onTagClick,
  onNewsletterClick,
  isInReadingQueue = false,
  showCheckbox = false,
  visibleTags,
  loadingStates = {},
  errorTogglingLike,
  errorTogglingBookmark,
  isUpdatingTags = false,
}) => {
  const navigate = useNavigate();
  const { prefetchNewsletter } = usePrefetchNewsletterDetail();
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);

  const handleRowClick = async (e: React.MouseEvent) => {
    // Only proceed if the click wasn't on a button or link
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) {
      return;
    }

    try {
      // Mark as read if unread
      if (!newsletter.is_read && onToggleRead) {
        await onToggleRead(newsletter.id);
      }

      // Archive the newsletter when opened from the inbox
      if (onToggleArchive && !newsletter.is_archived) {
        await onToggleArchive(newsletter.id);
      }

      // Proceed with navigation
      if (onNewsletterClick) {
        onNewsletterClick(newsletter);
      } else {
        navigate(`/newsletters/${newsletter.id}`);
      }
    } catch (error) {
      console.error("Error handling newsletter click:", error);
      // Still navigate even if marking as read or archiving fails
      if (onNewsletterClick) {
        onNewsletterClick(newsletter);
      } else {
        navigate(`/newsletters/${newsletter.id}`);
      }
    }
  };

  const handleTagClick = useCallback(
    (tag: Tag, e: React.MouseEvent) => {
      e.stopPropagation();
      onTagClick(tag, e);
    },
    [onTagClick],
  );

  const handleUpdateTags = useCallback(
    async (tagIds: string[]) => {
      setTagUpdateError(null);

      try {
        await onUpdateTags(newsletter.id, tagIds);
        toast.success("Tags updated successfully");
      } catch (error) {
        console.error("Error updating tags:", error);

        // Extract user-friendly error message
        let errorMessage = "Failed to update tags";
        if (error instanceof Error) {
          if ("code" in error) {
            errorMessage = getErrorMessage(
              error.code as keyof typeof ERROR_CODES,
            );
          } else {
            errorMessage = error.message || errorMessage;
          }
        }

        setTagUpdateError(errorMessage);
        toast.error(errorMessage);
        throw error;
      }
    },
    [onUpdateTags, newsletter.id],
  );

  // Prefetch newsletter details on hover for better performance
  const handleMouseEnter = useCallback(() => {
    // Only prefetch if the newsletter is unread (more likely to be opened)
    // or if it's not archived (archived newsletters are less likely to be opened)
    if (!newsletter.is_read || !newsletter.is_archived) {
      prefetchNewsletter(newsletter.id, { priority: !newsletter.is_read });
    }
  }, [
    prefetchNewsletter,
    newsletter.id,
    newsletter.is_read,
    newsletter.is_archived,
  ]);

  const handleMouseLeave = useCallback(() => {
    // Could implement cleanup logic here if needed
    // For now, we let the cache handle cleanup based on its own policies
  }, []);

  return (
    <div
      onClick={handleRowClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`rounded-lg p-4 flex items-start cursor-pointer transition-all duration-200 ${
        !newsletter.is_read
          ? "bg-blue-300 border-l-4 border-blue-800 hover:bg-blue-400 shadow-lg shadow-blue-200"
          : "bg-white border border-neutral-200 hover:bg-neutral-50"
      } ${isSelected ? "ring-2 ring-primary-400" : ""}`}
    >
      {showCheckbox && onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(newsletter.id);
          }}
          className="mr-4 mt-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          onClick={(e) => e.stopPropagation()}
          title="Select newsletter"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-1">
          <img
            src={newsletter.image_url || "/newsletter-icon.svg"}
            alt={newsletter.title}
            className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0 mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base truncate">
                  {newsletter.title || "No subject"}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {newsletter.source?.name || "Unknown Source"}
                  {newsletter.source?.domain && (
                    <span className="text-gray-400 ml-2">
                      • {newsletter.source.domain}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <button
                  type="button"
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    newsletter.is_read
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  } ${
                    loadingStates[newsletter.id] === "read" ? "opacity-50" : ""
                  }`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await onToggleRead(newsletter.id);
                    } catch (error) {
                      console.error("Error toggling read status:", error);
                    }
                  }}
                  disabled={loadingStates[newsletter.id] === "read"}
                >
                  {loadingStates[newsletter.id] === "read" ? (
                    <div className="inline-flex items-center">
                      <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-1" />
                      {newsletter.is_read ? "Marking..." : "Marking..."}
                    </div>
                  ) : (
                    <>
                      {newsletter.is_read ? "Mark as Unread" : "Mark as Read"}
                    </>
                  )}
                </button>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-1">
              {/* Tag visibility toggle */}
              <button
                type="button"
                className={`p-1 rounded hover:bg-gray-200 ${
                  isUpdatingTags ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={(e) => {
                  console.log(
                    "Tag icon clicked for newsletter:",
                    newsletter.id,
                  );
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isUpdatingTags) {
                    onToggleTagVisibility(newsletter.id, e);
                  }
                }}
                disabled={isUpdatingTags}
                title={
                  isUpdatingTags
                    ? "Updating tags..."
                    : visibleTags.has(newsletter.id)
                      ? "Hide tags"
                      : "Edit tags"
                }
              >
                {isUpdatingTags ? (
                  <Loader2
                    size={16}
                    className="animate-spin text-primary-600"
                  />
                ) : (
                  <TagIcon
                    size={16}
                    className={`${
                      visibleTags.has(newsletter.id)
                        ? "text-primary-600"
                        : "text-gray-500"
                    } hover:text-primary-600`}
                  />
                )}
                {visibleTags.has(newsletter.id) && !isUpdatingTags && (
                  <span className="sr-only">(Active)</span>
                )}
              </button>

              {/* Newsletter Actions Component */}
              <NewsletterActions
                newsletter={newsletter}
                onToggleLike={onToggleLike}
                onToggleBookmark={onToggleBookmark}
                onToggleArchive={onToggleArchive}
                onToggleRead={onToggleRead}
                onTrash={onTrash}
                onToggleQueue={onToggleQueue}
                loadingStates={loadingStates}
                errorTogglingLike={errorTogglingLike}
                errorTogglingBookmark={errorTogglingBookmark}
                isInReadingQueue={isInReadingQueue}
                compact={true}
              />
            </div>
            <div className="text-sm text-gray-700 mb-2 line-clamp-2">
              {newsletter.summary}
            </div>

            {/* Tags display */}
            {visibleTags.has(newsletter.id) && (
              <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                {tagUpdateError && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{tagUpdateError}</p>
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700 underline mt-1"
                      onClick={() => setTagUpdateError(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                <TagSelector
                  selectedTags={newsletter.tags || []}
                  onTagsChange={async (newTags) => {
                    const tagIds = newTags.map((tag) => tag.id);
                    await handleUpdateTags(tagIds);
                  }}
                  onTagClick={handleTagClick}
                  onTagDeleted={() => {
                    // Refresh handled by parent
                  }}
                  className="mt-1"
                  disabled={isUpdatingTags}
                />
                {isUpdatingTags && (
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Updating tags...
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-wrap gap-1">
                {newsletter.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagClick(tag, e);
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                {new Date(newsletter.received_at).toLocaleDateString()} ·{" "}
                {newsletter.estimated_read_time} min read
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterRow;
