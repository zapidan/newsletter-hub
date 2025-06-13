# NewsletterHub Migration Guide

## Overview

This comprehensive guide documents all migrations in the NewsletterHub application, with a primary focus on the API layer migration from direct Supabase database calls to a centralized API architecture. This migration provides better separation of concerns, consistent error handling, performance monitoring, and improved maintainability.

## Table of Contents

- [API Layer Migration](#api-layer-migration)
- [Component Migrations](#component-migrations)
- [Hook Migrations](#hook-migrations)
- [Utility Migrations](#utility-migrations)
- [Documentation Consolidation](#documentation-consolidation)
- [Breaking Changes](#breaking-changes)
- [Migration Timeline](#migration-timeline)

## API Layer Migration

### Migration Summary

#### What Was Migrated

1. **API Services Created**:
   - `newsletterApi.ts` - Complete newsletter CRUD operations
   - `readingQueueApi.ts` - Reading queue management
   - `tagApi.ts` - Tag CRUD operations and associations
   - `newsletterSourceGroupApi.ts` - Source group management
   - `userApi.ts` - User profile and email alias operations
   - `newsletterSourceApi.ts` - Newsletter source management

2. **Hooks Updated**:
   - `useUnreadCount.ts` - Now uses `newsletterApi` instead of direct Supabase
   - `useReadingQueue.ts` - Now uses `readingQueueApi`
   - `useTags.ts` - Now uses `tagApi`
   - `useNewsletterSourceGroups.ts` - Now uses `newsletterSourceGroupApi`

3. **Components Refactored**:
   - `TagsPage.tsx` - Replaced direct Supabase calls with API services
   - Various other components updated to use centralized API layer

4. **Utilities Refactored**:
   - `emailAlias.ts` - Now uses `userApi`
   - `tagUtils.ts` - Now uses `tagApi`

#### Architecture Changes

**Before:**
```
Components/Hooks → Direct Supabase Calls → Database
```

**After:**
```
Components/Hooks → API Services → Enhanced Supabase Client → Database
```

#### Key Benefits

- ✅ **Consistent Error Handling**: All database errors processed uniformly
- ✅ **Performance Monitoring**: Automatic logging and timing of operations
- ✅ **Better Type Safety**: Full TypeScript support throughout data layer
- ✅ **Improved Testing**: Mock at API service level instead of database
- ✅ **Centralized Security**: Authentication and authorization in one place
- ✅ **Easier Maintenance**: Single point of truth for data access patterns

## Component Migrations

### useUnreadCount Hook Migration

**File**: `src/common/hooks/useUnreadCount.ts`

**Changes Made**:
- Replaced direct Supabase query with `newsletterApi.getStats()` and `newsletterApi.getAll()`
- Simplified error handling by leveraging API service error processing
- Maintained existing cache and performance characteristics

**Before:**
```typescript
const { count, error } = await supabase
  .from("newsletters")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id)
  .eq("is_read", false)
  .eq("is_archived", false);

if (error) {
  console.error("Error fetching unread count:", error);
  throw error;
}

return count || 0;
```

**After:**
```typescript
try {
  const unreadNonArchived = await newsletterApi.getAll({
    isRead: false,
    isArchived: false,
    limit: 1, // We only need the count, not the actual data
  });

  return unreadNonArchived.count || 0;
} catch (error) {
  console.error("Error fetching unread count:", error);
  throw error;
}
```

### TagsPage Component Migration

**File**: `src/web/pages/TagsPage.tsx`

**Changes Made**:
- Replaced direct Supabase calls with `tagApi.getTagUsageStats()` and `newsletterApi.getAll()`
- Simplified data fetching logic by leveraging API service transformations
- Improved type safety and error handling

**Before:**
```typescript
// Multiple separate queries to Supabase
const { data, error } = await supabase
  .from("newsletter_tags")
  .select("newsletter_id, tag_id");

const { data: newslettersData, error: newslettersError } = await supabase
  .from("newsletters")
  .select(`
    *,
    newsletter_source_id,
    source:newsletter_sources(*),
    newsletter_tags(tag:tags(*))
  `);

// Complex data transformation logic
```

**After:**
```typescript
// Single API call with built-in transformations
const tagsWithUsageData = await tagApi.getTagUsageStats();

const newslettersResponse = await newsletterApi.getAll({
  includeSource: true,
  includeTags: true,
  limit: 1000,
});
```

## Hook Migrations

### General Hook Migration Pattern

**Step 1: Replace Supabase Imports**
```typescript
// Before
import { supabase } from '@common/services/supabaseClient';

// After
import { newsletterApi } from '@common/api/newsletterApi';
import { tagApi } from '@common/api/tagApi';
```

**Step 2: Simplify Query Functions**
```typescript
// Before
const fetchData = useCallback(async () => {
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error:', error);
    throw error;
  }

  return data || [];
}, [user]);

// After
const fetchData = useCallback(async () => {
  return await yourApi.getAll();
}, []);
```

**Step 3: Update Mutations**
```typescript
// Before
const createMutation = useMutation({
  mutationFn: async (params) => {
    const { data, error } = await supabase
      .from('your_table')
      .insert([{ ...params, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// After
const createMutation = useMutation({
  mutationFn: yourApi.create,
});
```

## Utility Migrations

### Email Alias Utility Migration

**File**: `src/common/utils/emailAlias.ts`

**Changes Made**:
- Moved database operations to `userApi`
- Simplified error handling and data transformation

**Before:**
```typescript
export async function getUserEmailAlias(user: User): Promise<string> {
  const { data: userData } = await supabase
    .from('users')
    .select('email_alias')
    .eq('id', user.id)
    .single();
    
  if (userData?.email_alias) {
    return userData.email_alias;
  }
  
  // Generate new alias logic...
  const { email } = await generateEmailAlias(user.id, user.email);
  return email;
}
```

**After:**
```typescript
import { userApi } from "../api/userApi";

export async function getUserEmailAlias(user: User): Promise<string> {
  return await userApi.getEmailAlias();
}
```

### Tag Utilities Migration

**File**: `src/common/utils/tagUtils.ts`

**Changes Made**:
- Replaced direct database operations with `tagApi` calls
- Leveraged API service's built-in validation and error handling

## Documentation Consolidation

### New Documentation Structure

1. **ADR (Architectural Decision Record)**
   - `docs/adr/0001-api-architecture.md` - Documents the decision to centralize API access

2. **Comprehensive Guides**
   - `docs/API_GUIDE.md` - Complete guide to using the API layer
   - `docs/API_ACCESS_PATTERNS.md` - Approved patterns for API usage
   - `docs/API_VERSIONING.md` - Versioning strategy and deprecation policy

3. **Consolidated Migration Guide**
   - This document now serves as the single source of truth for all migrations

### Documentation Improvements

- **Single Source of Truth**: All API-related documentation consolidated
- **Clear Examples**: Comprehensive before/after examples for each migration type
- **Best Practices**: Documented patterns for consistent API usage
- **Version Management**: Clear strategy for handling API changes

## Migration Process

### For New Features

When adding new features, follow this process:

**Step 1: Create API Service**
```typescript
// src/common/api/newFeatureApi.ts
export const newFeatureApi = {
  async getAll(): Promise<YourType[]> {
    return withPerformanceLogging('newFeature.getAll', async () => {
      const user = await requireAuth();
      const { data, error } = await supabase
        .from('your_table')
        .select('*')
        .eq('user_id', user.id);
      if (error) handleSupabaseError(error);
      return data || [];
    });
  },
  // ... other CRUD operations
};
```

**Step 2: Add to API Index**
```typescript
// src/common/api/index.ts
export { newFeatureApi } from './newFeatureApi';
```

**Step 3: Create React Hook**
```typescript
// src/common/hooks/useNewFeature.ts
export const useNewFeature = () => {
  return useQuery({
    queryKey: ['newFeature'],
    queryFn: () => newFeatureApi.getAll(),
  });
};
```

**Step 4: Use in Components**
```typescript
// src/components/NewFeatureComponent.tsx
const { data, isLoading, error } = useNewFeature();
```

### Testing Migration

1. **Unit Tests**: Mock API services instead of Supabase
2. **Integration Tests**: Test API service functionality
3. **Manual Testing**: Verify UI functionality is preserved

## Migration Examples

### Example 1: Reading Queue Migration

**Before (useReadingQueue.ts):**
```typescript
const fetchReadingQueue = useCallback(async (userId: string) => {
  const { data: queueItems, error: queueError } = await supabase
    .from("reading_queue")
    .select(`
      *,
      newsletters (
        *,
        newsletter_sources (*)
      )
    `)
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (queueError) throw queueError;
  
  // Complex transformation logic...
  return transformedItems;
}, []);
```

**After (useReadingQueue.ts):**
```typescript
import { readingQueueApi } from "@common/api/readingQueueApi";

const fetchReadingQueue = useCallback(async (userId: string) => {
  return await readingQueueApi.getAll();
}, []);
```

### Example 2: Tag Operations Migration

**Before (useTags.ts):**
```typescript
const createTag = useCallback(async (tag: TagCreate) => {
  const { data, error } = await supabase
    .from("tags")
    .insert([{ ...tag, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  
  // Manual cache invalidation
  await invalidateQueries({ queryKey: ["tags"] });
  
  return data;
}, [user]);
```

**After (useTags.ts):**
```typescript
import { tagApi } from "@common/api/tagApi";

const createTag = useCallback(async (tag: TagCreate) => {
  return await tagApi.create(tag);
}, []);
```

### Example 3: Email Alias Migration

**Before (emailAlias.ts):**
```typescript
export async function getUserEmailAlias(user: User): Promise<string> {
  const { data: userData } = await supabase
    .from('users')
    .select('email_alias')
    .eq('id', user.id)
    .single();
    
  if (userData?.email_alias) {
    return userData.email_alias;
  }
  
  // Generate new alias logic...
  const { email } = await generateEmailAlias(user.id, user.email);
  return email;
}
```

**After (emailAlias.ts):**
```typescript
import { userApi } from "../api/userApi";

export async function getUserEmailAlias(user: User): Promise<string> {
  return await userApi.getEmailAlias();
}
```

## Common Patterns

### 1. Error Handling Pattern

All API services follow this error handling pattern:

```typescript
async someOperation(): Promise<ResultType> {
  return withPerformanceLogging('service.operation', async () => {
    const user = await requireAuth();

    const { data, error } = await supabase
      .from('table')
      .select('*');

    if (error) handleSupabaseError(error);
    return data;
  });
}
```

### 2. User Authentication Pattern

Always require authentication for user-specific operations:

```typescript
async getUserData(): Promise<UserData> {
  const user = await requireAuth(); // Throws if not authenticated
  
  const { data, error } = await supabase
    .from('user_table')
    .select('*')
    .eq('user_id', user.id); // Always filter by user
    
  if (error) handleSupabaseError(error);
  return data;
}
```

### 3. Performance Monitoring Pattern

Wrap operations with performance logging:

```typescript
async performOperation(): Promise<Result> {
  return withPerformanceLogging('service.operation', async () => {
    // Your operation here
  });
}
```

### 4. Data Transformation Pattern

Keep transformations in the API layer:

```typescript
const transformRawData = (rawData: any): CleanType => {
  return {
    id: rawData.id,
    name: rawData.name,
    // Transform nested relations
    relatedItems: rawData.related?.map(item => transformRelated(item)) || [],
  };
};

async getAll(): Promise<CleanType[]> {
  // ... fetch data
  return (data || []).map(transformRawData);
}
```

## Best Practices

### 1. API Service Design

- **Single Responsibility**: Each API service handles one domain
- **Consistent Interface**: Follow CRUD patterns (getAll, getById, create, update, delete)
- **Error Handling**: Always use `handleSupabaseError`
- **Performance**: Wrap operations with `withPerformanceLogging`
- **Authentication**: Use `requireAuth` for user-specific operations

### 2. Hook Updates

- **Simplify Logic**: Move complex operations to API services
- **Error Handling**: Let API services handle errors, focus on UI error display
- **Performance**: Remove custom performance tracking (handled by API layer)

### 3. Utility Functions

- **Delegate to APIs**: Don't duplicate database logic
- **Focus on Logic**: Keep utilities for business logic, not data access
- **Type Safety**: Leverage API service types

### 4. Testing

- **Mock Services**: Mock at the API service level, not Supabase
- **Test Contracts**: Verify API service interfaces don't break
- **Integration Tests**: Test the full API → Database flow

## Troubleshooting

### Common Issues During Migration

1. **Authentication Errors**
   ```
   Error: User not authenticated
   ```
   **Solution**: Ensure user is logged in before calling API methods

2. **Import Errors**
   ```
   Cannot resolve module '@common/api/newApi'
   ```
   **Solution**: Add export to `src/common/api/index.ts`

3. **Type Errors**
   ```
   Property 'newMethod' does not exist on type 'ApiService'
   ```
   **Solution**: Update type definitions and ensure proper exports

4. **Performance Regressions**
   ```
   API calls taking longer than expected
   ```
   **Solution**: Check for N+1 queries, optimize select statements

### Testing Migration

1. **Before Migration**: Take screenshots/recordings of functionality
2. **During Migration**: Test each component as you migrate it
3. **After Migration**: Full regression testing
4. **Performance**: Compare before/after performance metrics

### Rollback Strategy

If issues arise:

1. **Identify Problem**: Check browser console and network tab
2. **Quick Fix**: Revert specific file if possible
3. **Full Rollback**: Revert to previous commit
4. **Fix Forward**: Prefer fixing issues over rolling back

## Future Considerations

### Extending the Pattern

When adding new features:

1. **Create API Service First**: Design the API interface
2. **Add Types**: Define proper TypeScript interfaces
3. **Implement CRUD**: Follow established patterns
4. **Add to Index**: Export from main API index
5. **Write Tests**: Test the API service
6. **Use in Hooks**: Consume the API in React hooks

### Performance Optimization

- **Caching**: Consider adding response caching for read-heavy operations
- **Batching**: Implement batch operations for bulk updates
- **Pagination**: Always implement pagination for large datasets
- **Subscriptions**: Use Supabase realtime for live updates

### Monitoring

- **Error Tracking**: Monitor API errors in production
- **Performance**: Track API response times
- **Usage**: Monitor which APIs are used most frequently

## Migration Status

### ✅ Completed

1. **API Services Created**:
   - ✅ `readingQueueApi.ts` - Complete CRUD operations for reading queue
   - ✅ `tagApi.ts` - Complete tag management with newsletter associations
   - ✅ `newsletterSourceGroupApi.ts` - Source group management
   - ✅ `userApi.ts` - User profile and email alias operations

2. **Hooks Updated**:
   - ✅ `useReadingQueue.ts` - Migrated to use readingQueueApi
   - ✅ `useTags.ts` - Migrated to use tagApi
   - ✅ `useNewsletterSourceGroups.ts` - Migrated to use newsletterSourceGroupApi

3. **Utilities Refactored**:
   - ✅ `emailAlias.ts` - Now uses userApi for database operations
   - ✅ `tagUtils.ts` - Refactored to use tagApi

4. **Documentation**:
   - ✅ API documentation created in `docs/api/README.md`
   - ✅ Migration guide created
   - ✅ Examples and best practices documented

## Breaking Changes

### API Layer Changes

1. **Hook Return Types**
   - Some hooks now return paginated responses instead of raw arrays
   - Components may need updates to handle new response structure

2. **Error Handling**
   - Errors are now processed consistently through API services
   - Some error messages and codes may have changed

3. **Import Changes**
   - Direct Supabase imports should be replaced with API service imports
   - Utility functions may have different signatures

### Migration Checklist

- [ ] Update all direct Supabase imports to use API services
- [ ] Update hook usage to handle new response types
- [ ] Update error handling to work with new error formats
- [ ] Update tests to mock API services instead of Supabase
- [ ] Verify all functionality works as expected

## Migration Timeline

### Phase 1: Core Migration (Completed)
- ✅ Created API service layer
- ✅ Migrated key hooks (`useUnreadCount`, `useTags`, etc.)
- ✅ Updated critical components (`TagsPage`)
- ✅ Refactored utility functions

### Phase 2: Documentation & Patterns (Completed)
- ✅ Created ADR for API architecture
- ✅ Consolidated API documentation
- ✅ Established access patterns
- ✅ Created versioning strategy

### Phase 3: Remaining Tasks (In Progress)

1. **Type Safety Improvements**:
   - Address remaining TypeScript errors
   - Improve type consistency across API services
   - Add better type guards for API responses

2. **Testing Updates**:
   - Update existing tests to mock API services
   - Add integration tests for API endpoints
   - Create test utilities for API mocking

3. **Performance Optimization**:
   - Implement better cache invalidation strategies
   - Add request deduplication
   - Optimize query patterns

4. **Complete Component Migration**:
   - Identify remaining components with direct Supabase calls
   - Migrate remaining utilities
   - Remove unused Supabase imports

### Phase 4: Future Enhancements (Planned)

1. **Advanced Features**:
   - Implement offline support
   - Add request retry mechanisms
   - Implement batch operations

2. **Monitoring & Analytics**:
   - Add performance monitoring dashboard
   - Implement error tracking
   - Add usage analytics

3. **Developer Experience**:
   - Create API service generator
   - Add development tools
   - Improve debugging capabilities

## Next Steps

1. **Fix Remaining Issues**: Address any remaining TypeScript errors and warnings
2. **Complete Testing**: Update all tests to use new API patterns
3. **Performance Verification**: Ensure API layer doesn't introduce performance regressions
4. **Team Training**: Educate team members on new API patterns and conventions
5. **Documentation Updates**: Keep documentation current as the system evolves

## Conclusion

The API layer migration provides:

- **Better Architecture**: Clear separation between UI and data logic
- **Consistent Patterns**: Standardized error handling and performance monitoring
- **Improved Maintainability**: Centralized data access logic
- **Type Safety**: Better TypeScript support
- **Testing**: Easier to mock and test

This migration sets the foundation for scalable, maintainable data access patterns throughout the application. The core migration is complete and functional, with some polish and optimization work remaining.