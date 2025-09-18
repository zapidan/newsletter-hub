#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseJUnitXML(xmlContent) {
    const testSuites = [];
    const testCases = [];

    // Parse testsuites
    const testsuiteMatches = xmlContent.match(/<testsuite[^>]*>/g);
    if (testsuiteMatches) {
        testsuiteMatches.forEach(match => {
            const nameMatch = match.match(/name="([^"]*)"/);
            const testsMatch = match.match(/tests="(\d+)"/);
            const failuresMatch = match.match(/failures="(\d+)"/);
            const errorsMatch = match.match(/errors="(\d+)"/);
            const skippedMatch = match.match(/skipped="(\d+)"/);
            const timeMatch = match.match(/time="([^"]*)"/);

            if (nameMatch) {
                const name = nameMatch[1];
                const tests = parseInt(testsMatch?.[1] || '0');
                const failures = parseInt(failuresMatch?.[1] || '0');
                const errors = parseInt(errorsMatch?.[1] || '0');
                const skipped = parseInt(skippedMatch?.[1] || '0');
                const time = parseFloat(timeMatch?.[1] || '0');
                const passed = tests - failures - errors - skipped;

                testSuites.push({
                    name,
                    tests,
                    passed,
                    failed: failures + errors,
                    skipped,
                    time: time.toFixed(0) + 'ms'
                });
            }
        });
    }

    // Parse test cases
    const testcaseMatches = xmlContent.match(/<testcase[^>]*>[\s\S]*?<\/testcase>/g);
    if (testcaseMatches) {
        testcaseMatches.forEach(match => {
            const nameMatch = match.match(/name="([^"]*)"/);
            const classnameMatch = match.match(/classname="([^"]*)"/);
            const timeMatch = match.match(/time="([^"]*)"/);
            const failureMatch = match.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
            const errorMatch = match.match(/<error[^>]*>([\s\S]*?)<\/error>/);
            const skippedMatch = match.match(/<skipped[^>]*>/);

            if (nameMatch) {
                const name = nameMatch[1];
                const classname = classnameMatch?.[1] || 'Unknown';
                const time = parseFloat(timeMatch?.[1] || '0');
                const status = failureMatch ? 'failed' : errorMatch ? 'error' : skippedMatch ? 'skipped' : 'passed';
                const message = failureMatch?.[1] || errorMatch?.[1] || '';

                testCases.push({
                    name,
                    classname,
                    status,
                    time: time.toFixed(0) + 'ms',
                    message: message.trim()
                });
            }
        });
    }

    return { testSuites, testCases };
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

    return coverageData;
}

function generateTestDashboard(testData, coverageData) {
    const { testSuites, testCases } = testData;
    const { summary: coverageSummary, files: coverageFiles } = coverageData;

    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests, 0);
    const totalPassed = testSuites.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = testSuites.reduce((sum, suite) => sum + suite.failed, 0);
    const totalSkipped = testSuites.reduce((sum, suite) => sum + suite.skipped, 0);

    const failedTests = testCases.filter(test => test.status === 'failed' || test.status === 'error');
    const skippedTests = testCases.filter(test => test.status === 'skipped');

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
    <title>Test Dashboard - Newsletter Hub</title>
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
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .title {
            font-size: 28px;
            font-weight: 600;
            margin: 0 0 8px 0;
        }
        .subtitle {
            font-size: 16px;
            color: #656d76;
            margin: 0;
        }
        .overall-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            margin-left: 12px;
        }
        .overall-status.success {
            background-color: #dafbe1;
            color: #1a7f37;
        }
        .overall-status.failure {
            background-color: #ffebe9;
            color: #cf222e;
        }
        .overall-status.warning {
            background-color: #fff8c5;
            color: #9a6700;
        }
        
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
        }
        
        .card {
            border: 1px solid #d0d7de;
            border-radius: 8px;
            padding: 20px;
            background-color: #ffffff;
        }
        .card-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d0d7de;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }
        .stat {
            text-align: center;
            padding: 12px;
            border-radius: 6px;
            background-color: #f6f8fa;
        }
        .stat-number {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .stat-label {
            font-size: 12px;
            color: #656d76;
        }
        .passed { color: #1a7f37; }
        .failed { color: #cf222e; }
        .skipped { color: #9a6700; }
        .total { color: #24292f; }
        
        .coverage-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }
        .coverage-card {
            text-align: center;
            padding: 16px;
            border-radius: 6px;
            background-color: #f6f8fa;
        }
        .coverage-metric {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .coverage-label {
            font-size: 12px;
            color: #656d76;
            margin-bottom: 8px;
        }
        .coverage-bar {
            width: 100%;
            height: 6px;
            background-color: #e1e4e8;
            border-radius: 3px;
            overflow: hidden;
        }
        .coverage-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .test-suites {
            margin-bottom: 20px;
        }
        .suite-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f6f8fa;
        }
        .suite-item:last-child {
            border-bottom: none;
        }
        .suite-name {
            font-weight: 500;
            font-size: 14px;
        }
        .suite-stats {
            display: flex;
            gap: 12px;
            font-size: 12px;
        }
        .suite-stat {
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
        }
        .suite-passed { background-color: #dafbe1; color: #1a7f37; }
        .suite-failed { background-color: #ffebe9; color: #cf222e; }
        .suite-skipped { background-color: #fff8c5; color: #9a6700; }
        
        .failed-tests {
            margin-top: 16px;
        }
        .failed-test {
            padding: 8px 12px;
            margin-bottom: 8px;
            border-radius: 4px;
            background-color: #ffebe9;
            border-left: 4px solid #cf222e;
        }
        .failed-test-name {
            font-weight: 500;
            font-size: 13px;
            color: #cf222e;
            margin-bottom: 4px;
        }
        .failed-test-class {
            font-size: 11px;
            color: #656d76;
        }
        
        .links-section {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #d0d7de;
        }
        .links-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }
        .link-card {
            display: block;
            padding: 12px 16px;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            text-decoration: none;
            color: #24292f;
            background-color: #f6f8fa;
            transition: all 0.2s ease;
        }
        .link-card:hover {
            background-color: #f3f4f6;
            border-color: #0969da;
            color: #0969da;
        }
        .link-title {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .link-desc {
            font-size: 12px;
            color: #656d76;
        }
        
        .footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #d0d7de;
            font-size: 12px;
            color: #656d76;
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .coverage-summary {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">
                Test Dashboard
                <span class="overall-status ${totalFailed > 0 ? 'failure' : totalSkipped > 0 ? 'warning' : 'success'}">
                    ${totalFailed > 0 ? '❌ Tests Failed' : totalSkipped > 0 ? '⚠️ Some Tests Skipped' : '✅ All Tests Passed'}
                </span>
            </h1>
            <p class="subtitle">
                Comprehensive test results and coverage report for Newsletter Hub
            </p>
        </div>
        
        <div class="dashboard-grid">
            <div class="card">
                <h2 class="card-title">Test Results</h2>
                <div class="stats-grid">
                    <div class="stat">
                        <div class="stat-number total">${totalTests}</div>
                        <div class="stat-label">Total Tests</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number passed">${totalPassed}</div>
                        <div class="stat-label">Passed</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number failed">${totalFailed}</div>
                        <div class="stat-label">Failed</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number skipped">${totalSkipped}</div>
                        <div class="stat-label">Skipped</div>
                    </div>
                </div>
                
                <div class="test-suites">
                    <h3 style="font-size: 14px; margin-bottom: 12px; color: #656d76;">Test Suites</h3>
                    ${testSuites.map(suite => `
                        <div class="suite-item">
                            <div class="suite-name">${suite.name}</div>
                            <div class="suite-stats">
                                <span class="suite-stat suite-passed">${suite.passed} passed</span>
                                ${suite.failed > 0 ? `<span class="suite-stat suite-failed">${suite.failed} failed</span>` : ''}
                                ${suite.skipped > 0 ? `<span class="suite-stat suite-skipped">${suite.skipped} skipped</span>` : ''}
                                <span style="color: #656d76;">${suite.time}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${failedTests.length > 0 ? `
                <div class="failed-tests">
                    <h3 style="font-size: 14px; margin-bottom: 12px; color: #cf222e;">Failed Tests (${failedTests.length})</h3>
                    ${failedTests.slice(0, 5).map(test => `
                        <div class="failed-test">
                            <div class="failed-test-name">${test.name}</div>
                            <div class="failed-test-class">${test.classname}</div>
                        </div>
                    `).join('')}
                    ${failedTests.length > 5 ? `<div style="font-size: 12px; color: #656d76; text-align: center; margin-top: 8px;">... and ${failedTests.length - 5} more</div>` : ''}
                </div>
                ` : ''}
            </div>
            
            <div class="card">
                <h2 class="card-title">Coverage Report</h2>
                <div class="coverage-summary">
                    <div class="coverage-card">
                        <div class="coverage-metric" style="color: ${getStatusColor(coverageSummary.statements.pct)}">
                            ${coverageSummary.statements.pct.toFixed(1)}%
                        </div>
                        <div class="coverage-label">Statements</div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${coverageSummary.statements.pct}%; background-color: ${getStatusColor(coverageSummary.statements.pct)};"></div>
                        </div>
                        <div style="font-size: 11px; color: #656d76; margin-top: 4px;">
                            ${coverageSummary.statements.covered}/${coverageSummary.statements.total}
                        </div>
                    </div>
                    
                    <div class="coverage-card">
                        <div class="coverage-metric" style="color: ${getStatusColor(coverageSummary.branches.pct)}">
                            ${coverageSummary.branches.pct.toFixed(1)}%
                        </div>
                        <div class="coverage-label">Branches</div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${coverageSummary.branches.pct}%; background-color: ${getStatusColor(coverageSummary.branches.pct)};"></div>
                        </div>
                        <div style="font-size: 11px; color: #656d76; margin-top: 4px;">
                            ${coverageSummary.branches.covered}/${coverageSummary.branches.total}
                        </div>
                    </div>
                    
                    <div class="coverage-card">
                        <div class="coverage-metric" style="color: ${getStatusColor(coverageSummary.functions.pct)}">
                            ${coverageSummary.functions.pct.toFixed(1)}%
                        </div>
                        <div class="coverage-label">Functions</div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${coverageSummary.functions.pct}%; background-color: ${getStatusColor(coverageSummary.functions.pct)};"></div>
                        </div>
                        <div style="font-size: 11px; color: #656d76; margin-top: 4px;">
                            ${coverageSummary.functions.covered}/${coverageSummary.functions.total}
                        </div>
                    </div>
                    
                    <div class="coverage-card">
                        <div class="coverage-metric" style="color: ${getStatusColor(coverageSummary.lines.pct)}">
                            ${coverageSummary.lines.pct.toFixed(1)}%
                        </div>
                        <div class="coverage-label">Lines</div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${coverageSummary.lines.pct}%; background-color: ${getStatusColor(coverageSummary.lines.pct)};"></div>
                        </div>
                        <div style="font-size: 11px; color: #656d76; margin-top: 4px;">
                            ${coverageSummary.lines.covered}/${coverageSummary.lines.total}
                        </div>
                    </div>
                </div>
                
                <div style="font-size: 12px; color: #656d76; text-align: center; margin-top: 16px;">
                    ${coverageFiles.length} files analyzed
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2 class="card-title">Quick Links</h2>
            <div class="links-section">
                <div class="links-grid">
                    <a href="test-results/test-results.html" class="link-card">
                        <div class="link-title">📋 Detailed Test Results</div>
                        <div class="link-desc">View comprehensive test results with error details</div>
                    </a>
                    <a href="test-results/" class="link-card">
                        <div class="link-title">📊 Simple Test Table</div>
                        <div class="link-desc">Quick overview of all test cases</div>
                    </a>
                    <a href="html/" class="link-card">
                        <div class="link-title">📈 Coverage Report</div>
                        <div class="link-desc">Detailed code coverage analysis</div>
                    </a>
                    <a href="html/coverage-report.html" class="link-card">
                        <div class="link-title">📊 Coverage Dashboard</div>
                        <div class="link-desc">Coverage metrics and file breakdown</div>
                    </a>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Test Dashboard for Newsletter Hub - Comprehensive testing and coverage analysis</p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

function main() {
    const resultsDir = path.join(process.cwd(), 'test-results');
    const coverageDir = path.join(process.cwd(), 'html');
    const outputFile = path.join(process.cwd(), 'test-dashboard', 'index.html');

    // Parse test data
    let testData = { testSuites: [], testCases: [] };

    // Discover all junit XML files under test-results/*.xml
    let xmlFiles = [];
    if (fs.existsSync(resultsDir)) {
        try {
            const entries = fs.readdirSync(resultsDir, { withFileTypes: true });
            xmlFiles = entries
                .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.xml'))
                .map((e) => path.join(resultsDir, e.name));
        } catch (err) {
            console.error('❌ Failed to read test-results directory:', err.message);
        }
    }

    if (xmlFiles.length > 0) {
        const allSuites = [];
        const allCases = [];
        xmlFiles.forEach((filePath) => {
            try {
                const xmlContent = fs.readFileSync(filePath, 'utf8');
                const { testSuites, testCases } = parseJUnitXML(xmlContent);
                allSuites.push(...testSuites);
                allCases.push(...testCases);
            } catch (fileErr) {
                console.error(`⚠️ Failed to parse JUnit XML: ${filePath}:`, fileErr.message);
            }
        });
        testData = { testSuites: allSuites, testCases: allCases };
        console.log(`📦 Parsed ${xmlFiles.length} JUnit file(s) for dashboard`);
    } else {
        console.log('No JUnit XML files found, using empty test data');
    }

    // Parse coverage data
    let coverageData = {
        summary: {
            statements: { total: 0, covered: 0, pct: 0 },
            branches: { total: 0, covered: 0, pct: 0 },
            functions: { total: 0, covered: 0, pct: 0 },
            lines: { total: 0, covered: 0, pct: 0 }
        },
        files: []
    };

    if (fs.existsSync(coverageDir)) {
        try {
            coverageData = parseCoverageData(coverageDir);
        } catch (error) {
            console.error('Error parsing coverage data:', error.message);
        }
    } else {
        console.log('No coverage directory found, using empty coverage data');
    }

    try {
        const html = generateTestDashboard(testData, coverageData);

        // Ensure directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputFile, html);

        const totalTests = testData.testSuites.reduce((sum, suite) => sum + suite.tests, 0);
        const totalFailed = testData.testSuites.reduce((sum, suite) => sum + suite.failed, 0);

        console.log('✅ Test dashboard generated successfully!');
        console.log(`📊 ${totalTests} tests, ${totalFailed} failed`);
        console.log(`📈 Coverage: ${coverageData.summary.statements.pct.toFixed(1)}% statements`);
        console.log(`📄 Output: ${outputFile}`);

    } catch (error) {
        console.error('❌ Error generating test dashboard:', error.message);

        // Create fallback file even on error
        try {
            const fallbackHtml = generateTestDashboard(
                { testSuites: [], testCases: [] },
                {
                    summary: {
                        statements: { total: 0, covered: 0, pct: 0 },
                        branches: { total: 0, covered: 0, pct: 0 },
                        functions: { total: 0, covered: 0, pct: 0 },
                        lines: { total: 0, covered: 0, pct: 0 }
                    },
                    files: []
                }
            );

            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputFile, fallbackHtml);
            console.log('✅ Fallback test dashboard created');
        } catch (fallbackError) {
            console.error('❌ Failed to create fallback file:', fallbackError.message);
        }
    }
}

main();
