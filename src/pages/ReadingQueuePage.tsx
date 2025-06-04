import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { Newsletter } from '../types';
import LoadingScreen from '../components/common/LoadingScreen';
import { ArrowLeft, Bookmark as BookmarkIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { QueueItem } from '../components/reading-queue/QueueItem';

const ReadingQueuePage = () => {
  const { 
    readingQueue, 
    isLoading, 
    error, 
    toggleInQueue,
    reorderQueue
  } = useReadingQueue();
  const navigate = useNavigate();
  const [sortByDate, setSortByDate] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sort items based on sort mode
  const sortedItems = useMemo(() => {
    const sortableItems = [...(readingQueue || [])];

    sortableItems.sort((a, b) => {
      if (!sortByDate) {
        // In manual sort mode, sort by position
        return a.position - b.position;
      } else {
        // In date sort mode, sort by received date
        const dateA = new Date(a.newsletter.received_at);
        const dateB = new Date(b.newsletter.received_at);
        return sortDirection === 'desc' 
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      }
    });

    return sortableItems;
  }, [readingQueue, sortByDate, sortDirection]);

  const toggleSortMode = () => {
    if (sortByDate) {
      // If currently sorting by date, switch back to manual sort
      setSortByDate(false);
    } else {
      // If currently in manual sort, switch to date sort (newest first by default)
      setSortByDate(true);
      setSortDirection('desc');
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Keep local state in sync with sorted items
  const [items, setItems] = useState(sortedItems);
  useEffect(() => {
    setItems(sortedItems);
  }, [sortedItems]);

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

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    console.log('Drag end - active:', active.id, 'over:', over.id);
    
    // Get the current items from state
    setItems((currentItems) => {
      console.log('Current items before reorder:', currentItems.map(i => i.id));
      
      const oldIndex = currentItems.findIndex(item => item.id === active.id);
      const newIndex = currentItems.findIndex(item => item.id === over.id);
      
      console.log('Moving item from index', oldIndex, 'to', newIndex);
      
      if (oldIndex === -1 || newIndex === -1) {
        console.log('Could not find items for reorder');
        return currentItems;
      }
      
      // Create a new array with the item moved to the new position
      const newItems = [...currentItems];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);
      
      // Update the position of each item based on their new index
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        position: index + 1 // 1-based position
      }));
      
      console.log('New items order:', updatedItems.map((item, i) => ({
        id: item.id,
        title: item.newsletter.title,
        oldPosition: item.position,
        newPosition: i + 1
      })));
      
      // Update positions in the database
      const updates = updatedItems.map(item => ({
        id: item.id,
        position: item.position,
        updated_at: new Date().toISOString()
      }));
      
      console.log('Sending updates to database:', updates);
      
      // Update the database in the background
      reorderQueue(updates).catch(error => {
        console.error('Failed to update queue order:', error);
        // Revert the UI if the update fails
        setItems(currentItems);
      });
      
      return updatedItems;
    });
  };

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
        <div className="flex items-center justify-between w-full">
          <h1 className="text-3xl font-bold text-neutral-800">Reading Queue</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSortMode}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md ${
                sortByDate 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {sortByDate ? (
                <span>Sort by Date</span>
              ) : (
                <span>Manual Order</span>
              )}
            </button>
            {sortByDate && (
              <button
                onClick={toggleSortDirection}
                className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-600"
                title={sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
              >
                {sortDirection === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg shadow-sm border border-neutral-200">
          <BookmarkIcon className="h-12 w-12 text-neutral-400 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">Your reading queue is empty</h2>
          <p className="text-neutral-500 max-w-md text-center">
            Click the bookmark icon on any newsletter to add it to your reading queue.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-neutral-200">
                {items.map((item) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveFromQueue}
                    onClick={handleNewsletterClick}
                    isManualSort={!sortByDate}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default ReadingQueuePage;
