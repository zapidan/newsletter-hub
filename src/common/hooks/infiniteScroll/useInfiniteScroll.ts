import { useCallback, useEffect, useRef, useState } from 'react';

export interface InfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export interface InfiniteScrollReturn {
  sentinelRef: React.RefObject<HTMLDivElement>;
  isIntersecting: boolean;
  hasReachedEnd: boolean;
}

/**
 * Custom hook for infinite scroll functionality using Intersection Observer
 * Provides business logic for detecting when user has scrolled to the bottom
 * and triggering load more actions
 */
export const useInfiniteScroll = ({
  threshold = 0.1,
  rootMargin = '100px',
  enabled = true,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: InfiniteScrollOptions): InfiniteScrollReturn => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  // Track if we've already triggered a load to prevent duplicate calls
  const loadTriggeredRef = useRef(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      const isCurrentlyIntersecting = entry.isIntersecting;

      setIsIntersecting(isCurrentlyIntersecting);

      // Only trigger load more when:
      // 1. Element is intersecting
      // 2. We have more pages to load
      // 3. We're not already fetching
      // 4. We haven't already triggered a load for this intersection
      // 5. Infinite scroll is enabled
      if (
        isCurrentlyIntersecting &&
        hasNextPage &&
        !isFetchingNextPage &&
        !loadTriggeredRef.current &&
        enabled &&
        onLoadMore
      ) {
        loadTriggeredRef.current = true;
        onLoadMore();
      }

      // Reset load trigger when element is no longer intersecting
      if (!isCurrentlyIntersecting) {
        loadTriggeredRef.current = false;
      }

      // Update end state when there are no more pages
      if (!hasNextPage && !isFetchingNextPage) {
        setHasReachedEnd(true);
      } else {
        setHasReachedEnd(false);
      }
    },
    [hasNextPage, isFetchingNextPage, enabled, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection, threshold, rootMargin, enabled]);

  // Reset states when dependencies change
  useEffect(() => {
    loadTriggeredRef.current = false;
    setHasReachedEnd(!hasNextPage && !isFetchingNextPage);
  }, [hasNextPage, isFetchingNextPage]);

  return {
    sentinelRef,
    isIntersecting,
    hasReachedEnd,
  };
};
