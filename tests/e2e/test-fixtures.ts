import { Page, Browser, BrowserContext } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role?: 'user' | 'admin';
  id?: string;
}

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
  console.log('Cleaning up test database...');

  // Remove all test data
  await clearTestData();

  // Reset sequences/auto-increment counters
  await resetDatabaseSequences();
}

async function clearTestData(): Promise<void> {
  // This would typically use your database client
  // Example for SQL databases:
  const tables = [
    'newsletter_tags',
    'newsletters',
    'tags',
    'source_groups',
    'newsletter_sources',
    'user_sessions',
    'users'
  ];

  for (const table of tables) {
    // DELETE FROM table WHERE created_at >= test_start_time OR email LIKE '%test%'
    console.log(`Clearing test data from ${table}`);
  }
}

async function createTestTables(): Promise<void> {
  // Ensure all necessary tables exist for testing
  // This might be handled by migrations in a real app
  console.log('Creating test tables if needed...');
}

async function insertBaselineData(): Promise<void> {
  // Insert any baseline data needed for all tests
  console.log('Inserting baseline test data...');
}

async function resetDatabaseSequences(): Promise<void> {
  // Reset auto-increment counters to prevent ID conflicts
  console.log('Resetting database sequences...');
}

// User management functions
export async function createTestUser(userData: TestUser): Promise<TestUser> {
  const user: TestUser = {
    ...userData,
    id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  console.log(`Creating test user: ${user.email}`);

  // Implementation would typically use your auth system
  // Example: await authService.createUser(user)

  return user;
}

export async function removeTestUser(email: string): Promise<void> {
  console.log(`Removing test user: ${email}`);

  // Implementation would remove user and related data
  // Example: await authService.deleteUser(email)
}

// Newsletter management functions
export async function createTestNewsletter(newsletterData: TestNewsletter): Promise<TestNewsletter> {
  const newsletter: TestNewsletter = {
    ...newsletterData,
    id: `test-newsletter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    summary: newsletterData.summary || 'Test newsletter summary',
    reading_time_estimate: newsletterData.reading_time_estimate || 5,
  };

  console.log(`Creating test newsletter: ${newsletter.title}`);

  // Implementation would insert newsletter into database
  // Example: await newsletterService.create(newsletter)

  return newsletter;
}

export async function removeTestNewsletter(id: string): Promise<void> {
  console.log(`Removing test newsletter: ${id}`);

  // Implementation would remove newsletter and related data
  // Example: await newsletterService.delete(id)
}

// Tag management functions
export async function createTestTag(tagData: TestTag): Promise<TestTag> {
  const tag: TestTag = {
    ...tagData,
    id: `test-tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  console.log(`Creating test tag: ${tag.name}`);

  // Implementation would insert tag into database
  // Example: await tagService.create(tag)

  return tag;
}

export async function removeTestTag(id: string): Promise<void> {
  console.log(`Removing test tag: ${id}`);

  // Implementation would remove tag
  // Example: await tagService.delete(id)
}

// Source group management functions
export async function createTestSourceGroup(groupData: TestSourceGroup): Promise<TestSourceGroup> {
  const group: TestSourceGroup = {
    ...groupData,
    id: `test-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source_count: groupData.source_count || 0,
  };

  console.log(`Creating test source group: ${group.name}`);

  // Implementation would insert source group into database
  // Example: await sourceGroupService.create(group)

  return group;
}

export async function removeTestSourceGroup(id: string): Promise<void> {
  console.log(`Removing test source group: ${id}`);

  // Implementation would remove source group
  // Example: await sourceGroupService.delete(id)
}

// File cleanup functions
export async function removeTestFiles(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');

  const testDirectories = [
    'test-results',
    'playwright-report',
    'coverage',
    'screenshots',
  ];

  for (const dir of testDirectories) {
    try {
      const fullPath = path.join(process.cwd(), dir);
      await fs.rmdir(fullPath, { recursive: true });
      console.log(`Removed test directory: ${dir}`);
    } catch (error) {
      // Directory might not exist, which is fine
      continue;
    }
  }
}

// Browser and page utilities
export async function createAuthenticatedPage(
  browser: Browser,
  userType: 'user' | 'admin' = 'user'
): Promise<{ context: BrowserContext; page: Page }> {
  const authFile = userType === 'admin'
    ? 'playwright/.auth/admin.json'
    : 'playwright/.auth/user.json';

  const context = await browser.newContext({
    storageState: authFile,
  });

  const page = await context.newPage();

  return { context, page };
}

export async function waitForPageLoad(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await page.waitForResponse(urlPattern, { timeout });
}

// Data generation utilities
export function generateRandomEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `test.${timestamp}.${random}@example.com`;
}

export function generateRandomString(length: number = 10): string {
  return Math.random().toString(36).substr(2, length);
}

export function generateTestNewsletter(overrides: Partial<TestNewsletter> = {}): TestNewsletter {
  const timestamp = Date.now();
  const random = generateRandomString(6);

  return {
    title: `Test Newsletter ${random}`,
    content: `<h1>Test Newsletter Content</h1><p>This is a test newsletter created at ${new Date().toISOString()}</p>`,
    source_name: `Test Source ${random}`,
    source_email: `source.${random}@test.com`,
    received_at: new Date().toISOString(),
    is_read: false,
    is_archived: false,
    is_favorite: false,
    tags: ['Test'],
    reading_time_estimate: 3,
    summary: `Test newsletter summary ${random}`,
    ...overrides,
  };
}

export function generateTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const random = generateRandomString(6);

  return {
    email: generateRandomEmail(),
    password: `testpassword${random}`,
    fullName: `Test User ${random}`,
    role: 'user',
    ...overrides,
  };
}

export function generateTestTag(overrides: Partial<TestTag> = {}): TestTag {
  const random = generateRandomString(6);
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  return {
    name: `Test Tag ${random}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    ...overrides,
  };
}

export function generateTestSourceGroup(overrides: Partial<TestSourceGroup> = {}): TestSourceGroup {
  const random = generateRandomString(6);
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  return {
    name: `Test Group ${random}`,
    description: `Test source group created for testing purposes ${random}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    source_count: Math.floor(Math.random() * 10),
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

export const TEST_NEWSLETTERS = {
  UNREAD_AI: {
    title: 'The Future of AI: What to Expect in 2024',
    content: '<h1>AI Future</h1><p>Latest developments in AI...</p>',
    source_name: 'AI Weekly',
    source_email: 'ai@weekly.com',
    is_read: false,
    is_archived: false,
    tags: ['AI', 'Technology'],
  },
  READ_WEBDEV: {
    title: 'React 18.3: New Features and Improvements',
    content: '<h1>React Updates</h1><p>Latest React features...</p>',
    source_name: 'React Newsletter',
    source_email: 'react@newsletter.com',
    is_read: true,
    is_archived: false,
    tags: ['Web Development', 'React'],
  },
  ARCHIVED_STARTUP: {
    title: 'Startup Funding Trends: Q1 2024 Report',
    content: '<h1>Funding Report</h1><p>Quarterly analysis...</p>',
    source_name: 'Startup Digest',
    source_email: 'digest@startup.com',
    is_read: false,
    is_archived: true,
    tags: ['Startup', 'Business'],
  },
};

export const TEST_TAGS = {
  AI: { name: 'AI', color: '#FF6B6B' },
  WEBDEV: { name: 'Web Development', color: '#4ECDC4' },
  STARTUP: { name: 'Startup', color: '#45B7D1' },
  TECHNOLOGY: { name: 'Technology', color: '#96CEB4' },
};

export const TEST_SOURCE_GROUPS = {
  TECH: {
    name: 'Tech News',
    description: 'Technology and development newsletters',
    color: '#FF6B6B',
  },
  BUSINESS: {
    name: 'Business',
    description: 'Business and startup newsletters',
    color: '#4ECDC4',
  },
};

// Assertion helpers
export function expectNewsletterInList(newsletters: any[], expectedTitle: string): boolean {
  return newsletters.some(newsletter => newsletter.title === expectedTitle);
}

export function expectTagInList(tags: any[], expectedName: string): boolean {
  return tags.some(tag => tag.name === expectedName);
}

export function expectUserHasPermission(user: any, permission: string): boolean {
  return user.role === 'admin' || user.permissions?.includes(permission);
}

// Mock data generators for large datasets
export function generateMockNewsletters(count: number): TestNewsletter[] {
  return Array.from({ length: count }, (_, index) => ({
    ...generateTestNewsletter(),
    title: `Generated Newsletter ${index + 1}`,
    received_at: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

export function generateMockTags(count: number): TestTag[] {
  return Array.from({ length: count }, (_, index) => ({
    ...generateTestTag(),
    name: `Generated Tag ${index + 1}`,
  }));
}

// Environment setup helpers
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export function getTestTimeout(): number {
  return isCI() ? 60000 : 30000; // Longer timeout in CI
}

export function shouldRunVisualTests(): boolean {
  return process.env.VISUAL_TESTS !== 'false';
}

export function shouldRunSlowTests(): boolean {
  return process.env.SKIP_SLOW_TESTS !== 'true';
}
