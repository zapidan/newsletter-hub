import { test, expect } from './auth.setup';
import {
  createTestNewsletter,
  createTestTag,
  generateTestNewsletter,
  TEST_USERS,
  TEST_NEWSLETTERS,
  waitForPageLoad,
  waitForApiResponse,
} from './test-fixtures';

// Helper function to login
async function login(page, email, password) {
  // Navigate to login page and wait for it to load
  await page.goto('/login');
  await page.waitForSelector('[data-testid="email-input"]', { state: 'visible' });
  
  // Fill in the login form
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  
  // Click the login button and wait for navigation
  const navigationPromise = page.waitForURL('**/inbox', { timeout: 10000 });
  await page.click('[data-testid="login-button"]');
  
  try {
    await navigationPromise;
    await page.waitForLoadState('networkidle');
    return true;
  } catch (error) {
    console.error('Login navigation failed:', error);
    return false;
  }
}

test.describe('Newsletter Workflows E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data and go to home page
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.describe('Authentication Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      // Perform login
      const loginSuccess = await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
      
      // Verify login was successful
      expect(loginSuccess, 'Login should complete successfully').toBe(true);
      await expect(page).toHaveURL('/inbox');
      
      // Verify user menu is visible
      await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');
      await page.waitForSelector('[data-testid="email-input"]', { state: 'visible' });
      
      // Fill in with invalid credentials
      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      
      // Click login and wait for error
      await page.click('[data-testid="login-button"]');
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]', { state: 'visible' });
      
      // Verify error is shown and still on login page
      await expect(page.locator('[data-testid="error-message"]'))
        .toContainText('Invalid login credentials');
      await expect(page).toHaveURL('/login');
    });

    test('should logout successfully', async ({ page }) => {
      // Login first
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
      
      // Verify we're logged in
      await expect(page).toHaveURL('/inbox');
      
      // Click user menu and logout
      await page.click('[data-testid="user-menu-button"]');
      await page.click('[data-testid="logout-button"]');
      
      // Should redirect to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Newsletter Inbox', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
    });

    test('should display newsletters in inbox', async ({ page }) => {
      // Wait for newsletters to load
      await waitForApiResponse(page, '**/api/newsletters**');

      // Should show newsletter list
      await expect(page.locator('[data-testid="newsletter-list"]')).toBeVisible();

      // Should show at least one newsletter
      const newsletterItems = page.locator('[data-testid="newsletter-item"]');
      await expect(newsletterItems.first()).toBeVisible();

      // Should show newsletter title
      await expect(newsletterItems.first().locator('[data-testid="newsletter-title"]')).toBeVisible();
    });

    test('should search newsletters', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('AI');
      await searchInput.press('Enter');

      // Wait for search results
      await waitForApiResponse(page, '**/api/newsletters**search=AI**');

      // Should show filtered results
      const newsletterItems = page.locator('[data-testid="newsletter-item"]');
      await expect(newsletterItems.first()).toBeVisible();

      // Results should contain AI-related content
      await expect(newsletterItems.first()).toContainText('AI');
    });

    test('should filter by read status', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      // Click unread filter
      await page.click('[data-testid="filter-unread"]');

      // Wait for filtered results
      await waitForApiResponse(page, '**/api/newsletters**isRead=false**');

      // Should show only unread newsletters
      const unreadBadges = page.locator('[data-testid="unread-badge"]');
      await expect(unreadBadges.first()).toBeVisible();
    });

    test('should filter by source', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      // Open source filter dropdown
      await page.click('[data-testid="source-filter-dropdown"]');

      // Select a source
      await page.click('[data-testid="source-option-ai-weekly"]');

      // Wait for filtered results
      await waitForApiResponse(page, '**/api/newsletters**sourceIds=**');

      // Should show only newsletters from selected source
      const newsletterItems = page.locator('[data-testid="newsletter-item"]');
      await expect(newsletterItems.first().locator('[data-testid="newsletter-source"]')).toContainText('AI Weekly');
    });

    test('should mark newsletter as read', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      const firstNewsletter = page.locator('[data-testid="newsletter-item"]').first();

      // Click mark as read button
      await firstNewsletter.locator('[data-testid="mark-read-button"]').click();

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Newsletter marked as read');

      // Newsletter should show as read
      await expect(firstNewsletter.locator('[data-testid="read-indicator"]')).toBeVisible();
    });

    test('should archive newsletter', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      const firstNewsletter = page.locator('[data-testid="newsletter-item"]').first();

      // Click archive button
      await firstNewsletter.locator('[data-testid="archive-button"]').click();

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Newsletter archived');

      // Newsletter should be removed from main list
      await expect(firstNewsletter).not.toBeVisible();
    });

    test('should bulk select and mark as read', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      // Select multiple newsletters
      await page.click('[data-testid="newsletter-item"]:nth-child(1) [data-testid="newsletter-checkbox"]');
      await page.click('[data-testid="newsletter-item"]:nth-child(2) [data-testid="newsletter-checkbox"]');

      // Should show bulk actions bar
      await expect(page.locator('[data-testid="bulk-actions-bar"]')).toBeVisible();

      // Click bulk mark as read
      await page.click('[data-testid="bulk-mark-read-button"]');

      // Wait for bulk update API call
      await waitForApiResponse(page, '**/api/newsletters/bulk-update**');

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('2 newsletters marked as read');
    });

    test('should delete newsletter with confirmation', async ({ page }) => {
      await waitForApiResponse(page, '**/api/newsletters**');

      const firstNewsletter = page.locator('[data-testid="newsletter-item"]').first();
      const newsletterTitle = await firstNewsletter.locator('[data-testid="newsletter-title"]').textContent();

      // Click delete button
      await firstNewsletter.locator('[data-testid="delete-button"]').click();

      // Should show confirmation modal
      await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-confirmation-text"]')).toContainText(newsletterTitle);

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Wait for delete API call
      await waitForApiResponse(page, '**/api/newsletters/**/delete**');

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Newsletter deleted');

      // Newsletter should be removed
      await expect(page.locator(`[data-testid="newsletter-title"]:has-text("${newsletterTitle}")`)).not.toBeVisible();
    });
  });

  test.describe('Newsletter Detail View', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to a newsletter detail
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
      await page.waitForURL('/inbox');

      // Click on first newsletter
      await waitForApiResponse(page, '**/api/newsletters**');
      await page.click('[data-testid="newsletter-item"]:first-child [data-testid="newsletter-title"]');

      // Wait for newsletter detail to load
      await waitForApiResponse(page, '**/api/newsletters/**');
    });

    test('should display newsletter content', async ({ page }) => {
      // Should show newsletter title
      await expect(page.locator('[data-testid="newsletter-detail-title"]')).toBeVisible();

      // Should show newsletter content
      await expect(page.locator('[data-testid="newsletter-content"]')).toBeVisible();

      // Should show newsletter source
      await expect(page.locator('[data-testid="newsletter-source"]')).toBeVisible();

      // Should show newsletter date
      await expect(page.locator('[data-testid="newsletter-date"]')).toBeVisible();
    });

    test('should automatically mark as read when viewed', async ({ page }) => {
      // Wait for automatic mark as read API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show read indicator
      await expect(page.locator('[data-testid="read-indicator"]')).toBeVisible();
    });

    test('should add and remove tags', async ({ page }) => {
      // Click add tag button
      await page.click('[data-testid="add-tag-button"]');

      // Should show tag selector
      await expect(page.locator('[data-testid="tag-selector"]')).toBeVisible();

      // Select a tag
      await page.click('[data-testid="tag-option-technology"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show tag on newsletter
      await expect(page.locator('[data-testid="newsletter-tag"]:has-text("Technology")')).toBeVisible();

      // Remove tag
      await page.click('[data-testid="newsletter-tag"]:has-text("Technology") [data-testid="remove-tag-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Tag should be removed
      await expect(page.locator('[data-testid="newsletter-tag"]:has-text("Technology")')).not.toBeVisible();
    });

    test('should favorite and unfavorite newsletter', async ({ page }) => {
      // Click favorite button
      await page.click('[data-testid="favorite-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show as favorited
      await expect(page.locator('[data-testid="favorite-button"]')).toHaveClass(/favorited/);

      // Click to unfavorite
      await page.click('[data-testid="favorite-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/newsletters/**/update**');

      // Should show as not favorited
      await expect(page.locator('[data-testid="favorite-button"]')).not.toHaveClass(/favorited/);
    });

    test('should share newsletter', async ({ page }) => {
      // Click share button
      await page.click('[data-testid="share-button"]');

      // Should show share modal
      await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();

      // Click copy link
      await page.click('[data-testid="copy-link-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Link copied to clipboard');
    });

    test('should navigate between newsletters', async ({ page }) => {
      // Should show navigation buttons
      await expect(page.locator('[data-testid="previous-newsletter-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="next-newsletter-button"]')).toBeVisible();

      // Click next newsletter
      await page.click('[data-testid="next-newsletter-button"]');

      // Wait for new newsletter to load
      await waitForApiResponse(page, '**/api/newsletters/**');

      // URL should change
      await expect(page.url()).toMatch(/\/newsletters\/[\w-]+/);

      // Content should change
      await expect(page.locator('[data-testid="newsletter-detail-title"]')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
    });

    test('should perform global search', async ({ page }) => {
      // Navigate to search page
      await page.click('[data-testid="search-button"]');
      await page.waitForURL('/search');

      // Enter search query
      await page.fill('[data-testid="search-input"]', 'artificial intelligence');
      await page.press('[data-testid="search-input"]', 'Enter');

      // Wait for search results
      await waitForApiResponse(page, '**/api/search**');

      // Should show search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-result-item"]').first()).toBeVisible();

      // Results should contain search term
      await expect(page.locator('[data-testid="search-result-item"]').first()).toContainText('artificial intelligence', { ignoreCase: true });
    });

    test('should filter search results', async ({ page }) => {
      await page.goto('/search?q=technology');
      await waitForApiResponse(page, '**/api/search**');

      // Apply read status filter
      await page.click('[data-testid="search-filter-read-status"]');
      await page.click('[data-testid="filter-option-unread"]');

      // Wait for filtered results
      await waitForApiResponse(page, '**/api/search**isRead=false**');

      // Should show only unread results
      const resultItems = page.locator('[data-testid="search-result-item"]');
      await expect(resultItems.first().locator('[data-testid="unread-badge"]')).toBeVisible();
    });

    test('should save and display recent searches', async ({ page }) => {
      await page.goto('/search');

      // Perform a search
      await page.fill('[data-testid="search-input"]', 'machine learning');
      await page.press('[data-testid="search-input"]', 'Enter');
      await waitForApiResponse(page, '**/api/search**');

      // Clear search and check recent searches
      await page.fill('[data-testid="search-input"]', '');
      await page.click('[data-testid="search-input"]');

      // Should show recent searches
      await expect(page.locator('[data-testid="recent-searches"]')).toBeVisible();
      await expect(page.locator('[data-testid="recent-search-item"]:has-text("machine learning")')).toBeVisible();

      // Click on recent search
      await page.click('[data-testid="recent-search-item"]:has-text("machine learning")');

      // Should perform the search again
      await expect(page.locator('[data-testid="search-input"]')).toHaveValue('machine learning');
    });
  });

  test.describe('Tags Management', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
      await page.goto('/tags');
    });

    test('should create new tag', async ({ page }) => {
      // Click create tag button
      await page.click('[data-testid="create-tag-button"]');

      // Should show create tag modal
      await expect(page.locator('[data-testid="create-tag-modal"]')).toBeVisible();

      // Fill in tag details
      await page.fill('[data-testid="tag-name-input"]', 'Test Tag');
      await page.click('[data-testid="tag-color-picker"] [data-color="#FF6B6B"]');

      // Save tag
      await page.click('[data-testid="save-tag-button"]');

      // Wait for create API call
      await waitForApiResponse(page, '**/api/tags**', { method: 'POST' });

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Tag created successfully');

      // Should show tag in list
      await expect(page.locator('[data-testid="tag-item"]:has-text("Test Tag")')).toBeVisible();
    });

    test('should edit existing tag', async ({ page }) => {
      await waitForApiResponse(page, '**/api/tags**');

      // Click edit button on first tag
      await page.click('[data-testid="tag-item"]:first-child [data-testid="edit-tag-button"]');

      // Should show edit modal
      await expect(page.locator('[data-testid="edit-tag-modal"]')).toBeVisible();

      // Update tag name
      await page.fill('[data-testid="tag-name-input"]', 'Updated Tag Name');

      // Save changes
      await page.click('[data-testid="save-tag-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/tags/**', { method: 'PATCH' });

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Tag updated successfully');

      // Should show updated name
      await expect(page.locator('[data-testid="tag-item"]:has-text("Updated Tag Name")')).toBeVisible();
    });

    test('should delete tag', async ({ page }) => {
      await waitForApiResponse(page, '**/api/tags**');

      const firstTag = page.locator('[data-testid="tag-item"]').first();
      const tagName = await firstTag.locator('[data-testid="tag-name"]').textContent();

      // Click delete button
      await firstTag.locator('[data-testid="delete-tag-button"]').click();

      // Should show confirmation modal
      await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Wait for delete API call
      await waitForApiResponse(page, '**/api/tags/**', { method: 'DELETE' });

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Tag deleted successfully');

      // Tag should be removed from list
      await expect(page.locator(`[data-testid="tag-item"]:has-text("${tagName}")`)).not.toBeVisible();
    });
  });

  test.describe('Settings and Profile', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);
    });

    test('should update user profile', async ({ page }) => {
      await page.goto('/profile');

      // Should show profile form
      await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();

      // Update full name
      await page.fill('[data-testid="full-name-input"]', 'Updated Test User');

      // Save changes
      await page.click('[data-testid="save-profile-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/profile**', { method: 'PATCH' });

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Profile updated successfully');
    });

    test('should update notification preferences', async ({ page }) => {
      await page.goto('/settings');

      // Navigate to notifications tab
      await page.click('[data-testid="notifications-tab"]');

      // Toggle email notifications
      await page.click('[data-testid="email-notifications-toggle"]');

      // Save settings
      await page.click('[data-testid="save-settings-button"]');

      // Wait for update API call
      await waitForApiResponse(page, '**/api/settings**', { method: 'PATCH' });

      // Should show success message
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('Settings updated successfully');
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Login
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should show mobile navigation
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

      // Should show hamburger menu
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

      // Newsletter list should be mobile-friendly
      await expect(page.locator('[data-testid="mobile-newsletter-list"]')).toBeVisible();
    });

    test('should work on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Login
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should show tablet layout
      await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

      // Should show newsletter grid
      await expect(page.locator('[data-testid="newsletter-grid"]')).toBeVisible();
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load inbox quickly', async ({ page }) => {
      const startTime = Date.now();

      // Login and navigate to inbox
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Wait for inbox to load
      await expect(page.locator('[data-testid="newsletter-list"]')).toBeVisible();

      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large newsletter lists', async ({ page }) => {
      // Login
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should implement virtual scrolling for large lists
      await expect(page.locator('[data-testid="virtual-list"]')).toBeVisible();

      // Should load more content when scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Should trigger infinite scroll
      await waitForApiResponse(page, '**/api/newsletters**offset=**');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Block network requests to simulate offline
      await page.route('**/api/**', route => route.abort());

      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle API errors', async ({ page }) => {
      // Mock API to return 500 error
      await page.route('**/api/newsletters', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      // Login
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should show error message
      await expect(page.locator('[data-testid="api-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load newsletters');
    });

    test('should handle empty states', async ({ page }) => {
      // Mock API to return empty results
      await page.route('**/api/newsletters', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [], count: 0, hasMore: false }),
        });
      });

      // Login
      await login(page, TEST_USERS.REGULAR_USER.email, TEST_USERS.REGULAR_USER.password);

      // Should show empty state
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-state-message"]')).toContainText('No newsletters found');
    });
  });
});
