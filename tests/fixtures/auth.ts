import { supabase } from '@/common/api/supabaseClient';

export interface TestUser {
  userId: string;
  email: string;
  password: string;
}

/**
 * Creates a test user for E2E tests
 * @returns Object containing the test user's ID and credentials
 */
export async function setupTestUser(): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `test-${timestamp}@example.com`;
  const password = 'testpassword123';

  try {
    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          test_user: true,
          created_at: timestamp,
        },
      },
    });

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('No user returned from signup');
    }

    // Wait a bit for the user to be fully created
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      userId: authData.user.id,
      email,
      password,
    };
  } catch (error) {
    console.error('Error setting up test user:', error);
    throw error;
  }
}

/**
 * Cleans up a test user after E2E tests
 * @param userId - The ID of the test user to clean up
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // First, delete all user data (newsletters, sources, tags, etc.)
    await cleanupUserData(userId);

    // Then delete the user account
    // Note: This requires admin privileges or a service role key
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`Failed to delete test user ${userId}:`, error);
      // Don't throw here as this is cleanup - log and continue
    }
  } catch (error) {
    console.error('Error cleaning up test user:', error);
    // Don't throw in cleanup functions
  }
}

/**
 * Cleans up all data associated with a test user
 * @param userId - The ID of the user whose data should be cleaned up
 */
async function cleanupUserData(userId: string): Promise<void> {
  try {
    // Delete in order of dependencies
    // 1. Delete reading queue items
    await supabase.from('reading_queue').delete().eq('user_id', userId);

    // 2. Delete newsletter tags
    await supabase.from('newsletter_tags').delete().eq('user_id', userId);

    // 3. Delete newsletters
    await supabase.from('newsletters').delete().eq('user_id', userId);

    // 4. Delete newsletter sources
    await supabase.from('newsletter_sources').delete().eq('user_id', userId);

    // 5. Delete tags
    await supabase.from('tags').delete().eq('user_id', userId);

    // 6. Delete any other user-specific data
    await supabase.from('user_preferences').delete().eq('user_id', userId);
  } catch (error) {
    console.error('Error cleaning up user data:', error);
  }
}

/**
 * Signs in a test user
 * @param email - The test user's email
 * @param password - The test user's password
 * @returns The authenticated session
 */
export async function signInTestUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return data;
}

/**
 * Signs out the current test user
 */
export async function signOutTestUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Failed to sign out test user: ${error.message}`);
  }
}

/**
 * Gets the current test user session
 */
export async function getTestUserSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to get test user session: ${error.message}`);
  }

  return session;
}

/**
 * Creates multiple test users for bulk operations
 * @param count - Number of test users to create
 * @returns Array of test users
 */
export async function setupMultipleTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];

  for (let i = 0; i < count; i++) {
    const user = await setupTestUser();
    users.push(user);
    // Add a small delay between user creations to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return users;
}

/**
 * Cleans up multiple test users
 * @param userIds - Array of user IDs to clean up
 */
export async function cleanupMultipleTestUsers(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await cleanupTestUser(userId);
    // Add a small delay between cleanups
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Waits for a user to be fully created and ready
 * @param userId - The user ID to check
 * @param maxAttempts - Maximum number of attempts
 * @returns True if user is ready, false otherwise
 */
export async function waitForUserReady(
  userId: string,
  maxAttempts: number = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (data && !error) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}
