import React, { useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft, Heart, Bookmark as BookmarkIcon, Archive, ArchiveX } from 'lucide-react';
import { useNewsletters } from '@common/hooks/useNewsletters';
import { useTags } from '@common/hooks/useTags';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useAuth } from '@common/contexts/AuthContext';
import LoadingScreen from '@common/components/common/LoadingScreen';
import TagSelector from '@web/components/TagSelector';
import type { Newsletter, NewsletterWithRelations, Tag } from '@common/types';
// toast is used in the component

const NewsletterDetail = memo(() => {
  const [tagSelectorKey, setTagSelectorKey] = useState(0);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Check if we came from the reading queue using multiple indicators
  const isFromReadingQueue = useMemo(() => {
    return (
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue')) ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue'))
    );
  }, [location.state]);
    
  const handleBack = useCallback(() => {
    console.log('Navigation state:', location.state);
    console.log('Document referrer:', document.referrer);
    
    // Check multiple indicators to determine if we came from reading queue
    const fromReadingQueue = 
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue')) ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue'));
    
    console.log('From reading queue:', fromReadingQueue);
    
    // Use window.history to go back first, then navigate if needed
    if (window.history.length > 1) {
      // If we have history, go back
      window.history.back();
      // Then navigate to the correct route if needed (as a fallback)
      setTimeout(() => {
        if (window.location.pathname === '/newsletters/' + id) {
          // If we're still on the same page, force navigation
          navigate(fromReadingQueue ? '/reading-queue' : '/inbox', { replace: true });
        }
      }, 100);
    } else {
      // If no history, navigate directly
      navigate(fromReadingQueue ? '/reading-queue' : '/inbox', { replace: true });
    }
  }, [navigate, location.state, id]);
  const { updateNewsletterTags } = useTags();
  const { 
    markAsRead, 
    markAsUnread,
    toggleLike, 
    toggleArchive,
    isArchiving,
    isUnarchiving,
    deleteNewsletter,
    isDeletingNewsletter,
    isMarkingAsRead,
    isMarkingAsUnread,
    toggleInQueue,
    isTogglingInQueue,
    getNewsletter
  } = useNewsletters(undefined, 'all', undefined, []);
  
  const { user } = useAuth();
  const { readingQueue, refetch: refetchReadingQueue } = useReadingQueue();
  
  const [newsletter, setNewsletter] = useState<NewsletterWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);
  
  // Check if current newsletter is in reading queue
  const isInQueue = useMemo(() => {
    if (!newsletter?.id || !readingQueue) return false;
    return readingQueue.some(item => item.newsletter_id === newsletter.id);
  }, [newsletter?.id, readingQueue]);
  
  // Update local state when reading queue changes
  // Only update is_bookmarked if the queue membership changes, not on every newsletter change
  useEffect(() => {
    setNewsletter(prev => prev ? { ...prev, is_bookmarked: isInQueue } : null);
  }, [isInQueue]);

  // Track the fetch state and mount status
  const isMounted = useRef(true);
  const lastFetchedId = useRef<string | null>(null);
  const isFetching = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch newsletter detail when id or user?.id changes
  useEffect(() => {
    // Skip if no ID or user
    if (!id || !user?.id) {
      setLoading(true);
      return;
    }
    
    // Skip if already fetching this ID
    if (isFetching.current && lastFetchedId.current === id) {
      console.log('Already fetching newsletter:', id);
      return;
    }
    
    // Skip if we already have this newsletter loaded
    if (newsletter?.id === id) {
      console.log('Using cached newsletter:', id);
      setLoading(false);
      return;
    }
    
    console.log('Initializing newsletter fetch for:', id);
    
    // Update state
    lastFetchedId.current = id;
    isFetching.current = true;
    setLoading(true);
    setError(null);
    
    // Create a flag to track if the component is still mounted
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort('Request timed out');
      }
    }, 10000); // 10 second timeout
    
    const fetchData = async () => {
      try {
        const data = await getNewsletter(id);
        
        // Skip if component unmounted or ID changed
        if (!isMounted.current || lastFetchedId.current !== id) {
          console.log('Skipping state update - component unmounted or ID changed');
          return;
        }
        
        console.log('Processing newsletter data for:', data?.id);
        
        if (data?.id === id) {
          setNewsletter(data);
          setError(null);
        } else {
          setError('Newsletter not found');
          setNewsletter(null);
        }
      } catch (err) {
        console.error('Error in newsletter fetch:', err);
        
        // Skip if component unmounted or ID changed
        if (!isMounted.current || lastFetchedId.current !== id) {
          return;
        }
        
        setError(err instanceof Error ? err.message : 'Failed to load newsletter');
        setNewsletter(null);
      } finally {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Only update state if this is still the current fetch
        if (isMounted.current && lastFetchedId.current === id) {
          isFetching.current = false;
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      controller.abort('Component unmounted or ID changed');
      clearTimeout(timeoutId);
    };
  }, [id, user?.id]); // Removed getNewsletter from deps since it's stable now
  
  // Memoize the transformed tags to prevent unnecessary re-renders
  const tagsForUI = useMemo((): Tag[] => {
    if (!newsletter?.tags) return [];
    return (newsletter.tags as any[]).map((t: any) => {
      if ('name' in t && 'color' in t) return t as Tag;
      if ('tag' in t && t.tag) return t.tag as Tag;
      return t as Tag;
    });
  }, [newsletter?.tags]);
  
  // Trash (permanent delete) handler
  const handleTrash = useCallback(async () => {
    if (!newsletter?.id) return;
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    try {
      await deleteNewsletter(newsletter.id);
      navigate('/inbox?filter=archived');
    } catch (error) {
      console.error('Error deleting newsletter:', error);
    }
  }, [newsletter, deleteNewsletter, navigate]);

  const handleToggleLike = useCallback(async () => {
    if (!id || !user?.id || !newsletter) return;
    
    try {
      setIsLiking(true);
      // Optimistically update the UI
      setNewsletter(prev => {
        if (!prev) return null;
        const newLikedState = !prev.is_liked;
        return {
          ...prev,
          is_liked: newLikedState
        };
      });
      
      // Then make the API call
      await toggleLike(id);
    } catch (err) {
      console.error('Failed to update like status');
      // Revert the optimistic update on error
      setNewsletter(prev => prev ? {
        ...prev,
        is_liked: prev.is_liked
      } : null);
    } finally {
      setIsLiking(false);
    }
  }, [id, toggleLike, user?.id, newsletter]);

  const handleArchive = useCallback(async () => {
    if (!newsletter?.id || isArchiving || newsletter.is_archived) return;
    
    try {
      await toggleArchive(newsletter.id, true);
      // Update local state to reflect the change
      setNewsletter(prev => prev ? { 
        ...prev, 
        is_archived: true 
      } : null);
    } catch (error) {
      console.error('Error archiving newsletter:', error);
    }
  }, [newsletter, isArchiving, toggleArchive]);

  const handleToggleReadStatus = useCallback(async () => {
    if (!newsletter?.id || isTogglingReadStatus) return;
    
    setIsTogglingReadStatus(true);
    try {
      if (newsletter.is_read) {
        await markAsUnread(newsletter.id);
      } else {
        await markAsRead(newsletter.id);
      }
      // Update local state to reflect the change
      setNewsletter(prev => prev ? { 
        ...prev, 
        is_read: !prev.is_read 
      } : null);
    } catch (error) {
      console.error('Error toggling read status:', error);
    } finally {
      setIsTogglingReadStatus(false);
    }
  }, [newsletter, isTogglingReadStatus, markAsRead, markAsUnread]);

  const handleToggleBookmark = useCallback(async () => {
    if (!newsletter?.id || isBookmarking || isTogglingInQueue || !toggleInQueue) {
      console.log('Skipping bookmark toggle - condition not met', { 
        hasId: !!newsletter?.id, 
        isBookmarking, 
        isTogglingInQueue, 
        hasToggleFn: !!toggleInQueue 
      });
      return;
    }
    
    console.log('Toggling bookmark for newsletter:', newsletter.id);
    setIsBookmarking(true);
    
    try {
      // Optimistically update the UI
      const newBookmarkState = !newsletter.is_bookmarked;
      setNewsletter(prev => prev ? { ...prev, is_bookmarked: newBookmarkState } : null);
      
      // Toggle in queue
      const result = await toggleInQueue(newsletter.id);
      console.log('Toggle queue result:', result);
      
      // The is_bookmarked state will be updated by the useEffect above
      // when the reading queue updates
      console.log('Successfully toggled bookmark');
      
      // Force a refetch of the reading queue to ensure consistency
      try {
        if (refetchReadingQueue) {
          console.log('Refreshing reading queue...');
          await refetchReadingQueue();
          console.log('Reading queue refreshed');
        }
      } catch (refetchError) {
        console.error('Error refreshing reading queue:', refetchError);
        // Don't fail the entire operation if just the refetch fails
      }
      
      return result;
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // Revert optimistic update on error
      setNewsletter(prev => prev ? { ...prev, is_bookmarked: !prev.is_bookmarked } : null);
      
      // Show error to user
      alert('Failed to update bookmark. Please try again.');
      throw error; // Re-throw to allow error handling by the caller if needed
    } finally {
      setIsBookmarking(false);
    }
  }, [newsletter, isBookmarking, isTogglingInQueue, toggleInQueue, refetchReadingQueue]);

  // Load newsletter data when component mounts or id changes
  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user?.id) return;

      try {
        setLoading(true);
        const data = await getNewsletter(id);
        if (data) {
          setNewsletter(data as unknown as NewsletterWithRelations);
          
          // Only mark as read if not already read and not archived
          if (!data.is_read && !data.is_archived) {
            try {
              await markAsRead(id);
            } catch (err) {
              console.error('Failed to mark as read:', err);
              // Continue even if marking as read fails
            }
          }
        } else {
          setError('Newsletter not found');
        }
      } catch (err) {
        console.error('Failed to load newsletter:', err);
        setError('Failed to load newsletter. Please try again.');
      } finally {
        setLoading(false);
      }
    };

  fetchData();
  // Only depend on id and getNewsletter, not on newsletter state
}, [id, getNewsletter, markAsRead, user?.id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div key={`error-${id}`} className="max-w-6xl w-full mx-auto px-4 py-8">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFromReadingQueue ? 'Back to Reading Queue' : 'Back to Inbox'}
        </button>
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      </div>
    );
  }

  // Add key to force remount when ID changes
  return (
    <div key={`newsletter-${id}`} className="max-w-6xl w-full mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {isFromReadingQueue ? 'Back to Reading Queue' : 'Back to Inbox'}
      </button>
      
      <div className="flex flex-col lg:flex-row gap-6">        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            {/* Tags and Action Buttons Row */}
            <div className="flex items-center justify-between mb-4">
              {/* Tags Section */}
              <div className="flex-1">
                <TagSelector
                  key={tagSelectorKey}
                  selectedTags={tagsForUI}
                  onTagsChange={async (newTags: Tag[]) => {
                    if (!id) return;
                    try {
                      const ok = await updateNewsletterTags(id, newTags);
                      if (ok) {
                        const updated = await getNewsletter(id);
                        if (updated) setNewsletter(updated);
                        setTagSelectorKey((k) => k + 1);
                      }
                    } catch (err) {
                      console.error('Failed to update tags');
                    }
                  }}
                  onTagDeleted={async () => {
                    if (!id) return;
                    try {
                      const ok = await updateNewsletterTags(id, []);
                      if (ok) {
                        const updated = await getNewsletter(id);
                        if (updated) setNewsletter(updated);
                        setTagSelectorKey((k) => k + 1);
                      }
                    } catch (err) {
                      console.error('Failed to delete tag');
                    }
                  }}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={handleToggleReadStatus}
                  disabled={isTogglingReadStatus || isMarkingAsRead || isMarkingAsUnread}
                  className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    newsletter?.is_read
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                  aria-label={newsletter?.is_read ? 'Mark as unread' : 'Mark as read'}
                >
                  {newsletter?.is_read ? (
                    <span>Mark Unread</span>
                  ) : (
                    <span>Mark Read</span>
                  )}
                </button>

                
                <button
                  onClick={handleToggleLike}
                  disabled={isLiking}
                  className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    newsletter?.is_liked
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label={newsletter?.is_liked ? 'Unlike' : 'Like'}
                >
                  <Heart 
                    className={`h-4 w-4 ${newsletter?.is_liked ? 'fill-red-500' : 'fill-none'}`}
                    stroke={newsletter?.is_liked ? 'currentColor' : 'currentColor'}
                  />
                  <span>{newsletter?.is_liked ? 'Liked' : 'Like'}</span>
                </button>
                
                <button
                  onClick={handleToggleBookmark}
                  disabled={isBookmarking}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    newsletter?.is_bookmarked
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label={newsletter?.is_bookmarked ? 'Remove from queue' : 'Add to queue'}
                >
                  <BookmarkIcon 
                    className={`h-4 w-4 ${newsletter?.is_bookmarked ? 'fill-yellow-500' : 'fill-none'}`} 
                    stroke="currentColor" 
                  />
                  <span>{newsletter?.is_bookmarked ? 'Saved' : 'Save for later'}</span>
                </button>
                
                {!newsletter?.is_archived && (
                  <button
                    onClick={handleArchive}
                    disabled={isArchiving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200"
                  >
                    <Archive className="h-4 w-4" />
                    <span>Archive</span>
                  </button>
                )}
                {/* Trash button for archived newsletters */}
                {newsletter?.is_archived && (
                  <button
                    onClick={handleTrash}
                    disabled={isDeletingNewsletter}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h16" />
                    </svg>
                    <span>Delete Permanently</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Newsletter Content */}
          <div className="prose max-w-none mb-6">
            {newsletter?.received_at && (
              <div className="text-sm text-gray-500 mb-6">
                <div>
                  {new Date(newsletter.received_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {newsletter.estimated_read_time > 0 && (
                  <div className="mt-1 text-gray-400">
                    {newsletter.estimated_read_time} min read • {newsletter.word_count.toLocaleString()} words
                  </div>
                )}
              </div>
            )}
            {newsletter?.content && (
              <div dangerouslySetInnerHTML={{ __html: newsletter.content }} />
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-4">Context & Insights</h3>
            <div className="text-sm text-gray-600">
              {newsletter?.summary || 'No summary available'}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">Related Topics</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '1', name: 'Tech News', count: 5 },
                { id: '2', name: 'AI', count: 8 },
                { id: '3', name: 'Product', count: 3 },
                { id: '4', name: 'Industry', count: 6 }
              ].map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => navigate(`/inbox?topic=${topic.name.toLowerCase()}`)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full flex items-center gap-1.5"
                >
                  <span>{topic.name}</span>
                  <span className="text-xs text-gray-500">{topic.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
export default NewsletterDetail;
