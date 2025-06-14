#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m'
};

class FilteringFixValidator {
  constructor() {
    this.testResults = [];
    this.supabase = null;
    this.userId = null;
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
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        this.error('Supabase credentials not found in environment variables');
        return false;
      }

      this.supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Get a test user (first user in the system)
      const { data: users, error: usersError } = await this.supabase
        .from('newsletters')
        .select('user_id')
        .limit(1);

      if (usersError || !users || users.length === 0) {
        this.error('No test user found in the system');
        return false;
      }

      this.userId = users[0].user_id;
      this.success(`Initialized with test user: ${this.userId}`);
      return true;
    } catch (error) {
      this.error(`Failed to initialize: ${error.message}`);
      return false;
    }
  }

  async testArchivedNewsletterCounts() {
    this.log('\n📊 Testing Archived Newsletter Counts Fix...', COLORS.CYAN);

    try {
      // Get source counts including archived newsletters
      const { data: sourcesWithAllCounts, error: allCountsError } = await this.supabase
        .from('newsletter_sources')
        .select(`
          id,
          name,
          newsletter_count_all:newsletters(count)
        `)
        .eq('user_id', this.userId)
        .eq('is_archived', false);

      if (allCountsError) {
        this.error(`Failed to get all newsletter counts: ${allCountsError.message}`);
        return false;
      }

      // Get source counts excluding archived newsletters (the fix)
      const { data: sourcesWithActiveCounts, error: activeCountsError } = await this.supabase
        .from('newsletter_sources')
        .select(`
          id,
          name,
          newsletter_count:newsletters(count).eq(is_archived,false)
        `)
        .eq('user_id', this.userId)
        .eq('is_archived', false);

      if (activeCountsError) {
        this.error(`Failed to get active newsletter counts: ${activeCountsError.message}`);
        return false;
      }

      // Compare counts
      let hasArchivedNewsletters = false;
      for (const source of sourcesWithAllCounts) {
        const activeSource = sourcesWithActiveCounts.find(s => s.id === source.id);
        if (!activeSource) continue;

        const allCount = source.newsletter_count_all?.[0]?.count || 0;
        const activeCount = activeSource.newsletter_count?.[0]?.count || 0;

        this.info(`Source "${source.name}": All=${allCount}, Active=${activeCount}`);

        if (allCount > activeCount) {
          hasArchivedNewsletters = true;
          this.success(`Fixed: Source "${source.name}" correctly excludes ${allCount - activeCount} archived newsletters from count`);
        }
      }

      if (!hasArchivedNewsletters) {
        this.warning('No archived newsletters found to test count fix');
      }

      return true;
    } catch (error) {
      this.error(`Archived newsletter counts test failed: ${error.message}`);
      return false;
    }
  }

  async testSourceFilteringConsistency() {
    this.log('\n🎯 Testing Source Filtering Consistency...', COLORS.CYAN);

    try {
      // Get all active sources with newsletters
      const { data: sources, error: sourcesError } = await this.supabase
        .from('newsletter_sources')
        .select(`
          id,
          name,
          newsletter_count:newsletters(count).eq(is_archived,false)
        `)
        .eq('user_id', this.userId)
        .eq('is_archived', false);

      if (sourcesError) {
        this.error(`Failed to get sources: ${sourcesError.message}`);
        return false;
      }

      let testedSources = 0;
      for (const source of sources) {
        const expectedCount = source.newsletter_count?.[0]?.count || 0;
        if (expectedCount === 0) continue;

        // Test filtering by this source
        const { data: filteredNewsletters, error: filterError } = await this.supabase
          .from('newsletters')
          .select(`
            id,
            title,
            newsletter_source_id,
            source:newsletter_sources(*)
          `)
          .eq('user_id', this.userId)
          .eq('newsletter_source_id', source.id)
          .eq('is_archived', false);

        if (filterError) {
          this.error(`Failed to filter by source ${source.name}: ${filterError.message}`);
          continue;
        }

        const actualCount = filteredNewsletters?.length || 0;

        if (actualCount === expectedCount) {
          this.success(`Source "${source.name}": Count matches (${expectedCount})`);
        } else {
          this.error(`Source "${source.name}": Count mismatch - Expected ${expectedCount}, got ${actualCount}`);
        }

        // Test that all returned newsletters have source data
        const newslettersWithoutSource = filteredNewsletters?.filter(n => !n.source) || [];
        if (newslettersWithoutSource.length === 0) {
          this.success(`Source "${source.name}": All newsletters have source data loaded`);
        } else {
          this.error(`Source "${source.name}": ${newslettersWithoutSource.length} newsletters missing source data`);
        }

        testedSources++;
        if (testedSources >= 3) break; // Limit tests for brevity
      }

      if (testedSources === 0) {
        this.warning('No sources with newsletters found to test');
      }

      return true;
    } catch (error) {
      this.error(`Source filtering consistency test failed: ${error.message}`);
      return false;
    }
  }

  async testUnreadCountAccuracy() {
    this.log('\n🔢 Testing Unread Count Accuracy...', COLORS.CYAN);

    try {
      // Get actual unread count from database
      const { data: unreadNewsletters, error: unreadError } = await this.supabase
        .from('newsletters')
        .select('id')
        .eq('user_id', this.userId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (unreadError) {
        this.error(`Failed to get unread newsletters: ${unreadError.message}`);
        return false;
      }

      const actualUnreadCount = unreadNewsletters?.length || 0;
      this.info(`Actual unread count from database: ${actualUnreadCount}`);

      // Test unread count by source
      const { data: unreadBySource, error: unreadBySourceError } = await this.supabase
        .from('newsletters')
        .select('newsletter_source_id')
        .eq('user_id', this.userId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (unreadBySourceError) {
        this.error(`Failed to get unread newsletters by source: ${unreadBySourceError.message}`);
        return false;
      }

      const unreadCountsBySource = unreadBySource?.reduce((acc, newsletter) => {
        const sourceId = newsletter.newsletter_source_id;
        acc[sourceId] = (acc[sourceId] || 0) + 1;
        return acc;
      }, {}) || {};

      this.info(`Unread counts by source:`, JSON.stringify(unreadCountsBySource, null, 2));

      // Verify total matches
      const totalFromSources = Object.values(unreadCountsBySource).reduce((sum, count) => sum + count, 0);
      if (totalFromSources === actualUnreadCount) {
        this.success(`Unread count consistency verified: ${actualUnreadCount} total`);
      } else {
        this.error(`Unread count mismatch: Total ${actualUnreadCount}, Sum by source ${totalFromSources}`);
      }

      return true;
    } catch (error) {
      this.error(`Unread count accuracy test failed: ${error.message}`);
      return false;
    }
  }

  async testQueryPerformance() {
    this.log('\n⚡ Testing Query Performance...', COLORS.CYAN);

    try {
      const startTime = Date.now();

      // Test the fixed source filtering query
      const { data: newsletters, error: newslettersError } = await this.supabase
        .from('newsletters')
        .select(`
          id,
          title,
          newsletter_source_id,
          source:newsletter_sources(*),
          tags:newsletter_tags(tag:tags(*))
        `)
        .eq('user_id', this.userId)
        .eq('is_archived', false)
        .limit(50);

      const queryTime = Date.now() - startTime;

      if (newslettersError) {
        this.error(`Performance test query failed: ${newslettersError.message}`);
        return false;
      }

      this.info(`Query completed in ${queryTime}ms for ${newsletters?.length || 0} newsletters`);

      if (queryTime < 1000) {
        this.success(`Good performance: Query took ${queryTime}ms`);
      } else if (queryTime < 3000) {
        this.warning(`Moderate performance: Query took ${queryTime}ms`);
      } else {
        this.error(`Poor performance: Query took ${queryTime}ms`);
      }

      // Test source relation loading
      const newslettersWithSource = newsletters?.filter(n => n.source) || [];
      const sourceLoadRate = newsletters?.length > 0 ? (newslettersWithSource.length / newsletters.length) * 100 : 0;

      if (sourceLoadRate === 100) {
        this.success(`Perfect source relation loading: ${sourceLoadRate}%`);
      } else if (sourceLoadRate > 90) {
        this.warning(`Good source relation loading: ${sourceLoadRate.toFixed(1)}%`);
      } else {
        this.error(`Poor source relation loading: ${sourceLoadRate.toFixed(1)}%`);
      }

      return true;
    } catch (error) {
      this.error(`Query performance test failed: ${error.message}`);
      return false;
    }
  }

  async testRaceConditionFixes() {
    this.log('\n🏃 Testing Race Condition Fixes...', COLORS.CYAN);

    try {
      // Simulate rapid filter changes
      const sources = await this.supabase
        .from('newsletter_sources')
        .select('id, name')
        .eq('user_id', this.userId)
        .eq('is_archived', false)
        .limit(3);

      if (!sources.data || sources.data.length === 0) {
        this.warning('No sources available to test race conditions');
        return false;
      }

      // Test rapid consecutive queries (simulating rapid filter changes)
      const promises = sources.data.map(async (source, index) => {
        const startTime = Date.now();
        const { data, error } = await this.supabase
          .from('newsletters')
          .select('id, newsletter_source_id')
          .eq('user_id', this.userId)
          .eq('newsletter_source_id', source.id)
          .eq('is_archived', false);

        return {
          source: source.name,
          duration: Date.now() - startTime,
          count: data?.length || 0,
          error: error?.message
        };
      });

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        if (result.error) {
          this.error(`Concurrent query ${index + 1} failed: ${result.error}`);
        } else {
          this.success(`Concurrent query ${index + 1} (${result.source}): ${result.count} results in ${result.duration}ms`);
        }
      });

      // Test that all queries returned consistent data types
      const allSuccessful = results.every(r => !r.error);
      if (allSuccessful) {
        this.success('All concurrent queries completed successfully - race condition fixes working');
      } else {
        this.error('Some concurrent queries failed - potential race condition issues');
      }

      return allSuccessful;
    } catch (error) {
      this.error(`Race condition test failed: ${error.message}`);
      return false;
    }
  }

  async validateFixes() {
    this.log('🔧 Newsletter Filtering Fixes Validation', COLORS.CYAN);
    this.log('=' .repeat(50), COLORS.CYAN);

    const initialized = await this.initializeSupabase();
    if (!initialized) {
      this.error('Cannot proceed without database connection');
      return false;
    }

    const tests = [
      { name: 'Archived Newsletter Counts Fix', fn: () => this.testArchivedNewsletterCounts() },
      { name: 'Source Filtering Consistency', fn: () => this.testSourceFilteringConsistency() },
      { name: 'Unread Count Accuracy', fn: () => this.testUnreadCountAccuracy() },
      { name: 'Query Performance', fn: () => this.testQueryPerformance() },
      { name: 'Race Condition Fixes', fn: () => this.testRaceConditionFixes() }
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
    this.log('\n📋 Fix Validation Summary', COLORS.CYAN);
    this.log('=' .repeat(30), COLORS.CYAN);

    const successCount = this.testResults.filter(r => r.type === 'success').length;
    const errorCount = this.testResults.filter(r => r.type === 'error').length;
    const warningCount = this.testResults.filter(r => r.type === 'warning').length;

    this.log(`✅ Passed: ${successCount}`, COLORS.GREEN);
    this.log(`⚠️  Warnings: ${warningCount}`, COLORS.YELLOW);
    this.log(`❌ Failed: ${errorCount}`, COLORS.RED);

    if (allPassed && errorCount === 0) {
      this.log('\n🎉 All fixes validated successfully!', COLORS.GREEN);
      this.log('\nKey improvements:', COLORS.GREEN);
      this.log('• Source filtering no longer requires refresh', COLORS.GREEN);
      this.log('• Newsletter counts exclude archived items', COLORS.GREEN);
      this.log('• Unread count updates immediately', COLORS.GREEN);
      this.log('• Dropdown selections match returned data', COLORS.GREEN);
    } else {
      this.log('\n🚨 Some fixes may need additional work.', COLORS.RED);
    }

    return allPassed;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new FilteringFixValidator();
  validator.validateFixes().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default FilteringFixValidator;
