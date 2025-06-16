# Infinite Scroll Implementation Documentation

## Overview

This document describes the implementation of infinite scroll functionality for the Newsletter Hub inbox page. The implementation follows a clean architecture pattern with proper separation of business logic and presentation logic.

## Architecture

### Business Logic Layer

The business logic is encapsulated in custom hooks that handle data fetching, pagination state, and scroll detection:

#### 1. `useInfiniteScroll` Hook

**Location**: `src/common/hooks/infiniteScroll/useInfiniteScroll.ts`

**Purpose**: Manages scroll detection using Intersection Observer API

**Key Features**:
- Uses Intersection Observer for efficient scroll detection
- Configurable threshold and root margin
- Prevents duplicate load triggers
- Handles enabled/disabled states
- Tracks intersection state and end-of-list status

**Interface**:
```typescript
interface InfiniteScrollOptions {
  threshold?: number;        // Intersection threshold (default: 0.1)
  rootMargin?: string;       // Root margin for early triggering (default: '100px')
  enabled?: boolean;         // Enable/disable scroll detection
  hasNextPage?: boolean;     // Whether more data is available
  isFetchingNextPage?: boolean; // Whether currently loading
  onLoadMore?: () => void;   // Callback when load more is triggered
}
```

#### 2. `useInfiniteNewsletters` Hook

**Location**: `src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts`

**Purpose**: Manages infinite loading of newsletter data with pagination

**Key Features**:
- Built on React Query's `useInfiniteQuery`
- Automatic page management and data flattening
- Configurable page size and caching
- Error handling and retry logic
- Debug logging support
- Metadata tracking (total count, current page)

**Interface**:
```typescript
interface UseInfiniteNewslettersReturn {
  newsletters: NewsletterWithRelations[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  totalCount: number;
  pageCount: number;
  currentPage: number;
}
```

### Presentation Layer

The presentation logic is handled by React components that consume the business logic hooks:

#### 1. `LoadingSentinel` Component

**Location**: `src/web/components/InfiniteScroll/LoadingSentinel.tsx`

**Purpose**: Displays loading states at the bottom of the infinite scroll list

**Features**:
- Loading spinner with progress information
- End-of-list indicator with count summary
- Error state with retry button
- Invisible sentinel for intersection observer

#### 2. `InfiniteNewsletterList` Component

**Location**: `src/web/components/InfiniteScroll/InfiniteNewsletterList.tsx`

**Purpose**: Main container component that orchestrates infinite scroll functionality

**Features**:
- Combines `useInfiniteScroll` with newsletter data
- Renders newsletter rows with proper actions
- Handles loading, error, and empty states
- Optimized re-rendering with memoization
- Flexible configuration options

## Implementation Details

### Data Flow

1. **Initial Load**: `useInfiniteNewsletters` fetches the first page of newsletters
2. **Scroll Detection**: `useInfiniteScroll` monitors scroll position using Intersection Observer
3. **Load More Trigger**: When sentinel element enters viewport, `onLoadMore` callback is triggered
4. **Pagination**: `useInfiniteNewsletters` fetches the next page and appends to existing data
5. **State Updates**: Components re-render with updated data and loading states

### Query Key Management

The implementation extends the existing `queryKeyFactory` to support infinite queries:

```typescript
// Added to queryKeyFactory.newsletters
infinites: () => [...queryKeyFactory.newsletters.all(), "infinite"] as const,
infinite: (filter: NewsletterFilter) => {
  // Builds cache key with normalized filters
  return [...baseKey, filters] as const;
}
```

### Performance Optimizations

1. **Intersection Observer**: More efficient than scroll event listeners
2. **Query Caching**: React Query handles intelligent caching and background updates
3. **Memoization**: Components use `useMemo` and `useCallback` to prevent unnecessary re-renders
4. **Stable Keys**: Newsletter list maintains stable keys for React reconciliation
5. **Configurable Page Size**: Default 25 items per page for optimal performance

### Error Handling

The implementation includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **UI Error States**: User-friendly error messages with retry buttons
- **Graceful Degradation**: Existing newsletters remain visible on fetch errors
- **Debug Logging**: Detailed logging in development mode

## Usage

### Basic Implementation

```typescript
import { useInfiniteNewsletters } from '@common/hooks/infiniteScroll';
import { InfiniteNewsletterList } from '@web/components/InfiniteScroll';

const MyInboxPage = () => {
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

  return (
    <InfiniteNewsletterList
      newsletters={newsletters}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasNextPage={hasNextPage}
      totalCount={totalCount}
      error={error}
      onLoadMore={fetchNextPage}
      // ... other props
    />
  );
};
```

### Configuration Options

#### Infinite Scroll Options
- `threshold`: How much of the sentinel must be visible (0.0 to 1.0)
- `rootMargin`: Distance from viewport edge to trigger loading
- `pageSize`: Number of items to load per page
- `staleTime`: How long cached data remains fresh

#### Performance Tuning
- Larger `pageSize` reduces API calls but increases initial load time
- Smaller `rootMargin` loads content closer to when needed
- Higher `staleTime` reduces background refetches

## Migration from Pagination

The infinite scroll implementation is designed to be a drop-in replacement for the existing pagination-based inbox:

### Before (Pagination)
```typescript
const { newsletters, isLoading, error } = useNewsletters(filters);
```

### After (Infinite Scroll)
```typescript
const {
  newsletters,
  isLoading,
  isLoadingMore,
  hasNextPage,
  fetchNextPage,
  error
} = useInfiniteNewsletters(filters);
```

The existing `Inbox.tsx` has been updated to use infinite scroll, with the old pagination version preserved as `InboxOldPagination.tsx`.

## API Requirements

The infinite scroll implementation requires the API to support:

1. **Limit/Offset Pagination**: `limit` and `offset` parameters
2. **Total Count**: Response must include total item count
3. **Has More Flag**: Response should indicate if more data is available
4. **Consistent Ordering**: Results must be consistently ordered across pages

Example API response:
```typescript
interface PaginatedResponse<T> {
  data: T[];
  count: number;        // Total items available
  hasMore: boolean;     // Whether more pages exist
  limit?: number;       // Items per page
  offset?: number;      // Current offset
}
```

## Testing Considerations

### Unit Tests
- Test scroll detection logic with mocked Intersection Observer
- Test pagination state management
- Test error handling and retry logic

### Integration Tests
- Test complete scroll-to-load flow
- Test filter changes and data refetching
- Test network failure scenarios

### Performance Tests
- Measure memory usage with large datasets
- Test smooth scrolling performance
- Monitor API call frequency

## Future Enhancements

### Potential Improvements
1. **Virtual Scrolling**: For very large datasets (1000+ items)
2. **Bi-directional Loading**: Load older content when scrolling up
3. **Prefetching**: Preload next page before user scrolls
4. **Skeleton Loading**: Show placeholder content while loading
5. **Progressive Enhancement**: Fallback to pagination for accessibility

### Analytics Integration
- Track scroll depth and engagement
- Monitor load times and error rates
- A/B test different page sizes and loading strategies

## Troubleshooting

### Common Issues

1. **Duplicate Loads**: Ensure `loadTriggeredRef` is working correctly
2. **Missing Intersection Observer**: Add polyfill for older browsers
3. **Memory Leaks**: Verify observer cleanup in useEffect
4. **Stale Data**: Check query invalidation after mutations
5. **Slow Loading**: Optimize API queries and consider pagination size

### Debug Mode

Enable debug logging by setting `debug: true` in hook options:

```typescript
const { ... } = useInfiniteNewsletters(filters, { debug: true });
```

This will log:
- Page fetch requests and responses
- Newsletter counts and pagination state
- Load more trigger events
- Error details and retry attempts

## Conclusion

The infinite scroll implementation provides a modern, performant user experience while maintaining clean separation of concerns. The architecture is extensible and can be adapted for other list-based components in the application.

The implementation follows React and performance best practices, includes comprehensive error handling, and provides flexibility for future enhancements.