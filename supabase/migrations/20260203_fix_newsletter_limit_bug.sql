-- ====================================================================
-- FIX: Newsletter Limit Bug - Select Wrong Column
-- ====================================================================
-- 
-- BUG: In can_receive_newsletter function, line 276 was selecting
-- sp.max_sources instead of sp.max_newsletters_per_day, causing users
-- with unlimited newsletters to get the wrong limit (max_sources instead
-- of max_newsletters_per_day).
-- 
-- This migration fixes the bug by ensuring we select the correct column
-- and properly handle unlimited plans.
-- ====================================================================

-- Drop and recreate the function with the correct column selection
DROP FUNCTION IF EXISTS public.can_receive_newsletter(UUID, TEXT, TEXT) CASCADE;

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

    -- FIX: Get user's current subscription plan for newsletter limits
    -- BUG WAS HERE: Was selecting sp.max_sources instead of sp.max_newsletters_per_day
    SELECT sp.max_newsletters_per_day INTO max_newsletters_allowed
    FROM public.subscription_plans sp
    JOIN public.user_subscriptions us ON sp.id = us.plan_id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now()  -- Already in UTC
    AND us.current_period_end > now()
    LIMIT 1;

    -- If no subscription found, use free tier limits
    IF max_newsletters_allowed IS NULL THEN
        -- Get the free plan's max_newsletters_per_day limit
        SELECT max_newsletters_per_day INTO max_newsletters_allowed
        FROM public.subscription_plans
        WHERE name = 'Free'
        LIMIT 1;
        
        -- Fallback to 5 if free plan not found
        IF max_newsletters_allowed IS NULL THEN
            max_newsletters_allowed := 5; -- Free tier limit
        END IF;
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_receive_newsletter(UUID, TEXT, TEXT) TO authenticated, service_role;
