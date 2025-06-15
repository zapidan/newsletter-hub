import React, { useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import NewsletterRow from "../NewsletterRow";
import type {
  Tag,
  Newsletter as BaseNewsletter,
  NewsletterSource,
  NewsletterWithRelations,
} from "@common/types";

// Create a type that makes all properties optional and handles the source field
type Newsletter = Omit<BaseNewsletter, "source"> & {
  source?: NewsletterSource | null;
  newsletter_source_id?: string | null;
  tags?: Tag[];
  user_newsletter_tags?: Tag[];
  [key: string]: unknown; // For any other properties that might be present
};

interface NewsletterRowProps extends React.HTMLAttributes<HTMLDivElement> {
  newsletter: Newsletter;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => Promise<void>;
  onToggleRead?: (id: string) => Promise<void>;
  onToggleLike?: (id: string) => Promise<void>;
  onToggleBookmark?: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive?: (id: string) => Promise<void>;
  onTrash?: (id: string) => void;
  onToggleQueue?: (id: string) => Promise<void>;
  onUpdateTags?: (newsletterId: string, tagIds: string[]) => Promise<void>;
  onTagClick?: (tag: Tag, e: React.MouseEvent) => void;
  onToggleTagVisibility?: (id: string, e: React.MouseEvent) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, id: string) => void;
  onNewsletterClick?: (newsletter: Newsletter) => void;
  isInReadingQueue?: boolean;
  className?: string;
  showCheckbox?: boolean;
  showTags?: boolean;
  visibleTags?: Set<string>;
  readingQueue?: Array<{ newsletter_id: string }>;
  isDeletingNewsletter?: boolean;
}

// Default handlers for optional props
const defaultPromise = async () => {};
const defaultVoid = () => {};
const defaultTagClick = () => {};
const defaultToggleTagVisibility = () => {};
const defaultRemoveFromQueue = () => {};
const defaultBookmarkPromise = async () => {};

export const SortableNewsletterRow: React.FC<
  NewsletterRowProps & { id: string; isDraggable?: boolean }
> = ({
  id,
  isDraggable = true,
  newsletter,
  isSelected = false,
  onToggleSelect = defaultPromise,
  onToggleRead = defaultPromise,
  onToggleLike = defaultPromise,
  onToggleBookmark = defaultBookmarkPromise,
  onToggleArchive = defaultPromise,
  onTrash = defaultVoid,
  onToggleQueue = defaultPromise,
  onUpdateTags,
  onTagClick = defaultTagClick,
  onToggleTagVisibility = defaultToggleTagVisibility,
  onRemoveFromQueue = defaultRemoveFromQueue,
  onNewsletterClick,
  isInReadingQueue = false,
  className = "",
  showCheckbox = false,
  showTags = true,
  visibleTags = new Set<string>(),
  readingQueue = [],
  isDeletingNewsletter = false,
  ...rest
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : "auto",
  };

  // Convert the ID-based onToggleLike to the expected NewsletterWithRelations-based function
  const handleToggleLike = useCallback(
    async (newsletterItem: NewsletterWithRelations) => {
      try {
        if (onToggleLike) {
          await onToggleLike(newsletterItem.id);
        }
      } catch (error) {
        console.error("Error toggling like:", error);
      }
    },
    [onToggleLike],
  );

  // Handle the bookmark toggle with proper typing
  const handleToggleBookmark = useCallback(
    async (newsletterItem: NewsletterWithRelations) => {
      try {
        if (onToggleBookmark) {
          await onToggleBookmark(newsletterItem);
        }
      } catch (error) {
        console.error("Error toggling bookmark:", error);
      }
    },
    [onToggleBookmark],
  );

  // Handle the queue toggle with proper typing
  const handleToggleQueue = useCallback(
    async (newsletterId: string) => {
      try {
        if (onToggleQueue) {
          await onToggleQueue(newsletterId);
        }
      } catch (error) {
        console.error("Error toggling queue status:", error);
      }
    },
    [onToggleQueue],
  );

  // Handle newsletter click with proper type conversion
  const handleNewsletterClick = useCallback(
    (newsletterItem: NewsletterWithRelations) => {
      if (onNewsletterClick) {
        // Convert NewsletterWithRelations back to Newsletter type
        const newsletterForCallback: Newsletter = {
          ...newsletterItem,
          source: newsletterItem.source,
          tags: newsletterItem.tags,
        };
        onNewsletterClick(newsletterForCallback);
      }
    },
    [onNewsletterClick],
  );

  // Convert Newsletter to NewsletterWithRelations
  const newsletterWithRelations: NewsletterWithRelations = {
    ...newsletter,
    newsletter_source_id: newsletter.newsletter_source_id || null,
    source: newsletter.source || null,
    tags: newsletter.tags || [],
    is_archived: newsletter.is_archived || false,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${className}`}
      {...rest}
    >
      <div className="flex items-start">
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <NewsletterRow
            newsletter={newsletterWithRelations}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onToggleRead={onToggleRead}
            onToggleLike={handleToggleLike}
            onToggleBookmark={handleToggleBookmark}
            onToggleArchive={onToggleArchive}
            onTrash={onTrash}
            onToggleQueue={handleToggleQueue}
            onUpdateTags={onUpdateTags || (async () => {})}
            onTagClick={onTagClick}
            onToggleTagVisibility={onToggleTagVisibility}
            onRemoveFromQueue={onRemoveFromQueue}
            onNewsletterClick={handleNewsletterClick}
            isInReadingQueue={isInReadingQueue}
            showCheckbox={showCheckbox}
            showTags={showTags}
            visibleTags={visibleTags}
            readingQueue={readingQueue}
            isDeletingNewsletter={isDeletingNewsletter}
          />
        </div>
      </div>
    </div>
  );
};

export default SortableNewsletterRow;
