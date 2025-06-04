import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, RefreshCw as RefreshCwIcon, X, Tag as TagIcon, BookmarkIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNewsletters } from '../hooks/useNewsletters';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useTags } from '../hooks/useTags';
import TagSelector from '../components/TagSelector';
import LoadingScreen from '../components/common/LoadingScreen';
import type { Newsletter, Tag } from '../types';

const Inbox: React.FC = () => {
  const { updateNewsletterTags } = useTags();
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const { toggleInQueue, readingQueue } = useReadingQueue();

  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const tagId = searchParams.get('tag');
  const navigate = useNavigate();
  
  // Local state
  const [filter, setFilter] = useState<'all' | 'unread'>(
    (searchParams.get('filter') as 'all' | 'unread') || 'all'
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
    refetchNewsletters,
  } = useNewsletters(tagId || undefined);

  // Memoized filtered newsletters
  const filteredNewsletters = useMemo(() => {
    if (!newsletters) return [];
    return newsletters.filter((newsletter: Newsletter) => {
      // Apply tag filter if tagId is present
      if (tagId && !newsletter.tags?.some((tag: Tag) => tag.id === tagId)) {
        return false;
      }
      // Apply read/unread filter
      if (filter === 'unread' && newsletter.is_read) {
        return false;
      }
      return true;
    });
  }, [newsletters, filter, tagId]);

  // Get the current tag for the filter badge
  const currentTag = useMemo<Tag | null>(() => {
    if (!tagId || !newsletters) return null;
    for (const n of newsletters) {
      const found = n.tags?.find((t: Tag) => t.id === tagId);
      if (found) return found;
    }
    return null;
  }, [tagId, newsletters]);

  // Handle tag click in newsletter rows
  const handleTagClick = useCallback((tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tag', tagId);
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Clear tag filter
  const clearTagFilter = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('tag');
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
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

  // Bulk actions
  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await bulkMarkAsRead(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelecting(false);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
        <div className="flex items-center space-x-3">
          {isSelecting ? (
            <>
              <button 
                onClick={handleBulkMarkAsRead}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 disabled:opacity-50"
              >
                Mark as Read ({selectedIds.size})
              </button>
              <button 
                onClick={handleBulkMarkAsUnread}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                Mark as Unread ({selectedIds.size})
              </button>
              <button 
                onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
                className="px-3 py-1.5 border border-neutral-300 rounded-md text-sm hover:bg-neutral-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filter === 'all' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filter === 'unread' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
                onClick={() => setFilter('unread')}
              >
                Unread
              </button>
              <button
                onClick={() => setIsSelecting(true)}
                className="text-sm text-primary-600 hover:text-primary-700 px-3 py-1 hover:bg-primary-50 rounded"
              >
                Select
              </button>
              <RefreshCwIcon 
                className="h-5 w-5 text-neutral-500 hover:text-primary-600 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  refetchNewsletters();
                }}
              />
            </div>
          )}
        </div>
      </div>


      
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full">
            {!currentTag && (
              <h2 className="text-2xl font-bold text-neutral-900">Your Inbox</h2>
            )}
            <div className="flex items-center gap-2">
              {isSelecting ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-primary-600 hover:text-primary-700 px-2 py-1 hover:bg-primary-50 rounded"
                  >
                    {selectedIds.size === filteredNewsletters.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-neutral-600 mr-2">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setIsSelecting(false)}
                    className="text-sm text-neutral-600 hover:text-neutral-800 px-2 py-1 hover:bg-neutral-100 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk select and list header */}
      <div className="flex items-center mb-2">
        {isSelecting && (
          <input
            type="checkbox"
            checked={selectedIds.size === filteredNewsletters.length && filteredNewsletters.length > 0}
            onChange={toggleSelectAll}
            className="mr-3 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
        )}
        {!currentTag && <span className="text-sm text-neutral-500">Newsletters</span>}
      </div>
      {/* Tag filter badge (only if filtering by tag) */}
      {currentTag && (
        <div className="mb-4 flex items-center gap-2">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: currentTag.color, color: '#fff' }}
          >
            {currentTag.name}
          </span>
          <button
            type="button"
            className="ml-1 text-xs text-gray-500 hover:text-red-500"
            onClick={clearTagFilter}
            title="Clear tag filter"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Selection and bulk actions toolbar */}
      {isSelecting && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-blue-50 border border-blue-200 rounded shadow-sm">
          <input
            type="checkbox"
            checked={selectedIds.size === filteredNewsletters.length && filteredNewsletters.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            title="Select All"
          />
          <span className="text-sm">{selectedIds.size} selected</span>
          <button
            type="button"
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={handleBulkMarkAsRead}
            disabled={selectedIds.size === 0}
          >
            Mark as Read
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm"
            onClick={handleBulkMarkAsUnread}
            disabled={selectedIds.size === 0}
          >
            Mark as Unread
          </button>
          <button
            type="button"
            className="ml-2 px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm"
            onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
          >
            Cancel Selection
          </button>
        </div>
      )}
      {!isSelecting && (
        <div className="mb-4">
          <button
            type="button"
            className="px-3 py-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 text-sm"
            onClick={() => setIsSelecting(true)}
          >
            Select Newsletters
          </button>
        </div>
      )}
      <div className="space-y-4">
        {filteredNewsletters.map((newsletter: Newsletter) => (
          <motion.div
            key={newsletter.id}
            className={`bg-white shadow rounded-lg p-4 mb-4 flex items-start cursor-pointer hover:bg-gray-50 transition ${isSelecting && selectedIds.has(newsletter.id) ? 'ring-2 ring-primary-400' : ''}`}
            layout
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
              <div className="flex items-center gap-3 mb-1">
                <img
                  src={newsletter.image_url || '/newsletter-icon.svg'}
                  alt={newsletter.title}
                  className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-base truncate">{newsletter.title}</span>
                  <span className="text-sm text-gray-500 truncate">{newsletter.sender}</span>
                </div>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${newsletter.is_read ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{newsletter.is_read ? 'Read' : 'Unread'}</span>
                {/* Individual mark as read/unread button */}
                <button
                  type="button"
                  className={`ml-2 px-2 py-1 rounded text-xs font-medium ${newsletter.is_read ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
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
                {/* Tag edit icon */}
                <button
                  type="button"
                  className="ml-2 p-1 rounded hover:bg-gray-200"
                  onClick={e => { e.stopPropagation(); setTagEditId(newsletter.id); }}
                  title="Edit tags"
                >
                  <TagIcon size={18} className="text-gray-500 hover:text-primary-600" />
                </button>
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
                  className="h-5 w-5"
                  fill={readingQueue.some(item => item.newsletter_id === newsletter.id) ? '#9CA3AF' : 'none'}
                  stroke="#9CA3AF"
                  strokeWidth={1.5}
                />
                </button>
              </div>
              {/* Newsletter summary, tags, and date below the flex row */}
              <div className="text-sm text-gray-700 mb-2 line-clamp-2">{newsletter.summary}</div>
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
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Inbox;