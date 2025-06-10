import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
// Types are used in other parts of the file
import { ArrowLeft, Bookmark as BookmarkIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableNewsletterRow } from '../components/reading-queue/SortableNewsletterRow';

const ReadingQueuePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sortByDate, setSortByDate] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { 
    readingQueue = [], 
    isLoading, 
    error, 
    refetch,
    toggleRead,
    toggleLike,
    toggleArchive,
    reorderQueue,
  } = useReadingQueue();

  // Initialize sensors for drag and drop
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
  
  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = readingQueue.findIndex((item) => item.id === active.id);
      const newIndex = readingQueue.findIndex((item) => item.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return;
      
      // Create a new array with the updated order
      const updatedItems = [...readingQueue];
      const [movedItem] = updatedItems.splice(oldIndex, 1);
      updatedItems.splice(newIndex, 0, movedItem);
      
      // Update positions
      const updates = updatedItems.map((item, index) => ({
        id: item.id,
        position: index,
      }));
      
      try {
        await reorderQueue(updates);
      } catch (error) {
        console.error('Error reordering queue:', error);
        // Revert the UI on error
        refetch();
      }
    }
  }, [readingQueue, reorderQueue, refetch]);
  
  // Toggle read status
  const handleToggleRead = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      // Find the newsletter in the reading queue to get the current is_read status
      const queueItem = readingQueue?.find(item => item.newsletter.id === id);
      if (!queueItem) return;
      
      await toggleRead({ 
        newsletterId: id, 
        isRead: !queueItem.newsletter.is_read 
      });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle read status:', error);
    }
  }, [toggleRead, refetch, readingQueue]);
  
  // Toggle like status
  const handleToggleLike = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      // Find the newsletter in the reading queue to get the current is_liked status
      const queueItem = readingQueue?.find(item => item.newsletter.id === id);
      if (!queueItem) return;
      
      await toggleLike({ 
        newsletterId: id, 
        isLiked: !queueItem.newsletter.is_liked 
      });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle like status:', error);
    }
  }, [toggleLike, refetch, readingQueue]);
  
  // Toggle archive status
  const handleToggleArchive = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      // Find the newsletter in the reading queue to get the current is_archived status
      const queueItem = readingQueue?.find(item => item.newsletter.id === id);
      if (!queueItem) return;
      
      await toggleArchive({ 
        newsletterId: id, 
        isArchived: !queueItem.newsletter.is_archived 
      });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
    }
  }, [toggleArchive, refetch, readingQueue]);

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
        return sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }
    });

    return sortableItems;
  }, [readingQueue, sortByDate, sortDirection]);

  // Toggle sort mode between manual and date
  const toggleSortMode = useCallback(() => {
    setSortByDate(prev => !prev);
  }, []);

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading reading queue: {error.message}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Reading Queue</h1>
        <div className="ml-auto flex space-x-2">
          <button
            onClick={toggleSortMode}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            {sortByDate ? 'Sort by Position' : 'Sort by Date'}
          </button>
          {sortByDate && (
            <button
              onClick={toggleSortDirection}
              className="p-1 rounded-full hover:bg-gray-200"
              title={sortDirection === 'asc' ? 'Sort Oldest First' : 'Sort Newest First'}
            >
              {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2">
          <SortableContext
            items={sortedItems.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedItems.map((item) => (
              <SortableNewsletterRow
                key={item.id}
                id={item.id}
                newsletter={item.newsletter}
                onToggleRead={handleToggleRead}
                onToggleLike={handleToggleLike}
                onToggleArchive={handleToggleArchive}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {sortedItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>Your reading queue is empty.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-blue-600 hover:underline"
          >
            Browse newsletters
          </button>
        </div>
      )}
    </div>
  );
};

export default ReadingQueuePage;