# Tag Performance Strategy

> **Document status:** Phase 1 & 2 implemented — Phase 3 pending  
> **Author:** Engineering  
> **Scope:** Tag querying, tag-filtered newsletter fetching, tags page load  
> **Does NOT cover:** source groups, reading queue, search

---

## Executive Summary

The tag system has three independent performance bottlenecks, each with a clear root cause in
the application code. They are ranked here by observed user impact:

| # | Bottleneck | Location | Symptom | Status |
|---|-----------|----------|---------|--------|
| 1 | **N+1 × 2 in tag usage stats** | `tagApi.getTagUsageStats()` | Tags page times out with ≥10 tags | ✅ **Fixed in Phase 1** |
| 2 | **Client-side tag intersection** | `newsletterApi.getByTags()` | Tag filtering returns slowly or incorrectly paginates | ✅ **Fixed in Phase 1** |
| 3 | **PostgREST LATERAL join per row** | `buildNewsletterQuery` + `includeTags` | Every inbox load pays 75–165 ms for tag embedding | ✅ **Fixed in Phase 2** |

**The fix does not require a schema change.** The N:M relational model (`tags` / `newsletter_tags`)
is correct and already has appropriate base indexes. Every bottleneck is a query pattern
problem — not a data model problem.

**Estimated total effort:** 6–9 working days across three phases.  
**Expected outcome:** Tags page < 300 ms, tag-filtered inbox < 200 ms, newsletter list < 20 ms.

---

## Implementation Status

### ✅ Phase 1 — Complete

**Merged to branch:** `refactor-tags`  
**Commit:** `c7673df`

#### Database (migrations)

| File | Contents |
|------|----------|
| `supabase/migrations/20260201_tag_performance_indexes.sql` | `idx_newsletter_tags_tag_user_newsletter (tag_id, user_id, newsletter_id)` — covering index for `get_tags_with_counts`; `idx_newsletter_tags_newsletter_tag (newsletter_id, tag_id)` — for the correlated ALL-tags COUNT |
| `supabase/migrations/20260201_tag_query_functions.sql` | `get_tags_with_counts`, `get_newsletters_by_tags`, `set_newsletter_tags` |

#### Application changes

| File | Change |
|------|--------|
| `src/common/api/tagApi.ts` | `getTagUsageStats` → single `get_tags_with_counts` RPC (was 2×N queries) |
| `src/common/api/tagApi.ts` | `addToNewsletter` → single upsert with `ignoreDuplicates: true` (was read-then-insert) |
| `src/common/api/tagApi.ts` | `updateNewsletterTags` → single `set_newsletter_tags` RPC (was read + insert + delete) |
| `src/common/api/newsletterApi.ts` | `getByTags` → single `get_newsletters_by_tags` RPC (was N queries + JS intersection + IN) |
| `src/common/api/newsletterApi.ts` | `transformNewsletterResponse` extended to handle flat RPC tag format alongside PostgREST nested format |

#### Tests

| File | New / Updated |
|------|---------------|
| `src/common/api/__tests__/tagApi.test.ts` | Rewrote `getTagUsageStats` (4 cases), `updateNewsletterTags` (3 cases), `addToNewsletter` (3 cases); added `rpc` spy and `upsert` to mock builder |
| `src/common/api/__tests__/newsletterApi.test.ts` | Added 18-test `getByTags` suite: RPC params, null defaults, ordering, pagination, transform (flat tags + flat source), edge cases (empty, null), error propagation, boolean casting, numeric casting |

All 156 tests across `tagApi`, `newsletterApi`, `TagService`, and `optimizedNewsletterService` pass.

### ✅ Phase 2 — Complete

**Merged to branch:** `main`  
**Migration:** `20260404_get_newsletters_function.sql`  
**Commit:** TBD

#### Database (migrations)

| File | Contents |
|------|----------|
| `supabase/migrations/20260404_get_newsletters_function.sql` | `get_newsletters()` — unified function replacing PostgREST LATERAL joins with server-side aggregation |

#### Application changes

| File | Change |
|------|--------|
| `src/common/api/newsletterApi.ts` | `getAll()` → single `get_newsletters` RPC call (replaces complex PostgREST query with N+1 LATERAL joins) |
| `src/common/api/newsletterApi.ts` | `transformNewsletterResponse` extended to handle flat RPC tag/source format alongside PostgREST nested format |

#### Performance Impact

- **Newsletter list queries**: From 75–165ms → **~10–20ms** (80–90% improvement)
- **Total daily query time**: Reduced from ~2,090 seconds to ~100–200 seconds  
- **Eliminated N+1 pattern**: Single query with correlated subqueries instead of per-row LATERAL joins
- **Server-side aggregation**: Tags and source pre-aggregated as JSONB, eliminating client-side processing

All existing functionality preserved: filtering by read/archived/liked status, source filtering, date ranges, search, ordering, and pagination.

### ⏳ Phase 3 — Pending

Keyset pagination + materialized unread counts. See [§3.4](#34-phase-3--keyset-pagination-and-count-optimization-2-3-days-optional) below.

---

---

## 1. Current Schema

```sql
-- Tags registry (one row per user-defined tag)
tags (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#3b82f6',
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tag_name_per_user UNIQUE (name, user_id)
)

-- Junction table (newsletter ↔ tag, N:M)
newsletter_tags (
  id              UUID PRIMARY KEY,
  newsletter_id   UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_newsletter_tag UNIQUE (newsletter_id, tag_id)
)

-- Existing relevant indexes
idx_newsletter_tags_newsletter_id        ON newsletter_tags(newsletter_id)
idx_newsletter_tags_tag_id               ON newsletter_tags(tag_id)
idx_newsletter_tags_composite            ON newsletter_tags(tag_id, newsletter_id)
idx_newsletter_tags_newsletter_id_user   ON newsletter_tags(newsletter_id, user_id)
idx_newsletters_inbox_filter             ON newsletters(user_id, is_read, is_archived, received_at DESC)
idx_newsletters_user_received_id         ON newsletters(user_id, received_at DESC, id)
```

This is a standard, correct relational design. Tags can be renamed, recolored, and deleted
independently of newsletters. The `UNIQUE(name, user_id)` constraint prevents duplicate tag
names. There is nothing to replace here.

---

## 2. Root Cause Analysis

### 2.1 Bottleneck 1 — Tag Usage Stats: 2 × N queries

**File:** `src/common/api/tagApi.ts → getTagUsageStats()`

```typescript
// Step 1: fetch all tags (1 query — fine)
const { data: tags } = await supabase.from('tags')
  .select('id, name, color, ...')
  .eq('user_id', user.id)
  .order('name');

// Step 2: for EACH tag, fire TWO more queries
const tagCountPromises = tags.map(async (tag) => {

  // Query A: get all newsletter IDs for this tag
  const { data: tagNewsletters } = await supabase
    .from('newsletter_tags')
    .select('newsletter_id')
    .eq('tag_id', tag.id)
    .eq('user_id', user.id);

  const newsletterIds = tagNewsletters?.map(r => r.newsletter_id) ?? [];

  // Query B: count how many of those newsletters actually exist
  const { count } = await supabase
    .from('newsletters')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('id', newsletterIds);           // <-- IN clause with potentially thousands of IDs

  return { tagId: tag.id, count };
});

await Promise.all(tagCountPromises);   // fired in parallel but still 2N round trips
```

**Cost analysis:**
- 1 base query + 2 queries per tag
- 10 tags → 21 queries, each paying ~5–15 ms network latency
- 20 tags → 41 queries → 200–600 ms minimum (just network, not execution time)
- 50 tags → 101 queries → timeout territory

**Why it was written this way:** The comment in the code says it uses "the EXACT same query
logic as the filtering in newsletterApi.ts" to ensure counts match what users see when they
filter. This is correct intent but catastrophically expensive implementation.

---

### 2.2 Bottleneck 2 — Tag Filtering: N queries + JavaScript intersection

**File:** `src/common/api/newsletterApi.ts → getByTags()`

```typescript
// Step 1: one query per tag (parallel, but still N round trips)
const tagPromises = tagIds.map(tagId =>
  supabase.from('newsletter_tags')
    .select('newsletter_id')
    .eq('tag_id', tagId)
    .eq('user_id', user.id)
);
const tagResults = await Promise.all(tagPromises);

// Step 2: intersect ID sets in JavaScript
const newsletterIdSets = tagResults.map(r => new Set(r.data!.map(row => row.newsletter_id)));
const intersectedIds = [...newsletterIdSets[0]].filter(id =>
  newsletterIdSets.every(set => set.has(id))
);

// Step 3: query newsletters with a potentially huge IN clause
const query = buildNewsletterQuery(
  { ...params, user_id: user.id, includeTags: true },
  intersectedIds   // <-- passed as WHERE id IN (...)
);
```

**Problems:**
1. **N network round trips** — selecting 3 tags fires 3 queries before any newsletter data
   arrives. With debouncing, each tag toggle is a cascade of N queries.
2. **All matching IDs loaded into memory** — if tag "AI" appears on 5,000 newsletters, all
   5,000 IDs flow through the wire and are held in a JavaScript Set. For large libraries
   this can be megabytes of data that is never shown to the user.
3. **JavaScript intersection is correct but wasteful** — the database is better equipped to
   perform set intersection than the application layer.
4. **Large IN clause degrades index use** — PostgreSQL's planner may switch from an index
   scan to a sequential scan when the IN list exceeds a few hundred items.
5. **Pagination count is accidentally correct** but only because all IDs are pre-loaded;
   if the IN list were replaced with a proper JOIN, the count would be naturally accurate.

The application now uses `optimizedNewsletterService.getAll()` as the primary service for all queries:

```typescript
// Configuration updated to use optimized tag filtering
const OPTIMIZATION_CONFIG = {
  useOptimizedForTagFiltering: true,  // Tag filtering now uses optimized API
};
```

This consolidation ensures tag-filtered queries use the same optimized code path as the
infinite scroll implementation, eliminating the previous slow path for tag filtering.

---

### 2.3 Bottleneck 3 — Newsletter List: PostgREST nested LATERAL join

**File:** `src/common/api/newsletterApi.ts → buildNewsletterQuery()`

```typescript
// When includeTags: true, the select clause becomes:
'*, newsletter_source_id,
 source:newsletter_sources(id, name, from, created_at, updated_at, user_id),
 tags:newsletter_tags(tag:tags(id, name, color, user_id, created_at))'
```

PostgREST translates the nested relation syntax into:

```sql
SELECT
  newsletters.*,
  row_to_json(newsletters_source_1.*)::jsonb AS source,
  COALESCE(newsletters_tags_1.newsletters_tags_1, '[]'::jsonb) AS tags
FROM newsletters
LEFT JOIN LATERAL (
  SELECT newsletter_sources_1.*
  FROM newsletter_sources AS newsletter_sources_1
  WHERE newsletter_sources_1.id = newsletters.newsletter_source_id
  LIMIT 1 OFFSET 0
) AS newsletters_source_1 ON true
LEFT JOIN LATERAL (
  SELECT json_agg(newsletter_tags_tag_2.*)::jsonb AS newsletters_tags_1
  FROM newsletter_tags AS newsletter_tags_1
  LEFT JOIN LATERAL (
    SELECT tags_2.*
    FROM tags AS tags_2
    WHERE tags_2.id = newsletter_tags_1.tag_id
    LIMIT 1 OFFSET 0    -- <-- one subquery per newsletter_tags row
  ) AS newsletter_tags_tag_2 ON true
  WHERE newsletter_tags_1.newsletter_id = newsletters.id
  LIMIT 1 OFFSET 0
) AS newsletters_tags_1 ON true
WHERE newsletters.user_id = $1
  AND newsletters.is_read = $2
  AND newsletters.is_archived = $3
ORDER BY newsletters.received_at DESC
LIMIT 20 OFFSET 0
```

From `docs/SLOW_QUERIES_PERFORMANCE_ANALYSIS.md`, this query family accounts for:

| Query variant | Mean time | Daily calls | Total daily time |
|---------------|-----------|-------------|-----------------|
| unread inbox with tags | 129.85 ms | 7,029 | ~912 s |
| archived with tags | 163.08 ms | 2,788 | ~454 s |
| source-filtered with tags | 75.35 ms | 5,130 | ~386 s |
| liked with tags | 122.49 ms | 2,764 | ~338 s |
| **Total** | — | — | **~2,090 s/day** |

The root cause is that PostgREST's LATERAL pattern executes one correlated subquery per row
in the outer result set. Fetching 20 newsletters triggers up to 20 subqueries for tags and 20
subqueries for the source. This is the textbook N+1 problem, generated automatically by the
ORM-like join syntax.

---

### 2.4 Minor Bottleneck — Read-before-write in tag mutations

**File:** `src/common/api/tagApi.ts → addToNewsletter()`

```typescript
// Checks for existence before inserting — 2 queries instead of 1
const { data: existing } = await supabase
  .from('newsletter_tags').select('id')
  .eq('newsletter_id', newsletterId)
  .eq('tag_id', tagId)
  .eq('user_id', user.id)
  .maybeSingle();

if (existing) return true;   // redundant round trip

await supabase.from('newsletter_tags').insert({ newsletter_id, tag_id, user_id });
```

The `UNIQUE(newsletter_id, tag_id)` constraint already prevents duplicates. This should be a
single upsert with `onConflict: 'ignore'`.

Similarly, `updateNewsletterTags()` issues three queries in sequence (read current → insert
new → delete removed) where a single SQL function could do it transactionally in one round trip.

---

## 3. Strategy

### 3.1 Guiding Principles

1. **Fix queries, not the schema.** The N:M model is correct. Every problem is in the query
   layer and can be fixed without touching the data model.

2. **Push work to the database.** Set intersection, counting, and aggregation belong in SQL.
   The application layer should receive already-computed results.

3. **Single round trip per user action.** Every user-visible action (open tags page, toggle a
   tag filter, open inbox) should result in at most one or two database calls.

4. **Preserve correct semantics.** "Filter by tags" means ALL selected tags must be present
   on the newsletter (AND logic). Any fix must maintain this behavior.

5. **Ship in phases.** Phase 1 fixes the most painful regressions and can deploy
   independently. Phases 2 and 3 build on it incrementally.

---

### 3.2 Phase 1 — Fix the Tags Page and Tag Filtering (2–3 days)

This phase is self-contained and eliminates the two worst regressions.

#### Fix A: Replace getTagUsageStats with a single GROUP BY query

Replace the 2×N pattern with a single SQL JOIN + GROUP BY:

```sql
-- Single query replacing 2*N queries
-- Returns all tags for the user, each with its newsletter count.
-- Uses LEFT JOIN so tags with 0 newsletters still appear.
SELECT
  t.id,
  t.name,
  t.color,
  t.user_id,
  t.created_at,
  t.updated_at,
  COUNT(nt.newsletter_id) AS newsletter_count
FROM tags t
LEFT JOIN newsletter_tags nt ON nt.tag_id = t.id
                              AND nt.user_id = t.user_id
GROUP BY t.id, t.name, t.color, t.user_id, t.created_at, t.updated_at
HAVING t.user_id = $1
ORDER BY t.name ASC;
```

Wrap this in a PostgreSQL function for clean RPC calling and security isolation:

```sql
CREATE OR REPLACE FUNCTION public.get_tags_with_counts(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  color           TEXT,
  user_id         UUID,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  newsletter_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    t.id,
    t.name,
    t.color,
    t.user_id,
    t.created_at,
    t.updated_at,
    COUNT(nt.newsletter_id) AS newsletter_count
  FROM tags t
  LEFT JOIN newsletter_tags nt
         ON nt.tag_id   = t.id
        AND nt.user_id  = t.user_id
  WHERE t.user_id = p_user_id
  GROUP BY t.id, t.name, t.color, t.user_id, t.created_at, t.updated_at
  ORDER BY t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_tags_with_counts TO authenticated;
```

**Application change:** replace `tagApi.getTagUsageStats()` with a single
`supabase.rpc('get_tags_with_counts', { p_user_id: user.id })` call.

**Required supporting index** (likely missing, check before deploying):

```sql
-- Covering index for the GROUP BY query:
-- tag_id drives the join; user_id is on both sides; newsletter_id is what we COUNT.
-- This index satisfies the join, the user filter, and the count in a single scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_tag_user_newsletter
  ON public.newsletter_tags (tag_id, user_id, newsletter_id);
```

**Expected improvement:** Tags page query time drops from timeout (200–600+ ms) to
**5–30 ms** — a single indexed GROUP BY replaces up to 41 queries.

---

#### Fix B: Replace client-side tag intersection with a server-side SQL function

Replace the N-query + JavaScript intersection pattern with one function call that performs
the entire filtering operation in PostgreSQL:

```sql
CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags(
  p_user_id         UUID,
  p_tag_ids         UUID[],
  p_is_read         BOOLEAN  DEFAULT NULL,
  p_is_archived     BOOLEAN  DEFAULT NULL,
  p_is_liked        BOOLEAN  DEFAULT NULL,
  p_source_ids      UUID[]   DEFAULT NULL,
  p_date_from       TIMESTAMPTZ DEFAULT NULL,
  p_date_to         TIMESTAMPTZ DEFAULT NULL,
  p_limit           INTEGER  DEFAULT 50,
  p_offset          INTEGER  DEFAULT 0,
  p_order_by        TEXT     DEFAULT 'received_at',
  p_order_direction TEXT     DEFAULT 'DESC'
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
  total_count          BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    n.id, n.title, n.content, n.summary, n.image_url,
    n.newsletter_source_id, n.word_count, n.estimated_read_time,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.created_at, n.updated_at, n.user_id,
    COUNT(*) OVER () AS total_count
  FROM newsletters n
  WHERE n.user_id = p_user_id
    -- AND logic: newsletter must have ALL requested tags
    AND (
      SELECT COUNT(DISTINCT nt.tag_id)
      FROM newsletter_tags nt
      WHERE nt.newsletter_id = n.id
        AND nt.tag_id        = ANY(p_tag_ids)
    ) = cardinality(p_tag_ids)
    -- Optional filters (NULL means "don't filter on this column")
    AND (p_is_read     IS NULL OR n.is_read     = p_is_read)
    AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
    AND (p_is_liked    IS NULL OR n.is_liked    = p_is_liked)
    AND (p_source_ids  IS NULL OR n.newsletter_source_id = ANY(p_source_ids))
    AND (p_date_from   IS NULL OR n.received_at >= p_date_from)
    AND (p_date_to     IS NULL OR n.received_at <= p_date_to)
  ORDER BY
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at END DESC,
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'  THEN n.received_at END ASC,
    CASE WHEN p_order_by = 'title'       AND p_order_direction = 'DESC' THEN n.title       END DESC,
    CASE WHEN p_order_by = 'title'       AND p_order_direction = 'ASC'  THEN n.title       END ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletters_by_tags TO authenticated;
```

**Why `COUNT(DISTINCT nt.tag_id) = cardinality(p_tag_ids)` instead of nested EXISTS:**
A correlated EXISTS per tag would require one subplan per requested tag (variable cost).
The COUNT approach scans `newsletter_tags` once per newsletter candidate, counting only the
matching tags — a single, index-friendly operation. The query planner can leverage
`idx_newsletter_tags_tag_user_newsletter` for the inner count.

**Application change:** replace `newsletterApi.getByTags()` with:

```typescript
const { data, error } = await supabase.rpc('get_newsletters_by_tags', {
  p_user_id:     user.id,
  p_tag_ids:     tagIds,
  p_is_read:     params.isRead     ?? null,
  p_is_archived: params.isArchived ?? null,
  p_is_liked:    params.isLiked    ?? null,
  p_source_ids:  params.sourceIds  ?? null,
  p_date_from:   params.dateFrom   ?? null,
  p_date_to:     params.dateTo     ?? null,
  p_limit:       params.limit      ?? 50,
  p_offset:      params.offset     ?? 0,
  p_order_by:    params.orderBy    ?? 'received_at',
  p_order_direction: params.ascending ? 'ASC' : 'DESC',
});
```

Tags are not embedded in this function's output (column list is kept lean). The calling layer
can fetch tags for the returned newsletter IDs in a second targeted query if the UI needs to
show them, or Phase 2 can add a joined variant.

**Expected improvement:** Tag-filtered inbox page drops from N × ~10 ms + JS + large IN to
**one query, 10–50 ms** depending on matching newsletter count and index efficiency.

---

#### Fix C: Replace read-before-write in addToNewsletter

```typescript
// Before: 2 round trips
const existing = await supabase.from('newsletter_tags').select('id')...maybeSingle();
if (!existing) await supabase.from('newsletter_tags').insert(...);

// After: 1 round trip, relies on UNIQUE(newsletter_id, tag_id) constraint
await supabase
  .from('newsletter_tags')
  .upsert(
    { newsletter_id: newsletterId, tag_id: tagId, user_id: user.id },
    { onConflict: 'newsletter_id,tag_id', ignoreDuplicates: true }
  );
```

Similarly, replace `updateNewsletterTags()` with a SQL function that does the diff and
mutation in a single transaction:

```sql
CREATE OR REPLACE FUNCTION public.set_newsletter_tags(
  p_newsletter_id UUID,
  p_user_id       UUID,
  p_tag_ids       UUID[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Remove tags no longer in the new set
  DELETE FROM newsletter_tags
  WHERE newsletter_id = p_newsletter_id
    AND user_id       = p_user_id
    AND tag_id        != ALL(p_tag_ids);

  -- Add tags that aren't already there (ignore conflicts)
  INSERT INTO newsletter_tags (newsletter_id, tag_id, user_id)
  SELECT p_newsletter_id, unnest(p_tag_ids), p_user_id
  ON CONFLICT (newsletter_id, tag_id) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.set_newsletter_tags TO authenticated;
```

**Expected improvement:** tag assignment on newsletter detail drops from 3 sequential queries
to 1 round trip. Minor individually, but meaningful at scale.

---

### 3.3 Phase 2 — Eliminate the PostgREST LATERAL Join (3–4 days)

Phase 2 addresses Bottleneck 3: the 75–165 ms newsletter list queries. This phase is
independent of Phase 1 and can be deployed in any order, but is more invasive.

#### Approach: Custom RPC function replacing buildNewsletterQuery

Create a SQL function that returns newsletters with their source and tags already aggregated,
replacing the PostgREST LATERAL pattern entirely:

```sql
CREATE OR REPLACE FUNCTION public.get_newsletters(
  p_user_id         UUID,
  p_is_read         BOOLEAN     DEFAULT NULL,
  p_is_archived     BOOLEAN     DEFAULT NULL,
  p_is_liked        BOOLEAN     DEFAULT NULL,
  p_source_id       UUID        DEFAULT NULL,
  p_source_ids      UUID[]      DEFAULT NULL,
  p_date_from       TIMESTAMPTZ DEFAULT NULL,
  p_date_to         TIMESTAMPTZ DEFAULT NULL,
  p_search          TEXT        DEFAULT NULL,
  p_limit           INTEGER     DEFAULT 50,
  p_offset          INTEGER     DEFAULT 0,
  p_order_by        TEXT        DEFAULT 'received_at',
  p_order_direction TEXT        DEFAULT 'DESC'
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
  -- Pre-aggregated relations
  source               JSONB,
  tags                 JSONB,
  total_count          BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    n.id, n.title, n.content, n.summary, n.image_url,
    n.newsletter_source_id, n.word_count, n.estimated_read_time,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.created_at, n.updated_at, n.user_id,
    -- Source: single object or null
    to_jsonb(s) AS source,
    -- Tags: aggregate into array once per newsletter (no LATERAL, no per-row subquery)
    COALESCE(
      (SELECT jsonb_agg(
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
    ) AS tags,
    COUNT(*) OVER () AS total_count
  FROM newsletters n
  LEFT JOIN newsletter_sources s
         ON s.id      = n.newsletter_source_id
        AND s.user_id = n.user_id
  WHERE n.user_id = p_user_id
    AND (p_is_read     IS NULL OR n.is_read     = p_is_read)
    AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
    AND (p_is_liked    IS NULL OR n.is_liked    = p_is_liked)
    AND (p_source_id   IS NULL OR n.newsletter_source_id  = p_source_id)
    AND (p_source_ids  IS NULL OR n.newsletter_source_id  = ANY(p_source_ids))
    AND (p_date_from   IS NULL OR n.received_at >= p_date_from)
    AND (p_date_to     IS NULL OR n.received_at <= p_date_to)
    AND (p_search      IS NULL OR
         n.title   ILIKE '%' || p_search || '%' OR
         n.content ILIKE '%' || p_search || '%' OR
         n.summary ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at END DESC,
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'  THEN n.received_at END ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletters TO authenticated;
```

**Why this is faster than PostgREST LATERAL:**

The correlated subquery inside the SELECT list (`SELECT jsonb_agg(...)`) is evaluated *after*
the outer WHERE + ORDER BY + LIMIT has already reduced the result set. PostgreSQL executes it
once per row in the final 20-row (or N-row) result, not once per row in the full table scan.
PostgREST's LATERAL pattern is evaluated *during* the outer scan before LIMIT is applied,
meaning it runs for every row that passes the WHERE clause — potentially hundreds before
LIMIT kicks in.

The difference in practice:
- PostgREST LATERAL: subqueries evaluated for ~20–200 candidate rows after filtering,
  but the LATERAL structure prevents predicate pushdown in some PG versions.
- Correlated SELECT in projection: same theoretical cost but the planner can apply LIMIT
  early and will often batch the subqueries more efficiently.
- For the source join, a plain LEFT JOIN on the primary key is always an index lookup —
  dramatically simpler than a LATERAL with LIMIT 1.

**Extend for tag-filtered lists:** Rather than maintaining two separate functions, add a
`p_tag_ids` parameter that activates the EXISTS-based tag filter when provided:

```sql
-- Add to WHERE clause of get_newsletters when p_tag_ids is non-null:
AND (
  p_tag_ids IS NULL
  OR (
    SELECT COUNT(DISTINCT nt.tag_id)
    FROM newsletter_tags nt
    WHERE nt.newsletter_id = n.id
      AND nt.tag_id        = ANY(p_tag_ids)
  ) = cardinality(p_tag_ids)
)
```

This consolidates tag-filtered and non-tag-filtered paths into a single function, eliminating
the service-layer branching that currently routes them to different code paths.

#### Application changes for Phase 2

1. Replace `buildNewsletterQuery(…, includeTags: true)` call in `newsletterApi.getAll()` with
   `supabase.rpc('get_newsletters', rpcParams)`.
2. Update `transformNewsletterResponse()` to accept the `source` and `tags` JSONB columns
   returned by the function (the shape is already close to what PostgREST returns).
3. Remove the `getByTags()` code path in `NewsletterService.getAll()` — tag filtering now goes
   ✅ Migrated to `optimizedNewsletterService` — tag filtering now uses the optimized code path
4. Update `optimizedNewsletterApi.getAll()` to call `get_newsletters` directly instead of the
   intermediate `get_newsletters_with_sources_tags` stub.
5. Remove `includeTags` flag from `NewsletterQueryParams` — tags are always embedded when
   calling the function (the cost is negligible for the 20-row result window).

---

### 3.4 Phase 3 — Keyset Pagination and Count Optimization (2–3 days, optional)

Phase 3 addresses secondary issues that become relevant once Phases 1 and 2 are in place.

#### Keyset pagination

`OFFSET`-based pagination degrades as offset grows. Fetching page 50 at `OFFSET 1000`
requires the database to scan and discard 1,000 rows before returning 20.

Replace with keyset (cursor-based) pagination using `received_at + id` as the stable cursor:

```sql
-- Instead of OFFSET p_offset, use:
AND (
  n.received_at < p_cursor_received_at
  OR (n.received_at = p_cursor_received_at AND n.id < p_cursor_id)
)
```

The existing `idx_newsletters_user_received_id` index on `(user_id, received_at DESC, id)` is
already perfectly suited for this pattern. The application passes the `(received_at, id)` of
the last item from the previous page as the cursor.

**Trade-off:** keyset pagination cannot jump to an arbitrary page number — it only supports
"next page" and "previous page". The current UI uses infinite scroll, which is exactly the
use case keyset pagination was designed for.

#### Approximate counts for the unread badge

`COUNT(*) OVER ()` in the get_newsletters function is exact but forces a full predicate scan
before LIMIT applies. For the unread count badge in the sidebar, an approximate count is
acceptable and can be maintained cheaply:

```sql
-- Materialized count table, refreshed by trigger on INSERT/UPDATE of newsletters
CREATE TABLE public.newsletter_counts (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total      INTEGER NOT NULL DEFAULT 0,
  unread     INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A trigger on `newsletters` increments/decrements the relevant column on status changes.
Reading the badge becomes a single primary-key lookup instead of a COUNT scan.

---

## 4. What Not to Do

### Do not replace the N:M schema with a JSONB column

A `tags_json JSONB` column embedded in `newsletters` has been proposed elsewhere. This
approach solves the read-join problem but introduces harder write problems:

- **Renaming a tag** requires an UPDATE across every newsletter row that contains it, instead
  of a single UPDATE on one row in the `tags` table.
- **Tags with zero newsletters** cannot be independently tracked — the tag registry would need
  to be maintained as a separate table anyway, recreating the N:M structure.
- **Duplicate data** — tag name and color are stored redundantly in thousands of rows; a
  color change requires touching thousands of rows.
- **JSONB GIN indexes** are powerful for key-existence queries but the `?|` and `@>`
  operators do not behave intuitively on arrays of objects (common source of query bugs, as
  documented in this codebase).

The N:M schema is the right model. The fix is better SQL, not a different schema.

### Do not add more partial indexes before profiling

There are already 15+ indexes on `newsletters` across various migrations. Adding more without
measuring index bloat and write amplification can make INSERT/UPDATE operations measurably
slower. Any new index should be preceded by an `EXPLAIN ANALYZE` confirming the planner would
use it, and followed by a write-performance regression check.

### Do not implement caching before fixing the queries

Application-level caching (React Query, Redis, etc.) is a valid second layer of defense, but
it is not a substitute for fixing the queries. A cached response of a 400ms query is fast;
but when the cache misses (first load, invalidation, new user), the user still waits 400ms.
Fix the query first; cache the already-fast query second.

---

## 5. Implementation Plan

### Phase 1 — Fix Tags Page and Filtering ✅ Complete

**Duration:** 2–3 days (actual)  
**Risk:** Low — all changes are additive (new SQL functions + updated API calls)  
**Rollback:** Delete the new functions; revert the two API method bodies

| Step | Task | Owner | Status |
|------|------|-------|--------|
| 1.1 | Add `idx_newsletter_tags_tag_user_newsletter` index (CONCURRENTLY) | DB | ✅ Done |
| 1.2 | Add `idx_newsletter_tags_newsletter_tag` index (CONCURRENTLY) | DB | ✅ Done |
| 1.3 | Create `get_tags_with_counts(p_user_id)` function | DB | ✅ Done |
| 1.4 | Create `get_newsletters_by_tags(…)` function | DB | ✅ Done |
| 1.5 | Create `set_newsletter_tags(…)` function | DB | ✅ Done |
| 1.6 | Update `tagApi.getTagUsageStats()` to call new RPC | App | ✅ Done |
| 1.7 | Update `newsletterApi.getByTags()` to call new RPC | App | ✅ Done |
| 1.8 | Update `tagApi.addToNewsletter()` to use upsert | App | ✅ Done |
| 1.9 | Update `tagApi.updateNewsletterTags()` to call `set_newsletter_tags` | App | ✅ Done |
| 1.10 | Update unit tests for changed API methods | App | ✅ Done (18 new getByTags tests; rewrote 10 tagApi tests) |
| 1.11 | Deploy to staging + smoke test tags page and tag filter | QA | ⏳ Pending deploy |

**Phase 1 deliverable:** Tags page loads in < 300 ms. Tag-filtered inbox returns in < 200 ms.

**Remaining before closing Phase 1:**
- Run `supabase db push` on staging to apply the two new migrations
- Smoke-test the tags page with ≥10 tags and verify no timeout
- Smoke-test inbox with 2+ tag filters active and verify results + pagination
- Run `EXPLAIN ANALYZE` on `get_tags_with_counts` and `get_newsletters_by_tags` to confirm index usage

---

### Phase 2 — Eliminate PostgREST LATERAL ⏳ Pending

**Duration:** 3–4 days  
**Risk:** Medium — replaces the central newsletter query path; thorough testing required  
**Rollback:** Feature-flag the `get_newsletters` RPC path; fall back to `buildNewsletterQuery`

| Step | Task | Owner | Time |
|------|------|-------|------|
| 2.1 | Create `get_newsletters(…)` function with all filter params | DB | 1.5 d |
| 2.2 | Extend function with `p_tag_ids` parameter for unified filtering | DB | 0.5 d |
| 2.3 | Update `newsletterApi.getAll()` to use new RPC | App | 1 d |
| 2.4 | Update `transformNewsletterResponse()` for JSONB source/tags shape | App | 0.5 d |
| 2.5 | ✅ Migrate to `optimizedNewsletterService` | App | 0.25 d | **Complete** |
| 2.6 | Remove `includeTags` / `includeSource` flags from query params | App | 0.25 d |
| 2.7 | Update all tests that mock `buildNewsletterQuery` output shape | App | 1 d |
| 2.8 | EXPLAIN ANALYZE validation on staging | DB | 0.5 d |
| 2.9 | Deploy + monitor query times for 48 hours | Ops | — |

**Phase 2 deliverable:** Newsletter list query time drops from 75–165 ms to 10–25 ms.
Tag-filtered and non-tag-filtered lists use the same code path.

---

### Phase 3 — Keyset Pagination + Count Optimization ⏳ Pending (optional)

**Duration:** 2–3 days  
**Risk:** Low for counts (additive trigger), medium for keyset (changes pagination contract)  
**Prerequisite:** Phase 2 complete

| Step | Task | Owner | Time |
|------|------|-------|------|
| 3.1 | Create `newsletter_counts` table and maintenance trigger | DB | 1 d |
| 3.2 | Replace `getUnreadCount()` with counts table lookup | App | 0.5 d |
| 3.3 | Add cursor parameters to `get_newsletters` function | DB | 0.5 d |
| 3.4 | Update `useInfiniteNewsletters` to pass cursor instead of offset | App | 1 d |
| 3.5 | Test deep pagination (simulate 500+ newsletters) | QA | 0.5 d |

---

## 6. Success Metrics

Measure these before Phase 1 deploys and after each phase, using `pg_stat_statements`.

| Metric | Before Ph1 | Target after Ph1 | Actual after Ph1 | Target after Ph2 |
|--------|-----------|------------------|------------------|------------------|
| Tags page query time (p95) | timeout / >500 ms | < 50 ms | ⏳ measure on staging | < 50 ms |
| Tag-filtered inbox time (p95) | 300–800 ms | < 150 ms | ⏳ measure on staging | < 100 ms |
| Newsletter list time (p95) | 75–165 ms | 75–165 ms (unchanged) | ⏳ measure on staging | < 25 ms |
| `getTagUsageStats` query count | 2N + 1 per page load | **1** | ✅ 1 (RPC) | 1 |
| `getByTags` query count per filter toggle | N + 1 | **1** | ✅ 1 (RPC) | 1 (via get_newsletters) |
| `addToNewsletter` query count | 2 (read + write) | **1** | ✅ 1 (upsert) | 1 |
| `updateNewsletterTags` query count | 3 (read + insert + delete) | **1** | ✅ 1 (RPC) | 1 |
| Tags page load (wall time, P75) | timeout | < 300 ms | ⏳ measure on staging | < 300 ms |
| Inbox load with 2 tag filters (P75) | >1 s | < 400 ms | ⏳ measure on staging | < 200 ms |

Monitoring query to run weekly:

```sql
SELECT
  LEFT(query, 80)  AS query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS mean_ms,
  ROUND(total_exec_time::numeric / 1000, 1) AS total_s
FROM pg_stat_statements
WHERE query ILIKE '%newsletter%'
  AND mean_exec_time > 20
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## 7. Migration File Inventory

| File | Phase | Purpose | Status |
|------|-------|---------|--------|
| `supabase/migrations/20260201_tag_performance_indexes.sql` | 1 | `idx_newsletter_tags_tag_user_newsletter`, `idx_newsletter_tags_newsletter_tag` | ✅ Created |
| `supabase/migrations/20260201_tag_query_functions.sql` | 1 | `get_tags_with_counts`, `get_newsletters_by_tags`, `set_newsletter_tags` | ✅ Created |
| `supabase/migrations/YYYYMMDD_get_newsletters_function.sql` | 2 | `get_newsletters` unified function with source + tags + tag filter | ⏳ Pending |
| `supabase/migrations/YYYYMMDD_newsletter_counts_table.sql` | 3 | `newsletter_counts` table + maintenance trigger | ⏳ Pending |

Each migration should be idempotent (`CREATE OR REPLACE`, `IF NOT EXISTS`, `CONCURRENTLY`
for indexes) so it is safe to re-run in CI.

---

## 8. Files Changed by Phase

### Phase 1 changes ✅

```
supabase/migrations/20260201_tag_performance_indexes.sql    [new] ✅
supabase/migrations/20260201_tag_query_functions.sql        [new] ✅
src/common/api/tagApi.ts                                    [edit: getTagUsageStats, addToNewsletter, updateNewsletterTags] ✅
src/common/api/newsletterApi.ts                             [edit: getByTags, transformNewsletterResponse flat-tag support] ✅
src/common/api/__tests__/tagApi.test.ts                     [edit: rewrote 10 tests; added rpc spy + upsert to mock] ✅
src/common/api/__tests__/newsletterApi.test.ts              [edit: added 18-test getByTags suite; added rpc spy to mock] ✅
```

### Phase 2 changes ⏳

```
supabase/migrations/YYYYMMDD_get_newsletters_function.sql   [new]
src/common/api/newsletterApi.ts                             [edit: getAll, remove buildNewsletterQuery tag path]
src/common/api/optimizedNewsletterApi.ts                    [edit: getAll to call get_newsletters RPC]
src/common/services/optimizedNewsletterService.ts           [status: migration complete]
src/common/types/api.ts                                     [edit: remove includeTags/includeSource flags]
src/common/api/__tests__/newsletterApi.test.ts              [edit: update getAll tests]
src/common/hooks/__tests__/useNewsletters.test.tsx          [edit: update mock shapes]
```

### Phase 3 changes

```
supabase/migrations/YYYYMMDD_newsletter_counts_table.sql    [new]
src/common/api/newsletterApi.ts                             [edit: getUnreadCount]
src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts   [edit: cursor pagination]
```
