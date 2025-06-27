# Navigation Context and Cache Filter Bug Report

## Bug Summary

**Date Reported**: June 27, 2025  
**Severity**: High  
**Status**: ✅ RESOLVED  
**Affected Components**: Newsletter Navigation, Cache System, Filter Normalization

## Problem Description

### Primary Issue
When navigating from the inbox page with active filters (e.g., "liked", "unread"), the newsletter detail page's navigation component was showing **all inbox items** instead of respecting the current filter context. Additionally, the system was making unnecessary Supabase API calls instead of using cached data.

### User Impact
- Navigation arrows in newsletter detail view showed incorrect newsletters
- Poor performance due to bypassing cache
- Inconsistent user experience when filtering newsletters

## Root Cause Analysis

### 1. Filter Context Loss
**Problem**: The navigation state wasn't properly preserving filter context when navigating from inbox to newsletter detail.

**Technical Details**:
- `NewsletterNavigation` component was using default inbox filters from `useInboxFilters` hook
- Filter context (like "liked", "unread") was not being passed in navigation state
- Navigation between newsletters lost the original filter context

### 2. Cache Key Mismatch
**Problem**: Cache keys were inconsistent due to filter key format mismatches.

**Technical Details**:
- Database queries expected **camelCase** keys (`isLiked`, `isArchived`)
- Filter objects used **snake_case** keys (`is_liked`, `is_archived`)
- Cache key generation used different formats, causing cache misses

### 3. UUID Validation Issues
**Problem**: Invalid UUID values were being passed to database queries, causing errors.

**Error Messages**:
```
SupabaseError: invalid input syntax for type uuid: "2"
SupabaseError: invalid input syntax for type uuid: "c"
```

**Technical Details**:
- Filter normalization wasn't validating UUID format
- Single `source_id` values weren't being converted to arrays properly
- Invalid values reached the database layer

## Solutions Implemented

### 1. Enhanced Filter Context Preservation

**File**: `src/web/pages/Inbox.tsx`
```typescript
// Modified navigation call to include filter context
navigate(targetPath, {
  state: {
    from: '/inbox',
    fromInbox: true,
    currentFilter: filter,
    sourceFilter: sourceFilter,
    timeRange: timeRange,
    tagIds: debouncedTagIds,
  },
});
```

**File**: `src/components/NewsletterDetail/NewsletterNavigation.tsx`
```typescript
// Added filter context detection and usage
const isFromInboxWithFilter = location.state?.fromInbox && location.state?.currentFilter;

if (isFromInboxWithFilter) {
  const inboxFilter: NewsletterFilter = {
    is_read: location.state.currentFilter === 'unread' ? false : undefined,
    is_archived: location.state.currentFilter === 'archived' ? true : undefined,
    is_liked: location.state.currentFilter === 'liked' ? true : undefined,
    source_id: location.state.sourceFilter || undefined,
    tag_ids: location.state.tagIds && location.state.tagIds.length > 0 ? location.state.tagIds : undefined,
  };
  
  return {
    enabled: !disabled,
    preloadAdjacent: true,
    overrideFilter: inboxFilter,
  };
}
```

### 2. Filter Normalization System

**File**: `src/common/utils/newsletterUtils.ts`
```typescript
// Created comprehensive filter normalization utility
export function normalizeNewsletterFilter(filter: any): any {
  const mapping: Record<string, string> = {
    is_liked: 'isLiked',
    is_archived: 'isArchived',
    is_read: 'isRead',
    tag_ids: 'tagIds',
    source_id: 'sourceIds',
    // ... other mappings
  };
  
  // Handle special cases for array fields with UUID validation
  if (newKey === 'sourceIds' && value !== undefined) {
    if (typeof value === 'string') {
      if (isValidUUID(value)) {
        result[newKey] = [value];
      } else {
        continue; // Skip invalid UUIDs
      }
    } else if (Array.isArray(value)) {
      result[newKey] = value.filter(id => isValidUUID(id));
    }
  }
  
  return result;
}

// Added UUID validation helper
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

### 3. Cache Consistency Implementation

**Files Modified**:
- `src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts`
- `src/common/hooks/useNewsletterNavigation.ts`
- `src/common/hooks/useNewsletters.ts`

**Implementation**:
```typescript
// Applied normalization to all newsletter query hooks
const normalizedFilters = useMemo(() => normalizeNewsletterFilter(filters), [filters]);

// Generate query key with normalized filters
const queryKey = useMemo(() => queryKeyFactory.newsletters.infinite(normalizedFilters), [normalizedFilters]);

// Build API query parameters from normalized filters
const queryParams = useMemo(() => ({
  isLiked: normalizedFilters.isLiked,
  isArchived: normalizedFilters.isArchived,
  isRead: normalizedFilters.isRead,
  // ... other normalized parameters
}), [normalizedFilters]);
```

## Testing and Verification

### Test Cases
1. **Filter Context Preservation**:
   - Navigate from "liked" filter to newsletter detail
   - Verify navigation arrows only show liked newsletters
   - Test with "unread", "archived" filters

2. **Cache Usage**:
   - Monitor network requests in browser dev tools
   - Verify subsequent queries use cached data
   - Check cache key consistency

3. **UUID Validation**:
   - Test with invalid filter values
   - Verify no database errors occur
   - Confirm invalid values are filtered out

### Expected Results
- ✅ Navigation respects current filter context
- ✅ Cache is used instead of unnecessary API calls
- ✅ No UUID validation errors
- ✅ Consistent filtering across all components

## Performance Impact

### Before Fix
- Multiple unnecessary Supabase API calls
- Cache misses due to key mismatches
- Database errors causing failed requests

### After Fix
- Efficient cache usage
- Consistent query key generation
- Proper UUID validation preventing errors
- Improved user experience with correct navigation

## Prevention Measures

### Code Quality
1. **Type Safety**: Use TypeScript interfaces for filter objects
2. **Validation**: Implement input validation at filter boundaries
3. **Testing**: Add unit tests for filter normalization
4. **Documentation**: Document expected filter formats

### Monitoring
1. **Error Tracking**: Monitor for UUID validation errors
2. **Performance**: Track cache hit rates
3. **User Feedback**: Monitor navigation-related user complaints

## Related Issues

- **Cache Invalidation**: Ensure cache invalidation works with normalized keys
- **Filter Persistence**: Consider persisting filter state in URL parameters
- **Performance Optimization**: Monitor query performance with new normalization

## Conclusion

This bug was caused by inconsistencies in filter handling across the application. The solution provides:

1. **Consistent filter normalization** across all components
2. **Proper context preservation** during navigation
3. **Robust UUID validation** to prevent database errors
4. **Improved cache efficiency** through consistent key generation

The fix ensures that navigation works correctly while maintaining good performance through proper cache utilization. 