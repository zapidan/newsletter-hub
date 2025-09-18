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

function generateSimpleTestTable(testSuites, testCases) {
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests, 0);
    const totalPassed = testSuites.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = testSuites.reduce((sum, suite) => sum + suite.failed, 0);
    const totalSkipped = testSuites.reduce((sum, suite) => sum + suite.skipped, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - Simple Table</title>
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
        .status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 8px;
        }
        .status.success {
            background-color: #dafbe1;
            color: #1a7f37;
        }
        .status.failure {
            background-color: #ffebe9;
            color: #cf222e;
        }
        .stats {
            display: flex;
            gap: 24px;
            margin-bottom: 24px;
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .stat-number {
            font-weight: 600;
            font-size: 16px;
        }
        .stat-label {
            font-size: 14px;
        }
        .passed { color: #1a7f37; }
        .failed { color: #cf222e; }
        .skipped { color: #9a6700; }
        
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
        .test-name {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 13px;
            color: #24292f;
        }
        .test-class {
            font-size: 12px;
            color: #656d76;
            margin-top: 4px;
        }
        .test-status {
            text-align: center;
            font-weight: 500;
        }
        .test-time {
            text-align: center;
            color: #656d76;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        .count {
            font-weight: 500;
            text-align: center;
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
                Test Results - Simple Table
                <span class="status ${totalFailed > 0 ? 'failure' : 'success'}">
                    ${totalFailed > 0 ? '❌ Tests failed' : '✅ All tests passed'}
                </span>
            </h1>
            <p class="summary">
                ${totalTests} tests were completed with ${totalPassed} passed, ${totalFailed} failed and ${totalSkipped} skipped.
            </p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-number passed">${totalPassed}</span>
                <span class="stat-label">Passed</span>
            </div>
            <div class="stat">
                <span class="stat-number failed">${totalFailed}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat">
                <span class="stat-number skipped">${totalSkipped}</span>
                <span class="stat-label">Skipped</span>
            </div>
            <div class="stat">
                <span class="stat-number">${totalTests}</span>
                <span class="stat-label">Total</span>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                ${testCases.map(test => `
                    <tr>
                        <td>
                            <div class="test-name">${test.name}</div>
                        </td>
                        <td>
                            <div class="test-class">${test.classname}</div>
                        </td>
                        <td class="test-status ${test.status}">
                            ${test.status === 'passed' ? '✅ Passed' :
            test.status === 'failed' ? '❌ Failed' :
                test.status === 'error' ? '💥 Error' : '⚪ Skipped'}
                        </td>
                        <td class="test-time">${test.time}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>View detailed test results: <a href="test-results.html">Detailed Report</a></p>
            <p>View coverage report: <a href="../html/index.html">Coverage Report</a></p>
            <p>View full test dashboard: <a href="../test-dashboard/index.html">Test Dashboard</a></p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

function main() {
    const resultsDir = path.join(process.cwd(), 'test-results');
    const outputFile = path.join(process.cwd(), 'test-results', 'simple-test-table.html');

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

    if (!xmlFiles || xmlFiles.length === 0) {
        console.error('❌ No JUnit XML files found in:', resultsDir);
        console.log('Creating empty simple test table...');

        // Create empty test table
        const emptyHtml = generateSimpleTestTable([], []);

        // Ensure directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputFile, emptyHtml);
        console.log('✅ Empty simple test table created');
        return;
    }

    try {
        // Aggregate suites and cases across all XML files
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

        const html = generateSimpleTestTable(allSuites, allCases);

        // Ensure directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputFile, html);

        const totalTests = allSuites.reduce((sum, suite) => sum + suite.tests, 0);
        const totalFailed = allSuites.reduce((sum, suite) => sum + suite.failed, 0);

        console.log('✅ Simple test table generated successfully!');
        console.log(`📦 Parsed ${xmlFiles.length} JUnit file(s)`);
        console.log(`📊 ${totalTests} tests, ${totalFailed} failed`);
        console.log(`📄 Output: ${outputFile}`);

    } catch (error) {
        console.error('❌ Error generating simple test table:', error.message);

        // Create fallback file even on error
        try {
            const fallbackHtml = generateSimpleTestTable([], []);
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            fs.writeFileSync(outputFile, fallbackHtml);
            console.log('✅ Fallback simple test table created');
        } catch (fallbackError) {
            console.error('❌ Failed to create fallback file:', fallbackError.message);
        }
    }
}

main();