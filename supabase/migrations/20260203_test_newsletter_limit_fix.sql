-- ====================================================================
-- TEST: Newsletter Limit Bug Fix Verification
-- ====================================================================
-- 
-- These SQL tests verify that the bug fix works correctly:
-- 1. Users with unlimited plans get max_newsletters_per_day (1000000), not max_sources
-- 2. Daily counts use UTC dates correctly
-- 3. Free plan users get the correct limit
-- 
-- To run these tests, execute this file in your Supabase SQL editor
-- ====================================================================

-- Test 1: Verify unlimited plan user gets correct limit
DO $$
DECLARE
    test_user_id UUID := '16190e6c-2519-4c36-9178-71ce2843e59c';
    test_result JSONB;
    unlimited_plan_max_newsletters INTEGER;
    unlimited_plan_max_sources INTEGER;
BEGIN
    -- Get the unlimited plan's limits
    SELECT max_newsletters_per_day, max_sources 
    INTO unlimited_plan_max_newsletters, unlimited_plan_max_sources
    FROM public.subscription_plans 
    WHERE name = 'Unlimited' 
    LIMIT 1;
    
    -- Call the function
    SELECT public.can_receive_newsletter(test_user_id, 'Test Title', 'Test Content')
    INTO test_result;
    
    -- Verify that max_allowed is max_newsletters_per_day, not max_sources
    IF (test_result->>'max_allowed')::INTEGER = unlimited_plan_max_newsletters THEN
        RAISE NOTICE '✓ TEST 1 PASSED: Unlimited plan user gets max_newsletters_per_day (%)', unlimited_plan_max_newsletters;
    ELSE
        RAISE EXCEPTION '✗ TEST 1 FAILED: Expected max_allowed = %, got %', 
            unlimited_plan_max_newsletters, 
            test_result->>'max_allowed';
    END IF;
    
    -- Verify it's NOT max_sources (the bug)
    IF (test_result->>'max_allowed')::INTEGER != unlimited_plan_max_sources OR unlimited_plan_max_sources = unlimited_plan_max_newsletters THEN
        RAISE NOTICE '✓ TEST 1 VERIFIED: max_allowed (%) is NOT incorrectly using max_sources (%)', 
            test_result->>'max_allowed', 
            unlimited_plan_max_sources;
    END IF;
END $$;

-- Test 2: Verify free plan user gets correct limit (5)
-- Note: This test uses the existing unlimited user and temporarily assigns them to free plan
-- to test the free plan limit logic
DO $$
DECLARE
    test_user_id UUID := '16190e6c-2519-4c36-9178-71ce2843e59c';
    test_result JSONB;
    free_plan_max_newsletters INTEGER;
    original_plan_id BIGINT;
    free_plan_id BIGINT;
BEGIN
    -- Save original plan
    SELECT plan_id INTO original_plan_id
    FROM public.user_subscriptions
    WHERE user_id = test_user_id
    AND status = 'active'
    LIMIT 1;
    
    -- Get free plan ID
    SELECT id INTO free_plan_id
    FROM public.subscription_plans 
    WHERE name = 'Free' 
    LIMIT 1;
    
    -- Temporarily assign user to free plan
    UPDATE public.user_subscriptions
    SET plan_id = free_plan_id,
        updated_at = now()
    WHERE user_id = test_user_id
    AND status = 'active';
    
    -- Get free plan limit
    SELECT max_newsletters_per_day INTO free_plan_max_newsletters
    FROM public.subscription_plans 
    WHERE name = 'Free' 
    LIMIT 1;
    
    -- Call the function
    SELECT public.can_receive_newsletter(test_user_id, 'Test Title', 'Test Content')
    INTO test_result;
    
    -- Verify that max_allowed is 5 (free plan limit)
    IF (test_result->>'max_allowed')::INTEGER = free_plan_max_newsletters THEN
        RAISE NOTICE '✓ TEST 2 PASSED: Free plan user gets max_newsletters_per_day (%)', free_plan_max_newsletters;
    ELSE
        RAISE EXCEPTION '✗ TEST 2 FAILED: Expected max_allowed = %, got %', 
            free_plan_max_newsletters, 
            test_result->>'max_allowed';
    END IF;
    
    -- Restore original plan
    IF original_plan_id IS NOT NULL THEN
        UPDATE public.user_subscriptions
        SET plan_id = original_plan_id,
            updated_at = now()
        WHERE user_id = test_user_id
        AND status = 'active';
    END IF;
END $$;

-- Test 3: Verify UTC date is used correctly
DO $$
DECLARE
    test_user_id UUID := '16190e6c-2519-4c36-9178-71ce2843e59c';
    test_result JSONB;
    expected_date DATE;
    actual_date DATE;
BEGIN
    -- Calculate expected UTC date
    expected_date := (now() AT TIME ZONE 'UTC')::date;
    
    -- Call the function
    SELECT public.can_receive_newsletter(test_user_id, 'Test Title', 'Test Content')
    INTO test_result;
    
    -- Extract date from result
    actual_date := (test_result->>'current_date')::DATE;
    
    -- Verify dates match
    IF actual_date = expected_date THEN
        RAISE NOTICE '✓ TEST 3 PASSED: UTC date is correct (%)', actual_date;
    ELSE
        RAISE EXCEPTION '✗ TEST 3 FAILED: Expected date = %, got %', 
            expected_date, 
            actual_date;
    END IF;
END $$;

-- Test 4: Verify user without subscription falls back to free plan
-- Note: This test uses the existing unlimited user and temporarily removes their subscription
-- to test the fallback logic
DO $$
DECLARE
    test_user_id UUID := '16190e6c-2519-4c36-9178-71ce2843e59c';
    test_result JSONB;
    free_plan_max_newsletters INTEGER;
    original_plan_id BIGINT;
    original_status TEXT;
    original_period_start TIMESTAMP WITH TIME ZONE;
    original_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Save original subscription data
    SELECT plan_id, status, current_period_start, current_period_end
    INTO original_plan_id, original_status, original_period_start, original_period_end
    FROM public.user_subscriptions
    WHERE user_id = test_user_id
    LIMIT 1;
    
    -- Temporarily remove subscription (set status to expired)
    UPDATE public.user_subscriptions
    SET status = 'expired',
        updated_at = now()
    WHERE user_id = test_user_id;
    
    -- Get free plan limit
    SELECT max_newsletters_per_day INTO free_plan_max_newsletters
    FROM public.subscription_plans 
    WHERE name = 'Free' 
    LIMIT 1;
    
    -- Call the function
    SELECT public.can_receive_newsletter(test_user_id, 'Test Title', 'Test Content')
    INTO test_result;
    
    -- Verify that max_allowed falls back to free plan limit
    IF (test_result->>'max_allowed')::INTEGER = free_plan_max_newsletters THEN
        RAISE NOTICE '✓ TEST 4 PASSED: User without active subscription falls back to free plan limit (%)', free_plan_max_newsletters;
    ELSE
        RAISE EXCEPTION '✗ TEST 4 FAILED: Expected max_allowed = % (free plan), got %', 
            free_plan_max_newsletters, 
            test_result->>'max_allowed';
    END IF;
    
    -- Restore original subscription
    IF original_plan_id IS NOT NULL THEN
        UPDATE public.user_subscriptions
        SET plan_id = original_plan_id,
            status = original_status,
            current_period_start = original_period_start,
            current_period_end = original_period_end,
            updated_at = now()
        WHERE user_id = test_user_id;
    END IF;
END $$;

-- Test 5: Verify daily count increments correctly
DO $$
DECLARE
    test_user_id UUID := '16190e6c-2519-4c36-9178-71ce2843e59c';
    initial_count INTEGER := 0;
    after_increment_count INTEGER;
    expected_count INTEGER;
    test_result JSONB;
BEGIN
    -- Get initial count (handle NULL case - if no row exists, count is 0)
    SELECT COALESCE(newsletters_count, 0) INTO initial_count
    FROM public.daily_counts
    WHERE user_id = test_user_id
    AND date = (now() AT TIME ZONE 'UTC')::date
    LIMIT 1;
    
    -- If no row exists, initial_count will be NULL, so set it to 0
    IF initial_count IS NULL THEN
        initial_count := 0;
    END IF;
    
    -- Increment the count
    PERFORM public.increment_received_newsletter(test_user_id);
    
    -- Get count after increment
    SELECT COALESCE(newsletters_count, 0) INTO after_increment_count
    FROM public.daily_counts
    WHERE user_id = test_user_id
    AND date = (now() AT TIME ZONE 'UTC')::date
    LIMIT 1;
    
    -- Calculate expected count
    expected_count := initial_count + 1;
    
    -- Verify count increased by 1
    IF after_increment_count = expected_count THEN
        RAISE NOTICE '✓ TEST 5 PASSED: Daily count increments correctly (% -> %)', 
            initial_count, 
            after_increment_count;
    ELSE
        RAISE EXCEPTION '✗ TEST 5 FAILED: Expected count = %, got % (initial was %)', 
            expected_count, 
            after_increment_count,
            initial_count;
    END IF;
    
    -- Verify can_receive_newsletter reflects the new count
    SELECT public.can_receive_newsletter(test_user_id, 'Test Title', 'Test Content')
    INTO test_result;
    
    IF (test_result->>'current_count')::INTEGER = after_increment_count THEN
        RAISE NOTICE '✓ TEST 5 VERIFIED: can_receive_newsletter reflects updated count (%)', 
            test_result->>'current_count';
    ELSE
        RAISE WARNING '⚠ TEST 5 WARNING: can_receive_newsletter count (%) does not match daily_counts (%)', 
            test_result->>'current_count',
            after_increment_count;
    END IF;
END $$;

-- Final summary message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All tests completed!';
    RAISE NOTICE '========================================';
END $$;
