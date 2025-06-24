#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function findLatestCoverageFile(coverageDir) {
  const tmpDir = path.join(coverageDir, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    return null;
  }

  const files = fs.readdirSync(tmpDir)
    .filter(file => file.startsWith('coverage-') && file.endsWith('.json'))
    .map(file => {
      const match = file.match(/coverage-(\d+)\.json/);
      return {
        file,
        number: match ? parseInt(match[1]) : 0
      };
    })
    .sort((a, b) => b.number - a.number);

  return files.length > 0 ? path.join(tmpDir, files[0].file) : null;
}

function parseCoverageData(coverageDir) {
  const coverageData = {
    summary: {
      statements: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      lines: { total: 0, covered: 0, pct: 0 }
    },
    files: []
  };

  // Try to read coverage summary
  const summaryFile = path.join(coverageDir, 'coverage-summary.json');
  if (fs.existsSync(summaryFile)) {
    try {
      const summaryContent = fs.readFileSync(summaryFile, 'utf8');
      const summary = JSON.parse(summaryContent);

      if (summary.total) {
        coverageData.summary = summary.total;
      }

      // Parse individual file coverage
      Object.entries(summary).forEach(([filePath, data]) => {
        if (filePath !== 'total' && typeof data === 'object') {
          coverageData.files.push({
            path: filePath,
            ...data
          });
        }
      });
    } catch (error) {
      console.error('Error parsing coverage summary:', error.message);
    }
  }

  // Try to read detailed coverage data
  const detailedFile = path.join(coverageDir, 'coverage-final.json');
  if (fs.existsSync(detailedFile)) {
    try {
      const detailedContent = fs.readFileSync(detailedFile, 'utf8');
      const detailed = JSON.parse(detailedContent);

      // Process detailed coverage data
      Object.entries(detailed).forEach(([filePath, fileData]) => {
        if (fileData && typeof fileData === 'object') {
          const fileCoverage = {
            path: filePath,
            statements: { total: 0, covered: 0, pct: 0 },
            branches: { total: 0, covered: 0, pct: 0 },
            functions: { total: 0, covered: 0, pct: 0 },
            lines: { total: 0, covered: 0, pct: 0 }
          };

          // Calculate coverage metrics
          if (fileData.s) {
            const statements = Object.values(fileData.s);
            fileCoverage.statements.total = statements.length;
            fileCoverage.statements.covered = statements.filter(s => s > 0).length;
            fileCoverage.statements.pct = fileCoverage.statements.total > 0
              ? (fileCoverage.statements.covered / fileCoverage.statements.total) * 100
              : 0;
          }

          if (fileData.b) {
            const branches = Object.values(fileData.b);
            fileCoverage.branches.total = branches.reduce((sum, branch) => sum + branch.length, 0);
            fileCoverage.branches.covered = branches.reduce((sum, branch) =>
              sum + branch.filter(b => b > 0).length, 0);
            fileCoverage.branches.pct = fileCoverage.branches.total > 0
              ? (fileCoverage.branches.covered / fileCoverage.branches.total) * 100
              : 0;
          }

          if (fileData.f) {
            const functions = Object.values(fileData.f);
            fileCoverage.functions.total = functions.length;
            fileCoverage.functions.covered = functions.filter(f => f > 0).length;
            fileCoverage.functions.pct = fileCoverage.functions.total > 0
              ? (fileCoverage.functions.covered / fileCoverage.functions.total) * 100
              : 0;
          }

          if (fileData.l) {
            const lines = Object.values(fileData.l);
            fileCoverage.lines.total = lines.length;
            fileCoverage.lines.covered = lines.filter(l => l > 0).length;
            fileCoverage.lines.pct = fileCoverage.lines.total > 0
              ? (fileCoverage.lines.covered / fileCoverage.lines.total) * 100
              : 0;
          }

          // Update or add to files array
          const existingIndex = coverageData.files.findIndex(f => f.path === filePath);
          if (existingIndex >= 0) {
            coverageData.files[existingIndex] = { ...coverageData.files[existingIndex], ...fileCoverage };
          } else {
            coverageData.files.push(fileCoverage);
          }
        }
      });
    } catch (error) {
      console.error('Error parsing detailed coverage:', error.message);
    }
  }

  return coverageData;
}

function generateCoverageReport(coverageData) {
  const { summary, files } = coverageData;

  const getStatusColor = (pct) => {
    if (pct >= 80) return '#1a7f37';
    if (pct >= 60) return '#9a6700';
    return '#cf222e';
  };

  const getStatusIcon = (pct) => {
    if (pct >= 80) return '✅';
    if (pct >= 60) return '⚠️';
    return '❌';
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Newsletter Hub</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #24292f;
            background-color: #ffffff;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
        }
        .summary {
            font-size: 14px;
            color: #656d76;
            margin: 0;
        }
        .overall-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 8px;
        }
        .overall-status.good {
            background-color: #dafbe1;
            color: #1a7f37;
        }
        .overall-status.warning {
            background-color: #fff8c5;
            color: #9a6700;
        }
        .overall-status.poor {
            background-color: #ffebe9;
            color: #cf222e;
        }
        
        .coverage-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .coverage-card {
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 16px;
            text-align: center;
        }
        .coverage-metric {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .coverage-label {
            font-size: 14px;
            color: #656d76;
            margin-bottom: 8px;
        }
        .coverage-bar {
            width: 100%;
            height: 8px;
            background-color: #f6f8fa;
            border-radius: 4px;
            overflow: hidden;
        }
        .coverage-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .section {
            margin-bottom: 32px;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d0d7de;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 16px;
        }
        th {
            background-color: #f6f8fa;
            border-bottom: 1px solid #d0d7de;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            color: #24292f;
        }
        td {
            padding: 12px 16px;
            border-bottom: 1px solid #d0d7de;
            font-size: 14px;
            vertical-align: top;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background-color: #f6f8fa;
        }
        .file-path {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 13px;
            color: #24292f;
        }
        .coverage-pct {
            text-align: center;
            font-weight: 500;
        }
        .coverage-bar-small {
            width: 60px;
            height: 6px;
            background-color: #f6f8fa;
            border-radius: 3px;
            overflow: hidden;
            margin: 0 auto;
        }
        .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #d0d7de;
            font-size: 12px;
            color: #656d76;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">
                Coverage Report
                <span class="overall-status ${summary.statements.pct >= 80 ? 'good' : summary.statements.pct >= 60 ? 'warning' : 'poor'}">
                    ${summary.statements.pct >= 80 ? '✅ Good Coverage' : summary.statements.pct >= 60 ? '⚠️ Needs Improvement' : '❌ Poor Coverage'}
                </span>
            </h1>
            <p class="summary">
                Overall coverage: ${summary.statements.pct.toFixed(1)}% statements, ${summary.branches.pct.toFixed(1)}% branches, ${summary.functions.pct.toFixed(1)}% functions, ${summary.lines.pct.toFixed(1)}% lines
            </p>
        </div>
        
        <div class="coverage-summary">
            <div class="coverage-card">
                <div class="coverage-metric" style="color: ${getStatusColor(summary.statements.pct)}">
                    ${summary.statements.pct.toFixed(1)}%
                </div>
                <div class="coverage-label">Statements</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${summary.statements.pct}%; background-color: ${getStatusColor(summary.statements.pct)};"></div>
                </div>
                <div style="font-size: 12px; color: #656d76; margin-top: 4px;">
                    ${summary.statements.covered}/${summary.statements.total}
                </div>
            </div>
            
            <div class="coverage-card">
                <div class="coverage-metric" style="color: ${getStatusColor(summary.branches.pct)}">
                    ${summary.branches.pct.toFixed(1)}%
                </div>
                <div class="coverage-label">Branches</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${summary.branches.pct}%; background-color: ${getStatusColor(summary.branches.pct)};"></div>
                </div>
                <div style="font-size: 12px; color: #656d76; margin-top: 4px;">
                    ${summary.branches.covered}/${summary.branches.total}
                </div>
            </div>
            
            <div class="coverage-card">
                <div class="coverage-metric" style="color: ${getStatusColor(summary.functions.pct)}">
                    ${summary.functions.pct.toFixed(1)}%
                </div>
                <div class="coverage-label">Functions</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${summary.functions.pct}%; background-color: ${getStatusColor(summary.functions.pct)};"></div>
                </div>
                <div style="font-size: 12px; color: #656d76; margin-top: 4px;">
                    ${summary.functions.covered}/${summary.functions.total}
                </div>
            </div>
            
            <div class="coverage-card">
                <div class="coverage-metric" style="color: ${getStatusColor(summary.lines.pct)}">
                    ${summary.lines.pct.toFixed(1)}%
                </div>
                <div class="coverage-label">Lines</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${summary.lines.pct}%; background-color: ${getStatusColor(summary.lines.pct)};"></div>
                </div>
                <div style="font-size: 12px; color: #656d76; margin-top: 4px;">
                    ${summary.lines.covered}/${summary.lines.total}
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">File Coverage Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>File</th>
                        <th style="text-align: center;">Statements</th>
                        <th style="text-align: center;">Branches</th>
                        <th style="text-align: center;">Functions</th>
                        <th style="text-align: center;">Lines</th>
                    </tr>
                </thead>
                <tbody>
                    ${files.map(file => `
                        <tr>
                            <td>
                                <div class="file-path">${file.path}</div>
                            </td>
                            <td class="coverage-pct">
                                ${getStatusIcon(file.statements.pct)} ${file.statements.pct.toFixed(1)}%
                                <div class="coverage-bar-small">
                                    <div class="coverage-fill" style="width: ${file.statements.pct}%; background-color: ${getStatusColor(file.statements.pct)};"></div>
                                </div>
                            </td>
                            <td class="coverage-pct">
                                ${getStatusIcon(file.branches.pct)} ${file.branches.pct.toFixed(1)}%
                                <div class="coverage-bar-small">
                                    <div class="coverage-fill" style="width: ${file.branches.pct}%; background-color: ${getStatusColor(file.branches.pct)};"></div>
                                </div>
                            </td>
                            <td class="coverage-pct">
                                ${getStatusIcon(file.functions.pct)} ${file.functions.pct.toFixed(1)}%
                                <div class="coverage-bar-small">
                                    <div class="coverage-fill" style="width: ${file.functions.pct}%; background-color: ${getStatusColor(file.functions.pct)};"></div>
                                </div>
                            </td>
                            <td class="coverage-pct">
                                ${getStatusIcon(file.lines.pct)} ${file.lines.pct.toFixed(1)}%
                                <div class="coverage-bar-small">
                                    <div class="coverage-fill" style="width: ${file.lines.pct}%; background-color: ${getStatusColor(file.lines.pct)};"></div>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>View test results: <a href="../test-results/test-results.html">Test Results</a></p>
            <p>View full test dashboard: <a href="../test-dashboard/index.html">Test Dashboard</a></p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

function main() {
  const coverageDir = path.join(process.cwd(), 'html');
  const outputFile = path.join(process.cwd(), 'html', 'coverage-report.html');

  if (!fs.existsSync(coverageDir)) {
    console.error('❌ Coverage directory not found:', coverageDir);
    console.log('Creating empty coverage report...');

    // Create empty coverage report
    const emptyData = {
      summary: {
        statements: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        lines: { total: 0, covered: 0, pct: 0 }
      },
      files: []
    };

    const emptyHtml = generateCoverageReport(emptyData);

    // Ensure directory exists
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, emptyHtml);
    console.log('✅ Empty coverage report created');
    return;
  }

  try {
    const coverageData = parseCoverageData(coverageDir);
    const html = generateCoverageReport(coverageData);

    fs.writeFileSync(outputFile, html);

    console.log('✅ Coverage report generated successfully!');
    console.log(`📊 Overall coverage: ${coverageData.summary.statements.pct.toFixed(1)}% statements`);
    console.log(`📄 Output: ${outputFile}`);

  } catch (error) {
    console.error('❌ Error generating coverage report:', error.message);

    // Create fallback file even on error
    try {
      const fallbackData = {
        summary: {
          statements: { total: 0, covered: 0, pct: 0 },
          branches: { total: 0, covered: 0, pct: 0 },
          functions: { total: 0, covered: 0, pct: 0 },
          lines: { total: 0, covered: 0, pct: 0 }
        },
        files: []
      };

      const fallbackHtml = generateCoverageReport(fallbackData);
      fs.writeFileSync(outputFile, fallbackHtml);
      console.log('✅ Fallback coverage report created');
    } catch (fallbackError) {
      console.error('❌ Failed to create fallback file:', fallbackError.message);
    }
  }
}

main();
