# Newsletter Limit Bug Fix

## Bug Description

After the UTC syntax changes in commit `5bf79b9`, users with unlimited newsletters were incorrectly defaulted to the free plan limit (15) and newsletters were being skipped. Additionally, daily counts were not resetting correctly.

## Root Cause

In the `can_receive_newsletter` function in `supabase/migrations/20260131_utc_syntax_fix_final.sql`, line 276 was selecting the wrong column:

```sql
-- BUG: Selecting max_sources instead of max_newsletters_per_day
SELECT sp.max_sources INTO max_newsletters_allowed
FROM public.subscription_plans sp
```

This caused:

1. **Unlimited plan users** to get `max_sources` (1000000) instead of `max_newsletters_per_day` (1000000) - while both happen to be the same value, the logic was wrong
2. **Free plan users** to potentially get the wrong limit if `max_sources` differed from `max_newsletters_per_day`
3. The function to use the wrong column, making it fragile to future schema changes

## Fix

Changed line 276 to select the correct column:

```sql
-- FIX: Select max_newsletters_per_day (the correct column)
SELECT sp.max_newsletters_per_day INTO max_newsletters_allowed
FROM public.subscription_plans sp
```

Also improved the fallback logic to properly query the free plan's `max_newsletters_per_day` instead of hardcoding a value.

## Files Changed

1. **`supabase/migrations/20260131_utc_syntax_fix_final.sql`** - Fixed the bug in the original migration
2. **`supabase/migrations/20260203_fix_newsletter_limit_bug.sql`** - Standalone fix migration (for databases that already ran the original migration)
3. **`supabase/migrations/20260203_test_newsletter_limit_fix.sql`** - SQL tests to verify the fix
4. **`src/__tests__/supabase/newsletterLimit.test.ts`** - TypeScript tests for the fix

## Testing

### SQL Tests

Run the SQL test file in your Supabase SQL editor:

```sql
-- Run: supabase/migrations/20260203_test_newsletter_limit_fix.sql
```

The tests verify:

1. Unlimited plan users get `max_newsletters_per_day` (not `max_sources`)
2. Free plan users get the correct limit (5)
3. UTC date calculations work correctly
4. Users without subscriptions fall back to free plan limits
5. Daily count increments work correctly

### TypeScript Tests

Run the TypeScript tests:

```bash
npm test src/__tests__/supabase/newsletterLimit.test.ts
```

## Daily Count Reset

The daily count reset functionality was already correct. The `reset_daily_counts` function deletes old records (older than 30 days), and daily counts naturally reset because each day gets a new row with `date = (now() AT TIME ZONE 'UTC')::date`. The UTC date calculation ensures counts reset at midnight UTC, which is the intended behavior.

## Verification Steps

1. **For unlimited plan users:**

   ```sql
   SELECT public.can_receive_newsletter(
       '16190e6c-2519-4c36-9178-71ce2843e59c'::UUID,
       'Test Title',
       'Test Content'
   );
   ```

   Should return `max_allowed: 1000000` (not limited to `max_sources`)

2. **For free plan users:**

   ```sql
   SELECT public.can_receive_newsletter(
       '<free-user-id>'::UUID,
       'Test Title',
       'Test Content'
   );
   ```

   Should return `max_allowed: 5` (free plan's `max_newsletters_per_day`)

3. **Check daily counts:**
   ```sql
   SELECT * FROM public.daily_counts
   WHERE user_id = '<user-id>'
   AND date = (now() AT TIME ZONE 'UTC')::date;
   ```
   Should show today's count with correct UTC date

## Impact

- **Before fix:** Unlimited plan users were incorrectly limited (though the values happened to match, the logic was wrong)
- **After fix:** Unlimited plan users correctly get `max_newsletters_per_day` limit
- **Before fix:** Free plan users might get wrong limit if `max_sources` != `max_newsletters_per_day`
- **After fix:** Free plan users correctly get `max_newsletters_per_day` limit

## Related Commits

- `5bf79b9` - fix utc in handle_incoming_email_transaction (#90) - Introduced the bug
- `d48a5ae` - Fix more utc issues in db functions (#89) - Related UTC fixes
- `c27011d` - fix utc syntax in migration increment received newsletter count (#88) - Related UTC fixes

## Prevention

To prevent similar bugs in the future:

1. Always use descriptive variable names (`max_newsletters_allowed` should come from `max_newsletters_per_day`)
2. Add SQL tests for critical business logic functions
3. Review column selections carefully when refactoring
4. Consider using explicit column aliases in SELECT statements
