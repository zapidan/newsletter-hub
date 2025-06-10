-- Add missing SELECT policy for reading_queue
CREATE POLICY "Users can select from their reading queue" 
  ON public.reading_queue 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Add missing UPDATE policy for reading_queue
CREATE POLICY "Users can update their reading queue" 
  ON public.reading_queue 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop the old SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view their reading queue" ON public.reading_queue;
