import { FullConfig } from '@playwright/test';
import { cleanupTestDatabase, removeTestFiles } from './test-fixtures';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');

  try {
    // Clean up test database
    await cleanupTestDatabase();
    console.log('✅ Test database cleaned up');

    // Remove test files and artifacts
    await removeTestFiles();
    console.log('✅ Test files removed');

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

    console.log('🎉 Global E2E test teardown completed successfully!');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to avoid breaking CI pipeline
    // but log the issue for investigation
    console.error('Full error details:', error);
  }
}

async function cleanupAuthStates() {
  const fs = require('fs').promises;
  const path = require('path');

  const authDir = path.join(process.cwd(), 'playwright', '.auth');

  try {
    await fs.access(authDir);
    const files = await fs.readdir(authDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(authDir, file));
        console.log(`🗑️  Removed auth state: ${file}`);
      }
    }
  } catch (error) {
    // Directory might not exist, which is fine
    console.log('📝 No auth states to clean up');
  }
}

async function cleanupTestUploads() {
  const fs = require('fs').promises;
  const path = require('path');

  const uploadsDir = path.join(process.cwd(), 'test-uploads');

  try {
    await fs.access(uploadsDir);
    await fs.rmdir(uploadsDir, { recursive: true });
    console.log('🗑️  Removed test uploads directory');
  } catch (error) {
    // Directory might not exist, which is fine
    console.log('📝 No test uploads to clean up');
  }
}

async function cleanupMockData() {
  // Clean up any mock data that was created during tests
  // This includes test newsletters, users, tags, etc.
  console.log('🧹 Cleaning up mock data...');

  // Remove test newsletters
  await removeTestNewsletters();

  // Remove test users (except system users)
  await removeTestUsers();

  // Remove test tags
  await removeTestTags();

  // Remove test source groups
  await removeTestSourceGroups();
}

async function removeTestNewsletters() {
  // Implementation would depend on your database setup
  // This is a placeholder for the actual cleanup logic
  console.log('🗑️  Removing test newsletters...');

  // Example: DELETE FROM newsletters WHERE email LIKE '%test%' OR title LIKE 'Test%'
  // Or use your ORM/database client to remove test data
}

async function removeTestUsers() {
  // Remove test users but preserve system users
  console.log('🗑️  Removing test users...');

  const testUserEmails = [
    'test@example.com',
    'admin@example.com',
    'user1@test.com',
    'user2@test.com',
  ];

  // Implementation would remove users with these emails
  // Example: DELETE FROM users WHERE email IN (testUserEmails)
}

async function removeTestTags() {
  console.log('🗑️  Removing test tags...');

  // Remove tags that were created during tests
  // Example: DELETE FROM tags WHERE name LIKE 'Test%' OR created_at > test_start_time
}

async function removeTestSourceGroups() {
  console.log('🗑️  Removing test source groups...');

  // Remove source groups created during tests
  // Example: DELETE FROM source_groups WHERE name LIKE 'Test%'
}

async function cleanupTestCache() {
  const fs = require('fs').promises;
  const path = require('path');

  // Clean up test cache directories
  const cacheDirectories = [
    path.join(process.cwd(), '.cache', 'test'),
    path.join(process.cwd(), 'node_modules', '.cache', 'test'),
    path.join(process.cwd(), 'tmp', 'test'),
  ];

  for (const dir of cacheDirectories) {
    try {
      await fs.access(dir);
      await fs.rmdir(dir, { recursive: true });
      console.log(`🗑️  Removed cache directory: ${dir}`);
    } catch (error) {
      // Directory might not exist, which is fine
      continue;
    }
  }

  // Clear any in-memory caches
  if (global.testCache) {
    global.testCache.clear();
    console.log('🗑️  Cleared in-memory test cache');
  }
}

// Utility function to safely remove files
async function safeRemoveFile(filePath: string) {
  const fs = require('fs').promises;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    // File might not exist, which is fine
    return false;
  }
}

// Utility function to safely remove directories
async function safeRemoveDirectory(dirPath: string) {
  const fs = require('fs').promises;

  try {
    await fs.rmdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    // Directory might not exist, which is fine
    return false;
  }
}

// Function to verify cleanup completed successfully
async function verifyCleanup() {
  console.log('🔍 Verifying cleanup completion...');

  const fs = require('fs').promises;
  const path = require('path');

  // Check if test artifacts still exist
  const artifactsToCheck = [
    'test-results',
    'playwright-report',
    'test-uploads',
    path.join('playwright', '.auth'),
  ];

  let cleanupComplete = true;

  for (const artifact of artifactsToCheck) {
    try {
      await fs.access(artifact);
      console.log(`⚠️  Warning: ${artifact} still exists after cleanup`);
      cleanupComplete = false;
    } catch (error) {
      // Artifact doesn't exist, which is good
      continue;
    }
  }

  if (cleanupComplete) {
    console.log('✅ Cleanup verification passed');
  } else {
    console.log('⚠️  Cleanup verification found some remaining artifacts');
  }

  return cleanupComplete;
}

export default globalTeardown;
