import { expect, test } from '@playwright/test';

// Test data
const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    full_name: 'Test User',
  },
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  confirmed_at: '2024-01-01T00:00:00.000Z',
};

const TEST_SESSION = {
  access_token: 'mock-access-token-123',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token-123',
  user: TEST_USER,
};

const MOCK_NEWSLETTERS = [
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
];

test.describe('Responsive Design Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication endpoints
    await page.route('**/auth/v1/**', async (route, request) => {
      const url = new URL(request.url());
      const method = request.method();

      if (url.pathname.endsWith('/token') && method === 'POST') {
        const postData = request.postDataJSON();
        const grantType = url.searchParams.get('grant_type');

        if (grantType === 'password' && postData.email === 'test@example.com') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(TEST_SESSION),
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Invalid login credentials',
            }),
          });
        }
        return;
      }

      if (url.pathname.endsWith('/user') && method === 'GET') {
        const authHeader = request.headers()['authorization'];
        if (authHeader === 'Bearer mock-access-token-123') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user: TEST_USER }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid token' }),
          });
        }
        return;
      }

      if (url.pathname.endsWith('/logout') && method === 'POST') {
        await route.fulfill({
          status: 204,
        });
        return;
      }

      await route.continue();
    });

    // Mock newsletter API endpoints
    await page.route('**/rest/v1/**', async (route, request) => {
      const url = new URL(request.url());
      const method = request.method();

      if (url.pathname.includes('/newsletters')) {
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_NEWSLETTERS),
          });
        } else if (method === 'PATCH') {
          // Handle newsletter updates
          const id = url.pathname.split('/').pop();
          const newsletter = MOCK_NEWSLETTERS.find((n) => n.id === id);
          if (newsletter) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(newsletter),
            });
          } else {
            await route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Not found' }),
            });
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
      } else {
        // Default response for other endpoints
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    // Login
    await page.goto('/login');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for form elements to be visible
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="password-input"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="login-button"]', { timeout: 10000 });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');

    // Wait for navigation to inbox
    await page.waitForURL('**/inbox', { timeout: 10000 });

    // Wait for content to load
    await page.waitForTimeout(2000);
  });

  test.describe('Mobile Viewport (iPhone 14)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('should display mobile-optimized layout', async ({ page }) => {
      // Check that sidebar is hidden by default on mobile
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

      // Check that hamburger menu is visible
      await expect(page.locator('button[aria-label="Toggle menu"]')).toBeVisible();

      // Check that search is hidden in header on mobile
      await expect(page.locator('form[class*="hidden sm:block"]')).not.toBeVisible();
    });

    test('should show mobile sidebar when menu is toggled', async ({ page }) => {
      // Click hamburger menu
      await page.click('[data-testid="hamburger-menu-button"]');

      // Check that sidebar is now visible
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

      // Check that backdrop is visible
      await expect(page.locator('.fixed.inset-0.bg-black\\/40')).toBeVisible();
    });

    test('should close mobile sidebar when backdrop is clicked', async ({ page }) => {
      // Open sidebar
      await page.click('[data-testid="hamburger-menu-button"]');
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

      // Click backdrop
      await page.click('.fixed.inset-0.bg-black\\/40');

      // Check that sidebar is hidden
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    });

    test('should have proper touch targets on mobile', async ({ page }) => {
      // Check that buttons have adequate touch target size (minimum 44px)
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should handle newsletter list on mobile', async ({ page }) => {
      // Check that newsletter items are properly spaced
      const newsletterItems = page.locator('[data-testid^="newsletter-row-"]');
      await expect(newsletterItems.first()).toBeVisible();

      // Check that text is readable on mobile
      const title = newsletterItems.first().locator('[data-testid="newsletter-title"]');
      const computedStyle = await title.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        };
      });

      // Font size should be at least 14px for mobile readability
      const fontSize = parseFloat(computedStyle.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(14);
    });
  });

  test.describe('Tablet Viewport (iPad Pro)', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test('should display tablet-optimized layout', async ({ page }) => {
      // Check that sidebar is visible on tablet
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

      // Check that hamburger menu is hidden on tablet
      await expect(page.locator('button[aria-label="Toggle menu"]')).not.toBeVisible();

      // Check that search is visible in header
      await expect(page.locator('form[class*="hidden sm:block"]')).toBeVisible();
    });

    test('should have appropriate spacing on tablet', async ({ page }) => {
      // Check main content padding
      const main = page.locator('main');
      const computedStyle = await main.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
        };
      });

      // Should have responsive padding
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      expect(paddingLeft).toBeGreaterThanOrEqual(24); // md:px-6 = 24px
      expect(paddingRight).toBeGreaterThanOrEqual(24);
    });
  });

  test.describe('Desktop Viewport', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should display desktop-optimized layout', async ({ page }) => {
      // Check that sidebar is visible and has proper width
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBeGreaterThanOrEqual(288); // w-72 = 288px

      // Check that search field is wider on desktop
      const searchInput = page.locator('input[placeholder="Search..."]');
      const searchBox = await searchInput.boundingBox();
      expect(searchBox?.width).toBeGreaterThanOrEqual(256); // w-64 = 256px
    });

    test('should have hover effects on desktop', async ({ page }) => {
      // Test hover effects on sidebar links
      const sidebarLink = page.locator('[data-testid="sidebar-link"]').first();

      // Hover over the link
      await sidebarLink.hover();

      // Check for hover state (this might need adjustment based on actual CSS)
      await expect(sidebarLink).toHaveCSS('background-color', 'rgb(248, 250, 252)');
    });
  });

  test.describe('Large Desktop Viewport', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('should handle large screen layouts', async ({ page }) => {
      // Check that content is properly centered and constrained
      const mainContent = page.locator('main > div');
      const computedStyle = await mainContent.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          maxWidth: style.maxWidth,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
        };
      });

      // Should have max-width constraint
      expect(computedStyle.maxWidth).toBe('80rem'); // max-w-7xl = 80rem

      // Should be centered
      expect(computedStyle.marginLeft).toBe('auto');
      expect(computedStyle.marginRight).toBe('auto');
    });
  });

  test.describe('Cross-Viewport Functionality', () => {
    test('should maintain functionality across viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 390, height: 844, name: 'mobile' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' },
        { width: 1920, height: 1080, name: 'large-desktop' },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        // Test that newsletter items are always visible
        await expect(page.locator('[data-testid^="newsletter-row-"]').first()).toBeVisible();

        // Test that navigation works
        await page.locator('[data-testid^="newsletter-row-"]').first().click();
        await expect(page.locator('[data-testid="newsletter-detail"]')).toBeVisible();

        // Go back to list
        await page.goBack();
      }
    });

    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('button[aria-label="Toggle menu"]')).toBeVisible();

      // Switch to landscape
      await page.setViewportSize({ width: 844, height: 390 });

      // On larger landscape, sidebar should be visible
      if (page.viewportSize()!.width >= 768) {
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      }
    });
  });

  test.describe('Accessibility Across Viewports', () => {
    test('should maintain accessibility on all viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 390, height: 844 },
        { width: 1024, height: 768 },
        { width: 1280, height: 720 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        // Check that all interactive elements have proper ARIA labels
        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < count; i++) {
          const button = buttons.nth(i);
          const ariaLabel = await button.getAttribute('aria-label');
          const textContent = await button.textContent();

          // Either aria-label or text content should be present
          expect(ariaLabel || textContent?.trim()).toBeTruthy();
        }

        // Check that focus indicators are visible
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }
    });
  });
}); 