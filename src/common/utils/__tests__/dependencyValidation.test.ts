import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DependencyValidator, ValidationRules } from '../dependencyValidation';

describe('DependencyValidator Class', () => {
  const mockGetTags = vi.fn(() => Promise.resolve([]));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('creates a validator with default configuration', () => {
      const validator = new DependencyValidator();
      expect(validator).toBeDefined();
    });

    it('validates successfully when no rules are registered', () => {
      const validator = new DependencyValidator();
      expect(validator.validate('unknownFunction', [1, 2, 3])).toBe(true);
    });

    it('skips validation when disabled', () => {
      const validator = new DependencyValidator({ enabled: false });
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0
      });

      expect(validator.validate('testFunction', [1, 2, 3])).toBe(true);
    });

    it('skips validation when dependencies are empty', () => {
      const validator = new DependencyValidator();
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0
      });

      expect(validator.validate('testFunction', [])).toBe(true);
      expect(validator.validate('testFunction', null)).toBe(true);
      expect(validator.validate('testFunction', undefined)).toBe(true);
    });
  });

  describe('Rule registration', () => {
    it('registers and retrieves rules', () => {
      const validator = new DependencyValidator();
      const rule = { functionName: 'testFunction', expectedCount: 1 };

      validator.registerRule(rule);
      expect(validator.getRule('testFunction')).toEqual(rule);
      expect(validator.getRule('nonExistent')).toBeUndefined();
    });

    it('unregisters rules', () => {
      const validator = new DependencyValidator();
      const rule = { functionName: 'testFunction', expectedCount: 1 };

      validator.registerRule(rule);
      expect(validator.getRule('testFunction')).toBeDefined();

      validator.unregisterRule('testFunction');
      expect(validator.getRule('testFunction')).toBeUndefined();
    });
  });

  describe('Expected count validation', () => {
    it('validates exact dependency count', () => {
      const validator = new DependencyValidator();
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 2
      });

      expect(validator.validate('testFunction', ['dep1', 'dep2'])).toBe(true);
      expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
      expect(() => validator.validate('testFunction', ['dep1', 'dep2', 'dep3'])).toThrow();
    });
  });

  describe('Specific dependencies validation', () => {
    it('validates exact dependency values', () => {
      const validator = new DependencyValidator();
      const expectedDeps = [mockGetTags, 'value'];

      validator.registerRule({
        functionName: 'testFunction',
        expectedDeps
      });

      expect(validator.validate('testFunction', expectedDeps)).toBe(true);
      expect(() => validator.validate('testFunction', [mockGetTags, 'different'])).toThrow();
      expect(() => validator.validate('testFunction', [mockGetTags])).toThrow();
    });
  });

  describe('Custom validator', () => {
    it('uses custom validation function', () => {
      const validator = new DependencyValidator();
      const customValidator = vi.fn((deps) => deps.length === 2);

      validator.registerRule({
        functionName: 'testFunction',
        validator: customValidator
      });

      expect(validator.validate('testFunction', ['dep1', 'dep2'])).toBe(true);
      expect(customValidator).toHaveBeenCalledWith(['dep1', 'dep2'], undefined);

      expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
      expect(customValidator).toHaveBeenCalledWith(['dep1'], undefined);
    });

    it('passes context to custom validator', () => {
      const validator = new DependencyValidator();
      const customValidator = vi.fn((deps, context) => context === 'test');

      validator.registerRule({
        functionName: 'testFunction',
        validator: customValidator
      });

      expect(validator.validate('testFunction', ['dep1'], 'test')).toBe(true);
      expect(customValidator).toHaveBeenCalledWith(['dep1'], 'test');
      expect(() => validator.validate('testFunction', ['dep1'], 'other')).toThrow();
      expect(customValidator).toHaveBeenCalledWith(['dep1'], 'other');
    });
  });

  describe('Error handling', () => {
    it('throws errors by default', () => {
      const validator = new DependencyValidator();
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0
      });

      expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
    });

    it('logs warnings when configured not to throw', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      const validator = new DependencyValidator({ throwErrors: false });

      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0
      });

      expect(validator.validate('testFunction', ['dep1'])).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('uses custom error messages', () => {
      const validator = new DependencyValidator();
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0,
        errorMessage: 'Custom error message'
      });

      expect(() => validator.validate('testFunction', ['dep1'])).toThrow('Custom error message');
    });
  });

  describe('Environment handling', () => {
    it('validates in development by default', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const validator = new DependencyValidator();
        validator.registerRule({
          functionName: 'testFunction',
          expectedCount: 0
        });

        expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('skips validation in production by default', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const validator = new DependencyValidator();
        validator.registerRule({
          functionName: 'testFunction',
          expectedCount: 0
        });

        expect(validator.validate('testFunction', ['dep1'])).toBe(true);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('validates in production when forceEnabled is true', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const validator = new DependencyValidator({ forceEnabled: true });
        validator.registerRule({
          functionName: 'testFunction',
          expectedCount: 0
        });

        expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Static factory methods', () => {
    it('creates validator for specific class', () => {
      const validator = DependencyValidator.forClass('MyClass');
      expect(validator).toBeDefined();

      // Should have class-specific error prefix
      validator.registerRule({
        functionName: 'testFunction',
        expectedCount: 0
      });

      expect(() => validator.validate('testFunction', ['dep1'])).toThrow(/Dependency validation failed in MyClass/);
    });

    it('creates validator for production use', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const validator = DependencyValidator.forProduction();
        validator.registerRule({
          functionName: 'testFunction',
          expectedCount: 0
        });

        expect(() => validator.validate('testFunction', ['dep1'])).toThrow();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Default rules', () => {
    it('includes default rules for backward compatibility', () => {
      const validator = new DependencyValidator();

      // Should have rules for updateParam and getParam
      expect(validator.getRule('updateParam')).toBeDefined();
      expect(validator.getRule('getParam')).toBeDefined();
      expect(validator.getRule('updateParam')?.expectedCount).toBe(0);
      expect(validator.getRule('getParam')?.expectedCount).toBe(0);
    });
  });
});

describe('ValidationRules utility', () => {
  it('creates no dependencies rule', () => {
    const rule = ValidationRules.noDependencies('testFunction');
    expect(rule.functionName).toBe('testFunction');
    expect(rule.expectedCount).toBe(0);
    expect(rule.validateInProduction).toBe(false);
  });

  it('creates specific dependencies rule', () => {
    const expectedDeps = ['dep1', 'dep2'];
    const rule = ValidationRules.specificDependencies('testFunction', expectedDeps);
    expect(rule.functionName).toBe('testFunction');
    expect(rule.expectedDeps).toEqual(expectedDeps);
  });

  it('creates custom validation rule', () => {
    const customValidator = vi.fn(() => true);
    const rule = ValidationRules.custom('testFunction', customValidator);
    expect(rule.functionName).toBe('testFunction');
    expect(rule.validator).toBe(customValidator);
  });
});

describe('Integration tests', () => {
  it('works with complex validation scenarios', () => {
    const validator = new DependencyValidator({
      errorPrefix: 'Custom prefix',
      throwErrors: false
    });

    // Register multiple rules
    validator.registerRule(ValidationRules.noDependencies('noDepsFunction'));
    validator.registerRule(ValidationRules.specificDependencies('specificDepsFunction', ['dep1', 'dep2']));
    validator.registerRule(ValidationRules.custom('customFunction', (deps) => deps.length > 1));

    // Test all rules
    expect(validator.validate('noDepsFunction', [])).toBe(true);
    expect(validator.validate('specificDepsFunction', ['dep1', 'dep2'])).toBe(true);
    expect(validator.validate('customFunction', ['dep1', 'dep2', 'dep3'])).toBe(true);

    // Test failures (should not throw, just return false)
    expect(validator.validate('noDepsFunction', ['dep1'])).toBe(false);
    expect(validator.validate('specificDepsFunction', ['wrong'])).toBe(false);
    expect(validator.validate('customFunction', ['single'])).toBe(false);
  });
});
