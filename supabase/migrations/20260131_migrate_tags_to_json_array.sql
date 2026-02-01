-- Migrate Tags from N:M Relationship to JSON Array
-- This migration eliminates complex joins and improves performance significantly

-- Step 1: Add JSON array column to newsletters table
ALTER TABLE newsletters 
ADD COLUMN IF NOT EXISTS tags_json JSONB DEFAULT '[]'::jsonb;

-- Step 2: Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_newsletters_tags_json_gin 
ON newsletters USING GIN (tags_json);

-- Step 3: Create expression index for tag name searches
CREATE INDEX IF NOT EXISTS idx_newsletters_tag_names 
ON newsletters USING GIN ((tags_json->>'name'));

-- Step 4: Migrate existing data from N:M to JSON array
-- This creates a JSON array of tag objects for each newsletter
UPDATE newsletters n
SET tags_json = COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color,
        'user_id', t.user_id,
        'created_at', t.created_at
      ) ORDER BY t.name
    )
    FROM newsletter_tags nt
    JOIN tags t ON nt.tag_id = t.id
    WHERE nt.newsletter_id = n.id
  ),
  '[]'::jsonb
)
WHERE EXISTS (
  SELECT 1 FROM newsletter_tags nt 
  WHERE nt.newsletter_id = n.id
);

-- Step 5: Create optimized functions for tag operations

-- Function to get newsletters with specific tags (ANY match)
CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags_any(
  p_user_id UUID,
  p_tag_names TEXT[],
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'received_at',
  p_order_direction TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  newsletter_source_id UUID,
  word_count INTEGER,
  estimated_read_time INTEGER,
  is_read BOOLEAN,
  is_liked BOOLEAN,
  is_archived BOOLEAN,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  tags_json JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
  n.*,
  COUNT(*) OVER() as total_count
FROM newsletters n
WHERE n.user_id = p_user_id
AND n.tags_json ?| p_tag_names
ORDER BY 
  CASE 
    WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC' THEN n.received_at
    WHEN p_order_by = 'title' AND p_order_direction = 'ASC' THEN n.title
    WHEN p_order_by = 'created_at' AND p_order_direction = 'ASC' THEN n.created_at
    ELSE NULL
  END ASC,
  CASE 
    WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN n.received_at
    WHEN p_order_by = 'title' AND p_order_direction = 'DESC' THEN n.title
    WHEN p_order_by = 'created_at' AND p_order_direction = 'DESC' THEN n.created_at
    ELSE NULL
  END DESC
LIMIT p_limit
OFFSET p_offset;
$$;

-- Function to get newsletters with specific tags (ALL match)
CREATE OR REPLACE FUNCTION public.get_newsletters_by_tags_all(
  p_user_id UUID,
  p_tag_names TEXT[],
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'received_at',
  p_order_direction TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  newsletter_source_id UUID,
  word_count INTEGER,
  estimated_read_time INTEGER,
  is_read BOOLEAN,
  is_liked BOOLEAN,
  is_archived BOOLEAN,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  tags_json JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH filtered_newsletters AS (
  SELECT n.*, 
    (
      SELECT COUNT(*)
      FROM jsonb_array_elements(n.tags_json) as tag_elem
      WHERE tag_elem->>'name' = ANY(p_tag_names)
    ) as matched_tags_count
  FROM newsletters n
  WHERE n.user_id = p_user_id
)
SELECT 
  f.*,
  COUNT(*) OVER() as total_count
FROM filtered_newsletters f
WHERE f.matched_tags_count = cardinality(p_tag_names)
ORDER BY 
  CASE 
    WHEN p_order_by = 'received_at' AND p_order_direction = 'ASC' THEN f.received_at
    WHEN p_order_by = 'title' AND p_order_direction = 'ASC' THEN f.title
    WHEN p_order_by = 'created_at' AND p_order_direction = 'ASC' THEN f.created_at
    ELSE NULL
  END ASC,
  CASE 
    WHEN p_order_by = 'received_at' AND p_order_direction = 'DESC' THEN f.received_at
    WHEN p_order_by = 'title' AND p_order_direction = 'DESC' THEN f.title
    WHEN p_order_by = 'created_at' AND p_order_direction = 'DESC' THEN f.created_at
    ELSE NULL
  END DESC
LIMIT p_limit
OFFSET p_offset;
$$;

-- Function to count newsletters per tag
CREATE OR REPLACE FUNCTION public.get_tag_usage_stats(
  p_user_id UUID
)
RETURNS TABLE (
  tag_id UUID,
  tag_name TEXT,
  tag_color TEXT,
  newsletter_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
  tag_elem->>'id' as tag_id,
  tag_elem->>'name' as tag_name,
  tag_elem->>'color' as tag_color,
  COUNT(*) as newsletter_count
FROM newsletters n,
  jsonb_array_elements(n.tags_json) as tag_elem
WHERE n.user_id = p_user_id
GROUP BY tag_elem->>'id', tag_elem->>'name', tag_elem->>'color'
ORDER BY newsletter_count DESC, tag_name ASC;
$$;

-- Function to get all unique tags for a user
CREATE OR REPLACE FUNCTION public.get_user_tags(
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  color TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ,
  newsletter_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH unique_tags AS (
  SELECT DISTINCT 
    tag_elem->>'id' as id,
    tag_elem->>'name' as name,
    tag_elem->>'color' as color,
    tag_elem->>'user_id' as user_id,
    tag_elem->>'created_at' as created_at
  FROM newsletters n,
    jsonb_array_elements(n.tags_json) as tag_elem
  WHERE n.user_id = p_user_id
),
tag_counts AS (
  SELECT 
    tag_elem->>'id' as tag_id,
    COUNT(*) as newsletter_count
  FROM newsletters n,
    jsonb_array_elements(n.tags_json) as tag_elem
  WHERE n.user_id = p_user_id
  GROUP BY tag_elem->>'id'
)
SELECT 
  ut.*,
  COALESCE(tc.newsletter_count, 0) as newsletter_count
FROM unique_tags ut
LEFT JOIN tag_counts tc ON ut.id = tc.tag_id
ORDER BY ut.name ASC;
$$;

-- Step 6: Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_newsletters_by_tags_any TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_newsletters_by_tags_all TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tag_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tags TO authenticated;

-- Step 7: Create trigger to automatically update tags_json when newsletters change
CREATE OR REPLACE FUNCTION public.validate_tags_json()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure tags_json is always a valid JSON array
  IF NEW.tags_json IS NULL THEN
    NEW.tags_json = '[]'::jsonb;
  END IF;
  
  -- Ensure it's an array
  IF jsonb_typeof(NEW.tags_json) != 'array' THEN
    RAISE EXCEPTION 'tags_json must be a JSON array';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_newsletters_tags_json
  BEFORE INSERT OR UPDATE ON newsletters
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tags_json();

-- Step 8: Create view for backward compatibility during transition
CREATE OR REPLACE VIEW public.newsletters_with_tags_view AS
SELECT 
  n.id,
  n.title,
  n.content,
  n.summary,
  n.image_url,
  n.newsletter_source_id,
  n.word_count,
  n.estimated_read_time,
  n.is_read,
  n.is_liked,
  n.is_archived,
  n.received_at,
  n.created_at,
  n.updated_at,
  n.user_id,
  n.tags_json,
  -- Generate virtual newsletter_tags rows for compatibility
  (SELECT json_agg(
    json_build_object(
      'id', gen_random_uuid(),
      'newsletter_id', n.id,
      'tag_id', tag_elem->>'id',
      'user_id', n.user_id,
      'created_at', tag_elem->>'created_at'
    )
  ) FROM jsonb_array_elements(n.tags_json) as tag_elem) as virtual_newsletter_tags
FROM newsletters n;

-- Step 9: Add comment for documentation
COMMENT ON COLUMN newsletters.tags_json IS 'JSON array of tag objects. Replaces N:M relationship with newsletter_tags table for better performance.';
COMMENT ON FUNCTION public.get_newsletters_by_tags_any IS 'Get newsletters that have ANY of the specified tags. Much faster than traditional joins.';
COMMENT ON FUNCTION public.get_newsletters_by_tags_all IS 'Get newsletters that have ALL of the specified tags. Uses efficient JSON array operations.';
COMMENT ON FUNCTION public.get_tag_usage_stats IS 'Count newsletters per tag using JSON aggregation. Eliminates complex joins.';
COMMENT ON FUNCTION public.get_user_tags IS 'Get all unique tags for a user with usage counts. Single query operation.';
