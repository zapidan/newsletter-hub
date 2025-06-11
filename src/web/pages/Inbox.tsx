import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, X } from 'lucide-react';
import { subDays, subWeeks, subMonths } from 'date-fns';
import { InboxFilters } from '@web/components/InboxFilters';
import BulkSelectionActions from '@web/components/BulkSelectionActions';
import { useNewsletters } from '@common/hooks/useNewsletters';
import { useTags } from '@common/hooks/useTags';
import { useNewsletterSources } from '@common/hooks/useNewsletterSources';
import { useReadingQueue } from '@common/hooks/useReadingQueue';
import { toggleTagFilter, handleTagClick } from '@common/utils/tagUtils';
import type { NewsletterWithRelations, Tag } from '@common/types';
import { supabase } from '@common/services/supabaseClient';
import LoadingScreen from '@common/components/common/LoadingScreen';
import NewsletterRow from '@web/components/NewsletterRow';
import { TimeRange } from '@web/components/TimeFilter';
import { useAuth } from '@common/contexts';

const Inbox: React.FC = () => {
  // Router and URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial values from URL
  const urlFilter = searchParams.get('filter') as 'all' | 'unread' | 'liked' | 'archived' | null;
  const urlSource = searchParams.get('source');
  const urlTimeRange = (searchParams.get('time') as TimeRange) || 'all';

  // Filter state
  const [filter, setFilter] = useState<'all' | 'unread' | 'liked' | 'archived'>(urlFilter || 'all');
  const [sourceFilter, setSourceFilter] = useState<string | null>(urlSource);
  const [timeRange, setTimeRange] = useState<TimeRange>(urlTimeRange);

  // Get tag IDs from URL
  const tagIds = useMemo(() => {
    const tagsParam = searchParams.get('tags');
    return tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});
  const [errorTogglingLike, setErrorTogglingLike] = useState<Error | null>(null);
  const [pendingTagUpdates, setPendingTagUpdates] = useState<string[] | null>(null);

  // Hooks
  const { getTags } = useTags();
  const { readingQueue, addToQueue, removeFromQueue } = useReadingQueue();
  const { newsletterSources = [] } = useNewsletterSources();
  const {
    newsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    markAsRead,
    markAsUnread,
    toggleLike,
    deleteNewsletter,
    isDeletingNewsletter,
    bulkDeleteNewsletters,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    refetchNewsletters,
    bulkArchive,
    bulkUnarchive
  } = useNewsletters(tagIds.length > 0 ? tagIds[0] : undefined, filter, sourceFilter);
  const { user } = useAuth();

  // Handle source filter change with proper type
  const handleSourceFilterChange = useCallback((sourceId: string | null) => {
    setSourceFilter(sourceId);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (filter !== 'all') newParams.set('filter', filter);
    if (sourceFilter) newParams.set('source', sourceFilter);
    if (timeRange !== 'all') newParams.set('time', timeRange);
    if (tagIds.length > 0) newParams.set('tags', tagIds.join(','));
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [filter, sourceFilter, timeRange, tagIds, searchParams, setSearchParams]);

  // Handle URL updates when tag filters change
  useEffect(() => {
    if (pendingTagUpdates === null) return;
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (pendingTagUpdates.length > 0) {
        newParams.set('tags', pendingTagUpdates.join(','));
      } else {
        newParams.delete('tags');
      }
      newParams.delete('page');
      return newParams;
    });
  }, [pendingTagUpdates, setSearchParams]);

  const showArchived = filter === 'archived';

  // Handle clicking on a tag
  const handleTagClickWrapper = useCallback((tag: Tag, e: React.MouseEvent) => {
    handleTagClick(tag, pendingTagUpdates, setPendingTagUpdates, e);
  }, [pendingTagUpdates]);

  // Get selected tag IDs, defaulting to an empty array if null
  const selectedTagIds = useMemo(() => pendingTagUpdates || [], [pendingTagUpdates]);

  // Clear all filters (including tags)
  const clearAllFilters = useCallback(() => {
    setFilter('all');
    setTimeRange('all');
    setSourceFilter(null);
    setPendingTagUpdates(null);
    setSearchParams(new URLSearchParams(), { replace: false });
  }, [setSearchParams]);

  // Handle trash action
  const handleTrash = useCallback(async (id: string) => {
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

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      const tags = await getTags();
      setAllTags(tags);
    };
    loadTags();
  }, [getTags]);

  // Newsletter row handlers
  const handleToggleLike = useCallback(async (newsletter: NewsletterWithRelations) => {
    if (!toggleLike) return;
    try {
      await toggleLike(newsletter.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      setToast({ type: 'error', message: 'Failed to update like status' });
    }
  }, [toggleLike]);

  const handleToggleArchive = useCallback(async (id: string) => {
    try {
      const newsletter = newsletters.find(n => n.id === id);
      if (!newsletter) return;
      if (newsletter.is_archived) {
        await bulkUnarchive([id]);
        setToast({ type: 'success', message: 'Newsletter unarchived' });
      } else {
        await bulkArchive([id]);
        setToast({ type: 'success', message: 'Newsletter archived' });
      }
    } catch (error) {
      console.error('Error toggling archive status:', error);
      setToast({ type: 'error', message: 'Failed to update archive status' });
    }
  }, [bulkArchive, bulkUnarchive, newsletters]);

  const handleToggleRead = useCallback(async (id: string) => {
    try {
      const newsletter = newsletters.find(n => n.id === id);
      if (!newsletter) return;
      if (newsletter.is_read) {
        await markAsUnread(id);
      } else {
        await markAsRead(id);
      }
    } catch (error) {
      console.error('Error toggling read status:', error);
      setToast({ type: 'error', message: 'Failed to update read status' });
    }
  }, [markAsRead, markAsUnread, newsletters]);

  const handleToggleQueue = useCallback(async (newsletterId: string) => {
    try {
      const queueItem = readingQueue.find(item => item.newsletter_id === newsletterId);
      if (queueItem) {
        await removeFromQueue(queueItem.id);
      } else {
        await addToQueue(newsletterId);
      }
      await refetchNewsletters();
    } catch (error) {
      console.error('Error toggling queue:', error);
      setToast({ type: 'error', message: 'Failed to update reading queue' });
    }
  }, [readingQueue, addToQueue, removeFromQueue, refetchNewsletters]);

  const handleUpdateTags = useCallback(async (newsletterId: string, tagIds: string[]) => {
    if (!user) {
      setToast({ type: 'error', message: 'You must be logged in to update tags' });
      return;
    }
    try {
      const newsletter = newsletters.find(n => n.id === newsletterId);
      if (!newsletter) {
        setToast({ type: 'error', message: 'Newsletter not found' });
        return;
      }
      const currentTagIds = (newsletter.tags || []).map((tag: Tag) => tag.id);
      const tagsToAdd = tagIds.filter((id: string) => !currentTagIds.includes(id));
      const tagsToRemove = currentTagIds.filter((id: string) => !tagIds.includes(id));
      const addPromises = tagsToAdd.map(async (tagId: string) => {
        const { error } = await supabase
          .from('newsletter_tags')
          .insert([{
            newsletter_id: newsletterId,
            tag_id: tagId,
            user_id: user.id
          }]);
        if (error) throw error;
      });
      const removePromises = tagsToRemove.map(async (tagId: string) => {
        const { error } = await supabase
          .from('newsletter_tags')
          .delete()
          .eq('newsletter_id', newsletterId)
          .eq('tag_id', tagId)
          .eq('user_id', user.id);
        if (error) throw error;
      });
      await Promise.all([...addPromises, ...removePromises]);
      setVisibleTags(prev => {
        const newVisibleTags = new Set(prev);
        newVisibleTags.delete(newsletterId);
        return newVisibleTags;
      });
      await refetchNewsletters();
      setToast({ type: 'success', message: 'Tags updated successfully' });
    } catch (error) {
      console.error('Error updating tags:', error);
      setToast({ type: 'error', message: 'Failed to update tags' });
    }
  }, [user, newsletters, refetchNewsletters]);

  // Toggle tag visibility
  const toggleTagVisibility = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleTags((prev: Set<string>) => {
      const newVisibleTags = new Set(prev);
      if (newVisibleTags.has(id)) {
        newVisibleTags.delete(id);
      } else {
        newVisibleTags.clear();
        newVisibleTags.add(id);
      }
      return newVisibleTags;
    });
  }, []);

  // Handle inbox cleared and refresh events
  useEffect(() => {
    const handleClearFilters = (event?: Event) => {
      event?.preventDefault();
      setFilter('all');
      setTimeRange('all');
      setSourceFilter(null);
      setPendingTagUpdates(null);
      setSearchParams(new URLSearchParams(), { replace: true });
    };

    const handleRefreshNewsletters = (event?: Event) => {
      event?.preventDefault();
      refetchNewsletters();
    };

    window.addEventListener('inbox:clear-filters', handleClearFilters as EventListener);
    window.addEventListener('inbox:refresh-newsletters', handleRefreshNewsletters as EventListener);

    return () => {
      window.removeEventListener('inbox:clear-filters', handleClearFilters as EventListener);
      window.removeEventListener('inbox:refresh-newsletters', handleRefreshNewsletters as EventListener);
    };
  }, [refetchNewsletters, setSearchParams]);

  // Initialize pendingTagUpdates from URL on mount
  useEffect(() => {
    if (tagIds.length > 0) {
      setPendingTagUpdates([...tagIds]);
    }
  }, [tagIds]);

  // Get unique tags from all available tags and newsletters
  const allUniqueTags = useMemo(() => {
    const tags = new Map<string, Tag>();
    allTags.forEach((tag: Tag) => {
      if (tag?.id) {
        tags.set(tag.id, tag);
      }
    });
    newsletters.forEach((newsletter: NewsletterWithRelations) => {
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
      .map((id: string) => allUniqueTags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }, [selectedTagIds, allUniqueTags]);

  // Filter newsletters based on time range, tags, and other filters
  const filteredNewsletters = useMemo(() => {
    if (!newsletters) return [];
    let filtered = [...newsletters];
    if (timeRange && timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case 'day':
          startDate = subDays(now, 1);
          break;
        case '2days':
          startDate = subDays(now, 2);
          break;
        case 'week':
          startDate = subWeeks(now, 1);
          break;
        case 'month':
          startDate = subMonths(now, 1);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter((newsletter: NewsletterWithRelations) => {
        const receivedDate = new Date(newsletter.received_at);
        return receivedDate >= startDate;
      });
    }
    if (filter === 'unread') {
      filtered = filtered.filter((newsletter: NewsletterWithRelations) => !newsletter.is_read);
    } else if (filter === 'liked') {
      filtered = filtered.filter((newsletter: NewsletterWithRelations) => newsletter.is_liked);
    } else if (filter === 'archived') {
      filtered = filtered.filter((newsletter: NewsletterWithRelations) => newsletter.is_archived);
    } else {
      filtered = filtered.filter((newsletter: NewsletterWithRelations) => !newsletter.is_archived);
    }
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((newsletter: NewsletterWithRelations) =>
        selectedTagIds.every((tagId: string) =>
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
    try {
      await bulkMarkAsUnread(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch (error) {
      console.error('Error marking as unread:', error);
      setToast({ type: 'error', message: 'Failed to mark as unread' });
    }
  }, [selectedIds, bulkMarkAsUnread]);

  // Handle newsletter click
  const handleNewsletterClick = useCallback((newsletter: NewsletterWithRelations) => {
    navigate(`/newsletters/${newsletter.id}`);
  }, [navigate]);

  // Handle remove from queue
  const handleRemoveFromQueue = useCallback(async (e: React.MouseEvent, newsletterId: string) => {
    e.stopPropagation();
    try {
      const queueItem = readingQueue.find(item => item.newsletter_id === newsletterId);
      if (queueItem) {
        await removeFromQueue(queueItem.id);
        await refetchNewsletters();
      } else {
        setToast({ type: 'error', message: 'Failed to find item in queue' });
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      setToast({ type: 'error', message: 'Failed to remove from queue' });
    }
  }, [readingQueue, removeFromQueue, refetchNewsletters]);

  if (isLoadingNewsletters) {
    return <LoadingScreen />;
  }

  if (isErrorNewsletters) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
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
      </div>
    );
  }

  if (!newsletters) {
    return (
      <div className="text-center p-8 text-neutral-500">
        No newsletters found, or still initializing.
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-neutral-800">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <InboxFilters
                filter={filter}
                sourceFilter={sourceFilter}
                timeRange={timeRange}
                newsletterSources={newsletterSources}
                onFilterChange={setFilter}
                onSourceFilterChange={handleSourceFilterChange}
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
                    setPendingTagUpdates(toggleTagFilter(tag.id, pendingTagUpdates));
                  }}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  title="Remove tag filter"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg text-white text-sm
            ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

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
          filteredNewsletters.map((newsletter) => {
            const newsletterWithRelations: NewsletterWithRelations = {
              ...newsletter,
              newsletter_source_id: newsletter.newsletter_source_id || null,
              source: newsletter.source || null,
              tags: newsletter.tags || [],
              is_archived: newsletter.is_archived || false
            };
            return (
              <NewsletterRow
                key={newsletter.id}
                newsletter={newsletterWithRelations}
                isSelected={isSelecting && selectedIds.has(newsletter.id)}
                onToggleSelect={toggleSelect}
                onToggleLike={handleToggleLike}
                onToggleArchive={handleToggleArchive}
                onToggleRead={handleToggleRead}
                onTrash={handleTrash}
                onToggleQueue={handleToggleQueue}
                onToggleTagVisibility={toggleTagVisibility}
                onUpdateTags={handleUpdateTags}
                onTagClick={handleTagClickWrapper}
                onRemoveFromQueue={handleRemoveFromQueue}
                onNewsletterClick={handleNewsletterClick}
                isInReadingQueue={readingQueue.some(item => item.newsletter_id === newsletter.id)}
                showCheckbox={isSelecting}
                showTags
                visibleTags={visibleTags}
                readingQueue={readingQueue}
                isDeletingNewsletter={isDeletingNewsletter || false}
                loadingStates={loadingStates}
                errorTogglingLike={errorTogglingLike}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default Inbox;
