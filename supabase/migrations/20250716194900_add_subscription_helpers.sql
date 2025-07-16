-- Helper function to check if user can add more sources
CREATE OR REPLACE FUNCTION public.can_add_source(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_sources_count INTEGER;
    max_sources_allowed INTEGER;
    current_date DATE := (timezone('utc'::text, now()))::date;
BEGIN
    -- Get user's current subscription plan
    SELECT sp.max_sources INTO max_sources_allowed
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = user_id_param
    AND us.status = 'active'
    AND us.current_period_start <= now()
    AND us.current_period_end >= now()
    LIMIT 1;
    
    -- If no active subscription, use free plan limits
    IF max_sources_allowed IS NULL THEN
        SELECT max_sources INTO max_sources_allowed
        FROM public.subscription_plans
        WHERE name = 'Free';
    END IF;
    
    -- Get current sources count for the user
    SELECT COUNT(*) INTO current_sources_count
    FROM public.newsletter_sources
    WHERE user_id = user_id_param
    AND is_archived = false;
    
    RETURN current_sources_count < max_sources_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can receive more newsletters today and if it's not a duplicate
CREATE OR REPLACE FUNCTION public.can_receive_newsletter(
    user_id_param UUID,
    title TEXT DEFAULT NULL,
    content TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    current_newsletters_count INTEGER;
    max_newsletters_allowed INTEGER;
    current_date DATE := (timezone('utc'::text, now()))::date;
    is_duplicate BOOLEAN := FALSE;
    duplicate_info JSONB := '{}';
    similarity_threshold FLOAT := 0.9;
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
            SELECT 
                TRUE,
                jsonb_build_object(
                    'is_duplicate', TRUE,
                    'existing_id', id,
                    'received_at', received_at,
                    'similarity', CASE 
                        WHEN $2 IS NOT NULL THEN similarity(title, $2)
                        WHEN $3 IS NOT NULL THEN similarity(LEFT(content, 1000), LEFT($3, LEAST(1000, LENGTH($3))))
                        ELSE 1.0
                    END,
                    'matching_field', CASE 
                        WHEN $2 IS NOT NULL THEN 'title'
                        WHEN $3 IS NOT NULL THEN 'content'
                        ELSE 'no_matching_field'
                    END
                )
            INTO 
                is_duplicate,
                duplicate_info
            FROM 
                public.newsletters
            WHERE 
                user_id = user_id_param
                AND received_at >= (current_date - INTERVAL '30 days')
                AND (
                    -- Check for similar title (using trigram similarity with index if available)
                    ($2 IS NOT NULL AND title % $2)
                    OR
                    -- Or check for similar content (first 1000 chars for performance)
                    ($3 IS NOT NULL AND 
                     word_similarity(LEFT(content, 1000), LEFT($3, LEAST(1000, LENGTH($3)))) > similarity_threshold)
                )
            LIMIT 1;
            
            IF is_duplicate THEN
                RETURN jsonb_build_object(
                    'success', TRUE,
                    'can_receive', FALSE,
                    'reason', 'duplicate_newsletter',
                    'duplicate_info', duplicate_info,
                    'execution_time_ms', (EXTRACT(EPOCH FROM clock_timestamp()) - EXTRACT(EPOCH FROM statement_timestamp())) * 1000
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but continue with the function
            GET STACKED DIAGNOSTICS 
                error_context = PG_EXCEPTION_CONTEXT,
                error_message = MESSAGE_TEXT,
                error_detail = PG_EXCEPTION_DETAIL;
            
            -- Log the error for debugging
            RAISE WARNING 'Error checking for duplicate newsletter: %. % (Context: %)', 
                error_message, error_detail, error_context;
        END;
    END IF;
    
    -- Get user's current subscription plan with a more efficient query
    BEGIN
        SELECT sp.max_newsletters_per_day INTO STRICT max_newsletters_allowed
        FROM public.user_subscriptions us
        JOIN public.subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = user_id_param
        AND us.status = 'active'
        AND us.current_period_start <= now()
        AND us.current_period_end >= now()
        LIMIT 1;
    EXCEPTION 
        WHEN NO_DATA_FOUND THEN
            -- If no active subscription, use free plan limits
            SELECT max_newsletters_per_day INTO max_newsletters_allowed
            FROM public.subscription_plans
            WHERE name = 'Free';
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS 
                error_context = PG_EXCEPTION_CONTEXT,
                error_message = MESSAGE_TEXT,
                error_detail = PG_EXCEPTION_DETAIL;
            
            -- Default to free plan if there's an error
            RAISE WARNING 'Error getting subscription plan: %. % (Context: %)', 
                error_message, error_detail, error_context;
                
            SELECT max_newsletters_per_day INTO max_newsletters_allowed
            FROM public.subscription_plans
            WHERE name = 'Free';
    END;
    
    -- Get today's count with error handling
    BEGIN
        SELECT COALESCE(newsletters_count, 0) INTO current_newsletters_count
        FROM public.daily_counts
        WHERE user_id = user_id_param
        AND date = current_date
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- If there's an error, assume 0 for the count
        current_newsletters_count := 0;
    END;
    
    -- Calculate remaining count safely
    current_newsletters_count := COALESCE(current_newsletters_count, 0);
    max_newsletters_allowed := COALESCE(max_newsletters_allowed, 5); -- Default to free plan if NULL
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'can_receive', current_newsletters_count < max_newsletters_allowed,
        'current_count', current_newsletters_count,
        'max_allowed', max_newsletters_allowed,
        'reason', CASE 
            WHEN current_newsletters_count >= max_newsletters_allowed THEN 'daily_limit_reached'
            ELSE 'can_receive'
        END,
        'execution_time_ms', (EXTRACT(EPOCH FROM clock_timestamp()) - EXTRACT(EPOCH FROM statement_timestamp())) * 1000
    );
EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            error_context = PG_EXCEPTION_CONTEXT,
            error_message = MESSAGE_TEXT,
            error_detail = PG_EXCEPTION_DETAIL,
            error_hint = PG_EXCEPTION_HINT;
        
        -- Return a detailed error response
        RETURN jsonb_build_object(
            'success', FALSE,
            'can_receive', FALSE,
            'reason', 'error',
            'error', jsonb_build_object(
                'message', error_message,
                'detail', error_detail,
                'hint', error_hint,
                'context', error_context
            ),
            'error_timestamp', NOW(),
            'execution_time_ms', (EXTRACT(EPOCH FROM clock_timestamp()) - EXTRACT(EPOCH FROM statement_timestamp())) * 1000
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment received newsletter count
CREATE OR REPLACE FUNCTION public.increment_received_newsletter(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    current_date DATE := (timezone('utc'::text, now()))::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, newsletters_count, sources_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        newsletters_count = daily_counts.newsletters_count + 1,
        updated_at = timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment sources count
CREATE OR REPLACE FUNCTION public.increment_source_count(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    current_date DATE := (timezone('utc'::text, now()))::date;
BEGIN
    INSERT INTO public.daily_counts (user_id, date, sources_count, newsletters_count)
    VALUES (user_id_param, current_date, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        sources_count = daily_counts.sources_count + 1,
        updated_at = timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily counts (to be called by scheduled job)
CREATE OR REPLACE FUNCTION public.reset_daily_counts()
RETURNS VOID AS $$
BEGIN
    -- Delete counts older than 30 days
    DELETE FROM public.daily_counts
    WHERE date < (timezone('utc'::text, now()) - interval '30 days')::date;
    
    -- Log the reset
    RAISE LOG 'Reset daily counts at %', now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up scheduled job to reset counts daily at midnight UTC
-- Note: This requires pg_cron extension to be enabled in your Supabase project
-- You'll need to run this in the SQL editor in your Supabase dashboard
/*
SELECT cron.schedule(
    'reset-daily-counts',
    '0 0 * * *',  -- Runs at midnight UTC every day
    'SELECT public.reset_daily_counts()'
);
*/

-- Helper function to get user's current limits
CREATE OR REPLACE FUNCTION public.get_user_limits(user_id_param UUID)
RETURNS TABLE (
    max_sources INTEGER,
    current_sources INTEGER,
    max_newsletters_per_day INTEGER,
    received_newsletters_today INTEGER,
    plan_name TEXT,
    is_on_free_tier BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH user_plan AS (
        SELECT 
            sp.max_sources,
            sp.max_newsletters_per_day,
            sp.name as plan_name,
            (sp.name = 'Free') as is_free_tier
        FROM public.user_subscriptions us
        JOIN public.subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = user_id_param
        AND us.status = 'active'
        AND us.current_period_start <= now()
        AND us.current_period_end >= now()
        LIMIT 1
    )
    SELECT 
        COALESCE(up.max_sources, (SELECT max_sources FROM public.subscription_plans WHERE name = 'Free')) as max_sources,
        (SELECT COUNT(*) FROM public.newsletter_sources WHERE user_id = user_id_param AND is_archived = false) as current_sources,
        COALESCE(up.max_newsletters_per_day, (SELECT max_newsletters_per_day FROM public.subscription_plans WHERE name = 'Free')) as max_newsletters_per_day,
        COALESCE((
            SELECT newsletters_count 
            FROM public.daily_counts 
            WHERE user_id = user_id_param 
            AND date = (timezone('utc'::text, now()))::date
        ), 0) as received_newsletters_today,
        COALESCE(up.plan_name, 'Free') as plan_name,
        COALESCE(up.is_free_tier, true) as is_on_free_tier
    FROM user_plan up
    RIGHT JOIN (SELECT 1) as dummy ON true;  -- Ensures we always return one row
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes to improve performance of the duplicate check
-- Create a general index on user_id and received_at that can be used by the query planner
CREATE INDEX IF NOT EXISTS idx_newsletters_user_received 
    ON public.newsletters(user_id, received_at DESC);

-- Enable pg_trgm extension if not already enabled for similarity functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for text similarity searches if they don't exist
CREATE INDEX IF NOT EXISTS idx_newsletters_title_trgm 
    ON public.newsletters USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_newsletters_content_trgm 
    ON public.newsletters USING GIN (LEFT(content, 1000) gin_trgm_ops);
