### Restoring skipped newsletters

This document explains how to safely restore rows from `skipped_newsletters` back into `newsletters` while preserving their original `received_at` date and handling duplicates automatically.

It assumes you have run the migration `20260203_duplicate_detection_and_cleanup.sql`, which provides:

- **Duplicate-safe restoration** that prevents creating duplicates
- **Dry-run capability** to preview operations before executing
- **Comprehensive error handling** with detailed reporting
- **Processing of all skip reasons** (daily limits, duplicates, archived sources, etc.)

The main function `restore_and_deduplicate_skipped_newsletters()`:

- Processes ALL skipped newsletters (not just duplicates)
- Restores only the first occurrence of each unique newsletter
- Skips additional duplicates automatically
- Preserves `received_at` timestamps
- Returns detailed statistics about what was restored vs skipped

## ⚠️ Important: Handle Duplicates First

Before restoring skipped newsletters, you should check for and handle duplicates to avoid creating duplicate entries in the newsletters table. Skipped newsletters may include duplicates that were rejected during processing.

### 1. Get Statistics First

```sql
-- Get comprehensive statistics about your data
SELECT * FROM get_duplicate_statistics();
```

This will show you:

- Total newsletters and duplicates
- Skipped newsletters by reason (daily limits, duplicates, etc.)
- Data quality score

### 2. Preview Restoration (Recommended)

Always preview before executing:

```sql
-- Preview what will be restored without actually doing it
SELECT * FROM restore_and_deduplicate_skipped_newsletters(p_dry_run := TRUE);
```

### 3. Execute Safe Restoration

```sql
-- Restore all skipped newsletters safely (including daily limited ones)
SELECT * FROM restore_and_deduplicate_skipped_newsletters();
```

This function will:

- ✅ **Process ALL skipped newsletters** (daily limits, duplicates, archived sources, etc.)
- ✅ **Restore only the first occurrence** of each unique newsletter
- ✅ **Skip additional duplicates** automatically
- ✅ **Preserve received_at timestamps**
- ✅ **Return detailed statistics** about what was restored vs skipped

### 4. Clean Up Existing Duplicates (Optional)

If you want to clean up duplicates in the main newsletters table:

```sql
-- Preview cleanup first
SELECT * FROM clean_duplicate_newsletters(p_dry_run := TRUE);

-- Execute cleanup (keeps most recent version)
SELECT * FROM clean_duplicate_newsletters();
```

---

### Restore a single skipped newsletter

If you know the `id` of the skipped newsletter:

```sql
SELECT * FROM restore_skipped_newsletter('<skipped-id-here>'::uuid);
```

This returns a JSON result with success status and details.

You can get candidate IDs with:

```sql
SELECT id, user_id, title, received_at, skip_reason
FROM public.skipped_newsletters
ORDER BY received_at DESC
LIMIT 50;
```

---

### User-Specific Restoration

To restore newsletters for a specific user:

```sql
-- Preview for specific user
SELECT * FROM restore_and_deduplicate_skipped_newsletters('<user-id-here>'::uuid);

-- Execute for specific user
SELECT * FROM restore_and_deduplicate_skipped_newsletters('<user-id-here>'::uuid, FALSE);
```

---

### Restore _all_ skipped newsletters (all users)

To restore every skipped newsletter in the system:

```sql
-- Preview first (recommended)
SELECT * FROM restore_and_deduplicate_skipped_newsletters(p_dry_run := TRUE);

-- Execute restoration
SELECT * FROM restore_and_deduplicate_skipped_newsletters();
```

**Important:**

- Run this only from a trusted admin / service connection (e.g. using the service role)
- The function automatically handles duplicates and prevents creating new ones
- Returns detailed statistics about what was restored vs skipped

---

### Verifying the restore

After restoring, you can verify results with:

```sql
-- Get final statistics
SELECT * FROM get_duplicate_statistics();

-- Check that skipped_newsletters is empty (or only has expected rows)
SELECT COUNT(*) AS remaining_skipped
FROM public.skipped_newsletters;

-- Spot‑check a few restored newsletters
SELECT id, user_id, title, received_at, is_archived, is_read
FROM public.newsletters
WHERE received_at > now() - INTERVAL '7 days'
ORDER BY received_at DESC
LIMIT 50;

-- Check for any remaining duplicates
SELECT * FROM find_duplicate_newsletters()
ORDER BY source_name, title, received_at DESC
LIMIT 20;
```

If you're using the web app, restored items should now appear wherever normal `newsletters` are surfaced (queue, lists, searches) based on your existing UI logic.

## 🎯 Recommended Workflow

1. **Check statistics**: `SELECT * FROM get_duplicate_statistics();`
2. **Preview restoration**: `SELECT * FROM restore_and_deduplicate_skipped_newsletters(p_dry_run := TRUE);`
3. **Execute restoration**: `SELECT * FROM restore_and_deduplicate_skipped_newsletters();`
4. **Verify results**: `SELECT * FROM get_duplicate_statistics();`

This ensures safe, duplicate-free restoration of all your skipped newsletters, including daily limited ones!
