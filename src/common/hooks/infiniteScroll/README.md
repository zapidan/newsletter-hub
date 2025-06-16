# Infinite Scroll Hooks

This directory contains the business logic for infinite scroll functionality in the Newsletter Hub application.

## Overview

The infinite scroll implementation provides a smooth, performant way to load newsletters progressively as the user scrolls, replacing the traditional pagination approach with a modern infinite loading experience.

## Hooks

### `useInfiniteScroll`

**Purpose**: Handles scroll detection and load triggering using the Intersection Observer API.

**Key Features**:
- Efficient scroll detection without scroll event listeners
- Configurable intersection threshold and root margin
- Prevents duplicate load calls
- Tracks intersection and end-of-list states
- Automatic cleanup and observer management

**Usage**:
```typescript
const { sentinelRef, isIntersecting, hasReachedEnd } = useInfiniteScroll({
  threshold: 0.1,
  rootMargin: '100px',
  enabled: !isLoading,
  hasNextPage,
  isFetchingNextPage: isLoadingMore,
  onLoadMore: fetchNextPage,
});
```

### `useInfiniteNewsletters`

**Purpose**: Manages infinite loading of newsletter data with React Query.

**Key Features**:
- Built on `useInfiniteQuery` for optimal caching
- Automatic page management and data flattening
- Configurable page size and stale time
- Error handling with retry logic
- Debug logging support
- Metadata tracking (total count, current page)

**Usage**:
```typescript
const {
  newsletters,
  isLoading,
  isLoadingMore,
  hasNextPage,
  fetchNextPage,
  error,
  totalCount
} = useInfiniteNewsletters(filters, {
  pageSize: 25,
  staleTime: 30000,
  debug: process.env.NODE_ENV === 'development'
});
```

## Architecture

### Separation of Concerns

- **Business Logic**: Hooks handle data fetching, state management, and scroll detection
- **Presentation Logic**: Components consume hooks and handle UI rendering
- **Cache Management**: React Query handles intelligent caching and background updates

### Performance Optimizations

1. **Intersection Observer**: More efficient than scroll listeners
2. **Query Caching**: Intelligent cache invalidation and updates
3. **Memoization**: Prevents unnecessary re-renders
4. **Configurable Page Size**: Balance between performance and UX

## Integration

The hooks are designed to work seamlessly with existing Newsletter Hub components:

```typescript
// In your inbox component
import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll';
import { InfiniteNewsletterList } from '@web/components/InfiniteScroll';

const InboxPage = () => {
  const infiniteData = useInfiniteNewsletters(filters);
  
  return (
    <InfiniteNewsletterList
      {...infiniteData}
      onLoadMore={infiniteData.fetchNextPage}
      // ... other props
    />
  );
};
```

## Configuration

### Default Settings

- **Page Size**: 25 newsletters per page
- **Threshold**: 0.1 (10% of sentinel must be visible)
- **Root Margin**: '100px' (trigger 100px before sentinel is visible)
- **Stale Time**: 30 seconds
- **Retry Attempts**: 3 with exponential backoff

### Customization

All settings can be customized based on your needs:

```typescript
// Larger pages for faster loading
useInfiniteNewsletters(filters, { pageSize: 50 });

// Earlier triggering for slower connections
useInfiniteScroll({ rootMargin: '200px' });

// Longer cache time for stable data
useInfiniteNewsletters(filters, { staleTime: 300000 }); // 5 minutes
```

## Error Handling

The implementation includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Loading States**: Clear indication of loading and error states
- **Graceful Degradation**: Existing data remains visible on errors
- **User Actions**: Retry buttons for manual error recovery

## Testing

Tests are included for the core business logic:

- **Intersection Observer**: Mocked and tested for all scenarios
- **Load Triggering**: Verified correct conditions for loading
- **State Management**: Tested state transitions and updates
- **Error Handling**: Verified error states and recovery

Run tests with:
```bash
npm test -- useInfiniteScroll
```

## Migration

To migrate from pagination to infinite scroll:

1. Replace `useNewsletters` with `useInfiniteNewsletters`
2. Replace pagination components with `InfiniteNewsletterList`
3. Update any direct pagination logic to use infinite scroll patterns

The hooks maintain backward compatibility with existing filter and newsletter action patterns.

## Browser Support

- **Modern Browsers**: Full support with native Intersection Observer
- **Legacy Browsers**: Requires Intersection Observer polyfill
- **Accessibility**: Maintains keyboard navigation and screen reader support

## Performance Considerations

- Monitor memory usage with large datasets (1000+ items)
- Consider virtual scrolling for extremely large lists
- Test on slower devices and connections
- Monitor API call frequency and response times

## Future Enhancements

- Virtual scrolling for very large datasets
- Bi-directional loading (load older content when scrolling up)
- Prefetching next page before user scrolls
- Progressive enhancement with pagination fallback