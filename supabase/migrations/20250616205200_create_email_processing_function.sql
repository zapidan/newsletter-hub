-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS public.handle_incoming_email_transaction(
  uuid, text, text, text, text, text, text
);

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
  v_domain text;
  v_word_count integer;
  v_estimated_read_time integer;
  v_clean_content text;
  v_system_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_effective_user_id uuid;
BEGIN
  -- Set effective user ID - use system user if p_user_id is null
  v_effective_user_id := COALESCE(p_user_id, v_system_user_id);
  
  -- Extract domain from email
  v_domain := substring(p_from_email from '@(.*)');

  -- First, try to find an existing source with the same domain and user_id (or system user)
  SELECT id INTO v_source_id 
  FROM public.newsletter_sources 
  WHERE domain = v_domain 
  AND (user_id = v_effective_user_id OR (user_id IS NULL AND p_user_id IS NULL))
  LIMIT 1;

  -- If no source exists, create a new one
  IF v_source_id IS NULL THEN
    INSERT INTO public.newsletter_sources (
      user_id,
      name,
      domain,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,  -- This can be NULL
      p_from_name,
      v_domain,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_source_id;
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