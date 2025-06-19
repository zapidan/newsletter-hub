import { createMockSupabaseClient, MockAuthClient } from '../e2e/test-utils/mock-supabase';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Test utility to set up and manage a mock Supabase client for testing
 */
class MockSupabase {
  private client: SupabaseClient;
  private auth: MockAuthClient;
  
  constructor() {
    this.client = createMockSupabaseClient();
    // Access the internal auth client for test setup
    this.auth = (this.client as any).auth as MockAuthClient;
  }

  /**
   * Get the mock Supabase client instance
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Create a test user and sign them in
   */
  async createAndSignInUser(email: string, password: string, userData: Record<string, any> = {}) {
    // Create a test user
    const user = {
      email,
      password,
      user_metadata: {
        full_name: userData.fullName || 'Test User',
        ...userData.user_metadata,
      },
      app_metadata: {
        provider: 'email',
        ...(userData.role && { role: userData.role }),
        ...userData.app_metadata,
      },
    };

    // Sign up the user
    const { data, error } = await this.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: user.user_metadata,
      },
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    return data.user;
  }

  /**
   * Sign in a test user
   */
  async signIn(email: string, password: string) {
    return this.auth.signInWithPassword({ email, password });
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    return this.auth.signOut();
  }

  /**
   * Get the current session
   */
  async getSession() {
    return this.auth.getSession();
  }

  /**
   * Get the current user
   */
  async getUser() {
    const { data: { session } } = await this.getSession();
    if (!session) return null;
    
    return this.auth.getUser(session.access_token);
  }

  /**
   * Clear all test data
   */
  clear() {
    // Reset the auth state
    this.auth.signOut();
  }
}

// Export a singleton instance
export const mockSupabase = new MockSupabase();

export default mockSupabase;
