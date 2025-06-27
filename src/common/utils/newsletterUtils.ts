// Utility to normalize newsletter filter keys from snake_case to camelCase
let lastInput: any = null;
let lastOutput: any = null;

export function normalizeNewsletterFilter(filter: any): any {
  // Memoization: shallow compare with last input
  if (lastInput && filter && Object.keys(filter).length === Object.keys(lastInput).length) {
    let same = true;
    for (const key in filter) {
      if (filter[key] !== lastInput[key]) {
        same = false;
        break;
      }
    }
    if (same) return lastOutput;
  }

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
          result[newKey] = value.filter(id => isValidUUID(id));
        } else {
          // Skip non-string, non-array values
          continue;
        }
      } else if (newKey === 'tagIds' && value !== undefined) {
        // Handle tag IDs array
        if (Array.isArray(value)) {
          // Filter out invalid UUIDs from arrays
          result[newKey] = value.filter(id => isValidUUID(id));
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

  lastInput = filter;
  lastOutput = result;
  return result;
}

// Helper function to validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
} 