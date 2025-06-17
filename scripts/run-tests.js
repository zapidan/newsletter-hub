#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const TEST_CONFIG = {
  unit: {
    command: 'npm run test:unit',
    description: 'Unit tests',
    timeout: 60000,
  },
  integration: {
    command: 'npm run test:integration',
    description: 'Integration tests',
    timeout: 120000,
  },
  e2e: {
    command: 'npm run test:e2e',
    description: 'End-to-end tests',
    timeout: 300000,
  },
  coverage: {
    command: 'npm run test:coverage',
    description: 'Coverage report',
    timeout: 180000,
  },
};

const COVERAGE_THRESHOLDS = {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80,
};

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      e2e: null,
      coverage: null,
    };
    this.startTime = Date.now();
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.watch = process.argv.includes('--watch') || process.argv.includes('-w');
    this.coverage = process.argv.includes('--coverage') || process.argv.includes('-c');
    this.ci = process.env.CI === 'true' || process.argv.includes('--ci');
    this.testType = this.parseTestType();
  }

  parseTestType() {
    const args = process.argv.slice(2);
    const typeIndex = args.findIndex(arg => ['unit', 'integration', 'e2e', 'all'].includes(arg));
    return typeIndex !== -1 ? args[typeIndex] : 'all';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray,
    };

    const color = colors[type] || colors.info;
    console.log(`${chalk.gray(timestamp)} ${color(message)}`);
  }

  async run() {
    this.log('🚀 Starting test runner...', 'info');

    try {
      // Pre-test setup
      await this.preTestSetup();

      // Run tests based on type
      if (this.testType === 'all') {
        await this.runAllTests();
      } else {
        await this.runSpecificTest(this.testType);
      }

      // Generate reports
      await this.generateReports();

      // Post-test cleanup
      await this.postTestCleanup();

      // Display summary
      this.displaySummary();

      process.exit(this.getExitCode());
    } catch (error) {
      this.log(`❌ Test runner failed: ${error.message}`, 'error');
      if (this.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  }

  async preTestSetup() {
    this.log('🔧 Setting up test environment...', 'info');

    // Check if dependencies are installed
    await this.checkDependencies();

    // Clean previous test results
    await this.cleanPreviousResults();

    // Setup test database
    if (this.testType === 'integration' || this.testType === 'e2e' || this.testType === 'all') {
      await this.setupTestDatabase();
    }

    // Start test server for E2E tests
    if (this.testType === 'e2e' || this.testType === 'all') {
      await this.startTestServer();
    }

    this.log('✅ Test environment ready', 'success');
  }

  async checkDependencies() {
    const requiredDeps = [
      'vitest',
      '@playwright/test',
      '@testing-library/react',
      'msw',
    ];

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const missingDeps = requiredDeps.filter(dep => !allDeps[dep]);

    if (missingDeps.length > 0) {
      throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
    }
  }

  async cleanPreviousResults() {
    const dirsToClean = [
      'coverage',
      'test-results',
      'playwright-report',
      'dist',
    ];

    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        if (this.verbose) {
          this.log(`🗑️  Cleaned ${dir}`, 'debug');
        }
      }
    }
  }

  async setupTestDatabase() {
    this.log('🗄️  Setting up test database...', 'info');

    try {
      execSync('npm run db:test:setup', { stdio: this.verbose ? 'inherit' : 'pipe' });
    } catch (error) {
      this.log('⚠️  Test database setup failed, continuing...', 'warning');
    }
  }

  async startTestServer() {
    this.log('🌐 Starting test server...', 'info');

    // This would typically start your development server
    // For now, we'll assume it's handled by Playwright's webServer config
  }

  async runAllTests() {
    this.log('🧪 Running all tests...', 'info');

    const testOrder = ['unit', 'integration', 'e2e'];

    for (const testType of testOrder) {
      await this.runSpecificTest(testType);

      // If any test fails and we're in CI, stop execution
      if (this.ci && this.results[testType] && this.results[testType].exitCode !== 0) {
        throw new Error(`${testType} tests failed, stopping execution`);
      }
    }

    // Run coverage if requested
    if (this.coverage) {
      await this.runSpecificTest('coverage');
    }
  }

  async runSpecificTest(testType) {
    const config = TEST_CONFIG[testType];
    if (!config) {
      throw new Error(`Unknown test type: ${testType}`);
    }

    this.log(`🔬 Running ${config.description}...`, 'info');

    const startTime = Date.now();

    try {
      const result = await this.executeCommand(config.command, config.timeout);
      const duration = Date.now() - startTime;

      this.results[testType] = {
        exitCode: result.exitCode,
        duration,
        output: result.output,
      };

      if (result.exitCode === 0) {
        this.log(`✅ ${config.description} passed (${this.formatDuration(duration)})`, 'success');
      } else {
        this.log(`❌ ${config.description} failed (${this.formatDuration(duration)})`, 'error');
        if (this.verbose && result.output) {
          console.log(result.output);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results[testType] = {
        exitCode: 1,
        duration,
        error: error.message,
      };
      this.log(`💥 ${config.description} crashed: ${error.message}`, 'error');
    }
  }

  executeCommand(command, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout,
      });

      let output = '';

      if (!this.verbose) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          output += data.toString();
        });
      }

      child.on('close', (exitCode) => {
        resolve({ exitCode, output });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  async generateReports() {
    this.log('📊 Generating test reports...', 'info');

    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      testType: this.testType,
      duration: Date.now() - this.startTime,
      results: this.results,
      environment: {
        node: process.version,
        platform: process.platform,
        ci: this.ci,
      },
    };

    // Ensure reports directory exists
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    fs.writeFileSync(
      `reports/test-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );

    // Generate HTML report if coverage was run
    if (this.results.coverage) {
      await this.generateCoverageReport();
    }

    this.log('✅ Reports generated', 'success');
  }

  async generateCoverageReport() {
    if (fs.existsSync('coverage/lcov-report/index.html')) {
      this.log('📈 Coverage report available at coverage/lcov-report/index.html', 'info');
    }

    // Check coverage thresholds
    if (fs.existsSync('coverage/coverage-summary.json')) {
      const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
      const total = summary.total;

      this.log('📊 Coverage Summary:', 'info');
      console.log(`  Statements: ${total.statements.pct}% (threshold: ${COVERAGE_THRESHOLDS.statements}%)`);
      console.log(`  Branches: ${total.branches.pct}% (threshold: ${COVERAGE_THRESHOLDS.branches}%)`);
      console.log(`  Functions: ${total.functions.pct}% (threshold: ${COVERAGE_THRESHOLDS.functions}%)`);
      console.log(`  Lines: ${total.lines.pct}% (threshold: ${COVERAGE_THRESHOLDS.lines}%)`);

      // Check if thresholds are met
      const thresholdsMet = [
        total.statements.pct >= COVERAGE_THRESHOLDS.statements,
        total.branches.pct >= COVERAGE_THRESHOLDS.branches,
        total.functions.pct >= COVERAGE_THRESHOLDS.functions,
        total.lines.pct >= COVERAGE_THRESHOLDS.lines,
      ].every(Boolean);

      if (!thresholdsMet) {
        this.log('⚠️  Coverage thresholds not met', 'warning');
        if (this.ci) {
          this.results.coverage.exitCode = 1;
        }
      }
    }
  }

  async postTestCleanup() {
    this.log('🧹 Cleaning up...', 'info');

    // Stop test server
    if (this.testServer) {
      this.testServer.kill();
    }

    // Clean up test database
    try {
      execSync('npm run db:test:cleanup', { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up temporary files
    const tempFiles = [
      '.nyc_output',
      'playwright/.auth',
    ];

    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { recursive: true, force: true });
      }
    }
  }

  displaySummary() {
    const totalDuration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    this.log('📋 Test Summary', 'info');
    console.log('='.repeat(60));

    Object.entries(this.results).forEach(([testType, result]) => {
      if (result) {
        const status = result.exitCode === 0 ? '✅ PASS' : '❌ FAIL';
        const duration = this.formatDuration(result.duration);
        console.log(`${status} ${testType.padEnd(12)} (${duration})`);
      }
    });

    console.log('='.repeat(60));
    console.log(`Total Duration: ${this.formatDuration(totalDuration)}`);

    const failedTests = Object.entries(this.results)
      .filter(([_, result]) => result && result.exitCode !== 0);

    if (failedTests.length === 0) {
      this.log('🎉 All tests passed!', 'success');
    } else {
      this.log(`💥 ${failedTests.length} test suite(s) failed`, 'error');
      failedTests.forEach(([testType]) => {
        console.log(`  - ${testType}`);
      });
    }

    // CI-specific output
    if (this.ci) {
      this.generateCIOutput();
    }
  }

  generateCIOutput() {
    // GitHub Actions output
    if (process.env.GITHUB_ACTIONS) {
      const passed = Object.values(this.results).filter(r => r && r.exitCode === 0).length;
      const total = Object.values(this.results).filter(r => r !== null).length;

      console.log(`::set-output name=tests-passed::${passed}`);
      console.log(`::set-output name=tests-total::${total}`);
      console.log(`::set-output name=success::${passed === total}`);
    }
  }

  getExitCode() {
    const failedTests = Object.values(this.results)
      .filter(result => result && result.exitCode !== 0);

    return failedTests.length > 0 ? 1 : 0;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// Handle CLI arguments
function showHelp() {
  console.log(`
Newsletter Hub Test Runner

Usage: npm run test [options] [test-type]

Test Types:
  unit         Run unit tests only
  integration  Run integration tests only
  e2e          Run end-to-end tests only
  all          Run all tests (default)

Options:
  --verbose, -v    Show detailed output
  --watch, -w      Run tests in watch mode
  --coverage, -c   Include coverage report
  --ci             Run in CI mode
  --help, -h       Show this help message

Examples:
  npm run test unit --verbose
  npm run test e2e --coverage
  npm run test all --ci
  `);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run the test runner
const runner = new TestRunner();
runner.run().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
