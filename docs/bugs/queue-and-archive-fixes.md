# Newsletter Queue Removal and Auto-Archive Fixes

This document summarizes the fixes implemented to resolve two critical issues:
1. Newsletter queue removal not persisting after page reload
2. Auto-archive showing toast but not actually archiving the newsletter

## Issues Fixed

### 1. Queue Removal Not Persisting

**Problem**: When removing a newsletter from the reading queue, the UI would update but after refreshing the page, the newsletter would still be in the queue.

**Root Cause**: The `handleToggleInQueue` function in `useSharedNewsletterActions.ts` was not passing the `isInQueue` parameter to the handler. It was only passing the newsletter ID, so the handler didn't know whether to add or remove the item.

**Fix Applied**:
```typescript
// Before (broken):
await handlers.toggleInQueue(newsletterId);

// After (fixed):
await sharedHandlers.toggleInQueue(newsletter, isInQueue, mergedOptions);
```

### 2. Auto-Archive Not Working

**Problem**: The auto-archive feature would show a success toast after 3 seconds, but the newsletter wouldn't actually be archived in the database.

**Root Causes**:
1. The `NewsletterService.toggleArchive` method was treating the API response as a boolean when it actually returns a `NewsletterWithRelations` object
2. The `toggleArchiveMutation` wasn't checking the service result for success/failure
3. The detail query was being invalidated with `refetchType: 'none'`, preventing the UI from updating

**Fixes Applied**:

#### Fix 1: NewsletterService.ts
```typescript
// Before:
const success = await this.withRetry(
  () => newsletterApi.toggleArchive(id),
  'toggleArchive'
);
if (!success) {

// After:
const updatedNewsletter = await this.withRetry(
  () => newsletterApi.toggleArchive(id),
  'toggleArchive'
);
if (!updatedNewsletter) {
```

#### Fix 2: useNewsletters.ts - Toggle Archive Mutation
```typescript
// Before:
mutationFn: async (id: string) => {
  await newsletterService.toggleArchive(id);
  return true;
},

// After:
mutationFn: async (id: string) => {
  const result = await newsletterService.toggleArchive(id);
  if (!result.success) {
    throw new Error(result.error || 'Failed to toggle archive status');
  }
  return true;
},
```

#### Fix 3: useNewsletters.ts - Query Invalidation
```typescript
// Before:
queryClient.invalidateQueries({
  queryKey: queryKeyFactory.newsletters.detail(id),
  refetchType: 'none', // Don't refetch automatically
});

// After:
queryClient.invalidateQueries({
  queryKey: queryKeyFactory.newsletters.detail(id),
  refetchType: 'active', // Actively refetch to ensure detail page updates
});
```

#### Fix 4: NewsletterDetail.tsx - Effect Dependencies
Added missing dependencies to prevent stale closures:
```typescript
// Auto-archive effect:
}, [newsletter?.id, newsletter?.is_read, newsletter?.is_archived, handleToggleArchive, log]);

// Auto-mark-as-read effect:
}, [newsletter?.id, handleMarkAsRead, log, hasAutoMarkedAsRead]);
```

## Files Modified

1. **src/common/hooks/useSharedNewsletterActions.ts**
   - Fixed `handleToggleInQueue` to pass all required parameters
   - Updated dependencies array

2. **src/common/services/newsletter/NewsletterService.ts**
   - Fixed `toggleArchive` to properly handle API response type
   - Use the actual `updatedNewsletter` object instead of treating it as boolean

3. **src/common/hooks/useNewsletters.ts**
   - Added error checking in `toggleArchiveMutation`
   - Changed detail query invalidation to actively refetch

4. **src/web/pages/NewsletterDetail.tsx**
   - Added missing dependencies to useEffect hooks
   - Ensures effects have access to current values

## Verification

Both issues have been verified as fixed:
- Queue removal now correctly persists after page reload
- Auto-archive successfully archives newsletters after the 3-second delay
- All related tests are passing

## Technical Details

### Queue Removal Flow
1. UI determines current queue status (`isInQueue`)
2. Calls `handleToggleInQueue(newsletter, isInQueue)`
3. Handler now correctly passes both parameters to `sharedHandlers.toggleInQueue`
4. The handler knows whether to add or remove based on `isInQueue` value
5. Database operation succeeds and persists

### Auto-Archive Flow
1. Newsletter detail page loads a read, non-archived newsletter
2. After 3 seconds, auto-archive effect triggers
3. Calls `handleToggleArchive(newsletter)`
4. Service properly handles the API response
5. Mutation checks for success before proceeding
6. Detail query is actively refetched, updating the UI
7. Newsletter is successfully archived in the database