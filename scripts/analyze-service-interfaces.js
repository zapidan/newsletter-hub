#!/usr/bin/env node

/**
 * Service Interface Analysis Script
 *
 * This script analyzes the actual service interfaces in the codebase
 * to help align test files with real implementations.
 */

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '..', 'src', 'common', 'services');
const APIS_DIR = path.join(__dirname, '..', 'src', 'common', 'api');

/**
 * Extract method signatures from TypeScript service files
 */
function extractMethods(content, filename) {
  const methods = [];

  // Match async method declarations
  const asyncMethodRegex = /async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>/g;
  let match;

  while ((match = asyncMethodRegex.exec(content)) !== null) {
    methods.push({
      name: match[1],
      signature: match[0],
      type: 'async'
    });
  }

  // Match regular method declarations
  const methodRegex = /(?:public\s+|private\s+)?(\w+)\s*\([^)]*\)\s*:\s*[^{;]+/g;

  while ((match = methodRegex.exec(content)) !== null) {
    if (!match[1].includes('async') && !methods.find(m => m.name === match[1])) {
      methods.push({
        name: match[1],
        signature: match[0],
        type: 'sync'
      });
    }
  }

  return methods;
}

/**
 * Extract interface definitions
 */
function extractInterfaces(content) {
  const interfaces = [];
  const interfaceRegex = /interface\s+(\w+)\s*{([^}]*)}/gs;
  let match;

  while ((match = interfaceRegex.exec(content)) !== null) {
    interfaces.push({
      name: match[1],
      properties: match[2].trim().split('\n').map(line => line.trim()).filter(line => line)
    });
  }

  return interfaces;
}

/**
 * Analyze a single service file
 */
function analyzeServiceFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);

    return {
      filename,
      path: filePath,
      methods: extractMethods(content, filename),
      interfaces: extractInterfaces(content),
      hasExport: content.includes('export class'),
      hasSingleton: content.includes('export const')
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Find all service files recursively
 */
function findServiceFiles(dir) {
  const files = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && !item.includes('__tests__')) {
        files.push(...findServiceFiles(fullPath));
      } else if (item.endsWith('Service.ts') && !item.includes('.test.')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Find all API files
 */
function findApiFiles(dir) {
  const files = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (!stat.isDirectory() && item.endsWith('Api.ts') && !item.includes('.test.')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Generate interface comparison report
 */
function generateReport(serviceAnalysis, apiAnalysis) {
  console.log('='.repeat(80));
  console.log('🔍 SERVICE INTERFACE ANALYSIS REPORT');
  console.log('='.repeat(80));
  console.log();

  // Services Summary
  console.log('📋 SERVICES FOUND:');
  console.log('-'.repeat(40));

  serviceAnalysis.forEach(service => {
    if (service) {
      console.log(`\n🔧 ${service.filename}`);
      console.log(`   Path: ${service.path.replace(process.cwd(), '.')}`);
      console.log(`   Methods: ${service.methods.length}`);
      console.log(`   Interfaces: ${service.interfaces.length}`);
      console.log(`   Has Export: ${service.hasExport ? '✅' : '❌'}`);
      console.log(`   Has Singleton: ${service.hasSingleton ? '✅' : '❌'}`);

      if (service.methods.length > 0) {
        console.log('   📝 Methods:');
        service.methods.forEach(method => {
          console.log(`     - ${method.name} (${method.type})`);
        });
      }

      if (service.interfaces.length > 0) {
        console.log('   🔗 Interfaces:');
        service.interfaces.forEach(iface => {
          console.log(`     - ${iface.name}`);
        });
      }
    }
  });

  // APIs Summary
  console.log('\n\n📋 APIS FOUND:');
  console.log('-'.repeat(40));

  apiAnalysis.forEach(api => {
    if (api) {
      console.log(`\n⚙️ ${api.filename}`);
      console.log(`   Path: ${api.path.replace(process.cwd(), '.')}`);
      console.log(`   Methods: ${api.methods.length}`);

      if (api.methods.length > 0) {
        console.log('   📝 Methods:');
        api.methods.forEach(method => {
          console.log(`     - ${method.name} (${method.type})`);
        });
      }
    }
  });

  // Test Alignment Recommendations
  console.log('\n\n🎯 TEST ALIGNMENT RECOMMENDATIONS:');
  console.log('-'.repeat(50));

  const testFiles = [
    'ReadingQueueService.test.ts',
    'TagService.test.ts',
    'UserService.test.ts',
    'NewsletterSourceService.test.ts',
    'NewsletterSourceGroupService.test.ts'
  ];

  testFiles.forEach(testFile => {
    const serviceName = testFile.replace('.test.ts', '');
    const correspondingService = serviceAnalysis.find(s =>
      s && s.filename.includes(serviceName)
    );

    if (correspondingService) {
      console.log(`\n✅ ${testFile}`);
      console.log(`   → Update to match ${correspondingService.filename}`);
      console.log(`   → Available methods: ${correspondingService.methods.map(m => m.name).join(', ')}`);
    } else {
      console.log(`\n❌ ${testFile}`);
      console.log(`   → No corresponding service found`);
      console.log(`   → Consider creating service or updating test expectations`);
    }
  });

  // Missing Services Report
  console.log('\n\n⚠️ MISSING SERVICES:');
  console.log('-'.repeat(30));

  const expectedServices = [
    'NewsletterSourceService',
    'NewsletterSourceGroupService',
    'UserService',
    'ReadingQueueService',
    'TagService',
    'NewsletterService'
  ];

  expectedServices.forEach(expected => {
    const found = serviceAnalysis.find(s =>
      s && s.filename.includes(expected)
    );

    if (!found) {
      console.log(`❌ ${expected} - NOT FOUND`);
    } else {
      console.log(`✅ ${expected} - FOUND`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total Services Analyzed: ${serviceAnalysis.filter(s => s).length}`);
  console.log(`Total APIs Analyzed: ${apiAnalysis.filter(a => a).length}`);
  console.log(`Total Methods Found: ${serviceAnalysis.reduce((acc, s) => acc + (s ? s.methods.length : 0), 0)}`);
  console.log(`Total Interfaces Found: ${serviceAnalysis.reduce((acc, s) => acc + (s ? s.interfaces.length : 0), 0)}`);
}

/**
 * Generate detailed interface JSON for programmatic use
 */
function generateInterfaceJson(serviceAnalysis, apiAnalysis) {
  const output = {
    timestamp: new Date().toISOString(),
    services: serviceAnalysis.filter(s => s).map(service => ({
      name: service.filename.replace('.ts', ''),
      path: service.path.replace(process.cwd(), '.'),
      methods: service.methods,
      interfaces: service.interfaces,
      hasExport: service.hasExport,
      hasSingleton: service.hasSingleton
    })),
    apis: apiAnalysis.filter(a => a).map(api => ({
      name: api.filename.replace('.ts', ''),
      path: api.path.replace(process.cwd(), '.'),
      methods: api.methods,
      interfaces: api.interfaces
    }))
  };

  const outputPath = path.join(__dirname, '..', 'interface-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Detailed analysis saved to: ${outputPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting service interface analysis...\n');

  // Find and analyze service files
  const serviceFiles = findServiceFiles(SERVICES_DIR);
  const serviceAnalysis = serviceFiles.map(analyzeServiceFile);

  // Find and analyze API files
  const apiFiles = findApiFiles(APIS_DIR);
  const apiAnalysis = apiFiles.map(analyzeServiceFile);

  // Generate reports
  generateReport(serviceAnalysis, apiAnalysis);
  generateInterfaceJson(serviceAnalysis, apiAnalysis);

  console.log('\n✨ Analysis complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review the interface mismatches above');
  console.log('   2. Update test files to match actual service interfaces');
  console.log('   3. Create missing services if needed');
  console.log('   4. Run tests to verify alignment');
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = {
  extractMethods,
  extractInterfaces,
  analyzeServiceFile,
  findServiceFiles,
  findApiFiles
};
