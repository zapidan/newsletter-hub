-- Fix word count calculation to properly handle accented characters and match client-side validation
-- Migration: 20250221_fix_word_count_accented_chars.sql
-- Description: Update calculate_word_count function to use [:alpha:][:digit:]_ instead of a-zA-Z
-- to properly count words with accented characters and digits, maintaining consistency with client-side validation

-- Update the calculate_word_count function to include accented characters
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

  -- Extract content within body tags if present
  IF position('<body' in lower(clean_text)) > 0 THEN
    clean_text := regexp_replace(clean_text, $re$^.*?<body[^>]*>$re$, '', 'nis');
    clean_text := regexp_replace(clean_text, $re$</body>.*$re$, '', 'nis');
  END IF;

  -- Remove HTML comments, scripts, and styles
  clean_text := regexp_replace(clean_text, $re$<!--.*?-->$re$, ' ', 'ng');
  clean_text := regexp_replace(clean_text, $re$<script[^>]*>.*?</script>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<style[^>]*>.*?</style>$re$, ' ', 'nig');

  -- Remove advertisement and sponsored content
  clean_text := regexp_replace(clean_text, $re$(advertisement|sponsored|promoted|ad\s*content|paid\s*promotion)$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<div[^>]*class="[^"]*ad[^"]*"[^>]*>.*?</div>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<div[^>]*id="[^"]*ad[^"]*"[^>]*>.*?</div>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<span[^>]*class="[^"]*ad[^"]*"[^>]*>.*?</span>$re$, ' ', 'nig');
  clean_text := regexp_replace(clean_text, $re$<p[^>]*class="[^"]*ad[^"]*"[^>]*>.*?</p>$re$, ' ', 'nig');

  -- Remove common ad patterns
  clean_text := regexp_replace(clean_text, $re$(click\s*here|buy\s*now|shop\s*now|limited\s*time|special\s*offer|act\s*now|don't\s*miss)$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$(unsubscribe|opt\s*out|preferences|privacy\s*policy|terms\s*of\s*service)$re$, ' ', 'gi');

  -- Strip all remaining HTML tags
  clean_text := regexp_replace(clean_text, $re$<[^>]*>$re$, ' ', 'ng');

  -- Replace HTML entities
  clean_text := regexp_replace(clean_text, $re$&[#a-zA-Z0-9]+;$re$, ' ', 'g');

  -- Remove URLs and email addresses
  clean_text := regexp_replace(clean_text, $re$https?://\S+$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\S+@\S+\.\S+$re$, ' ', 'gi');

  -- Remove very long words (likely tracking codes or IDs)
  clean_text := regexp_replace(clean_text, $re$\b\w{25,}\b$re$, ' ', 'g');

  -- Improved numeric handling: keep years (1900-2099) and common numbers, remove others
  clean_text := regexp_replace(clean_text, $re$\b(?!19|20)\d{4,}\b$re$, ' ', 'g');
  clean_text := regexp_replace(clean_text, $re$\b\d{6,}\b$re$, ' ', 'g');

  -- Remove tracking codes and hex strings
  clean_text := regexp_replace(clean_text, $re$\b[a-f0-9]{8,}\b$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b$re$, ' ', 'gi');

  -- Clean up non-alphabetic characters (keep letters, digits, underscores, apostrophes, hyphens)
  -- CHANGED: Use [:alpha:][:digit:]_ instead of a-zA-Z to include accented characters and digits
  clean_text := regexp_replace(clean_text, $re$[^[:alpha:][:digit:]_\\s'\\-]$re$, ' ', 'g');

  -- Remove single letters except a, A, I
  clean_text := regexp_replace(clean_text, $re$\b[b-hj-zB-HJ-Z]\b$re$, ' ', 'g');

  -- Normalize whitespace
  clean_text := regexp_replace(clean_text, $re$\s+$re$, ' ', 'g');
  clean_text := trim(clean_text);

  IF clean_text = '' THEN
    RETURN 0;
  END IF;

  word_array := regexp_split_to_array(clean_text, $re$\s+$re$);
  RETURN COALESCE(array_length(word_array, 1), 0);
END;
$func$ LANGUAGE plpgsql STABLE;

-- Update the comment to reflect the fix
COMMENT ON FUNCTION public.calculate_word_count(TEXT) IS 
'Calculates the number of words in HTML content with advanced filtering:
1. Removes HTML comments, scripts, styles, and ads
2. Filters out sponsored content and promotional text
3. Strips HTML tags and entities
4. Preserves years (1900-2099) while removing other long numbers
5. Removes tracking codes and very long words
6. Counts sequences of word characters (letters, digits, underscores) to match client-side validation';

-- Test the fix with accented characters
DO $$
DECLARE
  test_content TEXT;
  expected_count INTEGER;
  actual_count INTEGER;
BEGIN
  -- Test with accented characters
  test_content := 'This is a café with naïve résumé.';
  expected_count := 7; -- "This is a café with naïve résumé"
  actual_count := public.calculate_word_count(test_content);
  IF actual_count != expected_count THEN
    RAISE EXCEPTION 'Accented character test failed: expected %, got %', expected_count, actual_count;
  END IF;

  -- Test mixed content
  test_content := 'Test with 2023 café and naïve résumé.';
  expected_count := 7; -- "Test with 2023 café and naïve résumé"
  actual_count := public.calculate_word_count(test_content);
  IF actual_count != expected_count THEN
    RAISE EXCEPTION 'Mixed content test failed: expected %, got %', expected_count, actual_count;
  END IF;

  RAISE NOTICE 'Word count accented character fix tests passed successfully!';
END $$;
