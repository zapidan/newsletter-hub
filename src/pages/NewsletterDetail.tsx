import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Heart, Bookmark as BookmarkIcon, Archive, ArchiveX } from 'lucide-react';
import { useNewsletters } from '../hooks/useNewsletters';
import { useTags } from '../hooks/useTags';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useAuth } from '../hooks/useAuth';
import LoadingScreen from '../components/common/LoadingScreen';
import TagSelector from '../components/TagSelector';
import type { Newsletter, Tag } from '../types';
import { supabase } from '../services/supabaseClient';

const NewsletterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromReadingQueue = location.state?.from === '/reading-queue' || location.pathname.includes('reading-queue');
  const { updateNewsletterTags } = useTags();
  const { 
    markAsRead, 
    toggleLike, 
    getNewsletter, 
    archiveNewsletter, 
    unarchiveNewsletter 
  } = useNewsletters();
  const { toggleInQueue, readingQueue } = useReadingQueue();
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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
        is_read: data.is_read || false,
        content: data.content || '',
        summary: data.summary || null,
        title: data.title || '',
        image_url: data.image_url || '',
        is_archived: data.is_archived ?? false,
        tags: (data.newsletter_tags || []).map((nt: any) => ({
          id: nt.tag.id,
          name: nt.tag.name,
          color: nt.tag.color,
          user_id: user?.id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        is_liked: data.is_liked ?? false,
        is_bookmarked: data.is_bookmarked ?? false,
        like_count: data.like_count ?? 0,
        newsletter_tags: data.newsletter_tags || []
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
          is_liked: newLikedState,
          like_count: (prev.like_count || 0) + (newLikedState ? 1 : -1)
        };
      });
      
      // Then make the API call
      await toggleLike(id);
    } catch (err) {
      console.error('Failed to update like status');
      // Revert the optimistic update on error
      setNewsletter(prev => prev ? {
        ...prev,
        is_liked: prev.is_liked,
        like_count: (prev.like_count || 0) + (prev.is_liked ? -1 : 1)
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

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await fetchNewsletter(id);
        
        if (data) {
          setNewsletter(data);
          
          if (!data.is_read) {
            await markAsRead(id);
          }
        } else {
          setError('Newsletter not found');
        }
      } catch (err) {
        console.error('Failed to load newsletter');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, fetchNewsletter, markAsRead]);

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
            {/* Newsletter Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {newsletter?.title || 'Newsletter'}
            </h1>
            
            {/* Newsletter Content */}
            <div className="prose max-w-none mb-6">
              {newsletter?.content && (
                <div dangerouslySetInnerHTML={{ __html: newsletter.content }} />
              )}
            </div>
            
            {/* Tags Section */}
            <div className="mt-4 mb-4">
              <TagSelector
                selectedTags={tagsForUI}
                onTagsChange={async (newTags: Tag[]) => {
                  if (!id) return;
                  try {
                    const ok = await updateNewsletterTags(id, newTags);
                    if (ok) {
                      const updated = await fetchNewsletter(id);
                      if (updated) setNewsletter(updated);
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
                    }
                  } catch (err) {
                    console.error('Failed to delete tag');
                  }
                }}
              />
            </div>
            
            {/* Context & Insights Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Context & Insights</h2>
              <div className="text-gray-600">
                {newsletter?.summary || 'No summary available'}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleToggleLike}
                disabled={isLiking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  newsletter?.is_liked
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {newsletter?.is_liked ? (
                  <Heart className="h-4 w-4 fill-red-600 text-red-600" fill="currentColor" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                <span>{newsletter?.like_count || 0}</span>
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
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
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
