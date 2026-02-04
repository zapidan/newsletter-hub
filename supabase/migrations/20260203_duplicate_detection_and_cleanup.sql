-- Duplicate Detection and Cleanup Functions (Consolidated)
-- This migration replaces all previous duplicate detection and cleanup functions with improved versions

-- First, drop any existing old functions to avoid conflicts
DROP FUNCTION IF EXISTS public.find_duplicate_newsletters() CASCADE;
DROP FUNCTION IF EXISTS public.restore_and_deduplicate_skipped_newsletters() CASCADE;
DROP FUNCTION IF EXISTS public.clean_duplicate_newsletters() CASCADE;
DROP FUNCTION IF EXISTS public.get_duplicate_statistics() CASCADE;

-- 1. Improved function to find potential duplicates in newsletters table
CREATE OR REPLACE FUNCTION find_duplicate_newsletters()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    source_name TEXT,
    received_at TIMESTAMPTZ,
    duplicate_count BIGINT,
    duplicate_ids UUID[]
) AS $$
BEGIN
    RETURN QUERY
    WITH duplicates AS (
        SELECT 
            n1.id,
            n1.user_id,
            n1.title,
            COALESCE(ns.name, 'Unknown Source') as source_name,
            n1.received_at,
            n1.newsletter_source_id,
            COUNT(*) OVER (PARTITION BY n1.newsletter_source_id, n1.title, n1.user_id) as duplicate_count,
            ARRAY_AGG(n2.id) OVER (PARTITION BY n1.newsletter_source_id, n1.title, n1.user_id) as duplicate_ids
        FROM 
            newsletters n1
        LEFT JOIN 
            newsletter_sources ns ON n1.newsletter_source_id = ns.id
        WHERE EXISTS (
            SELECT 1 
            FROM newsletters n2
            WHERE n1.newsletter_source_id = n2.newsletter_source_id
            AND n1.user_id = n2.user_id
            AND n1.title = n2.title
            AND n1.id != n2.id
        )
    )
    SELECT 
        id, 
        user_id,
        title, 
        source_name, 
        received_at, 
        duplicate_count,
        duplicate_ids
    FROM 
        duplicates
    WHERE 
        duplicate_count > 1
    ORDER BY 
        user_id, source_name, title, received_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Restore function that doesn't rely on auth.uid()
CREATE OR REPLACE FUNCTION restore_skipped_newsletter(
    p_skipped_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    skipped_record RECORD;
    newsletter_id UUID;
    result JSONB;
BEGIN
    -- Get the skipped newsletter record
    SELECT * INTO skipped_record
    FROM skipped_newsletters
    WHERE id = p_skipped_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Skipped newsletter not found'
        );
    END IF;
    
    -- Check user permissions if user_id is provided
    IF p_user_id IS NOT NULL AND skipped_record.user_id != p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Permission denied: newsletter belongs to different user'
        );
    END IF;
    
    -- Check if newsletter already exists (prevent duplicates)
    SELECT id INTO newsletter_id
    FROM newsletters
    WHERE 
        user_id = skipped_record.user_id
        AND newsletter_source_id = skipped_record.newsletter_source_id
        AND title = skipped_record.title
        AND received_at::date = skipped_record.received_at::date
    LIMIT 1;
    
    IF newsletter_id IS NOT NULL THEN
        -- Newsletter already exists, just delete from skipped
        DELETE FROM skipped_newsletters WHERE id = p_skipped_id;
        RETURN jsonb_build_object(
            'success', true,
            'action', 'deleted_duplicate',
            'message', 'Newsletter already exists, deleted from skipped',
            'existing_newsletter_id', newsletter_id
        );
    END IF;
    
    -- Insert back into newsletters
    INSERT INTO newsletters (
        user_id,
        title,
        content,
        summary,
        newsletter_source_id,
        word_count,
        estimated_read_time,
        is_read,
        is_archived,
        is_liked,
        received_at,
        created_at,
        updated_at
    )
    SELECT
        user_id,
        title,
        content,
        summary,
        newsletter_source_id,
        word_count,
        estimated_read_time,
        is_read,
        is_archived,
        is_liked,
        COALESCE(received_at, created_at, now()) AS received_at,
        COALESCE(created_at, now()) AS created_at,
        now() AS updated_at
    FROM skipped_newsletters
    WHERE id = p_skipped_id
    RETURNING id INTO newsletter_id;
    
    -- Update the daily count for the user
    PERFORM public.increment_newsletter_count(skipped_record.user_id);
    
    -- Delete from skipped_newsletters
    DELETE FROM skipped_newsletters WHERE id = p_skipped_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'action', 'restored',
        'newsletter_id', newsletter_id,
        'message', 'Newsletter successfully restored'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to replace the old restore_and_deduplicate_skipped_newsletters
CREATE OR REPLACE FUNCTION restore_and_deduplicate_skipped_newsletters(
    p_user_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    skipped_record RECORD;
    restored_count INTEGER := 0;
    duplicate_count INTEGER := 0;
    error_count INTEGER := 0;
    error_message TEXT;
    result JSONB;
    processed_keys TEXT[];
BEGIN
    -- Create a temporary table to track processed newsletters
    CREATE TEMP TABLE IF NOT EXISTS processed_newsletters (
        user_id UUID,
        source_id UUID,
        title TEXT,
        received_date DATE,
        processed_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, source_id, title, received_date)
    ) ON COMMIT DROP;
    
    -- Query all skipped newsletters (optionally filtered by user)
    FOR skipped_record IN 
        SELECT * FROM skipped_newsletters 
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
        ORDER BY user_id, received_at DESC
    LOOP
        BEGIN
            -- Check if we've already processed a similar newsletter
            IF EXISTS (
                SELECT 1 FROM processed_newsletters 
                WHERE user_id = skipped_record.user_id
                AND source_id = skipped_record.newsletter_source_id
                AND title = skipped_record.title
                AND received_date = skipped_record.received_at::date
            ) THEN
                -- This is a duplicate, just delete it
                IF NOT p_dry_run THEN
                    DELETE FROM skipped_newsletters WHERE id = skipped_record.id;
                END IF;
                duplicate_count := duplicate_count + 1;
                CONTINUE;
            END IF;
            
            -- Restore the newsletter
            IF NOT p_dry_run THEN
                PERFORM restore_skipped_newsletter(skipped_record.id, skipped_record.user_id);
            END IF;
            
            -- Mark as processed
            INSERT INTO processed_newsletters (user_id, source_id, title, received_date)
            VALUES (skipped_record.user_id, skipped_record.newsletter_source_id, skipped_record.title, skipped_record.received_at::date);
            
            restored_count := restored_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            error_message := COALESCE(error_message, '') || 
                            'Error processing newsletter ' || COALESCE(skipped_record.id::TEXT, 'NULL') || 
                            ' for user ' || COALESCE(skipped_record.user_id::TEXT, 'NULL') || 
                            ': ' || SQLERRM || E'\n';
        END;
    END LOOP;
    
    -- Build result
    result := jsonb_build_object(
        'success', true,
        'dry_run', p_dry_run,
        'restored_count', restored_count,
        'duplicate_count', duplicate_count,
        'error_count', error_count,
        'message', CASE 
            WHEN p_dry_run THEN 
                'Dry run: Would restore ' || restored_count || ' newsletters, skip ' || duplicate_count || ' duplicates'
            ELSE 
                'Restored ' || restored_count || ' newsletters, skipped ' || duplicate_count || ' duplicates'
        END,
        'error', COALESCE(error_message, '')
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to process skipped newsletters: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to clean up duplicates with better performance
CREATE OR REPLACE FUNCTION clean_duplicate_newsletters(
    p_user_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    duplicate_group RECORD;
    deleted_count INTEGER := 0;
    total_deleted INTEGER := 0;
    error_count INTEGER := 0;
    error_message TEXT;
    result JSONB;
BEGIN
    -- Process duplicates by group
    FOR duplicate_group IN 
        WITH duplicate_groups AS (
            SELECT 
                n1.newsletter_source_id,
                n1.title,
                n1.user_id,
                ARRAY_AGG(n1.id ORDER BY n1.received_at DESC, n1.updated_at DESC) as all_ids,
                COUNT(*) as duplicate_count,
                MAX(n1.received_at) as latest_received,
                MAX(n1.updated_at) as latest_updated
            FROM 
                newsletters n1
            WHERE (p_user_id IS NULL OR n1.user_id = p_user_id)
            AND EXISTS (
                SELECT 1 
                FROM newsletters n2
                WHERE n1.newsletter_source_id = n2.newsletter_source_id
                AND n1.user_id = n2.user_id
                AND n1.title = n2.title
                AND n1.id != n2.id
            )
            GROUP BY n1.newsletter_source_id, n1.title, n1.user_id
            HAVING COUNT(*) > 1
        )
        SELECT 
            newsletter_source_id,
            title,
            user_id,
            all_ids,
            duplicate_count,
            latest_received,
            latest_updated
        FROM 
            duplicate_groups
        ORDER BY user_id, newsletter_source_id, title
    LOOP
        BEGIN
            -- Keep the first (most recent) ID, delete the rest
            DECLARE
                ids_to_delete UUID[];
            BEGIN
                ids_to_delete := duplicate_group.all_ids[2:array_length(duplicate_group.all_ids, 1)]; -- Keep first, delete rest
                
                IF NOT p_dry_run AND array_length(ids_to_delete, 1) > 0 THEN
                    DELETE FROM newsletters
                    WHERE id = ANY(ids_to_delete);
                    
                    GET DIAGNOSTICS deleted_count = ROW_COUNT;
                    total_deleted := total_deleted + deleted_count;
                ELSE
                    total_deleted := total_deleted + COALESCE(array_length(ids_to_delete, 1), 0);
                END IF;
            END;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            error_message := COALESCE(error_message, '') || 
                            'Error processing duplicate for user ' || 
                            COALESCE(duplicate_group.user_id::TEXT, 'NULL') || 
                            ', source ' || COALESCE(duplicate_group.newsletter_source_id::TEXT, 'NULL') || 
                            ', title: ' || COALESCE(duplicate_group.title, 'NULL') || 
                            ': ' || SQLERRM || E'\n';
        END;
    END LOOP;
    
    -- Return results
    result := jsonb_build_object(
        'success', true,
        'dry_run', p_dry_run,
        'deleted_count', total_deleted,
        'error_count', error_count,
        'message', CASE 
            WHEN p_dry_run THEN 
                'Dry run: Would delete ' || total_deleted || ' duplicate newsletters'
            ELSE 
                'Cleaned up ' || total_deleted || ' duplicate newsletters'
        END,
        'error', COALESCE(error_message, '')
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to clean up duplicates: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to get comprehensive duplicate statistics
CREATE OR REPLACE FUNCTION get_duplicate_statistics(
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    total_newsletters BIGINT;
    unique_newsletters BIGINT;
    duplicate_groups BIGINT;
    total_duplicates BIGINT;
    skipped_total BIGINT;
    skipped_by_reason JSONB;
    result JSONB;
BEGIN
    -- Get total newsletters count
    SELECT COUNT(*) INTO total_newsletters 
    FROM newsletters 
    WHERE (p_user_id IS NULL OR user_id = p_user_id);
    
    -- Get unique newsletters count
    SELECT COUNT(*) INTO unique_newsletters
    FROM (
        SELECT DISTINCT newsletter_source_id, title, user_id
        FROM newsletters
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
    ) unique_newsletters;
    
    -- Get duplicate groups count
    SELECT COUNT(*) INTO duplicate_groups 
    FROM (
        SELECT newsletter_source_id, title, user_id
        FROM newsletters
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
        GROUP BY newsletter_source_id, title, user_id
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Calculate total duplicates
    total_duplicates := total_newsletters - unique_newsletters;
    
    -- Get skipped newsletters count by reason
    SELECT jsonb_object_agg(skip_reason, count) INTO skipped_by_reason
    FROM (
        SELECT skip_reason, COUNT(*) as count
        FROM skipped_newsletters
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
        GROUP BY skip_reason
    ) reason_counts;
    
    -- Get total skipped count
    SELECT COUNT(*) INTO skipped_total 
    FROM skipped_newsletters 
    WHERE (p_user_id IS NULL OR user_id = p_user_id);
    
    -- Return comprehensive statistics
    result := jsonb_build_object(
        'user_id', p_user_id,
        'total_newsletters', total_newsletters,
        'unique_newsletters', unique_newsletters,
        'duplicate_groups', duplicate_groups,
        'total_duplicates', total_duplicates,
        'skipped_total', skipped_total,
        'skipped_by_reason', COALESCE(skipped_by_reason, '{}'::jsonb),
        'duplicate_percentage', CASE 
            WHEN total_newsletters > 0 THEN 
                ROUND((total_duplicates::DECIMAL / total_newsletters::DECIMAL) * 100, 2)
            ELSE 0 
        END,
        'data_quality_score', CASE 
            WHEN total_newsletters > 0 THEN 
                ROUND((unique_newsletters::DECIMAL / total_newsletters::DECIMAL) * 100, 2)
            ELSE 100 
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION find_duplicate_newsletters() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION restore_and_deduplicate_skipped_newsletters(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION clean_duplicate_newsletters(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_duplicate_statistics(UUID) TO authenticated, service_role;

-- Add helpful comments
COMMENT ON FUNCTION find_duplicate_newsletters() IS 'Finds potential duplicate newsletters based on source, title, and user';
COMMENT ON FUNCTION restore_and_deduplicate_skipped_newsletters(UUID, BOOLEAN) IS 'Safely restores all skipped newsletters while avoiding duplicates, with dry-run support';
COMMENT ON FUNCTION clean_duplicate_newsletters(UUID, BOOLEAN) IS 'Improved cleanup with dry-run support and better error handling';
COMMENT ON FUNCTION get_duplicate_statistics(UUID) IS 'Comprehensive statistics including skipped newsletters by reason';
