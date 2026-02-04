# API Access Patterns

This document outlines the approved patterns for accessing the database through the API layer in NewsletterHub. Following these patterns ensures consistency, maintainability, and optimal performance across the application.

## Table of Contents

- [Core Principles](#core-principles)
- [Basic CRUD Patterns](#basic-crud-patterns)
- [Query Patterns](#query-patterns)
- [Bulk Operations](#bulk-operations)
- [Error Handling](#error-handling)
- [Hook Integration](#hook-integration)
- [Performance Patterns](#performance-patterns)
- [Real-time Updates](#real-time-updates)
- [Authentication Patterns](#authentication-patterns)
- [Caching Strategies](#caching-strategies)
- [Testing Patterns](#testing-patterns)
- [Anti-patterns](#anti-patterns)

## Core Principles

### 1. Always Use API Services
Never access Supabase directly from components, hooks, or utilities. Always go through the API layer.

```typescript
// ✅ DO - Use API service
import { newsletterApi } from '@common/api/newsletterApi';

const newsletters = await newsletterApi.getAll();
```

```typescript
// ❌ DON'T - Direct Supabase access
import { supabase } from '@common/services/supabaseClient';

const { data } = await supabase.from('newsletters').select('*');
```

### 2. Let API Services Handle Auth
Don't manage authentication in components. API services handle this automatically.

```typescript
// ✅ DO - API handles auth automatically
const newsletter = await newsletterApi.getById(id);
```

```typescript
// ❌ DON'T - Manual auth checking
const user = await getCurrentUser();
if (!user) throw new Error('Not authenticated');
const newsletter = await newsletterApi.getById(id);
```

### 3. Use Proper Error Handling
Let API services throw errors and handle them appropriately in your components.

```typescript
// ✅ DO - Handle API errors
try {
  const newsletter = await newsletterApi.create(data);
  toast.success('Newsletter created');
} catch (error) {
  toast.error('Failed to create newsletter');
  console.error(error);
}
```

## Basic CRUD Patterns

### Reading Data

#### Get All Items
```typescript
// Basic fetch
const newsletters = await newsletterApi.getAll();

// With filters
const unreadNewsletters = await newsletterApi.getAll({
  isRead: false,
  limit: 20,
  orderBy: 'received_at',
  ascending: false,
});

// With relations
const newslettersWithTags = await newsletterApi.getAll({
  includeTags: true,
  includeSource: true,
});
```

#### Get Single Item
```typescript
// Basic fetch
const newsletter = await newsletterApi.getById(id);

// With relations
const newsletterWithRelations = await newsletterApi.getById(id, true);

// Handle not found
const newsletter = await newsletterApi.getById(id);
if (!newsletter) {
  throw new Error('Newsletter not found');
}
```

### Creating Data

#### Basic Create
```typescript
const newNewsletter = await newsletterApi.create({
  title: 'Newsletter Title',
  content: 'Newsletter content...',
  newsletter_source_id: sourceId,
});
```

#### Create with Relations
```typescript
const newsletterWithTags = await newsletterApi.create({
  title: 'Newsletter Title',
  content: 'Newsletter content...',
  tag_ids: [tagId1, tagId2],
});
```

### Updating Data

#### Basic Update
```typescript
const updatedNewsletter = await newsletterApi.update({
  id: newsletterId,
  is_read: true,
});
```

#### Update with Relations
```typescript
const updatedNewsletter = await newsletterApi.update({
  id: newsletterId,
  title: 'Updated Title',
  tag_ids: [newTagId1, newTagId2],
});
```

#### Convenience Methods
```typescript
// Use specific methods when available
await newsletterApi.markAsRead(id);
await newsletterApi.toggleArchive(id);
```

### Deleting Data

```typescript
const success = await newsletterApi.delete(id);
if (success) {
  toast.success('Newsletter deleted');
}
```

## Query Patterns

### Filtering

```typescript
// Single filter
const archivedNewsletters = await newsletterApi.getAll({
  isArchived: true,
});

// Multiple filters
const filteredNewsletters = await newsletterApi.getAll({
  isRead: false,
  isArchived: false,
  sourceIds: [sourceId1, sourceId2],
  dateFrom: '2024-01-01',
  dateTo: '2024-12-31',
});

// Text search
const searchResults = await newsletterApi.search('important update');
```

### Pagination

```typescript
// Basic pagination
const page1 = await newsletterApi.getAll({
  limit: 20,
  offset: 0,
});

// Navigate pages
const nextPage = await newsletterApi.getAll({
  limit: 20,
  offset: page1.data.length,
});

// Check for more data
if (page1.hasMore) {
  const page2 = await newsletterApi.getAll({
    limit: 20,
    offset: 20,
  });
}
```

### Sorting

```typescript
// Sort by date (newest first)
const recentNewsletters = await newsletterApi.getAll({
  orderBy: 'received_at',
  ascending: false,
});

// Sort by title alphabetically
const sortedNewsletters = await newsletterApi.getAll({
  orderBy: 'title',
  ascending: true,
});
```

### Domain-Specific Queries

```typescript
// Get newsletters by tag
const taggedNewsletters = await newsletterApi.getByTag(tagId);

// Get newsletters by source
const sourceNewsletters = await newsletterApi.getBySource(sourceId);

// Get statistics
const stats = await newsletterApi.getStats();
```

## Bulk Operations

### Bulk Updates

```typescript
// Update multiple newsletters
const result = await newsletterApi.bulkUpdate({
  ids: [id1, id2, id3],
  updates: { is_read: true },
});

// Handle partial failures
result.results.forEach((newsletter, index) => {
  if (!newsletter) {
    console.error(`Failed to update newsletter ${result.ids[index]}:`, result.errors[index]);
  }
});
```

### Bulk Actions

```typescript
// Archive multiple newsletters
const archiveResult = await newsletterApi.bulkArchive([id1, id2, id3]);

// Create multiple tags
const newTags = await tagApi.bulkCreate([
  { name: 'Important', color: '#ff0000' },
  { name: 'Work', color: '#0000ff' },
]);
```

## Error Handling

### Basic Error Handling

```typescript
try {
  const newsletter = await newsletterApi.getById(id);
  // Handle success
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle not found
    navigate('/newsletters');
  } else {
    // Handle other errors
    toast.error('Failed to load newsletter');
  }
}
```

### Using Error Boundaries

```typescript
// In a React component with error boundary
const { data: newsletter, error } = useQuery({
  queryKey: ['newsletter', id],
  queryFn: () => newsletterApi.getById(id),
  throwOnError: true, // Let error boundary catch it
});
```

### Validation Errors

```typescript
try {
  await tagApi.create({ name: '', color: '#fff' });
} catch (error) {
  if (error.message.includes('validation')) {
    setFieldError('name', 'Name is required');
  } else {
    toast.error('Failed to create tag');
  }
}
```

## Hook Integration

### Basic Query Hook

```typescript
const useNewsletter = (id: string) => {
  return useQuery({
    queryKey: ['newsletter', id],
    queryFn: () => newsletterApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### Query with Dependencies

```typescript
const useNewslettersByTag = (tagId: string | null) => {
  return useQuery({
    queryKey: ['newsletters', 'tag', tagId],
    queryFn: () => tagId ? newsletterApi.getByTag(tagId) : null,
    enabled: !!tagId,
  });
};
```

### Mutation Hook

```typescript
const useCreateNewsletter = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: newsletterApi.create,
    onSuccess: (newNewsletter) => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['newsletters']);
      
      // Or optimistically update
      queryClient.setQueryData(['newsletter', newNewsletter.id], newNewsletter);
    },
    onError: (error) => {
      toast.error('Failed to create newsletter');
    },
  });
};
```

### Complex Hook with Multiple Operations

```typescript
const useNewsletterActions = () => {
  const queryClient = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: newsletterApi.markAsRead,
    onSuccess: (updatedNewsletter) => {
      queryClient.setQueryData(['newsletter', updatedNewsletter.id], updatedNewsletter);
      queryClient.invalidateQueries(['newsletters']);
    },
  });

  const archive = useMutation({
    mutationFn: newsletterApi.toggleArchive,
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries(['newsletter', id]);
      const previousData = queryClient.getQueryData(['newsletter', id]);
      
      queryClient.setQueryData(['newsletter', id], (old: any) => ({
        ...old,
        is_archived: !old.is_archived,
      }));

      return { previousData };
    },
    onError: (err, id, context) => {
      // Revert on error
      queryClient.setQueryData(['newsletter', id], context?.previousData);
    },
  });

  return { markAsRead, archive };
};
```

## Performance Patterns

### Optimistic Updates

```typescript
const useToggleRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      return isRead 
        ? await newsletterApi.markAsRead(id)
        : await newsletterApi.markAsUnread(id);
    },
    onMutate: async ({ id, isRead }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['newsletter', id]);
      
      // Snapshot previous value
      const previousNewsletter = queryClient.getQueryData(['newsletter', id]);
      
      // Optimistically update
      queryClient.setQueryData(['newsletter', id], (old: any) => ({
        ...old,
        is_read: isRead,
      }));
      
      return { previousNewsletter };
    },
    onError: (err, { id }, context) => {
      // Revert to previous state on error
      queryClient.setQueryData(['newsletter', id], context?.previousNewsletter);
    },
    onSettled: (data, error, { id }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries(['newsletter', id]);
    },
  });
};
```

### Selective Invalidation

```typescript
// Invalidate specific queries
await queryClient.invalidateQueries(['newsletters']);
await queryClient.invalidateQueries(['newsletter', id]);

// Invalidate by pattern
await queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === 'newsletters',
});

// Batch invalidation
await Promise.all([
  queryClient.invalidateQueries(['newsletters']),
  queryClient.invalidateQueries(['tags']),
  queryClient.invalidateQueries(['unreadCount']),
]);
```

### Prefetching

```typescript
// Prefetch related data
const prefetchNewsletterDetails = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ['newsletter', id],
    queryFn: () => newsletterApi.getById(id),
    staleTime: 10 * 60 * 1000,
  });
};

// Prefetch on hover
<NewsletterCard
  onMouseEnter={() => prefetchNewsletterDetails(newsletter.id)}
  onClick={() => navigate(`/newsletter/${newsletter.id}`)}
/>
```

## Real-time Updates

### Subscription Pattern

```typescript
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('newsletter_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'newsletters',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['newsletters']);
        
        if (payload.eventType === 'UPDATE' && payload.new) {
          // Update specific newsletter
          queryClient.setQueryData(['newsletter', payload.new.id], payload.new);
        }
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, [user, queryClient]);
```

### Polling for Updates

```typescript
const useNewslettersWithPolling = () => {
  return useQuery({
    queryKey: ['newsletters'],
    queryFn: () => newsletterApi.getAll(),
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: false,
  });
};
```

## Authentication Patterns

### Protected Operations

```typescript
// API services handle auth automatically
const useProtectedOperation = () => {
  return useMutation({
    mutationFn: async (data) => {
      // No need to check auth - API service will handle it
      return await newsletterApi.create(data);
    },
    onError: (error) => {
      if (error.message.includes('authenticated')) {
        // Redirect to login
        navigate('/login');
      }
    },
  });
};
```

### Conditional Queries Based on Auth

```typescript
const useUserNewsletters = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['newsletters', user?.id],
    queryFn: () => newsletterApi.getAll(),
    enabled: !!user, // Only run when user is authenticated
  });
};
```

## Caching Strategies

### Cache Keys

```typescript
// Use consistent, hierarchical cache keys
const CACHE_KEYS = {
  newsletters: ['newsletters'] as const,
  newsletter: (id: string) => ['newsletter', id] as const,
  newslettersByTag: (tagId: string) => ['newsletters', 'tag', tagId] as const,
  newsletterStats: ['newsletter', 'stats'] as const,
  tags: ['tags'] as const,
  tag: (id: string) => ['tag', id] as const,
};
```

### Cache Time Configuration

```typescript
const CACHE_CONFIG = {
  // Static data - cache longer
  tags: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  // Dynamic data - cache shorter
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
```

### Manual Cache Management

```typescript
// Set cache data after mutation
queryClient.setQueryData(['newsletter', id], updatedNewsletter);

// Remove from cache
queryClient.removeQueries(['newsletter', id]);

// Update cache with function
queryClient.setQueryData(['newsletters'], (old: any) => {
  return old.map((newsletter: Newsletter) =>
    newsletter.id === id ? updatedNewsletter : newsletter
  );
});
```

## Testing Patterns

### Mocking API Services

```typescript
// Mock at the API service level
jest.mock('@common/api/newsletterApi', () => ({
  newsletterApi: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// In test
const mockNewsletterApi = newsletterApi as jest.Mocked<typeof newsletterApi>;

beforeEach(() => {
  mockNewsletterApi.getAll.mockResolvedValue({
    data: mockNewsletters,
    count: mockNewsletters.length,
    page: 1,
    limit: 20,
    hasMore: false,
    nextPage: null,
    prevPage: null,
  });
});
```

### Testing Error Scenarios

```typescript
test('handles API errors gracefully', async () => {
  mockNewsletterApi.getById.mockRejectedValue(new Error('Network error'));
  
  render(<NewsletterDetails id="test-id" />);
  
  await waitFor(() => {
    expect(screen.getByText('Failed to load newsletter')).toBeInTheDocument();
  });
});
```

### Testing with React Query

```typescript
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('loads newsletters successfully', async () => {
  mockNewsletterApi.getAll.mockResolvedValue(mockResponse);
  
  render(<NewsletterList />, { wrapper: createWrapper() });
  
  await waitFor(() => {
    expect(screen.getByText('Newsletter Title')).toBeInTheDocument();
  });
});
```

## Anti-patterns

### ❌ Don't Access Supabase Directly

```typescript
// DON'T DO THIS
import { supabase } from '@common/services/supabaseClient';

const MyComponent = () => {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('newsletters').select('*');
      setData(data);
    };
    fetchData();
  }, []);
  
  return <div>{/* render data */}</div>;
};
```

### ❌ Don't Duplicate Error Handling

```typescript
// DON'T DO THIS
const createNewsletter = async (data: any) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: result, error } = await supabase
      .from('newsletters')
      .insert([{ ...data, user_id: user.id }]);
      
    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to create newsletter');
    }
    
    return result;
  } catch (error) {
    console.error('Error creating newsletter:', error);
    throw error;
  }
};
```

### ❌ Don't Mix Data Access Patterns

```typescript
// DON'T DO THIS
const MyComponent = () => {
  // Mixing API calls and direct Supabase
  const { data: newsletters } = useQuery(['newsletters'], () => 
    newsletterApi.getAll()
  );
  
  const { data: tags } = useQuery(['tags'], async () => {
    const { data } = await supabase.from('tags').select('*');
    return data;
  });
  
  return <div>{/* render */}</div>;
};
```

### ❌ Don't Ignore Performance Considerations

```typescript
// DON'T DO THIS - No caching configuration
const { data } = useQuery(['newsletters'], () => newsletterApi.getAll());

// DON'T DO THIS - Fetching too much data
const { data } = useQuery(['newsletters'], () => 
  newsletterApi.getAll({ limit: 10000 })
);

// DON'T DO THIS - Unnecessary refetching
const { data } = useQuery(['newsletters'], () => newsletterApi.getAll(), {
  refetchOnWindowFocus: true,
  refetchInterval: 1000,
});
```

## Summary

Following these patterns ensures:

- **Consistency**: All data access follows the same patterns
- **Maintainability**: Easy to modify and extend data access logic
- **Performance**: Optimal caching and query strategies
- **Reliability**: Proper error handling and edge case management
- **Testability**: Easy to mock and test data access
- **Type Safety**: Full TypeScript support throughout the data layer

Remember: When in doubt, look at existing implementations and follow the established patterns. If you need to deviate from these patterns, document the reasoning and consider updating this guide.