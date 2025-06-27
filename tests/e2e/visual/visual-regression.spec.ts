import { expect, test } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
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
    });

    // Mock newsletter data
    await page.route('**/rest/v1/newsletters**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            title: 'Test Newsletter 1',
            content: 'Test content 1',
            source_name: 'Test Source',
            is_read: false,
            is_favorite: false,
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            title: 'Test Newsletter 2',
            content: 'Test content 2',
            source_name: 'Test Source',
            is_read: true,
            is_favorite: true,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/');
  });

  test.describe('Login Page Visual Tests', () => {
    test('login page should look correct on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/login');

      // Wait for animations to complete
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('login-mobile.png');
    });

    test('login page should look correct on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/login');

      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('login-tablet.png');
    });

    test('login page should look correct on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/login');

      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('login-desktop.png');
    });
  });

  test.describe('Dashboard Visual Tests', () => {
    test('dashboard should look correct on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      // Wait for content to load
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('dashboard-mobile.png');
    });

    test('dashboard should look correct on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('dashboard-tablet.png');
    });

    test('dashboard should look correct on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('dashboard-desktop.png');
    });

    test('mobile sidebar should look correct when open', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Open mobile sidebar
      await page.click('button[aria-label="Toggle menu"]');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('mobile-sidebar-open.png');
    });
  });

  test.describe('Newsletter Detail Visual Tests', () => {
    test('newsletter detail should look correct on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Click on first newsletter
      await page.click('[data-testid="newsletter-item"]').first();
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('newsletter-detail-mobile.png');
    });

    test('newsletter detail should look correct on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Click on first newsletter
      await page.click('[data-testid="newsletter-item"]').first();
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('newsletter-detail-desktop.png');
    });
  });

  test.describe('Component Visual Tests', () => {
    test('header should look correct on all viewports', async ({ page }) => {
      const viewports = [
        { width: 390, height: 844, name: 'mobile' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        const header = page.locator('header');
        await expect(header).toHaveScreenshot(`header-${viewport.name}.png`);
      }
    });

    test('sidebar should look correct on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 });
      await page.waitForTimeout(500);

      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toHaveScreenshot('sidebar-desktop.png');
    });
  });

  test.describe('Interactive State Visual Tests', () => {
    test('button hover states should look correct', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Hover over first newsletter item
      await page.hover('[data-testid="newsletter-item"]').first();
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('newsletter-item-hover.png');
    });

    test('focus states should look correct', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Focus on first newsletter item
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('newsletter-item-focus.png');
    });
  });

  test.describe('Error State Visual Tests', () => {
    test('error state should look correct on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      // Mock error response
      await page.route('**/rest/v1/newsletters**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('error-state-mobile.png');
    });

    test('error state should look correct on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      // Mock error response
      await page.route('**/rest/v1/newsletters**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('error-state-desktop.png');
    });
  });

  test.describe('Loading State Visual Tests', () => {
    test('loading state should look correct on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      // Mock slow response
      await page.route('**/rest/v1/newsletters**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('loading-state-mobile.png');
    });
  });
}); 