// Utility to normalize newsletter filter keys from snake_case to camelCase
// NOTE: No module-level memoization – callers (hooks) already wrap this in useMemo,
// so a shared cache would be silently stale when multiple hook instances are active.

export function normalizeNewsletterFilter(filter: any): any {
  if (!filter) return filter;

  const mapping: Record<string, string> = {
    is_liked: 'isLiked',
    is_archived: 'isArchived',
    is_read: 'isRead',
    tag_ids: 'tagIds',
    source_id: 'sourceIds',
    date_from: 'dateFrom',
    date_to: 'dateTo',
    order_by: 'orderBy',
    order_direction: 'orderDirection',
    group_id: 'groupIds',
  };

  const result: any = {};

  for (const key in filter) {
    const value = filter[key];
    if (mapping[key]) {
      const newKey = mapping[key];

      // Handle special cases for array fields
      if (newKey === 'sourceIds' && value !== undefined) {
        // Convert single source_id to array format
        if (typeof value === 'string') {
          // Validate UUID format
          if (isValidUUID(value)) {
            result[newKey] = [value];
          } else {
            // Skip invalid UUIDs
            continue;
          }
        } else if (Array.isArray(value)) {
          // Filter out invalid UUIDs from arrays
          result[newKey] = value.filter((id) => isValidUUID(id));
        } else {
          // Skip non-string, non-array values
          continue;
        }
      } else if (newKey === 'tagIds' && value !== undefined) {
        // Handle tag IDs array
        if (Array.isArray(value)) {
          // Filter out invalid UUIDs from arrays
          result[newKey] = value.filter((id) => isValidUUID(id));
        } else {
          // Skip non-array values
          continue;
        }
      } else {
        // For other fields, just copy the value
        result[newKey] = value;
      }
    } else {
      result[key] = filter[key];
    }
  }

  return result;
}

// Helper function to validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Format estimated read time for display. Avoids showing "1 min" when content
 * is empty or very short (word count 0 or &lt; ~50 words).
 */
export function formatReadTime(estimatedReadTime: number, wordCount: number): string {
  if (wordCount === 0) return '< 1 min';
  if (estimatedReadTime <= 1 && wordCount < 50) return '< 1 min';
  return `${estimatedReadTime} min`;
}
