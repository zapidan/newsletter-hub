-- Add a unique constraint on (name, domain, user_id) to the newsletter_sources table
-- This ensures we can't have duplicate sources with the same name and domain for the same user

-- First, drop the existing unique constraint if it exists
ALTER TABLE public.newsletter_sources 
  DROP CONSTRAINT IF EXISTS newsletter_sources_user_id_domain_key;

-- Drop the existing index if it exists
DROP INDEX IF EXISTS public.newsletter_sources_user_id_domain_key;

-- Create a partial unique index for non-null user_ids
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sources_name_domain_user_id 
  ON public.newsletter_sources (name, domain, user_id)
  WHERE user_id IS NOT NULL;

-- Create a partial unique index for null user_ids
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sources_name_domain_null_user 
  ON public.newsletter_sources (name, domain)
  WHERE user_id IS NULL;

-- Add a comment to document the constraints
COMMENT ON INDEX public.idx_newsletter_sources_name_domain_user_id 
  IS 'Ensures unique combination of name, domain, and user_id for non-null user_ids';

COMMENT ON INDEX public.idx_newsletter_sources_name_domain_null_user
  IS 'Ensures unique combination of name and domain for null user_ids (system sources)';
