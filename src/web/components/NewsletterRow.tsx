import { NewsletterWithRelations, Tag } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import { Loader2, Tag as TagIcon } from "lucide-react";
import React, { useCallback } from "react";
import NewsletterActions from "./NewsletterActions";
import TagSelector from "./TagSelector";

interface NewsletterRowProps {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue: (newsletterId: string) => Promise<void>;
  onToggleTagVisibility: (id: string, e: React.MouseEvent) => void;
  onUpdateTags: (newsletterId: string, tagIds: string[]) => void;
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
  isDeletingNewsletter: boolean;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  isUpdatingTags?: boolean;
  tagUpdateError?: string | null;
  onDismissTagError?: () => void;
}

const NewsletterRow: React.FC<NewsletterRowProps> = ({
  newsletter,
  isSelected = false,
  onToggleSelect,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  onToggleTagVisibility,
  onUpdateTags,
  onTagClick,
  onNewsletterClick,
  onRowClick,
  onMouseEnter,
  isInReadingQueue = false,
  showCheckbox = false,
  visibleTags,
  loadingStates = {},
  errorTogglingLike,
  isUpdatingTags = false,
  tagUpdateError,
  onDismissTagError,
}) => {
  const log = useLogger();
  const handleRowClick = (e: React.MouseEvent) => {
    // Only proceed if the click wasn't on a button or link
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) {
      return;
    }

    if (onRowClick) {
      onRowClick(newsletter, e);
    } else if (onNewsletterClick) {
      onNewsletterClick(newsletter);
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
    (tagIds: string[]) => {
      onUpdateTags(newsletter.id, tagIds);
    },
    [onUpdateTags, newsletter.id],
  );

  const handleMouseEnter = useCallback(() => {
    if (onMouseEnter) {
      onMouseEnter(newsletter);
    }
  }, [onMouseEnter, newsletter]);

  return (
    <div
      role="listitem"
      data-testid={`newsletter-row-main-${newsletter.id}`}
      onClick={handleRowClick}
      onMouseEnter={handleMouseEnter}
      className={`rounded-lg p-4 flex items-start cursor-pointer transition-all duration-200 ${!newsletter.is_read
          ? "bg-blue-50/60 border-l-3 border-blue-500 hover:bg-blue-100/50"
          : "bg-white hover:bg-neutral-50"
        } ${isSelected ? "ring-2 ring-primary-400" : ""} border border-neutral-200`}
    >
      {showCheckbox && onToggleSelect && (
        <div className="flex items-center h-5 mr-4 mt-1">
          <div
            className={`flex items-center justify-center h-5 w-5 rounded border ${isSelected ? 'bg-blue-50 border-blue-400' : 'border-gray-300 bg-white'} transition-colors`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(newsletter.id);
            }}
            title="Select newsletter"
          >
            {isSelected && (
              <svg className="h-3.5 w-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base truncate">
                  {newsletter.title || "No subject"}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {newsletter.source?.name || "Unknown Source"}
                  {newsletter.source?.from && (
                    <span className="text-gray-400 ml-2">
                      • {newsletter.source.from}
                    </span>
                  )}
                </div>
              </div>
              {/* Action buttons moved to upper right */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Tag visibility toggle */}
                <button
                  type="button"
                  className={`btn btn-ghost btn-xs p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${isUpdatingTags ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  onClick={(e) => {
                    log.debug("Tag icon clicked", {
                      action: "toggle_tag_visibility",
                      metadata: {
                        newsletterId: newsletter.id,
                        isUpdatingTags,
                      },
                    });
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
                      size={14}
                      className="animate-spin text-primary-600"
                    />
                  ) : (
                    <TagIcon
                      size={14}
                      className={`${visibleTags.has(newsletter.id)
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
                  onToggleArchive={onToggleArchive}
                  onToggleRead={onToggleRead}
                  onTrash={onTrash}
                  onToggleQueue={onToggleQueue}
                  loadingStates={loadingStates}
                  errorTogglingLike={errorTogglingLike}
                  isInReadingQueue={isInReadingQueue}
                  compact={true}
                />
              </div>
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
                    {onDismissTagError && (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700 underline mt-1"
                        onClick={onDismissTagError}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}
                <TagSelector
                  selectedTags={newsletter.tags || []}
                  onTagsChange={(newTags) => {
                    const tagIds = newTags.map((tag) => tag.id);
                    handleUpdateTags(tagIds);
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
