# Newsletter Hub

A comprehensive newsletter management platform built with React, TypeScript, and Supabase.

## 🧪 Test Dashboard & Reports

### View Test Results Online

- **[Test Dashboard](https://zapidan.github.io/newsletterHub/test-dashboard/)** - Main dashboard with overview
- **[Coverage Report](https://zapidan.github.io/newsletterHub/html/)** - Detailed code coverage
- **[Test Results](https://zapidan.github.io/newsletterHub/test-results/)** - Individual test details

### Local Development

Generate and view test reports locally:

```bash
# Generate all reports
npm run test:full

# Individual reports
npm run test:results:parse && npm run test:results:open
npm run test:coverage:parse && npm run test:coverage:open
npm run test:dashboard && npm run test:dashboard:open
```

### CI/CD Integration

The test dashboard is automatically generated and deployed on:
- Every push to `main` or `develop` branches
- Every pull request
- After test suite completion

Check the **Actions** tab in GitHub to see the latest test results and dashboard deployment status.

## 🚀 Getting Started 