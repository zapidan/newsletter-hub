import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test file
const envPath = path.resolve(__dirname, '.env.test');
dotenv.config({ path: envPath });

// Ensure test environment variables are loaded
const testEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://localhost:3000',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key',
  VITE_USE_MOCK_API: 'true',
  NODE_ENV: 'test',
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 10000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 3,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['line']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 15000,
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
      /* Set viewport */
      viewport: { width: 1280, height: 720 },
      /* Set locale */
      locale: 'en-US',
      /* Set color scheme */
      colorScheme: 'light',
    },
  },

  /* Configure projects for major browsers and viewports */
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Custom browser launch options
        launchOptions: {
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
    {
      name: 'chromium-tablet',
      use: {
        ...devices['iPad Pro 11 landscape'],
        launchOptions: {
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['iPhone 14'],
        launchOptions: {
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
    {
      name: 'chromium-mobile-landscape',
      use: {
        ...devices['iPhone 14 landscape'],
        launchOptions: {
          headless: process.env.HEADLESS !== 'false',
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `VITE_SUPABASE_URL=${testEnv.VITE_SUPABASE_URL} VITE_SUPABASE_ANON_KEY=${testEnv.VITE_SUPABASE_ANON_KEY} VITE_USE_MOCK_API=${testEnv.VITE_USE_MOCK_API} NODE_ENV=${testEnv.NODE_ENV} npm run dev`,
    port: 5174,
    timeout: 60 * 1000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      ...testEnv,
    },
  },

  /* Global setup and teardown */
  globalSetup: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    './tests/e2e/global-setup.ts'
  ),
  // globalTeardown: path.join(path.dirname(fileURLToPath(import.meta.url)), './tests/e2e/global-teardown.ts'),

  /* Test configuration */
  testMatch: '**/*.spec.{ts,tsx}',
  testIgnore: ['**/node_modules/**', '**/dist/**'],
  outputDir: 'test-results/',
  preserveOutput: 'failures-only',
});
