-- Migration: Make all sources user-scoped
-- File: 20250101000000_make_all_sources_user_scoped.sql

-- Step 1: Handle existing system sources (user_id IS NULL)
-- Option A: Delete them (if no important data)
DELETE FROM public.newsletter_sources WHERE user_id IS NULL;

-- Option B: Assign them to a specific user (if you want to keep them)
-- UPDATE public.newsletter_sources 
-- SET user_id = 'your-admin-user-id-here' 
-- WHERE user_id IS NULL;

-- Step 2: Make user_id NOT NULL again
ALTER TABLE public.newsletter_sources 
  ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Recreate foreign key constraint
ALTER TABLE public.newsletter_sources 
  DROP CONSTRAINT IF EXISTS newsletter_sources_user_id_fkey;

ALTER TABLE public.newsletter_sources 
  ADD CONSTRAINT newsletter_sources_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 4: Drop system-wide unique constraints
DROP INDEX IF EXISTS idx_newsletter_sources_name_from_null_user;
DROP INDEX IF EXISTS newsletter_sources_user_id_domain_key;

-- Step 5: Create single user-scoped unique constraint
-- Match by NAME only (not email) to handle multiple emails per publisher
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sources_name_user 
  ON public.newsletter_sources (name, user_id);

-- Step 6: Update RLS policies to be user-scoped only
DROP POLICY IF EXISTS "Users can view their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can view their own newsletter sources"
  ON public.newsletter_sources
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can insert their own newsletter sources"
  ON public.newsletter_sources
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can update their own newsletter sources"
  ON public.newsletter_sources
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own newsletter sources" ON public.newsletter_sources;
CREATE POLICY "Users can delete their own newsletter sources"
  ON public.newsletter_sources
  FOR DELETE
  USING (user_id = auth.uid());


  -- Update the email processing function to be user-scoped only
CREATE OR REPLACE FUNCTION public.handle_incoming_email_transaction(
  p_user_id uuid,
  p_from_email text,
  p_from_name text,
  p_subject text,
  p_content text,
  p_excerpt text,
  p_raw_headers text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_newsletter_id uuid;
  v_result jsonb;
  v_word_count integer;
  v_estimated_read_time integer;
  v_clean_content text;
  v_source_name text;
  v_source_email text;
BEGIN
  -- Validate user_id is provided
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_id is required - all sources must be user-scoped'
    );
  END IF;
  
  -- Use the full from email as the source identifier
  v_source_email := lower(trim(p_from_email));
  v_source_name := COALESCE(NULLIF(trim(p_from_name), ''), split_part(v_source_email, '@', 1));

  -- Find existing source by NAME only (not email) for this user
  SELECT id INTO v_source_id 
  FROM public.newsletter_sources 
  WHERE name = v_source_name 
  AND user_id = p_user_id
  LIMIT 1;

  -- If no source exists, create a new one
  IF v_source_id IS NULL THEN
    INSERT INTO public.newsletter_sources (
      user_id,
      name,
      "from",
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      v_source_name,
      p_from_email,
      NOW(),
      NOW()
    )
    ON CONFLICT (name, user_id)
    DO UPDATE SET 
      "from" = EXCLUDED."from", -- Update email if it changed
      updated_at = NOW()
    RETURNING id INTO v_source_id;
  ELSE
    -- Update the email if it's different (newsletters can use multiple emails)
    UPDATE public.newsletter_sources 
    SET "from" = p_from_email, updated_at = NOW()
    WHERE id = v_source_id AND "from" != p_from_email;
  END IF;

  -- Rest of the function remains the same...
  -- [newsletter creation logic]
  
END;
$$;