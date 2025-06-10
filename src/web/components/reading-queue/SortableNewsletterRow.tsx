import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import NewsletterRow from '../NewsletterRow';
import { NewsletterWithRelations, Tag } from '@common/types';

interface NewsletterRowProps extends React.HTMLAttributes<HTMLDivElement> {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => Promise<void>;
  onToggleRead?: (id: string) => Promise<void>;
  onToggleLike?: (id: string) => Promise<void>;
  onToggleArchive?: (id: string) => Promise<void>;
  onTrash?: (id: string) => void;
  onToggleQueue?: (id: string) => Promise<void>;
  onUpdateTags?: (newsletterId: string, tagIds: string[]) => Promise<void>;
  onTagClick?: (tag: Tag, e: React.MouseEvent) => void;
  onToggleTagVisibility?: (id: string, e: React.MouseEvent) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, id: string) => void;
  onNewsletterClick?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue?: boolean;
  className?: string;
  showCheckbox?: boolean;
  showTags?: boolean;
  visibleTags?: Set<string>;
  readingQueue?: any[];
  isDeletingNewsletter?: boolean;
}

// Default handlers for optional props
const defaultPromise = async () => {};
const defaultVoid = () => {};
const defaultTagClick = (_tag: Tag, _e: React.MouseEvent) => {};
const defaultToggleTagVisibility = (_id: string, _e: React.MouseEvent) => {};
const defaultRemoveFromQueue = (_e: React.MouseEvent, _id: string) => {};

export const SortableNewsletterRow: React.FC<NewsletterRowProps & { id: string; isDraggable?: boolean }> = ({
  id,
  isDraggable = true,
  newsletter,
  isSelected = false,
  onToggleSelect = defaultPromise,
  onToggleRead = defaultPromise,
  onToggleLike = defaultPromise,
  onToggleArchive = defaultPromise,
  onTrash = defaultVoid,
  onToggleQueue = defaultPromise,
  onUpdateTags = defaultPromise,
  onTagClick = defaultTagClick,
  onToggleTagVisibility = defaultToggleTagVisibility,
  onRemoveFromQueue = defaultRemoveFromQueue,
  onNewsletterClick = defaultVoid,
  isInReadingQueue = false,
  className = '',
  showCheckbox = false,
  showTags = true,
  visibleTags = new Set<string>(),
  readingQueue = [],
  isDeletingNewsletter = false,
  ...props
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
    zIndex: isDragging ? 1 : 'auto',
  };

  // Convert the ID-based onToggleLike to the expected NewsletterWithRelations-based function
  const handleToggleLike = useCallback(async (newsletterItem: NewsletterWithRelations) => {
    try {
      if (onToggleLike) {
        await onToggleLike(newsletterItem.id);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [onToggleLike]);

  // Handle the queue toggle with proper typing
  const handleToggleQueue = useCallback(async (newsletterId: string) => {
    try {
      await onToggleQueue(newsletterId);
    } catch (error) {
      console.error('Error toggling queue status:', error);
    }
  }, [onToggleQueue]);

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`relative ${className}`}
      {...props}
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
            newsletter={newsletter}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onToggleRead={onToggleRead}
            onToggleLike={handleToggleLike}
            onToggleArchive={onToggleArchive}
            onTrash={onTrash}
            onToggleQueue={handleToggleQueue}
            onUpdateTags={onUpdateTags}
            onTagClick={onTagClick}
            onToggleTagVisibility={onToggleTagVisibility}
            onRemoveFromQueue={onRemoveFromQueue}
            onNewsletterClick={onNewsletterClick}
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
