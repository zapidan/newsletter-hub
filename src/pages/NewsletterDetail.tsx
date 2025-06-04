import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTags } from '../hooks/useTags';
import { useNewsletters } from '../hooks/useNewsletters';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import LoadingScreen from '../components/common/LoadingScreen';
import TagSelector from '../components/TagSelector';
import type { Tag, Newsletter } from '../types';
import { Bookmark as BookmarkIcon, Heart, ArrowLeft } from 'lucide-react';

interface NewsletterWithTags extends Omit<Newsletter, 'is_liked' | 'is_bookmarked' | 'like_count'> {
  tags?: Tag[];
  is_liked?: boolean;
  is_bookmarked?: boolean;
  like_count?: number;
  newsletter_tags?: Array<{ tag: Tag }>;
}

const NewsletterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromReadingQueue = location.state?.from === '/reading-queue' || location.pathname.includes('reading-queue');
  const { updateNewsletterTags } = useTags();
  const { markAsRead, toggleLike, getNewsletter } = useNewsletters();
  const { toggleInQueue, readingQueue } = useReadingQueue();
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [newsletter, setNewsletter] = useState<NewsletterWithTags | null>(null);
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
  const fetchNewsletter = useCallback(async (newsletterId: string): Promise<NewsletterWithTags | null> => {
    if (!newsletterId || !user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select(`
          *,
          newsletter_tags (
            tag:tags (id, name, color)
          )
        `)
        .eq('id', newsletterId)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      if (!data) return null;

      // Transform the data to match Newsletter type
      const transformedData: NewsletterWithTags = {
        ...data,
        id: data.id,
        user_id: data.user_id,
        subject: data.subject || '',
        sender: data.sender || '',
        received_at: data.received_at || new Date().toISOString(),
        is_read: data.is_read || false,
        content: data.content || '',
        summary: data.summary || null,
        url: data.url || null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        tags: (data.newsletter_tags || []).map((nt: any) => ({
          id: nt.tag.id,
          name: nt.tag.name,
          color: nt.tag.color,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      };
      
      return transformedData;
    } catch (err) {
      console.error('Error fetching newsletter:', err);
      setError('Failed to load newsletter. Please try again.');
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
      console.error('Error toggling like:', err);
      setError('Failed to update like status');
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

  const handleToggleBookmark = useCallback(async () => {
    if (!id || !user?.id) return;
    
    try {
      setIsBookmarking(true);
      const currentStatus = !!newsletter?.is_bookmarked;
      await toggleInQueue(id, currentStatus);
      
      setNewsletter(prev => prev ? {
        ...prev,
        is_bookmarked: !prev.is_bookmarked
      } : null);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      setError('Failed to update bookmark status');
    } finally {
      setIsBookmarking(false);
    }
  }, [id, toggleInQueue, user?.id]);

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
        console.error('Error loading newsletter:', err);
        setError('Failed to load newsletter');
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
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="max-w-6xl w-full mx-auto px-4 py-8">
        <button
          onClick={() => navigate(isFromReadingQueue ? '/reading-queue' : '/inbox')}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFromReadingQueue ? 'Back to Reading Queue' : 'Back to Inbox'}
        </button>
        <p className="text-red-500">Newsletter not found</p>
      </div>
    );
  }

  const { title, summary, content } = newsletter;

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
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleLike}
                  disabled={isLiking}
                  className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-400 hover:text-red-500"
                  title={newsletter?.is_liked ? 'Unlike' : 'Like'}
                >
                  <Heart 
                    className="h-6 w-6"
                    fill={newsletter?.is_liked ? '#EF4444' : 'none'}
                    stroke={newsletter?.is_liked ? '#EF4444' : '#9CA3AF'}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  disabled={isBookmarking}
                  className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${
                    isInQueue ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                  }`}
                  title={isInQueue ? 'Remove from reading queue' : 'Add to reading queue'}
                >
                  <BookmarkIcon 
                    className="h-6 w-6"
                    fill={isInQueue ? '#9CA3AF' : 'none'}
                    stroke="#9CA3AF"
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            </div>

            {/* Tags Section */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="tags-section">
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
                      console.error('Error updating tags:', err);
                      setError('Failed to update tags');
                    }
                  }}
                  onTagDeleted={async () => {
                    if (!id) return;
                    try {
                      const updated = await fetchNewsletter(id);
                      if (updated) setNewsletter(updated);
                    } catch (err) {
                      console.error('Error refreshing after tag delete:', err);
                      setError('Failed to refresh newsletter');
                    }
                  }}
                />
              </div>
            </div>

            {/* Newsletter content */}
            <div className="mt-6 space-y-6">
              {summary && (
                <div className="prose max-w-none">
                  <div 
                    className="prose-lg text-gray-700"
                    style={{ fontStyle: 'italic' }}
                    dangerouslySetInnerHTML={{ 
                      __html: summary.replace(/<h1[^>]*>.*<\/h1>/i, '').trim()
                    }} 
                  />
                </div>
              )}
              
              {content && (
                <div className="prose max-w-none">
                  <div 
                    className="prose-lg text-gray-700"
                    dangerouslySetInnerHTML={{ 
                      __html: content
                        .replace(/<h1[^>]*>.*<\/h1>/i, '')
                        .replace(/<h2[^>]*>.*<\/h2>/i, '')
                    }} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Context & Insights Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Context & Insights</h2>
            <div className="text-gray-600">
              <p className="italic">No insights available for this newsletter. Add insights or context here.</p>
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
