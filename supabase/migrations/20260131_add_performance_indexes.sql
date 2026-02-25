-- Add Performance Indexes for Slow Queries
-- This migration adds targeted indexes based on the slow query analysis

-- Newsletter indexes for the most common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_read_archived_received 
ON public.newsletters(user_id, is_read, is_archived, received_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_source_received 
ON public.newsletters(user_id, newsletter_source_id, received_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_read_archived_source_received 
ON public.newsletters(user_id, is_read, is_archived, newsletter_source_id, received_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_received_date_range 
ON public.newsletters(user_id, received_at DESC) 
WHERE received_at >= (CURRENT_DATE - INTERVAL '30 days');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_source_ids 
ON public.newsletters(user_id, newsletter_source_id) 
WHERE newsletter_source_id IS NOT NULL;

-- Newsletter source indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_sources_user_name 
ON public.newsletter_sources(user_id, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_sources_user_archived 
ON public.newsletter_sources(user_id, is_archived);

-- Newsletter tags indexes for tag filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_newsletter_id 
ON public.newsletter_tags(newsletter_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_tag_id 
ON public.newsletter_tags(tag_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_tags_newsletter_tag 
ON public.newsletter_tags(newsletter_id, tag_id);

-- Tags indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_user_name 
ON public.tags(user_id, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_user_color 
ON public.tags(user_id, color);

-- Reading queue indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_queue_user_position 
ON public.reading_queue(user_id, position ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_queue_user_priority 
ON public.reading_queue(user_id, priority DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_queue_newsletter_id 
ON public.reading_queue(newsletter_id);

-- Partial indexes for common filter states
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_unread 
ON public.newsletters(user_id, received_at DESC) 
WHERE is_read = false AND is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_archived 
ON public.newsletters(user_id, received_at DESC) 
WHERE is_archived = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_read 
ON public.newsletters(user_id, received_at DESC) 
WHERE is_read = true AND is_archived = false;

-- Newsletter source partial indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_sources_active 
ON public.newsletter_sources(user_id, name) 
WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_sources_archived 
ON public.newsletter_sources(user_id, name) 
WHERE is_archived = true;

-- Composite indexes for search queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_user_search 
ON public.newsletters(user_id, is_archived) 
WHERE (title IS NOT NULL OR content IS NOT NULL OR summary IS NOT NULL);

-- Function-based indexes for date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_received_date 
ON public.newsletters(DATE(received_at));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletters_created_date 
ON public.newsletters(DATE(created_at));

-- Update table statistics for better query planning
ANALYZE public.newsletters;
ANALYZE public.newsletter_sources;
ANALYZE public.newsletter_tags;
ANALYZE public.tags;
ANALYZE public.reading_queue;

-- Create a function to update statistics periodically
CREATE OR REPLACE FUNCTION public.update_table_statistics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    ANALYZE public.newsletters;
    ANALYZE public.newsletter_sources;
    ANALYZE public.newsletter_tags;
    ANALYZE public.tags;
    ANALYZE public.reading_queue;
    ANALYZE public.users;
    
    -- Log the update
    RAISE NOTICE 'Table statistics updated at %', NOW();
END;
$$;

-- Grant permission to run statistics update
GRANT EXECUTE ON FUNCTION public.update_table_statistics TO authenticated, service_role;

-- Comments for documentation
COMMENT ON INDEX idx_newsletters_user_read_archived_received IS 'Primary index for inbox queries with read/archived filters';
COMMENT ON INDEX idx_newsletters_user_source_received IS 'Index for source-filtered queries';
COMMENT ON INDEX idx_newsletters_unread IS 'Partial index for unread newsletters (most common query)';
COMMENT ON FUNCTION public.update_table_statistics IS 'Function to update table statistics for optimal query planning';
