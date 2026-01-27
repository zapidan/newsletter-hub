import { BatchResult, BulkUpdateNewsletterParams } from '../types/api';
import { logger } from '../utils/logger';
import { requireAuth, supabase } from './supabaseClient';

// Batch configuration for optimal performance
const BATCH_CONFIG = {
  MAX_BATCH_SIZE: 50, // Process 50 items at a time
  BATCH_DELAY: 100,    // 100ms delay between batches
  MAX_RETRIES: 2,     // Retry failed batches
  RETRY_DELAY: 500,   // 500ms delay for retries
};

// Utility function to split array into batches
function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// Utility function to add delay between operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced batch update with proper error handling and progress tracking
export async function bulkUpdateBatched(
  params: BulkUpdateNewsletterParams,
  onProgress?: (completed: number, total: number, currentBatch: number) => void
): Promise<BatchResult<unknown>> {
  const startTime = Date.now();
  const user = await requireAuth();
  const { ids, updates } = params;

  logger.info('Starting batched bulk update', {
    component: 'NewsletterApi',
    action: 'bulk_update_batched_start',
    metadata: {
      totalIds: ids.length,
      batchSize: BATCH_CONFIG.MAX_BATCH_SIZE,
      updates: Object.keys(updates),
    },
  });

  // Split IDs into manageable batches
  const idBatches = createBatches(ids, BATCH_CONFIG.MAX_BATCH_SIZE);
  const allResults: any[] = [];
  const allErrors: (Error | null)[] = [];
  let completedCount = 0;

  // Process each batch sequentially
  for (let batchIndex = 0; batchIndex < idBatches.length; batchIndex++) {
    const batch = idBatches[batchIndex];
    let retryCount = 0;
    let batchSuccess = false;

    // Retry logic for each batch
    while (!batchSuccess && retryCount <= BATCH_CONFIG.MAX_RETRIES) {
      try {
        logger.debug('Processing batch', {
          component: 'NewsletterApi',
          action: 'process_batch',
          metadata: {
            batchIndex: batchIndex + 1,
            totalBatches: idBatches.length,
            batchSize: batch.length,
            retryCount,
          },
        });

        const { data, error } = await supabase
          .from('newsletters')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .in('id', batch)
          .eq('user_id', user.id)
          .select();

        if (error) {
          throw new Error(`Batch ${batchIndex + 1} failed: ${error.message}`);
        }

        // Process successful batch results
        const transformedResults = (data || []).map((item: unknown) => item);

        batch.forEach((id) => {
          const result = transformedResults.find((r: unknown) => (r as { id: string }).id === id);
          allResults.push(result || null);
          allErrors.push(result ? null : new Error('Newsletter not found or not updated'));
        });

        completedCount += batch.length;
        batchSuccess = true;

        // Report progress
        if (onProgress) {
          onProgress(completedCount, ids.length, batchIndex + 1);
        }

        logger.debug('Batch completed successfully', {
          component: 'NewsletterApi',
          action: 'batch_success',
          metadata: {
            batchIndex: batchIndex + 1,
            completedCount,
            successCount: transformedResults.length,
          },
        });

      } catch (error) {
        retryCount++;

        logger.warn('Batch failed, retrying', {
          component: 'NewsletterApi',
          action: 'batch_retry',
          metadata: {
            batchIndex: batchIndex + 1,
            retryCount,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        if (retryCount > BATCH_CONFIG.MAX_RETRIES) {
          // Mark all items in this batch as failed
          batch.forEach(() => {
            allResults.push(null);
            allErrors.push(error instanceof Error ? error : new Error('Batch operation failed'));
          });
          completedCount += batch.length;
        } else {
          // Wait before retry
          await delay(BATCH_CONFIG.RETRY_DELAY);
        }
      }
    }

    // Add delay between batches to prevent overwhelming the database
    if (batchIndex < idBatches.length - 1) {
      await delay(BATCH_CONFIG.BATCH_DELAY);
    }
  }

  const duration = Date.now() - startTime;
  const successCount = allResults.filter((r) => r !== null).length;
  const errorCount = allErrors.filter((e) => e !== null).length;

  logger.info('Batched bulk update completed', {
    component: 'NewsletterApi',
    action: 'bulk_update_batched_complete',
    metadata: {
      totalIds: ids.length,
      successCount,
      errorCount,
      duration,
      averageTimePerItem: duration / ids.length,
    },
  });

  return {
    results: allResults,
    errors: allErrors,
    successCount,
    errorCount,
  };
}

// Helper function to transform newsletter response (moved from original file)
// Note: Using a simple identity transformation for now - replace with actual transformation logic
function _transformNewsletterResponse(data: unknown): unknown {
  return data; // Placeholder - use actual transformation from newsletterApi.ts
}
