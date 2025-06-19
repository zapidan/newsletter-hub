import { chromium, type FullConfig } from '@playwright/test';
import { createTestUser, setupTestDatabase } from './test-fixtures';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  const { baseURL, storageState } = config.projects[0].use;

  try {
    // Setup test database
    console.log('🔄 Setting up test database...');
    await setupTestDatabase();
    console.log('✅ Test database initialized');

    // Create test users
    console.log('🔄 Creating test users...');
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
    console.log('🔄 Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      // Navigate to login page with retries
      console.log(`🌐 Navigating to login page: ${baseURL}/login`);
      await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });

      // Wait for the login form to be visible
      console.log('🔍 Waiting for login form...');
      await page.waitForSelector('[data-testid="email-input"]', { state: 'visible', timeout: 10000 });
      
      // Fill in login form
      console.log('🔑 Filling login form...');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'testpassword123');
      
      // Click login button and wait for navigation
      console.log('🚀 Submitting login form...');
      await Promise.all([
        page.waitForURL(`${baseURL}/inbox`, { timeout: 30000 }),
        page.click('[data-testid="login-button"]')
      ]);

      // Save authentication state
      console.log('💾 Saving authentication state...');
      await context.storageState({ path: storageState as string });
      console.log('✅ User authentication state saved');

      // Logout and login as admin
      console.log('🔄 Logging out...');
      await page.goto(`${baseURL}/settings`);
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(`${baseURL}/login`);

    } catch (error) {
      console.error('❌ Error during test setup:', error);
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/setup-failure.png' });
      console.log('📸 Screenshot saved to test-results/setup-failure.png');
      throw error;
    } finally {
      await browser.close();
    }

    console.log('✨ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;
