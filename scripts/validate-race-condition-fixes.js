#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Validation script for race condition fixes in useNewsletters hook
 * This script checks the codebase for common race condition patterns
 */

const COLORS = {
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RESET: "\x1b[0m",
  CYAN: "\x1b[36m",
};

class RaceConditionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.srcPath = path.join(__dirname, "../src");
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  error(message) {
    this.errors.push(message);
    this.log(`❌ ERROR: ${message}`, COLORS.RED);
  }

  warning(message) {
    this.warnings.push(message);
    this.log(`⚠️  WARNING: ${message}`, COLORS.YELLOW);
  }

  success(message) {
    this.success.push(message);
    this.log(`✅ SUCCESS: ${message}`, COLORS.GREEN);
  }

  info(message) {
    this.log(`ℹ️  INFO: ${message}`, COLORS.BLUE);
  }

  /**
   * Get all React component files
   */
  getComponentFiles() {
    const files = [];

    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (
          stat.isDirectory() &&
          !item.startsWith(".") &&
          item !== "node_modules"
        ) {
          walkDir(fullPath);
        } else if (item.endsWith(".tsx") || item.endsWith(".ts")) {
          files.push(fullPath);
        }
      }
    };

    walkDir(this.srcPath);
    return files;
  }

  /**
   * Check for multiple useNewsletters calls in the same file
   */
  checkMultipleHookCalls(filePath, content) {
    const matches = content.match(/useNewsletters\s*\(/g);
    if (matches && matches.length > 1) {
      this.warning(
        `Multiple useNewsletters calls found in ${path.relative(this.srcPath, filePath)} (${matches.length} calls)`,
      );
      return false;
    }
    return true;
  }

  /**
   * Check for local state management of newsletter data
   */
  checkLocalNewsletterState(filePath, content) {
    const problematicPatterns = [
      /const\s+\[newsletters,\s*setNewsletters\]\s*=\s*useState/,
      /useState.*newsletter.*\[\]/,
      /setNewsletters\(/,
    ];

    for (const pattern of problematicPatterns) {
      if (pattern.test(content)) {
        this.error(
          `Local newsletter state management found in ${path.relative(this.srcPath, filePath)}`,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Check for proper hook parameter usage
   */
  checkHookParameters(filePath, content) {
    // Look for useNewsletters calls with wrong parameters
    const wrongParameterPatterns = [
      /useNewsletters\s*\(\s*undefined\s*,\s*["']all["']/,
      /useNewsletters\s*\(\s*[^,}]*,\s*["'][^"']*["']\s*,/,
    ];

    for (const pattern of wrongParameterPatterns) {
      if (pattern.test(content)) {
        this.error(
          `Incorrect useNewsletters parameters in ${path.relative(this.srcPath, filePath)}`,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Check for debug logging usage
   */
  checkDebugUsage(filePath, content) {
    if (
      content.includes("useNewsletters(") &&
      content.includes("debug: true")
    ) {
      this.success(
        `Debug logging enabled in ${path.relative(this.srcPath, filePath)}`,
      );
      return true;
    }
    return false;
  }

  /**
   * Check for single source of truth pattern
   */
  checkSingleSourceOfTruth(filePath, content) {
    // Look for components that use fetchedNewsletters directly
    if (
      content.includes("useNewsletters(") &&
      content.includes("fetchedNewsletters")
    ) {
      if (!content.includes("useState") || !content.includes("newsletters")) {
        this.success(
          `Single source of truth pattern in ${path.relative(this.srcPath, filePath)}`,
        );
        return true;
      }
    }
    return false;
  }

  /**
   * Check for unnecessary empty filter calls
   */
  checkEmptyFilterCalls(filePath, content) {
    // Look for useNewsletters() calls without parameters
    if (/useNewsletters\s*\(\s*\)/.test(content)) {
      this.warning(
        `Empty filter useNewsletters call in ${path.relative(this.srcPath, filePath)}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Check specific files that were modified
   */
  checkSpecificFixes() {
    const criticalFiles = [
      "web/pages/NewslettersPage.tsx",
      "web/pages/ReadingQueuePage.tsx",
      "web/pages/NewsletterDetail.tsx",
      "web/pages/Inbox.tsx",
      "common/hooks/useNewsletters.ts",
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(this.srcPath, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");

        // Specific checks for each file
        switch (file) {
          case "web/pages/NewslettersPage.tsx":
            this.checkNewslettersPageFixes(filePath, content);
            break;
          case "web/pages/ReadingQueuePage.tsx":
            this.checkReadingQueuePageFixes(filePath, content);
            break;
          case "web/pages/NewsletterDetail.tsx":
            this.checkNewsletterDetailFixes(filePath, content);
            break;
          case "common/hooks/useNewsletters.ts":
            this.checkHookFixes(filePath, content);
            break;
        }
      } else {
        this.warning(`File not found: ${file}`);
      }
    }
  }

  checkNewslettersPageFixes(filePath, content) {
    const fileName = path.basename(filePath);

    // Check for single useNewsletters call
    const hookCalls = (content.match(/useNewsletters\s*\(/g) || []).length;
    if (hookCalls === 1) {
      this.success(`${fileName}: Single useNewsletters call ✓`);
    } else {
      this.error(`${fileName}: Multiple useNewsletters calls (${hookCalls})`);
    }

    // Check for removed local state
    if (!content.includes("const [newsletters, setNewsletters]")) {
      this.success(`${fileName}: Local newsletter state removed ✓`);
    } else {
      this.error(`${fileName}: Still has local newsletter state`);
    }

    // Check for fetchedNewsletters usage
    if (content.includes("fetchedNewsletters")) {
      this.success(`${fileName}: Uses fetchedNewsletters from hook ✓`);
    } else {
      this.warning(`${fileName}: Doesn't use fetchedNewsletters`);
    }
  }

  checkReadingQueuePageFixes(filePath, content) {
    const fileName = path.basename(filePath);

    // Check for removed unnecessary useNewsletters call
    if (
      !content.includes("useNewsletters()") &&
      !content.includes("toggleNewsletterLike")
    ) {
      this.success(`${fileName}: Unnecessary useNewsletters call removed ✓`);
    } else {
      this.error(`${fileName}: Still has unnecessary useNewsletters call`);
    }
  }

  checkNewsletterDetailFixes(filePath, content) {
    const fileName = path.basename(filePath);

    // Check for correct parameter usage
    if (content.includes("useNewsletters({}, { enabled: false })")) {
      this.success(`${fileName}: Correct useNewsletters parameters ✓`);
    } else if (content.includes('useNewsletters(undefined, "all"')) {
      this.error(`${fileName}: Still has incorrect parameters`);
    }
  }

  checkHookFixes(filePath, content) {
    const fileName = path.basename(filePath);

    // Check for debug option
    if (content.includes("debug?: boolean")) {
      this.success(`${fileName}: Debug option added ✓`);
    } else {
      this.warning(`${fileName}: Debug option not found`);
    }

    // Check for conditional logging
    if (content.includes("if (debug)")) {
      this.success(`${fileName}: Conditional debug logging ✓`);
    } else {
      this.warning(`${fileName}: Conditional logging not found`);
    }
  }

  /**
   * Run all validations
   */
  async validate() {
    this.log("\n🔍 Starting Race Condition Validation...", COLORS.CYAN);
    this.log("=".repeat(50), COLORS.CYAN);

    const files = this.getComponentFiles();
    this.info(`Found ${files.length} TypeScript/React files to analyze`);

    // Check specific fixes first
    this.log("\n📋 Checking specific fixes...", COLORS.BLUE);
    this.checkSpecificFixes();

    // General pattern checks
    this.log("\n🔍 Running pattern analysis...", COLORS.BLUE);

    let filesWithHook = 0;
    let filesWithGoodPatterns = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf8");

        if (content.includes("useNewsletters")) {
          filesWithHook++;

          const checks = [
            this.checkMultipleHookCalls(filePath, content),
            this.checkLocalNewsletterState(filePath, content),
            this.checkHookParameters(filePath, content),
            this.checkEmptyFilterCalls(filePath, content),
          ];

          // Optional positive checks
          this.checkDebugUsage(filePath, content);
          this.checkSingleSourceOfTruth(filePath, content);

          if (checks.every((check) => check)) {
            filesWithGoodPatterns++;
          }
        }
      } catch (error) {
        this.error(`Failed to read file: ${filePath} - ${error.message}`);
      }
    }

    // Summary
    this.log("\n📊 Validation Summary", COLORS.CYAN);
    this.log("=".repeat(50), COLORS.CYAN);

    this.log(`Files analyzed: ${files.length}`);
    this.log(`Files using useNewsletters: ${filesWithHook}`);
    this.log(`Files with good patterns: ${filesWithGoodPatterns}`);

    this.log(`\n✅ Successes: ${this.success.length}`, COLORS.GREEN);
    this.log(`⚠️  Warnings: ${this.warnings.length}`, COLORS.YELLOW);
    this.log(`❌ Errors: ${this.errors.length}`, COLORS.RED);

    if (this.errors.length === 0) {
      this.log(
        "\n🎉 All race condition fixes validated successfully!",
        COLORS.GREEN,
      );
      return true;
    } else {
      this.log(
        "\n🚨 Some issues found. Please review the errors above.",
        COLORS.RED,
      );
      return false;
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new RaceConditionValidator();
  validator
    .validate()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}

export default RaceConditionValidator;
