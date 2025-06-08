import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, X, Archive } from 'lucide-react';
import { SourceFilterDropdown } from '../components/SourceFilterDropdown';
import BulkSelectionActions from '../components/BulkSelectionActions';

import { useNewsletters } from '../hooks/useNewsletters';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useTags } from '../hooks/useTags';
import { useNewsletterRowHandlers } from '../utils/newsletterRowHandlers';
import type { Newsletter, Tag } from '../types';
import LoadingScreen from '../components/common/LoadingScreen';
import NewsletterRow from '../components/NewsletterRow';

const Inbox: React.FC = () => {
  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const tagId = searchParams.get('tag') || undefined;
  const filter = (searchParams.get('filter') as 'all' | 'unread' | 'liked' | 'archived') || 'all';
  const sourceFilter = searchParams.get('source') || undefined;
  const showArchived = filter === 'archived';

  // Local state
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Hooks
  const queryClient = useQueryClient();
  const { getTags } = useTags();
  const { readingQueue } = useReadingQueue();
  const { newsletterSources = [] } = useNewsletterSources();

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

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

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      const tags = await getTags();
      setAllTags(tags);
    };
    loadTags();
  }, [getTags]);

  // Use the shared newsletter row handlers
  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleToggleQueue,
    handleUpdateTags,
    handleTagClick,
  } = useNewsletterRowHandlers({
    queryClient,
    searchParams,
    setSearchParams,
  });

  // Fetch newsletters data
  const { 
    newsletters = [],
    isLoadingNewsletters, 
    isErrorNewsletters,
    errorNewsletters,
    deleteNewsletter,
    isDeletingNewsletter,
    bulkDeleteNewsletters,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    refetchNewsletters,
    bulkArchive,
    bulkUnarchive
  } = useNewsletters(tagId, filter, sourceFilter);

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
  const selectedTagIds = useMemo(() => {
    return tagId ? tagId.split(',').filter(Boolean) : [];
  }, [tagId]);

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
    return selectedTagIds
      .map(id => allUniqueTags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }, [selectedTagIds, allUniqueTags]);

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
    const currentTags = new Set(searchParams.get('tag')?.split(',').filter(Boolean) || []);
    currentTags.delete(tagId);
    
    const newParams = new URLSearchParams(searchParams);
    if (currentTags.size > 0) {
      newParams.set('tag', Array.from(currentTags).join(','));
    } else {
      newParams.delete('tag');
    }
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Trash (permanent delete) handlers
  const handleTrash = useCallback(async (newsletterId: string) => {
    if (!window.confirm('Are you sure you want to delete this newsletter?')) return;
    try {
      await deleteNewsletter(newsletterId);
      await refetchNewsletters();
    } catch (error) {
      console.error('Error deleting newsletter:', error);
      throw error;
    }
  }, [deleteNewsletter, refetchNewsletters]);

  const handleBulkTrash = useCallback(async () => {
    if (!selectedIds || selectedIds.size === 0) return;
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

  // Update URL when filter or source changes
  useEffect(() => {
    console.log('Current state:', { filter, sourceFilter });
    
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
      
      // Preserve tag if it exists
      const tagParam = searchParams.get('tag');
      if (tagParam) {
        newParams.set('tag', tagParam);
      }
      
      console.log('Updating URL with params:', newParams.toString());
      return newParams;
    };
    
    setSearchParams(updateParams(), { replace: true });
  }, [filter, sourceFilter, setSearchParams, searchParams]);

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
            <div className="flex items-center gap-1">
              {/* All button that shows all newsletters - now always clickable */}
              <button
                onClick={() => {
                  setFilter('all');
                  // Don't clear source filter when clicking All - keep it independent
                }}
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
              {/* Source filter dropdown - separate from All button */}
              <SourceFilterDropdown 
                sources={newsletterSources}
                selectedSourceId={sourceFilter || null}
                onSourceSelect={(sourceId: string | null) => {
                  setSourceFilter(sourceId);
                }}
                className="ml-2"
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
