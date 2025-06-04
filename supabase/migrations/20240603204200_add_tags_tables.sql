-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- Default blue color
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tag_name_per_user UNIQUE (name, user_id)
);

-- Create newsletter_tags join table
CREATE TABLE IF NOT EXISTS public.newsletter_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_newsletter_tag UNIQUE (newsletter_id, tag_id)
);

-- Enable RLS on tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on newsletter_tags table
ALTER TABLE public.newsletter_tags ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Users can view their own tags"
  ON public.tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON public.tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Newsletter tags policies
CREATE POLICY "Users can view their own newsletter tags"
  ON public.newsletter_tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own newsletter tags"
  ON public.newsletter_tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own newsletter tags"
  ON public.newsletter_tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_newsletter_id ON public.newsletter_tags(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_tag_id ON public.newsletter_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);

-- Create a function to automatically set the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at column on tags table
CREATE TRIGGER update_tags_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
