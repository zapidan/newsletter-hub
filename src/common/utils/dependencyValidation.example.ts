import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';
import React, { useCallback, useState } from 'react';

/**
 * Example of how different classes can use the dependency validation system
 * This demonstrates production-ready usage with custom validation rules
 */

// Example Class 1: Data Service with strict validation rules
export class DataService {
  private validator: DependencyValidator;

  constructor() {
    // Create a validator specifically for this class that can run in production
    this.validator = DependencyValidator.forProduction({
      errorPrefix: 'DataService validation failed',
      rules: [
        ValidationRules.noDependencies('fetchData'),
        ValidationRules.specificDependencies('processData', ['data', 'config']),
        ValidationRules.custom('validateData', (deps) => {
          // Custom validation: must have at least one function dependency
          return deps.some(dep => typeof dep === 'function');
        })
      ]
    });
  }

  fetchData = () => {
    // This should have no dependencies
    this.validator.validate('fetchData', []); // Should pass
    return { data: 'fetched' };
  };

  processData = (data: unknown, config: unknown) => {
    // This should have exactly [data, config] dependencies
    this.validator.validate('processData', [data, config]); // Should pass
    return { ...data, processed: true };
  };

  validateData = (data: unknown, validatorFn: (data: unknown) => boolean) => {
    // This uses custom validation - must have at least one function
    this.validator.validate('validateData', [data, validatorFn]); // Should pass
    return validatorFn(data);
  };
}

// Example Class 2: UI Component with different validation rules
export class UIComponent {
  private validator: DependencyValidator;

  constructor() {
    // Create a validator for UI components with different rules
    this.validator = new DependencyValidator({
      errorPrefix: 'UIComponent validation failed',
      forceEnabled: process.env.NODE_ENV === 'production', // Enable in production for critical UI functions
      rules: [
        ValidationRules.noDependencies('handleClose'),
        ValidationRules.specificDependencies('handleSubmit', ['onSubmit', 'formData']),
      ]
    });
  }

  handleClose = () => {
    // Should have no dependencies
    this.validator.validate('handleClose', []); // Should pass
    console.log('Modal closed');
  };

  handleSubmit = (onSubmit: (formData: unknown) => void, formData: unknown) => {
    // Should have exactly [onSubmit, formData] dependencies
    this.validator.validate('handleSubmit', [onSubmit, formData]); // Should pass
    onSubmit(formData);
  };
}

// Example Class 3: Custom validator with complex rules
export class AdvancedValidator {
  private validator: DependencyValidator;

  constructor() {
    this.validator = new DependencyValidator({
      errorPrefix: 'Advanced validation failed',
      forceEnabled: true, // Always enabled
      throwErrors: false, // Log warnings instead of throwing
      rules: [
        {
          functionName: 'complexOperation',
          validator: (deps, context) => {
            // Custom complex validation logic
            if (!deps || deps.length < 2) return false;
            if (typeof deps[0] !== 'function') return false;
            if (context !== 'production') return false;
            return true;
          },
          errorMessage: 'Complex operation requires at least 2 dependencies with first being a function, and must run in production context'
        }
      ]
    });
  }

  complexOperation = (callback: (data: unknown) => unknown, data: unknown) => {
    // Uses complex custom validation
    this.validator.validate('complexOperation', [callback, data], 'production'); // Should pass in production
    return callback(data);
  };
}

// Example React Hook using the new validation system
export function useValidatedHook() {
  const [state, setState] = useState(0);

  // Create a validator for this hook - stable reference
  const validator = React.useMemo(() =>
    new DependencyValidator({
      rules: [
        ValidationRules.noDependencies('increment'),
        ValidationRules.specificDependencies('setValue', [setState])
      ]
    }),
    []
  );

  const increment = useCallback(() => {
    validator.validate('increment', []); // Should pass - no dependencies
    setState(prev => prev + 1);
  }, [validator]);

  const setValue = useCallback((value: number) => {
    validator.validate('setValue', [setState]); // Should pass - specific dependencies
    setState(value);
  }, [setState, validator]);

  return { state, increment, setValue };
}

// Example of how to use different validators in production
export function exampleUsage() {
  // Different classes can use different validation strategies
  const dataService = new DataService(); // Strict, production-enabled validation
  const uiComponent = new UIComponent(); // UI-specific validation
  const advancedValidator = new AdvancedValidator(); // Custom validation with warnings

  // Each class uses its own validator configuration
  dataService.fetchData(); // Uses production-enabled validator
  uiComponent.handleClose(); // Uses UI-specific validator
  advancedValidator.complexOperation((data: unknown) => data, { test: true }); // Uses custom validator

  return { dataService, uiComponent, advancedValidator };
}
