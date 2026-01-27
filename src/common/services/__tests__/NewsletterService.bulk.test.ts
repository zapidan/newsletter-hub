/**
 * Tests for bulk operations in NewsletterService
 * This ensures the bulk actions functionality works correctly at the service level
 */
import { newsletterService } from '@common/services/newsletter/NewsletterService';
import { vi } from 'vitest';

// Mock the newsletterApi with the methods that NewsletterService actually uses
vi.mock('@common/api/newsletterApi', () => ({
  newsletterApi: {
    getAll: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
  },
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('NewsletterService Bulk Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bulkArchive', () => {
    it('should call toggleArchive for each ID', async () => {
      // Mock the toggleArchive method
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy.mockResolvedValue({ success: true } as any);

      const result = await newsletterService.bulkArchive(['nl1', 'nl2']);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(2);
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl1');
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl2');
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy
        .mockResolvedValueOnce({ success: true } as any)  // First succeeds
        .mockRejectedValueOnce(new Error('Failed'))  // Second fails
        .mockResolvedValueOnce({ success: true } as any); // Third succeeds

      const result = await newsletterService.bulkArchive(['nl1', 'nl2', 'nl3']);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    it('should handle empty array validation', async () => {
      await expect(newsletterService.bulkArchive([])).rejects.toThrow();
    });
  });

  describe('bulkUnarchive', () => {
    it('should call toggleArchive for each ID', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy.mockResolvedValue({ success: true } as any);

      const result = await newsletterService.bulkUnarchive(['nl1', 'nl2']);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(2);
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl1');
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl2');
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('bulkMarkAsRead', () => {
    it('should call markAsRead API for each ID', async () => {
      const { newsletterApi } = await import('@common/api/newsletterApi');
      const mockMarkAsRead = vi.mocked(newsletterApi.markAsRead);
      mockMarkAsRead.mockResolvedValue({ success: true } as any);

      const result = await newsletterService.bulkMarkAsRead(['nl1', 'nl2']);

      expect(mockMarkAsRead).toHaveBeenCalledTimes(2);
      expect(mockMarkAsRead).toHaveBeenCalledWith('nl1');
      expect(mockMarkAsRead).toHaveBeenCalledWith('nl2');
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      const { newsletterApi } = await import('@common/api/newsletterApi');
      const mockMarkAsRead = vi.mocked(newsletterApi.markAsRead);
      mockMarkAsRead
        .mockResolvedValueOnce({ success: true } as any)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true } as any);

      const result = await newsletterService.bulkMarkAsRead(['nl1', 'nl2', 'nl3']);

      expect(mockMarkAsRead).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false); // When there are failures, success is false
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('bulkMarkAsUnread', () => {
    it('should call markAsUnread API for each ID', async () => {
      const { newsletterApi } = await import('@common/api/newsletterApi');
      const mockMarkAsUnread = vi.mocked(newsletterApi.markAsUnread);
      mockMarkAsUnread.mockResolvedValue({ success: true } as any);

      const result = await newsletterService.bulkMarkAsUnread(['nl1', 'nl2']);

      expect(mockMarkAsUnread).toHaveBeenCalledTimes(2);
      expect(mockMarkAsUnread).toHaveBeenCalledWith('nl1');
      expect(mockMarkAsUnread).toHaveBeenCalledWith('nl2');
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batch operations', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy.mockResolvedValue({ success: true } as any);

      // Create 100 IDs
      const largeIds = Array.from({ length: 100 }, (_, i) => `nl${i + 1}`);

      const result = await newsletterService.bulkArchive(largeIds);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(100);
      expect(result.successCount).toBe(100);
      expect(result.failedCount).toBe(0);
    });

    it('should handle partial success in large batches', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');

      // Mock first 50 calls to succeed, next 50 to fail
      for (let i = 0; i < 50; i++) {
        toggleArchiveSpy.mockResolvedValueOnce({ success: true } as any);
      }
      for (let i = 0; i < 50; i++) {
        toggleArchiveSpy.mockRejectedValueOnce(new Error('Failed'));
      }

      const largeIds = Array.from({ length: 100 }, (_, i) => `nl${i + 1}`);

      const result = await newsletterService.bulkArchive(largeIds);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(100);
      expect(result.successCount).toBe(50);
      expect(result.failedCount).toBe(50);
    });
  });

  describe('Input Validation', () => {
    it('should handle invalid newsletter IDs', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy.mockResolvedValue({ success: true } as any);

      // Test with invalid IDs - service should still process them
      const result = await newsletterService.bulkArchive(['', 'invalid-id', null as any]);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(3);
      expect(toggleArchiveSpy).toHaveBeenCalledWith('');
      expect(toggleArchiveSpy).toHaveBeenCalledWith('invalid-id');
      expect(toggleArchiveSpy).toHaveBeenCalledWith(null as any);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    it('should handle duplicate IDs', async () => {
      const toggleArchiveSpy = vi.spyOn(newsletterService, 'toggleArchive');
      toggleArchiveSpy.mockResolvedValue({ success: true } as any);

      const result = await newsletterService.bulkArchive(['nl1', 'nl1']);

      expect(toggleArchiveSpy).toHaveBeenCalledTimes(2);
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl1');
      expect(toggleArchiveSpy).toHaveBeenCalledWith('nl1');
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });
});
