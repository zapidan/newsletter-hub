-- Create newsletter_sources table
CREATE TABLE IF NOT EXISTS public.newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- Enable Row Level Security
ALTER TABLE public.newsletter_sources ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own newsletter sources"
  ON public.newsletter_sources
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own newsletter sources"
  ON public.newsletter_sources
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own newsletter sources"
  ON public.newsletter_sources
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own newsletter sources"
  ON public.newsletter_sources
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_newsletter_sources_updated_at
BEFORE UPDATE ON public.newsletter_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- Add newsletter_source_id column to newsletters table
ALTER TABLE public.newsletters 
ADD COLUMN IF NOT EXISTS newsletter_source_id UUID 
REFERENCES public.newsletter_sources(id) 
ON DELETE SET NULL;
