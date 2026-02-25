# Dependency Validation

## Overview

The dependency validation system provides a robust way to validate function dependencies in React hooks and other classes. This helps catch common React dependency array mistakes and ensures proper re-rendering behavior.

## Purpose

- **Prevent Stale Closures**: Catch missing dependencies in useCallback and useMemo
- **Validate Hook Dependencies**: Ensure dependency arrays are correct
- **Production Safety**: Optional validation that can be enabled in production for critical functions
- **Custom Rules**: Flexible validation system for different use cases

## Quick Start

```typescript
import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';

// Create a validator for your hook
const validator = new DependencyValidator({
  rules: [
    ValidationRules.noDependencies('increment'),
    ValidationRules.specificDependencies('setValue', [setState])
  ]
});

// Use in your functions
const increment = useCallback(() => {
  validator.validate('increment', []); // Validates no dependencies
  setState(prev => prev + 1);
}, [validator]);
```

## Core Concepts

### DependencyValidator

The main class that handles validation logic:

```typescript
const validator = new DependencyValidator({
  errorPrefix: 'MyComponent validation failed',
  forceEnabled: false, // Only enabled in development
  throwErrors: true,   // Throw errors vs log warnings
  rules: [...]         // Validation rules
});
```

### Validation Rules

Built-in rules for common scenarios:

- **ValidationRules.noDependencies()**: Function should have no dependencies
- **ValidationRules.specificDependencies()**: Function should have exact dependencies
- **ValidationRules.custom()**: Custom validation logic

### Production Usage

For critical functions, enable validation in production:

```typescript
const validator = DependencyValidator.forProduction({
  errorPrefix: 'CriticalService validation failed',
  rules: [
    ValidationRules.specificDependencies('processData', ['data', 'config'])
  ]
});
```

## Examples

### React Hook Example

```typescript
import React, { useCallback, useState } from 'react';
import { DependencyValidator, ValidationRules } from '@common/utils/dependencyValidation';

export function useValidatedHook() {
  const [state, setState] = useState(0);

  // Create validator with stable reference
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
```

### Service Class Example

```typescript
export class DataService {
  private validator: DependencyValidator;

  constructor() {
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
    this.validator.validate('fetchData', []); // Should pass
    return { data: 'fetched' };
  };

  processData = (data: unknown, config: unknown) => {
    this.validator.validate('processData', [data, config]); // Should pass
    return { ...data, processed: true };
  };
}
```

### Custom Validation Rules

```typescript
const validator = new DependencyValidator({
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
      errorMessage: 'Complex operation requires at least 2 dependencies with first being a function'
    }
  ]
});
```

## Best Practices

### 1. Use Stable Validator References

```typescript
// ✅ Good: Stable reference with useMemo
const validator = React.useMemo(() =>
  new DependencyValidator({ rules: [...] }),
  []
);

// ❌ Bad: Creates new validator on every render
const validator = new DependencyValidator({ rules: [...] });
```

### 2. Include Validator in Dependencies

```typescript
// ✅ Good: Include validator in dependency array
const increment = useCallback(() => {
  validator.validate('increment', []);
  setState(prev => prev + 1);
}, [validator]);

// ❌ Bad: Missing validator dependency
const increment = useCallback(() => {
  validator.validate('increment', []);
  setState(prev => prev + 1);
}, []); // Missing validator
```

### 3. Use Production Validation for Critical Functions

```typescript
// For critical business logic that should always validate
const validator = DependencyValidator.forProduction({
  errorPrefix: 'CriticalService validation failed',
  rules: [...]
});
```

### 4. Custom Rules for Complex Logic

```typescript
// Use custom rules when built-in ones aren't sufficient
ValidationRules.custom('validateData', (deps) => {
  return deps.some(dep => typeof dep === 'function');
});
```

## Configuration Options

### DependencyValidator Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `errorPrefix` | string | 'Validation failed' | Prefix for error messages |
| `forceEnabled` | boolean | false | Force validation even in production |
| `throwErrors` | boolean | true | Throw errors vs log warnings |
| `rules` | ValidationRule[] | [] | Array of validation rules |

### Environment Behavior

- **Development**: Validation enabled by default
- **Production**: Validation disabled unless `forceEnabled: true`
- **Test**: Validation behavior follows environment settings

## Complete Example

For a comprehensive example showing different usage patterns, see:

**`src/common/utils/dependencyValidation.example.ts`**

This example includes:
- Service class with production validation
- UI component with custom rules
- Advanced validation with complex logic
- React hook integration
- Multiple validator strategies

## Error Messages

The system provides clear error messages for debugging:

```
DataService validation failed: fetchData should have no dependencies, but got: [data, config]
```

```
MyComponent validation failed: setValue should have dependencies: [setState], but got: []
```

## Migration Guide

### From Manual Validation

```typescript
// Before: Manual checking
const increment = useCallback(() => {
  if (process.env.NODE_ENV === 'development') {
    console.assert(dependencies.length === 0, 'increment should have no dependencies');
  }
  setState(prev => prev + 1);
}, []);

// After: Automated validation
const validator = new DependencyValidator({
  rules: [ValidationRules.noDependencies('increment')]
});

const increment = useCallback(() => {
  validator.validate('increment', []);
  setState(prev => prev + 1);
}, [validator]);
```

## Troubleshooting

### Common Issues

1. **Validator Not in Dependencies**: Missing validator in useCallback/useMemo dependency arrays
2. **Unstable Validator Reference**: Creating new validators on every render
3. **Wrong Rule Usage**: Using noDependencies when specificDependencies is needed

### Debug Mode

Enable debug logging to see validation decisions:

```typescript
const validator = new DependencyValidator({
  forceEnabled: true,
  throwErrors: false, // Log warnings instead of throwing
  rules: [...]
});
```

## API Reference

See the example file for complete API usage and advanced patterns:

**`src/common/utils/dependencyValidation.example.ts`**
