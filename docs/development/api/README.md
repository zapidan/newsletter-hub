# Newsletter Hub API Documentation

## Overview

The Newsletter Hub API layer provides a centralized, type-safe interface for all database operations. It abstracts direct Supabase calls behind a clean API that includes error handling, performance monitoring, and consistent patterns across all data operations.

## Architecture

```
src/common/api/
├── index.ts                      # Main API exports
├── supabaseClient.ts             # Enhanced Supabase client
├── newsletterApi.ts              # Newsletter CRUD operations
├── newsletterSourceApi.ts        # Newsletter source operations
├── readingQueueApi.ts            # Reading queue management
├── tagApi.ts                     # Tag CRUD operations
├── newsletterSourceGroupApi.ts   # Source group management
├── userApi.ts                    # User profile and email alias operations
└── errorHandling.ts              # Centralized error handling
```

## Key Features

- **Type Safety**: Full TypeScript support with proper interfaces
- **Error Handling**: Consistent error transformation and user-friendly messages
- **Performance Monitoring**: Built-in performance logging for development
- **Retry Logic**: Automatic retry for network and server errors
- **Validation**: Input validation with helpful error messages
- **Caching**: Cache-aware operations that work with React Query
- **Authentication**: Built-in user authentication checks

## Getting Started

### Basic Import

```typescript
import { 
  newsletterApi, 
  newsletterSourceApi,
  readingQueueApi,
  tagApi,
  newsletterSourceGroupApi,
  userApi 
} from '@common/api';
```

### Using the Newsletter API

```typescript
// Get all newsletters with filters
const newsletters = await newsletterApi.getAll({
  isRead: false,
  limit: 20,
  includeRelations: true
});

// Get specific newsletter
const newsletter = await newsletterApi.getById('newsletter-id');

// Update newsletter
const updated = await newsletterApi.update({
  id: 'newsletter-id',
  is_read: true,
  tag_ids: ['tag1', 'tag2']
});

// Bulk operations
const result = await newsletterApi.bulkArchive(['id1', 'id2', 'id3']);
```

### Using the Newsletter Source API

```typescript
// Get all active sources
const sources = await newsletterSourceApi.getActive({
  includeCount: true,
  limit: 50
});

// Create new source
const newSource = await newsletterSourceApi.create({
  name: 'TechCrunch',
  domain: 'techcrunch.com'
});

// Search sources
const searchResults = await newsletterSourceApi.search('tech');
```

### Using the Reading Queue API

```typescript
// Get all reading queue items
const queueItems = await readingQueueApi.getAll();

// Add newsletter to reading queue
await readingQueueApi.add('newsletter-id');

// Remove from reading queue
await readingQueueApi.remove('queue-item-id');

// Reorder queue items
await readingQueueApi.reorder([
  { id: 'item1', position: 1 },
  { id: 'item2', position: 2 }
]);
```

### Using the Tag API

```typescript
// Get all tags
const tags = await tagApi.getAll();

// Create new tag
const newTag = await tagApi.create({
  name: 'Important',
  color: '#ff0000'
});

// Update newsletter tags
await tagApi.updateNewsletterTags('newsletter-id', [tag1, tag2]);

// Get or create tag by name
const tag = await tagApi.getOrCreate('Work', '#0066cc');
```

### Using the Newsletter Source Group API

```typescript
// Get all source groups
const groups = await newsletterSourceGroupApi.getAll();

// Create new group
const newGroup = await newsletterSourceGroupApi.create({
  name: 'Tech News',
  sourceIds: ['source1', 'source2']
});

// Add sources to group
await newsletterSourceGroupApi.addSources({
  groupId: 'group-id',
  sourceIds: ['source3', 'source4']
});
```

### Using the User API

```typescript
// Get user profile
const profile = await userApi.getProfile();

// Generate email alias
const alias = await userApi.getEmailAlias();

// Update user preferences
await userApi.updatePreferences({
  theme: 'dark',
  notifications: true
});

## API Reference

### Newsletter API (`newsletterApi`)

#### Core Operations

- `getAll(params?)` - Get newsletters with filtering and pagination
- `getById(id, includeRelations?)` - Get single newsletter
- `create(params)` - Create new newsletter
- `update(params)` - Update newsletter
- `delete(id)` - Delete newsletter

#### Bulk Operations

- `bulkUpdate(params)` - Update multiple newsletters
- `bulkArchive(ids)` - Archive multiple newsletters
- `bulkUnarchive(ids)` - Unarchive multiple newsletters

#### Convenience Methods

- `markAsRead(id)` - Mark newsletter as read
- `markAsUnread(id)` - Mark newsletter as unread
- `toggleArchive(id)` - Toggle archive status
- `toggleLike(id)` - Toggle like status
- `toggleBookmark(id)` - Toggle bookmark status

#### Query Methods

- `getByTag(tagId, params?)` - Get newsletters by tag
- `getBySource(sourceId, params?)` - Get newsletters by source
- `search(query, params?)` - Search newsletters
- `getStats()` - Get reading statistics

### Newsletter Source API (`newsletterSourceApi`)

#### Core Operations

- `getAll(params?)` - Get sources with filtering
- `getById(id, includeCount?)` - Get single source
- `create(params)` - Create new source
- `update(params)` - Update source
- `delete(id)` - Delete source (if no associated newsletters)

#### Archive Operations

- `archive(id)` - Archive source
- `unarchive(id)` - Unarchive source
- `toggleArchive(id)` - Toggle archive status
- `bulkArchive(ids)` - Archive multiple sources
- `bulkUnarchive(ids)` - Unarchive multiple sources

#### Query Methods

- `search(query, params?)` - Search sources
- `getWithCounts(params?)` - Get sources with newsletter counts
- `getActive(params?)` - Get non-archived sources
- `getArchived(params?)` - Get archived sources
- `getStats()` - Get source statistics

### Reading Queue API (`readingQueueApi`)

#### Core Operations

- `getAll()` - Get all reading queue items for current user
- `add(newsletterId)` - Add newsletter to reading queue
- `remove(queueItemId)` - Remove item from reading queue
- `getById(id)` - Get specific queue item
- `clear()` - Clear all items from reading queue

#### Queue Management

- `reorder(updates)` - Reorder queue items with position updates
- `moveToPosition(queueItemId, newPosition)` - Move item to specific position
- `isInQueue(newsletterId)` - Check if newsletter is in queue

#### Statistics

- `getStats()` - Get reading queue statistics (total, read, unread)

### Tag API (`tagApi`)

#### Core Operations

- `getAll()` - Get all tags for current user
- `getById(id)` - Get tag by ID
- `create(params)` - Create new tag
- `update(params)` - Update existing tag
- `delete(tagId)` - Delete tag

#### Newsletter Tag Operations

- `getTagsForNewsletter(newsletterId)` - Get tags for specific newsletter
- `updateNewsletterTags(newsletterId, tags)` - Update newsletter's tags
- `addToNewsletter(newsletterId, tagId)` - Add tag to newsletter
- `removeFromNewsletter(newsletterId, tagId)` - Remove tag from newsletter

#### Utility Operations

- `getOrCreate(name, color?)` - Get existing tag or create new one
- `bulkCreate(tags)` - Create multiple tags
- `search(query)` - Search tags by name
- `getTagUsageStats()` - Get tags with newsletter counts
- `getPaginated(options)` - Get tags with pagination

### Newsletter Source Group API (`newsletterSourceGroupApi`)

#### Core Operations

- `getAll()` - Get all source groups for current user
- `getById(id)` - Get source group by ID
- `create(params)` - Create new source group
- `update(params)` - Update source group
- `delete(id)` - Delete source group

#### Source Management

- `addSources(params)` - Add sources to group
- `removeSources(params)` - Remove sources from group
- `getGroupSources(groupId)` - Get all sources in group
- `getSourceGroups(sourceId)` - Get groups containing source

#### Query Methods

- `search(query)` - Search groups by name
- `getStats()` - Get group statistics

### User API (`userApi`)

#### Profile Operations

- `getProfile()` - Get current user profile
- `updateProfile(updates)` - Update user profile
- `deleteAccount()` - Delete user account and data

#### Email Alias Operations

- `getEmailAlias()` - Get or create email alias for user
- `generateEmailAlias(email)` - Generate new email alias
- `updateEmailAlias(newAlias)` - Update user's email alias
- `isEmailAliasAvailable(alias)` - Check if alias is available

#### Preferences and Statistics

- `getPreferences()` - Get user preferences
- `updatePreferences(preferences)` - Update user preferences
- `getStats()` - Get user statistics (newsletter count, tags, etc.)

## Parameters and Types

### Query Parameters

```typescript
interface NewsletterQueryParams {
  // Pagination
  limit?: number;
  offset?: number;
  
  // Filtering
  search?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;
  tagIds?: string[];
  sourceIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  
  // Relations
  includeRelations?: boolean;
  includeTags?: boolean;
  includeSource?: boolean;
  
  // Ordering
  orderBy?: string;
  ascending?: boolean;
}
```

### Response Types

```typescript
interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

interface BatchResult<T> {
  results: (T | null)[];
  errors: (Error | null)[];
  successCount: number;
  errorCount: number;
}

interface EmailAliasResult {
  email: string;
  error?: string;
}

interface ReadingQueueItem {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  added_at: string;
  newsletter: NewsletterWithRelations;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface NewsletterSourceGroup {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sources: NewsletterSource[];
}
```

## Error Handling

The API layer provides comprehensive error handling with user-friendly messages.

### Error Types

```typescript
enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  AUTH = 'AUTH_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER = 'SERVER_ERROR',
  DATABASE = 'DATABASE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}
```

### Using Error Handling

```typescript
import { AppError, getUserFriendlyMessage, logError } from '@common/api';

try {
  const newsletter = await newsletterApi.getById('invalid-id');
} catch (error) {
  if (error instanceof AppError) {
    const userMessage = getUserFriendlyMessage(error);
    console.log('User message:', userMessage);
    
    // Log error for debugging
    logError(error, { 
      operation: 'getNewsletter',
      component: 'NewsletterDetail' 
    });
  }
}
```

### Error Hook for React Components

```typescript
import { useErrorHandler } from '@common/api';

const MyComponent = () => {
  const { handleError, getUserMessage } = useErrorHandler();
  
  const handleOperation = async () => {
    try {
      await newsletterApi.create(data);
    } catch (error) {
      const appError = handleError(error, { component: 'MyComponent' });
      setErrorMessage(getUserMessage(appError));
    }
  };
};
```

## Performance Monitoring

The API layer includes built-in performance monitoring for development.

```typescript
// Performance logging is automatic
const newsletters = await newsletterApi.getAll(); 
// Logs: [Supabase] newsletters.getAll completed in 245ms

// Manual performance monitoring
import { withPerformanceLogging } from '@common/api';

const result = await withPerformanceLogging('custom-operation', async () => {
  // Your operation here
  return await someOperation();
});
```

## Migration Guide

### From Direct Supabase Calls

**Before:**
```typescript
const { data, error } = await supabase
  .from('newsletters')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_archived', false);

if (error) {
  console.error('Error:', error);
  return;
}
```

**After:**
```typescript
try {
  const newsletters = await newsletterApi.getAll({ 
    isArchived: false 
  });
  // newsletters.data contains the results
} catch (error) {
  // Error is already transformed and logged
  const userMessage = getUserFriendlyMessage(error);
}
```

### From Custom Hooks

**Before:**
```typescript
const { data, error } = useQuery(['newsletters'], async () => {
  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('user_id', user.id);
  
  if (error) throw error;
  return data;
});
```

**After:**
```typescript
const { data, error } = useQuery(['newsletters'], () => 
  newsletterApi.getAll()
);
```

### From Utilities to API Services

**Before:**
```typescript
import { updateNewsletterTags } from '@common/utils/tagUtils';
import { getUserEmailAlias } from '@common/utils/emailAlias';

// Update tags
await updateNewsletterTags(newsletterId, tagIds, currentTagIds, userId);

// Get email alias
const alias = await getUserEmailAlias(user);
```

**After:**
```typescript
import { tagApi, userApi } from '@common/api';

// Update tags
await tagApi.updateNewsletterTags(newsletterId, tags);

// Get email alias
const alias = await userApi.getEmailAlias();
```

## Best Practices

### 1. Use Specific Query Parameters

```typescript
// Good - specific parameters
const unreadNewsletters = await newsletterApi.getAll({
  isRead: false,
  limit: 20,
  orderBy: 'received_at',
  ascending: false
});

// Avoid - fetching all data
const allNewsletters = await newsletterApi.getAll();
```

### 2. Handle Errors Appropriately

```typescript
// Good - proper error handling
try {
  const newsletter = await newsletterApi.getById(id);
  if (!newsletter) {
    setError('Newsletter not found');
    return;
  }
  setNewsletter(newsletter);
} catch (error) {
  const userMessage = getUserFriendlyMessage(error);
  setError(userMessage);
}

// Avoid - silent failures
const newsletter = await newsletterApi.getById(id).catch(() => null);
```

### 3. Use Bulk Operations for Multiple Items

```typescript
// Good - bulk operation
const result = await newsletterApi.bulkArchive(selectedIds);
console.log(`Archived ${result.successCount} newsletters`);

// Avoid - individual calls
for (const id of selectedIds) {
  await newsletterApi.update({ id, is_archived: true });
}
```

### 4. Leverage Type Safety

```typescript
// Good - using proper types
const params: NewsletterQueryParams = {
  isRead: false,
  tagIds: selectedTags.map(t => t.id),
  limit: 50
};

// The API will validate and provide proper autocomplete
const newsletters = await newsletterApi.getAll(params);
```

## Testing

### Mocking API Calls

```typescript
// Mock the entire API module
jest.mock('@common/api', () => ({
  newsletterApi: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    // ... other methods
  },
  readingQueueApi: {
    getAll: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  },
  tagApi: {
    getAll: jest.fn(),
    create: jest.fn(),
    updateNewsletterTags: jest.fn(),
  },
  userApi: {
    getProfile: jest.fn(),
    getEmailAlias: jest.fn(),
  }
}));

// In your test
import { newsletterApi } from '@common/api';

test('should load newsletters', async () => {
  const mockNewsletters = [{ id: '1', title: 'Test' }];
  (newsletterApi.getAll as jest.Mock).mockResolvedValue({
    data: mockNewsletters,
    count: 1
  });
  
  // Test your component
});
```

### Testing Error Scenarios

```typescript
import { simulateError, ErrorType } from '@common/api';

test('should handle network errors', async () => {
  (newsletterApi.getAll as jest.Mock).mockRejectedValue(
    simulateError(ErrorType.NETWORK)
  );
  
  // Test error handling
});
```

## Environment Configuration

The API layer respects several environment variables:

```env
# Required
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional
VITE_API_RETRY_ATTEMPTS=3
VITE_API_RETRY_DELAY=1000
VITE_API_TIMEOUT=30000
VITE_API_ENABLE_LOGGING=true
VITE_API_ENABLE_PERFORMANCE_MONITORING=true
VITE_ERROR_REPORTING_ENDPOINT=https://your-error-service.com/api/errors
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure user is logged in before API calls
2. **Permission Denied**: Check RLS policies in Supabase
3. **Network Timeouts**: Increase timeout or check connection
4. **Validation Errors**: Check required fields and data types

### Debug Mode

Enable debug logging in development:

```typescript
// This is automatically enabled in development mode
// Check browser console for detailed operation logs
```

### Performance Issues

Monitor API performance:

```typescript
// Check performance metrics
import { performanceMetrics } from '@common/api/supabaseClient';

console.log('API Performance:', Array.from(performanceMetrics.entries()));
```

## Support

For questions or issues:

1. Check this documentation first
2. Review the TypeScript types for parameter details
3. Check browser console for error logs
4. Review the source code in `src/common/api/`

## Contributing

When adding new API methods:

1. Follow existing patterns in `newsletterApi.ts`
2. Add proper TypeScript types
3. Include error handling with `handleSupabaseError`
4. Add performance logging with `withPerformanceLogging`
5. Update this documentation
6. Add tests for new functionality