import { Page, Locator } from '@playwright/test';

/**
 * Waits for a toast message to appear with specific text
 * @param page - The Playwright page object
 * @param text - The text to look for in the toast (can be string or RegExp)
 * @param options - Additional options for waiting
 * @returns The toast locator
 */
export async function waitForToast(
  page: Page,
  text: string | RegExp,
  options?: {
    timeout?: number;
    type?: 'success' | 'error' | 'info' | 'warning';
  }
): Promise<Locator> {
  const timeout = options?.timeout ?? 5000;

  // Build selector based on toast type if provided
  let selector = '[role="status"], [role="alert"], .toast, [data-testid*="toast"]';
  if (options?.type) {
    selector = `${selector}[data-type="${options.type}"], ${selector}.toast-${options.type}`;
  }

  // Wait for toast with specific text
  const toast = page.locator(selector).filter({ hasText: text });

  await toast.waitFor({
    state: 'visible',
    timeout
  });

  return toast;
}

/**
 * Waits for a success toast with specific text
 * @param page - The Playwright page object
 * @param text - The text to look for in the toast
 * @param timeout - Optional timeout in milliseconds
 * @returns The toast locator
 */
export async function waitForSuccessToast(
  page: Page,
  text: string | RegExp,
  timeout?: number
): Promise<Locator> {
  return waitForToast(page, text, { type: 'success', timeout });
}

/**
 * Waits for an error toast with specific text
 * @param page - The Playwright page object
 * @param text - The text to look for in the toast
 * @param timeout - Optional timeout in milliseconds
 * @returns The toast locator
 */
export async function waitForErrorToast(
  page: Page,
  text: string | RegExp,
  timeout?: number
): Promise<Locator> {
  return waitForToast(page, text, { type: 'error', timeout });
}

/**
 * Dismisses a toast by clicking its close button
 * @param page - The Playwright page object
 * @param toast - The toast locator to dismiss
 */
export async function dismissToast(page: Page, toast: Locator): Promise<void> {
  // Try different close button selectors
  const closeButton = toast.locator(
    'button[aria-label="Close"], button.close, [data-testid="toast-close"]'
  ).first();

  if (await closeButton.isVisible()) {
    await closeButton.click();
    await toast.waitFor({ state: 'hidden' });
  }
}

/**
 * Dismisses all visible toasts
 * @param page - The Playwright page object
 */
export async function dismissAllToasts(page: Page): Promise<void> {
  const toasts = page.locator('[role="status"], [role="alert"], .toast');
  const count = await toasts.count();

  for (let i = 0; i < count; i++) {
    const toast = toasts.nth(i);
    if (await toast.isVisible()) {
      await dismissToast(page, toast);
    }
  }
}

/**
 * Waits for a toast and then dismisses it
 * @param page - The Playwright page object
 * @param text - The text to look for in the toast
 * @param options - Additional options
 */
export async function waitForAndDismissToast(
  page: Page,
  text: string | RegExp,
  options?: {
    timeout?: number;
    type?: 'success' | 'error' | 'info' | 'warning';
  }
): Promise<void> {
  const toast = await waitForToast(page, text, options);
  await dismissToast(page, toast);
}

/**
 * Verifies that no toast is visible
 * @param page - The Playwright page object
 * @param timeout - How long to wait to ensure no toast appears
 */
export async function expectNoToast(
  page: Page,
  timeout: number = 2000
): Promise<void> {
  const toasts = page.locator('[role="status"], [role="alert"], .toast');

  // Wait a bit to ensure no toast appears
  await page.waitForTimeout(timeout);

  // Check that no toasts are visible
  await expect(toasts).toHaveCount(0);
}

/**
 * Gets all visible toast messages
 * @param page - The Playwright page object
 * @returns Array of toast message texts
 */
export async function getAllToastMessages(page: Page): Promise<string[]> {
  const toasts = page.locator('[role="status"], [role="alert"], .toast');
  const count = await toasts.count();
  const messages: string[] = [];

  for (let i = 0; i < count; i++) {
    const toast = toasts.nth(i);
    if (await toast.isVisible()) {
      const text = await toast.textContent();
      if (text) {
        messages.push(text.trim());
      }
    }
  }

  return messages;
}

/**
 * Waits for multiple toasts to appear in sequence
 * @param page - The Playwright page object
 * @param texts - Array of texts to wait for in order
 * @param options - Additional options
 */
export async function waitForToastsInSequence(
  page: Page,
  texts: (string | RegExp)[],
  options?: {
    timeout?: number;
    dismissEach?: boolean;
  }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;

  for (const text of texts) {
    const toast = await waitForToast(page, text, { timeout });

    if (options?.dismissEach) {
      await dismissToast(page, toast);
    }
  }
}

/**
 * Clicks an action button within a toast
 * @param page - The Playwright page object
 * @param toastText - Text to identify the toast
 * @param buttonText - Text of the button to click within the toast
 */
export async function clickToastAction(
  page: Page,
  toastText: string | RegExp,
  buttonText: string | RegExp
): Promise<void> {
  const toast = await waitForToast(page, toastText);
  const button = toast.locator('button', { hasText: buttonText });
  await button.click();
}

/**
 * Helper to check if a toast contains a link and optionally click it
 * @param page - The Playwright page object
 * @param toastText - Text to identify the toast
 * @param linkText - Text of the link within the toast
 * @param click - Whether to click the link
 */
export async function handleToastLink(
  page: Page,
  toastText: string | RegExp,
  linkText: string | RegExp,
  click: boolean = false
): Promise<Locator> {
  const toast = await waitForToast(page, toastText);
  const link = toast.locator('a', { hasText: linkText });

  await expect(link).toBeVisible();

  if (click) {
    await link.click();
  }

  return link;
}

// Re-export expect for convenience
export { expect } from '@playwright/test';
