-- Add the 'from' column to store just the email address
ALTER TABLE public.newsletter_sources 
  ADD COLUMN IF NOT EXISTS "from" TEXT;

-- For any NULL values, use a default
UPDATE public.newsletter_sources 
SET "from" = 'unknown@example.com'
WHERE "from" IS NULL;

-- Make the from column NOT NULL after backfilling
ALTER TABLE public.newsletter_sources 
  ALTER COLUMN "from" SET NOT NULL;

-- Drop the old partial indexes if they exist
DROP INDEX IF EXISTS public.idx_newsletter_sources_name_domain_user_id;
DROP INDEX IF EXISTS public.idx_newsletter_sources_name_domain_null_user;

-- Create new partial indexes using the 'from' column
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sources_name_from_user 
  ON public.newsletter_sources (name, "from", user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sources_name_from_null_user
  ON public.newsletter_sources (name, "from")
  WHERE user_id IS NULL;

-- Add comments to document the new indexes
COMMENT ON INDEX public.idx_newsletter_sources_name_from_user
  IS 'Ensures unique combination of name, from, and user_id for non-null user_ids';

COMMENT ON INDEX public.idx_newsletter_sources_name_from_null_user
  IS 'Ensures unique combination of name and from for null user_ids (system sources)';

-- Drop the domain column if it exists
ALTER TABLE public.newsletter_sources 
  DROP COLUMN IF EXISTS domain;
