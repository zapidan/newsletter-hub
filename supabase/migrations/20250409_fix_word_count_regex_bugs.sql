-- Fix word count calculation regex bugs
-- Migration: 20250409_fix_word_count_regex_bugs.sql
-- Description: Remove end-of-line anchors ($) from URL and email regex patterns
-- to properly remove URLs and emails that appear in the middle of text.
-- Also improve URL regex to handle trailing punctuation.

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
    clean_text := regexp_replace(clean_text, $re$^.*?<body[^>]*>$re$, '', 'i');
    clean_text := regexp_replace(clean_text, $re$</body>.*$re$, '', 'i');
  END IF;

  -- Remove HTML comments, scripts, and styles
  clean_text := regexp_replace(clean_text, $re$<!--.*?-->$re$, ' ', 'g');
  clean_text := regexp_replace(clean_text, $re$<script[^>]*>.*?</script>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<style[^>]*>.*?</style>$re$, ' ', 'gi');

  -- Remove advertisement and sponsored content (keyword match)
  clean_text := regexp_replace(clean_text, $re$(advertisement|sponsored|promoted|ad\s*content|paid\s*promotion)$re$, ' ', 'gi');

  -- Remove ad containers per element type to prevent cross-tag over-consumption
  clean_text := regexp_replace(clean_text, $re$<div[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</div>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<span[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</span>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<p[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</p>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<section[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</section>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<aside[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</aside>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<footer[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</footer>$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$<header[^>]* (?:class|id)=['"][^'"]*(?:ad|advertisement|sponsored|promoted|promo)[^'"]*['"][^>]*>.*?</header>$re$, ' ', 'gi');

  -- Remove common ad patterns
  clean_text := regexp_replace(clean_text, $re$\b(click\s*here|buy\s*now|shop\s*now|limited\s*time|special\s*offer|act\s*now|don't\s*miss)\b$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\b(unsubscribe|opt\s*out|preferences|privacy\s*policy|terms\s*of\s*service)\b$re$, ' ', 'gi');

  -- Strip all remaining HTML tags
  clean_text := regexp_replace(clean_text, $re$<[^>]*>$re$, ' ', 'g');

  -- Replace HTML entities
  clean_text := regexp_replace(clean_text, $re$&[#a-zA-Z0-9]+;$re$, ' ', 'g');

  -- Remove URLs and email addresses (FIXED: removed $ anchor to match anywhere in text)
  -- Improved URL regex to handle trailing punctuation
  clean_text := regexp_replace(clean_text, $re$https?://[^\s'"<>]+(?:[.!?;,)]|$)?$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$mailto:[^\s'"<>]+(?:[.!?;,)]|$)?$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[.!?;,)]|$)?$re$, ' ', 'gi');

  clean_text := regexp_replace(clean_text, $re$\b\w{25,}\b$re$, ' ', 'g');

  -- Improved numeric handling: keep years (1900-2099) and common numbers, remove others
  clean_text := regexp_replace(clean_text, $re$\b(?!19|20)\d{4,}\b$re$, ' ', 'g');
  clean_text := regexp_replace(clean_text, $re$\b\d{6,}\b$re$, ' ', 'g');

  -- Remove tracking codes and hex strings
  clean_text := regexp_replace(clean_text, $re$\b[a-f0-9]{8,}\b$re$, ' ', 'gi');
  clean_text := regexp_replace(clean_text, $re$\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b$re$, ' ', 'gi');

  -- Clean up non-alphabetic characters (keep letters, digits, underscores, apostrophes, hyphens)
  clean_text := regexp_replace(clean_text, $re$[^[:alpha:][:digit:]_\s'\-]$re$, ' ', 'g');

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

-- Update the comment to reflect the fixes
COMMENT ON FUNCTION public.calculate_word_count(TEXT) IS
'Calculates the number of words in HTML content with advanced filtering:
1. Removes HTML comments, scripts, styles, and ads
2. Filters out sponsored content and promotional text
3. Strips HTML tags and entities
4. Removes URLs and emails anywhere in text (fixed regex anchors)
5. Preserves years (1900-2099) while removing other long numbers
6. Removes tracking codes and very long words
7. Counts sequences of word characters (letters, digits, underscores) to match client-side validation';