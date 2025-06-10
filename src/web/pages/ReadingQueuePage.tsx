import React from 'react';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useNavigate } from 'react-router-dom';
import { ReadingQueueItem } from '@common/types';
import { toast } from 'react-hot-toast';

const ReadingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    readingQueue = [], 
    isLoading, 
    error, 
    refetch,
  } = useReadingQueue();

  // Filter out any null items from the queue
  const validQueueItems = React.useMemo(() => 
    readingQueue.filter((item): item is ReadingQueueItem => item !== null),
    [readingQueue]
  );
  
  const handleBrowseNewsletters = () => {
    navigate('/');
  };

  // Handle error state with toast notifications
  React.useEffect(() => {
    if (error) {
      toast.error(`Error loading reading queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [error]);

  // Show error UI
  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              Failed to load reading queue. Please try again.
            </p>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-gray-500">Loading your reading queue...</p>
      </div>
    );
  }

  // Handle empty queue
  if (validQueueItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">No newsletters in queue</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add newsletters to your reading queue to see them here.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleBrowseNewsletters}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Browse Newsletters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reading Queue</h1>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          {validQueueItems.length} {validQueueItems.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-4">
        {validQueueItems.length > 0 ? (
          validQueueItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900">{item.newsletter.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {item.newsletter.summary || 'No summary available'}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Your reading queue is empty</p>
            <button
              onClick={handleBrowseNewsletters}
              className="mt-2 text-blue-600 hover:underline"
            >
              Browse newsletters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadingQueuePage;