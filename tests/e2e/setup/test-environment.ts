import { config } from 'dotenv';
import path from 'path';

/**
 * Test Environment Configuration
 * Sets up environment variables and configurations for E2E tests
 */

// Load test environment variables
const envPath = path.resolve(process.cwd(), '.env.test');
config({ path: envPath });

// Default test environment variables if not provided
const TEST_ENV_DEFAULTS = {
  // Supabase Configuration
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',

  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',

  // Test Configuration
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || 'test@example.com',
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || 'testpassword123',

  // Application Configuration
  NODE_ENV: 'test',
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:3000',

  // Feature Flags for Testing
  VITE_ENABLE_MOCK_DATA: 'false',
  VITE_ENABLE_DEBUG_LOGGING: 'true',
};

/**
 * Sets up the test environment variables
 */
export function setupTestEnvironment(): void {
  // Set all default environment variables
  Object.entries(TEST_ENV_DEFAULTS).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });

  // Ensure we're in test mode
  process.env.NODE_ENV = 'test';
}

/**
 * Gets a required environment variable or throws an error
 * @param key - The environment variable key
 * @returns The environment variable value
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 * @param key - The environment variable key
 * @param defaultValue - The default value if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Test configuration object
 */
export const testConfig = {
  supabase: {
    url: () => getRequiredEnvVar('VITE_SUPABASE_URL'),
    anonKey: () => getRequiredEnvVar('VITE_SUPABASE_ANON_KEY'),
    serviceRoleKey: () => getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  },
  database: {
    url: () => getRequiredEnvVar('DATABASE_URL'),
  },
  auth: {
    testUserEmail: () => getOptionalEnvVar('TEST_USER_EMAIL', 'test@example.com'),
    testUserPassword: () => getOptionalEnvVar('TEST_USER_PASSWORD', 'testpassword123'),
  },
  app: {
    baseUrl: () => getOptionalEnvVar('VITE_API_BASE_URL', 'http://localhost:3000'),
    port: () => parseInt(getOptionalEnvVar('PORT', '3000'), 10),
  },
  test: {
    timeout: () => parseInt(getOptionalEnvVar('TEST_TIMEOUT', '30000'), 10),
    retries: () => parseInt(getOptionalEnvVar('TEST_RETRIES', '2'), 10),
    headless: () => getOptionalEnvVar('TEST_HEADLESS', 'true') === 'true',
    slowMo: () => parseInt(getOptionalEnvVar('TEST_SLOW_MO', '0'), 10),
    video: () => getOptionalEnvVar('TEST_VIDEO', 'retain-on-failure'),
    screenshot: () => getOptionalEnvVar('TEST_SCREENSHOT', 'only-on-failure'),
  },
};

/**
 * Validates that all required environment variables are set
 */
export function validateTestEnvironment(): void {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default test values. For production testing, please set these variables.');
  }
}

/**
 * Creates a test environment info object for debugging
 */
export function getTestEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: testConfig.supabase.url(),
    databaseUrl: testConfig.database.url()?.replace(/:[^:@]+@/, ':****@'), // Hide password
    testUser: testConfig.auth.testUserEmail(),
    baseUrl: testConfig.app.baseUrl(),
    isHeadless: testConfig.test.headless(),
    testTimeout: testConfig.test.timeout(),
  };
}

/**
 * Prints test environment information
 */
export function printTestEnvironmentInfo(): void {
  console.log('Test Environment Configuration:');
  console.log('==============================');
  const info = getTestEnvironmentInfo();
  Object.entries(info).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.log('==============================\n');
}

// Initialize test environment when this module is imported
setupTestEnvironment();
validateTestEnvironment();
