import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../api/errorHandling';
import { newsletterSourceApi } from '../../api/newsletterSourceApi';
import { NewsletterSource } from '../../types';
import {
  CreateNewsletterSourceParams,
  NewsletterSourceQueryParams,
  UpdateNewsletterSourceParams,
} from '../../types/api';
import { NewsletterSourceService } from '../newsletterSource/NewsletterSourceService';

// Mock dependencies
vi.mock('../../api/newsletterSourceApi');
vi.mock('../../utils/logger');

const mockNewsletterSourceApi = vi.mocked(newsletterSourceApi);

describe('NewsletterSourceService', () => {
  let service: NewsletterSourceService;

  const mockNewsletterSource: NewsletterSource = {
    id: 'source-1',
    name: 'Tech Newsletter',
    from: 'tech@example.com',
    user_id: 'user-123',
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    total_count: 15,
    unread_count: 3,
  };

  beforeEach(() => {
    service = new NewsletterSourceService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSource', () => {
    it('should return newsletter source when found', async () => {
      mockNewsletterSourceApi.getById.mockResolvedValue(mockNewsletterSource);

      const result = await service.getSource('source-1');

      expect(result).toEqual(mockNewsletterSource);
      expect(mockNewsletterSourceApi.getById).toHaveBeenCalledWith('source-1');
    });

    it('should throw NotFoundError when source not found', async () => {
      mockNewsletterSourceApi.getById.mockResolvedValue(null);

      await expect(service.getSource('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(service.getSource('nonexistent')).rejects.toThrow(
        'Newsletter source with ID nonexistent not found'
      );
    });

    it('should validate source ID', async () => {
      await expect(service.getSource('')).rejects.toThrow(ValidationError);
      await expect(service.getSource('   ')).rejects.toThrow(ValidationError);
    });

    it('should retry on failure and succeed on retry', async () => {
      mockNewsletterSourceApi.getById
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockNewsletterSource);

      const result = await service.getSource('source-1');

      expect(result).toEqual(mockNewsletterSource);
      expect(mockNewsletterSourceApi.getById).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSources', () => {
    it('should return paginated sources with default parameters', async () => {
      const mockResponse = {
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.getSources();

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
        limit: 50,
        orderBy: 'created_at',
        ascending: false,
      });
    });

    it('should process and validate query parameters', async () => {
      const params: NewsletterSourceQueryParams = {
        search: 'a', // too short, should be removed
        limit: 100,
        orderBy: 'name',
        ascending: true,
      };

      const mockResponse = {
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 100,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      await service.getSources(params);

      expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
        limit: 100,
        orderBy: 'name',
        ascending: true,
        // search should be removed because it's too short
      });
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        data: [],
        count: 0,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.getSources();

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('createSource', () => {
    const createParams: CreateNewsletterSourceParams = {
      name: 'New Tech Newsletter',
      from: 'new-tech@example.com',
    };

    it('should create source successfully with valid data', async () => {
      mockNewsletterSourceApi.create.mockResolvedValue(mockNewsletterSource);

      const result = await service.createSource(createParams);

      expect(result.success).toBe(true);
      expect(result.source).toEqual(mockNewsletterSource);
      expect(mockNewsletterSourceApi.create).toHaveBeenCalledWith(createParams);
    });

    it('should validate required fields', async () => {
      await expect(service.createSource({ name: '', from: 'test@example.com' })).rejects.toThrow(
        ValidationError
      );

      await expect(service.createSource({ name: 'Test', from: '' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate name length', async () => {
      await expect(service.createSource({ name: 'a', from: 'test@example.com' })).rejects.toThrow(
        'Source name must be between 2 and 100 characters'
      );

      const longName = 'a'.repeat(101);
      await expect(
        service.createSource({ name: longName, from: 'test@example.com' })
      ).rejects.toThrow('Source name must be between 2 and 100 characters');
    });

    it('should validate email format', async () => {
      await expect(service.createSource({ name: 'Test', from: 'invalid-email' })).rejects.toThrow(
        'Invalid from email address'
      );

      await expect(service.createSource({ name: 'Test', from: 'test@' })).rejects.toThrow(
        'Invalid from email address'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockNewsletterSourceApi.create.mockRejectedValue(new Error('Create failed'));

      const result = await service.createSource(createParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Create failed');
    });

    it('should retry on transient failures', async () => {
      mockNewsletterSourceApi.create
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockNewsletterSource);

      const result = await service.createSource(createParams);

      expect(result.success).toBe(true);
      expect(result.source).toEqual(mockNewsletterSource);
      expect(mockNewsletterSourceApi.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateSource', () => {
    const updateParams: UpdateNewsletterSourceParams = {
      id: 'source-1',
      name: 'Updated Newsletter',
      from: 'updated@example.com',
    };

    it('should update source successfully', async () => {
      const updatedSource = { ...mockNewsletterSource, ...updateParams };
      mockNewsletterSourceApi.update.mockResolvedValue(updatedSource);

      const result = await service.updateSource('source-1', updateParams);

      expect(result.success).toBe(true);
      expect(result.source).toEqual(updatedSource);
      expect(mockNewsletterSourceApi.update).toHaveBeenCalledWith(updateParams);
    });

    it('should validate source ID', async () => {
      await expect(service.updateSource('', updateParams)).rejects.toThrow(ValidationError);
    });

    it('should validate update parameters', async () => {
      await expect(service.updateSource('source-1', { id: 'source-1', name: 'a' })).rejects.toThrow(
        'Source name must be between 2 and 100 characters'
      );

      await expect(
        service.updateSource('source-1', { id: 'source-1', from: 'invalid' })
      ).rejects.toThrow('Invalid from email address');
    });

    it('should handle API errors gracefully', async () => {
      mockNewsletterSourceApi.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateSource('source-1', updateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('deleteSource', () => {
    it('should delete source successfully', async () => {
      mockNewsletterSourceApi.delete.mockResolvedValue(true);

      const result = await service.deleteSource('source-1');

      expect(result.success).toBe(true);
      expect(mockNewsletterSourceApi.delete).toHaveBeenCalledWith('source-1');
    });

    it('should validate source ID', async () => {
      await expect(service.deleteSource('')).rejects.toThrow(ValidationError);
    });

    it('should handle deletion errors', async () => {
      mockNewsletterSourceApi.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteSource('source-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('toggleArchive', () => {
    it('should toggle archive status successfully', async () => {
      const archivedSource = { ...mockNewsletterSource, is_archived: true };
      mockNewsletterSourceApi.toggleArchive.mockResolvedValue(archivedSource);

      const result = await service.toggleArchive('source-1');

      expect(result.success).toBe(true);
      expect(result.source).toEqual(archivedSource);
      expect(mockNewsletterSourceApi.toggleArchive).toHaveBeenCalledWith('source-1');
    });

    it('should handle errors gracefully', async () => {
      mockNewsletterSourceApi.toggleArchive.mockRejectedValue(new Error('Toggle failed'));

      const result = await service.toggleArchive('source-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Toggle failed');
    });
  });

  describe('bulkUpdate', () => {
    const updates = [
      { id: 'source-1', updates: { name: 'Updated 1' } },
      { id: 'source-2', updates: { name: 'Updated 2' } },
    ];

    it('should update multiple sources successfully', async () => {
      const mockResult = {
        successful: [
          { ...mockNewsletterSource, id: 'source-1', name: 'Updated 1' },
          { ...mockNewsletterSource, id: 'source-2', name: 'Updated 2' },
        ],
        failed: [],
      };
      mockNewsletterSourceApi.bulkUpdate.mockResolvedValue(mockResult);

      const result = await service.bulkUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.sources).toEqual(mockResult.successful);
      expect(result.failedIds).toEqual([]);
      expect(mockNewsletterSourceApi.bulkUpdate).toHaveBeenCalledWith(updates);
    });

    it('should handle partial failures', async () => {
      const mockResult = {
        successful: [{ ...mockNewsletterSource, id: 'source-1', name: 'Updated 1' }],
        failed: ['source-2'],
      };
      mockNewsletterSourceApi.bulkUpdate.mockResolvedValue(mockResult);

      const result = await service.bulkUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.sources).toEqual(mockResult.successful);
      expect(result.failedIds).toEqual(['source-2']);
    });

    it('should validate input array', async () => {
      await expect(service.bulkUpdate([])).rejects.toThrow(ValidationError);
    });

    it('should handle complete failure', async () => {
      mockNewsletterSourceApi.bulkUpdate.mockRejectedValue(new Error('Bulk update failed'));

      const result = await service.bulkUpdate(updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bulk update failed');
      expect(result.failedIds).toEqual(['source-1', 'source-2']);
    });
  });

  describe('bulkDelete', () => {
    const ids = ['source-1', 'source-2'];

    it('should delete multiple sources successfully', async () => {
      const mockResult = {
        successful: [],
        failed: [],
      };
      mockNewsletterSourceApi.bulkDelete.mockResolvedValue(mockResult);

      const result = await service.bulkDelete(ids);

      expect(result.success).toBe(true);
      expect(result.failedIds).toEqual([]);
      expect(mockNewsletterSourceApi.bulkDelete).toHaveBeenCalledWith(ids);
    });

    it('should handle partial failures', async () => {
      const mockResult = {
        successful: [],
        failed: ['source-2'],
      };
      mockNewsletterSourceApi.bulkDelete.mockResolvedValue(mockResult);

      const result = await service.bulkDelete(ids);

      expect(result.success).toBe(true);
      expect(result.failedIds).toEqual(['source-2']);
    });

    it('should validate input array', async () => {
      await expect(service.bulkDelete([])).rejects.toThrow(ValidationError);
    });
  });

  describe('searchSources', () => {
    it('should search sources with query', async () => {
      const mockResponse = {
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.searchSources('tech', { limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
        search: 'tech',
        limit: 10,
        orderBy: 'created_at',
        ascending: false,
      });
    });

    it('should validate search query', async () => {
      await expect(service.searchSources('')).rejects.toThrow(ValidationError);
    });
  });

  describe('getSourcesStats', () => {
    it('should return source statistics', async () => {
      const mockAllSources = {
        data: [],
        count: 100,
        page: 1,
        limit: 1,
        hasMore: true,
        nextPage: 2,
        prevPage: null,
      };
      const mockActiveSources = {
        data: [],
        count: 75,
        page: 1,
        limit: 1,
        hasMore: true,
        nextPage: 2,
        prevPage: null,
      };
      const mockArchivedSources = {
        data: [],
        count: 100,
        page: 1,
        limit: 1,
        hasMore: true,
        nextPage: 2,
        prevPage: null,
      };

      mockNewsletterSourceApi.getAll
        .mockResolvedValueOnce(mockAllSources)
        .mockResolvedValueOnce(mockActiveSources)
        .mockResolvedValueOnce(mockArchivedSources);

      const result = await service.getSourcesStats();

      expect(result).toEqual({
        total: 100,
        active: 75,
        archived: 25, // 100 - 75
      });
    });

    it('should handle null counts', async () => {
      const mockResponse = {
        data: [],
        count: null,
        page: 1,
        limit: 1,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };

      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.getSourcesStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        archived: 0,
      });
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network timeouts with retry', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';

      mockNewsletterSourceApi.getById
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(mockNewsletterSource);

      const result = await service.getSource('source-1');

      expect(result).toEqual(mockNewsletterSource);
      expect(mockNewsletterSourceApi.getById).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Persistent error');
      mockNewsletterSourceApi.getById.mockRejectedValue(error);

      await expect(service.getSource('source-1')).rejects.toThrow('Persistent error');
      expect(mockNewsletterSourceApi.getById).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should handle validation errors without retry', async () => {
      const validationError = new ValidationError('Invalid input');
      mockNewsletterSourceApi.create.mockRejectedValue(validationError);

      const result = await service.createSource({
        name: 'Test',
        from: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
      expect(mockNewsletterSourceApi.create).toHaveBeenCalledTimes(1); // No retry for validation errors
    });
  });

  describe('service options and configuration', () => {
    it('should respect custom batch size', async () => {
      const customService = new NewsletterSourceService({ batchSize: 25 });

      const mockResponse = {
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 25,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockNewsletterSourceApi.getAll.mockResolvedValue(mockResponse);

      await customService.getSources();

      expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
        limit: 25,
        orderBy: 'created_at',
        ascending: false,
      });
    });

    it('should handle optimistic updates when enabled', async () => {
      const optimisticService = new NewsletterSourceService({
        enableOptimisticUpdates: true,
      });

      mockNewsletterSourceApi.update.mockResolvedValue({
        ...mockNewsletterSource,
        name: 'Updated',
      });

      const result = await optimisticService.updateSource('source-1', {
        id: 'source-1',
        name: 'Updated',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very long source names gracefully', async () => {
      const extraLongName = 'a'.repeat(1000);

      await expect(
        service.createSource({
          name: extraLongName,
          from: 'test@example.com',
        })
      ).rejects.toThrow('Source name must be between 2 and 100 characters');
    });

    it('should handle malformed email addresses', async () => {
      const malformedEmails = [
        'plainaddress',
        '@missinglocal.com',
        'missing@.com',
        'missing@domain',
        'spaces @domain.com',
        'multiple@@domain.com',
      ];

      for (const email of malformedEmails) {
        await expect(
          service.createSource({
            name: 'Test',
            from: email,
          })
        ).rejects.toThrow('Invalid from email address');
      }
    });

    it('should handle Unicode characters in source names', async () => {
      const unicodeName = '🚀 Tech Newsletter 中文';
      mockNewsletterSourceApi.create.mockResolvedValue({
        ...mockNewsletterSource,
        name: unicodeName,
      });

      const result = await service.createSource({
        name: unicodeName,
        from: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.source?.name).toBe(unicodeName);
    });
  });
});
