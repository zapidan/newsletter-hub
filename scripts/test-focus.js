#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Newsletter Hub - Focused Test Analysis');
console.log('=========================================\n');

// Test files to analyze
const testFiles = [
  'tests/e2e/auth-intercepted.spec.ts',
  'tests/e2e/newsletter/simple-newsletter.spec.ts',
  'tests/e2e/newsletter/newsletter-functionality.spec.ts',
  'tests/e2e/newsletter/newsletter-best-practices.spec.ts'
];

// Function to run a single test file and capture results
function runSingleTest(testFile) {
  console.log(`\n📝 Testing: ${testFile}`);
  console.log('=' + '='.repeat(testFile.length + 10));

  try {
    const cmd = `npx playwright test "${testFile}" --reporter=json --output=test-results/single-test.json`;
    const output = execSync(cmd, {
      timeout: 60000, // 1 minute timeout per file
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Try to parse the JSON output
    try {
      const resultsPath = 'test-results/single-test.json';
      if (fs.existsSync(resultsPath)) {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        const stats = results.stats || {};

        console.log(`✅ Passed: ${stats.passed || 0}`);
        console.log(`❌ Failed: ${stats.failed || 0}`);
        console.log(`⏭️  Skipped: ${stats.skipped || 0}`);

        if (stats.failed > 0 && results.suites) {
          console.log('\n🚨 Failed Tests:');
          analyzeFailures(results.suites);
        }

        return {
          file: testFile,
          passed: stats.passed || 0,
          failed: stats.failed || 0,
          skipped: stats.skipped || 0,
          errors: extractErrors(results.suites)
        };
      }
    } catch (parseError) {
      console.log('⚠️  Could not parse test results JSON');
    }

    console.log('✅ Test completed successfully');
    return { file: testFile, passed: 1, failed: 0, skipped: 0, errors: [] };

  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
    return {
      file: testFile,
      passed: 0,
      failed: 1,
      skipped: 0,
      errors: [error.message]
    };
  }
}

// Function to analyze failures in test suites
function analyzeFailures(suites) {
  suites.forEach(suite => {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        if (spec.tests) {
          spec.tests.forEach(test => {
            if (test.results && test.results.some(r => r.status === 'failed')) {
              console.log(`  • ${test.title}`);
              test.results.forEach(result => {
                if (result.status === 'failed' && result.error) {
                  console.log(`    └─ ${result.error.message}`);
                }
              });
            }
          });
        }
      });
    }

    // Recursively check nested suites
    if (suite.suites) {
      analyzeFailures(suite.suites);
    }
  });
}

// Function to extract error messages
function extractErrors(suites) {
  const errors = [];

  function extractFromSuite(suite) {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        if (spec.tests) {
          spec.tests.forEach(test => {
            if (test.results) {
              test.results.forEach(result => {
                if (result.status === 'failed' && result.error) {
                  errors.push({
                    test: test.title,
                    error: result.error.message
                  });
                }
              });
            }
          });
        }
      });
    }

    if (suite.suites) {
      suite.suites.forEach(extractFromSuite);
    }
  }

  suites.forEach(extractFromSuite);
  return errors;
}

// Function to check if smoke tests should be removed
function checkSmokeTests() {
  console.log('\n🔥 Checking Smoke Tests');
  console.log('=====================');

  try {
    const cmd = 'npx vitest run src/__tests__/smoke --reporter=json';
    const output = execSync(cmd, {
      timeout: 30000,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('✅ Smoke tests are passing and may be useful for CI/CD');
    console.log('💡 Recommendation: Keep smoke tests for quick validation');
    return true;
  } catch (error) {
    console.log('❌ Smoke tests are failing or not needed');
    console.log('💡 Recommendation: Consider removing smoke tests');
    return false;
  }
}

// Function to generate recommendations
function generateRecommendations(results) {
  console.log('\n📋 Test Analysis Summary');
  console.log('========================');

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalTests = totalPassed + totalFailed + totalSkipped;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${totalFailed} (${((totalFailed/totalTests)*100).toFixed(1)}%)`);
  console.log(`Skipped: ${totalSkipped} (${((totalSkipped/totalTests)*100).toFixed(1)}%)`);

  console.log('\n🎯 Recommendations:');

  if (totalFailed === 0) {
    console.log('✅ All tests are passing! Great work!');
  } else if (totalFailed < 5) {
    console.log('🔧 Few failing tests - worth fixing');
    console.log('   • Focus on the failing tests below');
    console.log('   • These are likely quick wins');
  } else if (totalFailed < 15) {
    console.log('⚖️  Moderate failures - evaluate each one');
    console.log('   • Fix critical functionality tests');
    console.log('   • Consider removing flaky/non-essential tests');
  } else {
    console.log('🗑️  Many failing tests - consider cleanup');
    console.log('   • Remove tests for unimplemented features');
    console.log('   • Focus on core functionality only');
    console.log('   • Rewrite test suite with simpler approach');
  }

  // Common failure pattern analysis
  const allErrors = results.flatMap(r => r.errors);
  const commonPatterns = analyzeErrorPatterns(allErrors);

  if (commonPatterns.length > 0) {
    console.log('\n🔍 Common Failure Patterns:');
    commonPatterns.forEach(pattern => {
      console.log(`   • ${pattern.pattern} (${pattern.count} occurrences)`);
    });
  }

  // Files to consider removing
  const highFailureFiles = results.filter(r => {
    const total = r.passed + r.failed + r.skipped;
    const failureRate = total > 0 ? r.failed / total : 0;
    return failureRate > 0.5 && r.failed > 3;
  });

  if (highFailureFiles.length > 0) {
    console.log('\n🗑️  Files with high failure rates (consider removing):');
    highFailureFiles.forEach(file => {
      const total = file.passed + file.failed + file.skipped;
      const failureRate = ((file.failed / total) * 100).toFixed(1);
      console.log(`   • ${file.file} (${failureRate}% failure rate)`);
    });
  }
}

// Function to analyze error patterns
function analyzeErrorPatterns(errors) {
  const patterns = {};

  errors.forEach(error => {
    const message = error.error || error;

    // Common patterns to look for
    if (message.includes('timeout') || message.includes('Timeout')) {
      patterns['Timeout issues'] = (patterns['Timeout issues'] || 0) + 1;
    }
    if (message.includes('not found') || message.includes('locator')) {
      patterns['Element not found'] = (patterns['Element not found'] || 0) + 1;
    }
    if (message.includes('network') || message.includes('fetch')) {
      patterns['Network/API issues'] = (patterns['Network/API issues'] || 0) + 1;
    }
    if (message.includes('visible') || message.includes('hidden')) {
      patterns['Visibility issues'] = (patterns['Visibility issues'] || 0) + 1;
    }
    if (message.includes('click') || message.includes('button')) {
      patterns['Click/Interaction issues'] = (patterns['Click/Interaction issues'] || 0) + 1;
    }
  });

  return Object.entries(patterns)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}

// Main execution
async function main() {
  // Ensure test results directory exists
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true });
  }

  // Check which test files actually exist
  const existingTestFiles = testFiles.filter(file => fs.existsSync(file));

  if (existingTestFiles.length === 0) {
    console.log('❌ No test files found! Check if paths are correct.');
    return;
  }

  console.log(`Found ${existingTestFiles.length} test files to analyze\n`);

  // Run each test file individually
  const results = [];
  for (const testFile of existingTestFiles) {
    const result = runSingleTest(testFile);
    results.push(result);

    // Short break between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Check smoke tests
  const smokeTestsNeeded = checkSmokeTests();

  // Generate recommendations
  generateRecommendations(results);

  // Create action plan
  console.log('\n📝 Action Plan:');
  console.log('===============');
  console.log('1. Review the failing tests above');
  console.log('2. Fix tests for core functionality (auth, basic newsletter operations)');
  console.log('3. Remove tests for unimplemented features (search, advanced filters)');
  console.log('4. Simplify complex tests that are hard to maintain');
  if (!smokeTestsNeeded) {
    console.log('5. Consider removing smoke tests if they add no value');
  }
  console.log('6. Re-run this script to verify improvements');

  console.log('\n✨ Happy testing! ✨');
}

// Run the script
main().catch(console.error);
