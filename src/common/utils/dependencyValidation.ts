import React from 'react';

/**
 * Configuration for dependency validation rules
 */
export interface DependencyValidationRule {
  /** Function name to validate */
  functionName: string;
  /** Expected number of dependencies */
  expectedCount?: number;
  /** Expected specific dependencies (functions or values) */
  expectedDeps?: React.DependencyList;
  /** Custom validation function */
  validator?: (deps: React.DependencyList, context?: unknown) => boolean;
  /** Error message when validation fails */
  errorMessage?: string;
  /** Whether to validate in production */
  validateInProduction?: boolean;
}

/**
 * Configuration for the dependency validator
 */
export interface DependencyValidatorConfig {
  /** Whether validation is enabled */
  enabled?: boolean;
  /** Environment override - if true, validates in all environments */
  forceEnabled?: boolean;
  /** Custom validation rules */
  rules?: DependencyValidationRule[];
  /** Default error message prefix */
  errorPrefix?: string;
  /** Whether to throw errors or just log warnings */
  throwErrors?: boolean;
}

/**
 * Class-based dependency validator that can be configured for different use cases
 * Designed to be used in production by different classes with custom validation rules
 */
export class DependencyValidator {
  private config: Required<DependencyValidatorConfig>;
  private rules: Map<string, DependencyValidationRule> = new Map();

  constructor(config: DependencyValidatorConfig = {}) {
    this.config = {
      enabled: true,
      forceEnabled: false,
      rules: [],
      errorPrefix: 'Dependency validation failed',
      throwErrors: true,
      ...config
    };

    // Register default rules
    this.registerDefaultRules();

    // Register custom rules
    if (config.rules) {
      config.rules.forEach(rule => this.registerRule(rule));
    }
  }

  /**
   * Check if validation should run
   */
  private shouldValidate(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.forceEnabled) return true;
    return process.env.NODE_ENV !== 'production';
  }

  /**
   * Register a custom validation rule
   */
  registerRule(rule: DependencyValidationRule): void {
    this.rules.set(rule.functionName, rule);
  }

  /**
   * Remove a validation rule
   */
  unregisterRule(functionName: string): void {
    this.rules.delete(functionName);
  }

  /**
   * Get a registered rule
   */
  getRule(functionName: string): DependencyValidationRule | undefined {
    return this.rules.get(functionName);
  }

  /**
   * Validate dependencies for a specific function
   */
  validate(
    functionName: string,
    deps: React.DependencyList,
    context?: unknown
  ): boolean {
    if (!this.shouldValidate()) return true;

    const rule = this.rules.get(functionName);
    if (!rule) return true; // No rule defined, skip validation

    try {
      return this.validateAgainstRule(rule, deps, context);
    } catch (error) {
      if (this.config.throwErrors) {
        throw error;
      } else {
        console.warn(`${this.config.errorPrefix}:`, error.message);
        return false;
      }
    }
  }

  /**
   * Validate dependencies against a specific rule
   */
  private validateAgainstRule(
    rule: DependencyValidationRule,
    deps: React.DependencyList,
    context?: unknown
  ): boolean {
    // Skip if no dependencies to validate
    if (!deps || deps.length === 0) return true;

    // Custom validator takes precedence
    if (rule.validator) {
      if (!rule.validator(deps, context)) {
        throw new Error(
          rule.errorMessage ||
          `${this.config.errorPrefix}: Custom validation failed for ${rule.functionName}`
        );
      }
      return true;
    }

    // Check expected count
    if (rule.expectedCount !== undefined && deps.length !== rule.expectedCount) {
      throw new Error(
        rule.errorMessage ||
        `${this.config.errorPrefix}: ${rule.functionName} expected ${rule.expectedCount} dependencies but got ${deps.length}`
      );
    }

    // Check specific expected dependencies
    if (rule.expectedDeps) {
      if (deps.length !== rule.expectedDeps.length) {
        throw new Error(
          rule.errorMessage ||
          `${this.config.errorPrefix}: ${rule.functionName} expected ${rule.expectedDeps.length} dependencies but got ${deps.length}`
        );
      }

      for (let i = 0; i < deps.length; i++) {
        if (deps[i] !== rule.expectedDeps[i]) {
          throw new Error(
            rule.errorMessage ||
            `${this.config.errorPrefix}: ${rule.functionName} dependency at index ${i} doesn't match expected value`
          );
        }
      }
    }

    return true;
  }

  /**
   * Register default rules for backward compatibility
   */
  private registerDefaultRules(): void {
    // Rule for functions that should have no dependencies
    this.registerRule({
      functionName: 'updateParam',
      expectedCount: 0,
      errorMessage: `CRITICAL: useCallback for updateParam has dependencies that will cause infinite loops. The dependencies array must remain [] (empty) to prevent unnecessary re-renders.`,
      validateInProduction: false
    });

    this.registerRule({
      functionName: 'getParam',
      expectedCount: 0,
      errorMessage: `CRITICAL: useCallback for getParam has dependencies that will cause infinite loops. The dependencies array must remain [] (empty) to prevent unnecessary re-renders.`,
      validateInProduction: false
    });
  }

  /**
   * Create a validator instance for a specific class/context
   */
  static forClass(className: string, config?: DependencyValidatorConfig): DependencyValidator {
    return new DependencyValidator({
      errorPrefix: `Dependency validation failed in ${className}`,
      ...config
    });
  }

  /**
   * Create a validator that can run in production
   */
  static forProduction(config?: Omit<DependencyValidatorConfig, 'forceEnabled'>): DependencyValidator {
    return new DependencyValidator({
      forceEnabled: true,
      ...config
    });
  }
}

/**
 * Utility function to create common validation rules
 */
export const ValidationRules = {
  /**
   * Rule for functions that should have no dependencies
   */
  noDependencies: (functionName: string): DependencyValidationRule => ({
    functionName,
    expectedCount: 0,
    errorMessage: `CRITICAL: useCallback for ${functionName} has dependencies that will cause infinite loops. The dependencies array must remain [] (empty) to prevent unnecessary re-renders.`,
    validateInProduction: false
  }),

  /**
   * Rule for functions with specific dependencies
   */
  specificDependencies: (
    functionName: string,
    expectedDeps: React.DependencyList,
    errorMessage?: string
  ): DependencyValidationRule => ({
    functionName,
    expectedDeps,
    errorMessage: errorMessage || `CRITICAL: useCallback for ${functionName} must have exactly the expected dependencies to prevent infinite loops.`,
    validateInProduction: false
  }),

  /**
   * Custom validation rule
   */
  custom: (
    functionName: string,
    validator: (deps: React.DependencyList, context?: unknown) => boolean,
    errorMessage?: string
  ): DependencyValidationRule => ({
    functionName,
    validator,
    errorMessage,
    validateInProduction: false
  })
};
