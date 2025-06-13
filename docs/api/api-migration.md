# API Layer Migration Guide

## Overview

This document outlines the migration from direct Supabase client usage to a centralized API layer architecture. The new architecture provides better type safety, consistent error handling, performance optimization, and paginated responses.

## Migration Summary

### What Changed

1. **Centralized API Layer**: All data access now goes through dedicated API services
2. **Paginated Responses**: API endpoints return `PaginatedResponse<T>` instead of raw arrays
3. **Updated Hook Interfaces**: Hooks now use structured filter objects instead of primitive parameters
4. **Consistent Error Handling**: Standardized error handling and user-friendly messages
5. **Performance Optimizations**: Built-in caching, retry logic, and performance monitoring

### Key Benefits

- **Type Safety**: Full TypeScript support with proper interfaces
- **Consistency**: Uniform patterns across all data access
- **Performance**: Optimized queries with caching and pagination
- **Maintainability**: Centralized business logic and error handling
- **Testability**: Easier to mock and test API interactions

## New Architecture

### API Layer Structure

```
src/common/api/
├── index.ts              # Main exports and utilities
├── supabaseClient.ts     # Core Supabase client with utilities
├── newsletterApi.ts      # Newsletter operations
├── newsletterSourceApi.ts # Newsletter source operations
└── errorHandling.ts      # Error handling utilities
```

### API Service Pattern

Each API service follows a consistent pattern:

```typescript
export const entityApi = {
  // CRUD operations
  async getAll(params: QueryParams = {}): Promise<PaginatedResponse<Entity>> { ... },
  async getById(id: string): Promise<Entity | null> { ... },
  async create(params: CreateParams): Promise<Entity> { ... },
  async update(params: UpdateParams): Promise<Entity> { ... },
  async delete(id: string): Promise<boolean> { ... },
  
  // Bulk operations
  async bulkUpdate(params: BulkUpdateParams): Promise<BatchResult<Entity>> { ... },
  
  // Specialized operations
  async search(query: string): Promise<PaginatedResponse<Entity>> { ... },
  async getStats(): Promise<EntityStats> { ... },
};
```

## Hook Migration Guide

### useNewsletters Hook

#### Before (Old Pattern)
```typescript
const {
  newsletters,
  isLoadingNewsletters,
  refetchNewsletters,
} = useNewsletters(tagId, filter, sourceId);
```

#### After (New Pattern)
```typescript
const newsletterFilter = {
  isRead: filter === 'unread' ? false : undefined,
  isArchived: filter === 'archived' ? true : false,
  tagIds: tagId ? [tagId] : undefined,
  sourceIds: sourceId ? [sourceId] : undefined,
  limit: 50,
  offset: 0,
};

const {
  newsletters,
  isLoadingNewsletters,
  refetchNewsletters, // Now returns PaginatedResponse<NewsletterWithRelations>
} = useNewsletters(newsletterFilter);
```

#### Newsletter Filter Object
```typescript
interface NewsletterFilter {
  // Search and text filtering
  search?: string;
  
  // Status filters
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;
  
  // Relationship filters
  tagIds?: string[];
  sourceIds?: string[];
  
  // Date filtering
  dateFrom?: string;
  dateTo?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  orderBy?: string;
  ascending?: boolean;
}
```

### useNewsletterSources Hook

#### Before (Old Pattern)
```typescript
const {
  newsletterSources,
  isLoadingSources,
  updateSource,
  archiveNewsletterSource,
} = useNewsletterSources();
```

#### After (New Pattern)
```typescript
const queryParams = {
  excludeArchived: true,
  includeCount: true,
  orderBy: 'created_at',
  ascending: false,
};

const {
  newsletterSources,
  isLoadingSources,
  updateSource,
  archiveNewsletterSource,
  // New pagination properties
  sourcesCount,
  sourcesPage,
  sourcesHasMore,
} = useNewsletterSources(queryParams);
```

## Paginated Response Structure

All list endpoints now return paginated responses:

```typescript
interface PaginatedResponse<T> {
  data: T[];           // The actual items
  count: number;       // Total count of items
  page?: number;       // Current page number
  limit?: number;      // Items per page
  hasMore?: boolean;   // Whether more items are available
  nextPage?: number | null;  // Next page number
  prevPage?: number | null;  // Previous page number
}
```

### Accessing Data

```typescript
// Before
const newsletters = newslettersResponse || [];

// After
const newsletters = newslettersResponse?.data || [];
```

## Error Handling

### Centralized Error Handling

The API layer provides consistent error handling:

```typescript
import { handleSupabaseError, AppError } from '@common/api';

try {
  const result = await newsletterApi.getAll(params);
} catch (error) {
  // Errors are automatically transformed to user-friendly messages
  console.error('API Error:', error.message);
}
```

### Error Types

```typescript
enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  PERMISSION = 'permission',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}
```

## Direct Supabase Migration

### Replace Direct Imports

#### Before
```typescript
import { supabase } from '@common/services/supabaseClient';

// Direct Supabase usage
const { data, error } = await supabase
  .from('newsletters')
  .select('*')
  .eq('user_id', userId);
```

#### After
```typescript
import { newsletterApi } from '@common/api';

// Use API layer
const result = await newsletterApi.getAll({
  limit: 50,
  includeRelations: true,
});
const newsletters = result.data;
```

### Authentication

#### Before
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
```

#### After
```typescript
import { useAuth } from '@common/contexts';

const { user } = useAuth();
// Authentication is handled automatically in API calls
```

## Performance Optimizations

### Caching

The API layer includes intelligent caching:

```typescript
// Automatic caching with configurable stale times
const result = await newsletterApi.getAll(params); // Cached for 2 minutes
```

### Query Optimization

- **Pagination**: All list queries support pagination
- **Selective Loading**: Include only needed relations
- **Query Deduplication**: Prevents duplicate requests

```typescript
const params = {
  limit: 20,
  includeRelations: true,
  includeTags: false,  // Skip tags if not needed
  includeSource: true,
};
```

## Best Practices

### 1. Use Structured Filters

Always use filter objects instead of primitive parameters:

```typescript
// Good
const filters = {
  isRead: false,
  tagIds: selectedTags,
  limit: 25,
};

// Avoid
const newsletters = useNewsletters(tagId, 'unread', sourceId);
```

### 2. Handle Pagination

When displaying lists, consider pagination:

```typescript
const {
  newsletters,
  sourcesHasMore,
  sourcesNextPage,
} = useNewsletters(filters);

// Implement load more functionality
const loadMore = () => {
  if (sourcesHasMore && sourcesNextPage) {
    // Update filters with new page
    setFilters(prev => ({ ...prev, page: sourcesNextPage }));
  }
};
```

### 3. Error Boundaries

Implement proper error handling:

```typescript
const {
  newsletters,
  isErrorNewsletters,
  errorNewsletters,
} = useNewsletters(filters);

if (isErrorNewsletters) {
  return <ErrorMessage error={errorNewsletters} />;
}
```

### 4. Loading States

Use loading states for better UX:

```typescript
const { newsletters, isLoadingNewsletters } = useNewsletters(filters);

if (isLoadingNewsletters) {
  return <LoadingSpinner />;
}
```

## Migration Checklist

### For Components

- [ ] Remove direct `supabase` imports
- [ ] Update hook usage to use filter objects
- [ ] Handle paginated responses (access `.data` property)
- [ ] Update error handling patterns
- [ ] Add proper loading states
- [ ] Consider pagination UI if needed

### For Hooks

- [ ] Update return types to use `PaginatedResponse<T>`
- [ ] Migrate to API layer functions
- [ ] Update mutation functions to use API layer
- [ ] Add proper TypeScript interfaces
- [ ] Update cache invalidation patterns

### For API Integration

- [ ] Replace direct Supabase queries with API service calls
- [ ] Use structured parameter objects
- [ ] Handle authentication through API layer
- [ ] Implement proper error handling
- [ ] Add performance monitoring if needed

## Common Issues and Solutions

### Issue: "newsletters is undefined"

**Problem**: Trying to access newsletters array directly from hook

**Solution**: Access the `data` property from paginated response
```typescript
// Wrong
const { newsletters } = useNewsletters(filters);

// Correct
const { newsletters } = useNewsletters(filters); // Hook already extracts .data
// OR manually extract
const newslettersResponse = useNewslettersRaw(filters);
const newsletters = newslettersResponse?.data || [];
```

### Issue: Hook parameters changed

**Problem**: Old hook signature no longer works

**Solution**: Use structured filter objects
```typescript
// Before
useNewsletters(tagId, 'unread', sourceId)

// After
useNewsletters({
  tagIds: tagId ? [tagId] : undefined,
  isRead: false,
  sourceIds: sourceId ? [sourceId] : undefined,
})
```

### Issue: Missing pagination info

**Problem**: Need to implement pagination but don't have page info

**Solution**: Use pagination properties from hook response
```typescript
const {
  newsletters,
  sourcesCount,
  sourcesHasMore,
  sourcesNextPage,
} = useNewsletters(filters);
```

## Testing

### API Layer Testing

```typescript
import { newsletterApi } from '@common/api';

// Mock API responses
jest.mock('@common/api', () => ({
  newsletterApi: {
    getAll: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
  },
}));

// Test with mocked responses
const mockResponse = {
  data: [{ id: '1', title: 'Test Newsletter' }],
  count: 1,
  hasMore: false,
};

(newsletterApi.getAll as jest.Mock).mockResolvedValue(mockResponse);
```

### Hook Testing

```typescript
import { renderHook } from '@testing-library/react';
import { useNewsletters } from '@common/hooks/useNewsletters';

const { result } = renderHook(() => 
  useNewsletters({ isRead: false, limit: 10 })
);

expect(result.current.newsletters).toEqual([]);
```

## Future Considerations

1. **Real-time Updates**: Consider WebSocket integration for live updates
2. **Offline Support**: Implement offline caching and sync
3. **Performance Monitoring**: Add metrics collection for API performance
4. **API Versioning**: Plan for future API changes
5. **GraphQL Migration**: Consider GraphQL for more flexible queries

## Support

For questions or issues related to the API migration:

1. Check this documentation first
2. Review the API service implementations in `src/common/api/`
3. Look at existing component migrations for examples
4. Create an issue with specific error messages and context

## Changelog

### v1.0.0 - Initial API Layer Migration
- Added centralized API layer
- Implemented paginated responses
- Updated hooks to use structured filters
- Migrated core components
- Added comprehensive error handling