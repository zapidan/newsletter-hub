-- Add is_archived column to newsletter_sources table
ALTER TABLE public.newsletter_sources 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for better performance when querying non-archived sources
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_user_id_is_archived 
ON public.newsletter_sources(user_id, is_archived);

-- Update the existing RLS policy to include is_archived check
DROP POLICY IF EXISTS "Users can view their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can view their own newsletter sources"
  ON public.newsletter_sources
  FOR SELECT
  USING (auth.uid() = user_id);

-- Add a comment to document the new column
COMMENT ON COLUMN public.newsletter_sources.is_archived IS 'Indicates if the source has been archived (soft deleted)';

-- Update the function that updates the updated_at column to work with the new column
CREATE OR REPLACE FUNCTION public.update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;
