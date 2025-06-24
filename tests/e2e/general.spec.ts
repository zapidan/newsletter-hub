import { test, expect } from '@playwright/test';
import { loginUser } from './fixtures/auth'; // Assuming a login helper

test.describe('General Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // For HomePage tests that don't require login, this can be conditional
    // For now, assume login is needed to see standard nav elements after home.
    await loginUser(page);
  });

  test.describe('HomePage', () => {
    test('should display welcome message and navigation buttons', async ({ page }) => {
      await page.goto('/'); // Assuming HomePage is at the root after login, or adjust if it's a public page

      // Verify welcome message
      await expect(page.locator('h1:has-text("Welcome to NewsletterHub")')).toBeVisible();
      await expect(page.locator('p:has-text("Your one-stop solution for managing and reading newsletters")')).toBeVisible();

      // Verify navigation buttons
      const inboxButton = page.locator('button:has-text("Go to Inbox")');
      const manageButton = page.locator('button:has-text("Manage Newsletters")');

      await expect(inboxButton).toBeVisible();
      await expect(manageButton).toBeVisible();
    });

    test('should navigate to Inbox when "Go to Inbox" is clicked', async ({ page }) => {
      await page.goto('/');
      await page.locator('button:has-text("Go to Inbox")').click();
      await page.waitForURL('**/inbox');
      await expect(page).toHaveURL(/.*\/inbox/);
    });

    test('should navigate to Newsletters page when "Manage Newsletters" is clicked', async ({ page }) => {
      await page.goto('/');
      // Assuming '/newsletters' is the correct path for "Manage Newsletters"
      // This might be the NewslettersPage which then defaults to a sub-view like inbox or sources.
      await page.locator('button:has-text("Manage Newsletters")').click();
      await page.waitForURL('**/newsletters');
      await expect(page).toHaveURL(/.*\/newsletters/);
    });
  });
});
