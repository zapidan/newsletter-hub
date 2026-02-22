import type { NewsletterWithRelations } from '@common/types';
import type { NewsletterFilter } from '@common/types/cache';
import { useLogger } from '@common/utils/logger/useLogger';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNewsletters } from './useNewsletters';
import { useReadingQueue } from './useReadingQueue';

interface NavigationOptions {
  isReadingQueue?: boolean;
  filter?: NewsletterFilter;
  sourceId?: string;
  originalFilter?: NewsletterFilter; // Frozen filter for navigation context
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
  const { isReadingQueue, filter, sourceId, originalFilter } = options;

  console.log('🚀 useSimpleNewsletterNavigation called:', {
    currentNewsletterId,
    options,
    isReadingQueue,
    filter: JSON.stringify(filter),
    sourceId
  });

  log.debug('Navigation options:', { isReadingQueue, filter: JSON.stringify(filter), sourceId });

  // Get newsletters based on context
  const readingQueueQuery = useReadingQueue();

  // For navigation, we need newsletters that match the current filter context
  // This ensures navigation works correctly whether user is viewing archived, unarchived, or filtered newsletters
  // Navigation should work for ANY filter context - no default exclusions
  // Use originalFilter if provided to maintain frozen navigation context, otherwise use current filter
  const navigationFilter = originalFilter || filter;
  const allNewslettersQuery = useNewsletters(navigationFilter || {}, {
    enabled: !isReadingQueue,
  });

  // Get newsletters from data source - use ALL newsletters for navigation
  const newsletters = useMemo(() => {
    if (isReadingQueue) {
      log.debug('Using reading queue for newsletters:', readingQueueQuery.readingQueue);
      return readingQueueQuery.readingQueue?.map((item) => item.newsletter) || [];
    } else {
      log.debug('Using all newsletters query:', allNewslettersQuery.newsletters);
      const newsletters = allNewslettersQuery.newsletters || [];
      log.debug('All newsletters returned:', newsletters.map(n => ({ id: n.id, title: n.title, is_read: n.is_read, is_archived: n.is_archived })));
      return newsletters;
    }
  }, [isReadingQueue, readingQueueQuery.readingQueue, allNewslettersQuery.newsletters, log]);

  log.debug('Processed newsletters for navigation:', newsletters);

  const isLoading = isReadingQueue ? readingQueueQuery.isLoading : allNewslettersQuery.isLoadingNewsletters;

  // Find current newsletter index and debug navigation state
  const currentIndex = useMemo(() => {
    if (!currentNewsletterId || !newsletters.length) {
      log.debug('Navigation debug: No current newsletter ID or empty newsletters array', {
        currentNewsletterId,
        newslettersCount: newsletters.length,
        isReadingQueue,
        isLoading,
      });
      return -1;
    }

    // Don't calculate index if still loading
    if (isLoading) {
      log.debug('Navigation debug: Still loading, skipping index calculation', {
        currentNewsletterId,
        newslettersCount: newsletters.length,
        isReadingQueue,
        isLoading,
      });
      return -1;
    }

    const index = newsletters.findIndex((n: NewsletterWithRelations) => n.id === currentNewsletterId);
    log.debug('Navigation debug: Current index calculation', {
      currentNewsletterId,
      newslettersCount: newsletters.length,
      foundIndex: index,
      newsletterIds: newsletters.map(n => n.id),
      isReadingQueue,
      isLoading,
    });
    return index;
  }, [currentNewsletterId, newsletters, isReadingQueue, isLoading, log]);

  // Determine if there are previous/next newsletters and debug
  const hasPrevious = currentIndex > 0 || (currentIndex === -1 && newsletters.length > 0);
  const hasNext = (currentIndex >= 0 && currentIndex < newsletters.length - 1) || (currentIndex === -1 && newsletters.length > 0);

  console.log('🔍 Navigation state debug:', {
    currentNewsletterId,
    currentIndex,
    newslettersCount: newsletters.length,
    hasPrevious,
    hasNext,
    isReadingQueue,
    isLoading,
    newsletterIds: newsletters.map(n => n.id),
  });

  // Debug navigation state
  useEffect(() => {
    log.debug('Navigation state update', {
      currentNewsletterId,
      currentIndex,
      newslettersCount: newsletters.length,
      hasPrevious,
      hasNext,
      isReadingQueue,
      isLoading,
      newsletterIds: newsletters.map(n => n.id),
    });
  }, [currentNewsletterId, currentIndex, newsletters, hasPrevious, hasNext, isReadingQueue, isLoading, log]);

  // Navigate to previous newsletter
  const navigateToPrevious = useCallback(() => {
    console.log('🚀 navigateToPrevious called', { hasPrevious, currentIndex, newslettersCount: newsletters.length });
    if (!hasPrevious) {
      console.log('❌ navigateToPrevious blocked', { hasPrevious, currentIndex });
      return;
    }

    const previousNewsletter = currentIndex === -1
      ? newsletters[newsletters.length - 1] // Go to last newsletter if current is not in list
      : newsletters[currentIndex - 1];

    if (!previousNewsletter) {
      console.log('❌ No previous newsletter found');
      return;
    }

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
    console.log('🚀 navigateToNext called', { hasNext, currentIndex, newslettersCount: newsletters.length });
    if (!hasNext) {
      console.log('❌ navigateToNext blocked', { hasNext, currentIndex });
      return;
    }

    const nextNewsletter = currentIndex === -1
      ? newsletters[0] // Go to first newsletter if current is not in list
      : newsletters[currentIndex + 1];

    if (!nextNewsletter) {
      console.log('❌ No next newsletter found');
      return;
    }

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
