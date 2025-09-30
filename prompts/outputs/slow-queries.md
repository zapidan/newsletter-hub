# Slow queries: Newsletter listing and tags aggregation

This document captures the root causes of the slow newsletter listing query and prescribes a prioritized plan to improve performance across DB, API, and client.

Paths and files referenced:

- API: `src/common/api/newsletterApi.ts`
- Infinite scroll hook: `src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts`
- Service: `src/common/services/newsletter/NewsletterService.ts`
- Migrations (indexes): `supabase/migrations/`

## TL;DR bottlenecks

- Per-row LATERAL subqueries to aggregate tags (N+1 pattern) in the generated SQL.
- OFFSET pagination on a large ordered set (`received_at DESC`), with exact count on every call.
- Sort/filter pattern not fully covered by a single composite index with tiebreaker.

---

## Recommended actions (in priority order)

- [ ] **Add/adjust composite indexes to match filter + sort + stable tiebreaker**

  - Add: `(user_id, received_at DESC, id)`
  - Optional (if non-archived is the dominant view): partial index on `WHERE is_archived = false`

- [ ] **Switch the list API and client from OFFSET to keyset (cursor) pagination**

  - Order by `(received_at DESC, id DESC)`
  - Pass the last row’s `(received_at, id)` as cursor to fetch the next page
  - Works with the composite index above and yields stable latency as pages go deeper

- [ ] **Stop doing exact counts on the hot path**

  - Preferred: use `planned/estimated` counts for UI display (fast) instead of `exact`
  - Or: compute exact counts off the hot path (background/cached counters, materialized views, or on-demand endpoint)

- [ ] **Flatten tag aggregation to a single pass** (if/when we migrate the backend SQL)

  - Avoid per-row LATERAL; aggregate tags for the page slice once and `left join` the results

- [ ] **Validate improvements with EXPLAIN (ANALYZE, BUFFERS)**
  - Confirm index usage and absence of large sorts / deep nested loops on the hot path

---

## 1) Index changes

Add the following indexes in a new migration (keep existing ones until verified unused):

```sql
-- Composite for filter + order + tiebreaker
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_received_id
  ON public.newsletters (user_id, received_at DESC, id);

-- Optional: smaller, even faster for “inbox” view if it dominates traffic
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_received_id_unarch
  ON public.newsletters (user_id, received_at DESC, id)
  WHERE is_archived = false;
```

Notes:

- Keep current indexes that are used by other code paths, but monitor `pg_stat_user_indexes` and `EXPLAIN` to see if some single-column indexes are redundant once the composite is in use.

Existing relevant indexes (already in repo):

- `supabase/migrations/20250716213000_add_newsletter_performance_indexes.sql`
  - `idx_newsletters_user_received` on `(user_id, received_at DESC)`
  - Tag and source lookup indexes
- `supabase/migrations/20250626221000_add_performance_indexes.sql`
  - Single-column/partial indexes for common flags and sorting

The new `(user_id, received_at DESC, id)` index is the critical addition for stable keyset pagination and faster sorts.

---

## 2) Keyset (cursor) pagination

Why keyset?

- OFFSET requires scanning and discarding `offset` rows; latency grows with page depth.
- Keyset uses a ‘seek’ predicate leveraging the index; latency remains stable as we paginate.

Current implementation (OFFSET):

- `newsletterApi.ts` → `buildNewsletterQuery()` uses `.limit()` + `.range(offset, end)` and `select(..., { count: 'exact' })`.
- `useInfiniteNewsletters.ts` passes `offset` via `pageParam` and uses `count` to compute next page.

Target implementation (keyset):

- Ordering: `received_at DESC, id DESC` for stability.
- Cursor: last row’s `(received_at, id)`.
- Predicate: `(received_at, id) < ($last_received_at, $last_id)`.

Client shape (conceptual):

```ts
// useInfiniteNewsletters.ts (conceptual changes)
getNextPageParam: (lastPage) => {
  if (lastPage.data.length < pageSize) return undefined; // no more
  const last = lastPage.data[lastPage.data.length - 1];
  return { received_at: last.received_at, id: last.id }; // cursor
};

// queryFn: pass cursor instead of offset
const result = await newsletterService.getAll({
  ...baseQueryParams,
  cursorReceivedAt: pageParam?.received_at,
  cursorId: pageParam?.id,
  offset: undefined, // remove offset
});
```

API shape (conceptual):

```ts
// newsletterApi.ts (conceptual changes)
// - Always order by received_at desc, id desc
// - If cursor provided, add a where clause to seek past the last row
const query = supabase
  .from('newsletters')
  .select(selectClause, { count: 'planned' }) // or omit count entirely
  .eq('user_id', user.id)
  .order('received_at', { ascending: false })
  .order('id', { ascending: false });

if (cursorReceivedAt && cursorId) {
  // PostgREST lacks tuple comparison; emulate with OR for tie-breaker
  query = query.or(
    `and(received_at.lt.${cursorReceivedAt}),and(received_at.eq.${cursorReceivedAt},id.lt.${cursorId})`
  );
}

query = query.limit(limit);
```

If needed, introduce a lightweight RPC/view to support tuple seek semantics; the composite index ensures these become index range scans.

---

## 3) Counts: options that avoid hot-path exact scans

We still need counts, but exact counting on every page load is expensive. Two alternative strategies:

- **Planned/estimated counts (fast)**

  - In `newsletterApi.ts`, change `select(..., { count: 'exact' })` to `count: 'planned'` to get the planner’s estimate. Good enough for UI progress indicators and does not require full scans.
  - Client code should treat it as approximate and not strictly rely on it for pagination.

- **Compute exact counts off the hot path**
  - Options:
    - A background job maintains a per-user counter table (updated on insert/delete/archive/unarchive). Reads become `SELECT ... FROM counters WHERE user_id = ?`.
    - A materialized view with `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a schedule or triggered by relevant mutations.
    - A separate endpoint that computes `count(*)` on demand (e.g., when the user opens a sidebar) and caches the result in memory/Redis.

Where counts are currently used:

- `newsletterApi.ts` list: `select(selectClause, { count: 'exact' })` → drives `result.count`.
- `useInfiniteNewsletters.ts`: computes `hasMore` and next page using `result.count` and accumulated `data.length`.
- UI: `InfiniteNewsletterList.tsx` → `LoadingSentinel` receives `totalCount`.

Migration plan:

- For pagination logic, stop relying on `count`; compute `hasMore` by `page.length === limit`.
- Keep `totalCount` display, but back it with either planned counts (fast) or a separately fetched exact count that is cached.

---

## 4) Tag aggregation shape (lower priority)

If/when we control the SQL, replace LATERAL per-row subqueries with a single aggregation for the page slice:

```sql
WITH page AS (
  SELECT id, user_id, received_at, ...
  FROM public.newsletters
  WHERE user_id = $1
    AND ( ... keyset predicate if provided ... )
  ORDER BY received_at DESC, id DESC
  LIMIT $2
)
SELECT p.*,
       COALESCE(
         jsonb_agg(DISTINCT to_jsonb(t) ORDER BY t.name)
         FILTER (WHERE t.id IS NOT NULL),
         '[]'::jsonb
       ) AS tags
FROM page p
LEFT JOIN public.newsletter_tags nt ON nt.newsletter_id = p.id
LEFT JOIN public.tags t ON t.id = nt.tag_id
GROUP BY p.id
ORDER BY p.received_at DESC, p.id DESC;
```

This ensures tags are aggregated once per page, not once per row via LATERAL.

---

## 5) Rollout plan

- Phase 1: Ship indexes

  - Deploy `idx_newsletters_user_received_id` (and optional partial)
  - Validate with `EXPLAIN (ANALYZE, BUFFERS)` that the index is used under current OFFSET pattern

- Phase 2: Switch counts to non-exact

  - Change list query to use `count: 'planned'` (or none) and keep UI functional
  - (Optionally) add a separate exact-count fetch that is cached and not called during scroll

- Phase 3: Move to keyset pagination

  - API: add cursor params and seek predicate; always order by `(received_at desc, id desc)`
  - Client: replace `offset` with cursor in `useInfiniteNewsletters.ts`
  - UI: compute `hasMore` by page length

- Phase 4 (optional): SQL shape for tags
  - If the backend allows, switch to page-first + single aggregation

---

## 6) Validation checklist

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` for first page and deep pages shows index range scans, not large sorts or nested loops per row
- [ ] Latency does not grow with page depth after keyset switch
- [ ] CPU time drops due to removal of hot-path exact counts
- [ ] Tag aggregation happens once per page (if/when that change is made)
- [ ] UI still shows a reasonable total (planned/approx or cached exact)

---

## References to current code

- OFFSET pagination and exact counts:

  - `src/common/api/newsletterApi.ts` → `buildNewsletterQuery()` uses `.select(selectClause, { count: 'exact' })` and `.range(offset, end)`
  - `src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts` uses `pageParam` as an `offset` and computes `nextPage` from `result.count`

- Unread count (exact):

  - `src/common/api/newsletterApi.ts` → `getUnreadCount()` uses `.select('id', { count: 'exact', head: true })`. Keeping exact here is fine; this endpoint is cheap and targeted, not called on every scroll fetch.

- Existing indexes:
  - `supabase/migrations/20250716213000_add_newsletter_performance_indexes.sql`
  - `supabase/migrations/20250626221000_add_performance_indexes.sql`
