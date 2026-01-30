import { supabase } from '../api/supabaseClient';

/**
 * WordCountService - CURRENTLY UNUSED
 * 
 * This service provides client-side word counting functionality for newsletters.
 * 
 * NOTE: This service is currently not used in the application. The application
 * uses database-level word counting through PostgreSQL functions in the
 * 20250130_consolidated_word_count_enhancements.sql migration.
 * 
 * The service could be used for:
 * - Client-side validation of word counts
 * - Debugging word count calculations
 * - Batch operations on existing newsletters
 * - Statistics and analytics
 * 
 * Database functions used instead:
 * - calculate_word_count(content)
 * - get_word_count_stats(user_id)
 * - update_newsletter_word_count(newsletter_id)
 */

export interface WordCountStats {
  total_newsletters: number;
  avg_word_count: number;
  median_word_count: number;
  min_word_count: number;
  max_word_count: number;
}

export class WordCountService {
  /**
   * WordCountService - CURRENTLY UNUSED
   * 
   * This class provides client-side word counting functionality but is not
   * currently used in the application. See file header comment for details.
   */
  /**
   * Calculate word count for newsletter content using the advanced database function
   */
  static async calculateWordCount(content: string | null): Promise<number> {
    if (!content) {
      return 0;
    }

    try {
      const { data, error } = await supabase.rpc('calculate_word_count', {
        content: content
      });

      if (error) {
        console.error('Error calculating word count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Error in calculateWordCount:', error);
      return 0;
    }
  }

  /**
   * Update word counts for multiple newsletters in a batch
   */
  static async batchUpdateWordCounts(newsletterIds: string[]): Promise<number> {
    if (!newsletterIds.length) {
      return 0;
    }

    try {
      const { data, error } = await supabase.rpc('batch_update_newsletter_word_counts', {
        newsletter_ids: newsletterIds
      });

      if (error) {
        console.error('Error batch updating word counts:', error);
        return 0;
      }

      return data?.updated_count || 0;
    } catch (error) {
      console.error('Error in batchUpdateWordCounts:', error);
      return 0;
    }
  }

  /**
   * Get word count statistics for a user's newsletters
   */
  static async getWordCountStats(userId: string): Promise<WordCountStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_word_count_stats', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error getting word count stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getWordCountStats:', error);
      return null;
    }
  }

  /**
   * Update word count for a single newsletter
   */
  static async updateWordCount(newsletterId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_newsletter_word_count', {
        p_newsletter_id: newsletterId
      });

      if (error) {
        console.error('Error updating word count:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateWordCount:', error);
      return false;
    }
  }

  /**
   * Validate word count calculation by comparing with a simple client-side calculation
   * (useful for debugging and testing)
   */
  static validateWordCount(content: string): { clientCount: number; serverCount: number } {
    // Simple client-side calculation for comparison
    const cleanContent = content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[#a-zA-Z0-9]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
    const clientCount = words.length;

    return {
      clientCount,
      serverCount: -1 // Will be populated by the caller
    };
  }
}
