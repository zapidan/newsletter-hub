import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTags } from '../hooks/useTags';
import { useNewsletters } from '../hooks/useNewsletters';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import LoadingScreen from '../components/common/LoadingScreen';
import TagSelector from '../components/TagSelector';
import type { Tag, Newsletter } from '../types';
import { BookmarkIcon } from 'lucide-react';

const NewsletterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateNewsletterTags } = useTags();
  const { markAsRead } = useNewsletters();
  const { toggleInQueue, readingQueue } = useReadingQueue();
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(true);
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
  
  // Define fetchNewsletter before it's used in other callbacks
  const fetchNewsletter = useCallback(async (newsletterId: string): Promise<Newsletter | null> => {
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
      const transformedData: Newsletter = {
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
      throw err;
    }
  }, [user?.id]);
  
  // Handle toggling bookmark status
  const handleToggleBookmark = useCallback(async () => {
    if (!id || !newsletter) return;
    
    setIsBookmarking(true);
    try {
      await toggleInQueue(id, readingQueue.some(item => item.newsletter_id === id));
    } catch (err) {
      console.error('Error toggling bookmark status:', err);
      setError('Failed to update bookmark status');
    } finally {
      setIsBookmarking(false);
    }
  }, [id, newsletter, toggleInQueue, readingQueue]);

  // Load newsletter data
  useEffect(() => {
    let isMounted = true;
    let shouldMarkAsRead = false;
    
    const loadData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const newsletterData = await fetchNewsletter(id);
        
        if (!isMounted) return;
        
        if (!newsletterData) {
          setError('Newsletter not found');
          return;
        }
        
        setNewsletter(newsletterData);
        
        // Mark as read if not already read
        if (!newsletterData.is_read) {
          shouldMarkAsRead = true;
          await markAsRead(id);
          if (isMounted) {
            setNewsletter(prev => prev ? { ...prev, is_read: true } : null);
          }
        }
      } catch (err) {
        console.error('Error loading newsletter:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load newsletter');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          initialLoadRef.current = false;
        }
      }
    };
    
    // Only load data on initial mount or when ID changes
    if (initialLoadRef.current) {
      loadData();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
      // Reset initialLoadRef only if we haven't completed the mark as read operation
      if (!shouldMarkAsRead) {
        initialLoadRef.current = true;
      }
    };
  }, [id, fetchNewsletter, markAsRead]);
  
  // Mark as read/unread handler
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (!newsletter) {
    return (
      <div className="p-4">
        <p>Newsletter not found</p>
        <button 
          onClick={() => navigate('/inbox')}
          className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Back to Inbox
        </button>
      </div>
    );
  }
  
  const { title, content, summary } = newsletter;
  const isInQueue = readingQueue.some(item => item.newsletter_id === newsletter.id);
  
  return (
    <div className="max-w-6xl w-full mx-auto px-4 py-8">
      {/* Main content and sidebar layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <button
                type="button"
                onClick={handleToggleBookmark}
                disabled={isBookmarking}
                className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${isInQueue ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
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
                  {/* <h3 className="text-lg font-medium text-blue-800 mb-2">Summary</h3> */}
                  <div 
                    className="prose-lg text-gray-700"
                    style={{ fontStyle: 'italic' }}
                    dangerouslySetInnerHTML={{ 
                      __html: summary.replace(/<h1[^>]*>.*<\/h1>/i, '').trim()
                    }} 
                  />
                </div>
              )}
              
              <div className="prose max-w-none">
                {/* <h3 className="text-lg font-medium text-gray-900 mb-4">Full Content</h3> */}
                {content ? (
                  <div 
                    className="prose-lg text-gray-700"
                    dangerouslySetInnerHTML={{ 
                      __html: content
                        .replace(/<h1[^>]*>.*<\/h1>/i, '')
                        .replace(/<h2[^>]*>.*<\/h2>/i, '')
                    }} 
                  />
                ) : (
                  <p className="text-gray-500 italic">No content available</p>
                )}
              </div>
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
                { id: 1, name: 'Tech News', count: 5 },
                { id: 2, name: 'AI', count: 8 },
                { id: 3, name: 'Product', count: 3 },
                { id: 4, name: 'Industry', count: 6 }
              ].map(topic => (
                <button
                  key={topic.id}
                  onClick={() => navigate(`/inbox?topic=${topic.name.toLowerCase()}`)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {topic.name}
                  <span className="ml-1.5 bg-gray-200 text-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                    {topic.count}
                  </span>
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