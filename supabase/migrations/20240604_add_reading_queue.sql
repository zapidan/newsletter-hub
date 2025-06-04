-- Create reading_queue table
CREATE TABLE IF NOT EXISTS public.reading_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, newsletter_id)
);

-- Enable RLS
ALTER TABLE public.reading_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their reading queue" 
  ON public.reading_queue 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their reading queue" 
  ON public.reading_queue 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their reading queue" 
  ON public.reading_queue 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_reading_queue_user_id ON public.reading_queue(user_id);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_reading_queue_updated_at
BEFORE UPDATE ON public.reading_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
