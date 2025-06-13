# API Layer Migration Guide

## Overview

This guide documents the migration from direct Supabase database calls to a centralized API layer architecture. The migration provides better separation of concerns, consistent error handling, performance monitoring, and improved maintainability.

## Migration Summary

### What Was Migrated

1. **API Services Created**:
   - `readingQueueApi.ts` - Reading queue management
   - `tagApi.ts` - Tag CRUD operations
   - `newsletterSourceGroupApi.ts` - Source group management
   - `userApi.ts` - User profile and email alias operations

2. **Hooks Updated**:
   - `useReadingQueue.ts` - Now uses `readingQueueApi`
   - `useTags.ts` - Now uses `tagApi`
   - `useNewsletterSourceGroups.ts` - Now uses `newsletterSourceGroupApi`

3. **Utilities Refactored**:
   - `emailAlias.ts` - Now uses `userApi`
   - `tagUtils.ts` - Now uses `tagApi`

### Architecture Changes

**Before:**
```
Components/Hooks → Direct Supabase Calls → Database
```

**After:**
```
Components/Hooks → API Services → Enhanced Supabase Client → Database
```

## Migration Process

### Step 1: Analyze Current Implementation

Before migrating, analyze the existing code to understand:
- What database operations are being performed
- Error handling patterns
- Performance considerations
- Data transformation needs

### Step 2: Create API Service

Follow this template for creating new API services:

```typescript
// Example: newFeatureApi.ts
import { supabase, handleSupabaseError, requireAuth, withPerformanceLogging } from './supabaseClient';
import { YourType } from '../types';

export const newFeatureApi = {
  // Get all items
  async getAll(): Promise<YourType[]> {
    return withPerformanceLogging('newFeature.getAll', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('your_table')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Create item
  async create(params: CreateParams): Promise<YourType> {
    return withPerformanceLogging('newFeature.create', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('your_table')
        .insert([{ ...params, user_id: user.id }])
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update item
  async update(params: UpdateParams): Promise<YourType> {
    return withPerformanceLogging('newFeature.update', async () => {
      const user = await requireAuth();

      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from('your_table')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Delete item
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging('newFeature.delete', async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from('your_table')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },
};

export default newFeatureApi;
```

### Step 3: Update API Index

Add your new service to `src/common/api/index.ts`:

```typescript
// Import the service
export {
  newFeatureApi,
  getAllItems,
  createItem,
  updateItem,
  deleteItem,
  default as newFeatureService,
} from './newFeatureApi';
```

### Step 4: Update Hooks

Replace direct Supabase calls with API service calls:

**Before:**
```typescript
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
```

**After:**
```typescript
import { newFeatureApi } from '@common/api/newFeatureApi';

const fetchData = useCallback(async () => {
  return await newFeatureApi.getAll();
}, []);
```

### Step 5: Update Mutations

Replace mutation logic with API calls:

**Before:**
```typescript
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
  onSuccess: () => {
    queryClient.invalidateQueries(['your_table']);
  },
});
```

**After:**
```typescript
const createMutation = useMutation({
  mutationFn: async (params) => {
    return await newFeatureApi.create(params);
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['your_table']);
  },
});
```

### Step 6: Update Utilities

Move database operations from utilities to API services:

**Before (in utility file):**
```typescript
export const updateRelatedData = async (id: string, data: any, userId: string) => {
  const { error } = await supabase
    .from('related_table')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
};
```

**After (utility uses API):**
```typescript
import { newFeatureApi } from '@common/api/newFeatureApi';

export const updateRelatedData = async (id: string, data: any) => {
  return await newFeatureApi.update({ id, ...data });
};
```

### Step 7: Test the Migration

1. **Unit Tests**: Update tests to mock the API service instead of Supabase
2. **Integration Tests**: Verify the API calls work correctly
3. **Manual Testing**: Test the UI to ensure functionality is preserved

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

### 🔄 In Progress / Remaining Tasks

1. **Type Safety Improvements**:
   - Some TypeScript errors remain in existing files
   - Need to update type definitions for better consistency

2. **Testing**:
   - Update existing tests to mock new API services
   - Add integration tests for new API endpoints

3. **Error Handling**:
   - Some legacy error handling patterns still exist
   - Consider standardizing error handling across all components

4. **Performance Optimization**:
   - Cache invalidation strategies could be improved
   - Consider implementing request deduplication

### 🚀 Next Steps

1. **Fix Remaining TypeScript Errors**: Address any remaining type issues
2. **Update Tests**: Migrate test suites to use new API mocks
3. **Performance Testing**: Verify API layer doesn't introduce performance regressions
4. **Documentation**: Update component documentation to reflect new patterns
5. **Training**: Educate team on new API patterns and conventions

## Conclusion

The API layer migration provides:

- **Better Architecture**: Clear separation between UI and data logic
- **Consistent Patterns**: Standardized error handling and performance monitoring
- **Improved Maintainability**: Centralized data access logic
- **Type Safety**: Better TypeScript support
- **Testing**: Easier to mock and test

This migration sets the foundation for scalable, maintainable data access patterns throughout the application. The core migration is complete and functional, with some polish and optimization work remaining.