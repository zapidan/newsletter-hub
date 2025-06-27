import { NewsletterWithRelations, Tag } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import { ExternalLink, Loader2 } from "lucide-react";
import React, { useCallback } from "react";
import NewsletterActions from "./NewsletterActions";

interface NewsletterRowProps {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue: (newsletterId: string) => Promise<void>;
  onTagClick: (tag: Tag, e: React.MouseEvent) => void;
  onNewsletterClick?: (newsletter: NewsletterWithRelations) => void;
  onRowClick?: (
    newsletter: NewsletterWithRelations,
    e: React.MouseEvent,
  ) => void;
  onMouseEnter?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue: boolean;
  showCheckbox?: boolean;
  showTags?: boolean;
  showSource?: boolean;
  showDate?: boolean;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
  visibleTags: Set<string>;
  readingQueue: Array<{ newsletter_id: string }>;
  isDeletingNewsletter: boolean;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  isUpdatingTags?: boolean;
  tagUpdateError?: string | null;
  onDismissTagError?: () => void;
}

// Source color mapping for visual distinction
const getSourceColor = (sourceName: string) => {
  const colors = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-green-100 text-green-700 border-green-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-orange-100 text-orange-700 border-orange-200",
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-amber-100 text-amber-700 border-amber-200",
  ];

  const hash = sourceName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  return colors[Math.abs(hash) % colors.length];
};

const NewsletterRow: React.FC<NewsletterRowProps> = ({
  newsletter,
  isSelected = false,
  onToggleSelect,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  onTagClick,
  onNewsletterClick,
  onRowClick,
  onMouseEnter,
  isInReadingQueue = false,
  showCheckbox = false,
  showTags = true,
  showSource = true,
  showDate = true,
  showActions = true,
  compact = false,
  className = "",
  visibleTags,
  loadingStates = {},
  errorTogglingLike,
  isUpdatingTags = false,
  tagUpdateError,
  onDismissTagError,
}) => {
  const _log = useLogger("NewsletterRow");

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent click if the target is a button or link
      if (
        (e.target as HTMLElement).closest('button, a, input, [role="checkbox"]')
      ) {
        return;
      }
      if (onNewsletterClick) {
        onNewsletterClick(newsletter);
      }
      if (onRowClick) {
        onRowClick(newsletter, e);
      }
    },
    [newsletter, onRowClick, onNewsletterClick]
  );

  const isRead = newsletter.is_read;
  const _isLiked = newsletter.is_liked;
  const _isArchived = newsletter.is_archived;
  const hasTags = newsletter.tags && newsletter.tags.length > 0;

  return (
    <div
      data-testid={`newsletter-row-main-${newsletter.id}`}
      className={`
        group relative bg-white rounded-xl border border-slate-200/60 shadow-sm
        hover:shadow-md hover:border-slate-300/60 transition-all duration-200
        ${isSelected ? "ring-2 ring-blue-500 ring-primary-400 ring-offset-2" : ""}
        ${isRead ? "" : "bg-blue-50/60"}
        ${className}
      `}
      onClick={handleClick}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (onNewsletterClick) {
            onNewsletterClick(newsletter);
          }
        }
      }}
      aria-label={`${newsletter.title} from ${newsletter.source?.name || "Unknown source"}`}
      onMouseEnter={() => onMouseEnter && onMouseEnter(newsletter)}
    >
      {/* Selection Checkbox */}
      {showCheckbox && onToggleSelect && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(newsletter.id); }}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            onClick={(e) => e.stopPropagation()}
            title="Select newsletter"
            aria-label="Select newsletter"
          />
        </div>
      )}

      <div className={`p-4 ${showCheckbox ? "pl-12" : ""}`}>
        {/* Header Row - Source only (date moved to bottom) */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showSource && newsletter.source && (
              <span
                className={`
                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
                  ${getSourceColor(newsletter.source.name)}
                  flex-shrink-0
                `}
              >
                {newsletter.source.name}
              </span>
            )}

            {/* Read/Unread indicator */}
            <div
              className={`
                w-2 h-2 rounded-full flex-shrink-0
                ${isRead ? "bg-gray-300" : "bg-blue-500"}
              `}
              aria-label={isRead ? "Read" : "Unread"}
            />
          </div>

          {/* Action buttons moved to upper right */}
          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <NewsletterActions
                newsletter={newsletter}
                onToggleLike={onToggleLike}
                onToggleArchive={onToggleArchive}
                onToggleRead={onToggleRead}
                onTrash={onTrash}
                onToggleQueue={onToggleQueue}
                loadingStates={loadingStates}
                _errorTogglingLike={errorTogglingLike}
                isInReadingQueue={isInReadingQueue}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Title Row */}
        <div className="mb-3">
          <h3
            data-testid="newsletter-title"
            className={`
              font-medium leading-tight text-slate-800 group-hover:text-slate-900 transition-colors
              ${compact ? "text-sm" : "text-base"}
              ${isRead ? "font-normal" : "font-semibold"}
              line-clamp-2
            `}
          >
            {newsletter.title}
          </h3>
          {newsletter.summary && (
            <div className="text-xs text-gray-600 mt-1 line-clamp-2">{newsletter.summary}</div>
          )}
        </div>

        {/* Tag update error and loading spinner */}
        {visibleTags.has(newsletter.id) && (
          <>
            {tagUpdateError && (
              <div className="bg-red-100 text-red-700 px-2 py-1 rounded flex items-center gap-2 mb-2">
                <span>{tagUpdateError}</span>
                {onDismissTagError && (
                  <button onClick={() => onDismissTagError()} className="ml-2 text-xs underline">Dismiss</button>
                )}
              </div>
            )}
            {isUpdatingTags && (
              <div className="flex items-center gap-2 text-blue-600 mb-2" title="Updating tags...">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating tags...</span>
              </div>
            )}
          </>
        )}

        {/* Bottom Row - Tags (left) and Date (right) */}
        <div className="flex items-center justify-between mt-2">
          {/* Tags as pills on the left */}
          {showTags && hasTags && (
            <div className="flex flex-wrap gap-1">
              {newsletter.tags?.map((tag: Tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTagClick) {
                      onTagClick(tag, e);
                    }
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Date and read time on the right */}
          {showDate && (
            <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
              {new Date(newsletter.received_at).toLocaleDateString()} ·{" "}
              {newsletter.estimated_read_time} min read
            </span>
          )}
        </div>

        {/* External Link - positioned below if needed */}
        {newsletter.content && (
          <div className="flex justify-end mt-2">
            <a
              href={newsletter.content}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50
                transition-all duration-200 flex-shrink-0
                ${compact ? "p-1" : "p-1.5"}
              `}
              onClick={(e) => e.stopPropagation()}
              aria-label="Open newsletter in new tab"
            >
              <ExternalLink className={compact ? "w-3 h-3" : "w-4 h-4"} />
            </a>
          </div>
        )}

        {/* Loading State */}
        {Object.keys(loadingStates).length > 0 && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Updating...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsletterRow;
