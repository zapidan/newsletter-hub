import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  fullName?: string;
}

/**
 * Gets the test user data from the global setup
 * @returns The test user data
 */
export function getTestUser(): TestUser {
  const testUserPath = path.join(__dirname, '../test-user.json');
  const testUserData = JSON.parse(readFileSync(testUserPath, 'utf-8'));

  return {
    userId: testUserData.id,
    email: testUserData.email,
    password: testUserData.password,
    fullName: testUserData.fullName,
  };
}

/**
 * Creates a mock test user for E2E tests
 * Since we're using mock APIs, this just returns predefined test data
 * @returns Object containing the test user's ID and credentials
 */
export async function setupTestUser(): Promise<TestUser> {
  // In mock mode, we use predefined test users
  const timestamp = Date.now();
  return {
    userId: `test-user-${timestamp}`,
    email: `test-${timestamp}@example.com`,
    password: 'testpassword123',
    fullName: 'Test User',
  };
}

/**
 * Cleans up a test user after E2E tests
 * In mock mode, this is a no-op since we're not using a real database
 * @param userId - The ID of the test user to clean up
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  // No-op in mock mode
  console.log(`Mock cleanup for user: ${userId}`);
}

/**
 * Signs in a test user using the UI
 * @param page - The Playwright page object
 * @param email - The test user's email
 * @param password - The test user's password
 */
export async function signInTestUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('[data-testid="email-input"]', { state: 'visible' });

  // Fill in the login form
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);

  // Click the login button
  await page.click('[data-testid="login-button"]');

  // Wait for navigation to complete
  await page.waitForURL('/newsletters/inbox', { timeout: 10000 });
}

/**
 * Signs out the current test user
 * @param page - The Playwright page object
 */
export async function signOutTestUser(page: Page): Promise<void> {
  // Click on user menu or avatar
  const userMenu = page.locator('[data-testid="user-menu"], [data-testid="user-avatar"]').first();
  if (await userMenu.isVisible()) {
    await userMenu.click();

    // Click logout button
    await page.click('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")');

    // Wait for redirect to login page
    await page.waitForURL('/login', { timeout: 5000 });
  }
}

/**
 * Checks if a user is currently signed in
 * @param page - The Playwright page object
 * @returns True if signed in, false otherwise
 */
export async function isSignedIn(page: Page): Promise<boolean> {
  // Check for auth token in localStorage
  const authToken = await page.evaluate(() => {
    const token = localStorage.getItem('sb-mock-auth-token');
    return token ? JSON.parse(token) : null;
  });

  return authToken && authToken.access_token && authToken.expires_at > Date.now() / 1000;
}

/**
 * Sets up authentication state for a test
 * @param page - The Playwright page object
 * @param user - Optional user data to use
 */
export async function setupAuthState(page: Page, user?: Partial<TestUser>): Promise<void> {
  const testUser = user || getTestUser();

  // Set the auth token in localStorage
  await page.evaluate((userData) => {
    const authData = {
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: userData.userId,
        email: userData.email,
        user_metadata: {
          full_name: userData.fullName || 'Test User',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    localStorage.setItem('sb-mock-auth-token', JSON.stringify(authData));
  }, testUser as any);
}

/**
 * Clears authentication state
 * @param page - The Playwright page object
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('sb-mock-auth-token');
    // Clear any other auth-related storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });
  });
}

/**
 * Creates multiple test users for bulk operations
 * In mock mode, returns predefined test users
 * @param count - Number of test users to create
 * @returns Array of test users
 */
export async function setupMultipleTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];
  const baseTimestamp = Date.now();

  for (let i = 0; i < count; i++) {
    users.push({
      userId: `test-user-${baseTimestamp}-${i}`,
      email: `test-${baseTimestamp}-${i}@example.com`,
      password: 'testpassword123',
      fullName: `Test User ${i + 1}`,
    });
  }

  return users;
}

/**
 * Waits for authentication to be ready
 * @param page - The Playwright page object
 * @param timeout - Maximum time to wait in milliseconds
 * @returns True if auth is ready, false if timeout
 */
export async function waitForAuthReady(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const token = localStorage.getItem('sb-mock-auth-token');
        return token !== null;
      },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}
