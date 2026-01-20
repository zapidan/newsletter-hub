-- Add color column to newsletter_source_groups table
ALTER TABLE public.newsletter_source_groups 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- Add user_id to newsletter_source_group_members for ownership tracking
ALTER TABLE public.newsletter_source_group_members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Function to set user_id from group on insert
CREATE OR REPLACE FUNCTION public.set_newsletter_source_group_member_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT g.user_id INTO NEW.user_id
  FROM public.newsletter_source_groups g
  WHERE g.id = NEW.group_id;
  RETURN NEW;
END;
$$;

-- Trigger to set user_id on insert
CREATE TRIGGER IF NOT EXISTS set_newsletter_source_group_member_user_id_trigger
BEFORE INSERT ON public.newsletter_source_group_members
FOR EACH ROW
EXECUTE FUNCTION public.set_newsletter_source_group_member_user_id();

-- Function to enforce max 10 groups per source
CREATE OR REPLACE FUNCTION public.check_newsletter_source_group_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  member_count INTEGER;
  source_owner_id UUID;
BEGIN
  -- Get the owner of the source
  SELECT user_id INTO source_owner_id
  FROM public.newsletter_sources
  WHERE id = NEW.source_id;
  
  IF NOT FOUND OR source_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Source not found or access denied';
  END IF;

  -- Count current groups for this source
  SELECT COUNT(*) INTO member_count
  FROM public.newsletter_source_group_members
  WHERE source_id = NEW.source_id;

  -- Enforce the limit
  IF member_count >= 10 THEN
    RAISE EXCEPTION 'A source cannot belong to more than 10 groups'
      USING ERRCODE = 'check_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for the group limit
CREATE TRIGGER IF NOT EXISTS check_newsletter_source_group_limit_trigger
BEFORE INSERT ON public.newsletter_source_group_members
FOR EACH ROW
EXECUTE FUNCTION public.check_newsletter_source_group_limit();

-- Update RLS policy to include source ownership check
DROP POLICY IF EXISTS "Users can add members to their groups" ON public.newsletter_source_group_members;
CREATE POLICY "Users can add members to their groups"
  ON public.newsletter_source_group_members
  FOR INSERT
  WITH CHECK (
    -- User must own the group
    EXISTS (
      SELECT 1 FROM public.newsletter_source_groups g 
      WHERE g.id = group_id AND g.user_id = auth.uid()
    )
    -- AND must own the source
    AND EXISTS (
      SELECT 1 FROM public.newsletter_sources s
      WHERE s.id = source_id AND s.user_id = auth.uid()
    )
  );

-- Update any existing records with NULL user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.newsletter_source_group_members WHERE user_id IS NULL) THEN
    UPDATE public.newsletter_source_group_members m
    SET user_id = g.user_id
    FROM public.newsletter_source_groups g
    WHERE m.group_id = g.id AND m.user_id IS NULL;
  END IF;
END $$;

-- Add NOT NULL constraint to user_id
ALTER TABLE public.newsletter_source_group_members 
ALTER COLUMN user_id SET NOT NULL;