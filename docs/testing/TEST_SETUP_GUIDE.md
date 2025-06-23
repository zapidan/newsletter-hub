# Newsletter Hub Test Setup Guide

This guide provides comprehensive instructions for setting up and running tests in the Newsletter Hub project.

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Integration Tests](#integration-tests)
4. [E2E Tests](#e2e-tests)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Test Structure](#test-structure)
7. [Writing New Tests](#writing-new-tests)
8. [CI/CD Integration](#cicd-integration)

## Overview

The Newsletter Hub project uses the following testing frameworks:

- **Vitest**: For unit and integration tests
- **Playwright**: For end-to-end (E2E) tests
- **React Testing Library**: For component testing
- **MSW (Mock Service Worker)**: For API mocking

## Environment Setup

### Prerequisites

1. Node.js (v18 or higher)
2. npm or yarn
3. Supabase CLI (for local development)
4. PostgreSQL (if running tests against a real database)

### Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example environment file
   cp tests/e2e/example/.env.test.example .env.test
   
   # Edit .env.test with your actual values
   ```

3. **Start Supabase locally (if needed):**
   ```bash
   npx supabase start
   ```

### Environment Variables

Key environment variables for testing:

```env
# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Test Configuration
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## Integration Tests

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration queueAndArchive

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch
```

### Integration Test Structure

Integration tests are located in `src/__tests__/integration/`.

Example integration test:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

describe('Queue and Archive Integration Tests', () => {
  it('should remove newsletter from queue', async () => {
    const { result } = renderHook(() => useSharedNewsletterActions());
    
    await act(async () => {
      await result.current.handleToggleInQueue(mockNewsletter, true);
    });
    
    expect(readingQueueApi.remove).toHaveBeenCalled();
  });
});
```

### Mocking in Integration Tests

The project uses comprehensive mocks for integration testing:

1. **API Mocks**: Located in `src/__tests__/mocks/`
2. **Cache Manager Mocks**: Prevents actual cache operations
3. **Supabase Client Mocks**: Simulates authentication and database operations

## E2E Tests

### Running E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific E2E test file
npm run test:e2e queue-archive

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run in debug mode
npm run test:e2e -- --debug

# Run specific test by name
npm run test:e2e -- -g "should remove newsletter from queue"
```

### E2E Test Structure

E2E tests are located in `tests/e2e/`.

Example E2E test:
```typescript
import { test, expect } from '@playwright/test';
import { setupTestUser } from '../fixtures/auth';
import { createTestNewsletter } from '../fixtures/newsletter';

test.describe('Queue and Archive E2E Tests', () => {
  test('should remove newsletter from queue', async ({ page }) => {
    // Setup
    const { userId } = await setupTestUser();
    const newsletter = await createTestNewsletter({ userId });
    
    // Test actions
    await page.goto('/newsletters/inbox');
    await page.click(`[data-testid="newsletter-${newsletter.id}"]`);
    await page.click('button:has-text("Remove from queue")');
    
    // Assertions
    await expect(page.locator('.toast')).toContainText('Removed from queue');
  });
});
```

### E2E Test Fixtures

The project includes reusable fixtures for common test scenarios:

- **Auth Fixtures** (`tests/fixtures/auth.ts`): User creation and authentication
- **Newsletter Fixtures** (`tests/fixtures/newsletter.ts`): Newsletter and related data creation
- **Toast Helpers** (`tests/helpers/toast.ts`): Toast notification utilities

## Common Issues and Solutions

### Issue 1: Cache Manager Initialization Failure

**Error:** `Cannot read properties of undefined (reading 'optimisticUpdate')`

**Solution:**
```typescript
// Ensure cache utils are properly mocked
vi.mock('@common/utils/cacheUtils', () => ({
  getCacheManager: vi.fn(() => ({
    optimisticUpdate: vi.fn().mockResolvedValue(null),
    updateNewsletterInCache: vi.fn(),
    invalidateRelatedQueries: vi.fn().mockResolvedValue(undefined),
  })),
}));
```

### Issue 2: Missing Environment Variables

**Error:** `Required environment variable VITE_SUPABASE_URL is not set`

**Solution:**
1. Create `.env.test` file with required variables
2. Ensure test setup loads the environment:
   ```typescript
   import { setupTestEnvironment } from './setup/test-environment';
   setupTestEnvironment();
   ```

### Issue 3: Provider Context Errors

**Error:** `useAuth must be used within AuthProvider`

**Solution:**
```typescript
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SupabaseProvider>
        {children}
      </SupabaseProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

### Issue 4: Import Path Errors

**Error:** `Cannot find module '@/common/api'`

**Solution:**
Ensure `tsconfig.json` has proper path mappings:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@common/*": ["./src/common/*"]
    }
  }
}
```

## Test Structure

### Directory Structure

```
src/
├── __tests__/
│   ├── integration/
│   │   ├── queueAndArchive.integration.test.tsx
│   │   └── newsletterOperations.integration.test.tsx
│   ├── unit/
│   │   └── newsletterActions.test.ts
│   ├── mocks/
│   │   ├── data.ts
│   │   └── server.ts
│   └── setup.ts
│
tests/
├── e2e/
│   ├── newsletter/
│   │   ├── queue-archive.spec.ts
│   │   └── newsletter-core.spec.ts
│   ├── setup/
│   │   └── test-environment.ts
│   └── fixtures/
│       ├── auth.ts
│       └── newsletter.ts
```

### Test Naming Conventions

- **Unit Tests**: `*.test.ts` or `*.test.tsx`
- **Integration Tests**: `*.integration.test.ts` or `*.integration.test.tsx`
- **E2E Tests**: `*.spec.ts`

### Test Patterns

1. **AAA Pattern** (Arrange, Act, Assert):
   ```typescript
   it('should perform action', async () => {
     // Arrange
     const data = createMockData();
     
     // Act
     const result = await performAction(data);
     
     // Assert
     expect(result).toBeDefined();
   });
   ```

2. **Test Isolation**: Each test should be independent
3. **Descriptive Names**: Use clear, descriptive test names
4. **Mock External Dependencies**: Avoid real API calls in tests

## Writing New Tests

### Integration Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock dependencies
vi.mock('@common/api', () => ({
  // Mock implementations
}));

describe('Feature Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle feature correctly', async () => {
    // Test implementation
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { setupTestEnvironment } from '../setup/test-environment';

setupTestEnvironment();

test.describe('Feature E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('should perform user action', async ({ page }) => {
    // Test implementation
  });
});
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run integration tests
        run: npm run test:integration
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### Pre-commit Hooks

Set up Husky for pre-commit testing:

```bash
npm install --save-dev husky
npx husky init
echo "npm run test:integration" > .husky/pre-commit
```

## Best Practices

1. **Keep Tests Fast**: Mock external dependencies
2. **Test User Behavior**: Focus on what users do, not implementation details
3. **Use Data Builders**: Create reusable test data factories
4. **Avoid Test Interdependence**: Each test should run independently
5. **Clean Up After Tests**: Remove test data after completion
6. **Use Descriptive Assertions**: Make test failures easy to understand

## Troubleshooting

### Debug Mode

For integration tests:
```bash
NODE_OPTIONS='--inspect-brk' npm run test:integration
```

For E2E tests:
```bash
PWDEBUG=1 npm run test:e2e
```

### Verbose Logging

Enable detailed logging:
```bash
DEBUG=* npm run test
```

### Test Timeouts

Increase timeouts for slow tests:
```typescript
test('slow operation', async () => {
  // Increase timeout to 60 seconds
  test.setTimeout(60000);
  // Test implementation
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Mock Service Worker](https://mswjs.io/)

---

For additional help, please refer to the project's contributing guidelines or reach out to the development team.