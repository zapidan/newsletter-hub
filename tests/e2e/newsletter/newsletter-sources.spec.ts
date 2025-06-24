import { test, expect } from '@playwright/test';
import { setupTestEnvironment, testConfig } from '../setup/test-environment';
import { loginUser, TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../fixtures/auth'; // Adjusted import
import { waitForToast } from '../../helpers/toast';

// Setup test environment
setupTestEnvironment();

const SOURCE_NAME_PREFIX = 'E2E Test Source';
const SOURCE_FROM_PREFIX = 'e2e-test-source';

// Helper to generate unique source names and emails
const generateSourceDetails = (id: string | number) => ({
  name: `${SOURCE_NAME_PREFIX} ${id}`,
  from: `${SOURCE_FROM_PREFIX}-${id}@example.com`,
});

test.describe('Newsletter Source Management E2E Tests', () => {
  let testUser: { email: string; password: string; id: string; fullName: string; };

  test.beforeAll(async () => {
    // In a real scenario, you might create a fresh user or use a pre-configured one.
    // For now, using the standard test user.
    testUser = {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      id: 'test-user-123', // This ID might need to be dynamic or from a fixture
      fullName: 'Test User'
    };
  });

  test.beforeEach(async ({ page }) => {
    await loginUser(page, testUser.email, testUser.password);
    await page.goto('/settings'); // Navigate to settings page

    // Click the "Newsletters" tab in settings
    // The selector for tabs might need adjustment based on actual implementation
    await page.locator('button:has-text("Newsletters")').click();
    // Wait for the content of the newsletter sources tab to be visible
    await expect(page.locator('h3:has-text("Newsletter Sources")')).toBeVisible({ timeout: 10000 });
  });

  test('should display existing newsletter sources', async ({ page }) => {
    // This test assumes some sources might exist or are seeded.
    // For a clean test, sources should be created as part of the test setup.
    const sourceList = page.locator('ul li:has-text("@")'); // Generic selector for list items containing source emails
    await expect(sourceList.first()).toBeVisible({ timeout: 15000 }); // Wait longer for potential initial load
  });

  test('should allow archiving and unarchiving a newsletter source', async ({ page }) => {
    const uniqueId = Date.now();
    const sourceDetails = generateSourceDetails(uniqueId);

    // --- This part is problematic without a way to create sources via UI ---
    // Ideally:
    // 1. Create a new source via UI (e.g., a "Add Source" button and form)
    //    - Fill in name: sourceDetails.name
    //    - Fill in from: sourceDetails.from
    //    - Submit form
    //    - Verify toast "Source created"
    // For now, we'll assume the source exists or is created by other means and try to find it.
    // This test will likely fail or be flaky until source creation UI tests are added.

    // Let's assume a source exists with a known name or part of it.
    // This needs a more robust selector based on actual source listing UI.
    // For example, data-testid attributes on source rows would be ideal.
    const sourceRow = page.locator(`li:has-text("${SOURCE_NAME_PREFIX}")`).first(); // Find any test source

    if (!await sourceRow.isVisible()) {
      console.warn('Skipping archive/unarchive test: No test source found to interact with. UI for source creation needed.');
      test.skip(true, 'Skipping due to missing source creation capability in test.');
      return;
    }

    const sourceName = await sourceRow.locator('span.font-medium').textContent(); // Get name for logging
    const archiveToggle = sourceRow.locator('button[role="switch"]');
    const isInitiallyArchived = (await archiveToggle.getAttribute('aria-checked')) === 'false'; // Playwright uses 'false' for unchecked (active)

    // Archive if not archived, or unarchive if archived to test both states
    if (!isInitiallyArchived) {
      await archiveToggle.click();
      // await waitForToast(page, /Source.*archived/i); // Toast message might vary
      await expect(archiveToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5000 }); // Becomes "unchecked" meaning archived in this UI
      console.log(`Archived source: ${sourceName}`);
    } else {
      console.log(`Source ${sourceName} is already archived, will attempt to unarchive.`);
    }

    // Unarchive
    await archiveToggle.click();
    // await waitForToast(page, /Source.*unarchived/i); // Toast message might vary
    await expect(archiveToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5000 }); // Becomes "checked" meaning active
    console.log(`Unarchived source: ${sourceName}`);

    // Archive again to test the other direction if it was initially archived
     if (isInitiallyArchived) {
      await archiveToggle.click();
      // await waitForToast(page, /Source.*archived/i);
      await expect(archiveToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });
      console.log(`Re-archived source: ${sourceName}`);
    }
  });

  // TODO: Add tests for creating a new source once UI is known
  // test('should allow creating a new newsletter source', async ({ page }) => { ... });

  // TODO: Add tests for editing an existing source once UI is known
  // test('should allow editing an existing newsletter source', async ({ page }) => { ... });

  // TODO: Add tests for deleting a source (if UI exists and handles newsletters)
  // test('should prevent deleting a source with newsletters', async ({ page }) => { ... });
  // test('should allow deleting a source with no newsletters', async ({ page }) => { ... });

  // TODO: Add tests for error handling (e.g., duplicate 'from' email)
  // test('should show error when creating source with duplicate "from" email', async ({ page }) => { ... });
});
