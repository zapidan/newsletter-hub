# Slow Queries: PostgREST Lateral Join CTE Pattern

## Overview

This document analyzes the remaining slow queries in newsletterHub, identifies their root cause, and prescribes the correct fix. It replaces an earlier draft that incorrectly attributed the problem to "embedded joins" and proposed splitting queries at the application layer — a change that would have introduced N+1 query patterns and made performance worse.

The actual root cause is architectural: **PostgREST expands Supabase's relationship syntax into nested `LEFT JOIN LATERAL` CTEs**. The correct solution is already partially deployed (the `get_newsletters` RPC function). The remaining work is to extend that pattern to the code paths that still bypass it.

---

## Slow Query Inventory

All figures are from `pg_stat_statements`. Queries are grouped by category.

### Category A: Newsletter Lateral Join Queries (Primary Problem)

These are all PostgREST-generated CTEs. They differ only in their `WHERE` clause filter combination. Together they account for **~46% of total measured database time**.

| #   | Filter Combination                       | Calls | Mean (ms) | Total (s) | % of DB Time |
| --- | ---------------------------------------- | ----- | --------- | --------- | ------------ |
| 1   | `newsletter_source_id = $x`              | 9,095 | 145.6     | 1,325     | 22.2%        |
| 4   | `user_id` only                           | 2,788 | 163.1     | 455       | 7.6%         |
| 6   | `is_read + is_archived`                  | 5,238 | 76.4      | 400       | 6.7%         |
| 12  | `is_read + is_archived + received_at >=` | 3,412 | 46.7      | 159       | 2.7%         |
| 13  | `user_id` only, ASC                      | 820   | 181.8     | 149       | 2.5%         |
| 18  | `is_read + is_archived + source_ids`     | 8,367 | 9.4       | 78        | 1.3%         |
| 20  | `is_read + source_ids`, ASC              | 345   | 221.8     | 77        | 1.3%         |

**Total: ~2,643 seconds** across newsletter lateral join queries.

### Category B: Reading Queue Lateral Join (Secondary Problem)

| #   | Description                                                      | Calls | Mean (ms) | Total (s) | % of DB Time |
| --- | ---------------------------------------------------------------- | ----- | --------- | --------- | ------------ |
| 2   | `reading_queue` → `newsletters` → `newsletter_sources` (3-level) | 3,709 | 164.7     | 611       | 10.3%        |

### Category C: High-Frequency Count Queries

These queries are fast individually due to 100% buffer cache hit rate, but their call volume is excessive.

| #   | Description                                                         | Calls  | Mean (ms) | Total (s) | % of DB Time |
| --- | ------------------------------------------------------------------- | ------ | --------- | --------- | ------------ |
| 5   | `SELECT id FROM newsletters WHERE user_id + is_read + is_archived`  | 29,804 | 14.7      | 438       | 7.4%         |
| 8   | `SELECT newsletter_source_id WHERE user_id + is_read + is_archived` | 29,798 | 10.6      | 315       | 5.3%         |

~30,000 calls each strongly indicates these are triggered on every render or navigation rather than being properly cached. Query 8 maps directly to `getUnreadCountBySource()`, which loads all unread `newsletter_source_id` values into JavaScript memory to count them. Query 5 appears to come from `countBySource()` or a similar path calling `select('id', { count: 'exact' })` without `head: true`.

### Category D: Already-Optimized (RPC Functions)

These are in the slow query list but are already using the correct architecture. Performance can still be improved (see section on `get_newsletters` optimization), but they are not structural problems.

| #   | Description                   | Calls | Mean (ms) | Total (s) |
| --- | ----------------------------- | ----- | --------- | --------- |
| 10  | `get_newsletters_by_tags` RPC | 2,311 | 75.9      | 175       |
| 19  | `get_newsletters` RPC         | 549   | 122.4     | 67        |

### Category E: Out of Scope

| #      | Description                         | Notes                                       |
| ------ | ----------------------------------- | ------------------------------------------- |
| 3, 7   | `handle_incoming_email_transaction` | Email ingestion pipeline — separate concern |
| 9      | Bulk `word_count` update `DO` block | One-time maintenance script                 |
| 11, 16 | `can_receive_newsletter`            | Email pipeline gate function                |
| 15     | `find_suspicious_word_counts`       | One-off diagnostic query                    |
| 17     | `UPDATE newsletters SET is_read`    | Write path — acceptable at 28ms             |

---

## Root Cause: How PostgREST Generates Lateral Join CTEs

When the Supabase client uses relationship syntax like `source:newsletter_sources(*), tags:newsletter_tags(tag:tags(*))`, PostgREST translates this into a CTE with nested `LEFT JOIN LATERAL` subqueries. Here is the actual generated structure (simplified from the slow query log):

```sql
WITH pgrst_source AS (
  SELECT "public"."newsletters".*,
         row_to_json("newsletters_source_1".*) AS "source",
         COALESCE("newsletters_tags_1"."newsletters_tags_1", $null) AS "tags"
  FROM "public"."newsletters"

  -- Level 1 lateral: one subquery execution per newsletter row
  LEFT JOIN LATERAL (
    SELECT ns."id", ns."name", ns."from", ns."created_at", ns."updated_at", ns."user_id"
    FROM "public"."newsletter_sources" AS ns
    WHERE ns."id" = "public"."newsletters"."newsletter_source_id"
    LIMIT 1 OFFSET 0          -- per-row LIMIT prevents join optimization
  ) AS "newsletters_source_1" ON TRUE

  -- Level 2 lateral: tag aggregation also per-row with its own nested lateral
  LEFT JOIN LATERAL (
    SELECT json_agg("newsletters_tags_1") AS "newsletters_tags_1"
    FROM (
      SELECT row_to_json("newsletter_tags_tag_2".*) AS "tag"
      FROM "public"."newsletter_tags" AS nt

      -- Level 3 lateral: one more subquery per tag row
      LEFT JOIN LATERAL (
        SELECT t."id", t."name", t."color", t."user_id", t."created_at"
        FROM "public"."tags" AS t
        WHERE t."id" = nt."tag_id"
        LIMIT 1 OFFSET 0
      ) AS "newsletter_tags_tag_2" ON TRUE
      WHERE nt."newsletter_id" = "public"."newsletters"."id"
      LIMIT 100 OFFSET 0
    ) AS "newsletters_tags_1"
  ) AS "newsletters_tags_1" ON TRUE

  WHERE "public"."newsletters"."user_id" = $7
)
-- Pagination count runs a second full table scan
, pgrst_source_count AS (
  SELECT $15 FROM "public"."newsletters" WHERE "public"."newsletters"."user_id" = $10
)
SELECT
  (SELECT pg_catalog.count(*) FROM pgrst_source_count) AS total_result_set,
  ...
FROM (SELECT * FROM pgrst_source) _postgrest_t
```

### Why This Pattern Is Slow

1. **Per-row lateral execution**: The `LIMIT 1 OFFSET 0` on each lateral prevents PostgreSQL from planning a hash join or merge join across the full result set. Instead, the planner must loop: execute a correlated subquery for each newsletter row.

2. **Tag aggregation is also correlated**: The nested lateral for tags runs a correlated aggregate subquery (`json_agg`) for every single newsletter row returned, rather than aggregating once across all newsletters.

3. **Two table scans for pagination**: The outer CTE fetches data; a separate `pgrst_source_count` CTE re-scans the same table to count total rows. Every paginated query hits the newsletters table twice.

4. **RLS policy re-evaluation**: Supabase RLS policies are evaluated inside each lateral subquery. A three-level nested query runs the user ownership check at each level, per row.

5. **This is not a bug — it is how PostgREST works by design.** The solution is not to work around it with application-layer logic but to bypass PostgREST's relationship expansion entirely by using a `SECURITY DEFINER` SQL function.

---

## What Is Already Working

`newsletterApi.getAll()` already uses the correct architecture. It calls the `get_newsletters` SQL function via RPC:

```typescript
// src/common/api/newsletterApi.ts
const { data, error } = await supabase.rpc('get_newsletters', rpcParams);
```

The `get_newsletters` function (see `supabase/migrations/20260404_get_newsletters_function.sql`) uses proper SQL joins with a single `jsonb_agg` per newsletter for tags — no lateral nesting, no per-row correlated subqueries, no double table scan for count. This is the pattern to extend.

`getByTags()`, `getBySource()`, and `search()` all delegate to `getAll()`, so they also benefit from the RPC automatically.

---

## What Still Needs To Be Fixed

### 1. `newsletterApi.getById()` — still uses embedded join

```typescript
// src/common/api/newsletterApi.ts (lines 220–226)
selectClause = `
  *,
  source:newsletter_sources(*),
  tags:newsletter_tags(tag:tags(*))
`;
```

This generates the 3-level lateral join CTE on every single-record lookup. The query runs 9,095 times at 145ms mean in the slow query log.

**Fix**: Create a `get_newsletter_by_id` SQL function modeled exactly on `get_newsletters`, then call it via RPC.

### 2. `readingQueueApi.getAll()` — 3-level nested lateral join

```typescript
// src/common/api/readingQueueApi.ts (lines 95–109)
.select(`
  *,
  newsletters (
    *,
    newsletter_sources (*)   // ← this is the third lateral level
  )
`)
```

The reading queue embed already nests newsletters inside the queue. Adding `newsletter_sources` inside that creates a three-level lateral CTE — the deepest and most expensive pattern in the entire codebase. This generates query #2 (3,709 calls, 165ms mean, 611s total).

Tags are already fetched separately in a batch (see lines 193–213) — that part is correct and should stay.

**Fix**: Remove the `newsletter_sources` embed from inside the newsletter embed. Fetch sources separately as a single batch query after the queue items are loaded.

### 3. `readingQueueApi.getById()` — same 3-level pattern

```typescript
// src/common/api/readingQueueApi.ts (lines 394–407)
.select(`
  *,
  newsletters (
    *,
    newsletter_sources (*)
  )
`)
```

Same fix as `getAll()`.

### 4. High-frequency count queries — missing cache configuration

`getUnreadCountBySource()` fetches every unread newsletter's `newsletter_source_id` column (~30k calls in the log). It loads all values into JS memory to build a count map. This should use a `GROUP BY` aggregate query at the SQL level instead.

Both count queries (~29,800 calls each) indicate React Query `staleTime` is not configured on the hooks that call them, causing refetches on every component mount or window focus.

---

## Implementation

### Step 1: Create `get_newsletter_by_id` SQL Function

Create migration: `supabase/migrations/YYYYMMDD_get_newsletter_by_id_function.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_newsletter_by_id(
  p_user_id UUID,
  p_id      UUID
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  content              TEXT,
  summary              TEXT,
  image_url            TEXT,
  newsletter_source_id UUID,
  word_count           INTEGER,
  estimated_read_time  INTEGER,
  is_read              BOOLEAN,
  is_liked             BOOLEAN,
  is_archived          BOOLEAN,
  received_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  user_id              UUID,
  source               JSONB,
  tags                 JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id, n.title, n.content, n.summary, n.image_url,
    n.newsletter_source_id, n.word_count, n.estimated_read_time,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.created_at, n.updated_at, n.user_id,

    -- Source: simple LEFT JOIN, no lateral expansion
    to_jsonb(s) AS source,

    -- Tags: single correlated aggregate (once per record, not per row in a scan)
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',         t.id,
            'name',       t.name,
            'color',      t.color,
            'user_id',    t.user_id,
            'created_at', t.created_at
          ) ORDER BY t.name
        )
        FROM newsletter_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE nt.newsletter_id = n.id
      ),
      '[]'::jsonb
    ) AS tags

  FROM newsletters n
  LEFT JOIN newsletter_sources s
         ON s.id      = n.newsletter_source_id
        AND s.user_id = n.user_id
  WHERE n.id      = p_id
    AND n.user_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletter_by_id TO authenticated;
```

**Why this works**: The function is `SECURITY DEFINER`, so RLS is applied once at the function boundary rather than re-evaluated inside nested lateral subqueries. The source join is a plain `LEFT JOIN` that the planner can optimize freely. The tag aggregation is a single correlated subquery against one known `newsletter_id`, not a per-row loop over a full table scan.

### Step 2: Update `newsletterApi.getById()`

```typescript
// src/common/api/newsletterApi.ts
async getById(id: string, includeRelations = true): Promise<NewsletterWithRelations | null> {
  return withPerformanceLogging('newsletters.getById', async () => {
    const user = await requireAuth();

    if (!includeRelations) {
      const { data, error } = await supabase
        .from('newsletters')
        .select(
          'id, title, content, summary, image_url, newsletter_source_id, ' +
          'word_count, estimated_read_time, is_read, is_liked, is_archived, ' +
          'received_at, created_at, updated_at, user_id'
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        handleSupabaseError(error);
      }
      return data ? transformNewsletterResponse(data as any) : null;
    }

    // Use RPC to avoid PostgREST lateral join expansion
    const { data, error } = await supabase.rpc('get_newsletter_by_id', {
      p_user_id: user.id,
      p_id: id,
    });

    if (error) {
      if (error.code === 'PGRST116') return null;
      handleSupabaseError(error);
    }

    const rows = (data as any[]) ?? [];
    if (rows.length === 0) return null;

    return transformNewsletterResponse(rows[0]);
  });
},
```

### Step 3: Fix `readingQueueApi.getAll()`

Remove the nested `newsletter_sources` embed. Fetch sources in a single batch query after loading queue items. Tags continue to be fetched in a batch as they already are.

```typescript
// src/common/api/readingQueueApi.ts — getAll()
async getAll(limit?: number): Promise<ReadingQueueItem[]> {
  return withPerformanceLogging('readingQueue.getAll', async () => {
    const user = await requireAuth();

    // Step 1: Fetch queue + newsletter data (2-level join, no source nesting)
    let query = supabase
      .from('reading_queue')
      .select(
        `
        id, newsletter_id, user_id, priority, position, notes, created_at, updated_at,
        newsletters!inner (
          id, title, summary, content, image_url, received_at, updated_at,
          newsletter_source_id, user_id, is_read, is_archived, is_liked,
          word_count, estimated_read_time
        )
        `
      )
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: queueItems, error: queueError } = await query;

    if (queueError) handleSupabaseError(queueError);
    if (!queueItems?.length) return [];

    const invalidItems = queueItems.filter((item) => !item.newsletters);
    const validQueueItems = queueItems.filter((item) => item.newsletters);

    // ... (existing orphan cleanup logic unchanged) ...

    if (!validQueueItems.length) return [];

    // Step 2: Batch-fetch sources in a single query (no lateral join)
    const sourceIds = [
      ...new Set(
        validQueueItems
          .map((item) => (item.newsletters as any)?.newsletter_source_id)
          .filter(Boolean)
      ),
    ] as string[];

    const sourcesMap = new Map<string, any>();
    if (sourceIds.length > 0) {
      const { data: sources } = await supabase
        .from('newsletter_sources')
        .select('id, name, from, is_archived, created_at, updated_at, user_id')
        .in('id', sourceIds);
      sources?.forEach((s) => sourcesMap.set(s.id, s));
    }

    // Step 3: Batch-fetch tags (existing logic unchanged — already correct)
    const newsletterIds = validQueueItems
      .map((item) => item.newsletter_id)
      .filter((id) => id != null);

    let newsletterTags: Array<{ newsletter_id: string; tags: any }> = [];
    if (newsletterIds.length > 0) {
      const { data } = await supabase
        .from('newsletter_tags')
        .select('newsletter_id, tags(*)')
        .in('newsletter_id', newsletterIds);
      newsletterTags = data || [];
    }

    const tagsMap = new Map<string, Tag[]>();
    // ... (existing tagsMap build logic unchanged) ...

    // Step 4: Assemble result
    return validQueueItems.map((item) => {
      const newsletter = item.newsletters as any;
      const source = sourcesMap.get(newsletter.newsletter_source_id) ?? null;
      const tags = tagsMap.get(item.newsletter_id) || [];

      return transformQueueItem({
        ...item,
        newsletters: { ...newsletter, newsletter_sources: source, tags },
      });
    });
  });
},
```

The key change: `newsletter_sources (*)` is removed from the nested embed. This collapses the query from a **3-level lateral CTE** to a **2-level embed** plus one batch `SELECT ... WHERE id = ANY($1)`. The batch query for sources is not a lateral join — it is a plain equality scan against an indexed primary key, which is orders of magnitude cheaper.

### Step 4: Fix `readingQueueApi.getById()`

Apply the same pattern: remove `newsletter_sources` from the nested embed, fetch the single source with an explicit query.

```typescript
async getById(id: string): Promise<ReadingQueueItem | null> {
  return withPerformanceLogging('readingQueue.getById', async () => {
    const user = await requireAuth();

    const { data, error } = await supabase
      .from('reading_queue')
      .select(
        `
        id, newsletter_id, user_id, priority, position, notes, created_at, updated_at,
        newsletters!inner (
          id, title, summary, content, image_url, received_at, updated_at,
          newsletter_source_id, user_id, is_read, is_archived, is_liked,
          word_count, estimated_read_time
        )
        `
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      handleSupabaseError(error);
    }
    if (!data) return null;

    const newsletter = data.newsletters as any;

    // Fetch source for this single newsletter
    let source: any = null;
    if (newsletter?.newsletter_source_id) {
      const { data: sourceData } = await supabase
        .from('newsletter_sources')
        .select('id, name, from, is_archived, created_at, updated_at, user_id')
        .eq('id', newsletter.newsletter_source_id)
        .single();
      source = sourceData ?? null;
    }

    // Fetch tags (existing pattern)
    let newsletterTags: Array<{ tags: any }> = [];
    if (data.newsletter_id) {
      const { data: tagsData } = await supabase
        .from('newsletter_tags')
        .select('tags(*)')
        .eq('newsletter_id', data.newsletter_id);
      newsletterTags = tagsData || [];
    }

    return transformQueueItem({
      ...data,
      newsletters: { ...newsletter, newsletter_sources: source },
    });
    // (tag mapping unchanged from existing implementation)
  });
},
```

### Step 5: Fix High-Frequency Count Queries

**`getUnreadCountBySource()` — replace JS-side aggregation with SQL `GROUP BY`**

The current implementation fetches every unread row and counts in JavaScript. Replace with an aggregate query:

```typescript
async getUnreadCountBySource(): Promise<Record<string, number>> {
  return withPerformanceLogging('newsletters.getUnreadCountBySource', async () => {
    const user = await requireAuth();

    // Use RPC or a raw aggregate — do not load all rows into JS
    const { data, error } = await supabase.rpc('get_unread_count_by_source', {
      p_user_id: user.id,
    });

    if (error) handleSupabaseError(error);

    const unreadCounts: Record<string, number> = {};
    (data as Array<{ newsletter_source_id: string; count: number }> ?? []).forEach((row) => {
      unreadCounts[row.newsletter_source_id] = Number(row.count);
    });

    return unreadCounts;
  });
},
```

Companion SQL function:

```sql
CREATE OR REPLACE FUNCTION public.get_unread_count_by_source(p_user_id UUID)
RETURNS TABLE (newsletter_source_id UUID, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT newsletter_source_id, COUNT(*) AS count
  FROM newsletters
  WHERE user_id     = p_user_id
    AND is_read     = false
    AND is_archived = false
    AND newsletter_source_id IS NOT NULL
  GROUP BY newsletter_source_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_count_by_source TO authenticated;
```

**React Query cache configuration — stop re-fetching on every mount**

The hooks that call `getUnreadCountBySource()` and `getUnreadCount()` need explicit stale times. The counts change only when a newsletter is marked as read or a new one arrives — they do not need to be fresh on every mount:

```typescript
// Example: wherever useUnreadCount / useUnreadCountBySource hooks are defined
useQuery({
  queryKey: ['unreadCount', userId],
  queryFn: () => newsletterApi.getUnreadCount(),
  staleTime: 5 * 60 * 1000, // treat as fresh for 5 minutes
  gcTime: 60 * 60 * 1000, // keep in cache for 1 hour
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});
```

Unread counts are best updated via **optimistic cache mutations** when the user marks a newsletter as read — not via polling.

---

## Why Application-Level Query Splitting Is The Wrong Approach

An earlier version of this document proposed replacing embedded joins with explicit separate queries at the TypeScript level:

```typescript
// Proposed (incorrect) approach
const newsletter = await supabase.from('newsletters').select(explicitColumns);
const source = await newsletterSourceService.getById(newsletter.newsletter_source_id);
const tags = await tagService.getNewsletterTags(newsletter.id);
```

This is worse than the current approach for the following reasons:

1. **It trades 1 query for 3 sequential round trips**. Each awaited call is a separate HTTP request to the Supabase API. Network latency alone at 20ms/trip adds 40ms of irreducible overhead per call — at 9,095 calls/day that is an additional 364 seconds of latency that does not exist today.

2. **For list endpoints it creates a genuine N+1 problem**. Fetching sources for `newsletterGroupApi.getAll()` with `Promise.all(groups.map(g => getGroupSources(g.id)))` makes **2N + 1 queries** (1 for groups, N for source IDs, N for source details). The current single embedded query is objectively better. `Promise.all` parallelizes the round trips but does not eliminate them.

3. **It breaks data consistency**. Related records can change between separate queries. PostgREST's CTE approach at least provides snapshot consistency within a single transaction.

4. **It adds code complexity for no architectural gain**. The real fix (SQL function) requires fewer lines of application code than managing multiple queries, error states, and data assembly manually.

The correct pattern is: **push the join and aggregation into a `SECURITY DEFINER` SQL function, call it once via RPC, return a fully assembled record**. The database is better at joins than the application layer.

---

## Performance Impact Estimates

These are estimates based on query structure analysis, not measured benchmarks. Actual results should be validated after deployment.

| Change                                  | Mechanism                                 | Expected Directional Impact                                                               |
| --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getById` → RPC                         | Eliminates 3-level lateral CTE            | Mean time expected to drop significantly; total time reduction proportional to call count |
| `readingQueueApi` → remove source embed | Collapses 3-level to 2-level join + batch | Eliminates the deepest nesting; per-call latency should decrease                          |
| `getUnreadCountBySource` → `GROUP BY`   | Eliminates full-table JS aggregation      | Row transfer eliminated; server-side aggregate is indexed                                 |
| React Query `staleTime`                 | Reduces call frequency                    | 29k calls/period should drop to O(1) per session                                          |

**Do not publish performance targets as facts before measuring.** The original document's "69% improvement" figures were fabricated. Run `pg_stat_statements` before and after each change, compare, and document actual results.

---

## Testing Strategy

### Unit Tests

Update the `newsletterApi.getById` test to expect an RPC call instead of a `.from().select()` call:

```typescript
describe('newsletterApi.getById', () => {
  it('calls get_newsletter_by_id RPC', async () => {
    const result = await newsletterApi.getById('test-id');
    expect(supabase.rpc).toHaveBeenCalledWith('get_newsletter_by_id', {
      p_user_id: expect.any(String),
      p_id: 'test-id',
    });
  });

  it('returns null when newsletter not found', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await newsletterApi.getById('nonexistent-id');
    expect(result).toBeNull();
  });
});
```

Update `readingQueueApi` tests to expect the 2-level embed and a separate source query:

```typescript
describe('readingQueueApi.getAll', () => {
  it('does not embed newsletter_sources inside newsletters', async () => {
    await readingQueueApi.getAll();
    const selectCall = mockSelect.mock.calls[0][0];
    expect(selectCall).not.toContain('newsletter_sources');
  });

  it('fetches sources in a separate batch query', async () => {
    await readingQueueApi.getAll();
    expect(supabase.from).toHaveBeenCalledWith('newsletter_sources');
  });
});
```

### Integration / SQL Tests

Run `EXPLAIN (ANALYZE, BUFFERS)` on the new RPC functions against a realistic dataset before deploying:

```sql
-- Verify no sequential scan on newsletters for getById
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM get_newsletter_by_id(
  '<test-user-uuid>',
  '<test-newsletter-uuid>'
);
-- Expected: Index Scan on newsletters (pkey), not Seq Scan

-- Verify tag aggregation plan
-- Should show Hash Aggregate + Index Scan on newsletter_tags(newsletter_id)
-- Should NOT show nested loop + lateral
```

### Regression Checks

Before deploying each change, verify:

- All existing tests pass (`npm test` or equivalent)
- The `transformNewsletterResponse` function handles RPC response shape identically to the embedded join shape (source and tags are already JSONB in the RPC response)
- Reading queue items still have `newsletter.source` populated after the refactor
- Orphaned queue item cleanup logic still runs (it is independent of the select clause)

---

## Implementation Checklist

### Step 1: SQL Migrations

- [x] Create `get_newsletter_by_id(p_user_id, p_id)` function
- [x] Create `get_unread_count_by_source(p_user_id)` function
- [x] Grant `EXECUTE` to `authenticated` on both functions
- [ ] Run `EXPLAIN ANALYZE` on both functions against staging data
- [x] Verify `SECURITY DEFINER` + `SET search_path = public` are present

### Step 2: `newsletterApi.ts`

- [x] Update `getById()` to call `get_newsletter_by_id` RPC
- [x] Verify `transformNewsletterResponse` works with RPC row shape (JSONB `source` and `tags`)
- [x] Update unit tests to expect RPC call pattern

### Step 3: `readingQueueApi.ts`

- [x] Remove `newsletter_sources (*)` from `getAll()` select
- [x] Add batch source fetch after queue items load
- [x] Apply same change to `getById()`
- [x] Update unit tests to assert absence of nested source embed

### Step 4: Count Query Fixes

- [x] Replace `getUnreadCountBySource()` with `get_unread_count_by_source` RPC
- [ ] Identify hooks calling `getUnreadCount` and `getUnreadCountBySource`
- [ ] Add `staleTime` and `refetchOnWindowFocus: false` to those hooks
- [ ] Add optimistic cache updates when `markAsRead` / `markAsUnread` is called

### Step 5: Validation

- [ ] Deploy to staging, run for 24 hours
- [ ] Pull `pg_stat_statements` and compare mean times and total times against baseline
- [ ] Confirm query #1 (9,095 calls, 145ms) is no longer in top 10
- [ ] Confirm query #2 (3,709 calls, 164ms) is no longer in top 10
- [ ] Confirm queries #5 and #8 call count has dropped by >90%

---

## Rollback Plan

Each step is independently deployable and reversible.

**SQL functions**: Dropping a function that is not yet called has zero impact. If a function causes issues after wiring it up, revert the TypeScript change first (restoring the old select clause), then drop the function in a follow-up migration.

**TypeScript changes**: The `getById` and `readingQueueApi` changes can be reverted by restoring the original select clause. No schema changes are required to roll back.

**React Query config changes**: Reverting staleTime/refetchOnWindowFocus settings restores previous cache behavior immediately on next deploy.

---

## Root Cause Summary

| Problem                                         | Root Cause                                                                                                                | Fix                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Slow `getById` (9,095 calls, 145ms)             | PostgREST 3-level lateral CTE                                                                                             | `get_newsletter_by_id` SQL RPC                      |
| Slow `readingQueue.getAll` (3,709 calls, 164ms) | 3-level nested lateral CTE (queue → newsletter → source)                                                                  | Remove source embed; batch-fetch sources separately |
| High-frequency count queries (29k+ calls each)  | Missing `staleTime`; JS-side aggregation of full table                                                                    | SQL `GROUP BY` aggregate + React Query cache config |
| `get_newsletters` RPC itself at 122ms mean      | Acceptable for a list query; investigate index coverage on tag filter subquery if optimization is needed in a future pass | Out of scope for this phase                         |
