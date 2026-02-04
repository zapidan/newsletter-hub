# NewsletterHub API Guide

A comprehensive guide to using the NewsletterHub API layer for consistent, reliable, and maintainable data access.

## Table of Contents

- [Quick Start](#quick-start)
- [API Services Overview](#api-services-overview)
- [Core Concepts](#core-concepts)
- [Usage Examples](#usage-examples)
- [React Integration](#react-integration)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Installation & Setup

The API layer is already integrated into the NewsletterHub application. Simply import the services you need:

```typescript
import { newsletterApi } from '@common/api/newsletterApi';
import { tagApi } from '@common/api/tagApi';
import { userApi } from '@common/api/userApi';
```

### Basic Example

```typescript
// Fetch all newsletters
const newsletters = await newsletterApi.getAll();

// Create a new newsletter
const newNewsletter = await newsletterApi.create({
  title: 'My Newsletter',
  content: 'Newsletter content...',
});

// Update a newsletter
const updatedNewsletter = await newsletterApi.update({
  id: newsletterId,
  is_read: true,
});
```

### React Hook Example

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { newsletterApi } from '@common/api/newsletterApi';

const NewsletterList = () => {
  const queryClient = useQueryClient();

  // Fetch newsletters
  const { data: newsletters, isLoading, error } = useQuery({
    queryKey: ['newsletters'],
    queryFn: () => newsletterApi.getAll(),
  });

  // Create newsletter mutation
  const createMutation = useMutation({
    mutationFn: newsletterApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['newsletters']);
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading newsletters</div>;

  return (
    <div>
      {newsletters?.data.map(newsletter => (
        <div key={newsletter.id}>{newsletter.title}</div>
      ))}
    </div>
  );
};
```

## API Services Overview

### Available Services

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `newsletterApi` | Newsletter CRUD operations | `getAll`, `getById`, `create`, `update`, `delete` |
| `tagApi` | Tag management and associations | `getAll`, `create`, `update`, `delete`, `getTagUsageStats` |
| `readingQueueApi` | Reading queue operations | `getAll`, `add`, `remove`, `reorder` |
| `userApi` | User profile and settings | `getProfile`, `updateProfile`, `getEmailAlias` |
| `newsletterSourceApi` | Newsletter source management | `getAll`, `create`, `update`, `delete` |
| `newsletterSourceGroupApi` | Source group management | `getAll`, `create`, `update`, `delete` |

### Service Architecture

```
Components/Hooks → API Services → Enhanced Supabase Client → Database
```

Each API service provides:
- ✅ **Authentication**: Automatic user authentication
- ✅ **Error Handling**: Consistent error processing
- ✅ **Performance Monitoring**: Operation timing and logging
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Data Transformation**: Clean, consistent data structures

## Core Concepts

### Authentication

All API services automatically handle user authentication:

```typescript
// ✅ API service handles authentication
const newsletters = await newsletterApi.getAll();

// ❌ Don't manually check authentication
const user = await getCurrentUser();
if (!user) throw new Error('Not authenticated');
const newsletters = await newsletterApi.getAll();
```

### Error Handling

API services use consistent error handling patterns:

```typescript
try {
  const newsletter = await newsletterApi.getById(id);
} catch (error) {
  // Error is already processed and includes helpful context
  console.error('Failed to load newsletter:', error.message);
}
```

### Performance Monitoring

All operations are automatically monitored:

```typescript
// Performance is logged automatically
const newsletters = await newsletterApi.getAll();
// Console: "newsletters.getAll completed in 145ms"
```

### Data Transformation

API services return clean, transformed data:

```typescript
const newsletter = await newsletterApi.getById(id, true);
// Returns NewsletterWithRelations type with:
// - Clean property names
// - Properly typed relations
// - Consistent null handling
```

## Usage Examples

### Newsletter Operations

#### Fetching Newsletters

```typescript
// Get all newsletters
const allNewsletters = await newsletterApi.getAll();

// Get with filters
const unreadNewsletters = await newsletterApi.getAll({
  isRead: false,
  isArchived: false,
  limit: 20,
});

// Get with relations
const newslettersWithTags = await newsletterApi.getAll({
  includeTags: true,
  includeSource: true,
});

// Search newsletters
const searchResults = await newsletterApi.search('important');

// Get by tag
const taggedNewsletters = await newsletterApi.getByTag(tagId);

// Get by source
const sourceNewsletters = await newsletterApi.getBySource(sourceId);
```

#### Creating Newsletters

```typescript
// Basic creation
const newsletter = await newsletterApi.create({
  title: 'Newsletter Title',
  content: 'Content here...',
  summary: 'Brief summary',
  newsletter_source_id: sourceId,
});

// Create with tags
const newsletterWithTags = await newsletterApi.create({
  title: 'Tagged Newsletter',
  content: 'Content...',
  tag_ids: [tagId1, tagId2],
});
```

#### Updating Newsletters

```typescript
// Basic update
const updated = await newsletterApi.update({
  id: newsletterId,
  title: 'Updated Title',
});

// Update with tags
const updatedWithTags = await newsletterApi.update({
  id: newsletterId,
  title: 'Updated Title',
  tag_ids: [newTagId1, newTagId2],
});

// Convenience methods
await newsletterApi.markAsRead(id);
await newsletterApi.markAsUnread(id);
await newsletterApi.toggleArchive(id);
await newsletterApi.toggleLike(id);
await newsletterApi.toggleBookmark(id);
```

#### Bulk Operations

```typescript
// Bulk update
const result = await newsletterApi.bulkUpdate({
  ids: [id1, id2, id3],
  updates: { is_read: true },
});

// Handle partial failures
result.results.forEach((newsletter, index) => {
  if (!newsletter) {
    console.error(`Failed to update ${result.ids[index]}:`, result.errors[index]);
  }
});

// Bulk archive
await newsletterApi.bulkArchive([id1, id2, id3]);

// Bulk unarchive
await newsletterApi.bulkUnarchive([id1, id2, id3]);
```

### Tag Operations

#### Basic Tag Management

```typescript
// Get all tags
const tags = await tagApi.getAll();

// Get tag with usage stats
const tagsWithStats = await tagApi.getTagUsageStats();

// Create tag
const newTag = await tagApi.create({
  name: 'Important',
  color: '#ff0000',
});

// Update tag
const updatedTag = await tagApi.update({
  id: tagId,
  name: 'Very Important',
  color: '#ff6600',
});

// Delete tag
await tagApi.delete(tagId);
```

#### Tag Associations

```typescript
// Get tags for a newsletter
const newsletterTags = await tagApi.getTagsForNewsletter(newsletterId);

// Update newsletter tags
await tagApi.updateNewsletterTags(newsletterId, [tag1, tag2, tag3]);

// Add single tag to newsletter
await tagApi.addToNewsletter(newsletterId, tagId);

// Remove tag from newsletter
await tagApi.removeFromNewsletter(newsletterId, tagId);
```

#### Advanced Tag Operations

```typescript
// Get or create tag by name
const tag = await tagApi.getOrCreate('New Category', '#00ff00');

// Bulk create tags
const newTags = await tagApi.bulkCreate([
  { name: 'Work', color: '#0000ff' },
  { name: 'Personal', color: '#00ff00' },
]);

// Search tags
const foundTags = await tagApi.search('import');

// Paginated tags
const paginatedTags = await tagApi.getPaginated({
  limit: 20,
  offset: 0,
  search: 'work',
  orderBy: 'name',
});
```

### User Operations

```typescript
// Get user profile
const profile = await userApi.getProfile();

// Update profile
const updatedProfile = await userApi.updateProfile({
  display_name: 'John Doe',
  preferences: { theme: 'dark' },
});

// Get email alias
const emailAlias = await userApi.getEmailAlias();

// Generate new email alias
const newAlias = await userApi.generateEmailAlias();
```

### Reading Queue Operations

```typescript
// Get reading queue
const queueItems = await readingQueueApi.getAll();

// Add to queue
await readingQueueApi.add({
  newsletter_id: newsletterId,
  position: 1,
});

// Remove from queue
await readingQueueApi.remove(queueItemId);

// Reorder queue
await readingQueueApi.reorder([
  { id: item1Id, position: 1 },
  { id: item2Id, position: 2 },
]);

// Clear queue
await readingQueueApi.clear();
```

## React Integration

### Basic Query Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { newsletterApi } from '@common/api/newsletterApi';

const useNewsletters = (params?: NewsletterQueryParams) => {
  return useQuery({
    queryKey: ['newsletters', params],
    queryFn: () => newsletterApi.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Usage
const { data, isLoading, error } = useNewsletters({
  isRead: false,
  limit: 20,
});
```

### Mutation Hook

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { newsletterApi } from '@common/api/newsletterApi';

const useCreateNewsletter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: newsletterApi.create,
    onSuccess: (newNewsletter) => {
      // Invalidate newsletters list
      queryClient.invalidateQueries(['newsletters']);
      
      // Update cache with new newsletter
      queryClient.setQueryData(['newsletter', newNewsletter.id], newNewsletter);
    },
    onError: (error) => {
      console.error('Failed to create newsletter:', error);
    },
  });
};

// Usage
const createMutation = useCreateNewsletter();

const handleCreate = () => {
  createMutation.mutate({
    title: 'New Newsletter',
    content: 'Content...',
  });
};
```

### Complex Hook with Multiple Operations

```typescript
const useNewsletterActions = (id: string) => {
  const queryClient = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: () => newsletterApi.markAsRead(id),
    onSuccess: (updatedNewsletter) => {
      queryClient.setQueryData(['newsletter', id], updatedNewsletter);
      queryClient.invalidateQueries(['newsletters']);
    },
  });

  const toggleArchive = useMutation({
    mutationFn: () => newsletterApi.toggleArchive(id),
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries(['newsletter', id]);
      const previousData = queryClient.getQueryData(['newsletter', id]);
      
      queryClient.setQueryData(['newsletter', id], (old: any) => ({
        ...old,
        is_archived: !old.is_archived,
      }));

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update
      queryClient.setQueryData(['newsletter', id], context?.previousData);
    },
  });

  return { markAsRead, toggleArchive };
};
```

### Infinite Query for Pagination

```typescript
const useInfiniteNewsletters = (params?: NewsletterQueryParams) => {
  return useInfiniteQuery({
    queryKey: ['newsletters', 'infinite', params],
    queryFn: ({ pageParam = 0 }) =>
      newsletterApi.getAll({
        ...params,
        offset: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.data.length : undefined;
    },
  });
};

// Usage
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteNewsletters();
```

## Error Handling

### API Error Types

The API layer throws structured errors with helpful context:

```typescript
try {
  await newsletterApi.getById('non-existent-id');
} catch (error) {
  // Error includes:
  // - message: Human-readable description
  // - code: Error code for programmatic handling
  // - details: Additional context
  console.log(error.message); // "Newsletter not found"
  console.log(error.code); // "NOT_FOUND"
}
```

### Error Handling Patterns

#### Component-Level Error Handling

```typescript
const NewsletterDetails = ({ id }: { id: string }) => {
  const { data: newsletter, error } = useQuery({
    queryKey: ['newsletter', id],
    queryFn: () => newsletterApi.getById(id),
  });

  if (error) {
    if (error.message.includes('not found')) {
      return <NotFoundMessage />;
    }
    return <ErrorMessage message="Failed to load newsletter" />;
  }

  return <div>{newsletter?.title}</div>;
};
```

#### Mutation Error Handling

```typescript
const useUpdateNewsletter = () => {
  return useMutation({
    mutationFn: newsletterApi.update,
    onError: (error, variables) => {
      if (error.message.includes('validation')) {
        toast.error('Please check your input');
      } else if (error.message.includes('permission')) {
        toast.error('You do not have permission to update this newsletter');
      } else {
        toast.error('Failed to update newsletter');
      }
    },
  });
};
```

#### Global Error Boundary

```typescript
class APIErrorBoundary extends React.Component {
  componentDidCatch(error: Error) {
    if (error.message.includes('not authenticated')) {
      // Redirect to login
      window.location.href = '/login';
    } else {
      // Log error and show fallback UI
      console.error('API Error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Performance Optimization

### Caching Strategies

#### Cache Configuration

```typescript
// Different cache times for different data types
const CACHE_CONFIG = {
  // Static data - cache longer
  tags: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Dynamic data - moderate caching
  newsletters: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
  
  // Real-time data - minimal caching
  unreadCount: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
  },
};

// Apply to queries
const { data } = useQuery({
  queryKey: ['newsletters'],
  queryFn: () => newsletterApi.getAll(),
  ...CACHE_CONFIG.newsletters,
});
```

#### Optimistic Updates

```typescript
const useToggleRead = (id: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (isRead: boolean) =>
      isRead 
        ? newsletterApi.markAsRead(id)
        : newsletterApi.markAsUnread(id),
    onMutate: async (isRead) => {
      // Cancel queries
      await queryClient.cancelQueries(['newsletter', id]);
      
      // Save current state
      const previous = queryClient.getQueryData(['newsletter', id]);
      
      // Optimistic update
      queryClient.setQueryData(['newsletter', id], (old: any) => ({
        ...old,
        is_read: isRead,
      }));
      
      return { previous };
    },
    onError: (err, variables, context) => {
      // Revert on error
      queryClient.setQueryData(['newsletter', id], context?.previous);
    },
  });
};
```

### Prefetching

```typescript
// Prefetch on hover
const prefetchNewsletter = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ['newsletter', id],
    queryFn: () => newsletterApi.getById(id),
    staleTime: 10 * 60 * 1000,
  });
};

// Use in component
<NewsletterCard
  newsletter={newsletter}
  onMouseEnter={() => prefetchNewsletter(newsletter.id)}
  onClick={() => navigate(`/newsletter/${newsletter.id}`)}
/>
```

### Selective Data Fetching

```typescript
// Only fetch what you need
const { data: newsletters } = useQuery({
  queryKey: ['newsletters', 'basic'],
  queryFn: () => newsletterApi.getAll({
    limit: 20,
    includeSource: false, // Skip relations if not needed
    includeTags: false,
  }),
});

// Fetch full data when needed
const { data: fullNewsletter } = useQuery({
  queryKey: ['newsletter', id, 'full'],
  queryFn: () => newsletterApi.getById(id, true),
  enabled: showDetails, // Only fetch when details are shown
});
```

## Best Practices

### 1. Use Appropriate Query Keys

```typescript
// ✅ Hierarchical, specific keys
const queryKey = ['newsletters', 'user', userId, 'unread'];

// ❌ Generic, unclear keys
const queryKey = ['data'];
```

### 2. Handle Loading States

```typescript
const NewsletterList = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['newsletters'],
    queryFn: () => newsletterApi.getAll(),
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage />;
  if (!data?.data.length) return <EmptyState />;

  return (
    <div>
      {data.data.map(newsletter => (
        <NewsletterCard key={newsletter.id} newsletter={newsletter} />
      ))}
    </div>
  );
};
```

### 3. Use Proper TypeScript Types

```typescript
// ✅ Use API-provided types
import { Newsletter, NewsletterQueryParams } from '@common/types';

const useNewsletters = (params: NewsletterQueryParams) => {
  return useQuery({
    queryKey: ['newsletters', params],
    queryFn: (): Promise<PaginatedResponse<Newsletter>> =>
      newsletterApi.getAll(params),
  });
};

// ❌ Using 'any' or missing types
const useNewsletters = (params: any) => {
  return useQuery({
    queryKey: ['newsletters', params],
    queryFn: () => newsletterApi.getAll(params),
  });
};
```

### 4. Implement Proper Error Boundaries

```typescript
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Router>
          <Routes>
            {/* Your routes */}
          </Routes>
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};
```

### 5. Use Consistent Cache Invalidation

```typescript
// ✅ Invalidate related queries
const useCreateNewsletter = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: newsletterApi.create,
    onSuccess: () => {
      // Invalidate all newsletter-related queries
      queryClient.invalidateQueries(['newsletters']);
      queryClient.invalidateQueries(['unreadCount']);
      queryClient.invalidateQueries(['stats']);
    },
  });
};
```

## Migration Guide

### From Direct Supabase Calls

#### Before (Direct Supabase)

```typescript
import { supabase } from '@common/services/supabaseClient';

const fetchNewsletters = async () => {
  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error:', error);
    throw error;
  }

  return data;
};
```

#### After (API Service)

```typescript
import { newsletterApi } from '@common/api/newsletterApi';

const fetchNewsletters = async () => {
  return await newsletterApi.getAll({
    isRead: false,
  });
};
```

### From Custom Hooks

#### Before (Custom Hook with Supabase)

```typescript
const useNewsletters = () => {
  const [newsletters, setNewsletters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNewsletters = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('newsletters')
          .select('*');
        
        if (error) throw error;
        setNewsletters(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsletters();
  }, []);

  return { newsletters, loading, error };
};
```

#### After (React Query + API Service)

```typescript
import { useQuery } from '@tanstack/react-query';
import { newsletterApi } from '@common/api/newsletterApi';

const useNewsletters = () => {
  return useQuery({
    queryKey: ['newsletters'],
    queryFn: () => newsletterApi.getAll(),
  });
};
```

## API Reference

### Newsletter API

#### `newsletterApi.getAll(params?)`

Fetch all newsletters with optional filtering and pagination.

**Parameters:**
- `params` (optional): `NewsletterQueryParams`
  - `search?: string` - Text search
  - `isRead?: boolean` - Filter by read status
  - `isArchived?: boolean` - Filter by archive status
  - `isLiked?: boolean` - Filter by liked status
  - `isBookmarked?: boolean` - Filter by bookmark status
  - `sourceIds?: string[]` - Filter by source IDs
  - `tagIds?: string[]` - Filter by tag IDs
  - `dateFrom?: string` - Start date filter
  - `dateTo?: string` - End date filter
  - `orderBy?: string` - Sort column
  - `ascending?: boolean` - Sort direction
  - `limit?: number` - Page size
  - `offset?: number` - Page offset
  - `includeSource?: boolean` - Include source relation
  - `includeTags?: boolean` - Include tags relation

**Returns:** `Promise<PaginatedResponse<NewsletterWithRelations>>`

#### `newsletterApi.getById(id, includeRelations?)`

Fetch a single newsletter by ID.

**Parameters:**
- `id: string` - Newsletter ID
- `includeRelations?: boolean` - Include relations (default: true)

**Returns:** `Promise<NewsletterWithRelations | null>`

#### `newsletterApi.create(params)`

Create a new newsletter.

**Parameters:**
- `params: CreateNewsletterParams`
  - `title: string`
  - `content: string`
  - `summary?: string`
  - `newsletter_source_id?: string`
  - `tag_ids?: string[]`

**Returns:** `Promise<NewsletterWithRelations>`

#### `newsletterApi.update(params)`

Update an existing newsletter.

**Parameters:**
- `params: UpdateNewsletterParams`
  - `id: string`
  - `title?: string`
  - `content?: string`
  - `summary?: string`
  - `is_read?: boolean`
  - `is_archived?: boolean`
  - `is_liked?: boolean`
  - `tag_ids?: string[]`

**Returns:** `Promise<NewsletterWithRelations>`

#### `newsletterApi.delete(id)`

Delete a newsletter.

**Parameters:**
- `id: string` - Newsletter ID

**Returns:** `Promise<boolean>`

### Tag API

#### `tagApi.getAll()`

Get all tags for the current user.

**Returns:** `Promise<Tag[]>`

#### `tagApi.create(tag)`

Create a new tag.

**Parameters:**
- `tag: TagCreate`
  - `name: string`
  - `color: string`

**Returns:** `Promise<Tag>`

#### `tagApi.getTagUsageStats()`

Get tags with newsletter count statistics.

**Returns:** `Promise<Array<Tag & { newsletter_count: number }>>`

### User API

#### `userApi.getProfile()`

Get user profile information.

**Returns:** `Promise<UserProfile>`

#### `userApi.getEmailAlias()`

Get or generate user's email alias.

**Returns:** `Promise<string>`

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem:** Getting "User not authenticated" errors

**Solution:**
- Ensure user is logged in before making API calls
- Check that auth context is properly set up
- Verify token hasn't expired

```typescript
const { user } = useAuth();

const { data } = useQuery({
  queryKey: ['newsletters'],
  queryFn: () => newsletterApi.getAll(),
  enabled: !!user, // Only run when authenticated
});
```

#### 2. Stale Data Issues

**Problem:** UI showing outdated information

**Solution:**
- Properly invalidate queries after mutations
- Use appropriate stale times
- Consider optimistic updates for better UX

```typescript
const mutation = useMutation({
  mutationFn: newsletterApi.update,
  onSuccess: () => {
    queryClient.invalidateQueries(['newsletters']);
    queryClient.invalidateQueries(['newsletter', id]);
  },
});
```

#### 3. Performance Issues

**Problem:** Slow loading or too many requests

**Solution:**
- Use appropriate pagination limits
- Avoid fetching unnecessary relations
- Implement proper caching strategies

```typescript
// ✅ Optimized query
const { data } = useQuery({
  queryKey: ['newsletters'],
  queryFn: () => newsletterApi.getAll({
    limit: 20,
    includeSource: false, // Only include if needed
  }),
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
VITE_API_DEBUG=true
```

This will log all API operations with timing information.

### Getting Help

1. Check the console for error messages
2. Review the network tab for failed requests
3. Verify your query keys and parameters
4. Check that you're using the latest API service versions
5. Review this documentation for patterns and examples

For additional support, refer to the project's issue tracker or contact the development team.

---

**Last Updated:** December 2024  
**Version:** 1.0.0