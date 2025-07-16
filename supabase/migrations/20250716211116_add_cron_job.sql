-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres, service_role;

-- Create a function to safely reset daily counts with error handling
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

-- Schedule the job to run daily at 00:00 UTC (midnight)
-- Note: In Supabase, you'll need to run this in the SQL Editor
-- or set it up through the Dashboard -> Database -> Extensions -> pg_cron
SELECT cron.schedule(
    'reset-daily-counts', -- name of the cron job
    '0 0 * * *',         -- every day at midnight UTC
    $$SELECT public.safe_reset_daily_counts()$$  -- the query to run
);

-- Verify the job was created
SELECT * FROM cron.job;

-- To manually test the job (run this in the SQL Editor):
-- SELECT cron.run(jobid) FROM cron.job WHERE jobname = 'reset-daily-counts';

-- To unschedule the job (if needed):
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reset-daily-counts';
