# Queue and Archive Operations Documentation

## Overview

This document provides comprehensive guidance on implementing and using the queue and archive operations in the Newsletter Hub application. These operations are critical for managing newsletter workflows and ensuring proper state persistence.

## Table of Contents

1. [Queue Operations](#queue-operations)
2. [Archive Operations](#archive-operations)
3. [Auto-Archive Functionality](#auto-archive-functionality)
4. [Implementation Details](#implementation-details)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Common Issues and Solutions](#common-issues-and-solutions)
8. [Testing Guidelines](#testing-guidelines)

## Queue Operations

### Overview

The reading queue allows users to save newsletters for later reading. Queue operations include adding and removing newsletters from the queue.

### toggleInQueue Function

The `toggleInQueue` function handles both adding and removing newsletters from the reading queue.

#### Function Signature

```typescript
async toggleInQueue(
  newsletter: NewsletterWithRelations,
  isInQueue: boolean,
  options?: NewsletterActionOptions
): Promise<void>
```

#### Parameters

- `newsletter`: The complete newsletter object with all relations
- `isInQueue`: Boolean indicating current queue state
  - `true`: Newsletter is currently in queue (will be removed)
  - `false`: Newsletter is not in queue (will be added)
- `options`: Optional configuration object
  - `showToasts`: Whether to show success/error toasts (default: true)
  - `onSuccess`: Callback function on successful operation
  - `onError`: Callback function on error

#### Usage Example

```typescript
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

const NewsletterComponent = () => {
  const { handleToggleInQueue } = useSharedNewsletterActions();
  
  const toggleQueue = async (newsletter: NewsletterWithRelations, isInQueue: boolean) => {
    try {
      await handleToggleInQueue(newsletter, isInQueue, {
        onSuccess: () => {
          console.log('Queue updated successfully');
        },
        onError: (error) => {
          console.error('Failed to update queue:', error);
        }
      });
    } catch (error) {
      // Handle error
    }
  };
};
```

### Implementation Flow

1. **Check Current State**: Determine if newsletter is in queue
2. **Perform Action**:
   - If `isInQueue === true`: Find queue item and remove it
   - If `isInQueue === false`: Add newsletter to queue
3. **Update Cache**: Invalidate related queries for UI consistency
4. **Show Feedback**: Display appropriate toast message
5. **Execute Callbacks**: Run success/error callbacks if provided

## Archive Operations

### Overview

Archive operations allow users to move newsletters out of their active inbox while preserving them for future reference.

### toggleArchive Function

The `toggleArchive` function handles archiving and unarchiving newsletters with optimistic updates.

#### Function Signature

```typescript
async toggleArchive(
  newsletter: NewsletterWithRelations,
  options?: NewsletterActionOptions
): Promise<void>
```

#### Parameters

- `newsletter`: The complete newsletter object
- `options`: Optional configuration object (same as toggleInQueue)

#### Usage Example

```typescript
const { handleToggleArchive } = useSharedNewsletterActions();

const archiveNewsletter = async (newsletter: NewsletterWithRelations) => {
  await handleToggleArchive(newsletter, {
    showToasts: true,
    onSuccess: (updatedNewsletter) => {
      // Navigate or update UI
    }
  });
};
```

### Optimistic Updates

Archive operations use optimistic updates for better UX:

1. **Apply Update**: Immediately update UI with expected state
2. **Execute Operation**: Perform actual API call
3. **Handle Success**: Invalidate cache gently to avoid UI flash
4. **Handle Failure**: Revert optimistic update and show error

## Auto-Archive Functionality

### Overview

Auto-archive automatically archives newsletters when they are marked as read, based on user preferences.

### Implementation

```typescript
// In newsletter detail component
const handleMarkAsRead = async () => {
  await markAsRead(newsletter.id);
  
  if (userPreferences.autoArchiveOnRead && !newsletter.is_archived) {
    await handleToggleArchive(newsletter);
  }
};
```

### Configuration

Auto-archive is controlled by user preferences:

```typescript
interface UserPreferences {
  autoArchiveOnRead: boolean;
  // other preferences...
}
```

### Best Practices

1. Always check if newsletter is already archived before auto-archiving
2. Show distinct toasts for each operation
3. Allow users to easily disable auto-archive in settings
4. Consider batch operations for marking multiple as read

## Implementation Details

### Cache Management

Both queue and archive operations use intelligent cache management:

```typescript
// After successful operation
setTimeout(async () => {
  await cacheManager.invalidateRelatedQueries(
    [newsletter.id],
    operationType
  );
}, 100);
```

The 100ms delay prevents UI flashing while ensuring data consistency.

### Error Handling

```typescript
try {
  // Perform operation
} catch (error) {
  // Force cache refresh on error
  await cacheManager.invalidateRelatedQueries(
    [newsletter.id],
    'error-recovery'
  );
  
  // Show error toast
  toast.error(`Failed to ${operation}: ${error.message}`);
  
  // Execute error callback
  options?.onError?.(error);
  
  // Re-throw for component handling
  throw error;
}
```

### Event Dispatching

Operations dispatch custom events for real-time updates:

```typescript
// Archive operation
window.dispatchEvent(new CustomEvent('newsletter:archived'));

// Read status change
window.dispatchEvent(new CustomEvent('newsletter:read-status-changed'));
```

## API Reference

### Reading Queue API

```typescript
interface ReadingQueueApi {
  getAll(): Promise<ReadingQueueItem[]>;
  add(newsletterId: string): Promise<ReadingQueueItem>;
  remove(queueItemId: string): Promise<void>;
}
```

### Newsletter API

```typescript
interface NewsletterApi {
  toggleArchive(id: string): Promise<NewsletterWithRelations>;
  markAsRead(id: string): Promise<NewsletterWithRelations>;
  update(id: string, data: Partial<Newsletter>): Promise<NewsletterWithRelations>;
}
```

## Best Practices

### 1. Always Pass Complete Objects

```typescript
// ✅ Good
await handleToggleInQueue(newsletter, isInQueue);

// ❌ Bad
await handleToggleInQueue(newsletterId); // Missing required params
```

### 2. Handle Loading States

```typescript
const { isTogglingQueue, isArchiving } = useNewsletterLoadingStates();

<Button 
  onClick={() => handleToggleInQueue(newsletter, isInQueue)}
  disabled={isTogglingQueue}
>
  {isTogglingQueue ? 'Processing...' : 'Toggle Queue'}
</Button>
```

### 3. Implement Proper Error Boundaries

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <NewsletterOperations />
</ErrorBoundary>
```

### 4. Use Consistent Toast Messages

```typescript
// Queue operations
'Added to reading queue'
'Removed from reading queue'

// Archive operations
'Newsletter archived'
'Newsletter unarchived'
```

## Common Issues and Solutions

### Issue 1: Queue State Not Persisting

**Cause**: Not passing required parameters to toggleInQueue

**Solution**:
```typescript
// Ensure all parameters are passed
await sharedHandlers.toggleInQueue(newsletter, isInQueue, mergedOptions);
```

### Issue 2: Auto-Archive Not Working

**Cause**: Cache invalidation preventing UI updates

**Solution**:
```typescript
// Use 'active' refetch type
invalidateQueries({
  queryKey: ['newsletter', id],
  refetchType: 'active'
});
```

### Issue 3: Optimistic Updates Flickering

**Cause**: Immediate cache invalidation

**Solution**:
```typescript
// Add delay before invalidation
setTimeout(() => {
  invalidateQueries(['newsletter']);
}, 100);
```

### Issue 4: Queue Item Not Found

**Cause**: Trying to remove non-existent queue item

**Solution**:
```typescript
const queueItem = queueItems.find(item => item.newsletter_id === newsletter.id);
if (!queueItem) {
  throw new Error('Newsletter not found in reading queue');
}
```

## Testing Guidelines

### Unit Tests

Test core functionality in isolation:

```typescript
describe('toggleInQueue', () => {
  it('should add newsletter to queue when not in queue', async () => {
    const isInQueue = false;
    await handlers.toggleInQueue(mockNewsletter, isInQueue);
    
    expect(readingQueueApi.add).toHaveBeenCalledWith(mockNewsletter.id);
    expect(toast.success).toHaveBeenCalledWith('Added to reading queue');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
it('should remove from queue and persist after reload', async () => {
  renderWithProviders(<NewsletterDetail />);
  
  const queueButton = await screen.findByRole('button', { name: /remove from queue/i });
  await user.click(queueButton);
  
  // Simulate page reload
  queryClient.clear();
  rerender(<NewsletterDetail />);
  
  // Verify state persisted
  expect(screen.getByRole('button', { name: /add to queue/i })).toBeInTheDocument();
});
```

### E2E Tests

Test complete user workflows:

```typescript
test('should handle queue and archive operations together', async ({ page }) => {
  // Add to queue
  await page.getByRole('button', { name: /add to queue/i }).click();
  await waitForToast(page, 'Added to reading queue');
  
  // Archive
  await page.getByRole('button', { name: /archive/i }).click();
  await waitForToast(page, 'Newsletter archived');
  
  // Verify in both views
  await page.goto('/newsletters/queue');
  await expect(page.locator('[data-testid="newsletter-1"]')).toBeVisible();
});
```

## Migration Guide

If upgrading from an older version:

1. Update all `toggleInQueue` calls to include newsletter object and isInQueue state
2. Review and update cache invalidation settings
3. Test auto-archive functionality with various user preferences
4. Update error handling to match new patterns

## Performance Considerations

1. **Batch Operations**: Use bulk endpoints for multiple items
2. **Debounce Updates**: Prevent rapid successive calls
3. **Cache Strategy**: Use optimistic updates for instant feedback
4. **Lazy Loading**: Load queue items only when needed

## Security Considerations

1. **Authorization**: Verify user owns newsletter before operations
2. **Rate Limiting**: Implement limits on queue operations
3. **Input Validation**: Validate newsletter IDs and states
4. **Error Messages**: Don't expose internal details in errors

## Monitoring and Analytics

Track key metrics:

- Queue add/remove success rates
- Archive/unarchive frequency
- Auto-archive adoption
- Error rates by operation type
- Average response times

## Future Enhancements

1. **Bulk Queue Operations**: Add/remove multiple items at once
2. **Queue Ordering**: Allow manual reordering of queue items
3. **Smart Auto-Archive**: Archive based on reading patterns
4. **Queue Limits**: Implement maximum queue size
5. **Archive Categories**: Organize archived items

## Support

For issues or questions:
1. Check the [Common Issues](#common-issues-and-solutions) section
2. Review test files for implementation examples
3. Consult the API documentation
4. Contact the development team

---

Last Updated: [Current Date]
Version: 1.0.0