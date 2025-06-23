import { Page } from '@playwright/test';
import type { NewsletterWithRelations, ReadingQueueItem } from '@/common/types';

export interface TestNewsletterData {
  userId: string;
  title: string;
  content: string;
  url?: string;
  is_archived?: boolean;
  is_read?: boolean;
  is_liked?: boolean;
  newsletter_source_id?: string;
  tags?: string[];
}

/**
 * Creates a test newsletter for E2E tests
 * In mock mode, returns predefined test data
 * @param data - Newsletter data including userId and other properties
 * @returns The created newsletter
 */
export async function createTestNewsletter(
  data: TestNewsletterData
): Promise<NewsletterWithRelations> {
  const timestamp = Date.now();
  const newsletterId = `newsletter-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const newsletter: NewsletterWithRelations = {
    id: newsletterId,
    user_id: data.userId,
    title: data.title,
    content: data.content,
    url: data.url || `https://example.com/newsletter-${timestamp}`,
    is_archived: data.is_archived || false,
    is_read: data.is_read || false,
    is_liked: data.is_liked || false,
    newsletter_source_id: data.newsletter_source_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: data.tags?.map((tagName, index) => ({
      id: `tag-${timestamp}-${index}`,
      name: tagName,
      color: '#3B82F6',
      user_id: data.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) || [],
    newsletter_source: data.newsletter_source_id
      ? {
          id: data.newsletter_source_id,
          name: 'Test Source',
          email: 'source@example.com',
          is_active: true,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: data.userId,
        }
      : null,
  };

  // In mock mode, we just return the data
  console.log(`Mock: Created newsletter ${newsletterId}`);
  return newsletter;
}

/**
 * Creates multiple test newsletters for bulk operations
 * @param userId - The user ID who owns the newsletters
 * @param count - Number of newsletters to create
 * @param baseData - Base data for all newsletters (optional)
 * @returns Array of created newsletters
 */
export async function createMultipleTestNewsletters(
  userId: string,
  count: number,
  baseData?: Partial<TestNewsletterData>
): Promise<NewsletterWithRelations[]> {
  const newsletters: NewsletterWithRelations[] = [];
  const baseTimestamp = Date.now();

  for (let i = 0; i < count; i++) {
    const newsletter = await createTestNewsletter({
      userId,
      title: `Test Newsletter ${i + 1}`,
      content: `This is test content for newsletter ${i + 1}`,
      ...baseData,
    });
    newsletters.push(newsletter);
  }

  return newsletters;
}

/**
 * Cleans up test newsletters for a user
 * In mock mode, this is a no-op
 * @param userId - The ID of the user whose newsletters should be cleaned up
 */
export async function cleanupTestNewsletters(userId: string): Promise<void> {
  // No-op in mock mode
  console.log(`Mock: Cleanup newsletters for user ${userId}`);
}

/**
 * Cleans up specific test newsletters
 * In mock mode, this is a no-op
 * @param newsletterIds - Array of newsletter IDs to clean up
 */
export async function cleanupSpecificNewsletters(newsletterIds: string[]): Promise<void> {
  // No-op in mock mode
  console.log(`Mock: Cleanup newsletters ${newsletterIds.join(', ')}`);
}

/**
 * Creates a test newsletter source
 * @param userId - The user ID who owns the source
 * @param data - Additional source data
 * @returns The created newsletter source
 */
export async function createTestNewsletterSource(
  userId: string,
  data?: {
    name?: string;
    email?: string;
    is_active?: boolean;
    is_archived?: boolean;
  }
) {
  const timestamp = Date.now();
  const sourceId = `source-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const source = {
    id: sourceId,
    user_id: userId,
    name: data?.name || `Test Source ${timestamp}`,
    email: data?.email || `source-${timestamp}@example.com`,
    is_active: data?.is_active !== undefined ? data.is_active : true,
    is_archived: data?.is_archived || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log(`Mock: Created newsletter source ${sourceId}`);
  return source;
}

/**
 * Creates a test tag
 * @param userId - The user ID who owns the tag
 * @param name - Tag name
 * @param color - Tag color (optional)
 * @returns The created tag
 */
export async function createTestTag(userId: string, name: string, color?: string) {
  const timestamp = Date.now();
  const tagId = `tag-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const tag = {
    id: tagId,
    user_id: userId,
    name,
    color: color || '#3B82F6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log(`Mock: Created tag ${tagId}`);
  return tag;
}

/**
 * Adds a newsletter to the reading queue
 * @param newsletterId - The newsletter ID
 * @param userId - The user ID
 * @returns The created queue item
 */
export async function addTestNewsletterToQueue(
  newsletterId: string,
  userId: string
): Promise<ReadingQueueItem> {
  const timestamp = Date.now();
  const queueItemId = `queue-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const queueItem: ReadingQueueItem = {
    id: queueItemId,
    newsletter_id: newsletterId,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log(`Mock: Added newsletter ${newsletterId} to queue`);
  return queueItem;
}

/**
 * Updates a test newsletter
 * @param newsletterId - The newsletter ID to update
 * @param updates - The updates to apply
 * @returns The updated newsletter
 */
export async function updateTestNewsletter(
  newsletterId: string,
  updates: Partial<NewsletterWithRelations>
): Promise<NewsletterWithRelations> {
  // In mock mode, we just merge the updates
  const updatedNewsletter: NewsletterWithRelations = {
    id: newsletterId,
    user_id: 'user-1',
    title: 'Updated Newsletter',
    content: 'Updated content',
    url: 'https://example.com/updated',
    is_archived: false,
    is_read: false,
    is_liked: false,
    newsletter_source_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    newsletter_source: null,
    ...updates,
  };

  console.log(`Mock: Updated newsletter ${newsletterId}`);
  return updatedNewsletter;
}

/**
 * Creates test data for newsletter operations testing
 * @param userId - The user ID
 * @returns Object containing created test data
 */
export async function setupNewsletterTestData(userId: string) {
  // Create a source
  const source = await createTestNewsletterSource(userId);

  // Create tags
  const importantTag = await createTestTag(userId, 'Important', '#EF4444');
  const workTag = await createTestTag(userId, 'Work', '#3B82F6');

  // Create newsletters
  const unreadNewsletter = await createTestNewsletter({
    userId,
    title: 'Unread Newsletter',
    content: 'This is an unread newsletter',
    is_read: false,
    newsletter_source_id: source.id,
    tags: ['Important'],
  });

  const readNewsletter = await createTestNewsletter({
    userId,
    title: 'Read Newsletter',
    content: 'This is a read newsletter',
    is_read: true,
    newsletter_source_id: source.id,
    tags: ['Work'],
  });

  const archivedNewsletter = await createTestNewsletter({
    userId,
    title: 'Archived Newsletter',
    content: 'This is an archived newsletter',
    is_archived: true,
    newsletter_source_id: source.id,
  });

  const likedNewsletter = await createTestNewsletter({
    userId,
    title: 'Liked Newsletter',
    content: 'This is a liked newsletter',
    is_liked: true,
    newsletter_source_id: source.id,
  });

  // Add one to reading queue
  const queueItem = await addTestNewsletterToQueue(unreadNewsletter.id, userId);

  return {
    source,
    tags: { important: importantTag, work: workTag },
    newsletters: {
      unread: unreadNewsletter,
      read: readNewsletter,
      archived: archivedNewsletter,
      liked: likedNewsletter,
    },
    queueItem,
  };
}

/**
 * Waits for a newsletter to appear in the UI
 * @param page - The Playwright page object
 * @param newsletterId - The newsletter ID to wait for
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForNewsletter(
  page: Page,
  newsletterId: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(`[data-testid="newsletter-${newsletterId}"]`, {
    state: 'visible',
    timeout,
  });
}

/**
 * Clicks on a newsletter in the list view
 * @param page - The Playwright page object
 * @param newsletterId - The newsletter ID to click
 */
export async function clickNewsletter(page: Page, newsletterId: string): Promise<void> {
  await page.click(`[data-testid="newsletter-${newsletterId}"]`);
  await page.waitForURL(`**/newsletters/${newsletterId}`, { timeout: 5000 });
}

/**
 * Toggles a newsletter in the reading queue from the list view
 * @param page - The Playwright page object
 * @param newsletterId - The newsletter ID
 */
export async function toggleQueueFromList(page: Page, newsletterId: string): Promise<void> {
  const queueButton = page.locator(
    `[data-testid="newsletter-row-${newsletterId}"] [data-testid="queue-toggle-button"]`
  );
  await queueButton.click();
}

/**
 * Archives a newsletter from the detail view
 * @param page - The Playwright page object
 */
export async function archiveFromDetail(page: Page): Promise<void> {
  await page.click('button:has-text("Archive")');
}

/**
 * Marks a newsletter as read from the detail view
 * @param page - The Playwright page object
 */
export async function markAsReadFromDetail(page: Page): Promise<void> {
  await page.click('button:has-text("Mark as read")');
}
