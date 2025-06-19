import type { Page, Browser, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { test as base, expect } from '@playwright/test';
import { createMockSupabaseClient } from './test-utils/mock-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TestUser = {
  email: string;
  password: string;
  fullName: string;
  role?: 'user' | 'admin';
  id?: string;
};

type TestFixtures = {
  supabase: SupabaseClient;
  createTestUser: (user: Omit<TestUser, 'id'>) => Promise<TestUser>;
  loginAsUser: (user: TestUser) => Promise<void>;
};

export const test = base.extend<TestFixtures>({
  supabase: async ({}, use) => {
    // Create a new mock Supabase client for each test
    const supabase = createMockSupabaseClient();
    await use(supabase);
  },

  createTestUser: async ({ supabase }, use) => {
    const createUser = async (user: Omit<TestUser, 'id'>): Promise<TestUser> => {
      const { email, password, fullName, role = 'user' } = user;
      
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });

      if (authError) {
        throw new Error(`Failed to create test user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user data returned after sign up');
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          email,
          role,
        });

      if (profileError) {
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      return {
        ...user,
        id: authData.user.id,
        role,
      };
    };

    await use(createUser);
  },

  loginAsUser: async ({ page, baseURL }, use) => {
    const login = async (user: TestUser) => {
      await page.goto(`${baseURL}/login`);
      await page.fill('[data-testid="email-input"]', user.email);
      await page.fill('[data-testid="password-input"]', user.password);
      await page.click('[data-testid="login-button"]');
      
      // Wait for navigation after login
      await page.waitForURL(`${baseURL}/inbox`);
      
      // Verify we're logged in by checking for an element that only exists when logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    };

    await use(login);
  },
});

export interface TestNewsletter {
  id?: string;
  title: string;
  content: string;
  source_name: string;
  source_email: string;
  received_at: string;
  is_read: boolean;
  is_archived: boolean;
  is_favorite?: boolean;
  tags?: string[];
  reading_time_estimate?: number;
  summary?: string;
}

export interface TestSourceGroup {
  id?: string;
  name: string;
  description: string;
  color: string;
  source_count?: number;
}

export interface TestTag {
  id?: string;
  name: string;
  color: string;
}

// Database setup and cleanup functions
export async function setupTestDatabase(): Promise<void> {
  console.log('Setting up test database...');

  // Clear existing test data
  await clearTestData();

  // Create necessary tables if they don't exist
  await createTestTables();

  // Insert baseline test data
  await insertBaselineData();
}

export async function cleanupTestDatabase(): Promise<void> {
  try {
    await clearTestData();
    await resetDatabaseSequences();
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
}

async function clearTestData(): Promise<void> {
  // Implementation depends on your test database
  // Example: await databaseClient.query('TRUNCATE TABLE test_table CASCADE');
  console.log('Clearing test data...');
  // Add your data clearing logic here
}

async function createTestTables(): Promise<void> {
  // Implementation depends on your test database
  console.log('Creating test tables...');
  // Add your table creation logic here
}

async function insertBaselineData(): Promise<void> {
  // Implementation depends on your test database
  console.log('Inserting baseline test data...');
  // Add your baseline data insertion logic here
}

async function resetDatabaseSequences(): Promise<void> {
  // Implementation depends on your test database
  console.log('Resetting database sequences...');
  // Add your sequence reset logic here
}

// User management functions
export async function createTestUser(userData: TestUser): Promise<TestUser> {
  try {
    console.log(`Creating test user: ${userData.email}`);
    // Use the Supabase utility to create the user
    const user = await createTestUserInSupabase(userData);
    console.log(`✅ Created test user: ${user.email} (ID: ${user.id})`);
    return user;
  } catch (error) {
    console.error('Error in createTestUser:', error);
    throw error;
  }
}

export async function removeTestUser(email: string): Promise<void> {
  console.log(`Removing test user: ${email}`);
  // Implementation depends on your test database
  // Example: await databaseClient.query('DELETE FROM users WHERE email = $1', [email]);
}

// Newsletter management functions
export async function createTestNewsletter(
  newsletterData: TestNewsletter
): Promise<TestNewsletter> {
  console.log(`Creating test newsletter: ${newsletterData.title}`);
  // Implementation depends on your test database
  // Example: const result = await databaseClient.query('INSERT INTO newsletters (...) VALUES (...) RETURNING *', [...]);
  // return result.rows[0];
  return { ...newsletterData, id: 'test-newsletter-id' };
}

export async function removeTestNewsletter(id: string): Promise<void> {
  console.log(`Removing test newsletter: ${id}`);
  // Implementation depends on your test database
  // Example: await databaseClient.query('DELETE FROM newsletters WHERE id = $1', [id]);
}

// Tag management functions
export async function createTestTag(tagData: TestTag): Promise<TestTag> {
  console.log(`Creating test tag: ${tagData.name}`);
  // Implementation depends on your test database
  // Example: const result = await databaseClient.query('INSERT INTO tags (...) VALUES (...) RETURNING *', [...]);
  // return result.rows[0];
  return { ...tagData, id: 'test-tag-id' };
}

export async function removeTestTag(id: string): Promise<void> {
  console.log(`Removing test tag: ${id}`);
  // Implementation depends on your test database
  // Example: await databaseClient.query('DELETE FROM tags WHERE id = $1', [id]);
}

// Source group management functions
export async function createTestSourceGroup(
  groupData: TestSourceGroup
): Promise<TestSourceGroup> {
  console.log(`Creating test source group: ${groupData.name}`);
  // Implementation depends on your test database
  // Example: const result = await databaseClient.query('INSERT INTO source_groups (...) VALUES (...) RETURNING *', [...]);
  // return result.rows[0];
  return { ...groupData, id: 'test-group-id' };
}

export async function removeTestSourceGroup(id: string): Promise<void> {
  console.log(`Removing test source group: ${id}`);
  // Implementation depends on your test database
  // Example: await databaseClient.query('DELETE FROM source_groups WHERE id = $1', [id]);
}

// File cleanup functions
export async function removeTestFiles(): Promise<void> {
  const testDirs = [
    path.join(process.cwd(), 'test-uploads'),
    path.join(process.cwd(), 'test-results'),
  ];

  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`✅ Removed test directory: ${dir}`);
    } catch (error) {
      // Ignore errors for non-existent directories
      if (error.code !== 'ENOENT') {
        console.error(`Error removing test directory ${dir}:`, error);
        throw error;
      }
    }
  }
}

// Browser and page utilities
export async function createAuthenticatedPage(
  browser: Browser,
  userType: 'user' | 'admin' = 'user'
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Add authentication logic here
  // Example: await page.goto('/login');
  // await page.fill('#email', userType === 'admin' ? 'admin@example.com' : 'test@example.com');
  // await page.fill('#password', 'testpassword123');
  // await page.click('button[type="submit"]');
  
  return { context, page };
}

export async function waitForPageLoad(
  page: Page,
  timeout = 10000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      return typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
    },
    { timeout }
  );
}

// Data generation utilities
export function generateRandomEmail(): string {
  return `test-${Math.random().toString(36).substring(2, 10)}@example.com`;
}

export function generateRandomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

export function generateTestNewsletter(
  overrides: Partial<TestNewsletter> = {}
): TestNewsletter {
  const now = new Date().toISOString();
  return {
    title: `Test Newsletter ${Math.floor(Math.random() * 1000)}`,
    content: '<p>Test newsletter content</p>',
    source_name: 'Test Source',
    source_email: 'test@example.com',
    received_at: now,
    is_read: false,
    is_archived: false,
    is_favorite: false,
    tags: [],
    reading_time_estimate: 5,
    summary: 'Test newsletter summary',
    ...overrides,
  };
}

export function generateTestUser(
  overrides: Partial<TestUser> = {}
): TestUser {
  return {
    email: generateRandomEmail(),
    password: 'testpassword123',
    fullName: 'Test User',
    role: 'user',
    ...overrides,
  };
}

export function generateTestTag(overrides: Partial<TestTag> = {}): TestTag {
  return {
    name: `tag-${Math.random().toString(36).substring(2, 8)}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    ...overrides,
  };
}

export function generateTestSourceGroup(
  overrides: Partial<TestSourceGroup> = {}
): TestSourceGroup {
  return {
    name: `Group ${Math.floor(Math.random() * 1000)}`,
    description: 'Test group description',
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    source_count: 0,
    ...overrides,
  };
}

// Test data sets
export const TEST_USERS = {
  REGULAR_USER: {
    email: 'test@example.com',
    password: 'testpassword123',
    fullName: 'Test User',
    role: 'user' as const,
  },
  ADMIN_USER: {
    email: 'admin@example.com',
    password: 'adminpassword123',
    fullName: 'Admin User',
    role: 'admin' as const,
  },
};

// Assertion helpers
export function expectNewsletterInList(
  newsletters: Array<{ title: string }>,
  expectedTitle: string
): boolean {
  return newsletters.some((newsletter) => newsletter.title === expectedTitle);
}

export function expectTagInList(
  tags: Array<{ name: string }>,
  expectedName: string
): boolean {
  return tags.some((tag) => tag.name === expectedName);
}

export function expectUserHasPermission(
  user: { role: string },
  permission: string
): boolean {
  // Implementation depends on your permission system
  return user.role === 'admin';
}

// Mock data generators for large datasets
export function generateMockNewsletters(count: number): TestNewsletter[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestNewsletter({
      title: `Mock Newsletter ${i + 1}`,
      received_at: new Date(Date.now() - i * 3600000).toISOString(),
    })
  );
}

export function generateMockTags(count: number): TestTag[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestTag({ name: `tag-${i + 1}` })
  );
}

// Environment setup helpers
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export function getTestTimeout(): number {
  return isCI() ? 30000 : 10000;
}

export function shouldRunVisualTests(): boolean {
  return process.env.RUN_VISUAL_TESTS === 'true';
}

export function shouldRunSlowTests(): boolean {
  return process.env.RUN_SLOW_TESTS === 'true';
}

export * from './test-db-utils';
