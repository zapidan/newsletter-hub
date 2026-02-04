-- ===================================================================
-- ADD: Weekly Duplicate Cleanup Cron Job
-- ===================================================================
-- This migration adds a scheduled job to automatically clean up duplicate newsletters
-- on a weekly basis. It uses the existing clean_duplicate_newsletters function.
-- ===================================================================

-- Create a function to safely clean up duplicates with error handling
CREATE OR REPLACE FUNCTION public.safe_clean_duplicate_newsletters()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Run the cleanup in dry-run mode first to check for duplicates
    result := public.clean_duplicate_newsletters(TRUE);
    
    -- If duplicates were found, run the actual cleanup
    IF (result->>'duplicates_found')::BOOLEAN = TRUE THEN
        result := public.clean_duplicate_newsletters(FALSE);
        RAISE NOTICE 'Cleaned up % duplicate newsletters', (result->>'duplicates_removed')::INTEGER;
    ELSE
        RAISE NOTICE 'No duplicates found to clean up';
    END IF;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'detail', SQLSTATE,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.safe_clean_duplicate_newsletters() TO service_role;

-- Schedule the job to run every Sunday at 3:00 AM UTC
-- This time was chosen because:
-- 1. It's a low-traffic time for most users
-- 2. It doesn't conflict with the daily reset at midnight
-- 3. It's outside of typical business hours in most timezones
SELECT cron.schedule(
    'weekly-duplicate-cleanup',  -- name of the cron job
    '0 3 * * 0',                -- At 03:00 on Sunday (0 = Sunday, 1 = Monday, etc.)
    $$SELECT public.safe_clean_duplicate_newsletters()$$  -- the query to run
);

-- Weekly duplicate cleanup job runs every Sunday at 03:00 UTC
-- to clean up duplicate newsletters using clean_duplicate_newsletters()

-- ===================================================================
-- MANUAL TESTING INSTRUCTIONS
-- ===================================================================
-- To manually test the job (run this in the SQL Editor):
-- SELECT cron.run(jobid) FROM cron.job WHERE jobname = 'weekly-duplicate-cleanup';
--
-- To see the job status:
-- SELECT * FROM cron.job WHERE jobname = 'weekly-duplicate-cleanup';
--
-- To unschedule the job (if needed):
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-duplicate-cleanup';
-- ===================================================================
