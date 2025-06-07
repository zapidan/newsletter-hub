-- Drop the trigger first
DROP TRIGGER IF EXISTS update_sender_trigger ON public.newsletters;

-- Then drop the function
DROP FUNCTION IF EXISTS public.update_sender_from_source();

-- Note: We're keeping the newsletter_with_sources view as it might be in use
-- and doesn't depend on the trigger function
