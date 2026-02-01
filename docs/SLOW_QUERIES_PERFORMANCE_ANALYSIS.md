# Slow Queries Performance Analysis and Optimization

## Problem Summary

After implementing previous optimizations, we're seeing **more slow queries than before**. The root cause is that **PostgREST is generating extremely complex queries with multiple nested LEFT JOIN LATERAL operations** for fetching newsletters with their sources and tags.

## Root Cause Analysis

### The Problem Queries

The top slow queries are all PostgREST-generated queries with this pattern:

```sql
WITH pgrst_source AS (
  SELECT "public"."newsletters".*, 
         "public"."newsletters"."newsletter_source_id",
         row_to_json("newsletters_source_1".*)::jsonb AS "source",
         COALESCE("newsletters_tags_1"."newsletters_tags_1", $13) AS "tags"
  FROM "public"."newsletters" 
  LEFT JOIN LATERAL (SELECT "newsletter_sources_1"."id", "newsletter_sources_1"."name", ... 
                     FROM "public"."newsletter_sources" AS "newsletter_sources_1" 
                     WHERE "newsletter_sources_1"."id" = "public"."newsletters"."newsletter_source_id" 
                     LIMIT $1 OFFSET $2) AS "newsletters_source_1" ON $14
  LEFT JOIN LATERAL (SELECT json_agg("newsletters_tags_1")::jsonb AS "newsletters_tags_1" 
                     FROM (SELECT row_to_json("newsletter_tags_tag_2".*)::jsonb AS "tag" 
                           FROM "public"."newsletter_tags" AS "newsletter_tags_1" 
                           LEFT JOIN LATERAL (SELECT "tags_2"."id", "tags_2"."name", ... 
                                             FROM "public"."tags" AS "tags_2" 
                                             WHERE "tags_2"."id" = "newsletter_tags_1"."tag_id" 
                                             LIMIT $3 OFFSET $4) AS "newsletter_tags_tag_2" ON $15 
                           WHERE "newsletter_tags_1"."newsletter_id" = "public"."newsletters"."id" 
                           LIMIT $5 OFFSET $6) AS "newsletters_tags_1") AS "newsletters_tags_1" ON $16
  WHERE "public"."newsletters"."user_id" = $7 
    AND "public"."newsletters"."is_read" = $8 
    AND "public"."newsletters"."is_archived" = $9
  ORDER BY "public"."newsletters"."received_at" DESC 
  LIMIT $10 OFFSET $11
)
```

### Why This Is Slow

1. **Multiple LEFT JOIN LATERAL operations** - Each newsletter triggers 2 additional queries
2. **JSON aggregation overhead** - `row_to_json()` and `json_agg()` are expensive operations
3. **N+1 query pattern** - Instead of joining once, PostgREST creates subqueries for each row
4. **Missing optimized views** - No pre-computed joins for common patterns

### Performance Impact

- **Query 1**: 129.85ms mean time, 7029 calls (912 seconds total)
- **Query 2**: 163.08ms mean time, 2788 calls (454 seconds total)  
- **Query 3**: 75.35ms mean time, 5130 calls (386 seconds total)
- **Query 4**: 122.49ms mean time, 2764 calls (338 seconds total)

**Total time spent on these 4 queries: ~2,090 seconds (35 minutes)**

## Solution Architecture

### 1. Optimized Views and Functions

Created `20260131_optimize_newsletter_queries.sql`:

- **`get_newsletter_tags_json()`** - Efficient function to get tags as JSON
- **`get_newsletter_source_json()`** - Efficient function to get source as JSON  
- **`newsletters_with_sources_tags` view** - Pre-optimized view with joins
- **`newsletters_with_sources_tags_materialized`** - Materialized view for best performance
- **`get_newsletters_with_sources_tags()`** - Optimized API function
- **`count_newsletters_with_sources_tags()`** - Matching count function

### 2. Reading Queue Optimization

Created `20260131_optimize_reading_queue_queries.sql`:

- **`reading_queue_with_newsletters` view** - Pre-joined reading queue data
- **`reading_queue_with_newsletters_materialized`** - Materialized view
- **`get_reading_queue_with_newsletters()`** - Optimized function

### 3. Comprehensive Indexing Strategy

Created `20260131_add_performance_indexes.sql`:

- **Composite indexes** for common query patterns
- **Partial indexes** for frequent filter states  
- **Function-based indexes** for date filtering
- **Statistics update function** for optimal query planning

## Expected Performance Improvements

### Before Optimization
- Complex PostgREST queries with N+1 pattern
- Multiple LEFT JOIN LATERAL operations per newsletter
- JSON aggregation done per-row
- Mean query times: 75-163ms

### After Optimization
- **Pre-joined views** eliminate N+1 pattern
- **Materialized views** for best performance on large datasets
- **Optimized functions** with proper indexing
- **Expected query times**: 5-15ms (80-90% improvement)

### Specific Improvements

1. **Newsletter Queries**: 
   - From 129ms → ~10ms (92% improvement)
   - Eliminate JSON aggregation overhead
   - Single query instead of multiple subqueries

2. **Reading Queue Queries**:
   - From 122ms → ~8ms (93% improvement)  
   - Pre-joined newsletter data
   - Optimized ordering by position

3. **Search Queries**:
   - Better indexes for text search
   - Optimized date range filtering
   - Improved tag filtering performance

## Implementation Steps

### 1. Run Migrations
```sql
-- Run in order
supabase db push 20260131_optimize_newsletter_queries.sql
supabase db push 20260131_optimize_reading_queue_queries.sql  
supabase db push 20260131_add_performance_indexes.sql
```

### 2. Update Application Code
The application can now use the optimized functions instead of relying on PostgREST's complex query generation:

```typescript
// Before: Complex PostgREST query
const newsletters = await supabase
  .from('newsletters')
  .select(`
    *,
    source:newsletter_sources(*),
    tags:newsletter_tags(tag:tags(*))
  `)
  .eq('user_id', userId)
  .eq('is_read', false)
  .eq('is_archived', false);

// After: Optimized function
const newsletters = await supabase
  .rpc('get_newsletters_with_sources_tags', {
    p_user_id: userId,
    p_is_read: false,
    p_is_archived: false,
    p_limit: 20,
    p_offset: 0
  });
```

### 3. Materialized View Refresh Strategy

Materialized views need periodic refreshes:

```sql
-- Manual refresh
SELECT public.refresh_newsletters_materialized();

-- Or set up automated refresh via triggers (included in migration)
```

## Monitoring and Verification

### 1. Query Performance Monitoring
```sql
-- Check slow query log
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE query LIKE '%newsletters%' 
ORDER BY mean_time DESC;

-- Monitor materialized view refresh
SELECT * FROM pg_stat_user_tables 
WHERE relname LIKE '%materialized%';
```

### 2. Index Usage
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('newsletters', 'newsletter_sources', 'newsletter_tags')
ORDER BY idx_scan DESC;
```

### 3. Cache Hit Rates
```sql
-- Monitor cache performance
SELECT datname, blks_hit, blks_read, 
       blks_hit::float / (blks_hit + blks_read) AS cache_hit_ratio
FROM pg_stat_database 
WHERE datname = current_database();
```

## Rollback Plan

If issues arise, the optimizations can be rolled back:

```sql
-- Drop optimized objects
DROP VIEW IF EXISTS public.newsletters_with_sources_tags;
DROP MATERIALIZED VIEW IF EXISTS public.newsletters_with_sources_tags_materialized;
DROP FUNCTION IF EXISTS public.get_newsletters_with_sources_tags;

-- Application will fall back to original PostgREST queries
```

## Long-term Maintenance

1. **Regular Statistics Updates**: Run `public.update_table_statistics()` weekly
2. **Materialized View Refresh**: Set up automated refresh schedule
3. **Monitor Query Performance**: Check pg_stat_statements monthly
4. **Index Maintenance**: Review and add new indexes as query patterns evolve

## Success Metrics

- **Query Time Reduction**: Target 80%+ reduction in mean query times
- **Total Query Time**: Reduce from 35+ minutes to <5 minutes for top queries
- **Cache Hit Rate**: Maintain >99% cache hit rate
- **Index Usage**: Ensure >90% of queries use optimal indexes

This comprehensive optimization should eliminate the slow queries while maintaining all existing functionality.
