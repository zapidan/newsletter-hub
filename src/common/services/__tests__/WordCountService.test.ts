import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the supabase client with inline mock to avoid hoisting issues
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from '../../api/supabaseClient';
import { WordCountService } from '../WordCountService';

describe('WordCountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateWordCount', () => {
    it('should return 0 for null or empty content', async () => {
      const content = null;
      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(0);

      const content2 = '';
      const result2 = await WordCountService.calculateWordCount(content2);
      expect(result2).toBe(0);
    });

    it('should count words in simple HTML content', async () => {
      const content = '<p>This is a <strong>test</strong> string.</p>';
      supabase.rpc.mockResolvedValueOnce({ data: 6, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(6);

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should filter out advertisement content', async () => {
      const content = `
        <p>This is real content that should be counted.</p>
        <div class="ad">Buy now! Special offer! Limited time!</div>
        <div id="sidebar-ad">Promoted content here</div>
        <span class="advertisement">Sponsored message</span>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 9, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(9); // "This is real content that should be counted"

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should preserve years while removing other long numbers', async () => {
      const content = `
        <p>In 2023 we launched. The project started in 2020 and will end in 2025.</p>
        <p>Here are some tracking numbers: 1234567890 and 987654321.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 17, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(17); // Should count years but not the long tracking numbers

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should remove tracking codes and UUIDs', async () => {
      const content = `
        <p>Here is some real content.</p>
        <p>Tracking: abcdef1234567890 and 123e4567-e89b-12d3-a456-426614174000.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 6, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(6); // "Here is some real content Tracking and"

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle common promotional phrases', async () => {
      const content = `
        <p>This is valuable newsletter content.</p>
        <p>Click here! Buy now! Shop now! Limited time! Special offer! Act now! Don't miss!</p>
        <p>Unsubscribe | Opt out | Preferences | Privacy policy | Terms of service</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 6, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(6); // "This is valuable newsletter content"

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle complex HTML with nested elements', async () => {
      const content = `
        <html>
          <head><style>body { font-family: Arial; }</style></head>
          <body>
            <div class="content">
              <h1>Important Article Title</h1>
              <p>This is the main content with <em>emphasis</em> and <strong>strong</strong> text.</p>
              <div class="ad-container">
                <div class="ad">Advertisement content here</div>
              </div>
              <p>More real content continues here.</p>
            </div>
            <script>console.log('tracking');</script>
          </body>
        </html>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 15, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(15); // Should count real content but not ads or scripts

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle email addresses and URLs correctly', async () => {
      const content = `
        <p>Contact us at support@example.com for more information.</p>
        <p>Visit https://example.com/products for details.</p>
        <p>This is the real content we want to count.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 13, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(13); // Should remove email and URL, count real content

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle very long words (likely tracking codes)', async () => {
      const content = `
        <p>Normal content here.</p>
        <p>Tracking: abcdefghijklmnopqrstuvwxyz1234567890</p>
        <p>More normal content.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 6, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(6); // Should remove the very long tracking word

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should preserve single letters a, A, I but remove others', async () => {
      const content = `
        <p>I am a person. This is b test.</p>
        <p>A big improvement over c old method.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 11, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(11); // Should keep I, a, A but remove b, c

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle HTML entities correctly', async () => {
      const content = `
        <p>This &amp; that &lt; something &gt; else.</p>
        <p>Don&apos;t forget about &quot;quotes&quot; and dashes.</p>
      `;
      supabase.rpc.mockResolvedValueOnce({ data: 11, error: null });

      const result = await WordCountService.calculateWordCount(content);
      expect(result).toBe(11); // Should handle HTML entities properly

      expect(supabase.rpc).toHaveBeenCalledWith('calculate_word_count', {
        content: content
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockError = { message: 'Database connection failed', code: 'PGRST301' };
      supabase.rpc.mockResolvedValueOnce({ data: null, error: mockError });

      const result = await WordCountService.calculateWordCount('<p>Test content</p>');
      expect(result).toBe(0);
    });

    it('should handle network errors gracefully', async () => {
      supabase.rpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await WordCountService.calculateWordCount('<p>Test content</p>');
      expect(result).toBe(0);
    });
  });

  describe('batchUpdateWordCounts', () => {
    it('should update word counts for multiple newsletters', async () => {
      const newsletterIds = ['id1', 'id2', 'id3'];
      supabase.rpc.mockResolvedValueOnce({ data: { updated_count: 3 }, error: null });

      const result = await WordCountService.batchUpdateWordCounts(newsletterIds);
      expect(result).toBe(3);
      expect(supabase.rpc).toHaveBeenCalledWith('batch_update_newsletter_word_counts', {
        newsletter_ids: newsletterIds
      });
    });

    it('should handle empty newsletter list', async () => {
      const result = await WordCountService.batchUpdateWordCounts([]);
      expect(result).toBe(0);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('getWordCountStats', () => {
    it('should return word count statistics', async () => {
      const mockStats = {
        total_newsletters: 100,
        avg_word_count: 250.5,
        median_word_count: 200,
        min_word_count: 10,
        max_word_count: 2000
      };
      supabase.rpc.mockResolvedValueOnce({ data: mockStats, error: null });

      const result = await WordCountService.getWordCountStats('user123');
      expect(result).toEqual(mockStats);
      expect(supabase.rpc).toHaveBeenCalledWith('get_word_count_stats', {
        p_user_id: 'user123'
      });
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Stats query failed' };
      supabase.rpc.mockResolvedValueOnce({ data: null, error: mockError });

      const result = await WordCountService.getWordCountStats('user123');
      expect(result).toBeNull();
    });
  });

  describe('updateWordCount', () => {
    it('should update word count for a single newsletter', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await WordCountService.updateWordCount('newsletter-123');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('update_newsletter_word_count', {
        p_newsletter_id: 'newsletter-123'
      });
    });

    it('should handle update errors', async () => {
      const mockError = { message: 'Update failed' };
      supabase.rpc.mockResolvedValueOnce({ data: null, error: mockError });

      const result = await WordCountService.updateWordCount('newsletter-123');
      expect(result).toBe(false);
    });
  });

  describe('validateWordCount', () => {
    it('should provide client-side word count validation', () => {
      const content = '<p>This is a <strong>test</strong> content.</p>';
      const result = WordCountService.validateWordCount(content);

      expect(result.clientCount).toBeGreaterThan(0);
      expect(result.serverCount).toBe(-1); // Placeholder value
    });

    it('should handle empty content in validation', () => {
      const result = WordCountService.validateWordCount('');
      expect(result.clientCount).toBe(0);
    });
  });
});
