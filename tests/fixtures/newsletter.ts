import { supabase } from '@/common/api/supabaseClient';
import type { Newsletter, NewsletterWithRelations } from '@/common/types';

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
 * @param data - Newsletter data including userId and other properties
 * @returns The created newsletter
 */
export async function createTestNewsletter(
  data: TestNewsletterData
): Promise<NewsletterWithRelations> {
  const timestamp = Date.now();
  const newsletterData = {
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
  };

  try {
    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .insert(newsletterData)
      .select('*, newsletter_source(*), tags(*)')
      .single();

    if (error) {
      throw new Error(`Failed to create test newsletter: ${error.message}`);
    }

    if (!newsletter) {
      throw new Error('No newsletter returned from insert');
    }

    // Add tags if provided
    if (data.tags && data.tags.length > 0) {
      await addTagsToNewsletter(newsletter.id, data.tags, data.userId);
    }

    return newsletter as NewsletterWithRelations;
  } catch (error) {
    console.error('Error creating test newsletter:', error);
    throw error;
  }
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

  for (let i = 0; i < count; i++) {
    const newsletter = await createTestNewsletter({
      userId,
      title: `Test Newsletter ${i + 1}`,
      content: `This is test content for newsletter ${i + 1}`,
      ...baseData,
    });
    newsletters.push(newsletter);
    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return newsletters;
}

/**
 * Cleans up test newsletters for a user
 * @param userId - The ID of the user whose newsletters should be cleaned up
 */
export async function cleanupTestNewsletters(userId: string): Promise<void> {
  try {
    // First delete newsletter tags
    await supabase.from('newsletter_tags').delete().eq('user_id', userId);

    // Then delete reading queue items
    const { data: queueItems } = await supabase
      .from('reading_queue')
      .select('id, newsletter_id')
      .eq('user_id', userId);

    if (queueItems && queueItems.length > 0) {
      await supabase
        .from('reading_queue')
        .delete()
        .in(
          'id',
          queueItems.map((item) => item.id)
        );
    }

    // Finally delete newsletters
    const { error } = await supabase.from('newsletters').delete().eq('user_id', userId);

    if (error) {
      console.error(`Failed to delete test newsletters for user ${userId}:`, error);
    }
  } catch (error) {
    console.error('Error cleaning up test newsletters:', error);
  }
}

/**
 * Cleans up specific test newsletters
 * @param newsletterIds - Array of newsletter IDs to clean up
 */
export async function cleanupSpecificNewsletters(newsletterIds: string[]): Promise<void> {
  try {
    // Delete newsletter tags
    await supabase.from('newsletter_tags').delete().in('newsletter_id', newsletterIds);

    // Delete reading queue items
    await supabase.from('reading_queue').delete().in('newsletter_id', newsletterIds);

    // Delete newsletters
    await supabase.from('newsletters').delete().in('id', newsletterIds);
  } catch (error) {
    console.error('Error cleaning up specific newsletters:', error);
  }
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
  const sourceData = {
    user_id: userId,
    name: data?.name || `Test Source ${timestamp}`,
    email: data?.email || `source-${timestamp}@example.com`,
    is_active: data?.is_active !== undefined ? data.is_active : true,
    is_archived: data?.is_archived || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: source, error } = await supabase
    .from('newsletter_sources')
    .insert(sourceData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test newsletter source: ${error.message}`);
  }

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
  const tagData = {
    user_id: userId,
    name,
    color: color || '#3B82F6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: tag, error } = await supabase.from('tags').insert(tagData).select().single();

  if (error) {
    throw new Error(`Failed to create test tag: ${error.message}`);
  }

  return tag;
}

/**
 * Adds tags to a newsletter
 * @param newsletterId - The newsletter ID
 * @param tagNames - Array of tag names
 * @param userId - The user ID
 */
async function addTagsToNewsletter(
  newsletterId: string,
  tagNames: string[],
  userId: string
): Promise<void> {
  // First, ensure tags exist
  const tags = [];
  for (const tagName of tagNames) {
    const { data: existingTag } = await supabase
      .from('tags')
      .select()
      .eq('user_id', userId)
      .eq('name', tagName)
      .single();

    if (existingTag) {
      tags.push(existingTag);
    } else {
      const newTag = await createTestTag(userId, tagName);
      tags.push(newTag);
    }
  }

  // Then create newsletter_tags associations
  const newsletterTags = tags.map((tag) => ({
    newsletter_id: newsletterId,
    tag_id: tag.id,
    user_id: userId,
  }));

  const { error } = await supabase.from('newsletter_tags').insert(newsletterTags);

  if (error) {
    console.error('Error adding tags to newsletter:', error);
  }
}

/**
 * Adds a newsletter to the reading queue
 * @param newsletterId - The newsletter ID
 * @param userId - The user ID
 * @returns The created queue item
 */
export async function addTestNewsletterToQueue(newsletterId: string, userId: string) {
  const queueData = {
    newsletter_id: newsletterId,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: queueItem, error } = await supabase
    .from('reading_queue')
    .insert(queueData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add newsletter to queue: ${error.message}`);
  }

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
  updates: Partial<Newsletter>
): Promise<NewsletterWithRelations> {
  const { data: newsletter, error } = await supabase
    .from('newsletters')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', newsletterId)
    .select('*, newsletter_source(*), tags(*)')
    .single();

  if (error) {
    throw new Error(`Failed to update test newsletter: ${error.message}`);
  }

  return newsletter as NewsletterWithRelations;
}

/**
 * Waits for a newsletter to be in a specific state
 * @param newsletterId - The newsletter ID
 * @param checkFn - Function to check if newsletter is in desired state
 * @param maxAttempts - Maximum number of attempts
 * @returns The newsletter if found in desired state, null otherwise
 */
export async function waitForNewsletterState(
  newsletterId: string,
  checkFn: (newsletter: NewsletterWithRelations) => boolean,
  maxAttempts: number = 10
): Promise<NewsletterWithRelations | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .select('*, newsletter_source(*), tags(*)')
      .eq('id', newsletterId)
      .single();

    if (!error && newsletter && checkFn(newsletter as NewsletterWithRelations)) {
      return newsletter as NewsletterWithRelations;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
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
