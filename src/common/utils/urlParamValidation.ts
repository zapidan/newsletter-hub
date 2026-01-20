/**
 * URL Parameter Validation Utilities
 * 
 * Provides robust validation for URL parameters to prevent invalid data
 * from entering the application state and causing unexpected behavior.
 */

import type { InboxFilterType } from '@common/hooks/useInboxFilters';
import type { TimeRange } from '@web/components/TimeFilter';

// Validation result interface
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  error?: string;
  defaultValue?: T;
}

// Base validator type
export type Validator<T> = (value: string | null, defaultValue?: T) => ValidationResult<T>;

/**
 * Validates that a value is one of the allowed enum values
 */
export function createEnumValidator<T extends string>(allowedValues: T[]): Validator<T> {
  return (value: string | null, defaultValue?: T): ValidationResult<T> => {
    if (value === null || value === undefined || value === '') {
      return {
        isValid: defaultValue !== undefined,
        value: defaultValue,
        defaultValue,
        error: defaultValue === undefined ? 'Value is required but no default provided' : undefined,
      };
    }

    const normalizedValue = value.trim().toLowerCase();
    const validValue = allowedValues.find(
      allowed => allowed.toLowerCase() === normalizedValue
    ) as T | undefined;

    if (validValue !== undefined) {
      return {
        isValid: true,
        value: validValue,
      };
    }

    return {
      isValid: false,
      value: defaultValue,
      defaultValue,
      error: `Invalid value "${value}". Must be one of: ${allowedValues.join(', ')}`,
    };
  };
}

/**
 * Validates UUID strings
 */
export const uuidValidator: Validator<string> = (value: string | null, defaultValue?: string): ValidationResult<string> => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: defaultValue !== undefined,
      value: defaultValue,
      defaultValue,
      error: defaultValue === undefined ? 'UUID is required but no default provided' : undefined,
    };
  }

  const trimmedValue = value.trim();

  // Basic UUID regex pattern (supports both v4 and other UUID formats)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(trimmedValue)) {
    return {
      isValid: true,
      value: trimmedValue,
    };
  }

  return {
    isValid: false,
    value: defaultValue,
    defaultValue,
    error: `Invalid UUID format: "${value}"`,
  };
};

/**
 * Validates arrays of UUID strings
 */
export const uuidArrayValidator: Validator<string[]> = (value: string | null, defaultValue: string[] = []): ValidationResult<string[]> => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: true,
      value: defaultValue,
      defaultValue,
    };
  }

  const trimmedValue = value.trim();
  if (trimmedValue === '') {
    return {
      isValid: true,
      value: defaultValue,
      defaultValue,
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const parts = trimmedValue.split(',').map(part => part.trim()).filter(Boolean);

  const validUuids: string[] = [];
  const invalidUuids: string[] = [];

  for (const part of parts) {
    if (uuidRegex.test(part)) {
      validUuids.push(part);
    } else {
      invalidUuids.push(part);
    }
  }

  if (invalidUuids.length === 0) {
    return {
      isValid: true,
      value: validUuids,
    };
  }

  return {
    isValid: false,
    value: validUuids.length > 0 ? validUuids : defaultValue,
    defaultValue,
    error: `Invalid UUIDs found: ${invalidUuids.join(', ')}`,
  };
};

/**
 * Validates positive integers
 */
export const positiveIntegerValidator: Validator<number> = (value: string | null, defaultValue: number = 1): ValidationResult<number> => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: true,
      value: defaultValue,
      defaultValue,
    };
  }

  const trimmedValue = value.trim();
  const num = parseInt(trimmedValue, 10);

  if (!isNaN(num) && num > 0 && Number.isInteger(num)) {
    return {
      isValid: true,
      value: num,
    };
  }

  return {
    isValid: false,
    value: defaultValue,
    defaultValue,
    error: `Invalid positive integer: "${value}"`,
  };
};

/**
 * Validates boolean values
 */
export const booleanValidator: Validator<boolean> = (value: string | null, defaultValue: boolean = false): ValidationResult<boolean> => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: true,
      value: defaultValue,
      defaultValue,
    };
  }

  const trimmedValue = value.trim().toLowerCase();

  if (trimmedValue === 'true' || trimmedValue === '1' || trimmedValue === 'yes') {
    return {
      isValid: true,
      value: true,
    };
  }

  if (trimmedValue === 'false' || trimmedValue === '0' || trimmedValue === 'no') {
    return {
      isValid: true,
      value: false,
    };
  }

  return {
    isValid: false,
    value: defaultValue,
    defaultValue,
    error: `Invalid boolean value: "${value}". Use true/false, 1/0, or yes/no`,
  };
};

/**
 * Validates string values with optional length constraints
 */
export function createStringValidator(options: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
} = {}): Validator<string> {
  return (value: string | null, defaultValue?: string): ValidationResult<string> => {
    if (value === null || value === undefined || value === '') {
      return {
        isValid: defaultValue !== undefined,
        value: defaultValue,
        defaultValue,
        error: defaultValue === undefined ? 'Value is required but no default provided' : undefined,
      };
    }

    const trimmedValue = value.trim();

    // Check allowed values if specified
    if (options.allowedValues) {
      const isValid = options.allowedValues.some(allowed => allowed === trimmedValue);
      if (!isValid) {
        return {
          isValid: false,
          value: defaultValue,
          defaultValue,
          error: `Invalid value "${trimmedValue}". Must be one of: ${options.allowedValues.join(', ')}`,
        };
      }
    }

    // Check length constraints
    if (options.minLength !== undefined && trimmedValue.length < options.minLength) {
      return {
        isValid: false,
        value: defaultValue,
        defaultValue,
        error: `Value too short. Minimum length: ${options.minLength}`,
      };
    }

    if (options.maxLength !== undefined && trimmedValue.length > options.maxLength) {
      return {
        isValid: false,
        value: defaultValue,
        defaultValue,
        error: `Value too long. Maximum length: ${options.maxLength}`,
      };
    }

    // Check pattern if specified
    if (options.pattern && !options.pattern.test(trimmedValue)) {
      return {
        isValid: false,
        value: defaultValue,
        defaultValue,
        error: `Value does not match required pattern`,
      };
    }

    return {
      isValid: true,
      value: trimmedValue,
    };
  };
}

// Predefined validators for common use cases

export const inboxFilterValidator = createEnumValidator<InboxFilterType>(['unread', 'read', 'liked', 'archived']);
export const timeRangeValidator = createEnumValidator<TimeRange>(['day', '2days', 'week', 'month', 'all']);
export const orderDirectionValidator = createEnumValidator(['asc', 'desc']);

// Common sort fields for newsletters
export const sortFieldValidator = createStringValidator({
  allowedValues: ['created_at', 'updated_at', 'title', 'published_at', 'read_at', 'name'],
});

/**
 * Validates an object of parameters against a validation schema
 */
export interface ValidationSchema {
  [key: string]: {
    validator: Validator<unknown>;
    required?: boolean;
    defaultValue?: unknown;
  };
}

export function validateParams(
  params: Record<string, string | null>,
  schema: ValidationSchema
): { isValid: boolean; values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [key, config] of Object.entries(schema)) {
    const paramValue = params[key];

    const result = config.validator(paramValue, config.defaultValue as any);

    if (result.isValid && result.value !== undefined) {
      values[key] = result.value;
    } else {
      if (config.required || (paramValue !== null && paramValue !== undefined && paramValue !== '')) {
        errors[key] = result.error || `Invalid value for ${key}`;
        isValid = false;
      }

      if (result.defaultValue !== undefined) {
        values[key] = result.defaultValue;
      }
    }
  }

  return { isValid, values, errors };
}

/**
 * Sanitizes URL parameters by removing potentially dangerous characters
 */
export function sanitizeUrlParam(value: string): string {
  // Normalize whitespace first
  value = value.trim();

  let previous: string;
  do {
    previous = value;
    value = value
      // Remove any script or HTML tags
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      // Remove potential XSS patterns
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');
  } while (value !== previous);

  // Limit length to prevent abuse
  return value.slice(0, 1000);
}

/**
 * Validates and sanitizes a complete URL search query
 */
export function sanitizeUrlQuery(query: string): string {
  const params = new URLSearchParams(query);
  const sanitizedParams = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    const sanitizedKey = sanitizeUrlParam(key);
    const sanitizedValue = sanitizeUrlParam(value);

    if (sanitizedKey && sanitizedValue) {
      sanitizedParams.set(sanitizedKey, sanitizedValue);
    }
  }

  return sanitizedParams.toString();
}