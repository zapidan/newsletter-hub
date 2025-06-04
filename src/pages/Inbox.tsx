import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, RefreshCw as RefreshCwIcon, X, Tag as TagIcon, BookmarkIcon, Heart } from 'lucide-react';

import { useNewsletters } from '../hooks/useNewsletters';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useTags } from '../hooks/useTags';
import TagSelector from '../components/TagSelector';
import LoadingScreen from '../components/common/LoadingScreen';
import type { Newsletter, Tag } from '../types';

const Inbox: React.FC = () => {
  const { updateNewsletterTags } = useTags();
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const { toggleInQueue, readingQueue } = useReadingQueue();

  const toggleTagVisibility = useCallback((newsletterId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisibleTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(newsletterId)) {
        newSet.delete(newsletterId);
      } else {
        newSet.add(newsletterId);
      }
      return newSet;
    });
  }, []);

  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const tagId = searchParams.get('tag');
  const navigate = useNavigate();
  
  // Local state
  const [filter, setFilter] = useState<'all' | 'unread' | 'liked'>(
    (searchParams.get('filter') as 'all' | 'unread' | 'liked') || 'all'
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch newsletters data
  const { 
    newsletters = [],
    isLoadingNewsletters, 
    isErrorNewsletters,
    errorNewsletters, 
    bulkMarkAsRead,
    bulkMarkAsUnread,
    toggleLike,
    refetchNewsletters,
  } = useNewsletters(tagId || undefined);
  
  // Handle toggle like
  const handleToggleLike = useCallback(async (newsletterId: string) => {
    try {
      await toggleLike(newsletterId);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [toggleLike]);

  // Get tag from URL
  const currentTag = useMemo(() => {
    if (!tagId || !newsletters) return null;
    // Get all unique tags from all newsletters
    const allTags = new Map<string, Tag>();
    newsletters.forEach(newsletter => {
      (newsletter.tags || []).forEach((tag: Tag) => {
        if (tag && tag.id && !allTags.has(tag.id)) {
          allTags.set(tag.id, tag);
        }
      });
    });
    return tagId ? allTags.get(tagId) || null : null;
  }, [tagId, newsletters]);

  // Handle tag click
  const handleTagClick = useCallback((tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchParams({ tag: tag.id });
  }, [setSearchParams]);

  // Clear tag filter
  const clearTagFilter = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // Filter newsletters based on current filter and tag
  const filteredNewsletters = useMemo(() => {
    if (!newsletters) return [];
    
    let result = [...newsletters];
    
    if (filter === 'unread') {
      result = result.filter(n => !n.is_read);
    } else if (filter === 'liked') {
      result = result.filter(n => n.is_liked);
    }
    
    if (currentTag) {
      result = result.filter(newsletter => 
        (newsletter.tags || []).some((tag: Tag) => tag?.id === currentTag.id)
      );
    }
    
    return result.sort((a, b) => 
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
  }, [newsletters, filter, currentTag]);

  // Toggle selection of a single newsletter
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);
  
  // Toggle select all newsletters
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredNewsletters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNewsletters.map(n => n.id)));
    }
  }, [filteredNewsletters, selectedIds.size]);

  // Handle bulk mark as read
  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkMarkAsRead(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [selectedIds, bulkMarkAsRead]);

  const handleBulkMarkAsUnread = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await bulkMarkAsUnread(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, [selectedIds, bulkMarkAsUnread]);

  // Update URL when filter changes
  useEffect(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('filter', filter);
      return newParams;
    }, { replace: true });
  }, [filter, setSearchParams]);

  // Loading and error states for the main newsletter list
  if (isLoadingNewsletters) {
    return <LoadingScreen />;
  }

  if (isErrorNewsletters) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-50 p-4">
        <div className="text-center">
          <Mail className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-semibold text-neutral-800 mb-2">Error Loading Newsletters</h2>
          <p className="text-neutral-600 mb-6">
            {errorNewsletters?.message || 'Something went wrong. Please try again later.'}
          </p>
          <button
            onClick={() => refetchNewsletters()} // Use refetch from the hook
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If newsletters is null or undefined after loading and no error, show empty state or handle
  // This case should ideally be covered by the default [] from useNewsletters or the guard clauses
  if (!newsletters) {
    return (
      <div className="text-center p-8 text-neutral-500">
        No newsletters found, or still initializing.
      </div>
    );
  }

  // Render UI
  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  filter === 'all' 
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  filter === 'unread' 
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('liked')}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  filter === 'liked' 
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                Liked
              </button>
            </div>
            <RefreshCwIcon 
              className="h-5 w-5 text-neutral-500 hover:text-primary-600 cursor-pointer ml-2" 
              onClick={(e) => {
                e.stopPropagation();
                refetchNewsletters();
              }}
            />
            {isSelecting ? (
              <button 
                onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors ml-2"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setIsSelecting(true)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors ml-2"
              >
                Select
              </button>
            )}
          </div>
        </div>
        {isSelecting && (
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-sm text-gray-700">{selectedIds.size} selected</span>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
            >
              {selectedIds.size === filteredNewsletters.length ? 'Deselect All' : 'Select All'}
            </button>
            <button 
              onClick={handleBulkMarkAsRead}
              disabled={selectedIds.size === 0}
              className="px-3 py-1 bg-green-100 text-gray-800 rounded text-sm hover:bg-green-200 disabled:opacity-50"
            >
              Mark as Read
            </button>
            <button 
              onClick={handleBulkMarkAsUnread}
              disabled={selectedIds.size === 0}
              className="px-3 py-1 bg-blue-100 text-gray-800 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
            >
              Mark as Unread
            </button>
          </div>
        )}
      </div>

      {/* Tag filter badge (only if filtering by tag) */}
      {currentTag && (
        <div className="px-6 pt-6">
          <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
            <span 
              className="inline-flex items-center rounded-full text-xs font-medium pr-1"
              style={{ backgroundColor: `${currentTag.color}20`, color: currentTag.color }}
            >
              {currentTag.name}
              <button
                onClick={clearTagFilter}
                className="ml-1 text-gray-400 hover:text-gray-600"
                title="Clear tag filter"
              >
                <X size={14} />
              </button>
            </span>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className={`${currentTag ? 'pt-2' : 'pt-6'} px-6 pb-6 overflow-auto`}>
        {filteredNewsletters.map((newsletter: Newsletter) => (
          <div
            key={newsletter.id}
            className={`bg-white rounded-lg p-4 mb-2 flex items-start cursor-pointer hover:bg-neutral-50 transition-colors border border-neutral-200 ${isSelecting && selectedIds.has(newsletter.id) ? 'ring-2 ring-primary-400' : ''}`}
            onClick={() => navigate(`/inbox/${newsletter.id}`)}
          >
            {isSelecting && (
              <input
                type="checkbox"
                checked={selectedIds.has(newsletter.id)}
                onChange={e => { e.stopPropagation(); toggleSelect(newsletter.id); }}
                className="mr-4 mt-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                onClick={e => e.stopPropagation()}
                title="Select newsletter"
              />
            )}
            <div className="flex-1 min-w-0">
              {/* Newsletter image and title/sender horizontally aligned */}
              <div className="flex items-start gap-3 mb-1">
                <img
                  src={newsletter.image_url || '/newsletter-icon.svg'}
                  alt={newsletter.title}
                  className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0 mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{newsletter.title}</div>
                      <div className="text-sm text-gray-500 truncate">{newsletter.sender}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${newsletter.is_read ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {newsletter.is_read ? 'Read' : 'Unread'}
                      </span>
                      <button
                        type="button"
                        className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${newsletter.is_read ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        onClick={async e => {
                          e.stopPropagation();
                          if (newsletter.is_read) {
                            await bulkMarkAsUnread([newsletter.id]);
                          } else {
                            await bulkMarkAsRead([newsletter.id]);
                          }
                          refetchNewsletters();
                        }}
                        title={newsletter.is_read ? 'Mark as Unread' : 'Mark as Read'}
                      >
                        {newsletter.is_read ? 'Mark as Unread' : 'Mark as Read'}
                      </button>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-1">
                    {/* Like button */}
                    <button
                      type="button"
                      className={`p-1.5 transition-colors ${newsletter.is_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(newsletter.id);
                      }}
                      title={newsletter.is_liked ? 'Unlike' : 'Like'}
                    >
                      <Heart 
                        className="h-4 w-4"
                        fill={newsletter.is_liked ? '#EF4444' : 'none'}
                        stroke={newsletter.is_liked ? '#EF4444' : '#9CA3AF'}
                        strokeWidth={1.5}
                      />
                    </button>
                    {/* Tag visibility toggle */}
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-gray-200"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleTagVisibility(newsletter.id, e);
                      }}
                      title={visibleTags.has(newsletter.id) ? 'Hide tags' : 'Edit tags'}
                    >
                      <TagIcon 
                        size={16} 
                        className={`${visibleTags.has(newsletter.id) ? 'text-primary-600' : 'text-gray-500'} hover:text-primary-600`}
                      />
                    </button>
                    {/* Reading queue button */}
                    <button
                      type="button"
                      className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const isInQueue = readingQueue.some(item => item.newsletter_id === newsletter.id);
                        await toggleInQueue(newsletter.id, isInQueue);
                      }}
                      title={readingQueue.some(item => item.newsletter_id === newsletter.id) ? 'Remove from reading queue' : 'Add to reading queue'}
                    >
                      <BookmarkIcon 
                        className="h-4 w-4"
                        fill={readingQueue.some(item => item.newsletter_id === newsletter.id) ? '#9CA3AF' : 'none'}
                        stroke="#9CA3AF"
                        strokeWidth={1.5}
                      />
                    </button>
                  </div>
                </div>
              </div>
              {/* Newsletter summary, tags, and date below the flex row */}
              <div className="text-sm text-gray-700 mb-2 line-clamp-2">{newsletter.summary}</div>
              {visibleTags.has(newsletter.id) && (
                <div className="w-full mt-2" onClick={e => e.stopPropagation()}>
                  <TagSelector
                    selectedTags={newsletter.tags || []}
                    onTagsChange={async (newTags) => {
                      const ok = await updateNewsletterTags(newsletter.id, newTags);
                      if (ok) {
                        refetchNewsletters();
                      }
                    }}
                    onTagClick={handleTagClick}
                    onTagDeleted={() => {
                      refetchNewsletters();
                    }}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">

                {/* TagSelector for editing tags (always accessible) */}
                {tagEditId === newsletter.id && (
                  <div onClick={e => e.stopPropagation()}>
                    <TagSelector
                      selectedTags={newsletter.tags || []}
                      onTagsChange={async (newTags) => {
                        const ok = await updateNewsletterTags(newsletter.id, newTags);
                        if (ok) {
                          setTagEditId(null);
                          refetchNewsletters();
                        }
                      }}
                      onTagDeleted={() => {
                        // Refresh the list when a tag is deleted
                        refetchNewsletters();
                      }}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {new Date(newsletter.received_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inbox;