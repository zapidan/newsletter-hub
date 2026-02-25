import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newsletterApi } from '../../api/newsletterApi';
import { optimizedNewsletterApi } from '../../api/optimizedNewsletterApi';
import { NewsletterWithRelations } from '../../types';
import { logger } from '../../utils/logger';
import { OPTIMIZATION_CONFIG, optimizedNewsletterService } from '../optimizedNewsletterService';

// Mock the API services
vi.mock('../../api/optimizedNewsletterApi');
vi.mock('../../api/newsletterApi');
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockOptimizedNewsletterApi = vi.mocked(optimizedNewsletterApi);
const mockNewsletterApi = vi.mocked(newsletterApi);
const mockLogger = vi.mocked(logger);

describe('OptimizedNewsletterService', () => {
  const mockUserId = 'test-user-id';
  const mockNewsletterData: NewsletterWithRelations[] = [
    {
      id: 'newsletter-1',
      title: 'Test Newsletter 1',
      content: 'Test content 1',
      summary: 'Test summary 1',
      image_url: 'https://example.com/image1.jpg',
      received_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      is_read: false,
      is_liked: false,
      is_archived: false,
      user_id: mockUserId,
      newsletter_source_id: 'source-1',
      word_count: 100,
      estimated_read_time: 2,
      source: {
        id: 'source-1',
        name: 'Test Source',
        from: 'test@example.com',
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      tags: [
        {
          id: 'tag-1',
          name: 'Test Tag',
          color: '#ff0000',
          user_id: mockUserId,
          created_at: '2024-01-01T00:00:00Z',
          newsletter_count: 5,
        },
      ],
    },
  ];

  const mockPaginatedResponse = {
    data: mockNewsletterData,
    count: 1,
    page: 1,
    limit: 20,
    hasMore: false,
    nextPage: null,
    prevPage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API selection logic', () => {
    describe('getAll', () => {
      it('should use optimized API for list queries', async () => {
        mockOptimizedNewsletterApi.getAll.mockResolvedValue(mockPaginatedResponse);

        const result = await optimizedNewsletterService.getAll({
          user_id: mockUserId,
          limit: 20,
        });

        expect(mockOptimizedNewsletterApi.getAll).toHaveBeenCalledWith({
          user_id: mockUserId,
          limit: 20,
        });
        expect(mockNewsletterApi.getAll).not.toHaveBeenCalled();
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should log API selection decision', async () => {
        mockOptimizedNewsletterApi.getAll.mockResolvedValue(mockPaginatedResponse);

        await optimizedNewsletterService.getAll({
          user_id: mockUserId,
          sourceIds: ['source-1'],
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Choosing API for getAll',
          expect.objectContaining({
            component: 'OptimizedNewsletterService',
            action: 'choose_api',
            metadata: expect.objectContaining({
              useOptimized: true,
              hasSourceIds: true,
              hasTagIds: false,
              hasSearch: false,
            }),
          })
        );
      });
    });

    describe('getById', () => {
      it('should use optimized API for single queries with relations', async () => {
        mockOptimizedNewsletterApi.getById.mockResolvedValue(mockNewsletterData[0]);

        const result = await optimizedNewsletterService.getById('newsletter-1', true);

        expect(mockOptimizedNewsletterApi.getById).toHaveBeenCalledWith('newsletter-1', true);
        expect(mockNewsletterApi.getById).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewsletterData[0]);
      });

      it('should use optimized API for single queries without relations', async () => {
        mockOptimizedNewsletterApi.getById.mockResolvedValue(mockNewsletterData[0]);

        await optimizedNewsletterService.getById('newsletter-1', false);

        expect(mockOptimizedNewsletterApi.getById).toHaveBeenCalledWith('newsletter-1', false);
        expect(mockNewsletterApi.getById).not.toHaveBeenCalled();
      });
    });

    describe('mutations', () => {
      it('should delegate create to original API', async () => {
        const createParams = {
          title: 'New Newsletter',
          content: 'Content',
          newsletter_source_id: 'source-1',
        };

        mockNewsletterApi.create.mockResolvedValue(mockNewsletterData[0]);

        const result = await optimizedNewsletterService.create(createParams);

        expect(mockNewsletterApi.create).toHaveBeenCalledWith(createParams);
        expect(mockOptimizedNewsletterApi.create).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewsletterData[0]);
      });

      it('should log delegation decision for mutations', async () => {
        mockNewsletterApi.create.mockResolvedValue(mockNewsletterData[0]);

        await optimizedNewsletterService.create({
          title: 'New Newsletter',
          content: 'Content',
          newsletter_source_id: 'source-1',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Using original API for create',
          expect.objectContaining({
            component: 'OptimizedNewsletterService',
            action: 'choose_api',
            metadata: { operation: 'create' },
          })
        );
      });

      it('should delegate update to original API', async () => {
        const updateParams = {
          id: 'newsletter-1',
          title: 'Updated Newsletter',
        };

        mockNewsletterApi.update.mockResolvedValue(mockNewsletterData[0]);

        const result = await optimizedNewsletterService.update(updateParams);

        expect(mockNewsletterApi.update).toHaveBeenCalledWith(updateParams);
        expect(mockOptimizedNewsletterApi.update).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewsletterData[0]);
      });

      it('should delegate delete to original API', async () => {
        mockNewsletterApi.delete.mockResolvedValue(true);

        const result = await optimizedNewsletterService.delete('newsletter-1');

        expect(mockNewsletterApi.delete).toHaveBeenCalledWith('newsletter-1');
        expect(mockOptimizedNewsletterApi.delete).not.toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should delegate bulkUpdate to original API', async () => {
        const bulkParams = {
          ids: ['newsletter-1', 'newsletter-2'],
          updates: { is_read: true },
        };

        mockNewsletterApi.bulkUpdate.mockResolvedValue({
          results: mockNewsletterData,
          errors: [null, null],
          successCount: 2,
          errorCount: 0,
        });

        const result = await optimizedNewsletterService.bulkUpdate(bulkParams);

        expect(mockNewsletterApi.bulkUpdate).toHaveBeenCalledWith(bulkParams);
        expect(mockOptimizedNewsletterApi.bulkUpdate).not.toHaveBeenCalled();
        expect(result.successCount).toBe(2);
      });

      it('should delegate markAsRead to original API', async () => {
        mockNewsletterApi.markAsRead.mockResolvedValue(mockNewsletterData[0]);

        const result = await optimizedNewsletterService.markAsRead('newsletter-1');

        expect(mockNewsletterApi.markAsRead).toHaveBeenCalledWith('newsletter-1');
        expect(mockOptimizedNewsletterApi.markAsRead).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewsletterData[0]);
      });

      it('should delegate toggleArchive to original API', async () => {
        mockNewsletterApi.toggleArchive.mockResolvedValue(mockNewsletterData[0]);

        const result = await optimizedNewsletterService.toggleArchive('newsletter-1');

        expect(mockNewsletterApi.toggleArchive).toHaveBeenCalledWith('newsletter-1');
        expect(mockOptimizedNewsletterApi.toggleArchive).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewsletterData[0]);
      });
    });

    describe('search and tag filtering', () => {
      it('should delegate search to original API', async () => {
        mockNewsletterApi.search.mockResolvedValue(mockPaginatedResponse);

        const result = await optimizedNewsletterService.search('test query', {
          limit: 10,
        });

        expect(mockNewsletterApi.search).toHaveBeenCalledWith('test query', {
          limit: 10,
        });
        expect(mockOptimizedNewsletterApi.search).not.toHaveBeenCalled();
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should delegate getByTags to original API', async () => {
        mockNewsletterApi.getByTags.mockResolvedValue(mockPaginatedResponse);

        const result = await optimizedNewsletterService.getByTags(['tag-1'], {
          limit: 10,
        });

        expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(['tag-1'], {
          limit: 10,
        });
        expect(mockOptimizedNewsletterApi.getByTags).not.toHaveBeenCalled();
        expect(result).toEqual(mockPaginatedResponse);
      });
    });

    describe('getBySource', () => {
      it('should use optimized API for source filtering', async () => {
        mockOptimizedNewsletterApi.getBySource.mockResolvedValue(mockPaginatedResponse);

        const result = await optimizedNewsletterService.getBySource('source-1', {
          limit: 10,
        });

        expect(mockOptimizedNewsletterApi.getBySource).toHaveBeenCalledWith('source-1', {
          limit: 10,
        });
        expect(mockNewsletterApi.getBySource).not.toHaveBeenCalled();
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should log API selection for source filtering', async () => {
        mockOptimizedNewsletterApi.getBySource.mockResolvedValue(mockPaginatedResponse);

        await optimizedNewsletterService.getBySource('source-1', {
          limit: 10,
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Choosing API for getBySource',
          expect.objectContaining({
            component: 'OptimizedNewsletterService',
            action: 'choose_api',
            metadata: expect.objectContaining({
              useOptimized: true,
              sourceId: 'source-1',
            }),
          })
        );
      });
    });

    describe('stats methods', () => {
      it('should delegate getStats to original API', async () => {
        const mockStats = {
          total: 100,
          read: 50,
          unread: 50,
          archived: 20,
          liked: 10,
        };

        mockNewsletterApi.getStats.mockResolvedValue(mockStats);

        const result = await optimizedNewsletterService.getStats();

        expect(mockNewsletterApi.getStats).toHaveBeenCalled();
        expect(mockOptimizedNewsletterApi.getStats).not.toHaveBeenCalled();
        expect(result).toEqual(mockStats);
      });

      it('should delegate countBySource to original API', async () => {
        const mockCounts = { 'source-1': 10, 'source-2': 5 };

        mockNewsletterApi.countBySource.mockResolvedValue(mockCounts);

        const result = await optimizedNewsletterService.countBySource();

        expect(mockNewsletterApi.countBySource).toHaveBeenCalled();
        expect(mockOptimizedNewsletterApi.countBySource).not.toHaveBeenCalled();
        expect(result).toEqual(mockCounts);
      });

      it('should delegate getUnreadCount to original API', async () => {
        mockNewsletterApi.getUnreadCount.mockResolvedValue(25);

        const result = await optimizedNewsletterService.getUnreadCount();

        expect(mockNewsletterApi.getUnreadCount).toHaveBeenCalled();
        expect(mockOptimizedNewsletterApi.getUnreadCount).not.toHaveBeenCalled();
        expect(result).toBe(25);
      });
    });
  });

  describe('configuration behavior', () => {
    it('should respect optimization configuration', async () => {
      // Test with different configuration values
      const originalConfig = { ...OPTIMIZATION_CONFIG };

      // Temporarily modify config for testing
      (OPTIMIZATION_CONFIG as any).useOptimizedForListQueries = false;

      mockNewsletterApi.getAll.mockResolvedValue(mockPaginatedResponse);

      await optimizedNewsletterService.getAll({
        user_id: mockUserId,
        limit: 20,
      });

      expect(mockNewsletterApi.getAll).toHaveBeenCalled();
      expect(mockOptimizedNewsletterApi.getAll).not.toHaveBeenCalled();

      // Restore original config
      Object.assign(OPTIMIZATION_CONFIG, originalConfig);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from optimized API', async () => {
      const mockError = new Error('Optimized API error');
      mockOptimizedNewsletterApi.getAll.mockRejectedValue(mockError);

      await expect(optimizedNewsletterService.getAll({
        user_id: mockUserId,
      })).rejects.toThrow('Optimized API error');
    });

    it('should propagate errors from original API', async () => {
      const mockError = new Error('Original API error');
      mockNewsletterApi.create.mockRejectedValue(mockError);

      await expect(optimizedNewsletterService.create({
        title: 'New Newsletter',
        content: 'Content',
        newsletter_source_id: 'source-1',
      })).rejects.toThrow('Original API error');
    });
  });
});
