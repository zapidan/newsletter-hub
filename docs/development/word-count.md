# Word Count Implementation Documentation

## Overview

This document explains the comprehensive word count system implemented in NewsletterHub, including the advanced calculation algorithm, helper functions, and integration points.

## Table of Contents

1. [Core Word Count Algorithm](#core-word-count-algorithm)
2. [Helper Functions](#helper-functions)
3. [Email Processing Integration](#email-processing-integration)
4. [Testing and Validation](#testing-and-validation)
5. [Client-Side Service (Currently Unused)](#client-side-service-currently-unused)
6. [Usage Examples](#usage-examples)

## Core Word Count Algorithm

### Function: `calculate_word_count(content TEXT)`

The core word count function uses a sophisticated multi-stage cleaning process to accurately count words in HTML newsletter content while filtering out noise and advertisements.

#### Algorithm Stages

1. **Initial Validation**

   ```sql
   IF content IS NULL OR content = '' THEN
     RETURN 0;
   END IF;
   ```

2. **Body Content Extraction**
   - Extracts content within `<body>` tags if present
   - Removes header, footer, and navigation elements

   ```sql
   IF position('<body' in lower(clean_text)) > 0 THEN
     clean_text := regexp_replace(clean_text, $re$^.*?<body[^>]*>$re$, '', 'nis');
     clean_text := regexp_replace(clean_text, $re$</body>.*$re$, '', 'nis');
   END IF;
   ```

3. **HTML Element Removal**
   - Removes HTML comments (`<!-- -->`)
   - Strips JavaScript (`<script>...</script>`)
   - Removes CSS styles (`<style>...</style>`)

   ```sql
   clean_text := regexp_replace(clean_text, $re$<!--.*?-->$re$, ' ', 'ng');
   clean_text := regexp_replace(clean_text, $re$<script[^>]*>.*?</script>$re$, ' ', 'nig');
   clean_text := regexp_replace(clean_text, $re$<style[^>]*>.*?</style>$re$, ' ', 'nig');
   ```

4. **Advertisement Detection and Removal**
   - Removes sponsored content markers
   - Filters out promotional text patterns
   - Eliminates ad containers by class/ID patterns

   ```sql
   -- Text-based ad detection
   clean_text := regexp_replace(clean_text, $re$(advertisement|sponsored|promoted|ad\s*content|paid\s*promotion)$re$, ' ', 'gi');

   -- HTML-based ad detection
   clean_text := regexp_replace(clean_text, $re$<div[^>]*class="[^"]*ad[^"]*"[^>]*>.*?</div>$re$, ' ', 'nig');
   clean_text := regexp_replace(clean_text, $re$<div[^>]*id="[^"]*ad[^"]*"[^>]*>.*?</div>$re$, ' ', 'nig');

   -- Promotional text patterns
   clean_text := regexp_replace(clean_text, $re$(click\s*here|buy\s*now|shop\s*now|limited\s*time|special\s*offer|act\s*now|don't\s*miss)$re$, ' ', 'gi');
   ```

5. **Content Cleaning**
   - Strips remaining HTML tags
   - Replaces HTML entities
   - Removes URLs and email addresses

   ```sql
   clean_text := regexp_replace(clean_text, $re$<[^>]*>$re$, ' ', 'ng');
   clean_text := regexp_replace(clean_text, $re$&[#a-zA-Z0-9]+;$re$, ' ', 'g');
   clean_text := regexp_replace(clean_text, $re$https?://\S+$re$, ' ', 'gi');
   clean_text := regexp_replace(clean_text, $re$\S+@\S+\.\S+$re$, ' ', 'gi');
   ```

6. **Tracking Code Removal**
   - Removes very long words (likely tracking codes)
   - Filters out numeric tracking IDs
   - Eliminates hexadecimal strings and UUIDs

   ```sql
   clean_text := regexp_replace(clean_text, $re$\b\w{25,}\b$re$, ' ', 'g');
   clean_text := regexp_replace(clean_text, $re$\b(?!19|20)\d{4,}\b$re$, ' ', 'g');
   clean_text := regexp_replace(clean_text, $re$\b[a-f0-9]{8,}\b$re$, ' ', 'gi');
   ```

7. **Text Normalization**
   - Keeps only letters, apostrophes, and hyphens
   - Removes single letters (except 'a', 'A', 'I')
   - Normalizes whitespace

   ```sql
   clean_text := regexp_replace(clean_text, $re$[^a-zA-Z\s'\-]$re$, ' ', 'g');
   clean_text := regexp_replace(clean_text, $re$\b[b-hj-zB-HJ-Z]\b$re$, ' ', 'g');
   clean_text := regexp_replace(clean_text, $re$\s+$re$, ' ', 'g');
   ```

8. **Word Counting**
   - Splits text on whitespace
   - Returns the count of resulting words
   ```sql
   word_array := regexp_split_to_array(clean_text, $re$\s+$re$);
   RETURN COALESCE(array_length(word_array, 1), 0);
   ```

## Helper Functions

### 1. Single Newsletter Update

```sql
update_newsletter_word_count(p_newsletter_id UUID)
```

**Purpose**: Updates word count and estimated read time for a single newsletter.

**Process**:

1. Calculates word count using `calculate_word_count()`
2. Updates `word_count` field
3. Calculates and updates `estimated_read_time` (words ÷ 200, minimum 1 minute)
4. Updates `updated_at` timestamp

**Usage**:

```sql
SELECT update_newsletter_word_count('newsletter-uuid-here');
```

### 2. Batch Update

```sql
batch_update_newsletter_word_counts(newsletter_ids UUID[])
```

**Purpose**: Efficiently updates multiple newsletters in a single operation.

**Process**:

1. Updates all specified newsletters that have content
2. Returns the count of updated newsletters
3. Uses `GET DIAGNOSTICS` for accurate counting

**Usage**:

```sql
SELECT * FROM batch_update_newsletter_word_counts(ARRAY['uuid1', 'uuid2', 'uuid3']);
```

### 3. Statistics

```sql
get_word_count_stats(p_user_id TEXT)
```

**Purpose**: Provides comprehensive word count statistics for a user.

**Returns**:

- `total_newsletters`: Count of newsletters with word counts
- `avg_word_count`: Average word count (rounded to 2 decimals)
- `median_word_count`: Median word count using percentile calculation
- `min_word_count`: Minimum word count
- `max_word_count`: Maximum word count

**Usage**:

```sql
SELECT * FROM get_word_count_stats('user-id-here');
```

### 4. Quality Assurance

```sql
find_suspicious_word_counts(p_user_id TEXT, p_threshold NUMERIC DEFAULT 0.3)
```

**Purpose**: Identifies newsletters where stored word counts differ significantly from calculated values.

**Process**:

1. Recalculates word counts for all user newsletters
2. Compares with stored values
3. Returns those exceeding the difference threshold
4. Ordered by difference percentage (highest first)

**Usage**:

```sql
-- Find newsletters with 30%+ difference
SELECT * FROM find_suspicious_word_counts('user-id-here', 0.3);

-- Find newsletters with 50%+ difference
SELECT * FROM find_suspicious_word_counts('user-id-here', 0.5);
```

## Email Processing Integration

### Primary Function: `handle_incoming_email()`

The main email processing function has been standardized to use the advanced word count algorithm:

```sql
CREATE OR REPLACE FUNCTION public.handle_incoming_email(
    p_from_email TEXT,
    p_subject TEXT,
    p_content TEXT,
    p_received_at TIMESTAMPTZ DEFAULT NOW(),
    p_user_id TEXT DEFAULT NULL
) RETURNS UUID
```

**Integration Points**:

1. **Word Count Calculation**:

   ```sql
   v_word_count := public.calculate_word_count(p_content);
   v_estimated_read_time := GREATEST(1, CEIL(v_word_count / 200.0));
   ```

2. **Newsletter Creation**:

   ```sql
   INSERT INTO public.newsletters (
       -- ... other fields ...
       word_count,
       estimated_read_time,
       -- ... other fields ...
   ) VALUES (
       -- ... other values ...
       v_word_count,
       v_estimated_read_time,
       -- ... other values ...
   )
   ```

3. **Title Processing**:
   - Removes common email prefixes (Re:, Fwd:, FW:)
   - Trims and validates subject lines

### Secondary Function: `process_email()`

A secondary email processing function is also updated if it exists, ensuring consistency across all email processing pathways.

## Performance Considerations

### Database Indexes

Two performance indexes are created:

```sql
-- Single word count queries
CREATE INDEX idx_newsletters_word_count ON newsletters(word_count);

-- User-scoped word count queries
CREATE INDEX idx_newsletters_user_word_count ON newsletters(user_id, word_count);
```

### Function Performance

- **STABLE Declaration**: The `calculate_word_count()` function is marked as `STABLE` since it returns the same result for the same input
- **Efficient Regex**: Uses compiled regular expressions with appropriate flags
- **Early Returns**: Returns early for empty/null content
- **Minimal Memory**: Processes text in place without creating large intermediate structures

### Batch Processing

- Use `batch_update_newsletter_word_counts()` for multiple updates
- Avoid calling `update_newsletter_word_count()` in loops
- Consider processing in batches of 100-1000 newsletters at a time

## Testing and Validation

### Automated Test Suite

The migration includes comprehensive tests covering:

1. **Basic HTML Processing**:

   ```sql
   test_content := '<p>This is a <strong>test</strong> string.</p>';
   expected_count := 6; -- "This is a test string"
   ```

2. **Advertisement Filtering**:

   ```sql
   test_content := '<p>Real content.</p><div class="ad">Buy now! Special offer!</div>';
   expected_count := 2; -- "Real content"
   ```

3. **Year Preservation**:

   ```sql
   test_content := '<p>In 2023 we started. The project ends in 2025.</p>';
   expected_count := 7; -- Years are preserved
   ```

4. **Tracking Code Removal**:

   ```sql
   test_content := '<p>Content with tracking 1234567890 and abcdef1234567890.</p>';
   expected_count := 4; -- Tracking codes removed
   ```

5. **Email Processing Integration**:
   - Tests the complete email processing pipeline
   - Verifies word count calculation in newsletter creation
   - Validates ad content exclusion

### Manual Testing

For manual validation, use these queries:

```sql
-- Test specific content
SELECT calculate_word_count('<p>Your test content here</p>');

-- Check suspicious word counts
SELECT * FROM find_suspicious_word_counts('your-user-id', 0.5);

-- Get statistics
SELECT * FROM get_word_count_stats('your-user-id');

-- Update specific newsletter
SELECT update_newsletter_word_count('newsletter-uuid');
```

## Client-Side Service (Currently Unused)

### WordCountService TypeScript Class

A client-side `WordCountService` class exists at `src/common/services/WordCountService.ts` but is **currently not used** in the application.

#### Why It's Unused

The application uses a **database-first approach** where all word counting happens in PostgreSQL during email processing. This provides better performance and consistency.

#### What the Service Provides

The `WordCountService` class includes:

- `calculateWordCount(content: string)` - Client-side word calculation
- `batchUpdateWordCounts(newsletterIds: string[])` - Batch updates
- `getWordCountStats(userId: string)` - User statistics
- `updateWordCount(newsletterId: string)` - Single newsletter update
- `validateWordCount(content: string)` - Validation for debugging

#### Potential Use Cases

The service could be used for:

- **Client-side validation** of word counts before database operations
- **Debugging** word count calculations during development
- **Batch operations** on existing newsletters from admin interfaces
- **Statistics and analytics** dashboards
- **Offline functionality** when database is unavailable

#### Current Architecture

```
Email Processing → PostgreSQL Functions → Database Fields → UI Display
```

Instead of:

```
Email Processing → Client Service → Database → UI Display
```

#### Recommendation

Keep the service as a **utility for debugging and potential future features**, but continue using the database-first approach for production word counting.

## Usage Examples

### Basic Word Count

```sql
-- Simple word count
SELECT calculate_word_count('<p>Hello world! This is a test.</p>');
-- Returns: 6

-- With advertisements
SELECT calculate_word_count('<p>Real content.</p><div class="ad">Buy now!</div>');
-- Returns: 2 (ad content excluded)
```

### Newsletter Management

```sql
-- Update all newsletters for a user
SELECT batch_update_newsletter_word_counts(
    ARRAY(SELECT id FROM newsletters WHERE user_id = 'user-id')
);

-- Find quality issues
SELECT
    title,
    word_count as stored_count,
    calculate_word_count(content) as actual_count,
    ABS(word_count - calculate_word_count(content)) as difference
FROM newsletters
WHERE user_id = 'user-id'
ORDER BY difference DESC
LIMIT 10;
```

### Statistics and Reporting

```sql
-- User reading statistics
SELECT
    get_word_count_stats('user-id') as stats,
    COUNT(*) as total_newsletters,
    SUM(estimated_read_time) as total_read_time_minutes
FROM newsletters
WHERE user_id = 'user-id';

-- Word count distribution
SELECT
    CASE
        WHEN word_count < 100 THEN 'Short (< 100 words)'
        WHEN word_count < 500 THEN 'Medium (100-500 words)'
        WHEN word_count < 1000 THEN 'Long (500-1000 words)'
        ELSE 'Very Long (> 1000 words)'
    END as length_category,
    COUNT(*) as count
FROM newsletters
WHERE user_id = 'user-id'
GROUP BY length_category
ORDER BY count DESC;
```

## Migration Details

### File Information

- **Migration File**: `20250130_consolidated_word_count_enhancements.sql`
- **Size**: 18,663 bytes
- **Functions Created**: 7
- **Indexes Created**: 2
- **Tests Included**: 5 comprehensive test scenarios

### Rollback Plan

If rollback is needed:

1. The migration uses `CREATE OR REPLACE` for functions
2. Indexes use `IF NOT EXISTS` clauses
3. Tests are wrapped in `DO` blocks and don't persist data
4. Previous function versions would need to be restored from backups

### Dependencies

- Requires PostgreSQL 12+ for advanced regex features
- Depends on existing `newsletters` table structure
- Assumes standard newsletter processing workflow

## Word Count Management Script

### Overview

A comprehensive management script is available at `scripts/word_count_management.sql` that provides tools for analyzing, updating, and maintaining word counts across the newsletter database.

### Script Features

#### 1. **Current State Analysis**

- **Word Count Statistics**: Total newsletters, missing counts, averages
- **Suspicious Count Detection**: Identifies discrepancies using `find_suspicious_word_counts()`
- **Word Count Distribution**: Categorizes newsletters by length (perfect for reading length filters)
- **Source Quality Analysis**: Identifies problematic newsletter sources

#### 2. **Bulk Update Scripts**

**Script 1: Missing Word Counts**

```sql
-- Updates newsletters with word_count = 0 or NULL
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT array_agg(id) INTO v_count
    FROM newsletters
    WHERE content IS NOT NULL
    AND (word_count = 0 OR word_count IS NULL);

    IF v_count IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_count);
        RAISE NOTICE 'Updated % newsletters with missing word counts', array_length(v_count, 1);
    END IF;
END $$;
```

**Script 2: Suspicious Word Counts**

```sql
-- Updates newsletters with 50%+ discrepancy between stored and calculated counts
DO $$
DECLARE
    v_suspicious_ids UUID[];
BEGIN
    SELECT array_agg(newsletter_id) INTO v_suspicious_ids
    FROM find_suspicious_word_counts('all-users', 0.5);

    IF v_suspicious_ids IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_suspicious_ids);
        RAISE NOTICE 'Updated % suspicious newsletters', array_length(v_suspicious_ids, 1);
    END IF;
END $$;
```

**Script 3: User-Specific Updates**

```sql
-- Updates all newsletters for a specific user
-- Replace 'your-user-id-here' with actual user ID
DO $$
DECLARE
    v_user_id TEXT := 'your-user-id-here';
    v_newsletter_ids UUID[];
BEGIN
    SELECT array_agg(id) INTO v_newsletter_ids
    FROM newsletters
    WHERE user_id = v_user_id
    AND content IS NOT NULL;

    IF v_newsletter_ids IS NOT NULL THEN
        PERFORM batch_update_newsletter_word_counts(v_newsletter_ids);
        RAISE NOTICE 'Updated % newsletters for user %', array_length(v_newsletter_ids, 1), v_user_id;
    END IF;
END $$;
```

**Script 4: Gradual Batch Processing**

```sql
-- Processes newsletters in batches of 100 to avoid performance issues
DO $$
DECLARE
    v_batch_size INTEGER := 100;
    v_offset INTEGER := 0;
    v_batch_ids UUID[];
    v_total_updated INTEGER := 0;
BEGIN
    LOOP
        SELECT array_agg(id) INTO v_batch_ids
        FROM newsletters
        WHERE content IS NOT NULL
        AND (word_count = 0 OR word_count IS NULL)
        LIMIT v_batch_size OFFSET v_offset;

        EXIT WHEN v_batch_ids IS NULL;

        PERFORM batch_update_newsletter_word_counts(v_batch_ids);
        v_total_updated := v_total_updated + array_length(v_batch_ids, 1);
        v_offset := v_offset + v_batch_size;

        RAISE NOTICE 'Batch %: Updated % newsletters (total: %)',
                    (v_offset / v_batch_size),
                    array_length(v_batch_ids, 1),
                    v_total_updated;

        PERFORM pg_sleep(0.1); -- Prevent overwhelming the database
    END LOOP;
END $$;
```

#### 3. **Reading Length Filter Support**

The script includes queries that categorize newsletters by reading time, perfect for implementing reading length filters:

```sql
WITH reading_categories AS (
    SELECT
        id,
        title,
        estimated_read_time,
        CASE
            WHEN estimated_read_time <= 2 THEN 'Quick Read (≤2 min)'
            WHEN estimated_read_time <= 5 THEN 'Short Read (2-5 min)'
            WHEN estimated_read_time <= 10 THEN 'Medium Read (5-10 min)'
            WHEN estimated_read_time <= 20 THEN 'Long Read (10-20 min)'
            ELSE 'Deep Read (>20 min)'
        END as reading_category
    FROM newsletters
    WHERE content IS NOT NULL AND word_count > 0
)
SELECT
    reading_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM reading_categories
GROUP BY reading_category;
```

#### 4. **Quality Assurance Tools**

**Manual Review Query**:

```sql
-- Find newsletters needing manual review
SELECT
    n.title,
    n.word_count as stored_count,
    public.calculate_word_count(n.content) as calculated_count,
    ROUND(ABS(n.word_count - public.calculate_word_count(n.content))::NUMERIC / NULLIF(n.word_count, 0) * 100, 2) as difference_percentage
FROM newsletters n
WHERE ABS(n.word_count - public.calculate_word_count(n.content))::NUMERIC / NULLIF(n.word_count, 0) > 0.5
ORDER BY difference_percentage DESC
LIMIT 20;
```

**Source Quality Analysis**:

```sql
-- Check which newsletter sources have the most word count issues
SELECT
    ns.name as source_name,
    COUNT(*) as newsletter_count,
    COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) as missing_count,
    ROUND(COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) * 100.0 / COUNT(*), 2) as missing_percentage
FROM newsletters n
JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
WHERE n.content IS NOT NULL
GROUP BY ns.id, ns.name
HAVING COUNT(CASE WHEN n.word_count = 0 OR n.word_count IS NULL THEN 1 END) > 0
ORDER BY missing_percentage DESC;
```

### Usage Instructions

1. **Run the Analysis First**: Start with the current state analysis queries
2. **Choose Update Strategy**: Select the appropriate script based on your needs
3. **Monitor Performance**: Use the performance monitoring queries to track impact
4. **Schedule Regular Maintenance**: Set up the recommended maintenance schedule

### Recommended Maintenance Schedule

- **Weekly**: Check for suspicious word counts

  ```sql
  SELECT * FROM find_suspicious_word_counts('all-users', 0.3) LIMIT 50;
  ```

- **Monthly**: Update newsletters with missing word counts (Script 1)

- **Quarterly**: Full quality check and bulk update (Scripts 2 and 4)

### Performance Considerations

- **Batch Processing**: Use Script 4 for large datasets to avoid performance issues
- **Index Usage**: Monitor that word count indexes are being used effectively
- **Database Load**: Schedule bulk updates during low-traffic periods
- **Progress Tracking**: All scripts include progress reporting

## Best Practices

1. **Regular Quality Checks**: Run `find_suspicious_word_counts()` periodically
2. **Batch Updates**: Use batch functions for multiple newsletters
3. **Monitoring**: Track word count statistics over time
4. **Testing**: Validate with real newsletter content from your sources
5. **Performance**: Monitor query performance with the new indexes
6. **Scheduled Maintenance**: Use the management script for regular updates
7. **Gradual Updates**: Process large datasets in batches to avoid performance issues

## Troubleshooting

### Common Issues

1. **High Word Counts**: Check for HTML entities not being decoded
2. **Low Word Counts**: Verify ad detection isn't too aggressive
3. **Performance Issues**: Ensure indexes are created and being used
4. **Memory Issues**: Process large newsletters in batches

### Debug Queries

```sql
-- Check function performance
EXPLAIN ANALYZE SELECT calculate_word_count(content) FROM newsletters LIMIT 10;

-- Verify index usage
EXPLAIN ANALYZE SELECT * FROM newsletters WHERE user_id = 'id' AND word_count > 1000;

-- Check for suspicious patterns
SELECT
    LENGTH(content) as content_length,
    word_count,
    LENGTH(content) / NULLIF(word_count, 0) as avg_chars_per_word
FROM newsletters
WHERE user_id = 'user-id'
ORDER BY avg_chars_per_word DESC
LIMIT 10;
```

This comprehensive word count system provides accurate, advertisement-resistant word counting with robust quality assurance and performance optimization.
