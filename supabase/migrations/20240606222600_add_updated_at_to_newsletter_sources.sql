-- Add updated_at column to newsletter_sources if it doesn't exist
ALTER TABLE newsletter_sources 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_newsletter_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists to avoid duplicates
DROP TRIGGER IF EXISTS set_newsletter_sources_updated_at ON newsletter_sources;

-- Create the trigger
CREATE TRIGGER set_newsletter_sources_updated_at
BEFORE UPDATE ON newsletter_sources
FOR EACH ROW
EXECUTE FUNCTION update_newsletter_sources_updated_at();

-- Update existing rows to have the current timestamp
UPDATE newsletter_sources 
SET updated_at = NOW() 
WHERE updated_at IS NULL;
