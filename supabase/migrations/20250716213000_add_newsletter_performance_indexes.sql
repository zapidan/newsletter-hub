-- Add indexes to optimize newsletter queries with tags and sources

-- Index for filtering newsletters by user_id and ordering by received_at
CREATE INDEX IF NOT EXISTS idx_newsletters_user_received 
ON public.newsletters(user_id, received_at DESC);

-- Index for newsletter_tags lookups by newsletter_id
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_newsletter_id 
ON public.newsletter_tags(newsletter_id);

-- Index for newsletter_tags lookups by tag_id
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_tag_id 
ON public.newsletter_tags(tag_id);

-- Index for newsletter_sources lookups by id
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_id 
ON public.newsletter_sources(id);

-- Index for tags lookups by id
CREATE INDEX IF NOT EXISTS idx_tags_id 
ON public.tags(id);

-- Composite index for newsletter_sources lookups by id and user_id (if needed for RLS)
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_id_user 
ON public.newsletter_sources(id, user_id);

-- Composite index for tags lookups by id and user_id (if needed for RLS)
CREATE INDEX IF NOT EXISTS idx_tags_id_user 
ON public.tags(id, user_id);
