export {
  useCacheInvalidation,
  useTypedCacheInvalidation,
  setGlobalQueryClient,
  globalCacheInvalidation,
  type TypedCacheInvalidation,
} from './useCacheInvalidation';

export {
  useDebouncedNewsletterNavigation,
  useKeyboardNavigation,
  useSwipeNavigation,
  useOptimizedNewsletterNavigation,
} from './useDebouncedNewsletterNavigation';

// Re-export commonly used performance hooks from parent
export {
  usePerformanceMonitor,
  useDebouncedState,
  useThrottledCallback,
  useDebouncedCallback,
  useBatchedUpdates,
  useExpensiveComputation,
  useVirtualScrolling,
  useGenericInfiniteScroll,
  useMemoryCleanup,
  useComponentOptimizations,
} from '../usePerformanceOptimizations';
