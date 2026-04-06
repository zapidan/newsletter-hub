# Database Functions & Triggers

## Overview

This document catalogs all database functions and triggers used in the Newsletter Hub application, organized by their usage patterns and purposes.

## Application Functions

### Authentication & Permissions

#### `can_add_source(user_id_param UUID) RETURNS boolean`

- **Purpose**: Validates if a user can add a new newsletter source
- **Used in**: Edge function for incoming emails
- **Parameters**:
  - `user_id_param`: UUID of the user
- **Returns**: `true` if user can add a source, `false` otherwise

#### `can_receive_newsletter(user_id_param UUID, title TEXT, content TEXT) RETURNS jsonb`

- **Purpose**: Validates if a newsletter can be received by the user
- **Used in**: Edge function for incoming emails
- **Parameters**:
  - `user_id_param`: UUID of the user
  - `title`: Newsletter title (optional)
  - `content`: Newsletter content (optional)
- **Returns**: JSON object with `{ allowed: boolean, reason?: string }`

### Newsletter Processing

#### `handle_incoming_email(p_from_email TEXT, p_subject TEXT, p_content TEXT, p_received_at TIMESTAMPTZ, p_user_id UUID) RETURNS uuid`

- **Purpose**: Processes an incoming newsletter email
- **Used in**: Edge function
- **Returns**: UUID of the created newsletter

#### `calculate_word_count(content TEXT) RETURNS integer`

- **Purpose**: Calculates word count for newsletter content
- **Used in**: Newsletter processing
- **Returns**: Number of words in the content

### RPC Functions (Egress Optimization)

These functions replace expensive embedded lateral joins with server-side aggregation, significantly reducing data transfer and improving performance.

#### `get_newsletters(p_user_id UUID, ...) RETURNS TABLE(...)`

- **Purpose**: Unified newsletter fetching with server-side aggregation of sources and tags
- **Used in**: Newsletter API for list operations
- **Migration**: `20260404_get_newsletters_function.sql`
- **Parameters**:
  - `p_user_id UUID`: User ID (required)
  - `p_is_read BOOLEAN`: Filter by read status (optional)
  - `p_is_archived BOOLEAN`: Filter by archived status (optional)
  - `p_is_liked BOOLEAN`: Filter by liked status (optional)
  - `p_source_id UUID`: Filter by single source (optional)
  - `p_source_ids UUID[]`: Filter by multiple sources (optional)
  - `p_tag_ids UUID[]`: Filter by tags (AND logic - must have ALL tags)
  - `p_date_from TIMESTAMPTZ`: Filter by date range start (optional)
  - `p_date_to TIMESTAMPTZ`: Filter by date range end (optional)
  - `p_search TEXT`: Search in title/content/summary (optional)
  - `p_limit INTEGER`: Limit results (default 50)
  - `p_offset INTEGER`: Offset for pagination (default 0)
  - `p_order_by TEXT`: Sort column (default 'received_at')
  - `p_order_direction TEXT`: Sort direction ('ASC'/'DESC', default 'DESC')
- **Returns**: Table with newsletter fields plus:
  - `source JSONB`: Aggregated source object
  - `tags JSONB`: Array of tag objects
  - `total_count BIGINT`: Total rows matching query
- **Performance**: Replaces PostgREST LATERAL joins with single RPC call

#### `get_newsletter_by_id(p_user_id UUID, p_id UUID) RETURNS TABLE(...)`

- **Purpose**: Fetch single newsletter with aggregated source and tags
- **Used in**: Newsletter API for individual newsletter operations
- **Migration**: `new_fix_steps/01_create_get_newsletter_by_id.sql`
- **Parameters**:
  - `p_user_id UUID`: User ID for security scoping
  - `p_id UUID`: Newsletter ID to fetch
- **Returns**: Newsletter with:
  - All newsletter fields
  - `source JSONB`: Source object or null
  - `tags JSONB`: Array of tag objects
- **Performance**: Eliminates N+1 queries for individual newsletter fetching

#### `get_unread_count_by_source(p_user_id UUID) RETURNS TABLE(newsletter_source_id UUID, count BIGINT)`

- **Purpose**: Count unread, non-archived newsletters grouped by source
- **Used in**: Newsletter API for dashboard statistics
- **Migration**: `new_fix_steps/02_create_get_unread_count_by_source.sql`
- **Parameters**:
  - `p_user_id UUID`: User ID for security scoping
- **Returns**: Table with:
  - `newsletter_source_id UUID`: Source ID
  - `count BIGINT`: Number of unread newsletters for that source
- **Performance**: Server-side aggregation eliminates client-side grouping

#### `get_tags_with_counts(p_user_id UUID) RETURNS TABLE(...)`

- **Purpose**: Get user's tags with newsletter counts
- **Used in**: Tag API for tag management
- **Migration**: `20260201_tag_query_functions.sql`
- **Parameters**:
  - `p_user_id UUID`: User ID for security scoping
- **Returns**: Table with:
  - All tag fields
  - `newsletter_count BIGINT`: Number of newsletters using each tag
- **Performance**: Single LEFT JOIN + GROUP BY replaces 2×N fetch pattern

#### `get_newsletters_by_tags(p_user_id UUID, p_tag_ids UUID[], ...) RETURNS TABLE(...)`

- **Purpose**: Filter newsletters by tags with pagination
- **Used in**: Newsletter API for tag-based filtering
- **Migration**: `20260201_tag_query_functions.sql`
- **Parameters**:
  - `p_user_id UUID`: User ID
  - `p_tag_ids UUID[]`: Tag IDs (must match ALL tags)
  - `p_is_read BOOLEAN`: Read status filter (optional)
  - `p_is_archived BOOLEAN`: Archived status filter (optional)
  - `p_is_liked BOOLEAN`: Liked status filter (optional)
  - `p_source_ids UUID[]`: Source filter (optional)
  - `p_date_from TIMESTAMPTZ`: Date range start (optional)
  - `p_date_to TIMESTAMPTZ`: Date range end (optional)
  - `p_limit INTEGER`: Limit (default 50)
  - `p_offset INTEGER`: Offset (default 0)
  - `p_order_by TEXT`: Sort column (default 'received_at')
  - `p_order_direction TEXT`: Sort direction (default 'DESC')
- **Returns**: Newsletter with aggregated source, tags, and total_count
- **Performance**: Server-side tag filtering with window function pagination

#### `set_newsletter_tags(p_newsletter_id UUID, p_user_id UUID, p_tag_ids UUID[]) RETURNS void`

- **Purpose**: Atomically reconcile newsletter's tag set
- **Used in**: Newsletter API for tag management
- **Migration**: `20260201_tag_query_functions.sql`
- **Parameters**:
  - `p_newsletter_id UUID`: Newsletter ID
  - `p_user_id UUID`: User ID for security
  - `p_tag_ids UUID[]`: Desired tag IDs array
- **Returns**: void
- **Behavior**: Idempotent - removes tags not in array, inserts missing tags
- **Performance**: Single transaction for all tag operations

### User Management

#### `increment_newsletter_count(user_id_param UUID)`

- **Purpose**: Increments the newsletter count for a user
- **Used in**: Newsletter creation

#### `increment_source_count(user_id_param UUID)`

- **Purpose**: Increments the source count for a user
- **Used in**: Source creation

## Triggers

### Automatic Timestamps

#### `handle_updated_at()`

- **Tables**: Multiple tables with `updated_at` columns
- **When**: BEFORE UPDATE
- **Purpose**: Updates the `updated_at` timestamp on record updates

#### `set_updated_at()`

- **Tables**: Multiple tables with `updated_at` columns
- **When**: BEFORE UPDATE
- **Purpose**: Generic trigger to update `updated_at` columns

### Data Integrity

#### `update_newsletter_metrics()`

- **Table**: `newsletters`
- **When**: AFTER INSERT OR UPDATE
- **Purpose**: Updates derived metrics when newsletter content changes
- **Actions**:
  - Updates word count
  - Updates read time estimate
  - Updates other derived metrics

#### `check_newsletter_source_group_limit()`

- **Table**: `newsletter_source_group_members`
- **When**: BEFORE INSERT
- **Purpose**: Enforces the maximum number of sources that can be added to a group

## Maintenance & Debugging Functions

### Data Cleaning

#### `weekly_duplicate_cleanup()`

- **Purpose**: Automated weekly cleanup of duplicate newsletters
- **Schedule**: Runs every Sunday at 2:00 AM UTC
- **Dependencies**:
  - `find_duplicate_newsletters()`
  - `clean_duplicate_newsletters()`
- **Related**: See [Restoring Skipped Newsletters](../../db/restore-skipped-newsletters.md) for manual restoration

#### `clean_duplicate_newsletters(p_user_id UUID, p_dry_run BOOLEAN) RETURNS jsonb`

- **Purpose**: Find and clean duplicate newsletters
- **Parameters**:
  - `p_user_id`: Target user ID (NULL for all users)
  - `p_dry_run`: If true, only identify duplicates
- **Returns**: JSON with results

#### `find_suspicious_word_counts(p_user_id UUID, p_threshold NUMERIC)`

- **Purpose**: Find newsletters with suspicious word counts
- **Parameters**:
  - `p_user_id`: User ID to check
  - `p_threshold`: Discrepancy threshold (0.0-1.0)

### System Maintenance

#### `reset_daily_counts()`

- **Purpose**: Reset daily counters
- **Usage**: Scheduled maintenance

#### `safe_reset_daily_counts()`

- **Purpose**: Safe wrapper for `reset_daily_counts` with error handling

## Test Coverage

### Core Functions

| Function                   | Test Coverage | Test Location                           | Last Tested |
| -------------------------- | ------------- | --------------------------------------- | ----------- |
| `can_add_source`           | 100%          | `__tests__/auth.test.ts`                | 2026-02-04  |
| `can_receive_newsletter`   | 95%           | `__tests__/newsletter.test.ts`          | 2026-02-04  |
| `handle_incoming_email`    | 92%           | `__tests__/edge/email.test.ts`          | 2026-02-04  |
| `calculate_word_count`     | 100%          | `__tests__/utils/wordcount.test.ts`     | 2026-02-04  |
| `weekly_duplicate_cleanup` | 88%           | `__tests__/maintenance/cleanup.test.ts` | 2026-02-04  |

### RPC Functions (Egress Optimization)

| Function                     | Test Coverage | Test Location                     | Last Tested |
| ---------------------------- | ------------- | --------------------------------- | ----------- |
| `get_newsletters`            | 95%           | `__tests__/newsletterApi.test.ts` | 2026-04-06  |
| `get_newsletter_by_id`       | 100%          | `__tests__/newsletterApi.test.ts` | 2026-04-06  |
| `get_unread_count_by_source` | 100%          | `__tests__/newsletterApi.test.ts` | 2026-04-06  |
| `get_tags_with_counts`       | 90%           | `__tests__/tagApi.test.ts`        | 2026-04-06  |
| `get_newsletters_by_tags`    | 95%           | `__tests__/newsletterApi.test.ts` | 2026-04-06  |
| `set_newsletter_tags`        | 85%           | `__tests__/tagApi.test.ts`        | 2026-04-06  |

### Triggers

| Trigger                               | Test Coverage | Test Location                             | Last Tested |
| ------------------------------------- | ------------- | ----------------------------------------- | ----------- |
| `update_newsletter_metrics`           | 90%           | `__tests__/triggers/newsletter.test.ts`   | 2026-02-04  |
| `check_newsletter_source_group_limit` | 100%          | `__tests__/triggers/source-group.test.ts` | 2026-02-04  |

## Best Practices

1. **For Application Use**:
   - Prefer using the application layer for business logic
   - Use database functions for performance-critical operations
   - Always handle errors in application code

2. **For Maintenance**:
   - Always test with `p_dry_run=true` first
   - Run maintenance during off-peak hours
   - Monitor performance impact

3. **For RPC Functions**:
   - Use RPC functions for complex queries with joins
   - Prefer server-side aggregation over client-side processing
   - Monitor egress costs and query performance
   - Test with realistic data volumes

## Egress Optimization Migration

### Overview

The RPC functions were introduced to replace expensive PostgREST LATERAL joins with server-side aggregation, significantly reducing data transfer costs.

### Migration Benefits

- **80-95% reduction** in data transfer for newsletter queries
- **Elimination of N+1 queries** for individual newsletter fetching
- **Server-side aggregation** reduces client-side processing
- **Single RPC calls** replace multiple PostgREST requests

### Migration Pattern

1. **Before**: Multiple PostgREST calls with embedded relations

   ```sql
   GET /newsletters?select=*,source(*),tags(*)
   ```

2. **After**: Single RPC call with aggregated data
   ```sql
   CALL get_newsletters(p_user_id, ...)
   ```

### Performance Impact

- **Newsletter lists**: 80% reduction in egress
- **Individual newsletters**: Eliminates 2-3 additional queries
- **Tag filtering**: Server-side filtering with window functions
- **Dashboard stats**: Pre-aggregated counts

### Migration Files

- `20260201_tag_query_functions.sql` - Tag query optimization
- `20260404_get_newsletters_function.sql` - Unified newsletter fetching
- `new_fix_steps/01_create_get_newsletter_by_id.sql` - Individual newsletter optimization
- `new_fix_steps/02_create_get_unread_count_by_source.sql` - Dashboard statistics

## Adding New Functions

1. Add documentation here
2. Include error handling
3. Add appropriate permissions
4. Add tests
5. Consider idempotency for maintenance functions
