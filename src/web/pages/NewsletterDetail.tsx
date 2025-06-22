import { useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNewsletterDetail } from '@common/hooks/useNewsletterDetail';
import { useTags } from '@common/hooks/useTags';
import { useAuth } from '@common/contexts/AuthContext';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { useLogger } from '@common/utils/logger/useLogger';
import LoadingScreen from '@common/components/common/LoadingScreen';
import TagSelector from '@web/components/TagSelector';
import NewsletterDetailActions from '../../components/NewsletterDetail/NewsletterDetailActions';
import NewsletterNavigation from '../../components/NewsletterDetail/NewsletterNavigation';
import type { NewsletterWithRelations, Tag } from '@common/types';

const NewsletterDetail = memo(() => {
  const [tagSelectorKey, setTagSelectorKey] = useState(0);
  const { id } = useParams<{ id: string }>();
  const log = useLogger();
  const navigate = useNavigate();
  const location = useLocation();
  // Check if we came from the reading queue using multiple indicators
  const isFromReadingQueue = useMemo(() => {
    return (
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue')) ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue'))
    );
  }, [location.state]);

  // Check if we came from newsletter sources page
  const isFromNewsletterSources = useMemo(() => {
    return (
      location.state?.fromNewsletterSources === true ||
      location.state?.from === '/newsletters' ||
      (typeof location.state?.from === 'string' &&
        location.state.from.includes('/newsletters') &&
        !location.state.from.includes('reading-queue')) ||
      (typeof document.referrer === 'string' &&
        document.referrer.includes('/newsletters') &&
        !document.referrer.includes('reading-queue'))
    );
  }, [location.state]);

  // Extract source ID from location if we're in a source context
  const sourceId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const sourceFromQuery = searchParams.get('source');
    const sourceFromPath = location.pathname.split('/sources/')[1]?.split('/')[0];
    const sourceFromState = location.state?.sourceId;

    return sourceFromQuery || sourceFromPath || sourceFromState || undefined;
  }, [location.search, location.pathname, location.state]);

  // Helper function to get the correct back button text
  const getBackButtonText = useCallback(() => {
    if (isFromReadingQueue) {
      return 'Back to Reading Queue';
    } else if (isFromNewsletterSources) {
      return 'Back to Newsletter Sources';
    } else {
      return 'Back to Inbox';
    }
  }, [isFromReadingQueue, isFromNewsletterSources]);

  const handleBack = useCallback(() => {
    log.debug('Navigation state for back action', {
      action: 'navigate_back',
      metadata: {
        locationState: location.state,
        documentReferrer: document.referrer,
      },
    });

    // Check multiple indicators to determine where we came from
    const fromReadingQueue =
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue')) ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue'));

    const fromNewsletterSources =
      location.state?.fromNewsletterSources === true ||
      location.state?.from === '/newsletters' ||
      (typeof document.referrer === 'string' &&
        document.referrer.includes('/newsletters') &&
        !document.referrer.includes('reading-queue')) ||
      (typeof location.state?.from === 'string' &&
        location.state.from.includes('/newsletters') &&
        !location.state.from.includes('reading-queue'));

    log.debug('Determined navigation context', {
      action: 'navigate_back',
      metadata: {
        fromReadingQueue,
        fromNewsletterSources,
      },
    });

    // Determine target route
    let targetRoute = '/inbox';
    if (fromReadingQueue) {
      targetRoute = '/queue';
    } else if (fromNewsletterSources) {
      targetRoute = '/newsletters';
    }

    // Use window.history to go back first, then navigate if needed
    if (window.history.length > 1) {
      // If we have history, go back
      window.history.back();
      // Then navigate to the correct route if needed (as a fallback)
      setTimeout(() => {
        if (window.location.pathname === '/newsletters/' + id) {
          // If we're still on the same page, force navigation
          navigate(targetRoute, {
            replace: true,
          });
        }
      }, 100);
    } else {
      // If no history, navigate directly
      navigate(targetRoute, {
        replace: true,
      });
    }
  }, [navigate, location.state, id, log]);
  const { updateNewsletterTags } = useTags();
  const { handleMarkAsRead, handleToggleArchive } = useSharedNewsletterActions({
    showToasts: false,
    optimisticUpdates: true,
    onSuccess: (updatedNewsletter) => {
      // Don't refetch here - let React Query handle cache updates
      // This prevents cascading refetches
    },
  });

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
  }, [newsletter?.id]); // Only depend on newsletter ID to prevent re-runs

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
        await handleToggleArchive(newsletter);
        log.debug('Auto-archived newsletter after reading', {
          action: 'auto_archive_detail',
          metadata: {
            newsletterId: newsletter.id,
            title: newsletter.title,
          },
        });
      } catch (error) {
        // Reset flag on error so it can be retried
        setHasAutoArchived(false);
        log.error(
          'Failed to auto-archive newsletter in detail view',
          {
            action: 'auto_archive_detail_error',
            metadata: { newsletterId: newsletter.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };

    // Archive after 3 seconds of viewing a read newsletter
    const timeoutId = setTimeout(archiveNewsletter, 3000);
    return () => clearTimeout(timeoutId);
  }, [newsletter?.id, newsletter?.is_read, newsletter?.is_archived]); // Minimal dependencies

  // Reset auto-mark and auto-archive state when newsletter ID changes
  useEffect(() => {
    setHasAutoMarkedAsRead(false);
    setHasAutoArchived(false);
    markAsReadInProgress.current = false;
  }, [id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <div key={`error-${id}`} className="max-w-6xl w-full mx-auto px-4 py-8">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
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
    <div key={`newsletter-${id}`} className="max-w-6xl w-full mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {getBackButtonText()}
      </button>

      {/* Newsletter Navigation */}
      {id && (
        <div className="mb-6">
          <NewsletterNavigation
            currentNewsletterId={id}
            className="bg-white rounded-xl shadow-sm p-4"
            showLabels={true}
            showCounter={true}
            autoMarkAsRead={false} // Let the detail page handle auto-marking
            isFromReadingQueue={isFromReadingQueue}
            sourceId={sourceId}
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {' '}
        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
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
                      const ok = await updateNewsletterTags(id, newTags);
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
                      const ok = await updateNewsletterTags(id, []);
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
                  />
                )}
              </div>
            </div>
          </div>

          {/* Newsletter Content */}
          <div className="prose max-w-none mb-6">
            {newsletter?.received_at && (
              <div className="text-sm text-gray-500 mb-6">
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
                  <div className="mt-1 text-gray-400">
                    {newsletter.estimated_read_time} min read •{' '}
                    {newsletter.word_count.toLocaleString()} words
                  </div>
                )}
              </div>
            )}
            {newsletter?.content && (
              <div dangerouslySetInnerHTML={{ __html: newsletter.content }} />
            )}
          </div>
        </div>
        {/* Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-4">Context & Insights</h3>
            <div className="text-sm text-gray-600">
              {newsletter?.summary || 'No summary available'}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">Related Topics</h3>
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
});
export default NewsletterDetail;
