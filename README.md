# Newsletter Hub

A comprehensive newsletter management platform built with React, TypeScript, and Supabase.

## 🧪 Test Dashboard & Reports

### View Test Results Online

- **[Test Dashboard](https://dzapatariesco.dev/newsletter-hub/test-dashboard/)** - Main dashboard with overview
- **[Simple Test Table](https://dzapatariesco.dev/newsletter-hub/test-results)** - Clean table view similar to GitHub Actions
- **[Coverage Report](https://dzapatariesco.dev/newsletter-hub/html/)** - Detailed code coverage
- **[Test Results](https://dzapatariesco.dev/newsletter-hub/test-results/)** - Individual test details

### Live Application

- **[NewsletterHub App](https://dzapatariesco.dev/newsletter-hub/)** - Main application

### Local Development

```bash
# Run tests and generate all reports
npm run test:full

# Generate simple test table only
npm run test:results:simple
npm run test:results:simple:open

# Generate detailed test results
npm run test:results:parse
npm run test:results:open

# Generate coverage report
npm run test:coverage:html
npm run test:coverage:open
```

### CI/CD Integration

The test dashboard is automatically generated and deployed on:
- Every push to `main` or `develop` branches
- Every pull request
- After test suite completion

Check the **Actions** tab in GitHub to see the latest test results and dashboard deployment status.

## 🚀 Getting Started 