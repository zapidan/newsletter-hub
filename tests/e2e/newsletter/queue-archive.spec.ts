import { test, expect } from '@playwright/test';
import { setupTestEnvironment, testConfig } from '../setup/test-environment';
import { setupTestUser, cleanupTestUser } from '../fixtures/auth';
import { createTestNewsletter, cleanupTestNewsletters } from '../fixtures/newsletter';
import { waitForToast } from '../../helpers/toast';

// Setup test environment
setupTestEnvironment();

test.describe('Queue and Archive E2E Tests', () => {
  let testUserId: string;
  let testNewsletterId: string;

  test.beforeAll(async () => {
    // Setup test user
    const { userId } = await setupTestUser();
    testUserId = userId;
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestNewsletters(testUserId);
    await cleanupTestUser(testUserId);
  });

  test.beforeEach(async ({ page }) => {
    // Create a test newsletter for each test
    const newsletter = await createTestNewsletter({
      userId: testUserId,
      title: 'Test Newsletter for Queue/Archive',
      content: 'This is test content for queue and archive operations',
      is_archived: false,
      is_read: false,
    });
    testNewsletterId = newsletter.id;

    // Login and navigate to newsletters
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testConfig.auth.testUserEmail());
    await page.fill('[data-testid="password-input"]', testConfig.auth.testUserPassword());
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/newsletters/inbox');
  });

  test.describe('Queue Removal Persistence', () => {
    test('should remove newsletter from queue and persist after navigation', async ({ page }) => {
      // Navigate to newsletter detail
      await page.click(`[data-testid="newsletter-${testNewsletterId}"]`);
      await page.waitForURL(`/newsletters/${testNewsletterId}`);

      // Add to reading queue first
      const addToQueueButton = page.getByRole('button', { name: /add to queue/i });
      await expect(addToQueueButton).toBeVisible();
      await addToQueueButton.click();

      // Wait for success toast
      await waitForToast(page, 'Added to reading queue');

      // Verify button changed to "Remove from queue"
      const removeFromQueueButton = page.getByRole('button', { name: /remove from queue/i });
      await expect(removeFromQueueButton).toBeVisible();

      // Remove from queue
      await removeFromQueueButton.click();
      await waitForToast(page, 'Removed from reading queue');

      // Verify button changed back to "Add to queue"
      await expect(addToQueueButton).toBeVisible();

      // Navigate away and back to verify persistence
      await page.goto('/newsletters/inbox');
      await page.waitForLoadState('networkidle');

      await page.click(`[data-testid="newsletter-${testNewsletterId}"]`);
      await page.waitForURL(`/newsletters/${testNewsletterId}`);

      // Verify the newsletter is still not in queue
      await expect(page.getByRole('button', { name: /add to queue/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /remove from queue/i })).not.toBeVisible();
    });

    test('should handle queue operations from list view', async ({ page }) => {
      // Stay on inbox list view
      await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible();

      // Find the newsletter row
      const newsletterRow = page.locator(`[data-testid="newsletter-row-${testNewsletterId}"]`);
      await expect(newsletterRow).toBeVisible();

      // Add to queue from list view
      const queueButton = newsletterRow.locator('[data-testid="queue-toggle-button"]');
      await expect(queueButton).toHaveAttribute('aria-label', 'Add to queue');
      await queueButton.click();

      await waitForToast(page, 'Added to reading queue');

      // Verify button state changed
      await expect(queueButton).toHaveAttribute('aria-label', 'Remove from queue');

      // Remove from queue
      await queueButton.click();
      await waitForToast(page, 'Removed from reading queue');

      // Verify button state changed back
      await expect(queueButton).toHaveAttribute('aria-label', 'Add to queue');

      // Refresh page to verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify queue state persisted
      const refreshedQueueButton = page.locator(
        `[data-testid="newsletter-row-${testNewsletterId}"] [data-testid="queue-toggle-button"]`
      );
      await expect(refreshedQueueButton).toHaveAttribute('aria-label', 'Add to queue');
    });

    test('should show queue items in reading queue view', async ({ page }) => {
      // Add newsletter to queue
      await page.click(`[data-testid="newsletter-${testNewsletterId}"]`);
      await page.waitForURL(`/newsletters/${testNewsletterId}`);

      await page.getByRole('button', { name: /add to queue/i }).click();
      await waitForToast(page, 'Added to reading queue');

      // Navigate to reading queue
      await page.goto('/newsletters/queue');
      await page.waitForLoadState('networkidle');

      // Verify newsletter appears in queue
      await expect(page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)).toBeVisible();
      await expect(page.locator('text=Test Newsletter for Queue/Archive')).toBeVisible();

      // Remove from queue in queue view
      const removeButton = page.locator(
        `[data-testid="newsletter-row-${testNewsletterId}"] [data-testid="queue-toggle-button"]`
      );
      await removeButton.click();
      await waitForToast(page, 'Removed from reading queue');

      // Verify newsletter disappears from queue view
      await expect(
        page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)
      ).not.toBeVisible();
    });
  });

  test.describe('Auto-Archive Functionality', () => {
    test('should auto-archive newsletter when marked as read with auto-archive enabled', async ({
      page,
    }) => {
      // Enable auto-archive in settings
      await page.goto('/settings/preferences');
      await page.waitForLoadState('networkidle');

      const autoArchiveToggle = page.locator('[data-testid="auto-archive-toggle"]');
      await autoArchiveToggle.check();
      await page.getByRole('button', { name: /save preferences/i }).click();
      await waitForToast(page, 'Preferences saved');

      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Verify newsletter is not archived
      await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible();

      // Mark as read
      const markAsReadButton = page.getByRole('button', { name: /mark as read/i });
      await markAsReadButton.click();

      // Wait for both toasts
      await waitForToast(page, 'Newsletter marked as read');
      await waitForToast(page, 'Newsletter archived');

      // Verify UI shows archived state
      await expect(page.getByRole('button', { name: /unarchive/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /mark as unread/i })).toBeVisible();

      // Navigate to archived view to confirm
      await page.goto('/newsletters/archived');
      await page.waitForLoadState('networkidle');

      // Verify newsletter appears in archived list
      await expect(page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)).toBeVisible();
    });

    test('should not auto-archive when auto-archive is disabled', async ({ page }) => {
      // Ensure auto-archive is disabled
      await page.goto('/settings/preferences');
      await page.waitForLoadState('networkidle');

      const autoArchiveToggle = page.locator('[data-testid="auto-archive-toggle"]');
      await autoArchiveToggle.uncheck();
      await page.getByRole('button', { name: /save preferences/i }).click();
      await waitForToast(page, 'Preferences saved');

      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Mark as read
      const markAsReadButton = page.getByRole('button', { name: /mark as read/i });
      await markAsReadButton.click();

      // Wait for read toast only
      await waitForToast(page, 'Newsletter marked as read');

      // Verify no archive toast appears
      await expect(page.locator('text=Newsletter archived')).not.toBeVisible({ timeout: 2000 });

      // Verify UI shows unarchived state
      await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /mark as unread/i })).toBeVisible();

      // Navigate to inbox to confirm it's still there
      await page.goto('/newsletters/inbox');
      await page.waitForLoadState('networkidle');

      // Verify newsletter is still in inbox (not archived)
      await expect(page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)).toBeVisible();
    });

    test('should handle manual archive correctly', async ({ page }) => {
      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Manually archive
      const archiveButton = page.getByRole('button', { name: /^archive$/i });
      await archiveButton.click();
      await waitForToast(page, 'Newsletter archived');

      // Verify UI updates
      await expect(page.getByRole('button', { name: /unarchive/i })).toBeVisible();

      // Unarchive
      await page.getByRole('button', { name: /unarchive/i }).click();
      await waitForToast(page, 'Newsletter unarchived');

      // Verify UI updates back
      await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible();
    });
  });

  test.describe('Combined Operations', () => {
    test('should handle queue and archive operations together', async ({ page }) => {
      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Add to queue
      await page.getByRole('button', { name: /add to queue/i }).click();
      await waitForToast(page, 'Added to reading queue');

      // Archive the newsletter
      await page.getByRole('button', { name: /^archive$/i }).click();
      await waitForToast(page, 'Newsletter archived');

      // Navigate to reading queue
      await page.goto('/newsletters/queue');
      await page.waitForLoadState('networkidle');

      // Verify archived newsletter still appears in queue
      await expect(page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)).toBeVisible();

      // Navigate to archived view
      await page.goto('/newsletters/archived');
      await page.waitForLoadState('networkidle');

      // Verify newsletter appears in archived view
      await expect(page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)).toBeVisible();

      // Remove from queue while in archived view
      const queueButton = page.locator(
        `[data-testid="newsletter-row-${testNewsletterId}"] [data-testid="queue-toggle-button"]`
      );
      await queueButton.click();
      await waitForToast(page, 'Removed from reading queue');

      // Go back to reading queue to verify removal
      await page.goto('/newsletters/queue');
      await page.waitForLoadState('networkidle');

      // Verify newsletter no longer in queue
      await expect(
        page.locator(`[data-testid="newsletter-${testNewsletterId}"]`)
      ).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Intercept API calls to simulate network error
      await context.route('**/api/reading-queue/**', (route) => {
        route.abort('failed');
      });

      // Try to add to queue
      await page.getByRole('button', { name: /add to queue/i }).click();

      // Verify error toast
      await waitForToast(page, /failed to update reading queue/i);

      // Verify UI state remains unchanged
      await expect(page.getByRole('button', { name: /add to queue/i })).toBeVisible();
    });

    test('should recover from failed operations', async ({ page, context }) => {
      // Navigate to newsletter detail
      await page.goto(`/newsletters/${testNewsletterId}`);
      await page.waitForLoadState('networkidle');

      // Add to queue successfully first
      await page.getByRole('button', { name: /add to queue/i }).click();
      await waitForToast(page, 'Added to reading queue');

      // Intercept API calls to simulate error for removal
      await context.route('**/api/reading-queue/**', (route) => {
        if (route.request().method() === 'DELETE') {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      // Try to remove from queue (will fail)
      await page.getByRole('button', { name: /remove from queue/i }).click();
      await waitForToast(page, /failed to update reading queue/i);

      // Remove route interception
      await context.unroute('**/api/reading-queue/**');

      // Try again (should succeed)
      await page.getByRole('button', { name: /remove from queue/i }).click();
      await waitForToast(page, 'Removed from reading queue');

      // Verify final state
      await expect(page.getByRole('button', { name: /add to queue/i })).toBeVisible();
    });
  });
});
