import { expect, test } from '@playwright/test';

test.describe('Basic Page Loading', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that the login form is present
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();

    // Check that the page title is correct
    await expect(page).toHaveTitle(/NewsletterHub/);
  });

  test('should handle authentication and load inbox', async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/v1/**', async (route, request) => {
      const url = new URL(request.url());
      const method = request.method();

      if (url.pathname.endsWith('/token') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-token',
            refresh_token: 'mock-refresh-token',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          }),
        });
        return;
      }

      if (url.pathname.endsWith('/user') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    // Mock newsletter data
    await page.route('**/rest/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Go to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');

    // Wait for navigation
    await page.waitForURL('**/inbox', { timeout: 10000 });

    // Check that we're on the inbox page
    expect(page.url()).toContain('/inbox');

    // Check that basic layout elements are present
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="hamburger-menu-button"]')).toBeVisible();
  });
}); 