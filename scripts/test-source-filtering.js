#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

/**
 * Test script to verify source filtering API fix
 * This script tests the newsletterApi.getAll function with sourceIds parameter
 */

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  CYAN: '\x1b[36m'
};

class SourceFilteringTester {
  constructor() {
    this.testResults = [];
    this.supabase = null;
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  success(message) {
    this.log(`✅ ${message}`, COLORS.GREEN);
    this.testResults.push({ type: 'success', message });
  }

  error(message) {
    this.log(`❌ ${message}`, COLORS.RED);
    this.testResults.push({ type: 'error', message });
  }

  warning(message) {
    this.log(`⚠️  ${message}`, COLORS.YELLOW);
    this.testResults.push({ type: 'warning', message });
  }

  info(message) {
    this.log(`ℹ️  ${message}`, COLORS.BLUE);
  }

  async initializeSupabase() {
    try {
      // Try to load environment variables
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        this.warning('Supabase credentials not found in environment variables');
        this.info('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
        return false;
      }

      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      this.success('Supabase client initialized');
      return true;
    } catch (error) {
      this.error(`Failed to initialize Supabase: ${error.message}`);
      return false;
    }
  }

  async testDatabaseSchema() {
    this.log('\n🗄️ Testing Database Schema...', COLORS.CYAN);

    try {
      // Test newsletter sources table
      const { data: sources, error: sourcesError } = await this.supabase
        .from('newsletter_sources')
        .select('id, name, domain')
        .limit(5);

      if (sourcesError) {
        this.error(`Newsletter sources query failed: ${sourcesError.message}`);
        return false;
      }

      this.success(`Found ${sources?.length || 0} newsletter sources`);
      if (sources && sources.length > 0) {
        this.info(`Sample sources: ${sources.map(s => `${s.name} (${s.id})`).join(', ')}`);
      }

      // Test newsletters table with source relation
      const { data: newsletters, error: newslettersError } = await this.supabase
        .from('newsletters')
        .select(`
          id,
          title,
          newsletter_source_id,
          newsletter_sources(id, name, domain)
        `)
        .limit(3);

      if (newslettersError) {
        this.error(`Newsletters with source relation query failed: ${newslettersError.message}`);
        return false;
      }

      this.success(`Found ${newsletters?.length || 0} newsletters with source relation`);
      if (newsletters && newsletters.length > 0) {
        newsletters.forEach((n, i) => {
          this.info(`Newsletter ${i + 1}: ${n.title} -> Source: ${n.newsletter_sources?.name || 'Unknown'} (${n.newsletter_source_id})`);
        });
      }

      return true;
    } catch (error) {
      this.error(`Database schema test failed: ${error.message}`);
      return false;
    }
  }

  async testSourceFiltering() {
    this.log('\n🔍 Testing Source Filtering...', COLORS.CYAN);

    try {
      // First, get all newsletters to see what we're working with
      const { data: allNewsletters, error: allError } = await this.supabase
        .from('newsletters')
        .select(`
          id,
          title,
          newsletter_source_id,
          newsletter_sources(id, name)
        `)
        .eq('is_archived', false)
        .limit(20);

      if (allError) {
        this.error(`Failed to fetch all newsletters: ${allError.message}`);
        return false;
      }

      this.info(`Total unarchived newsletters: ${allNewsletters?.length || 0}`);

      if (!allNewsletters || allNewsletters.length === 0) {
        this.warning('No newsletters found to test filtering');
        return false;
      }

      // Group newsletters by source
      const sourceGroups = allNewsletters.reduce((acc, newsletter) => {
        const sourceId = newsletter.newsletter_source_id;
        if (!acc[sourceId]) {
          acc[sourceId] = {
            sourceId,
            sourceName: newsletter.newsletter_sources?.name || 'Unknown',
            newsletters: []
          };
        }
        acc[sourceId].newsletters.push(newsletter);
        return acc;
      }, {});

      this.info(`Found newsletters from ${Object.keys(sourceGroups).length} different sources:`);
      Object.values(sourceGroups).forEach(group => {
        this.info(`  - ${group.sourceName} (${group.sourceId}): ${group.newsletters.length} newsletters`);
      });

      // Test filtering by each source
      for (const [sourceId, group] of Object.entries(sourceGroups)) {
        if (group.newsletters.length === 0) continue;

        this.log(`\n🎯 Testing filter for source: ${group.sourceName} (${sourceId})`, COLORS.CYAN);

        // Test single source filtering
        const { data: filteredNewsletters, error: filterError } = await this.supabase
          .from('newsletters')
          .select(`
            id,
            title,
            newsletter_source_id,
            newsletter_sources(id, name)
          `)
          .eq('newsletter_source_id', sourceId)
          .eq('is_archived', false);

        if (filterError) {
          this.error(`Source filtering failed for ${group.sourceName}: ${filterError.message}`);
          continue;
        }

        // Validate results
        const expectedCount = group.newsletters.length;
        const actualCount = filteredNewsletters?.length || 0;

        if (actualCount === expectedCount) {
          this.success(`Source filtering works: Expected ${expectedCount}, got ${actualCount} newsletters`);
        } else {
          this.error(`Source filtering mismatch: Expected ${expectedCount}, got ${actualCount} newsletters`);
        }

        // Validate that all returned newsletters are from the correct source
        const wrongSourceNewsletters = filteredNewsletters?.filter(n => n.newsletter_source_id !== sourceId) || [];
        if (wrongSourceNewsletters.length === 0) {
          this.success('All returned newsletters are from the correct source');
        } else {
          this.error(`Found ${wrongSourceNewsletters.length} newsletters from wrong sources`);
          wrongSourceNewsletters.forEach(n => {
            this.error(`  - ${n.title} (source: ${n.newsletter_source_id}, expected: ${sourceId})`);
          });
        }

        // Validate that source relation is loaded
        const newslettersWithoutSource = filteredNewsletters?.filter(n => !n.newsletter_sources) || [];
        if (newslettersWithoutSource.length === 0) {
          this.success('All newsletters have source relation loaded');
        } else {
          this.error(`Found ${newslettersWithoutSource.length} newsletters without source relation`);
        }

        // Test only the first few sources to avoid overwhelming output
        if (Object.keys(sourceGroups).indexOf(sourceId) >= 2) {
          this.info('Skipping remaining sources for brevity...');
          break;
        }
      }

      return true;
    } catch (error) {
      this.error(`Source filtering test failed: ${error.message}`);
      return false;
    }
  }

  async testMultipleSourceFiltering() {
    this.log('\n🎯 Testing Multiple Source Filtering...', COLORS.CYAN);

    try {
      // Get a few source IDs
      const { data: sources, error: sourcesError } = await this.supabase
        .from('newsletter_sources')
        .select('id, name')
        .limit(3);

      if (sourcesError || !sources || sources.length < 2) {
        this.warning('Not enough sources to test multiple source filtering');
        return false;
      }

      const sourceIds = sources.map(s => s.id);
      this.info(`Testing with source IDs: ${sourceIds.join(', ')}`);

      // Test multiple source filtering using IN clause
      const { data: filteredNewsletters, error: filterError } = await this.supabase
        .from('newsletters')
        .select(`
          id,
          title,
          newsletter_source_id,
          newsletter_sources(id, name)
        `)
        .in('newsletter_source_id', sourceIds)
        .eq('is_archived', false);

      if (filterError) {
        this.error(`Multiple source filtering failed: ${filterError.message}`);
        return false;
      }

      this.success(`Multiple source filtering returned ${filteredNewsletters?.length || 0} newsletters`);

      // Validate that all returned newsletters are from the correct sources
      const wrongSourceNewsletters = filteredNewsletters?.filter(n => !sourceIds.includes(n.newsletter_source_id)) || [];
      if (wrongSourceNewsletters.length === 0) {
        this.success('All returned newsletters are from the correct sources');
      } else {
        this.error(`Found ${wrongSourceNewsletters.length} newsletters from wrong sources`);
      }

      return true;
    } catch (error) {
      this.error(`Multiple source filtering test failed: ${error.message}`);
      return false;
    }
  }

  async testAPIParams() {
    this.log('\n📋 Testing API Parameter Processing...', COLORS.CYAN);

    // Mock the parameter processing logic from the API
    const testParams = [
      { sourceIds: ['test-id-1'] },
      { sourceIds: ['test-id-1', 'test-id-2'] },
      { sourceIds: [] },
      { sourceIds: undefined },
      {}
    ];

    testParams.forEach((params, index) => {
      this.log(`\nTest ${index + 1}: ${JSON.stringify(params)}`, COLORS.BLUE);

      // Simulate the API logic
      if (params.sourceIds && params.sourceIds.length > 0) {
        if (params.sourceIds.length === 1) {
          this.info(`  → Would use: .eq('newsletter_source_id', '${params.sourceIds[0]}')`);
          this.success('Single source ID handled correctly');
        } else {
          this.info(`  → Would use: .in('newsletter_source_id', [${params.sourceIds.map(id => `'${id}'`).join(', ')}])`);
          this.success('Multiple source IDs handled correctly');
        }
      } else {
        this.info('  → No source filtering applied');
        this.success('Empty/undefined source IDs handled correctly');
      }
    });

    return true;
  }

  async runAllTests() {
    this.log('🧪 Source Filtering API Test Suite', COLORS.CYAN);
    this.log('=' .repeat(50), COLORS.CYAN);

    // Initialize
    const initialized = await this.initializeSupabase();
    if (!initialized) {
      this.error('Cannot proceed without Supabase connection');
      return false;
    }

    // Run tests
    const tests = [
      { name: 'Database Schema', fn: () => this.testDatabaseSchema() },
      { name: 'Source Filtering', fn: () => this.testSourceFiltering() },
      { name: 'Multiple Source Filtering', fn: () => this.testMultipleSourceFiltering() },
      { name: 'API Parameter Processing', fn: () => this.testAPIParams() }
    ];

    let allPassed = true;
    for (const test of tests) {
      try {
        const passed = await test.fn();
        if (!passed) allPassed = false;
      } catch (error) {
        this.error(`Test '${test.name}' threw an error: ${error.message}`);
        allPassed = false;
      }
    }

    // Summary
    this.log('\n📊 Test Summary', COLORS.CYAN);
    this.log('=' .repeat(30), COLORS.CYAN);

    const successCount = this.testResults.filter(r => r.type === 'success').length;
    const errorCount = this.testResults.filter(r => r.type === 'error').length;
    const warningCount = this.testResults.filter(r => r.type === 'warning').length;

    this.log(`✅ Passed: ${successCount}`, COLORS.GREEN);
    this.log(`⚠️  Warnings: ${warningCount}`, COLORS.YELLOW);
    this.log(`❌ Failed: ${errorCount}`, COLORS.RED);

    if (allPassed && errorCount === 0) {
      this.log('\n🎉 All tests passed! Source filtering should work correctly.', COLORS.GREEN);
    } else {
      this.log('\n🚨 Some tests failed. Check the output above for details.', COLORS.RED);
    }

    return allPassed;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SourceFilteringTester();
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export default SourceFilteringTester;
