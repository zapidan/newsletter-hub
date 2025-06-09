-- Create newsletter_source_groups table
CREATE TABLE IF NOT EXISTS public.newsletter_source_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create newsletter_source_group_members join table
CREATE TABLE IF NOT EXISTS public.newsletter_source_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES newsletter_source_groups(id) ON DELETE CASCADE,
  source_id UUID REFERENCES newsletter_sources(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, source_id)
);

-- Enable RLS on both tables
ALTER TABLE public.newsletter_source_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_source_group_members ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_newsletter_source_groups_user_id ON public.newsletter_source_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_source_group_members_group_id ON public.newsletter_source_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_source_group_members_source_id ON public.newsletter_source_group_members(source_id);

-- RLS Policies for newsletter_source_groups
CREATE POLICY "Users can view their own groups"
  ON public.newsletter_source_groups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups"
  ON public.newsletter_source_groups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
  ON public.newsletter_source_groups
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups"
  ON public.newsletter_source_groups
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for newsletter_source_group_members
CREATE POLICY "Users can view members of their groups"
  ON public.newsletter_source_group_members
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_source_groups g 
    WHERE g.id = group_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can add members to their groups"
  ON public.newsletter_source_group_members
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.newsletter_source_groups g 
    WHERE g.id = group_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can remove members from their groups"
  ON public.newsletter_source_group_members
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_source_groups g 
    WHERE g.id = group_id AND g.user_id = auth.uid()
  ));

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update the updated_at column
CREATE TRIGGER update_newsletter_source_groups_updated_at
BEFORE UPDATE ON public.newsletter_source_groups
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
