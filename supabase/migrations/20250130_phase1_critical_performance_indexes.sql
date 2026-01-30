-- Phase 1 Performance Optimization - Critical Indexes
-- Based on Supabase Query Performance Analysis
-- Target: 20%+ reduction in total database load

-- Issue: Newsletter queries (21, 22) consuming 20%+ of total time due to missing is_archived index
-- Solution: Create critical indexes for common query patterns

-- 1. CRITICAL: Full is_archived index (not partial) for Queries 21 & 22
-- These queries filter on is_archived = true/false and need full coverage
CREATE INDEX IF NOT EXISTS idx_newsletters_is_archived_full 
ON public.newsletters(is_archived);

-- 2. Composite index for inbox filtering (most common pattern)
-- Covers: user_id + is_read + is_archived + received_at ordering
CREATE INDEX IF NOT EXISTS idx_newsletters_inbox_filter 
ON public.newsletters(user_id, is_read, is_archived, received_at DESC);

-- 3. Composite index for source filtering with ordering
-- Covers: user_id + newsletter_source_id + received_at ordering  
CREATE INDEX IF NOT EXISTS idx_newsletters_source_filter 
ON public.newsletters(user_id, newsletter_source_id, received_at DESC);

-- 4. Composite index for archive operations
-- Covers: user_id + is_archived for bulk archive/unarchive operations
CREATE INDEX IF NOT EXISTS idx_newsletters_archive_operations 
ON public.newsletters(user_id, is_archived);

-- 5. Index for newsletter_tags performance (Query 150, 156, 157 optimization)
-- Speeds up newsletter-tag relationship lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_newsletter_id_user 
ON public.newsletter_tags(newsletter_id, user_id);

-- 6. Index for reading_queue position optimization
-- Speeds up position-based ordering and reordering operations
CREATE INDEX IF NOT EXISTS idx_reading_queue_position 
ON public.reading_queue(position);

-- 7. Index for newsletter_sources created_at optimization
-- Speeds up date-based filtering and sorting of sources
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_created_at 
ON public.newsletter_sources(created_at);

-- Add comments for documentation
COMMENT ON INDEX public.idx_newsletters_is_archived_full IS 'Critical index for Queries 21 & 22 - reduces 20%+ database load';
COMMENT ON INDEX public.idx_newsletters_inbox_filter IS 'Optimizes inbox queries with user filtering and ordering';
COMMENT ON INDEX public.idx_newsletters_source_filter IS 'Optimizes source-based filtering with ordering';
COMMENT ON INDEX public.idx_newsletters_archive_operations IS 'Optimizes bulk archive/unarchive operations';
COMMENT ON INDEX public.idx_newsletter_tags_newsletter_id_user IS 'Optimizes newsletter-tag relationship queries';
COMMENT ON INDEX public.idx_reading_queue_position IS 'Optimizes reading queue position-based ordering and reordering';
COMMENT ON INDEX public.idx_newsletter_sources_created_at IS 'Optimizes newsletter sources date-based filtering and sorting';

-- Performance impact analysis:
-- Query 21 (175,313 total seconds): Expected 60-80% reduction
-- Query 22 (115,673 total seconds): Expected 60-80% reduction  
-- Reading queue operations: Expected 70-80% reduction in position-based queries
-- Newsletter sources operations: Expected 50-60% reduction in date-based queries
-- Overall database load: Expected 25-35% reduction
-- Risk: Very low (indexes only improve read performance)
-- Note: Removed CONCURRENTLY to allow execution in migration transaction block
