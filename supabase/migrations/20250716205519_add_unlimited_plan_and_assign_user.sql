-- Add unique constraint on the name column
ALTER TABLE public.subscription_plans 
ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);

-- Add Unlimited plan with very high limits (effectively unlimited)
INSERT INTO public.subscription_plans 
    (name, monthly_price, yearly_price, max_sources, max_newsletters_per_day) 
VALUES 
    ('Unlimited', 0, 0, 1000000, 1000000)
ON CONFLICT (name) DO UPDATE SET
    max_sources = EXCLUDED.max_sources,
    max_newsletters_per_day = EXCLUDED.max_newsletters_per_day,
    updated_at = timezone('utc'::text, now());

-- Assign the specified user to the Unlimited plan
WITH plan_id AS (
    SELECT id FROM public.subscription_plans WHERE name = 'Unlimited' LIMIT 1
)
INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    billing_cycle,
    status,
    current_period_start,
    current_period_end
)
SELECT 
    '16190e6c-2519-4c36-9178-71ce2843e59c',
    p.id,
    'monthly',
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now() + INTERVAL '100 years')
FROM plan_id p
ON CONFLICT (user_id) 
DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = timezone('utc'::text, now());

-- Create or update daily_counts for the user if it doesn't exist
INSERT INTO public.daily_counts (
    user_id,
    date,
    sources_count,
    newsletters_count
)
SELECT 
    '16190e6c-2519-4c36-9178-71ce2843e59c',
    timezone('utc'::text, now())::date,
    0,
    0
ON CONFLICT (user_id, date) DO NOTHING;
