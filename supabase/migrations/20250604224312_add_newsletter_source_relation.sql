-- Add newsletter_source_id column if it doesn't exist
ALTER TABLE public.newsletters 
  ADD COLUMN IF NOT EXISTS newsletter_source_id UUID 
  REFERENCES public.newsletter_sources(id) 
  ON DELETE SET NULL;

-- Create a temporary function to update existing newsletters with source based on sender
CREATE OR REPLACE FUNCTION public.update_newsletter_sources()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  source_record RECORD;
  newsletter_record RECORD;
BEGIN
  -- For each unique sender in newsletters
  FOR newsletter_record IN 
    SELECT DISTINCT sender FROM public.newsletters WHERE sender IS NOT NULL AND newsletter_source_id IS NULL
  LOOP
    -- Try to find a matching source
    SELECT * INTO source_record 
    FROM public.newsletter_sources 
    WHERE LOWER(name) = LOWER(newsletter_record.sender)
    LIMIT 1;
    
    -- If no matching source exists, create one
    IF NOT FOUND THEN
      INSERT INTO public.newsletter_sources (name, domain, user_id, created_at, updated_at)
      VALUES (
        newsletter_record.sender, 
        LOWER(REPLACE(REPLACE(newsletter_record.sender, ' ', ''), '.', '') || '.com'),
        (SELECT id FROM auth.users LIMIT 1), -- Use the first user as owner
        NOW(),
        NOW()
      )
      RETURNING * INTO source_record;
    END IF;
    
    -- Update all newsletters with this sender to use the source
    UPDATE public.newsletters
    SET newsletter_source_id = source_record.id
    WHERE sender = newsletter_record.sender;
  END LOOP;
END;
$$;

-- Run the update function
SELECT public.update_newsletter_sources();

-- Drop the temporary function
DROP FUNCTION IF EXISTS public.update_newsletter_sources();

-- Create a view for backward compatibility
CREATE OR REPLACE VIEW public.newsletter_with_sources AS
SELECT 
  n.id,
  n.title,
  n.content,
  n.summary,
  n.image_url,
  n.is_read,
  n.is_liked,
  n.user_id,
  n.newsletter_source_id,
  n.created_at,
  n.updated_at,
  n.sender, -- Keep the original sender column
  ns.name as source_name,
  ns.domain as source_domain
FROM 
  public.newsletters n
LEFT JOIN 
  public.newsletter_sources ns ON n.newsletter_source_id = ns.id;

-- Create a trigger function to update the sender when newsletter_source_id changes
CREATE OR REPLACE FUNCTION public.update_sender_from_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.newsletter_source_id IS NOT NULL THEN
      NEW.sender := (SELECT name FROM public.newsletter_sources WHERE id = NEW.newsletter_source_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS update_sender_trigger ON public.newsletters;
CREATE TRIGGER update_sender_trigger
BEFORE INSERT OR UPDATE OF newsletter_source_id ON public.newsletters
FOR EACH ROW
EXECUTE FUNCTION public.update_sender_from_source();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.newsletters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.newsletter_sources TO authenticated;
GRANT SELECT ON TABLE public.newsletter_with_sources TO authenticated;
