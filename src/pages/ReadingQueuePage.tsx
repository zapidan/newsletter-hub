import { useNavigate } from 'react-router-dom';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { Newsletter } from '../types';
import LoadingScreen from '../components/common/LoadingScreen';
import { Mail, Bookmark as BookmarkIcon, ArrowLeft } from 'lucide-react';

const ReadingQueuePage = () => {
  const { 
    readingQueue, 
    isLoading, 
    error, 
    toggleInQueue
  } = useReadingQueue();
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>Error loading reading queue: {error.message}</p>
      </div>
    );
  }

  const handleNewsletterClick = (newsletter: Newsletter) => {
    navigate(`/inbox/${newsletter.id}`, { state: { from: '/reading-queue' } });
  };

  const handleRemoveFromQueue = async (e: React.MouseEvent, newsletterId: string) => {
    e.stopPropagation();
    await toggleInQueue(newsletterId, true);
  };

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="flex flex-col gap-4 mb-6">
        <div className="inline-flex">
          <button
            onClick={() => navigate('/inbox')}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inbox
          </button>
        </div>
        <h1 className="text-3xl font-bold text-neutral-800">Reading Queue</h1>
      </div>

      {readingQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg shadow-sm border border-neutral-200">
          <BookmarkIcon className="h-12 w-12 text-neutral-400 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">Your reading queue is empty</h2>
          <p className="text-neutral-500 max-w-md text-center">
            Click the bookmark icon on any newsletter to add it to your reading queue.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="divide-y divide-neutral-200">
            {readingQueue.map((item) => (
              <div 
                key={item.newsletter.id}
                className="flex items-center p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => handleNewsletterClick(item.newsletter)}
              >
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
                    {item.newsletter.sender}
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
                
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={(e) => handleRemoveFromQueue(e, item.newsletter.id)}
                    className="text-neutral-400 hover:text-yellow-500 transition-colors"
                    title="Remove from queue"
                  >
                    <BookmarkIcon className="h-5 w-5" fill="currentColor" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingQueuePage;
