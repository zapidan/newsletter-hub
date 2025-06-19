# E2E Tests Documentation

## Overview

This directory contains end-to-end tests for the NewsletterHub application using Playwright. The tests simulate real user interactions with the application to ensure critical workflows function correctly.

## Test Setup

### Key Files

- `playwright.config.ts` - Main Playwright configuration
- `auth-intercepted.spec.ts` - Authentication tests with API mocking
- `newsletter-workflows.spec.ts` - Comprehensive newsletter management tests
- `global-setup.ts` - Global test setup including test user creation
- `test-fixtures.ts` - Shared test data and utilities
- `mocks/handlers.ts` - MSW handlers for API mocking

### Environment Configuration

The tests use a `.env.test` file with mock Supabase credentials:
```
VITE_SUPABASE_URL=http://localhost:3000
VITE_SUPABASE_ANON_KEY=mock-anon-key
VITE_USE_MOCK_API=true
```

## How Tests Work

### API Mocking Strategy

The tests use Playwright's route interception to mock Supabase API calls:

1. **Authentication Endpoints** - Mock `/auth/v1/token`, `/auth/v1/user`
2. **Data Endpoints** - Mock `/rest/v1/*` endpoints for newsletters, tags, etc.

### Test User Credentials

- Email: `test@example.com`
- Password: `testpassword123`

## Running Tests

### Run all e2e tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth-intercepted.spec.ts
```

### Run with UI mode
```bash
npm run test:e2e:ui
```

### Run specific test by name
```bash
npx playwright test -g "should successfully login"
```

## Common Issues and Solutions

### Issue: Tests fail with "Cannot navigate to invalid URL"
**Solution**: Ensure the dev server is running on port 5174. The tests will automatically start it if configured properly.

### Issue: Login test times out
**Solution**: Check that API mocking is working correctly. The auth endpoints must return proper mock responses.

### Issue: User menu not found
**Solution**: The tests look for `button[aria-haspopup="true"]` instead of a specific test ID.

### Issue: Environment variables not loaded
**Solution**: Ensure `.env.test` exists and the Playwright config properly loads it.

## Test Structure

### Authentication Flow Tests
- Login with valid credentials
- Login with invalid credentials  
- Logout functionality
- Protected route access
- Session persistence

### Newsletter Workflow Tests
- Display newsletters in inbox
- Search newsletters
- Filter by read status and source
- Mark as read/unread
- Archive newsletters
- Bulk operations
- Tag management
- Navigation between newsletters

## Debugging Tips

1. **Use headed mode**: Add `--headed` flag to see browser
2. **Enable debugging**: Set `PWDEBUG=1` environment variable
3. **Check screenshots**: Failed tests save screenshots in `test-results/`
4. **Console logs**: Tests log network requests and auth flow for debugging

## Best Practices

1. Always use proper selectors (data-testid when available, semantic attributes otherwise)
2. Mock API responses consistently
3. Clean up test data between tests
4. Use appropriate wait strategies (avoid fixed timeouts)
5. Make tests independent and idempotent