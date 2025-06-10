import React from 'react';
import { ReadingQueueItem } from '@common/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

export interface QueueItemProps {
  item: ReadingQueueItem;
  onRemove: (id: string) => void;
  onClick?: () => void;
  isDraggable?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const QueueItem: React.FC<QueueItemProps> = ({
  item,
  onRemove,
  onClick,
  isDraggable = true,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.newsletter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
    cursor: 'pointer',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 mb-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all"
      onClick={handleClick}
    >
      <div className="flex items-center flex-1 min-w-0">
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="p-1 mr-2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {item.newsletter.title}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {item.newsletter.source?.name || 'Unknown Source'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center ml-2">
        <button
          className="p-1 text-gray-400 hover:text-red-500 focus:outline-none"
          aria-label="Remove from queue"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.newsletter.id);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default QueueItem;
