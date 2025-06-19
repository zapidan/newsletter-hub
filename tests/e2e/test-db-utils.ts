import { createMockSupabaseClient } from './test-utils/mock-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TestUser } from './test-fixtures';

// Create a mock Supabase client
const supabase = createMockSupabaseClient();

export async function createTestUserInSupabase(user: Omit<TestUser, 'id'>): Promise<TestUser> {
  const { email, password, fullName, role = 'user' } = user;
  
  try {
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('No user data returned after sign up');
    }

    // Get the created user from auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      throw new Error(`Failed to get created user: ${userError.message}`);
    }
    
    if (!userData.user) {
      throw new Error('No user data available');
    }

    // Return the created user with the expected TestUser shape
    return {
      id: userData.user.id,
      email: email,
      password: password,
      fullName: fullName,
      role: role as 'user' | 'admin',
    };
  } catch (error) {
    console.error('Error in createTestUserInSupabase:', error);
    throw error;
  }
}

export async function deleteTestUser(userId: string): Promise<void> {
  // In a real implementation, you would delete the user here
  // For the mock implementation, we don't need to do anything
  // as the in-memory storage will be cleared between tests
  console.log(`Mock: Deleting test user ${userId}`);
}

export async function deleteAllTestUsers(): Promise<void> {
  // In a real implementation, you would delete all test users here
  // For the mock implementation, we don't need to do anything
  // as the in-memory storage will be cleared between tests
  console.log('Mock: Deleting all test users');
}

// Export the mock Supabase client for use in tests
export { supabase };
