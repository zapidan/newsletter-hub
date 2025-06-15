import { supabase } from "../../api/supabaseClient";

export interface DataIntegrityReport {
  orphanedReadingQueueItems: number;
  orphanedNewsletterTags: number;
  orphanedNewsletterSources: number;
  totalIssues: number;
  timestamp: string;
}

export interface CleanupResult {
  itemsRemoved: number;
  errors: string[];
  duration: number;
}

/**
 * Database cleanup utilities for maintaining data integrity
 */
export class DatabaseCleanupUtils {
  private static instance: DatabaseCleanupUtils;

  public static getInstance(): DatabaseCleanupUtils {
    if (!DatabaseCleanupUtils.instance) {
      DatabaseCleanupUtils.instance = new DatabaseCleanupUtils();
    }
    return DatabaseCleanupUtils.instance;
  }

  /**
   * Generate a comprehensive data integrity report for a user
   */
  async generateIntegrityReport(userId: string): Promise<DataIntegrityReport> {
    const startTime = performance.now();
    console.log(
      `[DatabaseCleanup] Generating integrity report for user ${userId}`,
    );

    try {
      const [orphanedQueueItems, orphanedTags, orphanedSources] =
        await Promise.all([
          this.findOrphanedReadingQueueItems(userId),
          this.findOrphanedNewsletterTags(userId),
          this.findOrphanedNewsletterSources(userId),
        ]);

      const report: DataIntegrityReport = {
        orphanedReadingQueueItems: orphanedQueueItems.length,
        orphanedNewsletterTags: orphanedTags.length,
        orphanedNewsletterSources: orphanedSources.length,
        totalIssues:
          orphanedQueueItems.length +
          orphanedTags.length +
          orphanedSources.length,
        timestamp: new Date().toISOString(),
      };

      const duration = performance.now() - startTime;
      console.log(
        `[DatabaseCleanup] Integrity report completed in ${duration.toFixed(2)}ms:`,
        report,
      );

      return report;
    } catch (error) {
      console.error(
        "[DatabaseCleanup] Failed to generate integrity report:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find orphaned reading queue items (items referencing deleted newsletters)
   */
  async findOrphanedReadingQueueItems(userId: string): Promise<
    Array<{
      id: string;
      newsletter_id: string;
      position: number;
      created_at: string;
      newsletters: null;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from("reading_queue")
        .select(
          `
          id,
          newsletter_id,
          position,
          created_at,
          newsletters!left(id)
        `,
        )
        .eq("user_id", userId)
        .is("newsletters.id", null);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(
        "[DatabaseCleanup] Failed to find orphaned reading queue items:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find orphaned newsletter tags (tags referencing deleted newsletters)
   */
  async findOrphanedNewsletterTags(userId: string): Promise<
    Array<{
      id: string;
      newsletter_id: string;
      tag_id: string;
      created_at: string;
      newsletters: null;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from("newsletter_tags")
        .select(
          `
          id,
          newsletter_id,
          tag_id,
          created_at,
          newsletters!left(id)
        `,
        )
        .is("newsletters.id", null)
        .eq("newsletters.user_id", userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(
        "[DatabaseCleanup] Failed to find orphaned newsletter tags:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find orphaned newsletter sources (sources with no newsletters)
   */
  async findOrphanedNewsletterSources(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      domain: string;
      created_at: string;
    }>
  > {
    try {
      // First get all newsletter sources for the user
      const { data: sources, error: sourcesError } = await supabase
        .from("newsletter_sources")
        .select("id, name, domain, created_at")
        .eq("user_id", userId);

      if (sourcesError) throw sourcesError;
      if (!sources || sources.length === 0) return [];

      // Then check which ones have no newsletters
      const sourceIds = sources.map((s) => s.id);
      const { data: sourcesWithNewsletters, error: newslettersError } =
        await supabase
          .from("newsletters")
          .select("newsletter_source_id")
          .in("newsletter_source_id", sourceIds)
          .eq("user_id", userId);

      if (newslettersError) throw newslettersError;

      const usedSourceIds = new Set(
        (sourcesWithNewsletters || []).map((n) => n.newsletter_source_id),
      );

      return sources.filter((source) => !usedSourceIds.has(source.id));
    } catch (error) {
      console.error(
        "[DatabaseCleanup] Failed to find orphaned newsletter sources:",
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up orphaned reading queue items
   */
  async cleanupOrphanedReadingQueueItems(
    userId: string,
  ): Promise<CleanupResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let itemsRemoved = 0;

    try {
      console.log(
        `[DatabaseCleanup] Starting cleanup of orphaned reading queue items for user ${userId}`,
      );

      const orphanedItems = await this.findOrphanedReadingQueueItems(userId);

      if (orphanedItems.length === 0) {
        console.log("[DatabaseCleanup] No orphaned reading queue items found");
        return {
          itemsRemoved: 0,
          errors: [],
          duration: performance.now() - startTime,
        };
      }

      console.log(
        `[DatabaseCleanup] Found ${orphanedItems.length} orphaned reading queue items`,
      );

      const orphanedIds = orphanedItems.map((item) => item.id);
      const { error } = await supabase
        .from("reading_queue")
        .delete()
        .in("id", orphanedIds)
        .eq("user_id", userId);

      if (error) {
        errors.push(
          `Failed to delete orphaned reading queue items: ${error.message}`,
        );
      } else {
        itemsRemoved = orphanedItems.length;
        console.log(
          `[DatabaseCleanup] Successfully removed ${itemsRemoved} orphaned reading queue items`,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Cleanup failed: ${errorMsg}`);
      console.error("[DatabaseCleanup] Cleanup failed:", error);
    }

    return {
      itemsRemoved,
      errors,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Clean up orphaned newsletter tags
   */
  async cleanupOrphanedNewsletterTags(userId: string): Promise<CleanupResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let itemsRemoved = 0;

    try {
      console.log(
        `[DatabaseCleanup] Starting cleanup of orphaned newsletter tags for user ${userId}`,
      );

      const orphanedTags = await this.findOrphanedNewsletterTags(userId);

      if (orphanedTags.length === 0) {
        console.log("[DatabaseCleanup] No orphaned newsletter tags found");
        return {
          itemsRemoved: 0,
          errors: [],
          duration: performance.now() - startTime,
        };
      }

      console.log(
        `[DatabaseCleanup] Found ${orphanedTags.length} orphaned newsletter tags`,
      );

      const orphanedIds = orphanedTags.map((tag) => tag.id);
      const { error } = await supabase
        .from("newsletter_tags")
        .delete()
        .in("id", orphanedIds);

      if (error) {
        errors.push(
          `Failed to delete orphaned newsletter tags: ${error.message}`,
        );
      } else {
        itemsRemoved = orphanedTags.length;
        console.log(
          `[DatabaseCleanup] Successfully removed ${itemsRemoved} orphaned newsletter tags`,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Cleanup failed: ${errorMsg}`);
      console.error("[DatabaseCleanup] Newsletter tags cleanup failed:", error);
    }

    return {
      itemsRemoved,
      errors,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Perform comprehensive cleanup for a user
   */
  async performFullCleanup(userId: string): Promise<{
    readingQueue: CleanupResult;
    newsletterTags: CleanupResult;
    totalItemsRemoved: number;
    totalErrors: string[];
    duration: number;
  }> {
    const startTime = performance.now();
    console.log(`[DatabaseCleanup] Starting full cleanup for user ${userId}`);

    try {
      const [readingQueueResult, newsletterTagsResult] = await Promise.all([
        this.cleanupOrphanedReadingQueueItems(userId),
        this.cleanupOrphanedNewsletterTags(userId),
      ]);

      const result = {
        readingQueue: readingQueueResult,
        newsletterTags: newsletterTagsResult,
        totalItemsRemoved:
          readingQueueResult.itemsRemoved + newsletterTagsResult.itemsRemoved,
        totalErrors: [
          ...readingQueueResult.errors,
          ...newsletterTagsResult.errors,
        ],
        duration: performance.now() - startTime,
      };

      console.log(
        `[DatabaseCleanup] Full cleanup completed in ${result.duration.toFixed(2)}ms:`,
        {
          totalItemsRemoved: result.totalItemsRemoved,
          totalErrors: result.totalErrors.length,
        },
      );

      return result;
    } catch (error) {
      console.error("[DatabaseCleanup] Full cleanup failed:", error);
      throw error;
    }
  }

  /**
   * Schedule periodic cleanup (can be called from a service worker or scheduled task)
   */
  async schedulePeriodicCleanup(
    userId: string,
    intervalMs: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    console.log(
      `[DatabaseCleanup] Scheduling periodic cleanup for user ${userId} every ${intervalMs}ms`,
    );

    const cleanup = async () => {
      try {
        const report = await this.generateIntegrityReport(userId);
        if (report.totalIssues > 0) {
          console.log(
            `[DatabaseCleanup] Found ${report.totalIssues} integrity issues, performing cleanup`,
          );
          await this.performFullCleanup(userId);
        }
      } catch (error) {
        console.error("[DatabaseCleanup] Scheduled cleanup failed:", error);
      }
    };

    // Initial cleanup
    await cleanup();

    // Schedule recurring cleanup
    setInterval(cleanup, intervalMs);
  }

  /**
   * Validate database constraints and foreign key integrity
   */
  async validateDatabaseIntegrity(userId: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const report = await this.generateIntegrityReport(userId);

      if (report.orphanedReadingQueueItems > 0) {
        issues.push(
          `${report.orphanedReadingQueueItems} orphaned reading queue items found`,
        );
        recommendations.push(
          "Run cleanup to remove orphaned reading queue items",
        );
      }

      if (report.orphanedNewsletterTags > 0) {
        issues.push(
          `${report.orphanedNewsletterTags} orphaned newsletter tags found`,
        );
        recommendations.push("Run cleanup to remove orphaned newsletter tags");
      }

      if (report.orphanedNewsletterSources > 0) {
        issues.push(
          `${report.orphanedNewsletterSources} unused newsletter sources found`,
        );
        recommendations.push(
          "Consider archiving or removing unused newsletter sources",
        );
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      console.error(
        "[DatabaseCleanup] Database integrity validation failed:",
        error,
      );
      return {
        isValid: false,
        issues: ["Failed to validate database integrity"],
        recommendations: ["Check database connection and permissions"],
      };
    }
  }
}

// Export singleton instance
export const dbCleanupUtils = DatabaseCleanupUtils.getInstance();

// Export convenience functions
export const generateIntegrityReport = (userId: string) =>
  dbCleanupUtils.generateIntegrityReport(userId);

export const cleanupOrphanedReadingQueueItems = (userId: string) =>
  dbCleanupUtils.cleanupOrphanedReadingQueueItems(userId);

export const performFullCleanup = (userId: string) =>
  dbCleanupUtils.performFullCleanup(userId);

export const validateDatabaseIntegrity = (userId: string) =>
  dbCleanupUtils.validateDatabaseIntegrity(userId);
