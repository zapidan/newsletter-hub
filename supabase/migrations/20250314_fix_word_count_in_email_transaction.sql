-- Fix word count and read time in handle_incoming_email_transaction
-- The transaction was using a space-based token count that produced wrong values:
-- - Empty or tag-only content showed "1 min" (formula gave 1 token)
-- - Content with HTML/URLs was overcounted (no stripping of scripts, ads, etc.)
-- Use the same public.calculate_word_count() used elsewhere for consistency.

CREATE OR REPLACE FUNCTION public.handle_incoming_email_transaction(
    p_user_id UUID,
    p_from_email TEXT,
    p_from_name TEXT,
    p_subject TEXT,
    p_content TEXT,
    p_excerpt TEXT,
    p_raw_headers TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_source_id uuid;
  v_newsletter_id uuid;
  v_result jsonb;
  v_word_count integer;
  v_estimated_read_time integer;
  v_source_name text;
  v_source_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_id is required - all sources must be user-scoped'
    );
  END IF;

  v_source_email := lower(trim(p_from_email));
  v_source_name := COALESCE(NULLIF(trim(p_from_name), ''), split_part(v_source_email, '@', 1));

  SELECT id INTO v_source_id
  FROM public.newsletter_sources
  WHERE name = v_source_name
  AND user_id = p_user_id
  LIMIT 1;

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
      now(),
      now()
    )
    ON CONFLICT (name, user_id)
    DO UPDATE SET
      "from" = EXCLUDED."from",
      updated_at = now()
    RETURNING id INTO v_source_id;
  ELSE
    UPDATE public.newsletter_sources
    SET "from" = p_from_email, updated_at = now()
    WHERE id = v_source_id AND "from" != p_from_email;
  END IF;

  -- Use standardized word count (strips HTML, scripts, ads, counts real words)
  v_word_count := public.calculate_word_count(p_content);
  -- 200 words per minute; minimum 1 min for non-empty content
  v_estimated_read_time := GREATEST(1, CEIL(v_word_count / 200.0));

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
  ) VALUES (
    p_user_id,
    p_subject,
    p_content,
    p_excerpt,
    v_source_id,
    v_word_count,
    v_estimated_read_time,
    false,
    false,
    false,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_newsletter_id;

  PERFORM public.increment_received_newsletter(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'newsletter_id', v_newsletter_id,
    'source_id', v_source_id,
    'word_count', v_word_count,
    'estimated_read_time', v_estimated_read_time
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'context', 'handle_incoming_email_transaction function',
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_incoming_email_transaction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
'Processes incoming emails and creates newsletter rows. Uses public.calculate_word_count() for consistent word count and read time (200 wpm).';
