import React, { useMemo } from "react";
import { NewsletterWithRelations, Tag } from "../../../common/types";
import { useInfiniteScroll } from "../../../common/hooks/infiniteScroll/useInfiniteScroll";
import NewsletterRow from "../NewsletterRow";
import { LoadingSentinel } from "./LoadingSentinel";

export interface InfiniteNewsletterListProps {
  newsletters: NewsletterWithRelations[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  totalCount: number;
  error: Error | null;
  onLoadMore: () => void;
  onRetry?: () => void;

  // Newsletter row props
  selectedIds?: Set<string>;
  isSelecting?: boolean;
  readingQueue?: Array<{ newsletter_id: string }>;
  visibleTags?: Set<string>;

  // Newsletter row actions
  onRowClick?: (newsletter: NewsletterWithRelations) => void;
  onToggleSelect?: (id: string) => void;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive?: (id: string) => void;
  onToggleRead?: (id: string) => void;
  onTrash?: (id: string) => void;
  onToggleQueue?: (newsletterId: string) => void;
  onUpdateTags?: (newsletterId: string, tagIds: string[]) => void;
  onToggleTagVisibility?: (id: string, e: React.MouseEvent) => void;
  onTagClick?: (tag: Tag) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, newsletterId: string) => void;
  onMouseEnter?: (newsletter: NewsletterWithRelations) => void;

  // Loading states
  isDeletingNewsletter?: (id: string) => boolean;
  isUpdatingTags?: (id: string) => boolean;
  loadingStates?: Record<string, string>;

  // Error states
  errorTogglingLike?: Error | null;
  tagUpdateError?: string | null;
  onDismissTagError?: () => void;

  // Display options
  showTags?: boolean;
  showCheckbox?: boolean;

  // Infinite scroll options
  threshold?: number;
  rootMargin?: string;
  className?: string;
}

/**
 * Infinite scroll container for newsletters
 * Combines business logic from useInfiniteScroll with presentation logic
 * Renders a list of newsletters with automatic loading on scroll
 */
export const InfiniteNewsletterList: React.FC<InfiniteNewsletterListProps> = ({
  newsletters,
  isLoading,
  isLoadingMore,
  hasNextPage,
  totalCount,
  error,
  onLoadMore,
  onRetry,

  // Newsletter row props
  selectedIds = new Set(),
  isSelecting = false,
  readingQueue = [],
  visibleTags = new Set(),

  // Newsletter row actions
  onRowClick,
  onToggleSelect,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  onUpdateTags,
  onToggleTagVisibility,
  onTagClick,
  onRemoveFromQueue,
  onMouseEnter,

  // Loading states
  isDeletingNewsletter = () => false,
  isUpdatingTags = () => false,
  loadingStates = {},

  // Error states
  errorTogglingLike,
  tagUpdateError,
  onDismissTagError,

  // Display options
  showTags = true,
  showCheckbox = false,

  // Infinite scroll options
  threshold = 0.1,
  rootMargin = "100px",
  className = "",
}) => {
  // Infinite scroll hook
  const { sentinelRef, hasReachedEnd } = useInfiniteScroll({
    threshold,
    rootMargin,
    enabled: !isLoading,
    hasNextPage,
    isFetchingNextPage: isLoadingMore,
    onLoadMore,
  });

  // Memoize newsletter row actions to prevent unnecessary re-renders
  const createNewsletterActions = useMemo(() => {
    return (newsletter: NewsletterWithRelations) => ({
      onToggleSelect: onToggleSelect
        ? () => onToggleSelect(newsletter.id)
        : undefined,
      onToggleLike: onToggleLike
        ? () => onToggleLike(newsletter)
        : async () => {},
      onToggleArchive: onToggleArchive
        ? async () => onToggleArchive(newsletter.id)
        : async () => {},
      onToggleRead: onToggleRead
        ? async () => onToggleRead(newsletter.id)
        : async () => {},
      onTrash: onTrash ? () => onTrash(newsletter.id) : () => {},
      onToggleQueue: onToggleQueue
        ? async () => onToggleQueue(newsletter.id)
        : async () => {},
      onUpdateTags: onUpdateTags
        ? (newsletterId: string, tagIds: string[]) =>
            onUpdateTags(newsletterId, tagIds)
        : () => {},
      onToggleTagVisibility: onToggleTagVisibility || (() => {}),
      onTagClick: onTagClick
        ? (tag: Tag, _e: React.MouseEvent) => onTagClick(tag)
        : () => {},
      onRemoveFromQueue: onRemoveFromQueue,
      onRowClick: onRowClick ? () => onRowClick(newsletter) : undefined,
      onMouseEnter: onMouseEnter ? () => onMouseEnter(newsletter) : undefined,
    });
  }, [
    onToggleSelect,
    onToggleLike,
    onToggleArchive,
    onToggleRead,
    onTrash,
    onToggleQueue,
    onUpdateTags,
    onToggleTagVisibility,
    onTagClick,
    onRemoveFromQueue,
    onRowClick,
    onMouseEnter,
  ]);

  // Initial loading state
  if (isLoading && newsletters.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 ${className}`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-base text-neutral-400">Loading newsletters...</p>
      </div>
    );
  }

  // Error state for initial load
  if (error && newsletters.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
      >
        <div className="text-red-500 mb-4">
          <svg
            className="w-16 h-16 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">
            Failed to load newsletters
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {error.message ||
              "Something went wrong while loading your newsletters"}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!isLoading && newsletters.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
      >
        <div className="text-gray-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2m16-7H4m16 0l-2-2m-12 2l2-2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No newsletters found
        </h3>
        <p className="text-sm text-gray-500">
          No newsletters match your current filters. Try adjusting your search
          criteria.
        </p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Newsletter List */}
      <div className="space-y-0 divide-y divide-gray-100">
        {newsletters.map((newsletter) => {
          const isInQueue = readingQueue.some(
            (item) => item.newsletter_id === newsletter.id,
          );

          const actions = createNewsletterActions(newsletter);

          return (
            <NewsletterRow
              key={newsletter.id}
              newsletter={newsletter}
              isSelected={isSelecting && selectedIds.has(newsletter.id)}
              showCheckbox={showCheckbox || isSelecting}
              showTags={showTags}
              isInReadingQueue={isInQueue}
              readingQueue={readingQueue}
              visibleTags={visibleTags}
              isDeletingNewsletter={
                isDeletingNewsletter
                  ? isDeletingNewsletter(newsletter.id)
                  : false
              }
              loadingStates={loadingStates}
              errorTogglingLike={errorTogglingLike}
              isUpdatingTags={
                isUpdatingTags ? isUpdatingTags(newsletter.id) : false
              }
              tagUpdateError={tagUpdateError}
              onDismissTagError={onDismissTagError}
              {...actions}
            />
          );
        })}
      </div>

      {/* Loading Sentinel */}
      <div ref={sentinelRef}>
        <LoadingSentinel
          isLoading={isLoadingMore}
          hasReachedEnd={hasReachedEnd}
          totalCount={totalCount}
          loadedCount={newsletters.length}
          error={error}
          onRetry={onRetry}
          className="mt-4"
        />
      </div>
    </div>
  );
};

export default InfiniteNewsletterList;
