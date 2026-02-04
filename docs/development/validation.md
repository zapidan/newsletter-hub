# URL Parameter Filter Validation

## Overview

This document describes the comprehensive URL parameter validation system implemented to improve the robustness of URL parameter handling in the newsletter hub application.

## Features

### 🔒 **Robust Validation**

- **Type Safety**: All URL parameters are validated against their expected types
- **Format Validation**: UUIDs, emails, and other formatted strings are validated with regex patterns
- **Range Validation**: Numbers are validated for minimum/maximum values and positivity
- **Enum Validation**: String parameters are validated against allowed values
- **Array Validation**: Comma-separated values are parsed and individually validated

### 🛡️ **Security Sanitization**

- **XSS Protection**: Removes dangerous HTML tags and script patterns
- **Protocol Filtering**: Strips potentially dangerous protocols (javascript:, data:, vbscript:)
- **Length Limits**: Prevents abuse by limiting parameter length to 1000 characters
- **Input Trimming**: Automatically removes leading/trailing whitespace

### 🎯 **Graceful Degradation**

- **Default Values**: Invalid parameters fall back to sensible defaults
- **Partial Validation**: Mixed valid/invalid arrays preserve the valid portions
- **Error Collection**: Validation errors are collected without breaking the entire flow

## Implementation

### Core Components

#### 1. Validation Utilities (`src/common/utils/urlParamValidation.ts`)

```typescript
// Basic validator type
export type Validator<T> = (value: string | null, defaultValue?: T) => ValidationResult<T>;

// Validation result interface
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  error?: string;
  defaultValue?: T;
}
```

#### 2. Predefined Validators

```typescript
// Enum validation (for filter types, time ranges, etc.)
export const inboxFilterValidator = createEnumValidator(['unread', 'read', 'liked', 'archived']);
export const timeRangeValidator = createEnumValidator(['day', '2days', 'week', 'month', 'all']);
export const orderDirectionValidator = createEnumValidator(['asc', 'desc']);

// Format validation
export const uuidValidator: Validator<string>;
export const uuidArrayValidator: Validator<string[]>;
export const positiveIntegerValidator: Validator<number>;
export const booleanValidator: Validator<boolean>;

// Custom string validation
export const sortFieldValidator = createStringValidator({
  allowedValues: ['created_at', 'updated_at', 'title', 'published_at', 'read_at', 'name'],
});
```

#### 3. Enhanced useUrlParams Hook

```typescript
export interface ParamConfig<T extends Record<string, ParamValue>> {
  [key: string]: {
    defaultValue?: T[keyof T];
    serialize?: (value: T[keyof T]) => string | null;
    deserialize?: (value: string) => T[keyof T];
    omitIfDefault?: boolean;
    validator?: Validator<any>; // New: validation support
    sanitize?: boolean; // New: sanitization support
  };
}
```

### Usage Examples

#### Basic Usage with Validation

```typescript
// Enhanced useInboxUrlParams with validation
const { params, updateParams } = useInboxUrlParams();

// Automatically validates and sanitizes:
// - filter: must be 'unread', 'read', 'liked', or 'archived'
// - source: must be valid UUID format
// - time: must be 'day', '2days', 'week', 'month', or 'all'
// - tags: must be comma-separated valid UUIDs
```

#### Custom Validation

```typescript
const { params } = useUrlParams({
  customField: {
    defaultValue: 'default',
    validator: createStringValidator({
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-z0-9]+$/i,
    }),
    sanitize: true,
  },
});
```

#### Schema Validation

```typescript
const schema = {
  status: {
    validator: createEnumValidator(['active', 'inactive']),
    required: true,
  },
  id: {
    validator: uuidValidator,
    required: true,
  },
  page: {
    validator: positiveIntegerValidator,
    defaultValue: 1,
  },
};

const { isValid, values, errors } = validateParams(urlParams, schema);
```

## Security Features

### Input Sanitization

The sanitization process includes:

1. **HTML Tag Removal**

   ```typescript
   .replace(/<script[^>]*>.*?<\/script>/gi, '')
   .replace(/<[^>]*>/g, '')
   ```

2. **Dangerous Protocol Removal**

   ```typescript
   .replace(/javascript:/gi, '')
   .replace(/data:/gi, '')
   .replace(/vbscript:/gi, '')
   ```

3. **Length Limiting**
   ```typescript
   .slice(0, 1000)  // Prevents DoS attacks
   ```

### Validation Examples

| Input                                  | Validation Result        | Output                      |
| -------------------------------------- | ------------------------ | --------------------------- |
| `filter=<script>alert("xss")</script>` | Invalid enum, sanitized  | `filter=unread` (default)   |
| `source=invalid-uuid`                  | Invalid UUID format      | `source=null` (default)     |
| `page=-5`                              | Invalid positive integer | `page=1` (default)          |
| `tags=uuid1,invalid,uuid2`             | Partial validation       | `tags=uuid1,uuid2`          |
| `sort=javascript:alert("xss")`         | Sanitized                | `sort=created_at` (default) |

## Integration Points

### Current Integrations

1. **Inbox Filters** (`useInboxUrlParams`)
   - Validates filter, source, time, and tags parameters
   - Sanitizes all inputs
   - Falls back to defaults for invalid values

2. **Reading Queue** (`useReadingQueueUrlParams`)
   - Validates page, sort, and order parameters
   - Ensures page numbers are positive integers
   - Validates sort field against allowed values

### Adding New Validation

To add validation for new URL parameters:

1. **Create a validator** (or use existing ones)
2. **Add it to the ParamConfig** in the relevant hook
3. **Set sanitize: true** if the parameter should be sanitized
4. **Provide a defaultValue** for graceful degradation

```typescript
// Example: Adding a new parameter
export function useCustomUrlParams() {
  return useUrlParams({
    newParam: {
      defaultValue: 'default',
      validator: createEnumValidator(['option1', 'option2']),
      sanitize: true,
    },
  });
}
```

## Testing

### Unit Tests

- Comprehensive test coverage for all validators
- Edge case testing (null values, empty strings, malformed inputs)
- Security testing (XSS attempts, injection patterns)

### Integration Tests

- End-to-end testing of URL parameter handling
- Mock browser environment testing
- Real-world scenario validation

## Benefits

### 🛡️ **Security**

- Prevents XSS attacks through URL parameters
- Stops injection attempts in query strings
- Limits input size to prevent DoS attacks

### 🎯 **Reliability**

- Graceful handling of invalid parameters
- Consistent default values across the application
- No crashes from malformed URL inputs

### 🔧 **Maintainability**

- Centralized validation logic
- Reusable validator functions
- Type-safe parameter handling

### 📈 **User Experience**

- Silent fallback to sensible defaults
- No error messages for end users
- Consistent behavior across all URL parameters

## Migration Guide

### For Existing Parameters

1. **Identify the parameter type** (enum, UUID, number, etc.)
2. **Choose appropriate validator** or create custom one
3. **Add to ParamConfig** with validation and sanitization
4. **Test with invalid inputs** to ensure proper fallback

### Example Migration

```typescript
// Before
const { params } = useUrlParams({
  status: { defaultValue: 'all' },
});

// After
const { params } = useUrlParams({
  status: {
    defaultValue: 'all',
    validator: createEnumValidator(['all', 'active', 'inactive']),
    sanitize: true,
  },
});
```

This validation system significantly improves the robustness and security of URL parameter handling while maintaining backward compatibility and providing a smooth user experience.
