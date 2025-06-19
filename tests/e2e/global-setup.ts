import { chromium, type FullConfig } from '@playwright/test';
import { mockSupabase } from '../test-utils/mockSupabase';
import { writeFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.test file
const envPath = join(process.cwd(), '.env.test');
dotenv.config({ path: envPath });

// Define test user data
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  fullName: 'Test User',
};

// Path to store auth state
const STORAGE_STATE = path.join(__dirname, 'storage-state.json');

/**
 * Global setup function that runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');
  
  try {
    // Create a test user using our mock Supabase client
    console.log('Creating test user...');
    await mockSupabase.createAndSignInUser(
      TEST_USER.email,
      TEST_USER.password,
      {
        fullName: TEST_USER.fullName,
        user_metadata: {
          full_name: TEST_USER.fullName,
        },
      }
    );

    // Get the current session
    const { data: sessionData } = await mockSupabase.getSession();
    const session = sessionData?.session;

    if (!session) {
      throw new Error('Failed to create test user session');
    }

    console.log('Test user created and signed in successfully');

    // Store the auth state for tests to use
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5174',
          localStorage: [
            {
              name: 'sb-mock-anon-key-auth-token',
              value: JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
                token_type: 'bearer',
                user: {
                  id: session.user.id,
                  email: TEST_USER.email,
                  user_metadata: {
                    full_name: TEST_USER.fullName,
                  },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              }),
            },
          ],
        },
      ],
    };

    // Write the storage state to a file
    writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));
    console.log(`Auth state saved to ${STORAGE_STATE}`);
    
    // Store test user data for tests to use
    const testUserData = {
      email: TEST_USER.email,
      password: TEST_USER.password,
      fullName: TEST_USER.fullName,
      id: session.user.id,
    };
    
    writeFileSync(
      path.join(__dirname, 'test-user.json'),
      JSON.stringify(testUserData, null, 2)
    );
    
    console.log('Global setup completed successfully');
  } catch (error) {
    console.error('Error during global setup:', error);
    throw error;
  }
}

export default globalSetup;
