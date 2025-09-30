-- Add composite indexes to optimize newsletter queries
-- Based on slow-queries.md recommendations
-- Created: 2025-01-17

-- Composite index for filter + order + stable tiebreaker (keyset pagination ready)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_received_id
  ON public.newsletters (user_id, received_at DESC, id);

-- Optional: smaller, faster index for "inbox" view (non-archived newsletters)
-- This is the dominant view pattern based on usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_received_id_unarch
  ON public.newsletters (user_id, received_at DESC, id)
  WHERE is_archived = false;

-- Composite index for newsletter_tags to support efficient tag filtering
-- This allows database-level tag filtering instead of client-side
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_composite
  ON public.newsletter_tags (tag_id, newsletter_id);

-- Add comments to document the purpose
COMMENT ON INDEX public.idx_newsletters_user_received_id
  IS 'Composite index for user filtering, received_at ordering, and stable pagination';

COMMENT ON INDEX public.idx_newsletters_user_received_id_unarch
  IS 'Optimized partial index for inbox view (non-archived newsletters)';

COMMENT ON INDEX public.idx_newsletter_tags_composite
  IS 'Composite index for efficient tag-based newsletter filtering';

-- Note: Database-level tag filtering will be handled through improved client-side filtering
-- with proper indexing for performance. The composite indexes above provide the necessary
-- performance improvements for tag-based queries.
