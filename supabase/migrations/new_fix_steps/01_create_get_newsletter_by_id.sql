-- 01_create_get_newsletter_by_id.sql
-- Create a SECURITY DEFINER function to fetch a single newsletter by id with
-- its source (as JSON) and tags (as JSON), scoped to the authenticated user.

CREATE OR REPLACE FUNCTION public.get_newsletter_by_id(
  p_user_id UUID,
  p_id UUID
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  content              TEXT,
  summary              TEXT,
  image_url            TEXT,
  newsletter_source_id UUID,
  word_count           INTEGER,
  estimated_read_time  INTEGER,
  is_read              BOOLEAN,
  is_liked             BOOLEAN,
  is_archived          BOOLEAN,
  received_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  user_id              UUID,
  source               JSONB,
  tags                 JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.title,
    n.content,
    n.summary,
    n.image_url,
    n.newsletter_source_id,
    n.word_count,
    n.estimated_read_time,
    n.is_read,
    n.is_liked,
    n.is_archived,
    n.received_at,
    n.created_at,
    n.updated_at,
    n.user_id,
    -- Source object (json)
    to_jsonb(s) AS source,
    -- Tags as a json array of tag objects
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', t.id,
                   'name', t.name,
                   'color', t.color,
                   'user_id', t.user_id,
                   'created_at', t.created_at
                 ) ORDER BY t.name
               )
        FROM newsletter_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE nt.newsletter_id = n.id
      ),
      '[]'::jsonb
    ) AS tags
  FROM newsletters n
  LEFT JOIN newsletter_sources s
    ON s.id = n.newsletter_source_id
   AND s.user_id = n.user_id
  WHERE n.id = p_id
    AND n.user_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletter_by_id TO authenticated;
