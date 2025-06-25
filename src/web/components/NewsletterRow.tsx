import { NewsletterWithRelations, Tag } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import { Loader2, Tag as TagIcon } from "lucide-react";
import React, { useCallback, useState, useEffect } from "react";
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
  onRowClick?: (newsletter: NewsletterWithRelations, e: React.MouseEvent) => void;
  onMouseEnter?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue: boolean;
  showCheckbox?: boolean;
  showTags?: boolean; // This prop might be less relevant if tags are always shown or controlled differently
  visibleTags: Set<string>; // Controls visibility of the TagSelector
  readingQueue: Array<{ newsletter_id: string }>; // Used by NewsletterActions
  isDeletingNewsletter: boolean; // Used by NewsletterActions
  loadingStates?: Record<string, string>; // Used by NewsletterActions
  errorTogglingLike?: Error | null; // Used by NewsletterActions
  isUpdatingTags?: boolean; // For the TagSelector and its trigger button
  tagUpdateError?: string | null; // For the TagSelector
  onDismissTagError?: () => void; // For the TagSelector
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
  // readingQueue, // No longer needed directly here, passed to NewsletterActions
  // isDeletingNewsletter, // No longer needed directly here, passed to NewsletterActions
  loadingStates = {},
  errorTogglingLike,
  isUpdatingTags = false,
  tagUpdateError,
  onDismissTagError,
}) => {
  const log = useLogger();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest('[data-prevent-row-click="true"]')) {
      return;
    }
    if (onRowClick) onRowClick(newsletter, e);
    else if (onNewsletterClick) onNewsletterClick(newsletter);
  };

  const handleDisplayTagClick = useCallback((tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    onTagClick(tag, e); // Propagate to parent for filter logic
  }, [onTagClick]);

  const handleUpdateTagsInSelector = useCallback((tagIds: string[]) => {
    onUpdateTags(newsletter.id, tagIds);
  }, [onUpdateTags, newsletter.id]);

  const handleMouseEnterCb = useCallback(() => {
    if (onMouseEnter) onMouseEnter(newsletter);
  }, [onMouseEnter, newsletter]);

  const receivedDate = new Date(newsletter.received_at);
  const formattedDate = isMobile
    ? receivedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : receivedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div
      role="listitem"
      data-testid={`newsletter-row-main-${newsletter.id}`}
      onClick={handleRowClick}
      onMouseEnter={handleMouseEnterCb}
      className={`
        rounded-lg p-3 sm:p-4 flex items-start cursor-pointer transition-all duration-200
        border border-neutral-200/80 hover:shadow-md
        ${!newsletter.is_read ? "bg-blue-50/70 border-l-4 border-blue-500 hover:bg-blue-100/60" : "bg-white hover:bg-neutral-50/80"}
        ${isSelected ? "ring-2 ring-offset-1 ring-primary-400 shadow-md" : ""}
      `}
    >
      {showCheckbox && onToggleSelect && (
        <div className="flex items-center h-5 mr-3 sm:mr-4 mt-0.5 sm:mt-1" data-prevent-row-click="true">
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(newsletter.id);
            }}
            aria-label={`Select newsletter: ${newsletter.title}`}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* Top section: Title, Source, Actions */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-1 sm:gap-3 mb-1">
          {/* Left part: Title and Source */}
          <div className="flex-1 min-w-0 order-1 sm:order-none">
            <h3 className="font-semibold text-sm sm:text-base text-slate-800 line-clamp-2 sm:line-clamp-1" title={newsletter.title}>
              {newsletter.title || "No subject"}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 line-clamp-1" title={newsletter.source?.name}>
              {newsletter.source?.name || "Unknown Source"}
            </p>
          </div>

          {/* Right part: Actions (Tag toggle, NewsletterActions) */}
          <div className="flex items-center gap-1 flex-shrink-0 order-none sm:order-1 self-start sm:self-center" data-prevent-row-click="true">
            <button
              type="button"
              className={`btn btn-ghost btn-xs p-1.5 rounded-md hover:bg-gray-200/70 transition-colors ${isUpdatingTags ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isUpdatingTags) onToggleTagVisibility(newsletter.id, e);
              }}
              disabled={isUpdatingTags}
              title={isUpdatingTags ? "Updating tags..." : (visibleTags.has(newsletter.id) ? "Hide tags" : "Edit tags")}
            >
              {isUpdatingTags ? <Loader2 size={14} className="animate-spin text-primary-600" /> : <TagIcon size={14} className={`${visibleTags.has(newsletter.id) ? "text-primary-600" : "text-gray-500"} hover:text-primary-600`} />}
            </button>
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
              compact={true} // Keep actions compact
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Middle section: Summary (visible on larger screens or if no tags) */}
        {!isMobile && newsletter.summary && (
           <p className="text-sm text-gray-700 mt-1 mb-2 line-clamp-2" title={newsletter.summary}>
             {newsletter.summary}
           </p>
        )}

        {/* Tags Selector (conditionally rendered) */}
        {visibleTags.has(newsletter.id) && (
          <div className="w-full mt-2 pt-2 border-t border-gray-200/70" data-prevent-row-click="true">
            {tagUpdateError && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs sm:text-sm text-red-600">{tagUpdateError}</p>
                {onDismissTagError && <button type="button" className="text-xs text-red-500 hover:text-red-700 underline mt-1" onClick={onDismissTagError}>Dismiss</button>}
              </div>
            )}
            <TagSelector
              selectedTags={newsletter.tags || []}
              onTagsChange={handleUpdateTagsInSelector}
              onTagClick={(tag, e) => { e.stopPropagation(); onTagClick(tag, e);}} // Prevent row click, propagate for filter
              onTagDeleted={() => { /* Parent handles refresh */ }}
              className="mt-1"
              disabled={isUpdatingTags}
              size="sm"
            />
            {isUpdatingTags && <div className="flex items-center mt-2 text-xs sm:text-sm text-gray-500"><Loader2 size={14} className="animate-spin mr-2" />Updating tags...</div>}
          </div>
        )}

        {/* Bottom section: Displayed Tags and Date/Read Time */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex flex-wrap gap-1 mb-1 sm:mb-0" data-prevent-row-click="true">
            {(newsletter.tags || []).slice(0, isMobile ? 2 : 4).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-medium cursor-pointer hover:opacity-80"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                onClick={(e) => handleDisplayTagClick(tag, e)}
                title={`Filter by tag: ${tag.name}`}
              >
                {tag.name}
              </span>
            ))}
            {(newsletter.tags?.length || 0) > (isMobile ? 2 : 4) && (
                 <span className="text-[10px] sm:text-xs text-gray-400 self-center">
                    +{(newsletter.tags?.length || 0) - (isMobile ? 2 : 4)} more
                 </span>
            )}
          </div>
          <span className="whitespace-nowrap text-gray-400 text-[11px] sm:text-xs self-end sm:self-center">
            {formattedDate}
            {newsletter.estimated_read_time > 0 && ` · ${newsletter.estimated_read_time} min read`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NewsletterRow;
