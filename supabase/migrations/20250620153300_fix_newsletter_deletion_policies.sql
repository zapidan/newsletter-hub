-- First, enable row level security if not already enabled
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'newsletters' 
    AND policyname = 'Enable delete for users based on user_id'
  ) THEN
    DROP POLICY "Enable delete for users based on user_id" ON public.newsletters;
  END IF;
END $$;

-- Create a function to check user permissions
CREATE OR REPLACE FUNCTION public.can_delete_newsletter(p_newsletter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_newsletter_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Get the user_id of the newsletter
  SELECT user_id INTO v_newsletter_user_id 
  FROM public.newsletters 
  WHERE id = p_newsletter_id;
  
  -- Allow delete if the current user owns the newsletter
  RETURN (v_user_id = v_newsletter_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_delete_newsletter(UUID) TO authenticated;

-- Create the policy using the function
CREATE POLICY "Enable delete for users based on user_id"
ON public.newsletters
FOR DELETE
TO authenticated
USING (public.can_delete_newsletter(id));

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'newsletters' AND cmd = 'DELETE';
