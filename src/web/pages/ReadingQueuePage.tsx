import React, { useCallback, useMemo, useState } from 'react';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useNavigate } from 'react-router-dom';
import { ReadingQueueItem } from '@common/types';
import { toast } from 'react-hot-toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableNewsletterRow } from '../components/reading-queue/SortableNewsletterRow';
import { useNewsletters } from '@common/hooks/useNewsletters';
import { ArrowUp, ArrowDown } from 'lucide-react';

const ReadingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    readingQueue = [], 
    isLoading, 
    error, 
    refetch,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    toggleRead,
    toggleArchive,
  } = useReadingQueue();
  const { toggleLike: toggleNewsletterLike } = useNewsletters();
  
  // Check if a newsletter is in the reading queue
  const isInQueue = useCallback((newsletterId: string) => {
    return readingQueue.some(item => item.newsletter_id === newsletterId);
  }, [readingQueue]);
  
  // Toggle a newsletter in/out of the reading queue
  const toggleInQueue = useCallback(async (newsletterId: string) => {
    const currentlyInQueue = isInQueue(newsletterId);
    
    try {
      if (currentlyInQueue) {
        // Find the queue item to remove
        const queueItem = readingQueue.find(item => item.newsletter_id === newsletterId);
        if (queueItem) {
          await removeFromQueue(queueItem.id);
          toast.success('Removed from reading queue');
        }
      } else {
        await addToQueue(newsletterId);
        toast.success('Added to reading queue');
      }
    } catch (error) {
      console.error('Error toggling reading queue status:', error);
      toast.error('Failed to update reading queue');
    }
  }, [readingQueue, isInQueue, addToQueue, removeFromQueue]);

  const [sortByDate, setSortByDate] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter out any null items from the queue
  const validQueueItems = useMemo(() => 
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

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = validQueueItems.findIndex(item => item.id === active.id);
      const newIndex = validQueueItems.findIndex(item => item.id === over?.id);
      
      if (oldIndex === -1 || newIndex === -1) return;
      
      // Reorder the items
      const reorderedItems = [...validQueueItems];
      const [movedItem] = reorderedItems.splice(oldIndex, 1);
      reorderedItems.splice(newIndex, 0, movedItem!);
      
      // Update positions in the database
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        position: index,
      }));
      
      try {
        await reorderQueue(updates);
        // The query will automatically refetch due to the invalidation in the mutation
      } catch (error) {
        console.error('Failed to update queue order:', error);
        toast.error('Failed to update queue order');
      }
    }
  }, [validQueueItems, reorderQueue]);

  // Handle toggling read status
  const handleToggleRead = useCallback(async (newsletterId: string) => {
    try {
      const item = validQueueItems.find(item => item.newsletter.id === newsletterId);
      if (!item) return;
      
      await toggleRead({ 
        newsletterId, 
        isRead: !item.newsletter.is_read 
      });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle read status:', error);
      toast.error('Failed to update read status');
    }
  }, [toggleRead, refetch, validQueueItems]);

  // Handle toggling like status
  const handleToggleLike = useCallback(async (newsletter: any) => {
    try {
      // Handle both signatures: (id: string) and (newsletter: Newsletter)
      const newsletterId = typeof newsletter === 'string' ? newsletter : newsletter.id;
      const isLiked = typeof newsletter === 'string' ? false : newsletter.is_liked;
      
      await toggleNewsletterLike(newsletterId, !isLiked);
      await refetch();
      toast.success(!isLiked ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      toast.error('Failed to update favorite status');
    }
  }, [toggleNewsletterLike, refetch]);

  // Handle toggling archive status
  const handleToggleArchive = useCallback(async (id: string) => {
    try {
      const item = validQueueItems.find(item => item.newsletter.id === id);
      if (!item) return;
      
      await toggleArchive({ 
        newsletterId: id, 
        isArchived: !item.newsletter.is_archived 
      });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
      toast.error('Failed to update archive status');
    }
  }, [validQueueItems, toggleArchive, refetch]);

  // Toggle sort mode between manual and date
  const toggleSortMode = useCallback(() => {
    setSortByDate(prev => !prev);
  }, []);

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Sort items based on sort mode
  const sortedItems = useMemo(() => {
    const items = [...validQueueItems];
    
    return items.sort((a, b) => {
      if (!sortByDate) {
        // In manual sort mode, sort by position
        return a.position - b.position;
      } else {
        // In date sort mode, sort by received date
        const dateA = new Date(a.newsletter.received_at);
        const dateB = new Date(b.newsletter.received_at);
        return sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }
    });
  }, [validQueueItems, sortByDate, sortDirection]);

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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Handle empty queue
  if (validQueueItems.length === 0) {
    return (
      <div className="text-center py-12">
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
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No newsletters in queue</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding some newsletters to your reading queue.</p>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleBrowseNewsletters}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
        <h1 className="text-2xl font-bold">Reading Queue</h1>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {validQueueItems.length} {validQueueItems.length === 1 ? 'item' : 'items'}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleSortMode}
              className={`px-3 py-1 text-sm rounded-md ${
                sortByDate 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {sortByDate ? 'Sort by Position' : 'Sort by Date'}
            </button>
            {sortByDate && (
              <button
                onClick={toggleSortDirection}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                title={sortDirection === 'asc' ? 'Oldest first' : 'Newest first'}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={sortedItems.map(item => item.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sortedItems.map((item) => (
              <SortableNewsletterRow
                key={item.id}
                id={item.id}
                newsletter={item.newsletter}
                onToggleRead={handleToggleRead}
                onToggleLike={handleToggleLike}
                onToggleArchive={handleToggleArchive}
                onToggleQueue={toggleInQueue}
                onTrash={() => {}}
                onUpdateTags={async (newsletterId, tagIds) => {
                  try {
                    // Implement tag update logic here if needed
                    console.log('Updating tags for newsletter:', newsletterId, tagIds);
                  } catch (error) {
                    console.error('Error updating tags:', error);
                    toast.error('Failed to update tags');
                  }
                }}
                onTagClick={(tag, e) => {
                  e.stopPropagation();
                  // Handle tag click (e.g., filter by tag)
                  console.log('Tag clicked:', tag);
                }}
                onToggleTagVisibility={(id, e) => {
                  e.stopPropagation();
                  setVisibleTags(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(id)) {
                      newSet.delete(id);
                    } else {
                      newSet.add(id);
                    }
                    return newSet;
                  });
                }}
                onRemoveFromQueue={async (e, id) => {
                  e.stopPropagation();
                  await toggleInQueue(id);
                  await refetch();
                }}
                onNewsletterClick={(newsletter) => {
                  navigate(`/newsletters/${newsletter.id}`);
                }}
                className={`${!sortByDate ? 'cursor-grab active:cursor-grabbing' : ''} bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow`}
                isDraggable={!sortByDate}
                showCheckbox={false}
                showTags={true}
                visibleTags={visibleTags}
                readingQueue={readingQueue}
                isDeletingNewsletter={false}
                isInReadingQueue={true}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ReadingQueuePage;