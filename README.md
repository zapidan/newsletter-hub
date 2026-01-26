# Newsletter Hub

A comprehensive newsletter management platform built with React, TypeScript, and Supabase. Newsletter Hub helps you organize, read, and manage your newsletter subscriptions efficiently with advanced filtering, tagging, and group management features.

## 🌟 Features

- **Newsletter Management**: Add, edit, and organize newsletters from various sources
- **Smart Filtering**: Filter by tags, groups, sources, and read status
- **Tag System**: Organize newsletters with custom tags and see usage statistics
- **Group Management**: Group newsletters by source or custom categories
- **Reading Experience**: Clean, distraction-free reading interface
- **Search & Discovery**: Powerful search functionality across all newsletters
- **Real-time Updates**: Live synchronization with Supabase backend
- **Personal Email Address**: Private email address to subscribe to newsletters

## 🚀 Upcoming Features

- **🤖 Newsletter Summarization**: AI-powered summaries of individual newsletters for quick content consumption
- **📈 Trending Topics & Themes**: Automatic detection and visualization of trending topics across all your newsletter subscriptions
- **🔊 Text-to-Speech**: Audio narration of newsletter content for hands-free listening during commutes or workouts
- **⏰ Scheduled Daily Summary**: Automated daily digest summarizing key highlights from all your subscriptions, delivered at your preferred time

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage) + Mailgun
- **Styling**: Tailwind CSS + Radix UI components
- **State Management**: TanStack Query (React Query)
- **Testing**: Vitest + Playwright E2E

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (use `.nvmrc` for version management)
- npm, yarn, or pnpm
- Supabase account (for backend services)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd newsletterHub
   ```

2. **Install Node.js version**

   ```bash
   nvm use  # or nvm install 20 if you don't have it
   ```

3. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

4. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Add your Supabase credentials to .env.local
   ```

### Development

1. **Start development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

2. **Open your browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```

The build artifacts will be stored in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
# or
yarn preview
# or
pnpm preview
```

## 🧪 Testing

### Unit & Integration Tests

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Run responsive tests across different viewports
npm run test:e2e:responsive

# Run performance tests
npm run test:e2e:performance
```

## 📊 Test Dashboard & Reports

### View Test Results Online

- **[Test Dashboard](https://dzapatariesco.dev/newsletter-hub/test-dashboard/)** - Main dashboard with overview
- **[Simple Test Table](https://dzapatariesco.dev/newsletter-hub/test-results)** - Clean table view similar to GitHub Actions
- **[Coverage Report](https://dzapatariesco.dev/newsletter-hub/html/)** - Detailed code coverage
- **[Test Results](https://dzapatariesco.dev/newsletter-hub/test-results/)** - Individual test details

### Local Test Reports

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

## 🔧 Code Quality

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Run ESLint with auto-fix
npm run lint:fix

# Run type checking
npm run type-check

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

### Console Log Management

```bash
# Scan for console logs in the codebase
npm run logs:scan

# Generate console log report
npm run logs:report

# Run dev server with debug logging
npm run logs:dev

# Run dev server with production logging
npm run logs:prod
```

## 🗂️ Project Structure

```
newsletterHub/
├── src/
│   ├── common/          # Shared utilities, hooks, and types
│   ├── components/      # Reusable React components
│   ├── web/            # Web-specific components and pages
│   └── __tests__/      # Test files
├── mobile-app/         # React Native mobile app
├── supabase/          # Database migrations and functions
├── tests/             # E2E test files and fixtures
├── docs/              # Documentation and ADRs
└── scripts/           # Build and utility scripts
```

## 🌐 Live Application

- **[NewsletterHub App](https://dzapatariesco.dev/newsletter-hub/)** - Main application

## 📝 License

This project is private and proprietary.

## 🆘 Troubleshooting

### Common Issues

1. **Node.js Version**: Make sure you're using Node.js 20+ (`nvm use`)
2. **Environment Variables**: Ensure `.env.local` is properly configured
3. **Dependencies**: Try `rm -rf node_modules package-lock.json && npm install`
4. **Port Conflicts**: Kill dev server with `npm run kill-dev-server`

### Getting Help

- Check the `docs/` directory for detailed documentation
- Review existing issues in the GitHub repository
- Check test results in the online dashboard for debugging clues
