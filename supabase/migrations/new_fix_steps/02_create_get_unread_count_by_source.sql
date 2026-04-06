-- 02_create_get_unread_count_by_source.sql
-- Create a SECURITY DEFINER function to compute unread, non-archived newsletters
-- grouped by their source for a given user.

CREATE OR REPLACE FUNCTION public.get_unread_count_by_source(
  p_user_id UUID
)
RETURNS TABLE (newsletter_source_id UUID, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.newsletter_source_id, COUNT(*) AS count
  FROM newsletters n
  WHERE n.user_id = p_user_id
    AND n.is_read = FALSE
    AND n.is_archived = FALSE
    AND n.newsletter_source_id IS NOT NULL
  GROUP BY n.newsletter_source_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_count_by_source TO authenticated;
