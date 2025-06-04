-- Add email_alias column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_alias TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS email_domain TEXT DEFAULT 'newsletterhub.com';

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email_alias ON public.users(email_alias);

-- Update existing users with a default alias if needed
UPDATE public.users 
SET email_alias = id::TEXT || '.' || (SELECT md5(random()::TEXT))
WHERE email_alias IS NULL;
