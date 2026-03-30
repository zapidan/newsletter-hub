# Tags Optimization Migration Guide

## Overview

This document outlines the migration from the current N:M relationship tags model to a JSON array
storage model. It has been updated to reflect the **actual implementation status** on the
`refactor-tags` branch and to document **critical bugs** found during review that must be fixed
before the migration is safe to run in production.

---

## ⚠️ Critical Issues Found During Review

The following bugs exist in the current implementation and **will cause runtime failures or
incorrect behavior** if deployed as-is.

### Bug 1 — Wrong JSONB operator in `get_newsletters_by_tags_any`

**File:** `supabase/migrations/20260131_migrate_tags_to_json_array.sql`

The `?|` operator on a JSONB array checks whether the array contains **top-level scalar string
elements** (e.g. `["Technology", "AI"]`). It does **not** search inside nested objects
`[{"name": "Technology"}]`. The current query will always return empty results.

```sql
-- BROKEN: looks for top-level string keys, not nested object fields
WHERE n.tags_json ?| p_tag_names
```

**Fix:** Use `EXISTS` with `jsonb_array_elements`:

```sql
-- CORRECT: checks the 'name' field of each array element
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(n.tags_json) AS elem
  WHERE elem->>'name' = ANY(p_tag_names)
)
```

---

### Bug 2 — Broken GIN expression index on tag names

**File:** `supabase/migrations/20260131_migrate_tags_to_json_array.sql`

`tags_json->>'name'` on a JSONB **array** returns `NULL` — the `->>` accessor only works on
objects. This index is filled with NULLs and will never be used by the query planner.

```sql
-- BROKEN: always evaluates to NULL for arrays
CREATE INDEX idx_newsletters_tag_names ON newsletters USING GIN ((tags_json->>'name'));
```

**Fix:** Index the extracted name array using `jsonb_path_query_array`:

```sql
-- CORRECT: creates a searchable array of name strings
CREATE INDEX idx_newsletters_tag_names ON newsletters
USING GIN (jsonb_path_query_array(tags_json, '$[*].name'));
```

---

### Bug 3 — `deleteTag` uses invalid Supabase syntax

**File:** `src/common/api/optimizedTagsApi.ts`

`supabase.rpc(...)` cannot be passed as a column value inside `.update()`. This will throw a
runtime error the first time a user deletes a tag.

```typescript
// BROKEN: rpc() returns a PostgrestBuilder, not a valid column value
.update({
  tags_json: supabase.rpc('remove_tag_from_json_array', { p_tag_id: tagId }),
})
```

**Fix:** Fetch current data, filter in JavaScript, then write back — or use a dedicated SQL
function called via `rpc` directly:

```typescript
// CORRECT option A: client-side filter (simple, fine for small datasets)
const { data: rows } = await supabase
  .from('newsletters')
  .select('id, tags_json')
  .eq('user_id', user.id)
  .contains('tags_json', JSON.stringify([{ id: tagId }]));

for (const row of rows ?? []) {
  const updatedTags = (row.tags_json as Tag[]).filter((t) => t.id !== tagId);
  await supabase
    .from('newsletters')
    .update({ tags_json: updatedTags, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('user_id', user.id);
}

// CORRECT option B: single SQL function (preferred at scale)
await supabase.rpc('delete_tag_from_all_newsletters', {
  p_user_id: user.id,
  p_tag_id: tagId,
});
```

---

### Bug 4 — `createTag` does not persist anything to the database

**File:** `src/common/api/optimizedTagsApi.ts`

`createTag` generates a UUID and returns an in-memory object. Nothing is written to the database.
In the N:M model, tags lived in a `tags` table; in the JSONB model there is no equivalent, so
a freshly created tag that hasn't been attached to a newsletter is completely invisible to
`getAll`, `getTagUsageStats`, and `get_user_tags`.

**Impact:** The tag management UI (create tag → assign later) is silently broken.

**Fix options:**
- **Option A (keep JSONB, no standalone tags):** Remove `createTag` from the API. Tag creation
  happens only through `addTagToNewsletter`. The UI must be updated to reflect this flow.
- **Option B (keep standalone tags):** Retain the `tags` table as a lightweight tag registry
  and only embed tag data into `tags_json` for query performance. This is the safer migration path.

---

### Bug 5 — `updateTag` throws by design, silently breaking tag rename

**File:** `src/common/hooks/useOptimizedTags.ts`

The `updateTag` mutation always throws:

```typescript
throw new Error('Tag updates not supported in optimized model - use updateNewsletterTags instead');
```

Because tags are now embedded in every newsletter's `tags_json`, renaming a tag requires
updating it across potentially thousands of newsletter rows. There is currently no mechanism for
this. Until a bulk-update SQL function is in place, tag rename is a regression from the N:M model.

**Fix:** Add a SQL function that updates the `name` or `color` field of a tag object in all
newsletter rows where it appears:

```sql
CREATE OR REPLACE FUNCTION public.update_tag_in_all_newsletters(
  p_user_id UUID,
  p_tag_id   UUID,
  p_name     TEXT,
  p_color    TEXT
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json = (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = p_tag_id::text
        THEN elem || jsonb_build_object('name', p_name, 'color', p_color)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(tags_json) AS elem
  ),
  updated_at = now()
  WHERE user_id = p_user_id
    AND tags_json @> jsonb_build_array(jsonb_build_object('id', p_tag_id));
$$;
```

---

### Bug 6 — SQL injection in `searchTags`

**File:** `src/common/api/optimizedTagsApi.ts`

User input is interpolated directly into the query string:

```typescript
// VULNERABLE: user input in template literal
.contains('tags_json', `[{"name": "${query}"}]`)
```

**Fix:** Use parameterized JSONB construction or a dedicated RPC:

```typescript
// SAFE: let PostgREST handle the value
.contains('tags_json', JSON.stringify([{ name: query }]))
// JSON.stringify escapes all special characters; no injection possible
```

---

### Bug 7 — `addTagToNewsletter` / `removeTagFromNewsletter` both require 2 DB round-trips

**File:** `src/common/api/optimizedTagsApi.ts`

Both operations fetch `tags_json` first, then write. This contradicts the "5× faster" claim in
the performance table. The operations are not worse than the old model, but they are not faster
either (old model: `INSERT INTO newsletter_tags` = 1 query).

**Fix:** Use a SQL function that performs an atomic read-modify-write:

```sql
CREATE OR REPLACE FUNCTION public.add_tag_to_newsletter(
  p_newsletter_id UUID,
  p_user_id       UUID,
  p_tag           JSONB
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json  = CASE
                     WHEN tags_json @> jsonb_build_array(jsonb_build_object('id', p_tag->>'id'))
                     THEN tags_json          -- already present, no-op
                     ELSE tags_json || jsonb_build_array(p_tag)
                   END,
      updated_at = now()
  WHERE id      = p_newsletter_id
    AND user_id = p_user_id;
$$;
```

---

### Bug 8 — `get_user_tags` cannot see tags with zero newsletters

**File:** `supabase/migrations/20260131_migrate_tags_to_json_array.sql`

Because `get_user_tags` derives its list by scanning `tags_json` across all newsletters, a tag
that has been created but not yet attached to any newsletter will be invisible. This only matters
if **Option B** (standalone tag registry) is chosen — see Bug 4.

---

### Bug 9 — `optimizedNewsletterApi.getAll` issues two queries

**File:** `src/common/api/optimizedNewsletterApi.ts`

The implementation calls `get_newsletters_with_sources_tags` and then separately calls
`count_newsletters_with_sources_tags`. The docs claim "single query operations". Either embed
`COUNT(*) OVER()` as a window function in the data query (as done in the tags queries), or accept
that two queries are fine and remove the misleading claim.

---

### Bug 10 — `add_performance_indexes` migration contradicts the JSONB strategy

**File:** `supabase/migrations/20260131_add_performance_indexes.sql`

This migration adds composite indexes on `newsletter_tags` and `tags` (the N:M tables), which the
JSONB migration is supposed to make obsolete. Running both migrations leaves the database
maintaining redundant structures. Decide which strategy to ship and drop the other migration or
mark the N:M indexes as transitional.

---

## Implementation Status (as of `refactor-tags` branch)

### ✅ Done

| Item | File |
|------|------|
| `tags_json` column + GIN index (with bugs — see above) | `supabase/migrations/20260131_migrate_tags_to_json_array.sql` |
| Data migration from N:M → JSON array | same migration |
| `get_newsletters_by_tags_any` SQL function (wrong operator — see Bug 1) | same migration |
| `get_newsletters_by_tags_all` SQL function | same migration |
| `get_tag_usage_stats` SQL function | same migration |
| `get_user_tags` SQL function | same migration |
| `optimizedTagsApi` — getAll, getNewslettersByTagsAny/All, getTagUsageStats, updateNewsletterTags, addTagToNewsletter, removeTagFromNewsletter, deleteTag (broken — see Bug 3), searchTags (injection — see Bug 6) | `src/common/api/optimizedTagsApi.ts` |
| `optimizedNewsletterApi` — getAll (double query — see Bug 9), getById; all mutations delegate to original | `src/common/api/optimizedNewsletterApi.ts` |
| `optimizedNewsletterService` — routing layer between optimized and original APIs | `src/common/services/optimizedNewsletterService.ts` |
| `useOptimizedTags` hook — getAll, create (broken — see Bug 4), delete, updateNewsletterTags; updateTag throws (see Bug 5) | `src/common/hooks/useOptimizedTags.ts` |
| `useInfiniteNewsletters` — switched to `optimizedNewsletterService` | `src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts` |
| Performance indexes migration | `supabase/migrations/20260131_add_performance_indexes.sql` |
| Unit tests for new APIs and service | `src/common/api/__tests__/`, `src/common/services/__tests__/` |

### ❌ Not Done (required before feature is usable)

| Item | Notes |
|------|-------|
| Fix `?|` operator in `get_newsletters_by_tags_any` | Bug 1 — returns empty results |
| Fix expression index on tag names | Bug 2 — index is useless |
| Fix `deleteTag` implementation | Bug 3 — runtime error |
| Decide on tag persistence model (standalone vs. newsletter-embedded) | Bug 4 |
| Implement `updateTag` across all newsletter rows | Bug 5 |
| Fix `searchTags` SQL injection | Bug 6 |
| Atomic SQL functions for add/remove tag | Bug 7 — 2-query operations |
| Wire `optimizedTagsApi` into existing components | TagSelector, TagsPage still use old hook |
| Enable tag filtering in `optimizedNewsletterService` | `useOptimizedForTagFiltering` is `false` |
| Wire `optimizedTagsApi` into `optimizedNewsletterApi.getByTags` | currently delegates to old API |
| Update `useNewsletters` hook to use optimized path for tag filtering | |
| Update TagSelector and TagsPage components | |
| E2E / integration tests covering the new flow | |
| Confirm `get_newsletters_with_sources_tags` DB function exists | referenced by `optimizedNewsletterApi` but not in any migration |

---

## Revised Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| Fix critical SQL bugs (Bugs 1–3, 7) | SQL functions only, no UI | 1 day |
| Decide tag persistence model + fix create/update/delete (Bugs 4–5) | API + hook | 1–2 days |
| Fix SQL injection (Bug 6) | 1-line fix | < 1 hr |
| Reconcile migration files (Bug 10) | Drop or keep N:M indexes | 0.5 days |
| Enable tag filtering in service + API | Wire `getByTags` through optimized path | 1 day |
| Update existing components (TagSelector, TagsPage, useNewsletters) | UI + hook updates | 2–3 days |
| Testing (unit + integration) | Fix broken mocks, add new cases | 2 days |
| Staging deployment + smoke tests | | 0.5 days |
| **Total** | | **~8–10 days** |

The original estimate of 10–12 days was realistic **only if the SQL approach were correct**. Given
the bugs found, plan for an extra 2–3 days of rework on the data layer before UI work can start.

---

## Current vs Optimized Model

### Current Model (N:M)

```sql
tags            (id, name, color, user_id, created_at, updated_at)
newsletter_tags (id, newsletter_id, tag_id, user_id, created_at)
newsletters     (id, title, content, ..., newsletter_source_id)
```

**Performance problems:**
- Complex join queries for tag filtering
- N+1 query pattern in `getByTags`
- Intersection logic in JavaScript
- Complex cache invalidation

### Target Model (JSONB array)

```sql
newsletters (id, title, content, ..., tags_json JSONB)
```

**When working correctly, benefits are:**
- Single query for tag filtering (once Bug 1 is fixed)
- GIN indexes on JSONB arrays (once Bug 2 is fixed)
- No join complexity for reads
- Simpler cache invalidation (newsletter key only)
- Atomic tag updates via SQL functions (once Bug 7 is fixed)

**Trade-offs that the original docs did not mention:**
- Tag rename requires a bulk UPDATE across all newsletters (no single row to change)
- Tags with zero newsletters cannot be independently listed (no tag registry)
- Storage overhead: tag name/color duplicated in every newsletter row

---

## Corrected Performance Comparison

| Operation | Current (N:M) | Optimized (JSONB) — when correctly implemented | Realistic improvement |
|-----------|---------------|------------------------------------------------|-----------------------|
| Get newsletters with tags | 3+ queries + JS | 1 query | **~5–20x faster** |
| Filter by multiple tags (ANY) | Complex joins | Single JSONB EXISTS scan + GIN | **~10–50x faster** |
| Filter by multiple tags (ALL) | Nested subqueries | Repeated EXISTS with GIN | **~5–20x faster** |
| Add tag to newsletter | 1 INSERT | 1 UPDATE (via SQL function) | **comparable** |
| Remove tag from newsletter | 1 DELETE | 1 UPDATE (via SQL function) | **comparable** |
| Rename a tag | 1 UPDATE on `tags` table | Bulk UPDATE across all newsletters | **~10–100x SLOWER** |
| Count newsletters per tag | JOIN + GROUP BY | JSON aggregation | **~5–10x faster** |
| List all tags (with counts) | 1 JOIN query | JSON aggregation scan | **comparable** |

The headline "10–100x improvement" applies narrowly to **read-heavy tag filtering** and
**tag listing**. Write operations (especially rename) are significantly more expensive in the
JSONB model.

---

## Corrected SQL Reference

### Tag filtering — ANY match (corrected)

```sql
CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags_any(
  p_user_id        UUID,
  p_tag_names      TEXT[],
  p_limit          INTEGER DEFAULT 50,
  p_offset         INTEGER DEFAULT 0,
  p_order_by       TEXT    DEFAULT 'received_at',
  p_order_direction TEXT   DEFAULT 'DESC'
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  newsletter_source_id UUID,
  is_read              BOOLEAN,
  is_liked             BOOLEAN,
  is_archived          BOOLEAN,
  received_at          TIMESTAMPTZ,
  user_id              UUID,
  tags_json            JSONB,
  total_count          BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    n.id, n.title, n.newsletter_source_id,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.user_id, n.tags_json,
    COUNT(*) OVER() AS total_count
  FROM newsletters n
  WHERE n.user_id = p_user_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(n.tags_json) AS elem
      WHERE elem->>'name' = ANY(p_tag_names)
    )
  ORDER BY
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at END DESC,
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'  THEN n.received_at END ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;
```

### Tag filtering — ALL match (corrected)

```sql
CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags_all(
  p_user_id         UUID,
  p_tag_names       TEXT[],
  p_limit           INTEGER DEFAULT 50,
  p_offset          INTEGER DEFAULT 0,
  p_order_by        TEXT    DEFAULT 'received_at',
  p_order_direction TEXT    DEFAULT 'DESC'
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  newsletter_source_id UUID,
  is_read              BOOLEAN,
  is_liked             BOOLEAN,
  is_archived          BOOLEAN,
  received_at          TIMESTAMPTZ,
  user_id              UUID,
  tags_json            JSONB,
  total_count          BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    n.id, n.title, n.newsletter_source_id,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.user_id, n.tags_json,
    COUNT(*) OVER() AS total_count
  FROM newsletters n
  WHERE n.user_id = p_user_id
    AND (
      SELECT COUNT(DISTINCT elem->>'name')
      FROM jsonb_array_elements(n.tags_json) AS elem
      WHERE elem->>'name' = ANY(p_tag_names)
    ) = cardinality(p_tag_names)
  ORDER BY
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at END DESC,
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'  THEN n.received_at END ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;
```

### Correct GIN index for tag name searches

```sql
-- Drop the broken one first
DROP INDEX IF EXISTS idx_newsletters_tag_names;

-- Correct: indexes all name strings extracted from the array
CREATE INDEX idx_newsletters_tag_names
ON newsletters
USING GIN (jsonb_path_query_array(tags_json, '$[*].name'));
```

### Atomic add-tag function

```sql
CREATE OR REPLACE FUNCTION public.add_tag_to_newsletter(
  p_newsletter_id UUID,
  p_user_id       UUID,
  p_tag           JSONB
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json = CASE
                    WHEN tags_json @> jsonb_build_array(jsonb_build_object('id', p_tag->>'id'))
                    THEN tags_json
                    ELSE tags_json || jsonb_build_array(p_tag)
                  END,
      updated_at = now()
  WHERE id      = p_newsletter_id
    AND user_id = p_user_id;
$$;
```

### Atomic remove-tag function

```sql
CREATE OR REPLACE FUNCTION public.remove_tag_from_newsletter(
  p_newsletter_id UUID,
  p_user_id       UUID,
  p_tag_id        UUID
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM   jsonb_array_elements(tags_json) AS elem
    WHERE  elem->>'id' != p_tag_id::text
  ),
  updated_at = now()
  WHERE id      = p_newsletter_id
    AND user_id = p_user_id;
$$;
```

### Bulk delete-tag-from-all function

```sql
CREATE OR REPLACE FUNCTION public.delete_tag_from_all_newsletters(
  p_user_id UUID,
  p_tag_id  UUID
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM   jsonb_array_elements(tags_json) AS elem
    WHERE  elem->>'id' != p_tag_id::text
  ),
  updated_at = now()
  WHERE user_id = p_user_id
    AND tags_json @> jsonb_build_array(jsonb_build_object('id', p_tag_id));
$$;
```

### Bulk update-tag-in-all (required for rename)

```sql
CREATE OR REPLACE FUNCTION public.update_tag_in_all_newsletters(
  p_user_id UUID,
  p_tag_id  UUID,
  p_name    TEXT,
  p_color   TEXT
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE newsletters
  SET tags_json = (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = p_tag_id::text
        THEN elem || jsonb_build_object('name', p_name, 'color', p_color)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(tags_json) AS elem
  ),
  updated_at = now()
  WHERE user_id = p_user_id
    AND tags_json @> jsonb_build_array(jsonb_build_object('id', p_tag_id));
$$;
```

---

## Updated Migration Checklist

### Data layer (must complete before UI work)
- [ ] Fix `get_newsletters_by_tags_any` — replace `?|` with `EXISTS` / `jsonb_array_elements`
- [ ] Fix GIN expression index on tag names (drop broken one, create correct one)
- [ ] Add `add_tag_to_newsletter` SQL function
- [ ] Add `remove_tag_from_newsletter` SQL function
- [ ] Add `delete_tag_from_all_newsletters` SQL function
- [ ] Add `update_tag_in_all_newsletters` SQL function
- [ ] Decide and document tag persistence model (standalone registry vs. embedded-only)
- [ ] Reconcile `add_performance_indexes` migration with JSONB strategy

### API layer
- [ ] Fix `deleteTag` to use `delete_tag_from_all_newsletters` RPC
- [ ] Fix `addTagToNewsletter` to use `add_tag_to_newsletter` RPC (atomic, 1 query)
- [ ] Fix `removeTagFromNewsletter` to use `remove_tag_from_newsletter` RPC (atomic, 1 query)
- [ ] Fix `searchTags` SQL injection (`JSON.stringify` instead of template literal)
- [ ] Implement `updateTag` via `update_tag_in_all_newsletters` RPC
- [ ] Implement `createTag` with real persistence (depends on chosen model)
- [ ] Wire `optimizedTagsApi` into `optimizedNewsletterApi.getByTags`
- [ ] Set `useOptimizedForTagFiltering: true` in `optimizedNewsletterService` once API is correct

### Component / hook layer
- [ ] Update `useNewsletters` hook to use optimized tag filtering path
- [ ] Update `TagSelector` to use `useOptimizedTags`
- [ ] Update `TagsPage` to use `getTagUsageStats` from `useOptimizedTags`
- [ ] Remove `useLocalTagFiltering` flag from `App.tsx` (or set to `false`)

### Testing
- [ ] Fix unit test mocks for `addTagToNewsletter` / `removeTagFromNewsletter` (now single RPC call)
- [ ] Add unit tests for `updateTag`, `createTag`
- [ ] Add integration tests for tag filtering (ANY and ALL)
- [ ] Performance benchmark: compare query times before and after

### Deployment
- [ ] Run corrected migrations against staging database
- [ ] Verify GIN index usage with `EXPLAIN ANALYZE`
- [ ] Smoke-test tag create / rename / delete / filter flows
- [ ] Deploy to production
- [ ] Monitor query execution times for 48 hours post-deploy

---

## Rollback Plan

If issues arise post-deploy:

1. The `tags_json` column can be dropped without data loss if the original N:M tables were
   preserved (the migration does not drop `tags` or `newsletter_tags`).
2. Re-enable the original `tagService` imports in components.
3. Drop the new SQL functions and the `tags_json` column:
   ```sql
   DROP FUNCTION IF EXISTS get_newsletters_by_tags_any CASCADE;
   DROP FUNCTION IF EXISTS get_newsletters_by_tags_all CASCADE;
   DROP FUNCTION IF EXISTS get_tag_usage_stats CASCADE;
   DROP FUNCTION IF EXISTS get_user_tags CASCADE;
   DROP FUNCTION IF EXISTS add_tag_to_newsletter CASCADE;
   DROP FUNCTION IF EXISTS remove_tag_from_newsletter CASCADE;
   DROP FUNCTION IF EXISTS delete_tag_from_all_newsletters CASCADE;
   DROP FUNCTION IF EXISTS update_tag_in_all_newsletters CASCADE;
   DROP TRIGGER IF EXISTS validate_newsletters_tags_json ON newsletters;
   DROP FUNCTION IF EXISTS validate_tags_json CASCADE;
   ALTER TABLE newsletters DROP COLUMN IF EXISTS tags_json;
   ```

---

## Original API surface (for reference)

### New API methods once all bugs are fixed

```typescript
// Get all unique tags for the user with usage counts (single RPC)
await optimizedTagsApi.getAll();

// Get newsletters matching ANY of the given tag names
await optimizedTagsApi.getNewslettersByTagsAny(['Technology', 'AI'], { limit: 50 });

// Get newsletters matching ALL of the given tag names
await optimizedTagsApi.getNewslettersByTagsAll(['Technology', 'AI'], { limit: 50 });

// Tag usage statistics (single RPC)
await optimizedTagsApi.getTagUsageStats();

// Tag mutations (all single-RPC after fixes)
await optimizedTagsApi.createTag({ name: 'Research', color: '#6366f1' });
await optimizedTagsApi.updateTag({ id, name: 'Research 2', color: '#6366f1' });
await optimizedTagsApi.addTagToNewsletter(newsletterId, tag);
await optimizedTagsApi.removeTagFromNewsletter(newsletterId, tagId);
await optimizedTagsApi.deleteTag(tagId);
```

### Hook usage (after wiring is complete)

```typescript
const {
  tags,
  loading,
  error,
  getTags,
  createTag,
  updateTag,        // works once Bug 5 is fixed
  deleteTag,
  updateNewsletterTags,
  getNewslettersByTagsAny,
  getNewslettersByTagsAll,
  getTagUsageStats,
} = useOptimizedTags();
```
```

Now update `TAGS_PERFORMANCE_FIXES.md` to clarify it describes a parallel (and complementary) approach, not the JSONB migration: