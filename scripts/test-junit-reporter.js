#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('Testing JUnit reporter setup...');

try {
  // Create test results directory
  execSync('mkdir -p test-results', { stdio: 'inherit' });

  // Run a simple test with JUnit reporter
  console.log('Running simple test with JUnit reporter...');
  execSync('pnpm exec vitest run --reporter=junit --outputFile.junit=test-results/test-junit.xml src/__tests__/simple.test.ts', {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });

  // Check if the file was created
  const testFile = join(process.cwd(), 'test-results', 'test-junit.xml');
  if (existsSync(testFile)) {
    console.log('✅ JUnit reporter test file created successfully');
    const content = readFileSync(testFile, 'utf8');
    console.log('File content preview:');
    console.log(content.substring(0, 500) + '...');
  } else {
    console.log('❌ JUnit reporter test file was not created');
  }

} catch (error) {
  console.error('❌ Error testing JUnit reporter:', error.message);
  process.exit(1);
} 