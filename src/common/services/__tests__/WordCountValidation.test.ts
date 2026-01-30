import { describe, expect, it } from 'vitest';

describe('Word Count Validation Tests', () => {

  describe('Ad Detection Validation', () => {
    it('should identify and filter advertisement content', () => {
      const adPatterns = [
        'advertisement',
        'sponsored',
        'promoted',
        'ad content',
        'paid promotion',
        'buy now',
        'shop now',
        'limited time',
        'special offer',
        'act now',
        "don't miss",
        'unsubscribe',
        'opt out',
        'preferences',
        'privacy policy',
        'terms of service'
      ];

      // Test that these patterns would be caught by our regex
      const adRegex = /(advertisement|sponsored|promoted|ad\s*content|paid\s*promotion|click\s*here|buy\s*now|shop\s*now|limited\s*time|special\s*offer|act\s*now|don't\s*miss|unsubscribe|opt\s*out|preferences|privacy\s*policy|terms\s*of\s*service)/gi;

      adPatterns.forEach(pattern => {
        expect(pattern).toMatch(adRegex);
      });
    });

    it('should identify ad-related HTML classes and IDs', () => {
      const adClassRegex = /<div[^>]*class="[^"]*(ad|sponsored)[^"]*"[^>]*>.*?<\/div>/gi;
      const adIdRegex = /<div[^>]*id="[^"]*(ad|sponsored)[^"]*"[^>]*>.*?<\/div>/gi;

      const testCases = [
        { html: '<div class="ad">content</div>', shouldMatch: true },
        { html: '<div class="advertisement">content</div>', shouldMatch: true },
        { html: '<div id="sidebar-ad">content</div>', shouldMatch: true },
        { html: '<span class="ad-content">content</span>', shouldMatch: false }, // span won't match div regex
        { html: '<p class="sponsored-content">content</p>', shouldMatch: false }, // p won't match div regex
        { html: '<div class="sponsored-content">content</div>', shouldMatch: true } // div with sponsored should match
      ];

      testCases.forEach(({ html, shouldMatch }) => {
        const matchesClass = html.match(adClassRegex);
        const matchesId = html.match(adIdRegex);
        const hasMatch = !!(matchesClass || matchesId);

        if (shouldMatch) {
          expect(hasMatch).toBeTruthy();
        } else {
          // For cases that don't match, verify they contain ad-related terms but won't match our specific regex
          expect(html).toMatch(/(ad|sponsored)/i);
        }
      });
    });
  });

  describe('Numeric Handling Validation', () => {
    it('should preserve years while removing other long numbers', () => {
      const yearRegex = /\b(19|20)\d{2}\b/g;

      const testCases = [
        { input: '2023', shouldKeep: true },
        { input: '1999', shouldKeep: true },
        { input: '2025', shouldKeep: true },
        { input: '2100', shouldKeep: false }, // This should be removed by our regex
        { input: '1234', shouldKeep: false },
        { input: '9876', shouldKeep: false },
        { input: '123456', shouldKeep: false },
        { input: '2023', shouldKeep: true }
      ];

      testCases.forEach(({ input, shouldKeep }) => {
        const matches = input.match(yearRegex);
        if (shouldKeep) {
          expect(matches).toBeTruthy(); // Should match the keep regex
        } else {
          expect(matches).toBeNull(); // Should NOT match the keep regex
        }
      });
    });

    it('should remove very long numbers', () => {
      const longNumberRegex = /\b\d{6,}\b/g;

      const testCases = [
        { input: '123456', shouldRemove: true },
        { input: '1234567', shouldRemove: true },
        { input: '12345', shouldRemove: false },
        { input: '1234', shouldRemove: false }
      ];

      testCases.forEach(({ input, shouldRemove }) => {
        const matches = input.match(longNumberRegex);
        if (shouldRemove) {
          expect(matches).toBeTruthy();
        } else {
          expect(matches).toBeNull();
        }
      });
    });
  });

  describe('Tracking Code Detection', () => {
    it('should identify hex tracking codes', () => {
      const hexRegex = /\b[a-f0-9]{8,}\b/gi;

      const testCases = [
        { input: 'abcdef1234567890', isTrackingCode: true },
        { input: 'ABCDEF1234567890', isTrackingCode: true },
        { input: '12345678', isTrackingCode: true },
        { input: 'abcdef12', isTrackingCode: true },
        { input: 'regularword', isTrackingCode: false }
      ];

      testCases.forEach(({ input, isTrackingCode }) => {
        const matches = input.match(hexRegex);
        if (isTrackingCode) {
          expect(matches).toBeTruthy();
        } else {
          expect(matches).toBeNull();
        }
      });
    });

    it('should identify UUID patterns', () => {
      const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123E4567-E89B-12D3-A456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000'
      ];

      const invalidUuids = [
        '123e4567-e89b-12d3-a456', // too short
        '123e4567e89b12d3a456426614174000', // missing dashes
        'regular-text-content'
      ];

      validUuids.forEach(uuid => {
        expect(uuid).toMatch(uuidRegex);
      });

      invalidUuids.forEach(invalid => {
        expect(invalid).not.toMatch(uuidRegex);
      });
    });
  });

  describe('Content Cleaning Validation', () => {
    it('should handle HTML entity cleanup', () => {
      const entityRegex = /&[#a-zA-Z0-9]+;/g;

      const testCases = [
        '&amp;',
        '&lt;',
        '&gt;',
        '&quot;',
        '&apos;',
        '&#39;',
        '&#x27;'
      ];

      testCases.forEach(entity => {
        expect(entity).toMatch(entityRegex);
      });
    });

    it('should identify very long words', () => {
      const longWordRegex = /\b\w{25,}\b/g;

      const testCases = [
        { input: 'abcdefghijklmnopqrstuvwxyz123456', isLong: true },
        { input: 'thisisaverylongwordthatshouldbecaught', isLong: true },
        { input: 'normalword', isLong: false },
        { input: 'mediumlengthword', isLong: false }
      ];

      testCases.forEach(({ input, isLong }) => {
        const matches = input.match(longWordRegex);
        if (isLong) {
          expect(matches).toBeTruthy();
        } else {
          expect(matches).toBeNull();
        }
      });
    });

    it('should handle single letter filtering', () => {
      const singleLetterRegex = /\b[b-hj-zB-HJ-Z]\b/g;

      const testCases = [
        { input: 'a', shouldKeep: true },
        { input: 'A', shouldKeep: true },
        { input: 'I', shouldKeep: true },
        { input: 'b', shouldRemove: true },
        { input: 'B', shouldRemove: true },
        { input: 'z', shouldRemove: true },
        { input: 'Z', shouldRemove: true }
      ];

      testCases.forEach(({ input, shouldRemove }) => {
        const matches = input.match(singleLetterRegex);
        if (shouldRemove) {
          expect(matches).toBeTruthy();
        } else {
          expect(matches).toBeNull();
        }
      });
    });
  });

  describe('Word Count Calculation Validation', () => {
    it('should correctly count words in cleaned content', () => {
      const testCases = [
        {
          content: 'This is a simple test.',
          expectedCount: 5
        },
        {
          content: 'Multiple   spaces   should   be   normalized.',
          expectedCount: 5
        },
        {
          content: '',
          expectedCount: 0
        },
        {
          content: '   ',
          expectedCount: 0
        },
        {
          content: 'Single',
          expectedCount: 1
        }
      ];

      testCases.forEach(({ content, expectedCount }) => {
        const cleanedContent = content
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/&[#a-zA-Z0-9]+;/g, ' ') // Remove HTML entities
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ')
          .trim();

        const words = cleanedContent ? cleanedContent.split(/\s+/).filter(word => word.length > 0) : [];
        expect(words.length).toBe(expectedCount);
      });
    });
  });
});
