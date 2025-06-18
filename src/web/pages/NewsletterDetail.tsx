import { useCallback, useEffect, useState, useMemo, memo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNewsletters } from "@common/hooks/useNewsletters";
import { useTags } from "@common/hooks/useTags";
import { useAuth } from "@common/contexts/AuthContext";
import { useSharedNewsletterActions } from "@common/hooks/useSharedNewsletterActions";
import { useLogger } from "@common/utils/logger/useLogger";
import LoadingScreen from "@common/components/common/LoadingScreen";
import TagSelector from "@web/components/TagSelector";
import NewsletterDetailActions from "../../components/NewsletterDetail/NewsletterDetailActions";
import NewsletterNavigation from "../../components/NewsletterDetail/NewsletterNavigation";
import type { NewsletterWithRelations, Tag } from "@common/types";

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
      location.state?.from === "/reading-queue" ||
      (typeof location.state?.from === "string" &&
        location.state.from.includes("reading-queue")) ||
      (typeof document.referrer === "string" &&
        document.referrer.includes("reading-queue"))
    );
  }, [location.state]);

  // Check if we came from newsletter sources page
  const isFromNewsletterSources = useMemo(() => {
    return (
      location.state?.fromNewsletterSources === true ||
      location.state?.from === "/newsletters" ||
      (typeof location.state?.from === "string" &&
        location.state.from.includes("/newsletters") &&
        !location.state.from.includes("reading-queue")) ||
      (typeof document.referrer === "string" &&
        document.referrer.includes("/newsletters") &&
        !document.referrer.includes("reading-queue"))
    );
  }, [location.state]);

  // Helper function to get the correct back button text
  const getBackButtonText = useCallback(() => {
    if (isFromReadingQueue) {
      return "Back to Reading Queue";
    } else if (isFromNewsletterSources) {
      return "Back to Newsletter Sources";
    } else {
      return "Back to Inbox";
    }
  }, [isFromReadingQueue, isFromNewsletterSources]);

  const handleBack = useCallback(() => {
    log.debug("Navigation state for back action", {
      action: "navigate_back",
      metadata: {
        locationState: location.state,
        documentReferrer: document.referrer,
      },
    });

    // Check multiple indicators to determine where we came from
    const fromReadingQueue =
      location.state?.fromReadingQueue === true ||
      location.state?.from === "/reading-queue" ||
      (typeof document.referrer === "string" &&
        document.referrer.includes("reading-queue")) ||
      (typeof location.state?.from === "string" &&
        location.state.from.includes("reading-queue"));

    const fromNewsletterSources =
      location.state?.fromNewsletterSources === true ||
      location.state?.from === "/newsletters" ||
      (typeof document.referrer === "string" &&
        document.referrer.includes("/newsletters") &&
        !document.referrer.includes("reading-queue")) ||
      (typeof location.state?.from === "string" &&
        location.state.from.includes("/newsletters") &&
        !location.state.from.includes("reading-queue"));

    log.debug("Determined navigation context", {
      action: "navigate_back",
      metadata: {
        fromReadingQueue,
        fromNewsletterSources,
      },
    });

    // Determine target route
    let targetRoute = "/inbox";
    if (fromReadingQueue) {
      targetRoute = "/queue";
    } else if (fromNewsletterSources) {
      targetRoute = "/newsletters";
    }

    // Use window.history to go back first, then navigate if needed
    if (window.history.length > 1) {
      // If we have history, go back
      window.history.back();
      // Then navigate to the correct route if needed (as a fallback)
      setTimeout(() => {
        if (window.location.pathname === "/newsletters/" + id) {
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
  }, [navigate, location.state, id]);
  const { updateNewsletterTags } = useTags();
  const { getNewsletter } = useNewsletters({}, { enabled: false });
  const { handleMarkAsRead, handleToggleArchive } = useSharedNewsletterActions({
    showToasts: false,
    optimisticUpdates: true,
  });

  const { user } = useAuth();

  const [newsletter, setNewsletter] = useState<NewsletterWithRelations | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoMarkedAsRead, setHasAutoMarkedAsRead] = useState(false);
  const [hasAutoArchived, setHasAutoArchived] = useState(false);

  // Track the fetch state and mount status
  const isMounted = useRef(true);
  const lastFetchedId = useRef<string | null>(null);
  const isFetching = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch newsletter detail when id or user?.id changes
  useEffect(() => {
    // Skip if no ID or user
    if (!id || !user?.id) {
      setLoading(true);
      return;
    }

    // Skip if already fetching this ID
    if (isFetching.current && lastFetchedId.current === id) {
      log.debug("Newsletter fetch already in progress", {
        action: "fetch_newsletter_detail",
        metadata: { newsletterId: id },
      });
      return;
    }

    // Skip if we already have this newsletter loaded
    if (newsletter?.id === id) {
      log.debug("Using cached newsletter data", {
        action: "fetch_newsletter_detail",
        metadata: { newsletterId: id },
      });
      setLoading(false);
      return;
    }

    log.debug("Initializing newsletter fetch", {
      action: "fetch_newsletter_detail",
      metadata: { newsletterId: id },
    });

    // Update state
    lastFetchedId.current = id;
    isFetching.current = true;
    setLoading(true);
    setError(null);

    // Create a flag to track if the component is still mounted
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort("Request timed out");
      }
    }, 10000); // 10 second timeout

    const fetchData = async () => {
      try {
        const data = await getNewsletter(id);

        // Skip if component unmounted or ID changed
        if (!isMounted.current || lastFetchedId.current !== id) {
          log.debug(
            "Skipping state update - component unmounted or ID changed",
            {
              action: "fetch_newsletter_detail",
              metadata: {
                newsletterId: id,
                isMounted: isMounted.current,
                lastFetchedId: lastFetchedId.current,
              },
            },
          );
          return;
        }

        log.debug("Processing newsletter data", {
          action: "fetch_newsletter_detail",
          metadata: { newsletterId: data?.id },
        });

        if (data?.id === id) {
          setNewsletter(data);
          setError(null);
        } else {
          setError("Newsletter not found");
          setNewsletter(null);
        }
      } catch (err) {
        log.error(
          "Failed to fetch newsletter detail",
          {
            action: "fetch_newsletter_detail",
            metadata: { newsletterId: id },
          },
          err,
        );

        // Skip if component unmounted or ID changed
        if (!isMounted.current || lastFetchedId.current !== id) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load newsletter",
        );
        setNewsletter(null);
      } finally {
        // Clear the timeout
        clearTimeout(timeoutId);

        // Only update state if this is still the current fetch
        if (isMounted.current && lastFetchedId.current === id) {
          isFetching.current = false;
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      controller.abort("Component unmounted or ID changed");
      clearTimeout(timeoutId);
    };
  }, [id, user?.id, getNewsletter]); // Include getNewsletter in deps

  // Memoize the transformed tags to prevent unnecessary re-renders
  const tagsForUI = useMemo((): Tag[] => {
    if (!newsletter?.tags) return [];
    return (newsletter.tags as unknown[]).map((t: unknown) => {
      if ("name" in t && "color" in t) return t as Tag;
      if ("tag" in t && t.tag) return t.tag as Tag;
      return t as Tag;
    });
  }, [newsletter?.tags]);

  // Handle newsletter updates from the actions component
  const handleNewsletterUpdate = useCallback(
    (updatedNewsletter: NewsletterWithRelations) => {
      setNewsletter(updatedNewsletter);
    },
    [],
  );

  // Auto-mark newsletter as read when it loads (instantaneous)
  useEffect(() => {
    if (
      newsletter &&
      !newsletter.is_read &&
      !hasAutoMarkedAsRead &&
      !loading &&
      !error
    ) {
      const markAsRead = async () => {
        try {
          await handleMarkAsRead(newsletter.id);
          setHasAutoMarkedAsRead(true);
          log.debug("Auto-marked newsletter as read on detail view", {
            action: "auto_mark_read_detail",
            metadata: {
              newsletterId: newsletter.id,
              title: newsletter.title,
            },
          });

          // Update local state to reflect the change
          setNewsletter((prev) => (prev ? { ...prev, is_read: true } : null));
        } catch (error) {
          log.error(
            "Failed to auto-mark newsletter as read in detail view",
            {
              action: "auto_mark_read_detail_error",
              metadata: { newsletterId: newsletter.id },
            },
            error,
          );
        }
      };

      // Mark as read immediately for instant feedback
      markAsRead();
    }
  }, [newsletter?.id, hasAutoMarkedAsRead, loading, error]);

  // Auto-archive newsletter after it's been read and viewed for a short time
  useEffect(() => {
    if (
      newsletter &&
      newsletter.is_read &&
      !newsletter.is_archived &&
      !hasAutoArchived &&
      !loading &&
      !error
    ) {
      const archiveNewsletter = async () => {
        try {
          await handleToggleArchive(newsletter);
          setHasAutoArchived(true);
          log.debug("Auto-archived newsletter after reading", {
            action: "auto_archive_detail",
            metadata: {
              newsletterId: newsletter.id,
              title: newsletter.title,
            },
          });

          // Update local state to reflect the change
          setNewsletter((prev) =>
            prev ? { ...prev, is_archived: true } : null,
          );
        } catch (error) {
          log.error(
            "Failed to auto-archive newsletter in detail view",
            {
              action: "auto_archive_detail_error",
              metadata: { newsletterId: newsletter.id },
            },
            error,
          );
        }
      };

      // Archive after 3 seconds of viewing a read newsletter
      const timeoutId = setTimeout(archiveNewsletter, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [newsletter?.id, newsletter?.is_read, hasAutoArchived, loading, error]);

  // Reset auto-mark and auto-archive state when newsletter ID changes
  useEffect(() => {
    setHasAutoMarkedAsRead(false);
    setHasAutoArchived(false);
  }, [id]);

  // Load newsletter data when component mounts or id changes
  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user?.id) return;

      try {
        setLoading(true);
        const data = await getNewsletter(id);
        if (data) {
          setNewsletter(data as NewsletterWithRelations);
        } else {
          setError("Newsletter not found");
        }
      } catch (err) {
        log.error(
          "Failed to load newsletter",
          {
            action: "load_newsletter",
            metadata: { newsletterId: id },
          },
          err,
        );
        setError("Failed to load newsletter. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
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
          {error}
        </div>
      </div>
    );
  }

  if (!newsletter) {
    return <LoadingScreen />;
  }

  // Add key to force remount when ID changes
  return (
    <div
      key={`newsletter-${id}`}
      className="max-w-6xl w-full mx-auto px-4 py-8"
    >
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
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {" "}
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
                        const updated = await getNewsletter(id);
                        if (updated) setNewsletter(updated);
                        setTagSelectorKey((k) => k + 1);
                      }
                    } catch (error) {
                      log.error(
                        "Failed to update tags",
                        {
                          action: "update_tags",
                          metadata: { newsletterId: id },
                        },
                        error,
                      );
                    }
                  }}
                  onTagDeleted={async () => {
                    if (!id) return;
                    try {
                      const ok = await updateNewsletterTags(id, []);
                      if (ok) {
                        const updated = await getNewsletter(id);
                        if (updated) setNewsletter(updated);
                        setTagSelectorKey((k) => k + 1);
                      }
                    } catch (error) {
                      log.error(
                        "Failed to delete tag",
                        {
                          action: "delete_tag",
                          metadata: { newsletterId: id },
                        },
                        error,
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
                  {new Date(newsletter.received_at).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </div>
                {newsletter.estimated_read_time > 0 && (
                  <div className="mt-1 text-gray-400">
                    {newsletter.estimated_read_time} min read •{" "}
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
            <h3 className="font-medium text-gray-900 mb-4">
              Context & Insights
            </h3>
            <div className="text-sm text-gray-600">
              {newsletter?.summary || "No summary available"}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">Related Topics</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "1", name: "Tech News", count: 5 },
                { id: "2", name: "AI", count: 8 },
                { id: "3", name: "Product", count: 3 },
                { id: "4", name: "Industry", count: 6 },
              ].map((topic) => (
                <button
                  key={topic.id}
                  onClick={() =>
                    navigate(`/inbox?topic=${topic.name.toLowerCase()}`)
                  }
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
