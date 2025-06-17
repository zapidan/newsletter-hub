-- First, drop the existing foreign key constraint
ALTER TABLE public.newsletter_sources 
  DROP CONSTRAINT IF EXISTS newsletter_sources_user_id_fkey;

-- Make user_id nullable
ALTER TABLE public.newsletter_sources 
  ALTER COLUMN user_id DROP NOT NULL;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE public.newsletter_sources 
  ADD CONSTRAINT newsletter_sources_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- Drop the old unique constraint
ALTER TABLE public.newsletter_sources 
  DROP CONSTRAINT IF EXISTS newsletter_sources_user_id_domain_key;

-- Create a new unique constraint that allows NULL user_ids
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sources_user_id_domain_key 
  ON public.newsletter_sources (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), domain);

-- Update the RLS policies to allow system operations
DROP POLICY IF EXISTS "Users can view their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can view their own newsletter sources"
  ON public.newsletter_sources
  FOR SELECT
  USING (auth.role() = 'service_role' OR user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can insert their own newsletter sources"
  ON public.newsletter_sources
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can update their own newsletter sources"
  ON public.newsletter_sources
  FOR UPDATE
  USING (auth.role() = 'service_role' OR user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can delete their own newsletter sources"
  ON public.newsletter_sources
  FOR DELETE
  USING (auth.role() = 'service_role' OR user_id = auth.uid() OR user_id IS NULL);
