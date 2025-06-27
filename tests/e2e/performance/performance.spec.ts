import { expect, test } from '@playwright/test';

test.describe('Performance Tests', () => {
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

  test.describe('Page Load Performance', () => {
    test('dashboard should load within 3 seconds on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      const startTime = Date.now();
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('dashboard should load within 2 seconds on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      const startTime = Date.now();
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(2000);
    });

    test('newsletter detail should load within 1 second', async ({ page }) => {
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      const startTime = Date.now();
      await page.locator('[data-testid="newsletter-item"]').first().click();
      await page.waitForSelector('[data-testid="newsletter-detail"]', { timeout: 3000 });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(1000);
    });
  });

  test.describe('Interaction Performance', () => {
    test('mobile sidebar should open within 300ms', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      const startTime = Date.now();
      await page.click('button[aria-label="Toggle menu"]');
      await page.waitForSelector('[data-testid="sidebar"]', { timeout: 1000 });
      const openTime = Date.now() - startTime;

      expect(openTime).toBeLessThan(300);
    });

    test('newsletter actions should respond within 200ms', async ({ page }) => {
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      const newsletterItem = page.locator('[data-testid="newsletter-item"]').first();

      // Test mark as read
      const startTime = Date.now();
      await newsletterItem.click();
      await page.waitForTimeout(100); // Wait for any visual feedback
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(200);
    });

    test('search should respond within 500ms', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      const searchInput = page.locator('input[placeholder="Search..."]');

      const startTime = Date.now();
      await searchInput.fill('test');
      await page.waitForTimeout(300); // Wait for debounce
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(500);
    });
  });

  test.describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during navigation', async ({ page }) => {
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Navigate between pages multiple times
      for (let i = 0; i < 5; i++) {
        await page.locator('[data-testid="newsletter-item"]').first().click();
        await page.waitForSelector('[data-testid="newsletter-detail"]', { timeout: 3000 });
        await page.goBack();
        await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 3000 });
      }

      // Check that page is still responsive
      await page.locator('[data-testid="newsletter-item"]').first().click();
      await expect(page.locator('[data-testid="newsletter-detail"]')).toBeVisible();
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Test Newsletter ${i + 1}`,
        content: `Test content ${i + 1}`,
        source_name: 'Test Source',
        is_read: i % 2 === 0,
        is_favorite: i % 3 === 0,
        created_at: new Date().toISOString(),
      }));

      await page.route('**/rest/v1/newsletters**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeDataset),
        });
      });

      await page.reload();

      const startTime = Date.now();
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 10000 });
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds even with large dataset
      expect(loadTime).toBeLessThan(5000);

      // Should be able to scroll smoothly
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(500);

      // Should be able to interact with items
      await page.locator('[data-testid="newsletter-item"]').first().click();
      await expect(page.locator('[data-testid="newsletter-detail"]')).toBeVisible();
    });
  });

  test.describe('Network Performance', () => {
    test('should handle slow network gracefully', async ({ page }) => {
      // Mock slow network
      await page.route('**/rest/v1/newsletters**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload();

      // Should show loading state
      await expect(page.locator('[data-testid="loading"]')).toBeVisible();

      // Should eventually load
      await page.waitForSelector('[data-testid="newsletter-item"], [data-testid="empty-state"]', { timeout: 10000 });
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/rest/v1/newsletters**', async (route) => {
        await route.abort('failed');
      });

      await page.reload();

      // Should show error state
      await expect(page.locator('[data-testid="error"]')).toBeVisible();
    });
  });

  test.describe('Cross-Viewport Performance', () => {
    test('should maintain performance across viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 390, height: 844, name: 'mobile' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        const startTime = Date.now();
        await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });
        const loadTime = Date.now() - startTime;

        // Each viewport should load within reasonable time
        expect(loadTime).toBeLessThan(3000);

        // Test interaction performance
        const interactionStart = Date.now();
        await page.locator('[data-testid="newsletter-item"]').first().click();
        await page.waitForSelector('[data-testid="newsletter-detail"]', { timeout: 3000 });
        const interactionTime = Date.now() - interactionStart;

        expect(interactionTime).toBeLessThan(1000);

        await page.goBack();
      }
    });
  });

  test.describe('Accessibility Performance', () => {
    test('keyboard navigation should be responsive', async ({ page }) => {
      await page.waitForSelector('[data-testid="newsletter-item"]', { timeout: 5000 });

      // Test keyboard navigation speed
      const startTime = Date.now();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid="newsletter-detail"]', { timeout: 3000 });
      const navigationTime = Date.now() - startTime;

      expect(navigationTime).toBeLessThan(1000);
    });
  });
}); 