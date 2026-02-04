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

## Adding New Functions

1. Add documentation here
2. Include error handling
3. Add appropriate permissions
4. Add tests
5. Consider idempotency for maintenance functions
