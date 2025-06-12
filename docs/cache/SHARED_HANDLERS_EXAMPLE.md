# Shared Newsletter Handlers Usage Examples

This document demonstrates how to use the new shared newsletter action handlers in different components.

## Basic Usage

### 1. Import and Initialize

```typescript
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

const MyComponent = () => {
  const handlers = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
  });

  // Use handlers...
};
```

### 2. Individual Newsletter Actions

```typescript
// Mark as read/unread
await handlers.handleMarkAsRead(newsletterId);
await handlers.handleMarkAsUnread(newsletterId);

// Toggle read status based on current state
await handlers.handleToggleRead(newsletter);

// Like/unlike
await handlers.handleToggleLike(newsletter);

// Archive/unarchive
await handlers.handleToggleArchive(newsletter);
await handlers.handleToggleArchive(newsletter, true); // Force archive
await handlers.handleToggleArchive(newsletter, false); // Force unarchive

// Delete
await handlers.handleDeleteNewsletter(newsletterId);

// Reading queue
await handlers.handleToggleInQueue(newsletter);
await handlers.handleAddToQueue(newsletterId);
await handlers.handleRemoveFromQueue(queueItemId);
```

### 3. Bulk Operations

```typescript
const selectedIds = ['id1', 'id2', 'id3'];

// Bulk read status
await handlers.handleBulkMarkAsRead(selectedIds);
await handlers.handleBulkMarkAsUnread(selectedIds);

// Bulk archive
await handlers.handleBulkArchive(selectedIds);
await handlers.handleBulkUnarchive(selectedIds);

// Bulk delete
await handlers.handleBulkDelete(selectedIds);
```

## Integration Examples

### Newsletter List Component (Inbox/NewslettersPage)

```typescript
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

const NewsletterList = ({ newsletters }: { newsletters: NewsletterWithRelations[] }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const handlers = useSharedNewsletterActions({
    showToasts: true,
    optimisticUpdates: true,
    onSuccess: () => {
      // Optional: Clear selection after successful bulk operation
      setSelectedIds(new Set());
    },
    onError: (error) => {
      console.error('Newsletter action failed:', error);
    },
  });

  const handleBulkAction = async (action: 'read' | 'unread' | 'archive' | 'delete') => {
    const ids = Array.from(selectedIds);
    
    switch (action) {
      case 'read':
        await handlers.handleBulkMarkAsRead(ids);
        break;
      case 'unread':
        await handlers.handleBulkMarkAsUnread(ids);
        break;
      case 'archive':
        await handlers.handleBulkArchive(ids);
        break;
      case 'delete':
        await handlers.handleBulkDelete(ids);
        break;
    }
  };

  return (
    <div>
      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="bulk-actions">
          <button onClick={() => handleBulkAction('read')}>
            Mark Read ({selectedIds.size})
          </button>
          <button onClick={() => handleBulkAction('archive')}>
            Archive ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Newsletter list */}
      {newsletters.map((newsletter) => (
        <NewsletterRow
          key={newsletter.id}
          newsletter={newsletter}
          handlers={handlers}
          isSelected={selectedIds.has(newsletter.id)}
          onToggleSelect={(id) => {
            const newSelection = new Set(selectedIds);
            if (newSelection.has(id)) {
              newSelection.delete(id);
            } else {
              newSelection.add(id);
            }
            setSelectedIds(newSelection);
          }}
        />
      ))}
    </div>
  );
};
```

### Newsletter Row Component

```typescript
interface NewsletterRowProps {
  newsletter: NewsletterWithRelations;
  handlers: ReturnType<typeof useSharedNewsletterActions>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const NewsletterRow = ({ newsletter, handlers, isSelected, onToggleSelect }: NewsletterRowProps) => {
  // Get all action handlers for this specific newsletter
  const rowActions = handlers.handleNewsletterRowActions(newsletter);

  return (
    <div className="newsletter-row">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(newsletter.id)}
      />
      
      <div className="newsletter-content">
        <h3>{newsletter.title}</h3>
        <p>{newsletter.summary}</p>
      </div>

      <div className="newsletter-actions">
        <button
          onClick={rowActions.onToggleRead}
          disabled={handlers.isMarkingAsRead || handlers.isMarkingAsUnread}
        >
          {newsletter.is_read ? 'Mark Unread' : 'Mark Read'}
        </button>

        <button
          onClick={rowActions.onToggleLike}
          className={newsletter.is_liked ? 'liked' : ''}
        >
          {newsletter.is_liked ? 'Unlike' : 'Like'}
        </button>

        <button onClick={rowActions.onToggleArchive}>
          {newsletter.is_archived ? 'Unarchive' : 'Archive'}
        </button>

        <button onClick={rowActions.onToggleQueue}>
          {newsletter.is_bookmarked ? 'Remove from Queue' : 'Add to Queue'}
        </button>

        <button 
          onClick={rowActions.onTrash}
          disabled={handlers.isDeletingNewsletter}
          className="danger"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
```

### Custom Options and Error Handling

```typescript
const CustomComponent = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handlers = useSharedNewsletterActions({
    showToasts: false, // Handle toasts manually
    optimisticUpdates: true,
    onSuccess: (newsletter) => {
      console.log('Action succeeded:', newsletter);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Action failed:', error);
      setIsLoading(false);
      // Show custom error UI
    },
  });

  const handleCustomAction = async (newsletter: NewsletterWithRelations) => {
    setIsLoading(true);
    
    try {
      await handlers.handleToggleLike(newsletter, {
        showToasts: true, // Override default for this action
        onSuccess: () => {
          // Custom success handling for this specific action
          console.log('Newsletter liked!');
        },
      });
    } catch (error) {
      // Error is already handled by the shared handler
    }
  };

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {/* Component content */}
    </div>
  );
};
```

### Replacing Existing Handlers

#### Before (Individual handlers in component):
```typescript
const OldComponent = () => {
  const { markAsRead, toggleLike, toggleArchive } = useNewsletters();

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      toast.success('Marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleLike = async (newsletter: NewsletterWithRelations) => {
    try {
      await toggleLike(newsletter.id);
      toast.success(newsletter.is_liked ? 'Unliked' : 'Liked');
    } catch (error) {
      toast.error('Failed to toggle like');
    }
  };

  // More handlers...
};
```

#### After (Using shared handlers):
```typescript
const NewComponent = () => {
  const handlers = useSharedNewsletterActions();

  // That's it! All the error handling, toasts, and optimistic updates
  // are handled automatically by the shared handlers
  
  // Use like this:
  // await handlers.handleMarkAsRead(id);
  // await handlers.handleToggleLike(newsletter);
};
```

## Loading States

```typescript
const ComponentWithLoading = () => {
  const handlers = useSharedNewsletterActions();

  return (
    <div>
      <button 
        onClick={() => handlers.handleMarkAsRead(id)}
        disabled={handlers.isMarkingAsRead}
      >
        {handlers.isMarkingAsRead ? 'Marking...' : 'Mark as Read'}
      </button>

      <button 
        onClick={() => handlers.handleBulkArchive(selectedIds)}
        disabled={handlers.isBulkArchiving}
      >
        {handlers.isBulkArchiving ? 'Archiving...' : 'Archive Selected'}
      </button>
    </div>
  );
};
```

## Migration Strategy

1. **Replace individual action calls** with shared handler calls
2. **Remove custom error handling** - it's built into shared handlers
3. **Remove custom toast notifications** - handled automatically
4. **Use built-in loading states** instead of local state
5. **Leverage bulk operations** for better UX

## Benefits

- ✅ **Consistent behavior** across all components
- ✅ **Automatic optimistic updates** with rollback on error
- ✅ **Built-in error handling** and user feedback
- ✅ **Reduced code duplication**
- ✅ **Better performance** through cache management
- ✅ **Type safety** and better developer experience