import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Bookmark as BookmarkIcon } from 'lucide-react';
import { ReadingQueueItem } from '../../hooks/useReadingQueue';
import { format } from 'date-fns';

interface QueueItemProps {
  item: ReadingQueueItem;
  onRemove: (e: React.MouseEvent, newsletterId: string) => void;
  onClick: (newsletter: any) => void;
  isManualSort: boolean;
}

export const QueueItem = ({ item, onRemove, onClick, isManualSort }: QueueItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center p-4 hover:bg-neutral-50 transition-colors"
      onClick={() => onClick(item.newsletter)}
    >
      {isManualSort && (
        <div 
          className="flex-shrink-0 mr-3 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-5 w-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        </div>
      )}
      {!isManualSort && <div className="w-2" />} {/* Spacer when drag handle is hidden */}
      
      <div className="flex-shrink-0 mr-4">
        {item.newsletter.image_url ? (
          <img 
            src={item.newsletter.image_url} 
            alt={item.newsletter.title}
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded bg-neutral-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-neutral-400" />
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-neutral-900 truncate">
          {item.newsletter.title}
        </h3>
        <p className="text-sm text-neutral-500 truncate">
          {item.newsletter.source?.name || 'Unknown Source'}
        </p>
        {item.newsletter.tags && item.newsletter.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.newsletter.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {item.newsletter.received_at && (
          <span className="text-xs text-neutral-400 whitespace-nowrap">
            {format(new Date(item.newsletter.received_at), 'MMM d, yyyy')}
          </span>
        )}
        <button
          onClick={(e) => onRemove(e, item.newsletter.id)}
          className="text-neutral-400 hover:text-yellow-500 transition-colors flex-shrink-0"
          title="Remove from queue"
        >
          <BookmarkIcon className="h-5 w-5" fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default QueueItem;
