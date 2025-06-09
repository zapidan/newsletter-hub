import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, X } from 'lucide-react';
import { TimeRange } from '@web/components/TimeFilter';
import { InboxFilters } from '@web/components/InboxFilters';
import BulkSelectionActions from '@web/components/BulkSelectionActions';
import { useNewsletters } from '@common/hooks/useNewsletters';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { useNewsletterSources } from '@common/hooks/useNewsletterSources';
import { useTags } from '@common/hooks/useTags';
import type { Newsletter, Tag } from '@common/types';
import LoadingScreen from '@common/components/common/LoadingScreen';
import NewsletterRow from '@web/components/NewsletterRow';

const Inbox: React.FC = () => {
  console.log('=== Inbox component rendering ===');
  
  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const tagId = searchParams.get('tag') || undefined;
  const filter = (searchParams.get('filter') as 'all' | 'unread' | 'liked' | 'archived') || 'all';
  const sourceFilter = searchParams.get('source') || undefined;
  const timeRange = (searchParams.get('time') as TimeRange) || 'all';
  const showArchived = filter === 'archived';
  
  console.log('URL params:', { tagId, filter, sourceFilter, timeRange, showArchived });

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Hooks
  console.log('Fetching tags...');
  const { getTags } = useTags();
  
  console.log('Fetching reading queue...');
  const { readingQueue } = useReadingQueue();
  
  console.log('Fetching newsletter sources...');
  const { newsletterSources = [] } = useNewsletterSources();
  
  console.log('Fetching newsletters with params:', { tagId, filter, sourceFilter });
  const { 
    newsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    markAsRead,
    toggleLike,
    deleteNewsletter,
    isDeletingNewsletter,
    bulkDeleteNewsletters,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    refetchNewsletters,
    bulkArchive,
    bulkUnarchive
  } = useNewsletters(tagId, filter, sourceFilter);
  
  useEffect(() => {
    console.log('Newsletters state updated:', {
      count: newsletters?.length || 0,
      isLoading: isLoadingNewsletters,
      isError: isErrorNewsletters,
      error: errorNewsletters
    });
    
    if (newsletters?.length > 0) {
      console.log('Sample newsletter:', JSON.stringify(newsletters[0], null, 2));
    }
  }, [newsletters, isLoadingNewsletters, isErrorNewsletters, errorNewsletters]);

  // Filter handlers
  const setFilter = useCallback((newFilter: 'all' | 'unread' | 'liked' | 'archived') => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newFilter === 'all') {
        newParams.delete('filter');
      } else {
        newParams.set('filter', newFilter);
      }
      return newParams;
    });
  }, [setSearchParams]);

  const setSourceFilter = useCallback((sourceId: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (sourceId) {
        newParams.set('source', sourceId);
      } else {
        newParams.delete('source');
      }
      return newParams;
    });
  }, [setSearchParams]);

  const setTimeRange = useCallback((range: TimeRange) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (range === 'all') {
        newParams.delete('time');
      } else {
        newParams.set('time', range);
      }
      return newParams;
    });
  }, [setSearchParams]);

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      const tags = await getTags();
      setAllTags(tags);
    };
    loadTags();
  }, [getTags]);

  // Newsletter row handlers
  const handleToggleLike = useCallback(async (newsletter: Newsletter) => {
    if (!toggleLike) return;
    try {
      await toggleLike(newsletter.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      setToast({ type: 'error', message: 'Failed to update like status' });
    }
  }, [toggleLike]);

  const handleToggleArchive = useCallback(async (id: string) => {
    if (!bulkArchive) return;
    try {
      await bulkArchive([id]);
      setToast({ type: 'success', message: 'Newsletter archived' });
    } catch (error) {
      console.error('Error archiving newsletter:', error);
      setToast({ type: 'error', message: 'Failed to archive newsletter' });
    }
  }, [bulkArchive]);

  const handleToggleRead = useCallback(async (id: string) => {
    if (!markAsRead) return;
    try {
      await markAsRead(id);
    } catch (error) {
      console.error('Error marking as read:', error);
      setToast({ type: 'error', message: 'Failed to update read status' });
    }
  }, [markAsRead]);

  const handleToggleQueue = useCallback(async (newsletter: Newsletter) => {
    try {
      // Implement add/remove from reading queue
      console.log('Toggle queue for newsletter:', newsletter.id);
    } catch (error) {
      console.error('Error toggling queue:', error);
      setToast({ type: 'error', message: 'Failed to update reading queue' });
    }
  }, []);

  const handleUpdateTags = useCallback(async (newsletterId: string, tagIds: string[]) => {
    try {
      // Implement tag update
      console.log('Update tags for newsletter:', newsletterId, tagIds);
    } catch (error) {
      console.error('Error updating tags:', error);
      setToast({ type: 'error', message: 'Failed to update tags' });
    }
  }, []);

  const handleTagClick = useCallback((tag: Tag | string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tagId = typeof tag === 'string' ? tag : tag.id;
    // Add tag to filter
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      const tags = newParams.get('tags')?.split(',').filter(Boolean) || [];
      if (!tags.includes(tagId)) {
        tags.push(tagId);
        newParams.set('tags', tags.join(','));
      }
      return newParams;
    });
  }, [setSearchParams]);

  const handleTrash = useCallback(async (id: string) => {
    if (!deleteNewsletter) return;
    if (!window.confirm('Are you sure you want to delete this newsletter?')) return;
    try {
      await deleteNewsletter(id);
      setToast({ type: 'success', message: 'Newsletter deleted' });
      await refetchNewsletters();
    } catch (error) {
      console.error('Error deleting newsletter:', error);
      setToast({ type: 'error', message: 'Failed to delete newsletter' });
      throw error;
    }
  }, [deleteNewsletter, refetchNewsletters]);

  // Toggle tag visibility
  const toggleTagVisibility = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleTags((prev: Set<string>) => {
      const newVisibleTags = new Set(prev);
      if (newVisibleTags.has(id)) {
        newVisibleTags.delete(id);
      } else {
        newVisibleTags.add(id);
      }
      return newVisibleTags;
    });
  }, []);

  // Get selected tag IDs from URL
  const selectedTagIdsFromUrl = useMemo(() => {
    return tagId ? tagId.split(',').filter(Boolean) : [];
  }, [tagId]);
  
  // Update selectedTagIds when URL changes
  useEffect(() => {
    if (selectedTagIdsFromUrl.length > 0 && 
        JSON.stringify(selectedTagIds) !== JSON.stringify(selectedTagIdsFromUrl)) {
      setSelectedTagIds(selectedTagIdsFromUrl);
    }
  }, [selectedTagIdsFromUrl, selectedTagIds]);

  // Get unique tags from all available tags and newsletters
  const allUniqueTags = useMemo(() => {
    const tags = new Map<string, Tag>();
    
    // First add all tags from the tags API
    allTags.forEach(tag => {
      if (tag?.id) {
        tags.set(tag.id, tag);
      }
    });
    
    // Then add any tags from newsletters that might not be in the main tags list
    newsletters.forEach(newsletter => {
      (newsletter.tags || []).forEach((tag: Tag) => {
        if (tag?.id && !tags.has(tag.id)) {
          tags.set(tag.id, tag);
        }
      });
    });
    
    return tags;
  }, [allTags, newsletters]);

  // Get selected tag objects
  const selectedTags = useMemo(() => {
    return Array.from(selectedIds)
      .map((id: string) => allUniqueTags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }, [selectedIds, allUniqueTags]);

  // Clear all tag filters
  const clearTagFilter = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('tags');
      return newParams;
    });
  }, [setSearchParams]);

  // Remove a specific tag from filters
  const removeTagFromFilter = useCallback((tagId: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      const tags = newParams.get('tags')?.split(',').filter(Boolean) || [];
      const updatedTags = tags.filter(id => id !== tagId);
      
      if (updatedTags.length > 0) {
        newParams.set('tags', updatedTags.join(','));
      } else {
        newParams.delete('tags');
      }
      
      return newParams;
    });
  }, [setSearchParams]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Bulk trash handler
  const handleBulkTrash = useCallback(async () => {
    if (!bulkDeleteNewsletters || selectedIds.size === 0) return;
    if (!window.confirm('Are you sure? This action is final and cannot be undone.')) return;
    try {
      await bulkDeleteNewsletters(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelecting(false);
      await refetchNewsletters();
    } catch (error) {
      console.error('Error deleting newsletters:', error);
      throw error;
    }
  }, [bulkDeleteNewsletters, selectedIds, refetchNewsletters]);

  // Handle bulk archive
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

    let filtered = [...newsletters];

    // Apply time filter
    if (timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date(now);
      
      switch (timeRange) {
        case 'day':
          cutoff.setDate(now.getDate() - 1);
          break;
        case '2days':
          cutoff.setDate(now.getDate() - 2);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(newsletter => {
        const receivedDate = new Date(newsletter.received_at);
        return receivedDate >= cutoff;
      });
    }

    // Apply filter
    if (filter === 'unread') {
      filtered = filtered.filter((newsletter) => !newsletter.is_read);
    } else if (filter === 'liked') {
      filtered = filtered.filter((newsletter) => newsletter.is_liked);
    } else if (filter === 'archived') {
      filtered = filtered.filter((newsletter) => newsletter.is_archived);
    } else {
      // Default 'all' shows non-archived items
      filtered = filtered.filter((newsletter) => !newsletter.is_archived);
    }

    // Apply tag filter
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(newsletter => 
        selectedTagIds.every(tagId => 
          (newsletter.tags || []).some((tag: Tag) => tag?.id === tagId)
        )
      );
    }
    
    return filtered.sort((a, b) => {
      const dateDiff = new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });
  }, [newsletters, filter, selectedTagIds, timeRange]);

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

  // Update URL when filter or source changes
  useEffect(() => {
    console.log('Current state:', { filter, sourceFilter, timeRange });
    
    const updateParams = () => {
      const newParams = new URLSearchParams();
      
      // Only set filter if it's not 'all'
      if (filter !== 'all') {
        newParams.set('filter', filter);
      }
      
      // Set source if it exists
      if (sourceFilter) {
        console.log('Setting source param:', sourceFilter);
        newParams.set('source', sourceFilter);
      }
      
      // Set time range if it exists
      if (timeRange !== 'all') {
        newParams.set('time', timeRange);
      }
      
      // Preserve tag if it exists
      const tagParam = searchParams.get('tag');
      if (tagParam) {
        newParams.set('tag', tagParam);
      }
      
      console.log('Updating URL with params:', newParams.toString());
      return newParams;
    };
    
    setSearchParams(updateParams(), { replace: true });
  }, [filter, sourceFilter, timeRange, setSearchParams, searchParams]);

  // Log when searchParams change
  useEffect(() => {
    console.log('Current URL params:', searchParams.toString());
  }, [searchParams]);

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

  // If newsletters is null or undefined after loading and no error, show empty state
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
            <div className="flex items-center gap-2">
              <InboxFilters
                filter={filter}
                sourceFilter={sourceFilter || null}
                timeRange={timeRange}
                newsletterSources={newsletterSources}
                onFilterChange={setFilter}
                onSourceFilterChange={setSourceFilter}
                onTimeRangeChange={setTimeRange}
              />
              {!isSelecting && (
                <button
                  onClick={() => setIsSelecting(true)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  Select
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Dropdown */}
      {isSelecting && (
        <div className="mt-2">
          <BulkSelectionActions
            selectedCount={selectedIds.size}
            totalCount={filteredNewsletters.length}
            showArchived={showArchived}
            isBulkActionLoading={isBulkActionLoading}
            onSelectAll={toggleSelectAll}
            onSelectRead={selectRead}
            onSelectUnread={selectUnread}
            onMarkAsRead={handleBulkMarkAsRead}
            onMarkAsUnread={handleBulkMarkAsUnread}
            onArchive={handleBulkArchive}
            onUnarchive={handleBulkUnarchive}
            onDelete={handleBulkTrash}
            onCancel={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
          />
        </div>
      )}

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
            <NewsletterRow
              key={newsletter.id}
              newsletter={newsletter}
              isSelected={isSelecting && selectedIds.has(newsletter.id)}
              onToggleSelect={isSelecting ? toggleSelect : undefined}
              onToggleLike={handleToggleLike}
              onToggleArchive={handleToggleArchive}
              onToggleRead={handleToggleRead}
              onTrash={handleTrash}
              onToggleQueue={handleToggleQueue}
              onUpdateTags={handleUpdateTags}
              onTagClick={handleTagClick}
              visibleTags={visibleTags}
              readingQueue={readingQueue}
              isDeletingNewsletter={isDeletingNewsletter}
              onToggleTagVisibility={toggleTagVisibility}
              loadingStates={{}}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Inbox;