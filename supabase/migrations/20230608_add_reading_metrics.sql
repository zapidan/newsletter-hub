-- Add word_count and estimated_read_time columns to newsletters table
ALTER TABLE newsletters 
  ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_read_time INTEGER DEFAULT 1;

-- Update existing rows with default values
UPDATE newsletters 
SET 
  word_count = COALESCE(LENGTH(REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g')), 0),
  estimated_read_time = GREATEST(1, CEIL(LENGTH(REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g')) / 5 / 200.0));

-- Create an index for better performance on read time queries
CREATE INDEX IF NOT EXISTS idx_newsletters_read_time ON newsletters(estimated_read_time);
