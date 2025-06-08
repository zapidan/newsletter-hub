import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Heart, Bookmark as BookmarkIcon, Archive, ArchiveX } from 'lucide-react';
import { useNewsletters } from '../hooks/useNewsletters';
import { useTags } from '../hooks/useTags';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/common/LoadingScreen';
import TagSelector from '../components/TagSelector';
import type { Newsletter, Tag } from '../types';
import { supabase } from '../services/supabaseClient';

const NewsletterDetail = () => {
  const [tagSelectorKey, setTagSelectorKey] = useState(0);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromReadingQueue = location.state?.from === '/reading-queue' || location.pathname.includes('reading-queue');
  const { updateNewsletterTags } = useTags();
  const { 
    markAsRead, 
    markAsUnread,
    toggleLike, 
    archiveNewsletter, 
    unarchiveNewsletter, 
    deleteNewsletter,
    isDeletingNewsletter,
    isMarkingAsRead,
    isMarkingAsUnread
  } = useNewsletters();
  const { toggleInQueue, readingQueue } = useReadingQueue();
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isTogglingReadStatus, setIsTogglingReadStatus] = useState(false);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
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

  // Memoize isInQueue calculation
  const isInQueue = useMemo(() => {
    if (!newsletter?.id || !readingQueue) return false;
    return readingQueue.some(item => item.newsletter_id === newsletter.id);
  }, [newsletter?.id, readingQueue]);
  
  // Fetch newsletter data
  const fetchNewsletter = useCallback(async (newsletterId: string): Promise<Newsletter | null> => {
    if (!newsletterId || !user?.id) return null;
    
    try {
      // First fetch the newsletter row (no join)
      const { data: newsletterData, error: newsletterError } = await supabase
        .from('newsletters')
        .select('*')
        .eq('id', newsletterId)
        .eq('user_id', user.id)
        .single();
      
      if (newsletterError) throw newsletterError;
      if (!newsletterData) return null;
      
      // Fetch the source if newsletter_source_id exists
      let source = null;
      if (newsletterData.newsletter_source_id) {
        const { data: sourceData, error: sourceError } = await supabase
          .from('newsletter_sources')
          .select('*')
          .eq('id', newsletterData.newsletter_source_id)
          .single();
        if (sourceError) {
          console.error('Error fetching source:', sourceError);
        } else {
          source = sourceData;
        }
      }
      
      // Then fetch the tags for this newsletter
      const { data: tagsData, error: tagsError } = await supabase
        .from('newsletter_tags')
        .select(`
          tag:tags (
            id,
            name,
            color
          )
        `)
        .eq('newsletter_id', newsletterId);
      
      if (tagsError) throw tagsError;
      
      // Combine the data
      const data = {
        ...newsletterData,
        newsletter_tags: tagsData || []
      };
      
      // Transform the data to match the Newsletter type
      const transformedData: Newsletter = {
        id: data.id,
        user_id: data.user_id,
        source,
        received_at: data.received_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        is_read: data.is_read || false,
        content: data.content || '',
        summary: data.summary || null,
        title: data.title || '',
        image_url: data.image_url || '',
        is_archived: data.is_archived ?? false,
        word_count: data.word_count || 0,
        estimated_read_time: data.estimated_read_time || 1,
        tags: (data.newsletter_tags || []).map((nt: any) => ({
          id: nt.tag.id,
          name: nt.tag.name,
          color: nt.tag.color,
          user_id: user?.id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        is_liked: data.is_liked ?? false
      };
      
      return transformedData;
    } catch (err) {
      console.error('Failed to load newsletter. Please try again.');
      return null;
    }
  }, [user?.id]);

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

  const handleArchiveToggle = useCallback(async () => {
    if (!newsletter?.id || isArchiving) return;
    
    setIsArchiving(true);
    try {
      if (newsletter.is_archived) {
        await unarchiveNewsletter(newsletter.id);
      } else {
        await archiveNewsletter(newsletter.id);
      }
      // Update local state to reflect the change
      setNewsletter(prev => prev ? { 
        ...prev, 
        is_archived: !prev.is_archived 
      } : null);
    } catch (error) {
      console.error('Error toggling archive status:', error);
    } finally {
      setIsArchiving(false);
    }
  }, [newsletter, isArchiving, archiveNewsletter, unarchiveNewsletter]);

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
    if (!newsletter?.id || isBookmarking) return;
    
    setIsBookmarking(true);
    try {
      await toggleInQueue(newsletter.id);
      setNewsletter(prev => prev ? { ...prev, is_bookmarked: !isInQueue } : null);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsBookmarking(false);
    }
  }, [newsletter, isBookmarking, isInQueue, toggleInQueue]);

  const loadData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await fetchNewsletter(id);
      
      if (data) {
        setNewsletter(data);
        
        // Mark as read if not already read
        if (!data.is_read) {
          await markAsRead(id);
        }
        
        // Auto-archive if not already archived
        if (!data.is_archived) {
          await archiveNewsletter(id);
          setNewsletter(prev => prev ? { ...prev, is_archived: true } : null);
        }
      } else {
        setError('Newsletter not found');
      }
    } catch (err) {
      console.error('Failed to load newsletter or update status:', err);
    } finally {
      setLoading(false);
    }
  }, [id, fetchNewsletter, markAsRead, archiveNewsletter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="max-w-6xl w-full mx-auto px-4 py-8">
        <button
          onClick={() => navigate(isFromReadingQueue ? '/reading-queue' : '/inbox')}
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

  return (
    <div className="max-w-6xl w-full mx-auto px-4 py-8">
      <button
        onClick={() => navigate(isFromReadingQueue ? '/reading-queue' : '/inbox')}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {isFromReadingQueue ? 'Back to Reading Queue' : 'Back to Inbox'}
      </button>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
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
                        const updated = await fetchNewsletter(id);
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
                        const updated = await fetchNewsletter(id);
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
                    className="h-4 w-4"
                    fill={newsletter?.is_liked ? '#ef4444' : 'none'}
                    stroke={newsletter?.is_liked ? '#ef4444' : 'currentColor'}
                  />
                </button>
                
                <button
                  onClick={handleToggleBookmark}
                  disabled={isBookmarking}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isInQueue
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isInQueue ? (
                    <BookmarkIcon className="h-4 w-4 fill-yellow-500 text-yellow-500" fill="currentColor" />
                  ) : (
                    <BookmarkIcon className="h-4 w-4" />
                  )}
                  <span>{isInQueue ? 'Saved' : 'Save for later'}</span>
                </button>
                
                <button
                  onClick={handleArchiveToggle}
                  disabled={isArchiving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    newsletter?.is_archived
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {newsletter?.is_archived ? (
                    <ArchiveX className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  <span>{newsletter?.is_archived ? 'Unarchive' : 'Archive'}</span>
                </button>
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
};

export default NewsletterDetail;
