# Newsletter Performance Optimizations

This directory contains optimized hooks and utilities for improving the performance of the newsletter application. These optimizations focus on reducing database queries, minimizing unnecessary re-renders, and providing a smoother user experience.

## Overview

The performance optimizations address the following key areas:

1. **Cache Invalidation**: Smart, batched, and debounced cache invalidation
2. **Navigation**: Debounced navigation with preloading and performance tracking
3. **State Management**: Optimized state updates and batching
4. **User Interaction**: Keyboard and swipe navigation support

## Key Features

### 🚀 Optimized Cache Invalidation

The `useCacheInvalidation` hook provides intelligent cache management with:

- **Batched Invalidations**: Groups multiple cache invalidations within a time window
- **Debounced Updates**: Prevents rapid cache refreshes for frequently changing data
- **Operation-Based Invalidation**: Smart invalidation based on the type of operation
- **Type-Safe Methods**: Strongly typed cache invalidation methods

### ⚡ Debounced Navigation

The `useDebouncedNewsletterNavigation` hook offers:

- **Navigation Debouncing**: Prevents rapid navigation that could cause performance issues
- **Preloading**: Automatically preloads adjacent newsletters for instant navigation
- **Keyboard Support**: Arrow keys and letter shortcuts (p/n) for navigation
- **Swipe Support**: Touch gestures for mobile navigation
- **Performance Metrics**: Tracks navigation patterns and performance

## Usage

### Basic Cache Invalidation

```typescript
import { useCacheInvalidation } from '@common/hooks/performance';

function MyComponent() {
  const { invalidateByOperation, getMetrics } = useCacheInvalidation({
    batchDelay: 100,      // Batch window in ms
    debounceDelay: 500,   // Debounce delay in ms
    enableLogging: true,  // Enable debug logging
  });

  const handleArchive = async (newsletterId: string) => {
    // Perform archive operation
    await archiveNewsletter(newsletterId);
    
    // Smart cache invalidation based on operation
    await invalidateByOperation('newsletter-archive', newsletterId);
  };

  // Check performance metrics
  const metrics = getMetrics();
  console.log(`Total invalidations: ${metrics.totalInvalidations}`);
}
```

### Type-Safe Cache Invalidation

```typescript
import { useTypedCacheInvalidation } from '@common/hooks/performance';

function MyComponent() {
  const cache = useTypedCacheInvalidation();

  // Type-safe methods
  await cache.newsletter('newsletter-123');  // Invalidate specific newsletter
  cache.newsletters();                        // Invalidate newsletter list (debounced)
  cache.unreadCount();                       // Invalidate unread count (debounced)
  cache.tags();                              // Invalidate tags (debounced)
}
```

### Optimized Navigation

```typescript
import { useOptimizedNewsletterNavigation } from '@common/hooks/performance';

function NewsletterDetail() {
  const { id } = useParams();
  
  const navigation = useOptimizedNewsletterNavigation(id, {
    debounceDelay: 300,
    enablePreloading: true,
    enableKeyboard: true,
    enableSwipe: true,
    onNavigationComplete: (newsletterId) => {
      console.log(`Navigated to ${newsletterId}`);
    },
  });

  return (
    <div>
      <button 
        onClick={navigation.navigateToPrevious}
        disabled={!navigation.navigationState.hasPrevious}
      >
        Previous
      </button>
      
      <span>
        {navigation.navigationState.currentIndex + 1} of {navigation.navigationState.totalCount}
      </span>
      
      <button 
        onClick={navigation.navigateToNext}
        disabled={!navigation.navigationState.hasNext}
      >
        Next
      </button>
    </div>
  );
}
```

## Operation Types

The cache invalidation system recognizes the following operation types:

| Operation | Description | Cache Updates |
|-----------|-------------|---------------|
| `newsletter-archive` | Archive a newsletter | Newsletter detail, list, unread count |
| `newsletter-unarchive` | Unarchive a newsletter | Newsletter detail, list, unread count |
| `newsletter-like` | Like a newsletter | Newsletter detail, list |
| `newsletter-unlike` | Unlike a newsletter | Newsletter detail, list |
| `newsletter-mark-read` | Mark as read | Newsletter detail, unread count |
| `newsletter-mark-unread` | Mark as unread | Newsletter detail, unread count |
| `newsletter-tag-add` | Add tag to newsletter | Newsletter detail, tags, list |
| `newsletter-tag-remove` | Remove tag from newsletter | Newsletter detail, tags, list |
| `tag-create` | Create a new tag | Tags, newsletter list |
| `tag-update` | Update a tag | Tags, newsletter list |
| `tag-delete` | Delete a tag | Tags, newsletter list |
| `bulk-operation` | Bulk newsletter operations | Uses batched invalidation |

## Performance Metrics

Both hooks provide performance metrics for monitoring:

### Cache Metrics

```typescript
const { getMetrics } = useCacheInvalidation();
const metrics = getMetrics();

// Available metrics:
// - totalInvalidations: Total number of cache invalidations
// - batchedInvalidations: Number of invalidations that were batched
// - debouncedInvalidations: Number of debounced invalidations
// - pendingBatchSize: Current size of pending batch
// - lastInvalidation: Timestamp of last invalidation
```

### Navigation Metrics

```typescript
const navigation = useOptimizedNewsletterNavigation(id);
const metrics = navigation.metrics;

// Available metrics:
// - totalNavigations: Total number of navigations
// - preventedNavigations: Number of prevented rapid navigations
// - lastNavigation: Timestamp of last navigation
// - averageNavigationTime: Average time per navigation
```

## Best Practices

### 1. Use Operation-Based Invalidation

Instead of manually invalidating multiple caches, use operation-based invalidation:

```typescript
// ❌ Avoid
await queryClient.invalidateQueries(['newsletter', id]);
await queryClient.invalidateQueries(['newsletters']);
await queryClient.invalidateQueries(['unreadCount']);

// ✅ Prefer
await invalidateByOperation('newsletter-archive', id);
```

### 2. Leverage Debouncing for Frequent Updates

For operations that happen frequently, use debounced invalidation:

```typescript
const cache = useTypedCacheInvalidation();

// These are automatically debounced
cache.newsletters();    // Won't trigger multiple times within 500ms
cache.unreadCount();   // Batches multiple calls
```

### 3. Enable Preloading for Better UX

Always enable preloading for navigation to ensure smooth transitions:

```typescript
const navigation = useOptimizedNewsletterNavigation(id, {
  enablePreloading: true,  // Preloads adjacent newsletters
});
```

### 4. Monitor Performance in Development

Use the built-in metrics to identify performance issues:

```typescript
if (process.env.NODE_ENV === 'development') {
  const cacheMetrics = getCacheMetrics();
  const navMetrics = navigation.metrics;
  
  console.log('Performance Report:', {
    cache: cacheMetrics,
    navigation: navMetrics,
  });
}
```

## Migration Guide

### From Direct Cache Invalidation

```typescript
// Before
const handleArchive = async (newsletter) => {
  await archiveNewsletter(newsletter.id);
  queryClient.invalidateQueries(['newsletter', newsletter.id]);
  queryClient.invalidateQueries(['newsletters']);
  queryClient.invalidateQueries(['unreadCount']);
};

// After
const { invalidateByOperation } = useCacheInvalidation();

const handleArchive = async (newsletter) => {
  await archiveNewsletter(newsletter.id);
  await invalidateByOperation('newsletter-archive', newsletter.id);
};
```

### From Basic Navigation

```typescript
// Before
const navigate = useNavigate();
const handleNext = () => {
  const nextId = findNextNewsletter(currentId);
  navigate(`/newsletters/${nextId}`);
};

// After
const navigation = useOptimizedNewsletterNavigation(currentId);
const handleNext = () => navigation.navigateToNext();
```

## Testing

The performance hooks come with comprehensive test suites. When testing components that use these hooks:

```typescript
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('cache invalidation', async () => {
  const { result } = renderHook(
    () => useCacheInvalidation(),
    { wrapper: createWrapper() }
  );
  
  await act(async () => {
    await result.current.invalidateByOperation('newsletter-archive', '123');
  });
  
  expect(result.current.getMetrics().totalInvalidations).toBe(1);
});
```

## Troubleshooting

### Cache Not Updating

If cache isn't updating as expected:

1. Check that you're using the correct operation type
2. Verify that debouncing isn't delaying the update
3. Use `flush()` to force process pending batches

```typescript
const { flush } = useCacheInvalidation();
await flush(); // Forces all pending invalidations
```

### Navigation Not Working

If navigation isn't responding:

1. Check `canNavigate` state
2. Verify that debounce delay isn't too high
3. Ensure navigation state is properly loaded

```typescript
const navigation = useOptimizedNewsletterNavigation(id, {
  debounceDelay: 100, // Lower delay for more responsive navigation
});

if (!navigation.canNavigate) {
  console.log('Navigation is currently blocked');
}
```

## Future Enhancements

- [ ] Predictive preloading based on user patterns
- [ ] Cache warming strategies
- [ ] Performance budgets and alerts
- [ ] Advanced batching strategies
- [ ] Network-aware optimizations

## Contributing

When adding new performance optimizations:

1. Measure the impact with before/after metrics
2. Add comprehensive tests
3. Document the optimization strategy
4. Update this README with usage examples