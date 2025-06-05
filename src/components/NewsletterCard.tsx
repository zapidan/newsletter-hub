import { Newsletter } from '../types';
import { format } from 'date-fns';
import { Archive, ArchiveX } from 'lucide-react';

interface NewsletterCardProps {
  newsletter: Newsletter;
  showBookmark?: boolean;
  isInQueue?: boolean;
  onToggleQueue?: (newsletterId: string, addToQueue: boolean) => void;
  onToggleArchive?: (newsletterId: string, isArchived: boolean) => void;
  showArchiveButton?: boolean;
}

const NewsletterCard = ({
  newsletter,
  showBookmark = true,
  isInQueue = false,
  onToggleQueue,
  onToggleArchive,
  showArchiveButton = true,
}: NewsletterCardProps) => {
  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleQueue) {
      onToggleQueue(newsletter.id, !isInQueue);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
      {newsletter.image_url && (
        <div className="h-40 bg-gray-200 overflow-hidden">
          <img
            src={newsletter.image_url}
            alt={newsletter.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {newsletter.title}
          </h3>
          <div className="flex items-center gap-2">
            {showArchiveButton && onToggleArchive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchive(newsletter.id, !newsletter.is_archived);
                }}
                className="text-gray-400 hover:text-amber-500 transition-colors"
                title={newsletter.is_archived ? 'Unarchive' : 'Archive'}
              >
                {newsletter.is_archived ? (
                  <ArchiveX className="h-5 w-5" />
                ) : (
                  <Archive className="h-5 w-5" />
                )}
              </button>
            )}
            {showBookmark && (
              <button
                onClick={handleBookmarkClick}
                className="text-gray-400 hover:text-yellow-500 transition-colors"
                title={isInQueue ? 'Remove from queue' : 'Add to queue'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill={isInQueue ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-500 mb-2">
          {newsletter.source ? (
            <>
              <span className="font-medium">{newsletter.source.name}</span>
              {newsletter.source.domain && (
                <span className="text-gray-400 ml-2">• {newsletter.source.domain}</span>
              )}
            </>
          ) : (
            <span>Unknown Source</span>
          )}
        </div>
        
        {newsletter.received_at && (
          <p className="text-xs text-gray-400 mt-auto">
            {format(new Date(newsletter.received_at), 'MMM d, yyyy')}
          </p>
        )}
        
        {newsletter.tags && newsletter.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {newsletter.tags.map((tag) => (
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
    </div>
  );
};

export default NewsletterCard;
