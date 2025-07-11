import type { NewsletterWithRelations } from '@common/types';
import type { NewsletterFilter } from '@common/types/cache';
import { useLogger } from '@common/utils/logger/useLogger';
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNewsletters } from './useNewsletters';
import { useReadingQueue } from './useReadingQueue';

interface NavigationOptions {
  isReadingQueue?: boolean;
  filter?: NewsletterFilter;
  sourceId?: string;
}

interface UseSimpleNewsletterNavigationResult {
  hasPrevious: boolean;
  hasNext: boolean;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
  isLoading: boolean;
}

export function useSimpleNewsletterNavigation(
  currentNewsletterId: string,
  options: NavigationOptions = {}
): UseSimpleNewsletterNavigationResult {
  const navigate = useNavigate();
  const location = useLocation();
  const log = useLogger('useSimpleNewsletterNavigation');
  const { isReadingQueue, filter, sourceId } = options;

  // Get newsletters based on context
  const readingQueueQuery = useReadingQueue();

  log.debug('useSimpleNewsletterNavigation filter', { filter, isReadingQueue });

  const newslettersQuery = useNewsletters(filter || {}, {
    enabled: !isReadingQueue,
  });

  // Get newsletters from data source
  const newsletters = useMemo(() => {
    if (isReadingQueue) {
      return readingQueueQuery.readingQueue?.map((item) => item.newsletter) || [];
    }
    return newslettersQuery.newsletters || [];
  }, [isReadingQueue, readingQueueQuery.readingQueue, newslettersQuery.newsletters]);

  const isLoading = isReadingQueue ? readingQueueQuery.isLoading : newslettersQuery.isLoading;

  // Find current newsletter index
  const currentIndex = useMemo(() => {
    if (!currentNewsletterId || !newsletters.length) return -1;
    return newsletters.findIndex((n: NewsletterWithRelations) => n.id === currentNewsletterId);
  }, [currentNewsletterId, newsletters]);

  // Determine if there are previous/next newsletters
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < newsletters.length - 1;

  // Navigate to previous newsletter
  const navigateToPrevious = useCallback(() => {
    if (!hasPrevious || currentIndex <= 0) return;

    const previousNewsletter = newsletters[currentIndex - 1];
    if (!previousNewsletter) return;

    log.debug('Navigating to previous newsletter', {
      from: currentNewsletterId,
      to: previousNewsletter.id,
      isReadingQueue,
    });

    // Preserve current URL search params (e.g., ?filter=liked)
    const targetPath = `/newsletters/${previousNewsletter.id}${location.search}`;

    // Preserve navigation state, but keep original 'from' if it was /inbox or /queue
    const originalFrom =
      location.state?.from === '/inbox' || location.state?.from === '/queue'
        ? location.state.from
        : location.pathname;
    navigate(targetPath, {
      replace: false,
      state: {
        ...location.state,
        from: originalFrom,
        fromNavigation: true,
        fromReadingQueue: isReadingQueue,
        sourceId: sourceId,
        currentFilter: filter,
      },
    });
  }, [
    hasPrevious,
    currentIndex,
    newsletters,
    currentNewsletterId,
    isReadingQueue,
    sourceId,
    filter,
    navigate,
    location,
    log,
  ]);

  // Navigate to next newsletter
  const navigateToNext = useCallback(() => {
    if (!hasNext || currentIndex < 0) return;

    const nextNewsletter = newsletters[currentIndex + 1];
    if (!nextNewsletter) return;

    log.debug('Navigating to next newsletter', {
      from: currentNewsletterId,
      to: nextNewsletter.id,
      isReadingQueue,
    });

    // Preserve current URL search params (e.g., ?filter=liked)
    const targetPath = `/newsletters/${nextNewsletter.id}${location.search}`;

    // Preserve navigation state, but keep original 'from' if it was /inbox' or '/queue'
    const originalFrom =
      location.state?.from === '/inbox' || location.state?.from === '/queue'
        ? location.state.from
        : location.pathname;
    navigate(targetPath, {
      replace: false,
      state: {
        ...location.state,
        from: originalFrom,
        fromNavigation: true,
        fromReadingQueue: isReadingQueue,
        sourceId: sourceId,
        currentFilter: filter,
      },
    });
  }, [
    hasNext,
    currentIndex,
    newsletters,
    currentNewsletterId,
    isReadingQueue,
    sourceId,
    filter,
    navigate,
    location,
    log,
  ]);

  return {
    hasPrevious,
    hasNext,
    navigateToPrevious,
    navigateToNext,
    isLoading,
  };
}
