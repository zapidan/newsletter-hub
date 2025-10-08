-- Create a more accurate word count function
CREATE OR REPLACE FUNCTION public.calculate_word_count(content TEXT) 
RETURNS INTEGER AS $func$
DECLARE
  clean_text TEXT;
  word_array TEXT[];
BEGIN
  IF content IS NULL OR content = '' THEN
    RETURN 0;
  END IF;
  
  clean_text := content;
  
  IF position('<body' in lower(clean_text)) > 0 THEN
    clean_text := regexp_replace(clean_text, $re$^.*?<body[^>]*>$re$, '', 'nis');
    clean_text := regexp_replace(clean_text, $re$</body>.*$re$, '', 'nis');
  END IF;
  
  clean_text := regexp_replace(clean_text, $re$<!--.*?-->$re$, ' ', 'ng');
  clean_text := regexp_replace(clean_text, $re$<script[^>]*>.*?</script>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<style[^>]*>.*?</style>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<[^>]*>$re$, ' ', 'ng');
  clean_text := regexp_replace(clean_text, $re$&[#a-zA-Z0-9]+;$re$, ' ', 'g');
  clean_text := regexp_replace(clean_text, $re$https?://\S+$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\S+@\S+\.\S+$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\b\w{25,}\b$re$, ' ', 'g');
  
  -- Remove words with 4+ consecutive digits
  clean_text := regexp_replace(clean_text, $re$\w*[0-9]{4,}\w*$re$, ' ', 'g');
  
  clean_text := regexp_replace(clean_text, $re$[^a-zA-Z\s'\-]$re$, ' ', 'g');
  
  -- Remove single letters except a, A, I
  clean_text := regexp_replace(clean_text, $re$\b[b-hj-zB-HJ-Z]\b$re$, ' ', 'g');
  
  clean_text := regexp_replace(clean_text, $re$\s+$re$, ' ', 'g');
  clean_text := trim(clean_text);
  
  IF clean_text = '' THEN
    RETURN 0;
  END IF;
  
  word_array := regexp_split_to_array(clean_text, $re$\s+$re$);
  RETURN COALESCE(array_length(word_array, 1), 0);
END;
$func$ LANGUAGE plpgsql STABLE;

-- Create a function to update both word count and read time
CREATE OR REPLACE FUNCTION public.update_newsletter_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.content IS DISTINCT FROM OLD.content)) THEN
    NEW.word_count := public.calculate_word_count(NEW.content);
    -- Standard reading speed is 200 words per minute, with minimum 1 minute
    NEW.estimated_read_time := GREATEST(1, ROUND(public.calculate_word_count(NEW.content) / 200.0));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new newsletters
CREATE OR REPLACE TRIGGER trg_insert_newsletter_metrics
BEFORE INSERT ON public.newsletters
FOR EACH ROW
EXECUTE FUNCTION public.update_newsletter_metrics();

-- -- Create trigger for updated newsletters
-- CREATE OR REPLACE TRIGGER trg_update_newsletter_metrics
-- BEFORE UPDATE ON public.newsletters
-- FOR EACH ROW
-- WHEN (NEW.content IS DISTINCT FROM OLD.content)
-- EXECUTE FUNCTION public.update_newsletter_metrics();

-- Update existing records (in batches to avoid locking)
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  updated_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  LOOP
    -- Use GET DIAGNOSTICS to get the count of updated rows
    WITH batch AS (
      SELECT id, content
      FROM public.newsletters
      ORDER BY id
      LIMIT batch_size OFFSET offset_val
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.newsletters n
    SET 
      word_count = public.calculate_word_count(b.content),
      estimated_read_time = GREATEST(1, CEIL(public.calculate_word_count(b.content) / 200.0))
    FROM batch b
    WHERE n.id = b.id;
    
    -- Get the number of rows affected by the last SQL statement
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    EXIT WHEN updated_count = 0;
    
    total_updated := total_updated + updated_count;
    RAISE NOTICE 'Updated % newsletters (total: %)', updated_count, total_updated;
    
    offset_val := offset_val + batch_size;
    COMMIT;
  END LOOP;
END $$;

-- Add a comment to explain the function
COMMENT ON FUNCTION public.calculate_word_count(TEXT) IS 
'Calculates the number of words in the given HTML content by:
1. Removing HTML comments, scripts, and styles
2. Stripping all HTML tags
3. Replacing HTML entities
4. Counting sequences of non-whitespace characters';

-- Verify the function works with a test case
DO $$
BEGIN
  -- This should return 6 (the number of words in the test string)
  IF public.calculate_word_count('<p>This is a <strong>test</strong> string.</p>') != 6 THEN
    RAISE EXCEPTION 'Word count function test failed';
  END IF;
  
  RAISE NOTICE 'Word count function test passed';
END $$;
