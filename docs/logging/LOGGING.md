# Logging System Documentation

## Overview

This document describes the production-ready logging system implemented for the Newsletter Hub application. The system provides structured logging with user context, log levels, and performance monitoring capabilities.

## Features

- **User Context Tracking**: Every log includes user ID with format `[user id] {user-id-value}`
- **Structured Log Levels**: DEBUG, INFO, WARN, ERROR
- **Component-based Logging**: Logs are tagged with component names for easy filtering
- **Performance Monitoring**: Built-in timing and API request/response logging
- **Environment-based Filtering**: Different log levels for development vs production
- **Error Boundary Integration**: Automatic error logging with React error boundaries
- **External Service Integration**: Ready for integration with services like Sentry, LogRocket, etc.

## Usage

### Basic Usage

```typescript
import { useLogger } from '@common/utils/logger';

const MyComponent = () => {
  const log = useLogger('MyComponent');

  const handleClick = async () => {
    log.info('User clicked button', {
      action: 'button_click',
      metadata: { buttonId: 'submit' }
    });

    try {
      await someAsyncOperation();
      log.info('Operation completed successfully');
    } catch (error) {
      log.error('Operation failed', {
        action: 'async_operation',
        metadata: { operationType: 'data_fetch' }
      }, error);
    }
  };

  return <button onClick={handleClick}>Click me</button>;
};
```

### Static Logger (Outside React Components)

```typescript
import { useLoggerStatic } from '@common/utils/logger';

const log = useLoggerStatic();

// API service example
export const fetchData = async (url: string) => {
  const timer = log.startTimer('fetchData');
  
  try {
    log.logApiRequest(url, 'GET');
    const response = await fetch(url);
    
    log.logApiResponse(url, 'GET', response.status, performance.now());
    return response.json();
  } catch (error) {
    log.error('API fetch failed', {
      component: 'DataService',
      metadata: { url }
    }, error);
    throw error;
  } finally {
    timer(); // Logs completion time
  }
};
```

### Error Boundary Usage

```typescript
import { ErrorBoundary, withErrorBoundary } from '@common/utils/logger';

// Wrap individual components
const SafeComponent = withErrorBoundary(MyComponent, 'MyComponent');

// Or use the boundary directly
<ErrorBoundary componentName="MyComponent">
  <MyComponent />
</ErrorBoundary>
```

## Log Levels

### DEBUG
- **Purpose**: Detailed information for debugging
- **Environment**: Only shown in development
- **Examples**: Component renders, state changes, detailed flow information

### INFO
- **Purpose**: General information about application flow
- **Environment**: Development and staging
- **Examples**: User actions, successful operations, navigation

### WARN
- **Purpose**: Warning conditions that don't prevent operation
- **Environment**: All environments
- **Examples**: Deprecated API usage, recoverable errors, performance issues

### ERROR
- **Purpose**: Error conditions that affect functionality
- **Environment**: All environments
- **Examples**: API failures, unhandled exceptions, critical errors

## Log Format

All logs follow this structured format:

```
{timestamp} {LEVEL} [user id] {user-id-value} [Component][Action] {message} | Metadata: {json}
```

### Example Log Output

```
2024-01-15T10:30:45.123Z INFO [user id] {abc123} [Auth][sign_in] Sign in successful | Metadata: {"email":"user@example.com"}

2024-01-15T10:30:46.234Z ERROR [user id] {abc123} [NewsletterActions][toggle_like] Error toggling like | Metadata: {"newsletterId":"xyz789"}
```

## Configuration

### Environment Variables

```bash
# Log levels: DEBUG, INFO, WARN, ERROR
VITE_LOG_LEVEL=DEBUG

# External logging service (optional)
VITE_LOG_SERVICE_URL=https://your-logging-service.com/api/logs
VITE_LOG_SERVICE_API_KEY=your_logging_service_api_key
```

### Default Log Levels by Environment

- **Development**: DEBUG (shows all logs)
- **Staging**: INFO (shows info, warn, error)
- **Production**: WARN (shows warn, error only)

## Migration Guide

### Replacing Console Statements

#### Before (Old Way)
```typescript
console.log('[Auth] Signing in with:', email);
console.error('Failed to delete group:', error);
console.log(`[DEBUG] Component ${id} - state:`, state);
```

#### After (New Way)
```typescript
const log = useLogger('Auth');

log.auth('Attempting sign in', { metadata: { email } });
log.error('Failed to delete group', { action: 'delete_group' }, error);
log.debug('Component state updated', { metadata: { id, state } });
```

### Component Updates

1. **Add the logger hook**:
   ```typescript
   import { useLogger } from '@common/utils/logger';
   
   const MyComponent = () => {
     const log = useLogger('MyComponent');
     // ... rest of component
   };
   ```

2. **Replace console statements**:
   - `console.log()` → `log.info()` or `log.debug()`
   - `console.error()` → `log.error()`
   - `console.warn()` → `log.warn()`

3. **Add context and metadata**:
   ```typescript
   // Instead of:
   console.error('API call failed:', error);
   
   // Use:
   log.error('API call failed', {
     action: 'api_call',
     metadata: { endpoint: '/api/newsletters', method: 'POST' }
   }, error);
   ```

## Best Practices

### 1. Use Appropriate Log Levels
- **DEBUG**: Internal state, flow control, detailed debugging
- **INFO**: User actions, successful operations, important events
- **WARN**: Non-critical errors, deprecated usage, performance issues
- **ERROR**: Critical errors, API failures, exceptions

### 2. Include Meaningful Context
```typescript
// Good
log.error('Newsletter update failed', {
  action: 'update_newsletter',
  metadata: {
    newsletterId: newsletter.id,
    updateFields: ['title', 'tags'],
    userId: user.id
  }
}, error);

// Bad
log.error('Update failed', {}, error);
```

### 3. Use Component-Specific Loggers
```typescript
// Good - component context is clear
const log = useLogger('NewsletterCard');

// Bad - generic logging without context
import { logger } from '@common/utils/logger';
logger.error('Something failed');
```

### 4. Log User Actions
```typescript
const handleSubmit = async () => {
  log.logUserAction('newsletter_create', {
    metadata: { source: 'manual_entry', tags: tags.length }
  });
  
  // ... rest of handler
};
```

### 5. Performance Monitoring
```typescript
const handleDataLoad = async () => {
  const timer = log.startTimer('newsletter_data_load');
  
  try {
    const data = await fetchNewsletters();
    // timer() will log completion time automatically
  } finally {
    timer();
  }
};
```

## Integration with External Services

### Sentry Integration Example
```typescript
// In Logger.ts, update sendToExternalService method:
private sendToExternalService(entry: LogEntry): void {
  try {
    if (entry.level >= LogLevel.ERROR && entry.error) {
      Sentry.captureException(entry.error, {
        tags: {
          component: entry.context.component,
          userId: entry.context.userId,
        },
        extra: entry.context.metadata,
      });
    }
  } catch (error) {
    console.error('Failed to send log to Sentry:', error);
  }
}
```

### LogRocket Integration Example
```typescript
private sendToExternalService(entry: LogEntry): void {
  try {
    LogRocket.log(entry.level, entry.message, entry.context);
  } catch (error) {
    console.error('Failed to send log to LogRocket:', error);
  }
}
```

## API Reference

### useLogger Hook
```typescript
const log = useLogger(componentName?: string);
```

#### Methods
- `log.debug(message, context?, error?)`
- `log.info(message, context?, error?)`
- `log.warn(message, context?, error?)`
- `log.error(message, context?, error?)`
- `log.auth(message, context?)` - Shorthand for auth-related logs
- `log.api(message, context?)` - Shorthand for API-related logs
- `log.ui(message, context?)` - Shorthand for UI-related logs
- `log.logUserAction(action, context?)` - Log user interactions
- `log.startTimer(name)` - Returns a function to end timing

### LogContext Interface
```typescript
interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}
```

## Troubleshooting

### Logs Not Appearing
1. Check the `VITE_LOG_LEVEL` environment variable
2. Ensure the log level is appropriate for your environment
3. Verify the logger is properly imported and initialized

### Performance Issues
1. Avoid logging in tight loops
2. Use DEBUG level for verbose logging
3. Consider async logging for high-volume applications

### User Context Missing
1. Ensure `AuthProvider` is properly set up
2. Check that `useLogger` is used within the auth context
3. Verify user authentication state

## Future Enhancements

1. **Log Aggregation**: Implement log batching for better performance
2. **Real-time Monitoring**: Add WebSocket-based log streaming
3. **Advanced Filtering**: Implement log filtering by user, component, or time range
4. **Metrics Integration**: Add custom metrics and dashboards
5. **A/B Testing Logs**: Add support for experiment tracking