### Restoring skipped newsletters

This document explains how to move rows from `skipped_newsletters` back into `newsletters` while preserving their original `received_at` date.

It assumes you have already run the migration `20260203_ensure_skipped_newsletters_received_at_and_restore.sql`, which:

- Backfills any `NULL` `received_at` values on `skipped_newsletters`
- Enforces `received_at` as `NOT NULL`
- Adds the helper function:
  - `public.restore_skipped_newsletter(p_skipped_id UUID)`

That helper:

- Inserts a newsletter into `public.newsletters` using data from `public.skipped_newsletters`
- Preserves `received_at` (and `created_at` when present)
- Deletes the original row from `public.skipped_newsletters`

---

### Restore a single skipped newsletter

If you know the `id` of the skipped newsletter:

```sql
SELECT public.restore_skipped_newsletter('<skipped-id-here>'::uuid);
```

You can get candidate IDs with:

```sql
SELECT id, user_id, title, received_at, skip_reason
FROM public.skipped_newsletters
ORDER BY received_at DESC
LIMIT 50;
```

---

### Restore all skipped newsletters for a single user

Use a `DO` block to loop over that user’s skipped rows and call the helper for each one:

```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM public.skipped_newsletters
    WHERE user_id = '<user-id-here>'::uuid
    ORDER BY received_at
  LOOP
    PERFORM public.restore_skipped_newsletter(r.id);
  END LOOP;
END $$;
```

This:

- Restores each skipped newsletter into `public.newsletters`
- Preserves its `received_at` timestamp so it appears in the correct chronological position
- Removes the corresponding row from `public.skipped_newsletters`

---

### Restore _all_ skipped newsletters (all users)

If you want to restore every skipped newsletter in the system:

```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM public.skipped_newsletters
    ORDER BY received_at
  LOOP
    PERFORM public.restore_skipped_newsletter(r.id);
  END LOOP;
END $$;
```

**Important:**

- Run this only from a trusted admin / service connection (e.g. using the service role)
- Consider running it first in a staging environment and checking that:
  - `public.newsletters` contains the restored rows
  - `public.skipped_newsletters` is empty (or only has rows you intentionally left)

---

### Verifying the restore

After restoring, you can verify results with:

```sql
-- Check that skipped_newsletters is empty (or only has expected rows)
SELECT COUNT(*) AS remaining_skipped
FROM public.skipped_newsletters;

-- Spot‑check a few restored newsletters
SELECT id, user_id, title, received_at, is_archived, is_read
FROM public.newsletters
WHERE received_at > now() - INTERVAL '7 days'
ORDER BY received_at DESC
LIMIT 50;
```

If you’re using the web app, restored items should now appear wherever normal `newsletters` are surfaced (queue, lists, searches) based on your existing UI logic.
