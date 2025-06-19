import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test file
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 10000,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5174',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Capture screenshot after each test failure */
    screenshot: 'only-on-failure',
    /* Record video for failed tests */
    video: 'on-first-retry',
    /* Set test context options */
    contextOptions: {
      ignoreHTTPSErrors: true,
      /* Set user agent */
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      /* Set viewport */
      viewport: { width: 1280, height: 720 },
      /* Set timezone */
      timezoneId: 'America/Chicago',
      /* Set locale */
      locale: 'en-US',
      /* Set geolocation */
      geolocation: { longitude: -87.6298, latitude: 41.8781 }, // Chicago
      /* Set permissions */
      permissions: ['geolocation', 'notifications'],
      /* Set color scheme */
      colorScheme: 'light',
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Custom browser launch options
        launchOptions: {
          slowMo: 100,
          devtools: process.env.PWDEBUG === '1',
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          slowMo: 100,
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        launchOptions: {
          slowMo: 100,
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      // Force test environment
      NODE_ENV: 'test',
      VITE_USE_MOCK_API: 'true',
      // Use mock Supabase credentials
      VITE_SUPABASE_URL: 'http://localhost:3000',
      VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    },
  },

  /* Global setup and teardown */
  globalSetup: path.join(path.dirname(fileURLToPath(import.meta.url)), './tests/e2e/global-setup.ts'),
  // globalTeardown: path.join(path.dirname(fileURLToPath(import.meta.url)), './tests/e2e/global-teardown.ts'),

  /* Test configuration */
  testMatch: '**/*.spec.{ts,tsx}',
  testIgnore: ['**/node_modules/**', '**/dist/**'],
  snapshotDir: './__snapshots__',
  outputDir: 'test-results/',
  preserveOutput: 'failures-only',
  forbidOnly: !!process.env.CI,
  reportSlowTests: { max: 0, threshold: 60000 },
  timeout: 30000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
    toMatchSnapshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
});
