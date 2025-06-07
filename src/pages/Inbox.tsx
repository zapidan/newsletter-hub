import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, RefreshCw as RefreshCwIcon, X, Tag as TagIcon, BookmarkIcon, Heart, Archive, ArchiveX, Trash } from 'lucide-react';

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
  const [filter, setFilter] = useState<'all' | 'unread' | 'liked' | 'archived'>(
    (searchParams.get('filter') as 'all' | 'unread' | 'liked' | 'archived') || 'all'
  );
  const showArchived = filter === 'archived';
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
    bulkArchive,
    bulkUnarchive,
    toggleLike,
    refetchNewsletters,
    archiveNewsletter,
    unarchiveNewsletter,
    deleteNewsletter,
    isDeletingNewsletter,
    bulkDeleteNewsletters,
  } = useNewsletters(tagId || undefined, filter);
  
  // Trash (permanent delete) handlers
  const handleTrash = useCallback(async (newsletterId: string) => {
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    try {
      await deleteNewsletter(newsletterId);
      await refetchNewsletters();
    } catch (error) {
      console.error('Error deleting newsletter:', error);
    }
  }, [deleteNewsletter, refetchNewsletters]);

  const handleBulkTrash = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    try {
      await bulkDeleteNewsletters(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelecting(false);
      await refetchNewsletters();
    } catch (error) {
      console.error('Error deleting newsletters:', error);
    }
  }, [bulkDeleteNewsletters, selectedIds, refetchNewsletters]);

  // Handle toggle like
  const handleToggleLike = useCallback(async (newsletterId: string) => {
    try {
      await toggleLike(newsletterId);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [toggleLike]);

  // Get tags from URL
  const selectedTagIds = useMemo(() => {
    return tagId ? tagId.split(',') : [];
  }, [tagId]);

  const allTags = useMemo(() => {
    if (!newsletters) return new Map<string, Tag>();
    // Get all unique tags from all newsletters
    const tags = new Map<string, Tag>();
    newsletters.forEach(newsletter => {
      (newsletter.tags || []).forEach((tag: Tag) => {
        if (tag?.id && !tags.has(tag.id)) {
          tags.set(tag.id, tag);
        }
      });
    });
    return tags;
  }, [newsletters]);

  // Get selected tag objects
  const selectedTags = useMemo(() => {
    return selectedTagIds
      .map(id => allTags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }, [selectedTagIds, allTags]);

  // Handle tag click - toggle tag in filter
  const handleTagClick = useCallback((tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchParams(prev => {
      const currentTags = new Set(prev.get('tag')?.split(',').filter(Boolean) || []);
      
      if (currentTags.has(tag.id)) {
        currentTags.delete(tag.id);
      } else {
        currentTags.add(tag.id);
      }
      
      const newParams = new URLSearchParams(prev);
      if (currentTags.size > 0) {
        newParams.set('tag', Array.from(currentTags).join(','));
      } else {
        newParams.delete('tag');
      }
      
      return newParams;
    });
  }, [setSearchParams]);

  // Clear all tag filters
  const clearTagFilter = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('tag');
      return newParams;
    });
  }, [setSearchParams]);
  
  // Remove a specific tag from filters
  const removeTagFromFilter = useCallback((tagId: string) => {
    setSearchParams(prev => {
      const currentTags = new Set(prev.get('tag')?.split(',').filter(Boolean) || []);
      currentTags.delete(tagId);
      
      const newParams = new URLSearchParams(prev);
      if (currentTags.size > 0) {
        newParams.set('tag', Array.from(currentTags).join(','));
      } else {
        newParams.delete('tag');
      }
      
      return newParams;
    });
  }, [setSearchParams]);

  // Handle bulk archive
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkActionLoading(true);
    try {
      await bulkArchive(Array.from(selectedIds));
      setToast({ type: 'success', message: 'Newsletters archived.' });
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to archive newsletters.' });
      console.error('Error archiving:', error);
    } finally {
      setSelectedIds(new Set());
      setIsSelecting(false);
      setIsBulkActionLoading(false);
      await refetchNewsletters();
    }
  }, [selectedIds, bulkArchive, refetchNewsletters]);

  // Handle bulk unarchive
  const handleBulkUnarchive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkActionLoading(true);
    try {
      await bulkUnarchive(Array.from(selectedIds));
      setToast({ type: 'success', message: 'Newsletters unarchived.' });
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to unarchive newsletters.' });
      console.error('Error unarchiving:', error);
    } finally {
      setSelectedIds(new Set());
      setIsSelecting(false);
      setIsBulkActionLoading(false);
      await refetchNewsletters();
    }
  }, [selectedIds, bulkUnarchive, refetchNewsletters]);

  // Filter newsletters based on tag (archived/non-archived already filtered by hook)
  const filteredNewsletters = useMemo(() => {
    if (!newsletters) return [];
    
    let result = [...newsletters];
    
    // Apply main filter
    if (filter === 'unread') {
      result = result.filter(n => !n.is_read);
    } else if (filter === 'liked') {
      result = result.filter(n => n.is_liked);
    }
    
    // Apply tag filter
    if (selectedTagIds.length > 0) {
      result = result.filter(newsletter => 
        selectedTagIds.every(tagId => 
          (newsletter.tags || []).some((tag: Tag) => tag?.id === tagId)
        )
      );
    }
    
    return result.sort((a, b) => {
      const dateDiff = new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });
  }, [newsletters, filter, selectedTagIds]);

  // Toggle selection of a single newsletter
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      if (newSet.size === 0) {
        setIsSelecting(false);
      }
      return newSet;
    });
  }, []);

  // Toggle select all visible newsletters
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredNewsletters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNewsletters.map(n => n.id)));
    }
  }, [filteredNewsletters, selectedIds.size]);
  
  // Select all read or unread newsletters
  const selectRead = useCallback(() => {
    const readIds = filteredNewsletters
      .filter(n => n.is_read)
      .map(n => n.id);
    setSelectedIds(new Set(readIds));
  }, [filteredNewsletters]);
  
  const selectUnread = useCallback(() => {
    const unreadIds = filteredNewsletters
      .filter(n => !n.is_read)
      .map(n => n.id);
    setSelectedIds(new Set(unreadIds));
  }, [filteredNewsletters]);

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
            onClick={() => refetchNewsletters()}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If newsletters is null or undefined after loading and no error, show empty state or handle
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
              <button
                onClick={() => setFilter('archived')}
                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  filter === 'archived'
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Archive className="h-4 w-4" />
                  <span>Archived</span>
                </div>
              </button>
            </div>
            
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
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                Select
              </button>
            )}
          </div>
        </div>
        {isSelecting && (
          <div className="flex items-center justify-between w-full bg-blue-50 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
                >
                  {selectedIds.size === filteredNewsletters.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selectRead}
                  className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
                >
                  Select Read
                </button>
                <button
                  onClick={selectUnread}
                  className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
                >
                  Select Unread
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              {showArchived ? (
                <>
                  <button 
                    onClick={handleBulkUnarchive}
                    disabled={selectedIds.size === 0 || isBulkActionLoading}
                    className={`px-3 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200 disabled:opacity-50 flex items-center gap-1 ${isBulkActionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {isBulkActionLoading ? (
                      <svg className="animate-spin h-4 w-4 mr-1 text-green-700" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <ArchiveX className="h-4 w-4" />
                    )}
                    <span>Unarchive</span>
                  </button>
                  <button
                    onClick={handleBulkTrash}
                    disabled={selectedIds.size === 0 || isBulkActionLoading}
                    className={`px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 disabled:opacity-50 flex items-center gap-1 ${isBulkActionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title="Delete selected permanently"
                  >
                    <Trash className="h-4 w-4" />
                    <span>Trash</span>
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleBulkArchive}
                  disabled={selectedIds.size === 0 || isBulkActionLoading}
                  className={`px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1 ${isBulkActionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {isBulkActionLoading ? (
                    <svg className="animate-spin h-4 w-4 mr-1 text-amber-700" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  <span>Archive</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected tags filter */}
      {selectedTags.length > 0 && (
        <div className="px-6 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {selectedTags.map(tag => (
              <span 
                key={tag.id}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTagFromFilter(tag.id);
                  }}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  title="Remove tag filter"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={clearTagFilter}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
      
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg text-white text-sm
            ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
      
      {/* Main content */}
      <div className={`${selectedTags.length > 0 ? 'pt-2' : 'pt-6'} px-6 pb-6 overflow-auto`}>
        {filteredNewsletters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <Mail className="mx-auto h-14 w-14 mb-4 text-blue-300" />
            <h2 className="text-xl font-semibold mb-2">
              {filter === 'unread'
                ? 'No unread newsletters'
                : filter === 'liked'
                ? 'No liked newsletters'
                : filter === 'archived'
                ? 'No archived newsletters'
                : 'No newsletters found'}
            </h2>
            <p className="text-base text-neutral-400">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          filteredNewsletters.map((newsletter: Newsletter) => (
            <div
              key={newsletter.id}
              className={`rounded-lg p-4 mb-2 flex items-start cursor-pointer transition-all duration-200 ${
                !newsletter.is_read 
                  ? 'bg-blue-300 border-l-4 border-blue-800 hover:bg-blue-400 shadow-lg shadow-blue-200' 
                  : 'bg-white border border-neutral-200 hover:bg-neutral-50'
              } ${isSelecting && selectedIds.has(newsletter.id) ? 'ring-2 ring-primary-400' : ''}`}
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
                        <div className="text-sm text-gray-500 truncate">
                          {newsletter.source?.name || 'Unknown Source'}
                          {newsletter.source?.domain && (
                            <span className="text-gray-400 ml-2">• {newsletter.source.domain}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
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
                          await toggleInQueue(newsletter.id);
                          await refetchNewsletters();
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
                      {/* Archive/Unarchive button */}
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (newsletter.is_archived) {
                            await unarchiveNewsletter(newsletter.id);
                          } else {
                            await archiveNewsletter(newsletter.id);
                          }
                          await refetchNewsletters();
                        }}
                        title={newsletter.is_archived ? 'Unarchive' : 'Archive'}
                      >
                        {newsletter.is_archived ? (
                          <ArchiveX className="h-4 w-4 text-green-700" />
                        ) : (
                          <Archive className="h-4 w-4 text-amber-700" />
                        )}
                      </button>
                      {/* Trash button for archived newsletters */}
                      {newsletter.is_archived && (
                        <button
                          type="button"
                          className="p-1 rounded-full hover:bg-red-100 transition-colors"
                          onClick={e => {
                            e.stopPropagation();
                            handleTrash(newsletter.id);
                          }}
                          title="Delete permanently"
                          disabled={isDeletingNewsletter}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h16" />
                          </svg>
                        </button>
                      )}
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
                          setVisibleTags(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(newsletter.id);
                            return newSet;
                          });
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
          ))
        )}
      </div>
    </div>
  );
};

export default Inbox;
