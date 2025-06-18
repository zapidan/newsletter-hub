import { chromium, type FullConfig } from '@playwright/test';
import { createTestUser, setupTestDatabase } from './test-fixtures';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  const { baseURL } = config.projects[0].use;

  try {
    // Setup test database
    await setupTestDatabase();
    console.log('✅ Test database initialized');

    // Create test users
    await createTestUser({
      email: 'test@example.com',
      password: 'testpassword123',
      fullName: 'Test User',
    });

    await createTestUser({
      email: 'admin@example.com',
      password: 'adminpassword123',
      fullName: 'Admin User',
      role: 'admin',
    });
    console.log('✅ Test users created');

    // Launch browser for authentication
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    // Navigate to login page using the baseURL
    await page.goto(`${baseURL}/login`);

    // Login as test user to generate auth state
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForURL(`${baseURL}/inbox`);

    // Save authentication state
    await context.storageState({ path: 'playwright/.auth/user.json' });
    console.log('✅ User authentication state saved');

    // Logout and login as admin
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    await page.goto(`${baseURL}/login`);
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'adminpassword123');
    await page.click('[data-testid="login-button"]');

    await page.waitForURL(`${baseURL}/inbox`);

    // Save admin authentication state
    await context.storageState({ path: 'playwright/.auth/admin.json' });
    console.log('✅ Admin authentication state saved');

    // Save storage state for authenticated tests
    await context.storageState({ path: 'playwright/.auth/user.json' });
    await browser.close();

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;
