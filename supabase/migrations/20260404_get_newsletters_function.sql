-- Phase 2: Create a unified get_newsletters function to replace PostgREST LATERAL joins.
-- This function aggregates source and tags server-side, providing a significant performance boost.

CREATE OR REPLACE FUNCTION public.get_newsletters(
  p_user_id         UUID,
  p_is_read         BOOLEAN     DEFAULT NULL,
  p_is_archived     BOOLEAN     DEFAULT NULL,
  p_is_liked        BOOLEAN     DEFAULT NULL,
  p_source_id       UUID        DEFAULT NULL,
  p_source_ids      UUID[]      DEFAULT NULL,
  p_tag_ids         UUID[]      DEFAULT NULL,
  p_date_from       TIMESTAMPTZ DEFAULT NULL,
  p_date_to         TIMESTAMPTZ DEFAULT NULL,
  p_search          TEXT        DEFAULT NULL,
  p_limit           INTEGER     DEFAULT 50,
  p_offset          INTEGER     DEFAULT 0,
  p_order_by        TEXT        DEFAULT 'received_at',
  p_order_direction TEXT        DEFAULT 'DESC'
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
  -- Pre-aggregated relations
  source               JSONB,
  tags                 JSONB,
  total_count          BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id, n.title, n.content, n.summary, n.image_url,
    n.newsletter_source_id, n.word_count, n.estimated_read_time,
    n.is_read, n.is_liked, n.is_archived,
    n.received_at, n.created_at, n.updated_at, n.user_id,
    -- Source: single object or null
    to_jsonb(s) AS source,
    -- Tags: aggregate into array once per newsletter
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'id',         t.id,
                  'name',       t.name,
                  'color',      t.color,
                  'user_id',    t.user_id,
                  'created_at', t.created_at
                ) ORDER BY t.name
              )
       FROM newsletter_tags nt
       JOIN tags t ON t.id = nt.tag_id
       WHERE nt.newsletter_id = n.id
      ),
      '[]'::jsonb
    ) AS tags,
    COUNT(*) OVER () AS total_count
  FROM newsletters n
  LEFT JOIN newsletter_sources s
         ON s.id      = n.newsletter_source_id
        AND s.user_id = n.user_id
  WHERE n.user_id = p_user_id
    AND (p_is_read     IS NULL OR n.is_read     = p_is_read)
    AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
    AND (p_is_liked    IS NULL OR n.is_liked    = p_is_liked)
    AND (p_source_id   IS NULL OR n.newsletter_source_id = p_source_id)
    AND (p_source_ids  IS NULL OR n.newsletter_source_id = ANY(p_source_ids))
    AND (p_date_from   IS NULL OR n.received_at >= p_date_from)
    AND (p_date_to     IS NULL OR n.received_at <= p_date_to)
    AND (p_search      IS NULL OR
         n.title   ILIKE '%' || p_search || '%' OR
         n.content ILIKE '%' || p_search || '%' OR
         n.summary ILIKE '%' || p_search || '%')
    -- Tag filtering: AND logic (newsletter must have ALL specified tags)
    AND (
      p_tag_ids IS NULL
      OR (
        SELECT COUNT(DISTINCT nt.tag_id)
        FROM newsletter_tags nt
        WHERE nt.newsletter_id = n.id
          AND nt.tag_id        = ANY(p_tag_ids)
      ) = cardinality(p_tag_ids)
    )
  ORDER BY
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at END DESC NULLS LAST,
    CASE WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'  THEN n.received_at END ASC NULLS LAST,
    CASE WHEN p_order_by = 'created_at'  AND p_order_direction = 'DESC' THEN n.created_at  END DESC NULLS LAST,
    CASE WHEN p_order_by = 'created_at'  AND p_order_direction = 'ASC'  THEN n.created_at  END ASC NULLS LAST,
    CASE WHEN p_order_by = 'title'       AND p_order_direction = 'DESC' THEN n.title       END DESC NULLS LAST,
    CASE WHEN p_order_by = 'title'       AND p_order_direction = 'ASC'  THEN n.title       END ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletters TO authenticated;
