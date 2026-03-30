-- =============================================================================
-- Migration: 20260201_tag_performance_indexes.sql
-- Description: Add covering indexes on newsletter_tags to fix tag query
--              performance bottlenecks identified in get_tags_with_counts and
--              get_newsletters_by_tags. Both indexes are created CONCURRENTLY
--              so they do not acquire a full table lock in production, and are
--              guarded with IF NOT EXISTS for idempotency.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Index 1: idx_newsletter_tags_tag_user_newsletter
--
-- Purpose: Covering index for the get_tags_with_counts GROUP BY query.
--   • tag_id  — drives the LEFT JOIN from tags → newsletter_tags
--   • user_id — satisfies the per-user equality filter pushed into the join
--   • newsletter_id — the column being COUNT()ed, included so Postgres can
--                     satisfy the entire query from the index without a heap
--                     fetch (index-only scan).
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_tag_user_newsletter
    ON public.newsletter_tags (tag_id, user_id, newsletter_id);

COMMENT ON INDEX public.idx_newsletter_tags_tag_user_newsletter IS
    'Covering index for get_tags_with_counts: tag_id drives the join from '
    'tags, user_id satisfies the per-user filter, and newsletter_id is the '
    'COUNT target — together they enable an index-only scan with no heap fetch.';

-- -----------------------------------------------------------------------------
-- Index 2: idx_newsletter_tags_newsletter_tag
--
-- Purpose: Accelerates the correlated COUNT subquery inside
--          get_newsletters_by_tags that checks whether a newsletter has ALL
--          of the requested tags.
--   • newsletter_id — the outer-query correlation key (= n.id)
--   • tag_id        — the ANY(p_tag_ids) membership filter and the column
--                     used in COUNT(DISTINCT …)
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_newsletter_tag
    ON public.newsletter_tags (newsletter_id, tag_id);

COMMENT ON INDEX public.idx_newsletter_tags_newsletter_tag IS
    'Supports the correlated COUNT(DISTINCT tag_id) subquery in '
    'get_newsletters_by_tags: newsletter_id is the join key to the outer '
    'newsletters row and tag_id is the ANY(p_tag_ids) filter column.';

-- -----------------------------------------------------------------------------
-- Refresh planner statistics so the new indexes are considered immediately.
-- -----------------------------------------------------------------------------
ANALYZE public.newsletter_tags;
