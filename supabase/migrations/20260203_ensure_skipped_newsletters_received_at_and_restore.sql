-- Ensure skipped_newsletters always have a received_at date
-- and add a helper to restore them back into newsletters.

-- 1) Backfill any existing NULL received_at values so they can be restored safely
DO $$
BEGIN
  UPDATE public.skipped_newsletters
  SET received_at = COALESCE(received_at, created_at, now())
  WHERE received_at IS NULL;
END $$;

-- 2) Enforce NOT NULL on received_at going forward
ALTER TABLE public.skipped_newsletters
  ALTER COLUMN received_at SET NOT NULL;

-- 3) Helper function to restore a skipped newsletter back into newsletters
--    preserving its original received_at date.
CREATE OR REPLACE FUNCTION public.restore_skipped_newsletter(
  p_skipped_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Insert back into newsletters, preserving key fields and received_at
  INSERT INTO public.newsletters (
    user_id,
    title,
    content,
    summary,
    newsletter_source_id,
    word_count,
    estimated_read_time,
    is_read,
    is_archived,
    is_liked,
    received_at,
    created_at,
    updated_at
  )
  SELECT
    user_id,
    title,
    content,
    summary,
    newsletter_source_id,
    word_count,
    estimated_read_time,
    is_read,
    is_archived,
    is_liked,
    -- Make sure we always have a concrete date when restoring
    COALESCE(received_at, created_at, now()) AS received_at,
    COALESCE(created_at, now())              AS created_at,
    now()                                    AS updated_at
  FROM public.skipped_newsletters
  WHERE id = p_skipped_id
    AND user_id = auth.uid();

  -- Delete from skipped once it has been restored
  DELETE FROM public.skipped_newsletters
  WHERE id = p_skipped_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow application roles to call the restore helper
GRANT EXECUTE ON FUNCTION public.restore_skipped_newsletter(UUID) TO authenticated, service_role;

