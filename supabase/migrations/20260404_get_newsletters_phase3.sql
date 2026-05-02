-- Phase 3: Add cursor-based pagination support to get_newsletters function
-- This migration adds support for a cursor-based pagination (p_cursor)
-- and returns a next_cursor value to enable seamless client-side paging.
-- Built on top of the Phase 2 optimized function.

CREATE OR REPLACE FUNCTION public.get_newsletters(
  p_user_id          UUID,
  p_is_read          BOOLEAN     DEFAULT NULL,
  p_is_archived      BOOLEAN     DEFAULT NULL,
  p_is_liked         BOOLEAN     DEFAULT NULL,
  p_source_id        UUID        DEFAULT NULL,
  p_source_ids       UUID[]      DEFAULT NULL,
  p_tag_ids          UUID[]      DEFAULT NULL,
  p_date_from        TIMESTAMPTZ DEFAULT NULL,
  p_date_to          TIMESTAMPTZ DEFAULT NULL,
  p_search           TEXT        DEFAULT NULL,
  p_limit            INTEGER     DEFAULT 50,
  p_offset           INTEGER     DEFAULT 0,
  p_cursor           JSON        DEFAULT NULL,
  p_order_by         TEXT        DEFAULT 'received_at',
  p_order_direction  TEXT        DEFAULT 'DESC'
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
  tags                 JSONB,
  total_count          BIGINT,
  next_cursor          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Cursor state (Phase 3)
  v_last_id              UUID;
  v_last_received_at     TIMESTAMPTZ;
  v_cursor               JSON;
  v_has_cursor           BOOLEAN;
  v_order_by             TEXT;
  v_order_direction      TEXT;
BEGIN
  -- Initialize cursor state
  v_cursor := p_cursor;
  v_has_cursor := (p_cursor IS NOT NULL);
  v_order_by := p_order_by;
  v_order_direction := p_order_direction;

  IF v_has_cursor THEN
    -- Expect cursor to be JSON: {"last_id":"<uuid>","last_received_at":"<timestamp>"}
    v_last_id := (v_cursor ->> 'last_id')::UUID;
    v_last_received_at := (v_cursor ->> 'last_received_at')::TIMESTAMPTZ;
  END IF;

  RETURN QUERY
    WITH page AS (
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
        to_jsonb(s) AS source,
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
        ) AS tags,
        COUNT(*) OVER () AS total_count
      FROM newsletters n
      LEFT JOIN newsletter_sources s
             ON s.id = n.newsletter_source_id
            AND s.user_id = n.user_id
      WHERE n.user_id = p_user_id
        AND (p_is_read IS NULL OR n.is_read = p_is_read)
        AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
        AND (p_is_liked IS NULL OR n.is_liked = p_is_liked)
        AND (p_source_id IS NULL OR n.newsletter_source_id = p_source_id)
        AND (p_source_ids IS NULL OR n.newsletter_source_id = ANY(p_source_ids))
        AND (p_date_from IS NULL OR n.received_at >= p_date_from)
        AND (p_date_to IS NULL OR n.received_at <= p_date_to)
        AND (p_search IS NULL OR
             n.title   ILIKE '%' || p_search || '%'
             OR n.content ILIKE '%' || p_search || '%'
             OR n.summary ILIKE '%' || p_search || '%')
        AND (
          p_tag_ids IS NULL
          OR (
            SELECT COUNT(DISTINCT nt.tag_id)
            FROM newsletter_tags nt
            WHERE nt.newsletter_id = n.id
              AND nt.tag_id = ANY(p_tag_ids)
          ) = CARDINALITY(p_tag_ids)
        )
        AND (
          NOT v_has_cursor
          OR (
            v_order_by = 'received_at' AND v_order_direction = 'DESC' AND
            (
              n.received_at < v_last_received_at
              OR (n.received_at = v_last_received_at AND n.id < v_last_id)
            )
          )
        )
    ORDER BY
      CASE WHEN p_order_by = 'received_at' THEN n.received_at END DESC NULLS LAST,
      CASE WHEN p_order_by = 'created_at' THEN n.created_at  END DESC NULLS LAST,
      CASE WHEN p_order_by = 'title'        THEN n.title       END DESC NULLS LAST,
    LIMIT p_limit
    OFFSET p_offset
    ),
    last_row AS (
      -- Fetch the last row on the current page to generate next_cursor
      SELECT n.id, n.received_at
      FROM newsletters n
      LEFT JOIN newsletter_sources s
             ON s.id = n.newsletter_source_id
            AND s.user_id = n.user_id
      WHERE n.user_id = p_user_id
        AND (p_is_read IS NULL OR n.is_read = p_is_read)
        AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
        AND (p_is_liked IS NULL OR n.is_liked = p_is_liked)
        AND (p_source_id IS NULL OR n.newsletter_source_id = p_source_id)
        AND (p_source_ids IS NULL OR n.newsletter_source_id = ANY(p_source_ids))
        AND (p_date_from IS NULL OR n.received_at >= p_date_from)
        AND (p_date_to IS NULL OR n.received_at <= p_date_to)
        AND (p_search IS NULL OR
             n.title   ILIKE '%' || p_search || '%'
             OR n.content ILIKE '%' || p_search || '%'
             OR n.summary ILIKE '%' || p_search || '%')
        AND (p_tag_ids IS NULL OR (
          SELECT COUNT(DISTINCT nt.tag_id)
          FROM newsletter_tags nt
          WHERE nt.newsletter_id = n.id
            AND nt.tag_id = ANY(p_tag_ids)
        ) = CARDINALITY(p_tag_ids))
        )
        AND (
          NOT v_has_cursor
          OR (
            v_order_by = 'received_at' AND v_order_direction = 'DESC' AND
            (
              n.received_at < v_last_received_at
              OR (n.received_at = v_last_received_at AND n.id < v_last_id)
            )
          )
        )
      ORDER BY
      CASE WHEN p_order_by = 'received_at' THEN n.received_at END DESC NULLS LAST,
      CASE WHEN p_order_by = 'created_at' THEN n.created_at  END DESC NULLS LAST,
      CASE WHEN p_order_by = 'title'        THEN n.title       END DESC NULLS LAST,
    LIMIT 1 OFFSET GREATEST(p_offset + p_limit - 1, 0)
    )
    SELECT
      p.id,
      p.title,
      p.content,
      p.summary,
      p.image_url,
      p.newsletter_source_id,
      p.word_count,
      p.estimated_read_time,
      p.is_read,
      p.is_liked,
      p.is_archived,
      p.received_at,
      p.created_at,
      p.updated_at,
      p.user_id,
      p.source,
      p.tags,
      p.total_count,
      (
        SELECT json_build_object('last_id', l.id, 'last_received_at', l.received_at)::TEXT
        FROM last_row l
      ) AS next_cursor
    FROM page p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_newsletters TO authenticated;
