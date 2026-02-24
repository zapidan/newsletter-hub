import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUrlParams } from '../useUrlParams';

// Wrapper component that provides router context
const createWrapper = (initialEntries = ['/']) => {
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      MemoryRouter,
      { initialEntries },
      children
    );
  };
};

describe('useUrlParams Dependency Validation', () => {
  beforeEach(() => {
    // Clear any previous console errors
    vi.clearAllMocks();
  });

  it('DependencyValidator class validates updateParam with no dependencies', () => {
    // Test that the new DependencyValidator class correctly validates
    // that updateParam should have no dependencies to prevent infinite loops

    const validator = new DependencyValidator({
      errorPrefix: 'useUrlParams validation failed',
      rules: [
        ValidationRules.noDependencies('updateParam')
      ]
    });

    // Test that empty dependencies pass validation
    expect(() => {
      validator.validate('updateParam', []);
    }).not.toThrow();

    // Test that any dependencies fail validation
    expect(() => {
      validator.validate('updateParam', ['extra']);
    }).toThrow('CRITICAL: useCallback for updateParam has dependencies');
  });

  it('DependencyValidator class validates getParam with no dependencies', () => {
    // Test that the new DependencyValidator class correctly validates
    // that getParam should have no dependencies to prevent infinite loops

    const validator = new DependencyValidator({
      errorPrefix: 'useUrlParams validation failed',
      rules: [
        ValidationRules.noDependencies('getParam')
      ]
    });

    // Test that empty dependencies pass validation
    expect(() => {
      validator.validate('getParam', []);
    }).not.toThrow();

    // Test that any dependencies fail validation
    expect(() => {
      validator.validate('getParam', ['extra']);
    }).toThrow('CRITICAL: useCallback for getParam has dependencies');
  });

  it('useUrlParams hook works with new validation system', () => {
    // Test that the useUrlParams hook works correctly with the new
    // DependencyValidator class internally

    const { result } = renderHook(
      () => useUrlParams({
        test: { defaultValue: 'default' }
      }),
      { wrapper: createWrapper() }
    );

    // The hook should work normally when dependencies are correct
    expect(() => {
      // Test that functions are callable without throwing
      result.current.updateParam('test', 'new-value');
      const value = result.current.getParam('test');
      // Note: updateParam might not immediately reflect in getParam due to URL update timing
      // We're just testing that the functions don't throw and the validation system works
    }).not.toThrow();
  });

  it('DependencyValidator respects environment settings', () => {
    // Test that the DependencyValidator only runs validation in development/test
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Temporarily set to production
      process.env.NODE_ENV = 'production';

      const validator = new DependencyValidator({
        errorPrefix: 'Production test',
        rules: [
          ValidationRules.noDependencies('testFunction')
        ]
      });

      // Should not validate in production (unless forceEnabled is true)
      expect(() => {
        validator.validate('testFunction', ['should-not-fail-in-production']);
      }).not.toThrow();

    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('DependencyValidator can force validation in production', () => {
    // Test that DependencyValidator.forProduction enables validation in all environments
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Temporarily set to production
      process.env.NODE_ENV = 'production';

      const validator = DependencyValidator.forProduction({
        errorPrefix: 'Forced production validation',
        rules: [
          ValidationRules.noDependencies('criticalFunction')
        ]
      });

      // Should validate even in production when forceEnabled is true
      expect(() => {
        validator.validate('criticalFunction', ['should-fail']);
      }).toThrow('CRITICAL: useCallback for criticalFunction has dependencies');

    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
