# Newsletter Hub

A comprehensive newsletter management platform built with React, TypeScript, and Supabase.

## 🧪 Test Dashboard & Reports

### View Test Results Online

- **[Test Dashboard](https://zapidan.github.io/newsletterHub/test-dashboard/)** - Main dashboard with overview
- **[Simple Test Table](https://zapidan.github.io/newsletterHub/test-results/simple-test-table.html)** - Clean table view similar to GitHub Actions
- **[Coverage Report](https://zapidan.github.io/newsletterHub/html/)** - Detailed code coverage
- **[Test Results](https://zapidan.github.io/newsletterHub/test-results/)** - Individual test details

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