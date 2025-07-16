-- Create skipped_newsletters table with the same structure as newsletters plus a reason column
CREATE TABLE IF NOT EXISTS public.skipped_newsletters (
    -- Same columns as newsletters table
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    summary TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_liked BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    newsletter_source_id UUID REFERENCES public.newsletter_sources(id) ON DELETE SET NULL,
    is_archived BOOLEAN DEFAULT false,
    word_count INTEGER,
    estimated_read_time INTEGER,
    
    -- Additional columns for skipped newsletters
    skip_reason TEXT NOT NULL,
    skip_details JSONB,
    
    -- Add indexes for common queries
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_skipped_newsletters_user_id ON public.skipped_newsletters(user_id);
CREATE INDEX IF NOT EXISTS idx_skipped_newsletters_received_at ON public.skipped_newsletters(received_at);
CREATE INDEX IF NOT EXISTS idx_skipped_newsletters_skip_reason ON public.skipped_newsletters(skip_reason);

-- Set up RLS policies
ALTER TABLE public.skipped_newsletters ENABLE ROW LEVEL SECURITY;

-- Users can see their own skipped newsletters
CREATE POLICY "Users can view their own skipped newsletters"
    ON public.skipped_newsletters
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for admin purposes)
CREATE POLICY "Service role has full access to skipped newsletters"
    ON public.skipped_newsletters
    USING (auth.role() = 'service_role');

-- Function to move a newsletter to skipped
CREATE OR REPLACE FUNCTION public.move_to_skipped(
    p_newsletter_id UUID,
    p_reason TEXT,
    p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.skipped_newsletters
    SELECT 
        n.*,
        p_reason as skip_reason,
        p_details as skip_details
    FROM public.newsletters n
    WHERE n.id = p_newsletter_id
    AND n.user_id = auth.uid();
    
    DELETE FROM public.newsletters WHERE id = p_newsletter_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
