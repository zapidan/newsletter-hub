-- ====================================================================
-- COMPREHENSIVE UTC SYNTAX FIX - FINAL VERSION
-- ====================================================================
-- 
-- PROBLEM: Multiple migration files contain problematic UTC syntax that causes:
-- "invalid input syntax for type date: \"utc\"" errors
-- 
-- ROOT CAUSE: Old migrations use timezone('utc'::text, now()) which:
-- 1. Causes casting errors when assigned to TIMESTAMP WITH TIME ZONE columns
-- 2. Triggers expensive pg_timezone_names queries (performance issue)
-- 3. Fails in fresh database setups
-- 
-- AFFECTED FILES:
-- - 20250716205519_add_unlimited_plan_and_assign_user.sql
-- - 20250716194900_add_subscription_helpers.sql  
-- - 20250716194700_create_subscription_tables.sql
-- 
-- SOLUTION: This migration forcefully fixes all UTC issues and ensures
-- the database ends up in a correct state regardless of old migration problems.
-- ====================================================================

-- --------------------------------------------------------------------
-- STEP 1: Fix Table Default Values (Override any problematic defaults)
-- --------------------------------------------------------------------
-- These ALTER statements override any bad defaults that might have been
-- set by old migrations, ensuring all new rows use correct UTC syntax.

-- Fix subscription_plans table defaults
ALTER TABLE subscription_plans 
ALTER COLUMN created_at SET DEFAULT now(),  -- now() already returns TIMESTAMPTZ
ALTER COLUMN updated_at SET DEFAULT now();

-- Fix user_subscriptions table defaults  
ALTER TABLE user_subscriptions 
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

-- Fix daily_counts table defaults
ALTER TABLE daily_counts 
ALTER COLUMN date SET DEFAULT (now() AT TIME ZONE 'UTC')::date,  -- Use UTC timezone for date calculations
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

-- --------------------------------------------------------------------
-- STEP 2: Forcefully Remove All Problematic Functions
-- --------------------------------------------------------------------
-- Using CASCADE ensures we can drop functions even if triggers depend on them.
-- This handles cases where old migrations created broken dependencies.

DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.reset_daily_counts() CASCADE;
DROP FUNCTION IF EXISTS public.safe_reset_daily_counts() CASCADE;
DROP FUNCTION IF EXISTS public.can_add_source(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_receive_newsletter(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.increment_received_newsletter(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_source_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_incoming_email_transaction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- --------------------------------------------------------------------
-- STEP 3: Recreate Core Utility Functions with Correct UTC Syntax
-- --------------------------------------------------------------------
-- All functions now use optimized UTC syntax:
-- - now() for TIMESTAMPTZ columns (correct type, no casting needed)
-- - now() AT TIME ZONE 'utc'::date for DATE columns (avoids expensive timezone() calls)

-- Trigger function for updating updated_at columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- now() already returns timestamp with time zone, no casting needed
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily counts (used by cron job)
CREATE OR REPLACE FUNCTION public.reset_daily_counts()
RETURNS VOID AS $$
BEGIN
    -- Use optimized UTC date calculation instead of expensive timezone() function
    DELETE FROM public.daily_counts
    WHERE date < (now() AT TIME ZONE 'UTC' - interval '30 days')::date;
    
    RAISE LOG 'Reset daily counts at %', now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe wrapper for reset_daily_counts (used by cron job with error handling)
CREATE OR REPLACE FUNCTION public.safe_reset_daily_counts()
RETURNS void AS $$
BEGIN
    BEGIN
        PERFORM public.reset_daily_counts();
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in reset_daily_counts: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- STEP 4: Recreate Count Increment Functions
-- --------------------------------------------------------------------
-- These functions are called by edge functions to track daily usage.
-- They must use correct UTC syntax to avoid casting errors.

-- Increment newsletter count when user receives a newsletter
CREATE OR REPLACE FUNCTION public.increment_received_newsletter(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    -- Use optimized UTC date calculation without expensive timezone() function
    current_date DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, newsletters_count, sources_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        newsletters_count = daily_counts.newsletters_count + 1,
        updated_at = now();  -- now() is correct for TIMESTAMPTZ columns
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment source count when user adds a new newsletter source
CREATE OR REPLACE FUNCTION public.increment_source_count(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    -- Use optimized UTC date calculation without expensive timezone() function
    current_date DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, sources_count, newsletters_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        sources_count = daily_counts.sources_count + 1,
        updated_at = now();  -- now() is correct for TIMESTAMPTZ columns
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- STEP 5: Recreate User Limit and Validation Functions
-- --------------------------------------------------------------------
-- These functions check user subscription limits and validate newsletter reception.
-- They are critical for the application's business logic.

-- Check if user can add more sources (simple boolean return)
CREATE OR REPLACE FUNCTION public.can_add_source(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_sources_count INTEGER;
    max_sources_allowed INTEGER;
    -- Use optimized UTC date calculation without expensive timezone() function
    current_date DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    -- Get user's current subscription plan
    SELECT sp.max_sources INTO max_sources_allowed
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now()  -- now() works for TIMESTAMPTZ comparison
    AND us.current_period_end >= now()
    LIMIT 1;
    
    -- If no subscription found, use free tier limits
    IF max_sources_allowed IS NULL THEN
        max_sources_allowed := 50; -- Free tier limit
    END IF;
    
    -- Get today's source count for this user
    SELECT COALESCE(sources_count, 0) INTO current_sources_count
    FROM public.daily_counts
    WHERE user_id = user_id_param
    AND date = current_date
    LIMIT 1;
    
    -- Check if user can add more sources today
    RETURN current_sources_count < max_sources_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complex newsletter validation function with duplicate detection
CREATE OR REPLACE FUNCTION public.can_receive_newsletter(
    user_id_param UUID,
    title TEXT DEFAULT NULL,
    content TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    current_newsletters_count INTEGER;
    max_newsletters_allowed INTEGER;
    -- Use optimized UTC date calculation without expensive timezone() function
    current_date DATE := (now() AT TIME ZONE 'UTC')::date;
    is_duplicate BOOLEAN := FALSE;
    duplicate_info JSONB := '{}';
    similarity_threshold FLOAT := 0.9;
    -- Variables for duplicate detection
    existing_id UUID;
    existing_received_at TIMESTAMP WITH TIME ZONE;
    similarity_score FLOAT;
    matching_field TEXT;
    error_context TEXT;
    error_message TEXT;
    error_detail TEXT;
    error_hint TEXT;
BEGIN
    -- Set a statement timeout to prevent long-running queries
    SET LOCAL statement_timeout = '5s';
    
    -- Input validation
    IF user_id_param IS NULL THEN
        RAISE EXCEPTION 'user_id_param cannot be NULL';
    END IF;

    -- Check for duplicate newsletters (if we have enough data to compare)
    IF title IS NOT NULL OR content IS NOT NULL THEN
        BEGIN
            -- Find potential duplicates using similarity search
            SELECT id INTO existing_id
            FROM public.newsletters 
            WHERE user_id = user_id_param
            AND (
                (title IS NOT NULL AND $2 IS NOT NULL AND similarity(title, $2) > similarity_threshold)
                OR (content IS NOT NULL AND $3 IS NOT NULL AND similarity(LEFT(content, 1000), LEFT($3, LEAST(1000, LENGTH($3)))) > similarity_threshold)
            )
            ORDER BY received_at DESC
            LIMIT 1;
            
            -- If we found a duplicate, get detailed information
            IF FOUND THEN
                SELECT 
                    received_at,
                    CASE 
                        WHEN $2 IS NOT NULL THEN similarity(title, $2)
                        WHEN $3 IS NOT NULL THEN similarity(LEFT(content, 1000), LEFT($3, LEAST(1000, LENGTH($3))))
                        ELSE 1.0
                    END,
                    CASE 
                        WHEN $2 IS NOT NULL THEN 'title'
                        WHEN $3 IS NOT NULL THEN 'content'
                        ELSE 'no_matching_field'
                    END
                INTO 
                    existing_received_at,
                    similarity_score,
                    matching_field
                FROM public.newsletters 
                WHERE id = existing_id;
                
                -- Build detailed duplicate information
                duplicate_info := jsonb_build_object(
                    'is_duplicate', TRUE,
                    'existing_id', existing_id,
                    'received_at', existing_received_at,
                    'similarity', similarity_score,
                    'matching_field', matching_field
                );
                
                is_duplicate := TRUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If similarity check fails, continue with non-duplicate logic
            is_duplicate := FALSE;
        END;
    END IF;

    -- If it's a duplicate, return early with duplicate info
    IF is_duplicate THEN
        RETURN jsonb_build_object(
            'can_receive', FALSE,
            'reason', 'duplicate',
            'duplicate_info', duplicate_info,
            'current_date', current_date
        );
    END IF;

    -- Get user's current subscription plan for newsletter limits
    SELECT sp.max_sources INTO max_newsletters_allowed
    FROM public.subscription_plans sp
    JOIN public.user_subscriptions us ON sp.id = us.plan_id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now()  -- Already in UTC
    AND us.current_period_end > now()
    LIMIT 1;

    -- If no subscription found, use free tier limits
    IF max_newsletters_allowed IS NULL THEN
        max_newsletters_allowed := 10; -- Free tier limit
    END IF;

    -- Get today's newsletter count for this user
    SELECT COALESCE(newsletters_count, 0) INTO current_newsletters_count
    FROM public.daily_counts
    WHERE user_id = user_id_param
    AND date = current_date
    LIMIT 1;

    -- Check if user can receive more newsletters today
    IF current_newsletters_count < max_newsletters_allowed THEN
        RETURN jsonb_build_object(
            'can_receive', TRUE,
            'current_count', current_newsletters_count,
            'max_allowed', max_newsletters_allowed,
            'current_date', current_date
        );
    ELSE
        RETURN jsonb_build_object(
            'can_receive', FALSE,
            'reason', 'daily_limit_exceeded',
            'current_count', current_newsletters_count,
            'max_allowed', max_newsletters_allowed,
            'current_date', current_date
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Comprehensive error handling for debugging
    GET STACKED DIAGNOSTICS 
        error_context = PG_EXCEPTION_CONTEXT,
        error_message = PG_EXCEPTION_DETAIL,
        error_detail = PG_EXCEPTION_DETAIL,
        error_hint = PG_EXCEPTION_HINT;
    
    RETURN jsonb_build_object(
        'can_receive', FALSE,
        'error', TRUE,
        'error_message', error_message,
        'error_context', error_context,
        'error_detail', error_detail,
        'error_hint', error_hint,
        'current_date', current_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- STEP 6: Recreate Database Triggers
-- --------------------------------------------------------------------
-- Recreate triggers that were dropped by CASCADE in Step 2.
-- These triggers automatically update updated_at columns.

-- Drop any existing triggers (clean slate)
DROP TRIGGER IF EXISTS set_subscription_plans_updated_at ON subscription_plans;
DROP TRIGGER IF EXISTS set_user_subscriptions_updated_at ON user_subscriptions;
DROP TRIGGER IF EXISTS set_daily_counts_updated_at ON daily_counts;

-- Recreate triggers with the fixed handle_updated_at function
CREATE TRIGGER set_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_daily_counts_updated_at
    BEFORE UPDATE ON daily_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------------
-- STEP 7: Grant Permissions
-- --------------------------------------------------------------------
-- Ensure all functions have proper permissions for the application.

GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_daily_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.safe_reset_daily_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_received_newsletter(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_source_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_receive_newsletter(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_add_source(UUID) TO authenticated, service_role;

-- --------------------------------------------------------------------
-- STEP 9: Recreate handle_incoming_email_transaction with Correct UTC Syntax
-- --------------------------------------------------------------------
-- This function is called by the edge function to process incoming emails.
-- It was missing from the original migration, causing silent failures.

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
  v_clean_content text;
  v_source_name text;
  v_source_email text;
BEGIN
  -- Validate user_id is provided
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_id is required - all sources must be user-scoped'
    );
  END IF;
  
  -- Use the full from email as the source identifier
  v_source_email := lower(trim(p_from_email));
  v_source_name := COALESCE(NULLIF(trim(p_from_name), ''), split_part(v_source_email, '@', 1));

  -- Find existing source by NAME only (not email) for this user
  SELECT id INTO v_source_id 
  FROM public.newsletter_sources 
  WHERE name = v_source_name 
  AND user_id = p_user_id
  LIMIT 1;

  -- If no source exists, create a new one
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
      "from" = EXCLUDED."from", -- Update email if it changed
      updated_at = now()
    RETURNING id INTO v_source_id;
  ELSE
    -- Update the email if it's different (newsletters can use multiple emails)
    UPDATE public.newsletter_sources 
    SET "from" = p_from_email, updated_at = now()
    WHERE id = v_source_id AND "from" != p_from_email;
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
    now(),  -- received_at
    now(),  -- created_at
    now()   -- updated_at
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the handle_incoming_email_transaction function
GRANT EXECUTE ON FUNCTION public.handle_incoming_email_transaction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- --------------------------------------------------------------------
-- STEP 9.5: Fix all table defaults with problematic UTC syntax
-- --------------------------------------------------------------------
-- Fix all instances of timezone('utc'::text, now()) in table defaults

-- 1. Fix subscription_plans table
ALTER TABLE public.subscription_plans 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- 2. Fix user_subscriptions table
ALTER TABLE public.user_subscriptions
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- 3. Fix daily_counts table
ALTER TABLE public.daily_counts 
  ALTER COLUMN date SET DEFAULT (now() AT TIME ZONE 'utc')::date,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Add comments to document the changes
COMMENT ON COLUMN public.daily_counts.date IS 'Fixed default value to use correct UTC syntax (previously used timezone(''utc''::text, now()))';
COMMENT ON COLUMN public.subscription_plans.created_at IS 'Fixed default value to use now() directly (previously used timezone(''utc''::text, now()))';
COMMENT ON COLUMN public.subscription_plans.updated_at IS 'Fixed default value to use now() directly (previously used timezone(''utc''::text, now()))';
COMMENT ON COLUMN public.user_subscriptions.created_at IS 'Fixed default value to use now() directly (previously used timezone(''utc''::text, now()))';
COMMENT ON COLUMN public.user_subscriptions.updated_at IS 'Fixed default value to use now() directly (previously used timezone(''utc''::text, now()))';

-- --------------------------------------------------------------------
-- STEP 10: Documentation for Future Developers
-- --------------------------------------------------------------------
-- Clear explanation of what this migration fixes and why it's needed.

/*
COMPREHENSIVE UTC SYNTAX FIX - FINAL VERSION

PROBLEM SOLVED:
This migration fixes "invalid input syntax for type date: utc" errors caused by 
timezone('utc'::text, now()) syntax in old migration files.

ROOT CAUSE:
Old migrations (20250716205519, 20250716194900, 20250716194700) contain problematic UTC syntax:
- timezone('utc'::text, now()) for TIMESTAMPTZ columns (causes casting errors)
- (timezone('utc'::text, now()))::date for DATE columns (performance issue)

SOLUTION APPROACH:
1. Override bad table defaults with ALTER statements
2. Use CASCADE to forcefully remove all broken functions/dependencies  
3. Recreate everything with optimized UTC syntax:
   - now() for TIMESTAMPTZ columns (correct type, no casting)
   - (now() AT TIME ZONE 'UTC')::date for DATE columns (performance optimized)

WHY THIS IS FUTURE-PROOF:
- Works even if old migrations fail completely
- Handles broken dependencies with CASCADE
- Documents the issue for future developers
- Provides clean, optimized UTC patterns to follow

PERFORMANCE IMPACT:
- Eliminates expensive pg_timezone_names queries
- Uses optimized UTC date calculations
- Maintains all functionality while improving speed

DEVELOPER NOTES:
- Always use now() for TIMESTAMPTZ columns
- Always use (now() AT TIME ZONE 'UTC')::date for DATE columns  
- Never use timezone('utc'::text, now()) in new code
*/
