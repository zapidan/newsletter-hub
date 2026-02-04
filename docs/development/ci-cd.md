# Continuous Integration & Deployment

## Overview

This document outlines the CI/CD pipeline for the Newsletter Hub application, including build, test, and deployment processes for all components.

## Table of Contents

- [Branch Strategy](#branch-strategy)
- [Pull Request Workflow](#pull-request-workflow)
- [Main Branch Pipeline](#main-branch-pipeline)
- [Environments](#environments)
- [Deployment Process](#deployment-process)
- [Monitoring & Rollback](#monitoring--rollback)
- [Scheduled Jobs](#scheduled-jobs)
- [Security & Compliance](#security--compliance)

## Branch Strategy

### Main Branch

- `main`
  - Production-ready code
  - Protected branch (requires PR and approvals)
  - Auto-deploys to GitHub Pages on successful CI

### Feature Branches

- Naming: `feature/description` or `fix/description`
- Created from `main`
- Must be up-to-date before merging
- Deleted after merge

## Pull Request Workflow

### Required Checks

1. **Linting**

   ```bash
   # Frontend
   npm run lint

   # Backend/Edge Functions
   deno lint --unstable
   ```

2. **Unit Tests**
   - All tests must pass

   ```bash
   # Frontend
   npm test -- --coverage

   # Backend
   deno test --coverage=./coverage
   ```

3. **Integration Tests**
   - API contract tests
   - Database integration
   - Third-party service mocks

4. **Security Scans**
   - Dependency vulnerability scanning
   - Secret detection
   - SAST (Static Application Security Testing)

### PR Review Process

1. Create PR from feature branch to `main`
2. Automated checks run
3. Required approvals:
   - 1 code owner approval
   - All discussions resolved
   - Passing CI checks
4. Squash and merge

## Main Branch Pipeline

### On Push to Main

1. **Build & Test**
   - Full test suite
   - Build artifacts
   - Docker images

2. **Staging Deployment**
   - Auto-deploys to staging
   - Runs smoke tests
   - Notifies team on failure

3. **Production Deployment**
   - Manual trigger required
   - Canary deployment (10% traffic)
   - Full rollout after 1 hour

## Environments

| Environment | URL                                   | Branch | Auto-Deploy |
| ----------- | ------------------------------------- | ------ | ----------- |
| Production  | GitHub Pages (configured in repo)     | `main` | Auto        |
| Development | http://localhost:5174/newsletter-hub/ | -      | -           |

## Deployment Process

Deployment to GitHub Pages is fully automated and happens on every successful merge to the `main` branch.

### Automatic Deployment

1. Code is merged to `main` branch
2. Test workflow runs (`test.yml`)
3. On success, Pages deployment workflow (`pages.yml`) is triggered
4. The workflow:
   - Checks out the code
   - Downloads test artifacts
   - Builds the application
   - Deploys to GitHub Pages

### Manual Deployment

No manual deployment is needed as it's fully automated. To deploy a new version:

1. Create a PR to `main`
2. Get it reviewed and approved
3. Merge to `main`
4. The CI/CD pipeline will handle the rest

## Local Development

### Running the Development Server

```bash
# Start the development server
npm run dev

# Development server will be available at:
# http://localhost:5174/newsletter-hub/
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- path/to/test/file.test.ts
```

## Monitoring

### Key Metrics

- **GitHub Pages Status**: Monitor at [GitHub Status](https://www.githubstatus.com/)
- **Build Status**: Check GitHub Actions workflow runs
- **Uptime**: Monitored by GitHub Pages
