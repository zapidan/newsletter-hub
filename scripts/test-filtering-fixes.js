#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Test script to validate filtering and unread count fixes
 * This script provides manual test scenarios and validation steps
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RESET: "\x1b[0m",
  CYAN: "\x1b[36m",
  MAGENTA: "\x1b[35m",
};

class FilteringTestValidator {
  constructor() {
    this.testResults = [];
    this.srcPath = path.join(__dirname, "../src");
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  success(message) {
    this.log(`✅ ${message}`, COLORS.GREEN);
    this.testResults.push({ type: "success", message });
  }

  error(message) {
    this.log(`❌ ${message}`, COLORS.RED);
    this.testResults.push({ type: "error", message });
  }

  warning(message) {
    this.log(`⚠️  ${message}`, COLORS.YELLOW);
    this.testResults.push({ type: "warning", message });
  }

  info(message) {
    this.log(`ℹ️  ${message}`, COLORS.BLUE);
  }

  testStep(step, description) {
    this.log(`\n${step}. ${description}`, COLORS.CYAN);
  }

  checkCodePatterns() {
    this.log("\n🔍 Checking Code Patterns...", COLORS.MAGENTA);

    // Check if debug logging is enabled
    const inboxFile = path.join(this.srcPath, "web/pages/Inbox.tsx");
    const newslettersPageFile = path.join(
      this.srcPath,
      "web/pages/NewslettersPage.tsx",
    );
    const useNewslettersFile = path.join(
      this.srcPath,
      "common/hooks/useNewsletters.ts",
    );

    if (fs.existsSync(inboxFile)) {
      const content = fs.readFileSync(inboxFile, "utf8");
      if (content.includes("debug: true")) {
        this.success("Inbox page has debug logging enabled");
      } else {
        this.warning("Inbox page debug logging not found");
      }

      if (content.includes("🐛 Debug Info")) {
        this.success("Inbox page has debug UI section");
      } else {
        this.warning("Inbox page debug UI section not found");
      }
    }

    if (fs.existsSync(newslettersPageFile)) {
      const content = fs.readFileSync(newslettersPageFile, "utf8");
      if (content.includes("debug: true")) {
        this.success("NewslettersPage has debug logging enabled");
      } else {
        this.warning("NewslettersPage debug logging not found");
      }

      if (content.includes("🐛 Debug Info")) {
        this.success("NewslettersPage has debug UI section");
      } else {
        this.warning("NewslettersPage debug UI section not found");
      }
    }

    if (fs.existsSync(useNewslettersFile)) {
      const content = fs.readFileSync(useNewslettersFile, "utf8");
      if (content.includes("newsletter:read-status-changed")) {
        this.success("useNewsletters hook dispatches read status events");
      } else {
        this.error("useNewsletters hook missing read status events");
      }

      if (content.includes("newsletter:archived")) {
        this.success("useNewsletters hook dispatches archive events");
      } else {
        this.error("useNewsletters hook missing archive events");
      }
    }
  }

  printManualTestSteps() {
    this.log("\n📋 Manual Testing Steps", COLORS.MAGENTA);
    this.log("=" .repeat(50), COLORS.MAGENTA);

    this.testStep(
      "1",
      "Test Source Filtering in Inbox (source dropdown not working)",
    );
    this.info("   a. Navigate to /inbox");
    this.info("   b. Open browser console to see debug logs");
    this.info("   c. Click on 'Filter by Source' dropdown");
    this.info("   d. Select a specific newsletter source");
    this.info("   e. Check console for filter logs:");
    this.info(
      "      - Look for '📋 Newsletter filter computed' with sourceIds",
    );
    this.info("      - Look for '🔍 useNewsletters - Fetching newsletters'");
    this.info("      - Verify API call includes correct sourceIds parameter");
    this.info("   f. Verify only newsletters from selected source are shown");
    this.info("   g. Check debug UI section shows correct source filter");

    this.testStep(
      "2",
      "Test Source Filtering in NewslettersPage (click not working)",
    );
    this.info("   a. Navigate to /newsletters");
    this.info("   b. Open browser console to see debug logs");
    this.info("   c. Click on any newsletter source card");
    this.info("   d. Check console for filter logs:");
    this.info("      - Look for '🎯 Source selected' log");
    this.info("      - Look for '📰 NewslettersPage - Building Filter'");
    this.info("      - Verify selectedSourceId is set correctly");
    this.info("   e. Verify newsletters section appears below sources");
    this.info("   f. Verify only newsletters from clicked source are shown");
    this.info("   g. Check debug UI section shows correct filter state");

    this.testStep("3", "Test Unread Count Updates (stuck at 1)");
    this.info("   a. Navigate to any page with newsletters");
    this.info("   b. Note current unread count in sidebar");
    this.info("   c. Mark a newsletter as read/unread");
    this.info("   d. Check console for event dispatch logs");
    this.info("   e. Wait 5-10 seconds for count to update");
    this.info("   f. Verify sidebar unread count changes");
    this.info("   g. Test with multiple newsletters");
    this.info("   h. Try archiving newsletters (should also affect count)");

    this.testStep("4", "Debug Console Logs to Look For");
    this.info("   SUCCESS PATTERNS:");
    this.info("   ✅ '📝 useNewsletters - Building query params'");
    this.info("   ✅ '🔍 useNewsletters - Fetching newsletters'");
    this.info("   ✅ '✅ API Response' with correct count and sourceBreakdown");
    this.info("   ✅ '✅ Source filtering working correctly'");
    this.info("   ✅ Event dispatches: 'newsletter:read-status-changed'");
    this.info("");
    this.info("   ERROR PATTERNS:");
    this.info("   ❌ '⚠️ Source filtering may not be working correctly'");
    this.info("   ❌ Empty or undefined sourceIds in API calls");
    this.info("   ❌ Newsletters from wrong sources in response");
    this.info("   ❌ No event dispatches after read/unread actions");

    this.testStep("5", "Force Refresh Testing");
    this.info("   a. Use the '🔄 Refresh' buttons added to debug sections");
    this.info("   b. This forces a fresh API call");
    this.info("   c. Compare results before and after refresh");
    this.info("   d. Check if source filtering works after refresh");

    this.testStep("6", "API Direct Testing");
    this.info("   a. Open browser Network tab");
    this.info("   b. Filter by 'newsletters' or API calls");
    this.info("   c. Perform filtering actions");
    this.info("   d. Check actual API request parameters:");
    this.info("      - sourceIds should be array with correct IDs");
    this.info("      - isArchived should be false for normal filtering");
    this.info("      - Other filters should match UI state");
    this.info("   e. Check API response:");
    this.info("      - All returned newsletters should match filter criteria");
    this.info("      - Count should be reasonable");
  }

  printTroubleshootingGuide() {
    this.log("\n🔧 Troubleshooting Guide", COLORS.MAGENTA);
    this.log("=" .repeat(50), COLORS.MAGENTA);

    this.info("ISSUE: Source filtering not working in Inbox");
    this.info("CAUSES:");
    this.info("  - Source filter state not syncing with debounced state");
    this.info("  - URL parameters not being applied correctly");
    this.info("  - API call missing sourceIds parameter");
    this.info("CHECKS:");
    this.info("  - Compare sourceFilter vs debouncedSourceFilter in debug UI");
    this.info("  - Check if URL updates when dropdown selection changes");
    this.info("  - Verify API call includes correct sourceIds");
    this.info("");

    this.info("ISSUE: Source clicking not working in NewslettersPage");
    this.info("CAUSES:");
    this.info("  - onClick handler not firing");
    this.info("  - selectedSourceId not being set");
    this.info("  - Filter building logic using wrong state");
    this.info("CHECKS:");
    this.info("  - Look for '🎯 Source selected' log in console");
    this.info("  - Check if selectedSourceId appears in debug UI");
    this.info("  - Verify filter object has correct sourceIds array");
    this.info("");

    this.info("ISSUE: Unread count stuck at 1");
    this.info("CAUSES:");
    this.info("  - Events not being dispatched from mutations");
    this.info("  - Event listeners not properly attached");
    this.info("  - Cache not being invalidated");
    this.info("  - API returning cached/stale data");
    this.info("CHECKS:");
    this.info("  - Look for event dispatch logs after read/unread actions");
    this.info("  - Check Network tab for unread count API calls");
    this.info("  - Try hard refresh to clear all caches");
    this.info("  - Check if count updates after page refresh");
    this.info("");

    this.info("QUICK FIXES:");
    this.info("  - Clear browser cache and localStorage");
    this.info("  - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)");
    this.info("  - Check browser console for JavaScript errors");
    this.info("  - Try in incognito/private mode");
    this.info("  - Restart development server");
  }

  printExpectedBehavior() {
    this.log("\n🎯 Expected Behavior", COLORS.MAGENTA);
    this.log("=" .repeat(50), COLORS.MAGENTA);

    this.info("INBOX SOURCE FILTERING:");
    this.info("  ✅ Dropdown shows all available newsletter sources");
    this.info("  ✅ Selecting a source filters newsletters immediately");
    this.info("  ✅ URL updates with ?source=SOURCE_ID parameter");
    this.info("  ✅ Only newsletters from selected source are displayed");
    this.info("  ✅ 'All Sources' option shows all newsletters");
    this.info("  ✅ Debug UI shows correct source filter value");
    this.info("");

    this.info("NEWSLETTERS PAGE SOURCE FILTERING:");
    this.info("  ✅ Clicking source card selects it (visual highlight)");
    this.info("  ✅ Newsletters section appears below sources");
    this.info("  ✅ Only newsletters from clicked source are shown");
    this.info("  ✅ 'Clear filter' button removes selection");
    this.info("  ✅ Debug UI shows correct selectedSourceId");
    this.info("");

    this.info("UNREAD COUNT UPDATES:");
    this.info("  ✅ Count updates immediately after marking read/unread");
    this.info("  ✅ Count decreases when marking as read");
    this.info("  ✅ Count increases when marking as unread");
    this.info("  ✅ Count updates when archiving newsletters");
    this.info("  ✅ Count persists across page navigations");
    this.info("  ✅ Count is accurate after page refresh");
  }

  async runTests() {
    this.log("🧪 Newsletter Filtering & Unread Count Test Suite", COLORS.CYAN);
    this.log("=" .repeat(60), COLORS.CYAN);

    this.checkCodePatterns();
    this.printManualTestSteps();
    this.printTroubleshootingGuide();
    this.printExpectedBehavior();

    // Summary
    this.log("\n📊 Test Summary", COLORS.CYAN);
    this.log("=" .repeat(30), COLORS.CYAN);

    const successCount = this.testResults.filter(
      (r) => r.type === "success",
    ).length;
    const errorCount = this.testResults.filter((r) => r.type === "error").length;
    const warningCount = this.testResults.filter(
      (r) => r.type === "warning",
    ).length;

    this.log(`✅ Passed: ${successCount}`, COLORS.GREEN);
    this.log(`⚠️  Warnings: ${warningCount}`, COLORS.YELLOW);
    this.log(`❌ Failed: ${errorCount}`, COLORS.RED);

    if (errorCount === 0) {
      this.log(
        "\n🎉 Code patterns look good! Run manual tests above.",
        COLORS.GREEN,
      );
    } else {
      this.log(
        "\n🚨 Some code patterns need attention. Check the errors above.",
        COLORS.RED,
      );
    }

    this.log(
      "\n💡 TIP: Open browser console and follow manual test steps for complete validation.",
      COLORS.CYAN,
    );

    return errorCount === 0;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new FilteringTestValidator();
  validator
    .runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

export default FilteringTestValidator;
