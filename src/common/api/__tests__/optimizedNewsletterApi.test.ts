import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizedNewsletterApi } from '../optimizedNewsletterApi';
import { supabase } from '../supabaseClient';

// Mock the supabase client
vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    })),
  },
  withPerformanceLogging: vi.fn((name, fn) => fn()),
  requireAuth: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  handleSupabaseError: vi.fn(),
}));

// Mock the original newsletterApi for delegation
vi.mock('../newsletterApi', () => ({
  newsletterApi: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdate: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    toggleArchive: vi.fn(),
    bulkArchive: vi.fn(),
    bulkUnarchive: vi.fn(),
    toggleLike: vi.fn(),
    getByTags: vi.fn(),
    search: vi.fn(),
    getStats: vi.fn(),
    countBySource: vi.fn(),
    getTotalCountBySource: vi.fn(),
    getUnreadCountBySource: vi.fn(),
    getUnreadCount: vi.fn(),
    getById: vi.fn(),
  },
}));

describe('OptimizedNewsletterApi', () => {
  const mockUserId = 'test-user-id';
  const mockNewsletterData = [
    {
      id: 'newsletter-1',
      title: 'Test Newsletter 1',
      content: 'Test content 1',
      summary: 'Test summary 1',
      image_url: 'https://example.com/image1.jpg',
      newsletter_source_id: 'source-1',
      word_count: 100,
      estimated_read_time: 2,
      is_read: false,
      is_liked: false,
      is_archived: false,
      received_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: mockUserId,
      source: {
        id: 'source-1',
        name: 'Test Source',
        from: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        user_id: mockUserId,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('should use optimized function for list queries', async () => {
      // Mock the RPC calls
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      const result = await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        limit: 10,
        offset: 0,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_newsletters_with_sources_tags', {
        p_user_id: mockUserId,
        p_source_id: null,
        p_is_read: null,
        p_is_archived: null,
        p_received_from: null,
        p_received_to: null,
        p_source_ids: null,
        p_limit: 10,
        p_offset: 0,
        p_order_by: 'received_at',
        p_order_direction: 'desc',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('count_newsletters_with_sources_tags', {
        p_user_id: mockUserId,
        p_source_id: null,
        p_is_read: null,
        p_is_archived: null,
        p_received_from: null,
        p_received_to: null,
        p_source_ids: null,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Test Newsletter 1');
      expect(result.data[0].source?.name).toBe('Test Source');
      expect(result.data[0].tags).toHaveLength(1);
      expect(result.data[0].tags[0].name).toBe('Test Tag');
    });

    it('should handle source filtering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        sourceIds: ['source-1'],
        limit: 20,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_source_id: 'source-1',
          p_source_ids: null,
          p_limit: 20,
          p_offset: 0,
          p_order_by: 'received_at',
          p_order_direction: 'desc',
        })
      );
    });

    it('should handle multiple source filtering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        sourceIds: ['source-1', 'source-2'],
        limit: 20,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_source_id: null,
          p_source_ids: ['source-1', 'source-2'],
          p_limit: 20,
          p_offset: 0,
          p_order_by: 'received_at',
          p_order_direction: 'desc',
        })
      );
    });

    it('should handle read/archived filtering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        isRead: false,
        isArchived: false,
        limit: 10,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_is_read: false,
          p_is_archived: false,
          p_limit: 10,
          p_offset: 0,
          p_order_by: 'received_at',
          p_order_direction: 'desc',
        })
      );
    });

    it('should handle date range filtering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        limit: 10,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_received_from: '2024-01-01',
          p_received_to: '2024-01-31',
          p_limit: 10,
          p_offset: 0,
          p_order_by: 'received_at',
          p_order_direction: 'desc',
        })
      );

      expect(supabase.rpc).toHaveBeenCalledWith(
        'count_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_received_from: '2024-01-01',
          p_received_to: '2024-01-31',
          p_source_ids: null,
        })
      );
    });

    it('should handle custom ordering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
        orderBy: 'title',
        ascending: true,
        limit: 10,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_order_by: 'title',
          p_order_direction: 'asc',
          p_limit: 10,
          p_offset: 0,
        })
      );
    });

    it('should handle RPC errors gracefully', async () => {
      const mockError = new Error('Database error');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(optimizedNewsletterApi.getAll({
        user_id: mockUserId,
      })).rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: 0,
          error: null,
        });

      const result = await optimizedNewsletterApi.getAll({
        user_id: mockUserId,
      });

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getById', () => {
    it('should use supabase for single newsletter queries', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: mockNewsletterData[0], error: null });
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase as any).from = vi.fn().mockReturnValue({ select: mockSelect });

      const result = await optimizedNewsletterApi.getById('newsletter-1');

      expect(supabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockEq1).toHaveBeenCalledWith('id', 'newsletter-1');
      expect(mockEq2).toHaveBeenCalledWith('user_id', mockUserId);
      expect(result).toBeTruthy();
      expect(result?.title).toBe('Test Newsletter 1');
      expect(result?.source?.name).toBe('Test Source');
    });

    it('should handle includeRelations parameter', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: mockNewsletterData[0], error: null });
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase as any).from = vi.fn().mockReturnValue({ select: mockSelect });

      await optimizedNewsletterApi.getById('newsletter-1', false);

      expect(supabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });
  });

  describe('mutation delegation', () => {
    it('should delegate create to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');
      const createParams = {
        title: 'New Newsletter',
        content: 'Content',
        newsletter_source_id: 'source-1',
      };

      (newsletterApi.create as any).mockResolvedValueOnce(mockNewsletterData[0]);

      const result = await optimizedNewsletterApi.create(createParams);

      expect(newsletterApi.create).toHaveBeenCalledWith(createParams);
      expect(result).toEqual(mockNewsletterData[0]);
    });

    it('should delegate update to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');
      const updateParams = {
        id: 'newsletter-1',
        title: 'Updated Newsletter',
      };

      (newsletterApi.update as any).mockResolvedValueOnce(mockNewsletterData[0]);

      const result = await optimizedNewsletterApi.update(updateParams);

      expect(newsletterApi.update).toHaveBeenCalledWith(updateParams);
      expect(result).toEqual(mockNewsletterData[0]);
    });

    it('should delegate delete to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');

      (newsletterApi.delete as any).mockResolvedValueOnce(true);

      const result = await optimizedNewsletterApi.delete('newsletter-1');

      expect(newsletterApi.delete).toHaveBeenCalledWith('newsletter-1');
      expect(result).toBe(true);
    });

    it('should delegate bulkUpdate to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');
      const bulkParams = {
        ids: ['newsletter-1', 'newsletter-2'],
        updates: { is_read: true },
      };

      (newsletterApi.bulkUpdate as any).mockResolvedValueOnce({
        results: mockNewsletterData,
        errors: [null, null],
        successCount: 2,
        errorCount: 0,
      });

      const result = await optimizedNewsletterApi.bulkUpdate(bulkParams);

      expect(newsletterApi.bulkUpdate).toHaveBeenCalledWith(bulkParams);
      expect(result.successCount).toBe(2);
    });

    it('should delegate markAsRead to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');

      (newsletterApi.markAsRead as any).mockResolvedValueOnce(mockNewsletterData[0]);

      const result = await optimizedNewsletterApi.markAsRead('newsletter-1');

      expect(newsletterApi.markAsRead).toHaveBeenCalledWith('newsletter-1');
      expect(result).toEqual(mockNewsletterData[0]);
    });

    it('should delegate toggleLike to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');

      (newsletterApi.toggleLike as any).mockResolvedValue(mockNewsletterData[0]);

      const result = await optimizedNewsletterApi.toggleLike('newsletter-1');

      expect(newsletterApi.toggleLike).toHaveBeenCalledWith('newsletter-1');
      expect(result).toEqual(mockNewsletterData[0]);
    });
  });

  describe('getBySource', () => {
    it('should use optimized API for source filtering', async () => {
      (supabase.rpc as any)
        .mockResolvedValueOnce({
          data: mockNewsletterData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: 1,
          error: null,
        });

      const result = await optimizedNewsletterApi.getBySource('source-1', {
        limit: 10,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_newsletters_with_sources_tags',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_source_id: 'source-1',
          p_source_ids: null,
          p_limit: 10,
          p_offset: 0,
          p_order_by: 'received_at',
          p_order_direction: 'desc',
        })
      );

      expect(result.data).toHaveLength(1);
    });
  });

  describe('search and tag filtering delegation', () => {
    it('should delegate search to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');
      const searchResults = {
        data: mockNewsletterData,
        count: 1,
        page: 1,
        limit: 20,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };

      (newsletterApi.search as any).mockResolvedValueOnce(searchResults);

      const result = await optimizedNewsletterApi.search('test query', {
        limit: 10,
      });

      expect(newsletterApi.search).toHaveBeenCalledWith('test query', {
        limit: 10,
      });
      expect(result).toEqual(searchResults);
    });

    it('should delegate getByTags to original API', async () => {
      const { newsletterApi } = await import('../newsletterApi');
      const tagResults = {
        data: mockNewsletterData,
        count: 1,
        page: 1,
        limit: 20,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };

      (newsletterApi.getByTags as any).mockResolvedValueOnce(tagResults);

      const result = await optimizedNewsletterApi.getByTags(['tag-1'], {
        limit: 10,
      });

      expect(newsletterApi.getByTags).toHaveBeenCalledWith(['tag-1'], {
        limit: 10,
      });
      expect(result).toEqual(tagResults);
    });
  });
});
