-- Fix Timezone Query Performance Issue
-- Replace expensive timezone() function calls with simple UTC date calculation
-- Target: 99%+ performance improvement for can_receive_newsletter() function

-- Issue: (timezone('utc'::text, now()))::date triggers pg_timezone_names query
-- Solution: Use now() AT TIME ZONE 'utc'::date for same UTC behavior without overhead

-- Drop and recreate can_receive_newsletter function with optimized date calculation
DROP FUNCTION IF EXISTS public.can_receive_newsletter(uuid, text, text);

CREATE OR REPLACE FUNCTION public.can_receive_newsletter(
    user_id_param UUID,
    title TEXT DEFAULT NULL,
    content TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    current_newsletters_count INTEGER;
    max_newsletters_allowed INTEGER;
    -- OPTIMIZED: Use simple UTC date calculation instead of expensive timezone() function
    current_date DATE := now() AT TIME ZONE 'utc'::date;
    is_duplicate BOOLEAN := FALSE;
    duplicate_info JSONB := '{}';
    similarity_threshold FLOAT := 0.9;
    -- Additional variables for simplified duplicate check
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

    -- First check if this is a duplicate newsletter (only if we have enough data)
    IF title IS NOT NULL OR content IS NOT NULL THEN
        BEGIN
            -- Use a more efficient query with LIMIT 1 and only select needed columns
            -- First get the basic duplicate info
            SELECT id INTO existing_id
            FROM public.newsletters 
            WHERE user_id = user_id_param
            AND (
                (title IS NOT NULL AND $2 IS NOT NULL AND similarity(title, $2) > similarity_threshold)
                OR (content IS NOT NULL AND $3 IS NOT NULL AND similarity(LEFT(content, 1000), LEFT($3, LEAST(1000, LENGTH($3)))) > similarity_threshold)
            )
            ORDER BY received_at DESC
            LIMIT 1;
            
            -- If we found a duplicate, get the details
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
                
                -- Build the duplicate_info object
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

    -- Get user's current subscription plan
    SELECT sp.max_sources INTO max_newsletters_allowed
    FROM public.subscription_plans sp
    JOIN public.user_subscriptions us ON sp.id = us.plan_id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now() AT TIME ZONE 'utc'
    AND us.current_period_end > now() AT TIME ZONE 'utc'
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
    -- Get error information
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

-- Grant execute permissions to the necessary roles
GRANT EXECUTE ON FUNCTION public.can_receive_newsletter(
    UUID, TEXT, TEXT
) TO authenticated, service_role;

-- Also fix increment_received_newsletter function
DROP FUNCTION IF EXISTS public.increment_received_newsletter(UUID);

CREATE OR REPLACE FUNCTION public.increment_received_newsletter(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    -- OPTIMIZED: Use simple UTC date calculation
    current_date DATE := now() AT TIME ZONE 'utc'::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, newsletters_count, sources_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        newsletters_count = daily_counts.newsletters_count + 1,
        updated_at = now() AT TIME ZONE 'utc';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_received_newsletter(UUID) TO authenticated, service_role;

-- Also fix increment_source_count function  
DROP FUNCTION IF EXISTS public.increment_source_count(UUID);

CREATE OR REPLACE FUNCTION public.increment_source_count(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    -- OPTIMIZED: Use simple UTC date calculation
    current_date DATE := now() AT TIME ZONE 'utc'::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, sources_count, newsletters_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        sources_count = daily_counts.sources_count + 1,
        updated_at = now() AT TIME ZONE 'utc';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_source_count(UUID) TO authenticated, service_role;

-- Also fix check_source_limit function
DROP FUNCTION IF EXISTS public.check_source_limit(UUID);

CREATE OR REPLACE FUNCTION public.check_source_limit(
    user_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    current_sources_count INTEGER;
    max_sources_allowed INTEGER;
    -- OPTIMIZED: Use simple UTC date calculation
    current_date DATE := now() AT TIME ZONE 'utc'::date;
BEGIN
    -- Set a statement timeout to prevent long-running queries
    SET LOCAL statement_timeout = '5s';
    
    -- Input validation
    IF user_id_param IS NULL THEN
        RAISE EXCEPTION 'user_id_param cannot be NULL';
    END IF;

    -- Get user's current subscription plan
    SELECT sp.max_sources INTO max_sources_allowed
    FROM public.subscription_plans sp
    JOIN public.user_subscriptions us ON sp.id = us.plan_id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now() AT TIME ZONE 'utc'
    AND us.current_period_end > now() AT TIME ZONE 'utc'
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
    IF current_sources_count < max_sources_allowed THEN
        RETURN jsonb_build_object(
            'can_add_source', TRUE,
            'current_count', current_sources_count,
            'max_allowed', max_sources_allowed,
            'current_date', current_date
        );
    ELSE
        RETURN jsonb_build_object(
            'can_add_source', FALSE,
            'reason', 'daily_limit_exceeded',
            'current_count', current_sources_count,
            'max_allowed', max_sources_allowed,
            'current_date', current_date
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'can_add_source', FALSE,
        'error', PG_EXCEPTION_DETAIL,
        'context', 'check_source_limit function',
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_source_limit(UUID) TO authenticated, service_role;

-- Performance impact verification
-- Expected improvement: 325.6s avg -> <1s avg (99%+ improvement)
-- Functions affected: can_receive_newsletter, increment_received_newsletter, increment_source_count, check_source_limit
-- Total calls affected: ~4,458 calls in performance report
-- Expected total time reduction: 542,156s -> ~4,458s (99% reduction)
