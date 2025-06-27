-- Add performance-optimizing indexes for newsletters and newsletter_sources tables
-- Created: 2025-06-26

-- Indexes for newsletters table

-- Speeds up filtering newsletters by user (used in most queries for data isolation)
CREATE INDEX IF NOT EXISTS idx_newsletters_user_id ON public.newsletters(user_id);

-- Speeds up filtering newsletters by source
CREATE INDEX IF NOT EXISTS idx_newsletters_source_id ON public.newsletters(newsletter_source_id);

-- Partial index for unread newsletters (smaller and faster than full index)
CREATE INDEX IF NOT EXISTS idx_newsletters_is_read ON public.newsletters(is_read) 
WHERE is_read = false;

-- Partial index for non-archived newsletters (smaller and faster than full index)
CREATE INDEX IF NOT EXISTS idx_newsletters_is_archived ON public.newsletters(is_archived) 
WHERE is_archived = false;

-- Partial index for liked newsletters (smaller and faster than full index)
CREATE INDEX IF NOT EXISTS idx_newsletters_is_liked ON public.newsletters(is_liked) 
WHERE is_liked = true;

-- Index for sorting by received date (DESC is the most common sort order)
CREATE INDEX IF NOT EXISTS idx_newsletters_received_at ON public.newsletters(received_at DESC);

-- Index for newsletter_sources table

-- Speeds up filtering sources by user
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_user_id ON public.newsletter_sources(user_id);

-- Add a comment to document the purpose of these indexes
-- Note: IF NOT EXISTS is not supported in COMMENT ON INDEX in PostgreSQL
COMMENT ON INDEX public.idx_newsletters_user_id IS 'Speeds up filtering newsletters by user';
COMMENT ON INDEX public.idx_newsletters_source_id IS 'Speeds up filtering newsletters by source';
COMMENT ON INDEX public.idx_newsletters_is_read IS 'Speeds up finding unread newsletters';
COMMENT ON INDEX public.idx_newsletters_is_archived IS 'Speeds up finding non-archived newsletters';
COMMENT ON INDEX public.idx_newsletters_is_liked IS 'Speeds up finding liked newsletters';
COMMENT ON INDEX public.idx_newsletters_received_at IS 'Speeds up sorting newsletters by received date';
COMMENT ON INDEX public.idx_newsletter_sources_user_id IS 'Speeds up filtering sources by user';
