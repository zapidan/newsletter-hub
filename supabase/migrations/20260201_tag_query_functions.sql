-- =============================================================================
-- Migration: 20260201_tag_query_functions.sql
-- Purpose:   Create optimised SQL functions for tag-related queries in the
--            newsletter hub.  These functions replace ad-hoc query patterns
--            that were causing N+1 / 2×N round-trips from the application
--            layer and consolidate all tag logic into single, stable,
--            security-definer RPCs that authenticated users can call via the
--            Supabase client.
--
-- Functions created:
--   1. public.get_tags_with_counts(p_user_id)
--        Single LEFT JOIN + GROUP BY replacing the previous 2×N fetch pattern.
--
--   2. public.get_newsletters_by_tags(...)
--        Filtered, paginated newsletter list with per-row tag aggregation and
--        window-function total_count; requires ALL supplied tags to match.
--
--   3. public.set_newsletter_tags(p_newsletter_id, p_user_id, p_tag_ids)
--        Idempotent upsert/delete to atomically reconcile a newsletter's tags.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. get_tags_with_counts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tags_with_counts(
    p_user_id UUID
)
RETURNS TABLE (
    id               UUID,
    name             TEXT,
    color            TEXT,
    user_id          UUID,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ,
    newsletter_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        t.id,
        t.name,
        t.color,
        t.user_id,
        t.created_at,
        t.updated_at,
        COUNT(nt.newsletter_id) AS newsletter_count
    FROM public.tags t
    LEFT JOIN public.newsletter_tags nt
           ON nt.tag_id  = t.id
          AND nt.user_id = t.user_id
    WHERE t.user_id = p_user_id
    GROUP BY
        t.id,
        t.name,
        t.color,
        t.user_id,
        t.created_at,
        t.updated_at
    ORDER BY t.name ASC;
$$;

COMMENT ON FUNCTION public.get_tags_with_counts(UUID) IS
    'Returns every tag owned by p_user_id together with the number of '
    'newsletters that carry each tag.  Uses a single LEFT JOIN + GROUP BY '
    'instead of a separate COUNT query per tag (replaces the old 2×N pattern). '
    'Hits idx_newsletter_tags_tag_user_newsletter for a covering index scan.';

GRANT EXECUTE ON FUNCTION public.get_tags_with_counts(UUID)
    TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. get_newsletters_by_tags
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags(
    p_user_id         UUID,
    p_tag_ids         UUID[],
    p_is_read         BOOLEAN     DEFAULT NULL,
    p_is_archived     BOOLEAN     DEFAULT NULL,
    p_is_liked        BOOLEAN     DEFAULT NULL,
    p_source_ids      UUID[]      DEFAULT NULL,
    p_date_from       TIMESTAMPTZ DEFAULT NULL,
    p_date_to         TIMESTAMPTZ DEFAULT NULL,
    p_limit           INTEGER     DEFAULT 50,
    p_offset          INTEGER     DEFAULT 0,
    p_order_by        TEXT        DEFAULT 'received_at',
    p_order_direction TEXT        DEFAULT 'DESC'
)
RETURNS TABLE (
    -- core newsletter columns
    id            UUID,
    user_id       UUID,
    source_id     UUID,
    title         TEXT,
    content       TEXT,
    summary       TEXT,
    received_at   TIMESTAMPTZ,
    is_read       BOOLEAN,
    is_archived   BOOLEAN,
    is_liked      BOOLEAN,
    created_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ,
    -- enriched columns
    source        JSONB,
    tags          JSONB,
    total_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        -- newsletter columns
        n.id,
        n.user_id,
        n.newsletter_source_id,
        n.title,
        n.content,
        n.summary,
        n.received_at,
        n.is_read,
        n.is_archived,
        n.is_liked,
        n.created_at,
        n.updated_at,
        -- source object (NULL-safe: LEFT JOIN means s may be null)
        to_jsonb(s)                                         AS source,
        -- aggregated tags for this newsletter
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id',         t.id,
                        'name',       t.name,
                        'color',      t.color,
                        'user_id',    t.user_id,
                        'created_at', t.created_at
                    )
                    ORDER BY t.name
                ),
                '[]'::jsonb
            )
            FROM public.newsletter_tags nt2
            JOIN public.tags            t  ON t.id = nt2.tag_id
            WHERE nt2.newsletter_id = n.id
        )                                                   AS tags,
        -- total rows that match the WHERE clause (before LIMIT/OFFSET)
        COUNT(*) OVER ()                                    AS total_count

    FROM public.newsletters n
    LEFT JOIN public.newsletter_sources s ON s.id = n.newsletter_source_id

    WHERE
        -- ownership
        n.user_id = p_user_id

        -- ALL-tags requirement: every tag in p_tag_ids must be present
        AND (
            SELECT COUNT(DISTINCT nt.tag_id)
            FROM public.newsletter_tags nt
            WHERE nt.newsletter_id = n.id
              AND nt.tag_id        = ANY(p_tag_ids)
        ) = cardinality(p_tag_ids)

        -- optional boolean filters (NULL means "don't filter")
        AND (p_is_read     IS NULL OR n.is_read     = p_is_read)
        AND (p_is_archived IS NULL OR n.is_archived = p_is_archived)
        AND (p_is_liked    IS NULL OR n.is_liked    = p_is_liked)

        -- optional source filter
        AND (p_source_ids IS NULL OR n.newsletter_source_id = ANY(p_source_ids))

        -- optional date-range filter
        AND (p_date_from IS NULL OR n.received_at >= p_date_from)
        AND (p_date_to   IS NULL OR n.received_at <= p_date_to)

    ORDER BY
        -- received_at
        CASE
            WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC'
            THEN n.received_at
        END DESC NULLS LAST,
        CASE
            WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC'
            THEN n.received_at
        END ASC  NULLS LAST,
        -- title
        CASE
            WHEN p_order_by = 'title' AND p_order_direction = 'DESC'
            THEN n.title
        END DESC NULLS LAST,
        CASE
            WHEN p_order_by = 'title' AND p_order_direction = 'ASC'
            THEN n.title
        END ASC  NULLS LAST

    LIMIT  p_limit
    OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.get_newsletters_by_tags(
    UUID, UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
    UUID[], TIMESTAMPTZ, TIMESTAMPTZ,
    INTEGER, INTEGER, TEXT, TEXT
) IS
    'Filtered, paginated list of newsletters that carry ALL tags in p_tag_ids. '
    'Each row includes a denormalised source JSONB object, a jsonb_agg of the '
    'newsletter''s full tag set, and a window-function total_count for the '
    'caller to use for pagination.  Optional filters: is_read, is_archived, '
    'is_liked, source_ids, date_from, date_to.  Supports ordering by '
    'received_at or title in either direction.';

GRANT EXECUTE ON FUNCTION public.get_newsletters_by_tags(
    UUID, UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
    UUID[], TIMESTAMPTZ, TIMESTAMPTZ,
    INTEGER, INTEGER, TEXT, TEXT
) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. set_newsletter_tags
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_newsletter_tags(
    p_newsletter_id UUID,
    p_user_id       UUID,
    p_tag_ids       UUID[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    -- Remove any tags that are no longer in the desired set
    DELETE FROM public.newsletter_tags
    WHERE newsletter_id = p_newsletter_id
      AND user_id       = p_user_id
      AND tag_id       != ALL(p_tag_ids);

    -- Insert any tags that are not yet present (ON CONFLICT makes this safe
    -- to call multiple times without producing duplicates)
    INSERT INTO public.newsletter_tags (newsletter_id, tag_id, user_id)
    SELECT p_newsletter_id, unnest(p_tag_ids), p_user_id
    ON CONFLICT (newsletter_id, tag_id) DO NOTHING;
$$;

COMMENT ON FUNCTION public.set_newsletter_tags(UUID, UUID, UUID[]) IS
    'Atomically reconciles the tag set for a newsletter so that it contains '
    'exactly the tags supplied in p_tag_ids.  Tags not in the array are '
    'deleted; tags already present are left untouched; missing tags are '
    'inserted.  The function is intentionally NOT marked STABLE because it '
    'performs writes (DELETE + INSERT).';

GRANT EXECUTE ON FUNCTION public.set_newsletter_tags(UUID, UUID, UUID[])
    TO authenticated;
