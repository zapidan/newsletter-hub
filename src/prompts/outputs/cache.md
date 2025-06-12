1. **Consolidate Cache Keys and Optimize Query Structure**
File: 
src/common/hooks/useNewsletters.ts
Function: 
useNewsletters
 hook
Change:
Replace the current CACHE_KEY implementation with a more granular key structure
Split the main query into separate queries for different filter states
Add proper type safety for cache keys
Reason: Reduce cache misses and improve cache hit rates by having more specific cache keys

2. **Implement Optimistic Updates for All Mutations**
File: 
src/common/hooks/useNewsletters.ts
Function: All mutation functions (bulkArchive, toggleLike, etc.)
Change:
Add optimistic updates for all status-changing mutations
Implement proper rollback on error
Use queryClient.cancelQueries and queryClient.setQueryData for atomic updates
Reason: Ensure immediate UI feedback and maintain cache consistency

2. Optimize Newsletter List Rendering
File: 
src/web/pages/Inbox.tsx
Function: Newsletter list rendering
Change:
Implement virtualized list rendering for better performance
Add proper loading states and skeleton placeholders
Use React.memo for newsletter row components
Reason: Improve rendering performance with large lists

3. **Enhance Filter Handling**
File: 
src/web/pages/Inbox.tsx
Function: Filter handling logic
Change:
Memoize filtered results using useMemo
Share cache between filter states where possible
Debounce filter changes to prevent rapid refetches
Reason: Reduce unnecessary re-renders and database queries

4. **Adjust Cache Configuration**
File: 
src/common/hooks/useNewsletters.ts
Function: useQuery configuration
Change:
Adjust staleTime and cacheTime based on data volatility
Add refetchOnWindowFocus: false for better UX
Implement proper error boundaries
Reason: Balance between data freshness and performance

5. **Improve Cache Invalidation**
File: 
src/common/hooks/useNewsletters.ts
Function: Mutation callbacks
Change:
Add proper cache invalidation after mutations
Use queryClient.invalidateQueries with predicate for targeted updates
Implement proper error handling and retry logic
Reason: Ensure UI stays in sync with server state

---

6. **Optimize Bulk Operations**
File: src/web/components/BulkSelectionActions.tsx
Function: Bulk action handlers
Change:
Implement batch processing for bulk operations
Add progress indicators
Handle partial successes gracefully
Reason: Improve performance and user experience for bulk actions

7. Add Proper Error Boundaries
File: src/web/components/ErrorBoundary.tsx (new)
Function: Error boundary component
Change:
Create error boundary component
Add error recovery options
Log errors to error tracking service
Reason: Prevent UI from breaking on errors

8. Implement Infinite Scroll
File: 
src/web/pages/Inbox.tsx
Function: Pagination and scroll handling
Change:
Implement infinite scroll with react-query's useInfiniteQuery
Add proper loading states
Handle scroll restoration
Reason: Improve performance with large datasets

8. **Optimize Tag Filtering**
File: 
src/web/pages/Inbox.tsx
Function: Tag filtering logic
Change:
Memoize tag filtering logic
Add debouncing for tag filter changes
Optimize tag selection updates
Reason: Improve performance when working with tags

9. **Add Cache Persistence**
File: src/common/services/cache.ts (new)
Function: Cache persistence layer
Change:
Implement localStorage or IndexedDB cache persistence
Add cache versioning
Handle cache migrations
Reason: Improve offline experience and reduce initial load time

10. **Optimize Re-renders**
File: 
src/web/components/NewsletterRow.tsx
Function: NewsletterRow component
Change:
Memoize event handlers
Split into smaller components
Use React.memo with custom comparison function
Reason: Reduce unnecessary re-renders

12. Add Performance Monitoring
File: src/common/utils/performance.ts (new)
Function: Performance monitoring utilities
Change:
Add performance markers
Track render times
Log performance metrics
Reason: Identify and fix performance bottlenecks

13. **Optimize Network Requests**
File: src/common/services/supabaseClient.ts
Function: Supabase client configuration
Change:
Add request batching
Implement request deduplication
Add proper retry logic
Reason: Reduce network overhead

14. **Add Cache Debugging Utilities**
File: src/common/utils/cacheDebug.ts (new)
Function: Cache debugging tools
Change:
Add cache inspection utilities
Add cache invalidation helpers
Add cache size monitoring
Reason: Make it easier to debug cache-related issues