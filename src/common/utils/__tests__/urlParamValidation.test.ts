import { describe, expect, it } from 'vitest';
import {
  booleanValidator,
  createEnumValidator,
  createStringValidator,
  inboxFilterValidator,
  orderDirectionValidator,
  positiveIntegerValidator,
  sanitizeUrlParam,
  sanitizeUrlQuery,
  sortFieldValidator,
  timeRangeValidator,
  uuidArrayValidator,
  uuidValidator,
  validateParams,
} from '../urlParamValidation';

describe('URL Parameter Validation Utilities', () => {
  describe('createEnumValidator', () => {
    const statusValidator = createEnumValidator(['active', 'inactive', 'pending'] as const);

    it('should validate valid enum values', () => {
      expect(statusValidator('active')).toEqual({
        isValid: true,
        value: 'active',
      });
      expect(statusValidator('INACTIVE')).toEqual({
        isValid: true,
        value: 'inactive',
      });
    });

    it('should reject invalid enum values', () => {
      expect(statusValidator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: active, inactive, pending',
      });
    });

    it('should handle null/empty values', () => {
      expect(statusValidator(null)).toEqual({
        isValid: false,
        value: undefined,
        error: 'Value is required but no default provided',
      });

      expect(statusValidator(null, 'active')).toEqual({
        isValid: true,
        value: 'active',
        defaultValue: 'active',
      });
    });
  });

  describe('uuidValidator', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const invalidUuid = 'invalid-uuid';

    it('should validate valid UUIDs', () => {
      expect(uuidValidator(validUuid)).toEqual({
        isValid: true,
        value: validUuid,
      });
    });

    it('should reject invalid UUIDs', () => {
      expect(uuidValidator(invalidUuid)).toEqual({
        isValid: false,
        value: undefined,
        error: `Invalid UUID format: "${invalidUuid}"`,
      });
    });

    it('should handle null/empty values', () => {
      expect(uuidValidator(null)).toEqual({
        isValid: false,
        value: undefined,
        error: 'UUID is required but no default provided',
      });

      expect(uuidValidator(null, validUuid)).toEqual({
        isValid: true,
        value: validUuid,
        defaultValue: validUuid,
      });
    });
  });

  describe('uuidArrayValidator', () => {
    const validUuids = ['123e4567-e89b-12d3-a456-426614174000', '456e7890-e89b-12d3-a456-426614174001'];
    const invalidUuids = ['123e4567-e89b-12d3-a456-426614174000', 'invalid-uuid'];

    it('should validate valid UUID arrays', () => {
      const input = validUuids.join(',');
      expect(uuidArrayValidator(input)).toEqual({
        isValid: true,
        value: validUuids,
      });
    });

    it('should handle mixed valid/invalid UUID arrays', () => {
      const input = invalidUuids.join(',');
      expect(uuidArrayValidator(input)).toEqual({
        isValid: false,
        defaultValue: [],
        value: [validUuids[0]], // Only valid UUIDs
        error: 'Invalid UUIDs found: invalid-uuid',
      });
    });

    it('should handle empty strings', () => {
      expect(uuidArrayValidator('')).toEqual({
        isValid: true,
        value: [],
        defaultValue: [],
      });
    });
  });

  describe('positiveIntegerValidator', () => {
    it('should validate positive integers', () => {
      expect(positiveIntegerValidator('5')).toEqual({
        isValid: true,
        value: 5,
      });
    });

    it('should reject negative numbers', () => {
      expect(positiveIntegerValidator('-1')).toEqual({
        isValid: false,
        defaultValue: 1,
        value: 1,
        error: 'Invalid positive integer: "-1"',
      });
    });

    it('should reject non-numbers', () => {
      expect(positiveIntegerValidator('abc')).toEqual({
        isValid: false,
        value: 1,
        defaultValue: 1,
        error: 'Invalid positive integer: "abc"',
      });
    });

    it('should use default value', () => {
      expect(positiveIntegerValidator('abc', 10)).toEqual({
        isValid: false,
        value: 10,
        defaultValue: 10,
        error: 'Invalid positive integer: "abc"',
      });
    });
  });

  describe('booleanValidator', () => {
    it('should validate boolean true values', () => {
      expect(booleanValidator('true')).toEqual({ isValid: true, value: true });
      expect(booleanValidator('1')).toEqual({ isValid: true, value: true });
      expect(booleanValidator('yes')).toEqual({ isValid: true, value: true });
    });

    it('should validate boolean false values', () => {
      expect(booleanValidator('false')).toEqual({ isValid: true, value: false });
      expect(booleanValidator('0')).toEqual({ isValid: true, value: false });
      expect(booleanValidator('no')).toEqual({ isValid: true, value: false });
    });

    it('should reject invalid boolean values', () => {
      expect(booleanValidator('maybe')).toEqual({
        isValid: false,
        defaultValue: false,
        value: false,
        error: 'Invalid boolean value: "maybe". Use true/false, 1/0, or yes/no',
      });
    });
  });

  describe('createStringValidator', () => {
    it('should validate with allowed values', () => {
      const validator = createStringValidator({
        allowedValues: ['option1', 'option2', 'option3'],
      });

      expect(validator('option1')).toEqual({ isValid: true, value: 'option1' });
      expect(validator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: option1, option2, option3',
      });
    });

    it('should validate with length constraints', () => {
      const validator = createStringValidator({
        minLength: 3,
        maxLength: 10,
      });

      expect(validator('abc')).toEqual({ isValid: true, value: 'abc' });
      expect(validator('ab')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Value too short. Minimum length: 3',
      });
      expect(validator('abcdefghijk')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Value too long. Maximum length: 10',
      });
    });

    it('should validate with pattern', () => {
      const validator = createStringValidator({
        pattern: /^[a-z]+$/,
      });

      expect(validator('abc')).toEqual({ isValid: true, value: 'abc' });
      expect(validator('abc123')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Value does not match required pattern',
      });
    });
  });

  describe('sanitizeUrlParam', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeUrlParam('<script>alert("xss")</script>test')).toBe('test');
      expect(sanitizeUrlParam('<div>content</div>')).toBe('content');
    });

    it('should remove dangerous protocols', () => {
      expect(sanitizeUrlParam('javascript:alert("xss")')).toBe('alert("xss")');
      expect(sanitizeUrlParam('data:text/html,<script>alert("xss")</script>')).toBe('text/html,');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(1500);
      expect(sanitizeUrlParam(longString)).toHaveLength(1000);
    });

    it('should trim whitespace', () => {
      expect(sanitizeUrlParam('  test  ')).toBe('test');
    });
  });

  describe('sanitizeUrlQuery', () => {
    it('should sanitize all parameters', () => {
      const result = sanitizeUrlQuery('param1=alert("xss")&param2=normal&param3=alert%28%22xss%22');

      expect(result).toContain('param1=alert%28%22xss%22%29');
      expect(result).toContain('param2=normal');
      expect(result).toContain('param3=alert%28%22xss%22');
    });

    it('should remove empty parameters', () => {
      const query = 'param1=value1&param2=&param3=value3';
      const result = sanitizeUrlQuery(query);

      expect(result).toContain('param1=value1');
      expect(result).toContain('param3=value3');
      expect(result).not.toContain('param2=');
    });
  });

  describe('validateParams', () => {
    it('should validate multiple parameters', () => {
      const schema = {
        status: {
          validator: createEnumValidator(['active', 'inactive'] as const),
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

      const params = {
        status: 'active',
        id: '123e4567-e89b-12d3-a456-426614174000',
        page: '2',
      };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(true);
      expect(result.values).toEqual({
        status: 'active',
        id: '123e4567-e89b-12d3-a456-426614174000',
        page: 2,
      });
      expect(result.errors).toEqual({});
    });

    it('should collect validation errors', () => {
      const schema = {
        status: {
          validator: createEnumValidator(['active', 'inactive'] as const),
          required: true,
        },
        id: {
          validator: uuidValidator,
          required: true,
        },
      };

      const params = {
        status: 'invalid',
        id: 'invalid-uuid',
      };

      const result = validateParams(params, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({
        status: 'Invalid value "invalid". Must be one of: active, inactive',
        id: 'Invalid UUID format: "invalid-uuid"',
      });
    });
  });

  describe('predefined validators', () => {
    it('should validate inbox filters', () => {
      expect(inboxFilterValidator('unread')).toEqual({ isValid: true, value: 'unread' });
      expect(inboxFilterValidator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: unread, read, liked, archived',
      });
    });

    it('should validate time ranges', () => {
      expect(timeRangeValidator('day')).toEqual({ isValid: true, value: 'day' });
      expect(timeRangeValidator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: day, 2days, week, month, all',
      });
    });

    it('should validate order directions', () => {
      expect(orderDirectionValidator('asc')).toEqual({ isValid: true, value: 'asc' });
      expect(orderDirectionValidator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: asc, desc',
      });
    });

    it('should validate sort fields', () => {
      expect(sortFieldValidator('created_at')).toEqual({ isValid: true, value: 'created_at' });
      expect(sortFieldValidator('invalid')).toEqual({
        isValid: false,
        value: undefined,
        error: 'Invalid value "invalid". Must be one of: created_at, updated_at, title, published_at, read_at, name',
      });
    });
  });
});
