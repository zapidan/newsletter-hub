import { type FullConfig } from '@playwright/test';
import { cleanupTestDatabase, deleteAllTestUsers } from './test-fixtures.js';
import { promises as fs, existsSync, unlinkSync } from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');

  try {
    // Clean up test users
    console.log('🧹 Cleaning up test users...');
    await deleteAllTestUsers();
    console.log('✅ Test users cleaned up');

    // Clean up test database
    await cleanupTestDatabase();
    console.log('✅ Test database cleaned up');

    // Clean up authentication states
    await cleanupAuthStates();
    console.log('✅ Authentication states cleaned up');

    // Clean up test uploads and temporary files
    await cleanupTestUploads();
    console.log('✅ Test uploads cleaned up');

    // Clean up mock data
    await cleanupMockData();
    console.log('✅ Mock data cleaned up');

    // Clean up test cache
    await cleanupTestCache();
    console.log('✅ Test cache cleared');

    // Clean up in-memory test data
    await cleanupTestData();
    console.log('✅ In-memory test data cleaned up');

    console.log('🎉 Global E2E test teardown completed successfully!');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    throw error;
  }
}

async function cleanupAuthStates() {
  try {
    const authDir = path.join(process.cwd(), 'playwright/.auth');
    await fs.rm(authDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up auth states:', error);
    throw error;
  }
}

async function cleanupTestUploads() {
  try {
    const uploadsDir = path.join(process.cwd(), 'test-uploads');
    await fs.rm(uploadsDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up test uploads:', error);
    throw error;
  }
}

async function cleanupMockData() {
  try {
    // Add any mock data cleanup logic here
    await removeTestNewsletters();
    await removeTestUsers();
    await removeTestTags();
    await removeTestSourceGroups();
  } catch (error) {
    console.error('Error cleaning up mock data:', error);
    throw error;
  }
}

async function removeTestNewsletters() {
  // Implementation depends on your test database
  console.log('Removing test newsletters...');
  // Add your newsletter cleanup logic here
}

async function removeTestUsers() {
  // Implementation depends on your test database
  console.log('Removing test users...');
  // Add your user cleanup logic here
}

async function removeTestTags() {
  // Implementation depends on your test database
  console.log('Removing test tags...');
  // Add your tag cleanup logic here
}

async function removeTestSourceGroups() {
  // Implementation depends on your test database
  console.log('Removing test source groups...');
  // Add your source group cleanup logic here
}

async function cleanupTestCache() {
  try {
    const cacheDirs = [
      path.join(process.cwd(), '.cache'),
      path.join(process.cwd(), 'node_modules/.cache'),
    ];

    for (const dir of cacheDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors for non-existent directories
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up test cache:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    // Remove test users file if it exists
    const testUsersPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'test-users.json');
    if (existsSync(testUsersPath)) {
      try {
        await fs.unlink(testUsersPath);
        console.log('Removed test users file');
      } catch (error) {
        console.warn('Failed to remove test users file:', error);
      }
    }
    
    // Any additional cleanup can go here
    console.log('Test data cleanup complete');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    throw error;
  }
}

export default globalTeardown;
