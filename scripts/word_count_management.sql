-- Word Count Management Scripts
-- This file contains scripts for managing word counts in existing newsletters

-- ============================================================================
-- CURRENT STATE ANALYSIS
-- ============================================================================

-- Check current word count statistics
SELECT 
    COUNT(*) as total_newsletters,
    COUNT(CASE WHEN word_count > 0 THEN 1 END) as with_word_count,
    COUNT(CASE WHEN word_count = 0 OR word_count IS NULL THEN 1 END) as missing_word_count,
    ROUND(AVG(word_count), 2) as avg_word_count,
    MIN(word_count) as min_word_count,
    MAX(word_count) as max_word_count,
    ROUND(AVG(estimated_read_time), 2) as avg_read_time
FROM newsletters 
WHERE content IS NOT NULL;

-- Find suspicious word counts (more than 30% difference)
-- Note: This now requires a specific user UUID instead of 'all-users'
-- You can get user IDs from: SELECT id, email FROM auth.users;
SELECT 
    COUNT(*) as suspicious_count,
    ROUND(AVG(difference_percentage), 2) as avg_difference,
    MAX(difference_percentage) as max_difference
FROM find_suspicious_word_counts('123e4567-e89b-12d3-a456-426614174000'::UUID, 0.3);

-- Word count distribution (for your filter idea)
SELECT 
    CASE 
        WHEN word_count < 100 THEN 'Short (< 100 words)'
        WHEN word_count < 500 THEN 'Medium (100-500 words)'
        WHEN word_count < 1000 THEN 'Long (500-1000 words)'
        WHEN word_count < 2000 THEN 'Very Long (1000-2000 words)'
        ELSE 'Extremely Long (> 2000 words)'
    END as length_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
    ROUND(AVG(estimated_read_time), 2) as avg_read_time_minutes
FROM newsletters 
WHERE content IS NOT NULL AND word_count > 0
GROUP BY length_category
ORDER BY 
    CASE 
        WHEN word_count < 100 THEN 1
        WHEN word_count < 500 THEN 2
        WHEN word_count < 1000 THEN 3
        WHEN word_count < 2000 THEN 4
        ELSE 5
    END;

-- ============================================================================
-- BULK UPDATE SCRIPTS
-- ============================================================================

-- Script 1: Update newsletters with missing word counts
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Get newsletters with missing or zero word counts
    SELECT array_agg(id) INTO v_count
    FROM newsletters 
    WHERE content IS NOT NULL 
    AND (word_count = 0 OR word_count IS NULL);
    
    IF v_count IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_count);
        RAISE NOTICE 'Updated % newsletters with missing word counts', array_length(v_count, 1);
    ELSE
        RAISE NOTICE 'No newsletters with missing word counts found';
    END IF;
END $$;

-- Script 2: Update suspicious word counts (conservative approach)
DO $$
DECLARE
    v_suspicious_ids UUID[];
    v_count INTEGER;
BEGIN
    -- Get newsletters with suspicious word counts (50%+ difference)
    -- Note: This now requires a specific user UUID instead of 'all-users'
    SELECT array_agg(newsletter_id) INTO v_suspicious_ids
    FROM find_suspicious_word_counts('123e4567-e89b-12d3-a456-426614174000'::UUID, 0.5);
    
    IF v_suspicious_ids IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_suspicious_ids);
        RAISE NOTICE 'Updated % suspicious newsletters', array_length(v_suspicious_ids, 1);
    ELSE
        RAISE NOTICE 'No suspicious newsletters found';
    END IF;
END $$;

-- Script 3: Update all newsletters for a specific user
DO $$
DECLARE
    v_user_id TEXT := 'your-user-id-here'; -- Replace with actual user ID
    v_newsletter_ids UUID[];
    v_count INTEGER;
BEGIN
    -- Get all newsletters for the user
    SELECT array_agg(id) INTO v_newsletter_ids
    FROM newsletters 
    WHERE user_id = v_user_id 
    AND content IS NOT NULL;
    
    IF v_newsletter_ids IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_newsletter_ids);
        RAISE NOTICE 'Updated % newsletters for user %', array_length(v_newsletter_ids, 1), v_user_id;
    ELSE
        RAISE NOTICE 'No newsletters found for user %', v_user_id;
    END IF;
END $$;

-- Script 4: Gradual bulk update (process in batches to avoid performance issues)
DO $$
DECLARE
    v_batch_size INTEGER := 100;
    v_offset INTEGER := 0;
    v_batch_ids UUID[];
    v_total_updated INTEGER := 0;
    v_batch_count INTEGER;
BEGIN
    LOOP
        -- Get a batch of newsletters
        SELECT array_agg(id) INTO v_batch_ids
        FROM newsletters 
        WHERE content IS NOT NULL 
        AND id NOT IN (
            SELECT id FROM newsletters 
            WHERE word_count > 0 
            AND estimated_read_time > 0
        )
        LIMIT v_batch_size OFFSET v_offset;
        
        EXIT WHEN v_batch_ids IS NULL;
        
        -- Update the batch
        SELECT updated_count INTO v_batch_count
        FROM batch_update_newsletter_word_counts(v_batch_ids);
        
        v_total_updated := v_total_updated + COALESCE(v_batch_count, 0);
        v_offset := v_offset + v_batch_size;
        
        RAISE NOTICE 'Batch %: Updated % newsletters (total: %)', 
                    (v_offset / v_batch_size), 
                    COALESCE(v_batch_count, 0), 
                    v_total_updated;
        
        -- Small delay to avoid overwhelming the database
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RAISE NOTICE 'Bulk update completed. Total newsletters updated: %', v_total_updated;
END $$;

-- ============================================================================
-- QUALITY ASSURANCE SCRIPTS
-- ============================================================================

-- Find newsletters that might need manual review
SELECT 
    n.id,
    n.title,
    n.word_count as stored_count,
    public.calculate_word_count(n.content) as calculated_count,
    ABS(n.word_count - public.calculate_word_count(n.content)) as difference,
    ROUND(ABS(n.word_count - public.calculate_word_count(n.content))::NUMERIC / NULLIF(n.word_count, 0) * 100, 2) as difference_percentage,
    LENGTH(n.content) as content_length,
    n.created_at
FROM newsletters n
WHERE n.content IS NOT NULL
AND n.word_count IS NOT NULL
AND ABS(n.word_count - public.calculate_word_count(n.content))::NUMERIC / NULLIF(n.word_count, 0) > 0.5
ORDER BY difference_percentage DESC
LIMIT 20;

-- Check for potential issues with specific newsletter sources
SELECT 
    ns.name as source_name,
    ns."from" as source_email,
    COUNT(*) as newsletter_count,
    ROUND(AVG(n.word_count), 2) as avg_word_count,
    COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) as missing_count,
    ROUND(COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) * 100.0 / COUNT(*), 2) as missing_percentage
FROM newsletters n
JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
WHERE n.content IS NOT NULL
GROUP BY ns.id, ns.name, ns."from"
HAVING COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) > 0
ORDER BY missing_percentage DESC;

-- ============================================================================
-- READING LENGTH FILTER PREPARATION
-- ============================================================================

-- This query prepares data for your reading length filter idea
-- It shows how newsletters would be categorized for filtering

WITH reading_categories AS (
    SELECT 
        id,
        title,
        word_count,
        estimated_read_time,
        CASE 
            WHEN estimated_read_time <= 2 THEN 'Quick Read (≤2 min)'
            WHEN estimated_read_time <= 5 THEN 'Short Read (2-5 min)'
            WHEN estimated_read_time <= 10 THEN 'Medium Read (5-10 min)'
            WHEN estimated_read_time <= 20 THEN 'Long Read (10-20 min)'
            ELSE 'Deep Read (>20 min)'
        END as reading_category,
        user_id
    FROM newsletters 
    WHERE content IS NOT NULL AND word_count > 0
)
SELECT 
    reading_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
    ROUND(AVG(estimated_read_time), 2) as avg_read_time,
    ROUND(AVG(word_count), 2) as avg_word_count
FROM reading_categories
GROUP BY reading_category
ORDER BY 
    CASE 
        WHEN reading_category = 'Quick Read (≤2 min)' THEN 1
        WHEN reading_category = 'Short Read (2-5 min)' THEN 2
        WHEN reading_category = 'Medium Read (5-10 min)' THEN 3
        WHEN reading_category = 'Long Read (10-20 min)' THEN 4
        WHEN reading_category = 'Deep Read (>20 min)' THEN 5
    END;

-- Example of how to filter by reading length for a user
SELECT 
    id,
    title,
    estimated_read_time,
    word_count,
    CASE 
        WHEN estimated_read_time <= 2 THEN 'Quick Read'
        WHEN estimated_read_time <= 5 THEN 'Short Read'
        WHEN estimated_read_time <= 10 THEN 'Medium Read'
        WHEN estimated_read_time <= 20 THEN 'Long Read'
        ELSE 'Deep Read'
    END as reading_category
FROM newsletters 
WHERE user_id = 'your-user-id-here'
AND content IS NOT NULL 
AND word_count > 0
AND estimated_read_time BETWEEN 5 AND 15 -- Medium reads only
ORDER BY estimated_read_time;

-- ============================================================================
-- MAINTENANCE SCHEDULING
-- ============================================================================

-- Recommended maintenance schedule (run these periodically):

-- Weekly: Check for suspicious word counts
-- Note: Replace with actual user UUID from your database
-- SELECT * FROM find_suspicious_word_counts('123e4567-e89b-12d3-a456-426614174000'::UUID, 0.3) LIMIT 50;

-- Monthly: Update newsletters with missing word counts
-- (Run Script 1 from above)

-- Quarterly: Full quality check and bulk update if needed
-- (Run Scripts 2 and 4 from above)

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- Monitor word count calculation performance
EXPLAIN ANALYZE 
SELECT 
    id,
    public.calculate_word_count(content) as calculated_count,
    public.calculate_word_count(content) / 200.0 as read_time
FROM newsletters 
WHERE content IS NOT NULL 
LIMIT 100;

-- Check index usage for word count queries
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM newsletters 
WHERE user_id = 'test-user-id' 
AND word_count BETWEEN 100 AND 500;
