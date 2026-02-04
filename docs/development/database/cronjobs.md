# Database Cron Jobs and Functions

## Current Cron Jobs

| jobid | jobname                  | schedule     | command                                          | nodename  | nodeport | database | username | active |
| ----- | ------------------------ | ------------ | ------------------------------------------------ | --------- | -------- | -------- | -------- | ------ |
| 4     | reset-daily-counts       | 0 0 \* \* \* | SELECT public.safe_reset_daily_counts()          | localhost | 5432     | postgres | postgres | true   |
| 5     | weekly-duplicate-cleanup | 0 3 \* \* 0  | SELECT public.safe_clean_duplicate_newsletters() | localhost | 5432     | postgres | postgres | true   |

## Cron Job Details

### 1. reset-daily-counts

- **Purpose**: Resets daily counters for all users
- **Schedule**: Daily at 00:00 UTC (midnight)
- **Function**: `public.safe_reset_daily_counts()`
- **Notes**:
  - Runs the actual reset function with error handling
  - Ensures daily counts are reset for all users

### 2. weekly-duplicate-cleanup

- **Purpose**: Cleans up duplicate newsletters
- **Schedule**: Every Sunday at 03:00 UTC
- **Function**: `public.safe_clean_duplicate_newsletters()`
- **Notes**:
  - Runs in dry-run mode first to check for duplicates
  - Only performs actual cleanup if duplicates are found
  - Includes comprehensive error handling

## Database Functions

### 1. can_receive_newsletter(user_id_param UUID, title TEXT, content TEXT)

- **Purpose**: Checks if a user can receive a newsletter
- **Parameters**:
  - `user_id_param`: The user's UUID
  - `title`: (Optional) Newsletter title for duplicate checking
  - `content`: (Optional) Newsletter content for duplicate checking
- **Returns**: JSONB with can_receive status and details
- **Features**:
  - Checks daily newsletter limits
  - Performs duplicate detection
  - Handles different subscription plans

### 2. increment_newsletter_count(user_id_param UUID)

- **Purpose**: Safely increments the newsletter count for a user
- **Parameters**:
  - `user_id_param`: The user's UUID
- **Features**:
  - Uses atomic updates with INSERT ... ON CONFLICT
  - Handles UTC timezone correctly
  - Creates daily entry if it doesn't exist

### 3. safe_clean_duplicate_newsletters()

- **Purpose**: Safely cleans up duplicate newsletters
- **Returns**: JSONB with operation results
- **Features**:
  - Runs in dry-run mode first
  - Only deletes if duplicates are found
  - Includes error handling and logging

### 4. restore_skipped_newsletter(p_skipped_id UUID, p_user_id UUID)

- **Purpose**: Restores a skipped newsletter
- **Parameters**:
  - `p_skipped_id`: ID of the skipped newsletter to restore
  - `p_user_id`: (Optional) User ID for permission checking
- **Features**:
  - Validates user permissions
  - Prevents duplicate restoration
  - Updates daily counts

### 5. restore_and_deduplicate_skipped_newsletters(p_user_id UUID, p_dry_run BOOLEAN)

- **Purpose**: Restores and deduplicates skipped newsletters
- **Parameters**:
  - `p_user_id`: (Optional) Filter by user
  - `p_dry_run`: If true, only shows what would be done
- **Features**:
  - Processes in batches
  - Prevents duplicate processing
  - Includes dry-run capability

### 6. clean_duplicate_newsletters(p_dry_run BOOLEAN, p_user_id UUID)

- **Purpose**: Cleans up duplicate newsletters
- **Parameters**:
  - `p_dry_run`: If true, only shows what would be deleted
  - `p_user_id`: (Optional) Filter by user
- **Returns**: JSONB with operation results
- **Features**:
  - Identifies duplicates by source, title, and user
  - Keeps the earliest received version
  - Includes dry-run capability

## Maintenance Commands

### View All Cron Jobs

```sql
SELECT * FROM cron.job ORDER BY jobid;
```

### View Cron Job Runs

```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Manually Run a Cron Job

```sql
-- Replace JOB_ID with the actual jobid
SELECT cron.run(JOB_ID);
```

### Unschedule a Cron Job

```sql
-- Replace JOB_ID with the actual jobid
SELECT cron.unschedule(JOB_ID);
```

## Best Practices

1. **Testing**: Always test with dry-run first
2. **Monitoring**: Regularly check the `cron.job_run_details` table
3. **Backup**: Ensure database backups are running before major cleanups
4. **Timing**: Schedule maintenance during low-traffic periods
5. **Error Handling**: All functions include error handling, but monitor logs for issues

## Troubleshooting

### Common Issues

1. **Job Not Running**:
   - Check if the pg_cron extension is enabled
   - Verify the job is active in the cron.job table
   - Check for errors in the cron.job_run_details table

2. **Permission Issues**:
   - Ensure the function has the correct SECURITY DEFINER
   - Verify the cron job user has execute permissions

3. **Performance Issues**:
   - Large operations may time out
   - Consider batching for large datasets
   - Monitor query performance using `EXPLAIN ANALYZE`
