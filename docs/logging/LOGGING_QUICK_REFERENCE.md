# Logging Migration Quick Reference Card

## 🚀 Quick Start

### 1. Add Logger Import
```typescript
// For React components
import { useLogger } from '@common/utils/logger';

// For utilities/services
import { useLoggerStatic } from '@common/utils/logger';
```

### 2. Initialize Logger
```typescript
// In React component
const MyComponent = () => {
  const log = useLogger('MyComponent');
  // ...
};

// In utility/service file
const log = useLoggerStatic();
```

### 3. Replace Console Statements
```typescript
// Before
console.log('User clicked button');
console.error('API call failed:', error);
console.warn('Deprecated feature used');

// After
log.info('User clicked button', {
  action: 'button_click',
  metadata: { buttonId: 'submit' }
});

log.error('API call failed', {
  action: 'api_call',
  metadata: { endpoint: '/api/data', method: 'POST' }
}, error);

log.warn('Deprecated feature used', {
  action: 'feature_usage',
  metadata: { feature: 'oldApi' }
});
```

## 📋 Log Level Mapping

| Console Method | Logger Method | Use Case |
|---|---|---|
| `console.log()` | `log.debug()` | Debug info, development only |
| `console.log()` | `log.info()` | User actions, general flow |
| `console.warn()` | `log.warn()` | Non-critical issues |
| `console.error()` | `log.error()` | Errors with error object |

## 🎯 Pattern Examples

### User Actions
```typescript
const handleSubmit = async () => {
  log.logUserAction('form_submit', {
    metadata: { formType: 'newsletter', fieldsCount: 5 }
  });
  // ...
};
```

### API Calls
```typescript
try {
  const data = await apiCall();
  log.api('API call successful', {
    action: 'fetch_data',
    metadata: { endpoint: '/api/newsletters', count: data.length }
  });
} catch (error) {
  log.error('API call failed', {
    action: 'fetch_data',
    metadata: { endpoint: '/api/newsletters' }
  }, error);
}
```

### Error Handling
```typescript
try {
  await operation();
} catch (error) {
  log.error('Operation failed', {
    component: 'ComponentName',
    action: 'operation_name',
    metadata: { 
      userId: user?.id,
      operationType: 'data_update',
      timestamp: new Date().toISOString()
    }
  }, error instanceof Error ? error : new Error(String(error)));
}
```

### Performance Monitoring
```typescript
const timer = log.startTimer('data_processing');
try {
  // ... expensive operation
} finally {
  timer(); // Automatically logs completion time
}
```

## 🏗 Context Structure

### Required Context
```typescript
{
  action: 'descriptive_action_name',    // Required: what action is being logged
  metadata?: {                          // Optional: additional context
    // Any relevant data for debugging
  }
}
```

### Component Context (Auto-added)
```typescript
// When using useLogger('ComponentName'), auto-added:
{
  component: 'ComponentName',
  // ... your context
}
```

### User Context (Auto-added)
```typescript
// Automatically included in all logs:
[user id] {abc123}  // or {anonymous}
```

## 🔧 Common Migration Patterns

### Debug Logging
```typescript
// Before
console.log('🔍 Query params:', params);

// After
log.debug('Query params prepared', {
  action: 'prepare_query',
  metadata: { params }
});
```

### Error Logging with Context
```typescript
// Before
console.error('Failed to save:', error);

// After
log.error('Failed to save data', {
  action: 'save_data',
  metadata: { 
    dataType: 'newsletter',
    id: item.id 
  }
}, error);
```

### Conditional Debug Logging
```typescript
// Before
if (debug) {
  console.log('Debug info:', data);
}

// After - automatic filtering based on environment
log.debug('Debug information', {
  action: 'debug_info',
  metadata: { data }
});
```

## 🎨 Specialized Loggers

### Auth Operations
```typescript
log.auth('User signed in', {
  metadata: { method: 'email', timestamp: Date.now() }
});
```

### API Operations
```typescript
log.api('Newsletter fetched', {
  metadata: { id: newsletter.id, source: newsletter.source }
});
```

### UI Interactions
```typescript
log.ui('Modal opened', {
  metadata: { modalType: 'newsletter_detail', triggeredBy: 'card_click' }
});
```

## 🚦 Environment Behavior

| Environment | Log Level | Console Output |
|---|---|---|
| Development | DEBUG | All logs shown |
| Staging | INFO | Info, warn, error shown |
| Production | WARN | Only warn, error shown |

## ⚡ Quick Commands

```bash
# Check remaining console statements
npm run logs:scan

# Run with debug logging
npm run logs:dev

# Run with production logging
npm run logs:prod

# Generate migration report
npm run logs:report
```

## 🎯 Migration Priorities

### High Priority (Complete First)
1. **Pages** - User-facing components
2. **API Services** - Data operations
3. **Hooks** - Business logic

### Medium Priority
4. **Utilities** - Helper functions
5. **Components** - UI components

### Low Priority
6. **Config** - Configuration files
7. **Types** - Type definitions

## ✅ Validation Checklist

After migrating a file:
- [ ] Logger imported correctly
- [ ] Logger initialized in component/service
- [ ] All console statements replaced
- [ ] Error objects passed to log.error()
- [ ] Meaningful action names used
- [ ] Relevant metadata included
- [ ] Test the logging in development

## 🐛 Common Issues & Fixes

### Issue: `log is not defined`
```typescript
// ❌ Forgot to initialize
const MyComponent = () => {
  log.info('message'); // Error!
};

// ✅ Initialize logger
const MyComponent = () => {
  const log = useLogger('MyComponent');
  log.info('message'); // Works!
};
```

### Issue: Error object not passed correctly
```typescript
// ❌ Error as string
log.error('Failed', { action: 'test' }, error.message);

// ✅ Error as Error object
log.error('Failed', { action: 'test' }, 
  error instanceof Error ? error : new Error(String(error)));
```

### Issue: Missing action context
```typescript
// ❌ No action context
log.info('Something happened');

// ✅ With action context
log.info('Something happened', { action: 'descriptive_name' });
```

## 📚 Additional Resources

- **Full Documentation**: `docs/LOGGING.md`
- **Implementation Guide**: `docs/LOGGING_IMPLEMENTATION_SUMMARY.md`
- **Migration Status**: `docs/LOGGING_MIGRATION_STATUS.md`
- **Logger Source**: `src/common/utils/logger/`

---

**Happy Logging! 🎉**
*Remember: Good logs are your future self's best friend.*