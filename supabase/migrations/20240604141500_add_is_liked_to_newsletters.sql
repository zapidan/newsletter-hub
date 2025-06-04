-- Add is_liked column to newsletters table
ALTER TABLE public.newsletters 
ADD COLUMN IF NOT EXISTS is_liked BOOLEAN DEFAULT FALSE;

-- Create index for better performance when filtering by is_liked
CREATE INDEX IF NOT EXISTS idx_newsletters_is_liked 
ON public.newsletters(user_id, is_liked) 
WHERE is_liked = TRUE;

-- Update RLS policies to include is_liked
-- (No need to update policies as we're just adding a column to an existing table)
