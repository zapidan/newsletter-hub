-- Drop the function if it exists to avoid conflicts
DO $$
DECLARE
    func_record RECORD;
    drop_statement TEXT;
BEGIN
    FOR func_record IN 
        SELECT proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'handle_incoming_email_transaction'
    LOOP
        drop_statement := format('DROP FUNCTION IF EXISTS %I(%s) CASCADE', 
                               func_record.proname, 
                               func_record.args);
        EXECUTE drop_statement;
        RAISE NOTICE 'Dropped function %(%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

-- Create the function
CREATE OR REPLACE FUNCTION public.handle_incoming_email_transaction(
  p_user_id uuid,
  p_from_email text,
  p_from_name text,
  p_subject text,
  p_content text,
  p_excerpt text,
  p_raw_headers text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_newsletter_id uuid;
  v_result jsonb;
  v_word_count integer;
  v_estimated_read_time integer;
  v_clean_content text;
  v_system_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_effective_user_id uuid;
  v_source_name text;
  v_source_email text;
BEGIN
  -- Set effective user ID - use provided user_id
  v_effective_user_id := p_user_id;
  
  -- Use the full from email as the source identifier
  v_source_email := lower(trim(p_from_email));
  v_source_name := COALESCE(NULLIF(trim(p_from_name), ''), split_part(v_source_email, '@', 1));

  -- First, try to find an existing source with the same name and from email for this user
  SELECT id INTO v_source_id 
  FROM public.newsletter_sources 
  WHERE name = v_source_name 
  AND "from" = p_from_email
  AND (user_id = v_effective_user_id OR (user_id IS NULL AND p_user_id IS NULL))
  LIMIT 1;

  -- If no source exists, create a new one
  IF v_source_id IS NULL THEN
    IF p_user_id IS NULL THEN
      -- For system emails (NULL user_id), use name and from as the conflict target
      INSERT INTO public.newsletter_sources (
        user_id,
        name,
        "from",
        created_at,
        updated_at
      ) VALUES (
        NULL,  -- System email
        v_source_name,
        p_from_email,  -- Store the full from email
        NOW(),
        NOW()
      )
      ON CONFLICT (name, "from") 
      WHERE user_id IS NULL
      DO UPDATE SET 
        updated_at = NOW()
      RETURNING id INTO v_source_id;
    ELSE
      -- For user emails, include user_id in the conflict target
      INSERT INTO public.newsletter_sources (
        user_id,
        name,
        "from",
        created_at,
        updated_at
      ) VALUES (
        p_user_id,
        v_source_name,
        p_from_email,  -- Store the full from email
        NOW(),
        NOW()
      )
      ON CONFLICT (name, "from", user_id)
      WHERE user_id IS NOT NULL
      DO UPDATE SET 
        updated_at = NOW()
      RETURNING id INTO v_source_id;
    END IF;
  END IF;

  -- Calculate word count and read time
  v_clean_content := regexp_replace(COALESCE(p_content, ''), '<[^>]+>', ' ', 'g');
  v_word_count := LENGTH(REGEXP_REPLACE(v_clean_content, '\s+', ' ', 'g')) - LENGTH(REPLACE(REGEXP_REPLACE(v_clean_content, '\s+', ' ', 'g'), ' ', '')) + 1;
  v_estimated_read_time := GREATEST(1, CEIL(v_word_count / 200.0));

  -- Create a new newsletter entry
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
    false,  -- is_read
    false,  -- is_archived
    false,  -- is_liked
    NOW(),  -- received_at
    NOW(),  -- created_at
    NOW()   -- updated_at
  )
  RETURNING id INTO v_newsletter_id;

  -- Increment the received newsletter count
  PERFORM public.increment_received_newsletter(p_user_id);

  -- Return the result
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
$$;

-- Grant execute permissions to the necessary roles
GRANT EXECUTE ON FUNCTION public.handle_incoming_email_transaction(
  uuid, text, text, text, text, text, text
) TO authenticated, service_role;

-- Verify the function was created
SELECT 
  proname, 
  pg_get_userbyid(proowner) as owner,
  prosecdef as security_definer,
  proacl as access_privileges
FROM pg_proc
WHERE proname = 'handle_incoming_email_transaction';