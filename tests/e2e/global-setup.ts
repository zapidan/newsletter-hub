import { type FullConfig } from '@playwright/test';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define test user data
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  fullName: 'Test User',
  id: 'test-user-123',
};

// Path to store auth state
const STORAGE_STATE = path.join(__dirname, 'storage-state.json');

/**
 * Simplified global setup function
 */
async function globalSetup(config: FullConfig) {
  try {
    // Create a minimal storage state for tests
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5174',
          localStorage: [
            {
              name: 'sb-mock-auth-token',
              value: JSON.stringify({
                access_token: 'mock-access-token-123',
                refresh_token: 'mock-refresh-token-123',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                token_type: 'bearer',
                user: {
                  id: TEST_USER.id,
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

    // Store test user data for tests to use
    const testUserData = {
      email: TEST_USER.email,
      password: TEST_USER.password,
      fullName: TEST_USER.fullName,
      id: TEST_USER.id,
    };

    writeFileSync(path.join(__dirname, 'test-user.json'), JSON.stringify(testUserData, null, 2));
  } catch (error) {
    console.error('Error during global setup:', error);
    throw error;
  }
}

export default globalSetup;
