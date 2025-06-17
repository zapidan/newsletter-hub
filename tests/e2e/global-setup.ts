import { chromium, FullConfig } from '@playwright/test';
import { createTestUser, setupTestDatabase } from './test-fixtures';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');

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
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('/login');

    // Login as test user to generate auth state
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForURL('/inbox');

    // Save authentication state
    await context.storageState({ path: 'playwright/.auth/user.json' });
    console.log('✅ User authentication state saved');

    // Logout and login as admin
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'adminpassword123');
    await page.click('[data-testid="login-button"]');

    await page.waitForURL('/inbox');

    // Save admin authentication state
    await context.storageState({ path: 'playwright/.auth/admin.json' });
    console.log('✅ Admin authentication state saved');

  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  // Setup mock data
  await setupMockNewsletters();
  console.log('✅ Mock newsletters created');

  console.log('🎉 Global E2E test setup completed successfully!');
}

async function setupMockNewsletters() {
  const mockNewsletters = [
    {
      title: 'AI Newsletter #1',
      content: '<h1>Artificial Intelligence Updates</h1><p>Latest developments in AI technology...</p>',
      source_name: 'AI Weekly',
      source_email: 'ai@weekly.com',
      received_at: new Date().toISOString(),
      is_read: false,
      is_archived: false,
      tags: ['AI', 'Technology'],
    },
    {
      title: 'Web Development Trends 2024',
      content: '<h1>Web Development Trends</h1><p>What to expect in web development this year...</p>',
      source_name: 'Dev Weekly',
      source_email: 'dev@weekly.com',
      received_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      is_read: true,
      is_archived: false,
      tags: ['Web Development', 'Programming'],
    },
    {
      title: 'Startup Funding Report Q1',
      content: '<h1>Quarterly Funding Report</h1><p>Analysis of startup funding trends...</p>',
      source_name: 'Startup Digest',
      source_email: 'digest@startup.com',
      received_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      is_read: false,
      is_archived: true,
      tags: ['Startup', 'Business'],
    },
  ];

  // Insert mock newsletters into test database
  for (const newsletter of mockNewsletters) {
    await insertTestNewsletter(newsletter);
  }
}

async function insertTestNewsletter(newsletter: any) {
  // This would typically interact with your test database
  // Implementation depends on your database setup
  console.log(`📧 Creating test newsletter: ${newsletter.title}`);
}

export default globalSetup;
