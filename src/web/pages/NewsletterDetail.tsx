import LoadingScreen from '@common/components/common/LoadingScreen';
import { useAuth } from '@common/contexts/AuthContext';
import { useNewsletterDetail } from '@common/hooks/useNewsletterDetail';
import { useNewsletterSourceGroups } from '@common/hooks/useNewsletterSourceGroups';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useSimpleNewsletterNavigation } from '@common/hooks/useSimpleNewsletterNavigation';
import { useTags } from '@common/hooks/useTags';
import { newsletterService } from '@common/services';
import type { NewsletterSourceGroup, NewsletterWithRelations, Tag } from '@common/types';
import { useLogger } from '@common/utils/logger/useLogger';
import { useMutation } from '@tanstack/react-query';
import TagSelector from '@web/components/TagSelector';
import { ArrowLeft } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import NavigationArrows from '../../components/NewsletterDetail/NavigationArrows';
import NewsletterDetailActions from '../../components/NewsletterDetail/NewsletterDetailActions';

// Lightweight Shadow DOM renderer to isolate newsletter HTML styles from app theme/layout
function ShadowHtml({ html }: { html: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const darkStyleRef = useRef<HTMLStyleElement | null>(null);

  const setTheme = useCallback((mode: 'light' | 'dark') => {
    if (!shadowRef.current) return;
    if (!darkStyleRef.current) {
      darkStyleRef.current = document.createElement('style');
      shadowRef.current.appendChild(darkStyleRef.current);
    }
    // Base light styles are handled by the first style tag. Here we set overrides for dark.
    darkStyleRef.current.textContent = mode === 'dark' ? `
      .nh-content { color: #e5e7eb; background: transparent; }
      /* Force-override common inline white backgrounds from email HTML */
      .nh-content, .nh-content * { background-color: transparent !important; }
      .nh-content h1, .nh-content h2, .nh-content h3, .nh-content h4, .nh-content h5, .nh-content h6 { color: #f3f4f6; }
      .nh-content p, .nh-content li, .nh-content span, .nh-content div { color: #e5e7eb; }
      .nh-content a { color: #93c5fd; }
      .nh-content blockquote { color: #d1d5db; border-left: 4px solid #374151; background: rgba(55,65,81,0.3); }
      /* Re-apply explicit dark backgrounds for code/pre after global transparent override */
      .nh-content code { background: rgba(75,85,99,0.4) !important; color: #f9fafb; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
      .nh-content pre { background: rgba(31,41,55,0.8) !important; color: #f3f4f6; padding: 0.75rem; border-radius: 0.5rem; overflow: auto; }
      .nh-content table { color: #e5e7eb; }
      .nh-content th { background: rgba(31,41,55,0.8) !important; }
      .nh-content td, .nh-content th { border-color: #374151; }
      .nh-content hr { border-color: #374151; }
      .nh-content img { background: transparent; }
    ` : '';
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!shadowRef.current) {
      shadowRef.current = hostRef.current.attachShadow({ mode: 'open' });
      // Base styles to keep host transparent and inherit fonts/colors
      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; contain: content; }
        .nh-content { font-family: inherit; color: inherit; line-height: 1.6; background: transparent; }
        .nh-content img { max-width: 100%; height: auto; }
        .nh-content a { color: #2563EB; text-decoration: underline; }
      `;
      shadowRef.current.appendChild(style);
      // Initialize theme based on current document state
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
      // Listen for theme changes
      const handler = (e: Event) => {
        try {
          const detail = (e as CustomEvent).detail as { mode?: 'light' | 'dark' };
          if (detail && detail.mode) setTheme(detail.mode);
        } catch {
          // no-op
        }
      };
      window.addEventListener('nh-theme-change', handler as EventListener);
      // Cleanup on unmount
      hostRef.current.addEventListener('DOMNodeRemovedFromDocument', () => {
        window.removeEventListener('nh-theme-change', handler as EventListener);
      });
    }
    if (shadowRef.current) {
      // Wrap html inside a container to apply base styles
      const wrapper = document.createElement('div');
      wrapper.className = 'nh-content';
      wrapper.innerHTML = html;
      // Clear previous content except the first two style elements (base + dark)
      const nodes = Array.from(shadowRef.current.childNodes);
      nodes.forEach((n, idx) => {
        if (idx <= 1 && n.nodeName.toLowerCase() === 'style') return;
        shadowRef.current?.removeChild(n);
      });
      shadowRef.current.appendChild(wrapper);
    }
  }, [html, setTheme]);

  return <div ref={hostRef} />;
}

const NewsletterDetail = memo(() => {
  const [tagSelectorKey, setTagSelectorKey] = useState(0);
  const { id } = useParams<{ id: string }>();
  const log = useLogger();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if we came from the reading queue using multiple indicators
  const isFromReadingQueue = useMemo(() => {
    return (
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue')) ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue'))
    );
  }, [location.state]);

  // Helper function to get the correct back button text
  const getBackButtonText = useCallback(() => {
    if (isFromReadingQueue) {
      return 'Back to Reading Queue';
    } else {
      return 'Back to Inbox';
    }
  }, [isFromReadingQueue]);

  const handleBack = useCallback(() => {
    log.debug('Navigation state for back action', {
      action: 'navigate_back',
      metadata: {
        locationState: location.state,
        documentReferrer: document.referrer,
      },
    });

    // Check if we came from reading queue
    const fromReadingQueue =
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue')) ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue'));

    log.debug('Determined navigation context', {
      action: 'navigate_back',
      metadata: {
        fromReadingQueue,
      },
    });

    // Determine target route
    let targetRoute = '/inbox';
    if (fromReadingQueue) {
      targetRoute = '/queue';
    }

    // Preserve URL parameters when navigating back to inbox
    if (targetRoute === '/inbox') {
      const currentParams = new URLSearchParams();

      // Preserve groups parameter if it exists
      const groupsParam = searchParams.get('groups');
      if (groupsParam) {
        currentParams.set('groups', groupsParam);
      }

      // Preserve other filter parameters
      const filterParam = searchParams.get('filter');
      if (filterParam) {
        currentParams.set('filter', filterParam);
      }

      const sourceParam = searchParams.get('source');
      if (sourceParam) {
        currentParams.set('source', sourceParam);
      }

      const tagsParam = searchParams.get('tags');
      if (tagsParam) {
        currentParams.set('tags', tagsParam);
      }

      const timeParam = searchParams.get('time');
      if (timeParam) {
        currentParams.set('time', timeParam);
      }

      const paramString = currentParams.toString();
      const finalUrl = paramString ? `${targetRoute}?${paramString}` : targetRoute;

      navigate(finalUrl, {
        replace: true,
      });
    } else {
      // For reading queue, navigate directly without preserving params
      navigate(targetRoute, {
        replace: true,
      });
    }
  }, [navigate, location.state, log, searchParams]);

  useTags();

  // Create mutations directly using useMutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsRead(id),
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => newsletterService.markAsUnread(id),
  });

  const toggleLikeMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleLike(id),
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: (id: string) => newsletterService.toggleArchive(id),
  });

  const deleteNewsletterMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteNewsletter(id),
  });

  const addToQueueMutation = useMutation({
    mutationFn: (id: string) => newsletterService.addToReadingQueue(id),
  });

  const updateTagsMutation = useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      newsletterService.updateTags(id, tagIds),
  });

  // Create wrapper functions to convert NewsletterOperationResult to boolean
  const markAsRead = useCallback(
    async (id: string) => {
      const result = await markAsReadMutation.mutateAsync(id);
      return result.success;
    },
    [markAsReadMutation]
  );

  const markAsUnread = useCallback(
    async (id: string) => {
      const result = await markAsUnreadMutation.mutateAsync(id);
      return result.success;
    },
    [markAsUnreadMutation]
  );

  const toggleLike = useCallback(
    async (id: string) => {
      const result = await toggleLikeMutation.mutateAsync(id);
      return result.success;
    },
    [toggleLikeMutation]
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      const result = await toggleArchiveMutation.mutateAsync(id);
      return result.success;
    },
    [toggleArchiveMutation]
  );

  const deleteNewsletter = useCallback(
    async (id: string) => {
      const result = await deleteNewsletterMutation.mutateAsync(id);
      return result.success;
    },
    [deleteNewsletterMutation]
  );

  // Create a toggleInQueue function that combines addToQueue and removeFromQueue
  const toggleInQueue = useCallback(
    async (id: string) => {
      // This is a simplified version - in practice you'd need to check if the newsletter is in queue
      // For now, we'll just use addToQueue as a fallback
      const result = await addToQueueMutation.mutateAsync(id);
      return result.success;
    },
    [addToQueueMutation]
  );

  // Create a wrapper for updateNewsletterTags to match the expected signature for useSharedNewsletterActions
  const updateNewsletterTagsForActions = useCallback(
    async (id: string, tagIds: string[]) => {
      await updateTagsMutation.mutateAsync({ id, tagIds });
    },
    [updateTagsMutation]
  );

  // Create a wrapper for updateNewsletterTags that returns boolean for TagSelector
  const updateNewsletterTagsForSelector = useCallback(
    async (id: string, tagIds: string[]) => {
      try {
        await updateTagsMutation.mutateAsync({ id, tagIds });
        return true;
      } catch (_error) {
        return false;
      }
    },
    [updateTagsMutation]
  );

  const { handleMarkAsRead, handleToggleArchive } = useSharedNewsletterActions(
    {
      markAsRead,
      markAsUnread,
      toggleLike,
      toggleArchive,
      deleteNewsletter,
      toggleInQueue,
      updateNewsletterTags: updateNewsletterTagsForActions,
    },
    {
      showToasts: false,
      optimisticUpdates: false,
      onSuccess: () => {
        // Don't refetch here - let React Query handle cache updates
        // This prevents cascading refetches
      },
    }
  );

  const { user } = useAuth();

  // Use the optimized newsletter detail hook
  const {
    newsletter,
    isLoading: loading,
    isError,
    error: fetchError,
    refetch,
    prefetchRelated,
  } = useNewsletterDetail(id || '', {
    enabled: !!id && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    prefetchTags: true,
    prefetchSource: true,
  });

  // Get source ID from location state or newsletter data
  const sourceId = useMemo(() => {
    // First try to get from location state (most reliable)
    if (location.state?.sourceId) {
      return location.state.sourceId;
    }
    // Fallback to newsletter source ID if coming from newsletter sources
    if (isFromReadingQueue && newsletter?.source?.id) {
      return newsletter.source.id;
    }
    return undefined;
  }, [location.state?.sourceId, isFromReadingQueue, newsletter?.source?.id]);

  const [hasAutoMarkedAsRead, setHasAutoMarkedAsRead] = useState(false);
  const [hasAutoArchived, setHasAutoArchived] = useState(false);

  // Track mount status for cleanup
  const isMounted = useRef(true);
  // Track if mark as read is in progress to prevent duplicates
  const markAsReadInProgress = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Prefetch related data when newsletter loads
  useEffect(() => {
    if (newsletter && !loading) {
      prefetchRelated();
    }
  }, [newsletter, loading, prefetchRelated]);

  // Memoize the transformed tags to prevent unnecessary re-renders
  const tagsForUI = useMemo((): Tag[] => {
    if (!newsletter?.tags) return [];
    return (newsletter.tags as unknown[]).map((t: unknown) => {
      if (typeof t === 'object' && t !== null && 'name' in t && 'color' in t) return t as Tag;
      if (typeof t === 'object' && t !== null && 'tag' in t && (t as { tag: Tag }).tag)
        return (t as { tag: Tag }).tag as Tag;
      return t as Tag;
    });
  }, [newsletter?.tags]);

  // Handle newsletter updates from the actions component
  const handleNewsletterUpdate = useCallback((_updatedNewsletter: NewsletterWithRelations) => {
    // Don't refetch here - React Query will update from cache
    // This prevents infinite loops of refetching
  }, []);

  // Auto-mark newsletter as read when it loads (instantaneous)
  useEffect(() => {
    // Only run when we have a new newsletter that hasn't been marked as read
    if (!newsletter || newsletter.is_read || loading || fetchError) {
      return;
    }

    // Only run once per newsletter ID
    if (hasAutoMarkedAsRead) {
      return;
    }

    const markAsRead = async () => {
      // Check if already in progress
      if (markAsReadInProgress.current) {
        return;
      }

      // Set both flags before making the call to prevent duplicate calls
      setHasAutoMarkedAsRead(true);
      markAsReadInProgress.current = true;

      try {
        await handleMarkAsRead(newsletter.id);
        log.debug('Auto-marked newsletter as read on detail view', {
          action: 'auto_mark_read_detail',
          metadata: {
            newsletterId: newsletter.id,
            title: newsletter.title,
          },
        });
      } catch (error) {
        // Reset flag on error so it can be retried
        setHasAutoMarkedAsRead(false);
        log.error(
          'Failed to auto-mark newsletter as read in detail view',
          {
            action: 'auto_mark_read_detail_error',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      } finally {
        // Always reset the in-progress flag
        markAsReadInProgress.current = false;
      }
    };

    markAsRead();
  }, [newsletter, loading, fetchError, hasAutoMarkedAsRead, handleMarkAsRead, log]);

  // Auto-archive newsletter after it's been read and viewed for a short time
  useEffect(() => {
    // Skip if conditions aren't met
    if (!newsletter || !newsletter.is_read || newsletter.is_archived || loading || fetchError) {
      return;
    }

    // Skip if already processed
    if (hasAutoArchived) {
      return;
    }

    // Set flag immediately to prevent multiple timers
    setHasAutoArchived(true);

    const archiveNewsletter = async () => {
      try {
        await handleToggleArchive(newsletter); // newsletter is from outer scope
        log.debug('Auto-archived newsletter after reading', {
          action: 'auto_archive_detail',
          metadata: {
            newsletterId: newsletter.id, // newsletter is from outer scope
            title: newsletter.title, // newsletter is from outer scope
          },
        });
      } catch (error) {
        // Reset flag on error so it can be retried
        setHasAutoArchived(false);
        log.error(
          'Failed to auto-archive newsletter in detail view',
          {
            action: 'auto_archive_detail_error',
            metadata: { newsletterId: newsletter.id }, // newsletter is from outer scope
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };

    // Archive after 3 seconds of viewing a read newsletter
    const timeoutId = setTimeout(archiveNewsletter, 3000);
    return () => clearTimeout(timeoutId);
  }, [newsletter, loading, fetchError, hasAutoArchived, handleToggleArchive, log]);

  // Reset auto-mark and auto-archive state when newsletter ID changes
  useEffect(() => {
    setHasAutoMarkedAsRead(false);
    setHasAutoArchived(false);
    markAsReadInProgress.current = false;
  }, [id]);

  // Memoize mutations object to prevent unnecessary re-renders and infinite loops
  const mutations = useMemo(
    () => ({
      markAsRead,
      markAsUnread,
      toggleLike,
      toggleArchive,
      deleteNewsletter,
      toggleInQueue,
      updateNewsletterTags: updateNewsletterTagsForActions,
    }),
    [
      markAsRead,
      markAsUnread,
      toggleLike,
      toggleArchive,
      deleteNewsletter,
      toggleInQueue,
      updateNewsletterTagsForActions,
    ]
  );

  const { groups = [] } = useNewsletterSourceGroups();
  // Get navigation filter from location state or URL params
  const navigationFilter = useMemo(() => {
    // Prefer URL params over location state for filter
    const filterParam = searchParams.get('filter') || location.state?.currentFilter;
    const sourceParam = searchParams.get('source') || location.state?.sourceFilter;
    const tagsParam = searchParams.get('tags');

    if (filterParam) {
      // Convert filter string to NewsletterFilter format
      const filter: Partial<import('@common/types/cache').NewsletterFilter> = {};
      if (filterParam === 'unread') {
        filter.isRead = false;
        filter.isArchived = false;
      }
      if (filterParam === 'archived') filter.isArchived = true;
      if (filterParam === 'liked') {
        filter.isLiked = true;
        // Don't set isArchived for liked filter - show all liked newsletters
      }
      if (sourceParam) filter.sourceIds = [sourceParam];
      if (tagsParam) {
        filter.tagIds = tagsParam.split(',').filter(Boolean);
      } else if (location.state?.tagIds?.length > 0) {
        filter.tagIds = location.state.tagIds;
      }
      return filter;
    }
    return {};
  }, [location.state, searchParams]);

  // Setup navigation
  const navigation = useSimpleNewsletterNavigation(id || '', {
    isReadingQueue: isFromReadingQueue,
    filter: navigationFilter,
    sourceId: sourceId,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <div key={`error-${id}`} className="max-w-6xl w-full mx-auto px-4 py-8">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 rounded-md flex items-center gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {getBackButtonText()}
        </button>
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-md mb-6">
          {fetchError?.message || 'Failed to load newsletter. Please try again.'}
        </div>
      </div>
    );
  }

  if (!newsletter) {
    return <LoadingScreen />;
  }

  // Add key to force remount when ID changes
  return (
    <div data-testid="newsletter-detail">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {getBackButtonText()}
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 mb-6 border border-slate-200/60 dark:border-neutral-800">
              <div className="mb-6">
                <h1
                  data-testid="newsletter-detail-title"
                  className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4"
                >
                  {newsletter?.title}
                </h1>
                {/* Newsletter Source and Group */}
                <div className="mb-2">
                  <div data-testid="newsletter-source" className="text-sm text-gray-600 dark:text-slate-400">
                    <span className="font-medium">Source:</span>{' '}
                    {newsletter?.source?.name || 'Unknown'}
                    {newsletter?.source?.from && (
                      <span className="ml-2 text-gray-400 dark:text-slate-500">({newsletter.source.from})</span>
                    )}
                  </div>
                  <div data-testid="newsletter-source-group" className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    <span className="font-medium">Source Groups:</span>{' '}
                    <SourceGroupDropdown newsletter={newsletter} groups={groups} onGroupChange={refetch} />
                    <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">(up to 10)</span>
                  </div>
                </div>
              </div>
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
                        const ok = await updateNewsletterTagsForSelector(
                          id,
                          newTags.map((t) => t.id)
                        );
                        if (ok) {
                          await refetch();
                          setTagSelectorKey((k) => k + 1);
                        }
                      } catch (error) {
                        log.error(
                          'Failed to update tags',
                          {
                            action: 'update_tags',
                            metadata: { newsletterId: id },
                          },
                          error instanceof Error ? error : new Error(String(error))
                        );
                      }
                    }}
                    onTagDeleted={async () => {
                      if (!id) return;
                      try {
                        const ok = await updateNewsletterTagsForSelector(id, []);
                        if (ok) {
                          await refetch();
                          setTagSelectorKey((k) => k + 1);
                        }
                      } catch (error) {
                        log.error(
                          'Failed to delete tag',
                          {
                            action: 'delete_tag',
                            metadata: { newsletterId: id },
                          },
                          error instanceof Error ? error : new Error(String(error))
                        );
                      }
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="ml-4">
                  {newsletter && (
                    <NewsletterDetailActions
                      newsletter={newsletter}
                      onNewsletterUpdate={handleNewsletterUpdate}
                      isFromReadingQueue={isFromReadingQueue}
                      mutations={mutations}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Top Navigation Arrows */}
            {newsletter && (
              <div className="mb-4">
                <NavigationArrows
                  onPrevious={navigation.navigateToPrevious}
                  onNext={navigation.navigateToNext}
                  hasPrevious={navigation.hasPrevious}
                  hasNext={navigation.hasNext}
                  isLoading={navigation.isLoading}
                />
              </div>
            )}

            {/* Newsletter Content */}
            <div className="mb-6 rounded-xl p-4 bg-white dark:bg-neutral-950 border border-slate-200/60 dark:border-neutral-900">
              {newsletter?.received_at && (
                <div className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                  <div>
                    {new Date(newsletter.received_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {newsletter.estimated_read_time > 0 && (
                    <div className="mt-1 text-gray-400 dark:text-slate-500">
                      {newsletter.estimated_read_time} min read •{' '}
                      {newsletter.word_count.toLocaleString()} words
                    </div>
                  )}
                </div>
              )}
              {newsletter?.content && (
                <ShadowHtml html={newsletter.content} />
              )}
            </div>

            {/* Context & Insights - Moved below newsletter content */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 mb-6 border border-slate-200/60 dark:border-neutral-800">
              <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">Context & Insights</h3>
              <div className="text-sm text-gray-600 dark:text-slate-400">
                {/* Intentionally left empty as per requirements */}
              </div>
            </div>

            {/* Bottom Navigation Arrows */}
            {newsletter && (
              <div className="mt-6">
                <NavigationArrows
                  onPrevious={navigation.navigateToPrevious}
                  onNext={navigation.navigateToNext}
                  hasPrevious={navigation.hasPrevious}
                  hasNext={navigation.hasNext}
                  isLoading={navigation.isLoading}
                />
              </div>
            )}
          </div>
          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 border border-slate-200/60 dark:border-neutral-800">
              <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">Related Topics</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: '1', name: 'Tech News', count: 5 },
                  { id: '2', name: 'AI', count: 8 },
                  { id: '3', name: 'Product', count: 3 },
                  { id: '4', name: 'Industry', count: 6 },
                ].map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => navigate(`/inbox?topic=${topic.name.toLowerCase()}`)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-slate-200 rounded-full flex items-center gap-1.5"
                  >
                    <span>{topic.name}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{topic.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Inline Source Group Dropdown component
function SourceGroupDropdown({ newsletter, groups, onGroupChange }: { newsletter: NewsletterWithRelations, groups: NewsletterSourceGroup[], onGroupChange?: () => void }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [groupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupUpdating, setGroupUpdating] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addSourcesToGroup, removeSourcesFromGroup } = useNewsletterSourceGroups();
  const sourceId = newsletter.source?.id;
  const currentGroupIds: string[] = useMemo(() => {
    if (!sourceId) return [];
    return groups
      .filter((g) => Array.isArray(g.sources) && g.sources.some((s: { id: string }) => s.id === sourceId))
      .map((g) => g.id);
  }, [groups, sourceId]);
  const currentGroupNames = useMemo(() => {
    const idsToDisplay = showDropdown ? currentGroupIds : (selectedGroupIds.length ? selectedGroupIds : currentGroupIds);
    if (!idsToDisplay.length) return 'None';
    const names = groups
      .filter((g) => idsToDisplay.includes(g.id))
      .map((g) => g.name);
    return names.join(', ');
  }, [groups, currentGroupIds, selectedGroupIds, showDropdown]);

  useEffect(() => {
    // Sync local selection when the computed current groups change or dropdown opens
    setSelectedGroupIds(currentGroupIds);
  }, [currentGroupIds]);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const toggleSelection = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    if (!sourceId) return;
    setGroupUpdating(true);
    setGroupError(null);
    try {
      const toAdd = selectedGroupIds.filter((id) => !currentGroupIds.includes(id));
      const toRemove = currentGroupIds.filter((id) => !selectedGroupIds.includes(id));

      // Perform additions and removals
      await Promise.all([
        ...toAdd.map((gid) => addSourcesToGroup.mutateAsync({ groupId: gid, sourceIds: [sourceId] })),
        ...toRemove.map((gid) => removeSourcesFromGroup.mutateAsync({ groupId: gid, sourceIds: [sourceId] })),
      ]);

      setShowDropdown(false);
      if (onGroupChange) onGroupChange();
    } catch (_err) {
      setGroupError('Failed to update groups');
    } finally {
      setGroupUpdating(false);
    }
  };

  return (
    <span ref={dropdownRef} style={{ display: 'inline-block', minWidth: 120 }}>
      {!showDropdown ? (
        <button
          type="button"
          className="font-medium text-blue-700 hover:underline focus:outline-none px-1 rounded"
          onClick={() => setShowDropdown(true)}
          disabled={groupLoading || groupUpdating || !groups.length}
          aria-label="Edit source group"
        >
          {currentGroupNames}
        </button>
      ) : (
        <div className="border rounded px-3 py-2 bg-white shadow-sm text-sm" style={{ minWidth: 220 }}>
          <div className="max-h-48 overflow-auto pr-1">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`w-full flex items-center justify-between py-1 text-left hover:bg-neutral-50 rounded px-1 ${selectedGroupIds.includes(group.id) ? 'text-blue-700 font-medium' : ''}`}
                onClick={() => toggleSelection(group.id)}
                disabled={groupLoading || groupUpdating}
              >
                <span>{group.name}</span>
                <span className={`ml-2 text-xs ${selectedGroupIds.includes(group.id) ? 'opacity-100' : 'opacity-0'}`}>✓</span>
              </button>
            ))}
            {groups.length === 0 && (
              <div className="text-neutral-500">No groups</div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-2 py-1 text-neutral-600 hover:bg-neutral-100 rounded"
              onClick={() => {
                setSelectedGroupIds(currentGroupIds);
                setShowDropdown(false);
              }}
              disabled={groupUpdating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
              onClick={handleSave}
              disabled={groupUpdating}
            >
              Save
            </button>
          </div>
        </div>
      )}
      {(groupLoading || groupUpdating) && (
        <span className="ml-2 text-xs text-gray-400">Updating...</span>
      )}
      {groupError && (
        <span className="ml-2 text-xs text-red-500">{groupError}</span>
      )}
    </span>
  );
}

export default NewsletterDetail;
