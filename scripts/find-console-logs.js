#!/usr/bin/env node

/**
 * Script to find console.log statements that need to be replaced with centralized logging
 * Usage: node scripts/find-console-logs.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = path.join(__dirname, "../src");
const EXCLUDED_DIRS = ["node_modules", ".git", "dist", "build"];
const INCLUDED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Statistics
let stats = {
  totalFiles: 0,
  filesWithConsole: 0,
  totalConsoleStatements: 0,
  consoleLog: 0,
  consoleError: 0,
  consoleWarn: 0,
  consoleDebug: 0,
  consoleInfo: 0,
};

// Results storage
let results = [];

/**
 * Check if a directory should be excluded from scanning
 */
function shouldExcludeDir(dirName) {
  return EXCLUDED_DIRS.some((excluded) => dirName.includes(excluded));
}

/**
 * Check if a file should be included in scanning
 */
function shouldIncludeFile(fileName) {
  return INCLUDED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldExcludeDir(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (shouldIncludeFile(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Analyze a single file for console statements
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relativePath = path.relative(process.cwd(), filePath);

  stats.totalFiles++;

  const consoleStatements = [];
  const consoleRegex =
    /console\.(log|error|warn|debug|info|trace|table|group|groupCollapsed|groupEnd|time|timeEnd|assert|clear|count|countReset|dir|dirxml)\s*\(/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = consoleRegex.exec(line)) !== null) {
      const method = match[1];
      const lineNumber = index + 1;
      const column = match.index;
      const snippet = line.trim();

      consoleStatements.push({
        method,
        lineNumber,
        column,
        snippet,
        line: line,
      });

      stats.totalConsoleStatements++;
      stats[`console${method.charAt(0).toUpperCase() + method.slice(1)}`] =
        (stats[`console${method.charAt(0).toUpperCase() + method.slice(1)}`] ||
          0) + 1;
    }

    // Reset regex for next line
    consoleRegex.lastIndex = 0;
  });

  if (consoleStatements.length > 0) {
    stats.filesWithConsole++;
    results.push({
      file: relativePath,
      statements: consoleStatements,
    });
  }
}

/**
 * Generate migration suggestions based on console method and context
 */
function getMigrationSuggestion(method, snippet) {
  const suggestions = {
    log: {
      replacement: "log.info() or log.debug()",
      example:
        'log.info("User action completed", { action: "submit", metadata: { formId: "newsletter" } });',
    },
    error: {
      replacement: "log.error()",
      example:
        'log.error("Operation failed", { action: "api_call", metadata: { endpoint: "/api/data" } }, error);',
    },
    warn: {
      replacement: "log.warn()",
      example:
        'log.warn("Deprecated feature used", { action: "feature_usage", metadata: { feature: "oldApi" } });',
    },
    debug: {
      replacement: "log.debug()",
      example:
        'log.debug("Debug info", { metadata: { state: currentState } });',
    },
    info: {
      replacement: "log.info()",
      example: 'log.info("Information logged", { action: "info_log" });',
    },
  };

  return suggestions[method] || suggestions.log;
}

/**
 * Check if a file already uses the new logging system
 */
function usesNewLogging(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return (
    content.includes("useLogger") ||
    content.includes("useLoggerStatic") ||
    content.includes('from "@common/utils/logger"')
  );
}

/**
 * Print results to console
 */
function printResults() {
  console.log(
    `\n${colors.bright}${colors.blue}Console Logging Analysis Report${colors.reset}`,
  );
  console.log("=".repeat(50));

  // Statistics
  console.log(`\n${colors.bright}Statistics:${colors.reset}`);
  console.log(
    `Total files scanned: ${colors.green}${stats.totalFiles}${colors.reset}`,
  );
  console.log(
    `Files with console statements: ${colors.yellow}${stats.filesWithConsole}${colors.reset}`,
  );
  console.log(
    `Total console statements: ${colors.red}${stats.totalConsoleStatements}${colors.reset}`,
  );

  if (stats.totalConsoleStatements > 0) {
    console.log(`\n${colors.bright}Breakdown by method:${colors.reset}`);
    Object.keys(stats).forEach((key) => {
      if (key.startsWith("console") && stats[key] > 0) {
        const method = key.replace("console", "").toLowerCase();
        console.log(`  ${method}: ${colors.cyan}${stats[key]}${colors.reset}`);
      }
    });
  }

  // Detailed results
  if (results.length > 0) {
    console.log(`\n${colors.bright}Files needing updates:${colors.reset}`);
    console.log("-".repeat(50));

    results.forEach((result) => {
      const alreadyUsingNewLogging = usesNewLogging(
        path.join(process.cwd(), result.file),
      );
      const statusIcon = alreadyUsingNewLogging ? "🔄" : "❌";
      const statusText = alreadyUsingNewLogging
        ? "(Partially migrated)"
        : "(Not migrated)";

      console.log(
        `\n${statusIcon} ${colors.bright}${result.file}${colors.reset} ${colors.yellow}${statusText}${colors.reset}`,
      );
      console.log(
        `   Console statements: ${colors.red}${result.statements.length}${colors.reset}`,
      );

      result.statements.forEach((stmt) => {
        console.log(
          `   ${colors.cyan}Line ${stmt.lineNumber}:${colors.reset} console.${colors.red}${stmt.method}${colors.reset}`,
        );
        console.log(`   ${colors.magenta}${stmt.snippet}${colors.reset}`);

        const suggestion = getMigrationSuggestion(stmt.method, stmt.snippet);
        console.log(
          `   ${colors.green}→ Replace with: ${suggestion.replacement}${colors.reset}`,
        );
        console.log(
          `   ${colors.green}→ Example: ${suggestion.example}${colors.reset}`,
        );
        console.log("");
      });
    });

    // Migration priority
    console.log(`\n${colors.bright}Migration Priority:${colors.reset}`);
    console.log("-".repeat(30));

    const notMigrated = results.filter(
      (r) => !usesNewLogging(path.join(process.cwd(), r.file)),
    );
    const partiallyMigrated = results.filter((r) =>
      usesNewLogging(path.join(process.cwd(), r.file)),
    );

    if (notMigrated.length > 0) {
      console.log(
        `\n${colors.red}High Priority (Not migrated):${colors.reset}`,
      );
      notMigrated
        .sort((a, b) => b.statements.length - a.statements.length)
        .slice(0, 10)
        .forEach((result) => {
          console.log(
            `  • ${result.file} (${result.statements.length} statements)`,
          );
        });
    }

    if (partiallyMigrated.length > 0) {
      console.log(
        `\n${colors.yellow}Medium Priority (Partially migrated):${colors.reset}`,
      );
      partiallyMigrated
        .sort((a, b) => b.statements.length - a.statements.length)
        .slice(0, 10)
        .forEach((result) => {
          console.log(
            `  • ${result.file} (${result.statements.length} statements)`,
          );
        });
    }

    // Quick migration guide
    console.log(`\n${colors.bright}Quick Migration Steps:${colors.reset}`);
    console.log("-".repeat(30));
    console.log("1. Import the logger:");
    console.log(
      `   ${colors.green}import { useLogger } from '@common/utils/logger';${colors.reset}`,
    );
    console.log("2. Initialize in component:");
    console.log(
      `   ${colors.green}const log = useLogger('ComponentName');${colors.reset}`,
    );
    console.log("3. Replace console statements:");
    console.log(
      `   ${colors.red}console.log('message')${colors.reset} → ${colors.green}log.info('message')${colors.reset}`,
    );
    console.log(
      `   ${colors.red}console.error('error', err)${colors.reset} → ${colors.green}log.error('error', {}, err)${colors.reset}`,
    );
    console.log("4. Add context and metadata:");
    console.log(
      `   ${colors.green}log.error('Failed', { action: 'api_call', metadata: { endpoint } }, error)${colors.reset}`,
    );
  } else {
    console.log(
      `\n${colors.green}✅ No console statements found! All logging is properly centralized.${colors.reset}`,
    );
  }

  console.log(
    `\n${colors.bright}For complete migration guide, see: docs/LOGGING.md${colors.reset}\n`,
  );
}

/**
 * Generate a JSON report
 */
function generateJsonReport() {
  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    files: results.map((result) => ({
      ...result,
      usesNewLogging: usesNewLogging(path.join(process.cwd(), result.file)),
    })),
  };

  const reportPath = path.join(__dirname, "../console-log-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `\n${colors.green}JSON report saved to: ${reportPath}${colors.reset}`,
  );
}

/**
 * Main execution
 */
function main() {
  console.log(
    `${colors.bright}Scanning for console statements...${colors.reset}`,
  );

  if (!fs.existsSync(SRC_DIR)) {
    console.error(
      `${colors.red}Error: Source directory not found: ${SRC_DIR}${colors.reset}`,
    );
    process.exit(1);
  }

  const files = getAllFiles(SRC_DIR);
  console.log(
    `Found ${colors.cyan}${files.length}${colors.reset} files to analyze...`,
  );

  files.forEach((file) => {
    try {
      analyzeFile(file);
    } catch (error) {
      console.warn(
        `${colors.yellow}Warning: Could not analyze ${file}: ${error.message}${colors.reset}`,
      );
    }
  });

  printResults();

  // Generate JSON report if requested
  if (process.argv.includes("--json") || process.argv.includes("-j")) {
    generateJsonReport();
  }

  // Exit with error code if console statements found
  if (stats.totalConsoleStatements > 0) {
    process.exit(1);
  }
}

// Run the script
main();

export { analyzeFile, getAllFiles, stats, results };
