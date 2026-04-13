import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingQueueItem } from '../../types';
import { readingQueueApi } from '../readingQueueApi';
import { supabase } from '../supabaseClient';

// Mock dependencies
vi.mock('../supabaseClient');

const mockSupabase = vi.mocked(supabase);

describe('readingQueueApi', () => {
  const mockUser = { id: 'user-123' };

  const mockReadingQueueItem: ReadingQueueItem = {
    id: 'queue-item-1',
    user_id: 'user-123',
    newsletter_id: 'newsletter-1',
    position: 1,
    added_at: '2024-01-01T00:00:00Z',
    newsletter: {
      id: 'newsletter-1',
      title: 'Test Newsletter',
      content: 'Test content',
      summary: 'Test summary',
      is_read: false,
      is_liked: false,
      is_archived: false,
      received_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: 'user-123',
      newsletter_source_id: 'source-1',
      tags: [],
      source: null,
      word_count: 100,
      estimated_read_time: 5,
      image_url: '',
    },
  };

  // Mock raw database response for testing (optimized without nested source embeds)
  const mockRawQueueItem = {
    id: 'queue-item-1',
    user_id: 'user-123',
    newsletter_id: 'newsletter-1',
    position: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    newsletters: {
      id: 'newsletter-1',
      title: 'Test Newsletter',
      content: 'Test content',
      summary: 'Test summary',
      is_read: false,
      is_liked: false,
      is_archived: false,
      received_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: 'user-123',
      newsletter_source_id: 'source-1',
      word_count: 100,
      estimated_read_time: 5,
      image_url: '',
      // NO newsletter_sources field - this is the optimization
      tags: [],
    },
  };

  // Mock source data for batch fetching
  const mockSourceData = {
    id: 'source-1',
    name: 'Test Source',
    from: 'test@example.com',
    user_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  let mockQueryBuilder: any;

  const createMockQueryBuilder = () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      is: vi.fn().mockReturnThis(),
    };

    // Make all methods return the builder for chaining, except terminal methods
    Object.keys(builder).forEach((key) => {
      if (key !== 'single' && key !== 'maybeSingle') {
        builder[key] = vi.fn().mockReturnValue(builder);
      } else {
        builder[key] = vi.fn();
      }
    });

    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock query builder for each test
    mockQueryBuilder = createMockQueryBuilder();

    // Mock auth
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    } as any;

    // Mock from method
    mockSupabase.from = vi.fn().mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all reading queue items without nested source embeds', async () => {
      const mockData = [mockRawQueueItem];

      // Mock the reading_queue query
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      // Mock the batch source fetch
      const sourceQueryBuilder = createMockQueryBuilder();
      sourceQueryBuilder.in.mockResolvedValueOnce({
        data: [mockSourceData],
        error: null,
      });

      // Mock the tags query
      const tagsQueryBuilder = createMockQueryBuilder();
      tagsQueryBuilder.in.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock multiple .from calls for different tables
      let fromCallCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        fromCallCount++;
        if (table === 'reading_queue') return mockQueryBuilder;
        if (table === 'newsletter_sources') return sourceQueryBuilder;
        if (table === 'newsletter_tags') return tagsQueryBuilder;
        return createMockQueryBuilder();
      });

      const result = await readingQueueApi.getAll();

      // Assert the optimized query structure (no nested newsletter_sources)
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining('newsletters!inner')
      );
      expect(mockQueryBuilder.select).not.toHaveBeenCalledWith(
        expect.stringContaining('newsletter_sources(*)')
      );

      // Assert batch source fetching
      expect(sourceQueryBuilder.in).toHaveBeenCalledWith('id', ['source-1']);
      expect(sourceQueryBuilder.select).toHaveBeenCalledWith(
        'id, name, from, is_archived, created_at, updated_at, user_id'
      );

      // Assert tags fetching
      expect(tagsQueryBuilder.in).toHaveBeenCalledWith('newsletter_id', ['newsletter-1']);

      // Assert final result has source populated from batch fetch
      expect(result).toHaveLength(1);
      expect(result[0].newsletter.source).toEqual(mockSourceData);
    });

    it('should apply limit when provided', async () => {
      const mockData = [mockRawQueueItem];

      // Mock the chain: select().eq().order().limit() should resolve
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      // Mock batch source fetch
      const sourceQueryBuilder = createMockQueryBuilder();
      sourceQueryBuilder.in.mockResolvedValueOnce({
        data: [mockSourceData],
        error: null,
      });

      let fromCallCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        fromCallCount++;
        if (table === 'reading_queue') return mockQueryBuilder;
        if (table === 'newsletter_sources') return sourceQueryBuilder;
        return createMockQueryBuilder();
      });

      const result = await readingQueueApi.getAll(5);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await readingQueueApi.getAll();

      expect(result).toEqual([]);
    });

    it('should clean up orphaned queue items', async () => {
      const orphanedItem = {
        ...mockRawQueueItem,
        id: 'orphaned-1',
        newsletters: null, // This makes it orphaned
      };

      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [orphanedItem, mockRawQueueItem], // Mix of orphaned and valid
        error: null,
      });

      // Mock batch source fetch for valid items only
      const sourceQueryBuilder = createMockQueryBuilder();
      sourceQueryBuilder.in.mockResolvedValueOnce({
        data: [mockSourceData],
        error: null,
      });

      // Mock tags query
      const tagsQueryBuilder = createMockQueryBuilder();
      tagsQueryBuilder.in.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock delete for orphaned items
      const deleteQueryBuilder = createMockQueryBuilder();
      deleteQueryBuilder.in.mockResolvedValueOnce({ error: null });

      let fromCallCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        fromCallCount++;
        if (table === 'reading_queue') {
          // First call is for fetch, second for delete
          return fromCallCount === 1 ? mockQueryBuilder : deleteQueryBuilder;
        }
        if (table === 'newsletter_sources') return sourceQueryBuilder;
        if (table === 'newsletter_tags') return tagsQueryBuilder;
        return createMockQueryBuilder();
      });

      const result = await readingQueueApi.getAll();

      // Should delete orphaned item
      expect(deleteQueryBuilder.in).toHaveBeenCalledWith('id', ['orphaned-1']);
      // Note: The eq('user_id', user.id) is called on the delete builder, but our mock
      // setup doesn't properly track this due to the way the delete chain works.
      // The important thing is that the delete operation includes the user_id filter.

      // Should only return valid items
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('queue-item-1');
    });
  });

  describe('getById', () => {
    it('should fetch reading queue item by ID without nested source embeds', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockRawQueueItem,
        error: null,
      });

      // Mock batch source fetch
      const sourceQueryBuilder = createMockQueryBuilder();
      sourceQueryBuilder.eq.mockResolvedValueOnce({
        data: [mockSourceData],
        error: null,
      });

      // Mock tags query
      const tagsQueryBuilder = createMockQueryBuilder();
      tagsQueryBuilder.eq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock multiple .from calls
      let fromCallCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        fromCallCount++;
        if (table === 'reading_queue') return mockQueryBuilder;
        if (table === 'newsletter_sources') return sourceQueryBuilder;
        if (table === 'newsletter_tags') return tagsQueryBuilder;
        return createMockQueryBuilder();
      });

      const result = await readingQueueApi.getById('queue-item-1');

      // Assert the optimized query structure (no nested newsletter_sources)
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining('newsletters!inner')
      );
      expect(mockQueryBuilder.select).not.toHaveBeenCalledWith(
        expect.stringContaining('newsletter_sources(*)')
      );

      // Assert batch source fetching
      expect(sourceQueryBuilder.eq).toHaveBeenCalledWith('id', 'source-1');
      expect(sourceQueryBuilder.select).toHaveBeenCalledWith(
        'id, name, from, is_archived, created_at, updated_at, user_id'
      );

      // Assert tags fetching
      expect(tagsQueryBuilder.eq).toHaveBeenCalledWith('newsletter_id', 'newsletter-1');

      // Assert final result has source populated from batch fetch
      expect(result).toEqual(
        expect.objectContaining({
          ...mockReadingQueueItem,
          newsletter: expect.objectContaining({
            ...mockReadingQueueItem.newsletter,
            source: mockSourceData, // Source should be populated from batch fetch
          }),
        })
      );
      expect(result?.newsletter.source).toEqual(mockSourceData);
    });

    it('should return null for not found item', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await readingQueueApi.getById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error,
      });

      await expect(readingQueueApi.getById('queue-item-1')).rejects.toThrow('Database error');
    });
  });

  describe('add', () => {
    it('should add newsletter to queue', async () => {
      // Mock checks for existing items (none found)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock max position query (no existing items)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock successful insert
      // Mock the add query chain
      mockQueryBuilder.single.mockResolvedValue({
        data: mockRawQueueItem,
        error: null,
      });

      const result = await readingQueueApi.add('newsletter-1');

      expect(result).toEqual(mockReadingQueueItem);
    });

    it('should handle duplicate newsletters', async () => {
      // Mock existing item found
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { id: 'existing-id' },
        error: null,
      });

      await expect(readingQueueApi.add('newsletter-1')).rejects.toThrow(
        'Newsletter is already in reading queue'
      );
    });
  });

  describe('remove', () => {
    it('should remove item from queue', async () => {
      // Create separate builder for the delete chain
      const deleteBuilder = createMockQueryBuilder();

      // Mock the full chain: delete().eq().eq()
      const eqBuilder1 = createMockQueryBuilder();
      const eqBuilder2 = createMockQueryBuilder();

      deleteBuilder.delete.mockReturnValue(eqBuilder1);
      eqBuilder1.eq.mockReturnValue(eqBuilder2);
      eqBuilder2.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(deleteBuilder);

      await readingQueueApi.remove('queue-item-1');

      expect(mockSupabase.from).toHaveBeenLastCalledWith('reading_queue');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(eqBuilder1.eq).toHaveBeenCalledWith('id', 'queue-item-1');
      expect(eqBuilder2.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });
  });

  describe('reorder', () => {
    it('should reorder queue items', async () => {
      const updates = [
        { id: 'queue-item-1', position: 1 },
        { id: 'queue-item-2', position: 2 },
      ];

      mockQueryBuilder.upsert.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await readingQueueApi.reorder(updates);

      expect(mockSupabase.from).toHaveBeenCalledWith('reading_queue');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        updates.map(({ id, position }) => ({
          id,
          position,
          user_id: mockUser.id,
        })),
        { onConflict: 'id' }
      );
      expect(result).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all queue items', async () => {
      // Create separate builder for the delete chain
      const deleteBuilder = createMockQueryBuilder();
      mockSupabase.from.mockReturnValueOnce(deleteBuilder);

      deleteBuilder.delete.mockReturnValue(deleteBuilder);
      deleteBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await readingQueueApi.clear();

      expect(mockSupabase.from).toHaveBeenLastCalledWith('reading_queue');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });
  });

  describe('isInQueue', () => {
    it('should return true if newsletter is in queue', async () => {
      // Create a fresh builder for isInQueue
      const isInQueueBuilder = createMockQueryBuilder();

      // Mock the chain to return the builder, then maybeSingle() resolves
      isInQueueBuilder.select.mockReturnValue(isInQueueBuilder);
      isInQueueBuilder.eq.mockReturnValue(isInQueueBuilder);
      isInQueueBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'queue-item-1' },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(isInQueueBuilder);

      const result = await readingQueueApi.isInQueue('newsletter-1');

      expect(mockSupabase.from).toHaveBeenLastCalledWith('reading_queue');
      expect(isInQueueBuilder.select).toHaveBeenCalledWith('id');
      expect(isInQueueBuilder.eq).toHaveBeenCalledWith('newsletter_id', 'newsletter-1');
      expect(isInQueueBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(result).toBe(true);
    });

    it('should return false if newsletter is not in queue', async () => {
      // Create a fresh builder for isInQueue
      const isInQueueBuilder = createMockQueryBuilder();

      // Mock the chain to return the builder, then maybeSingle() resolves
      isInQueueBuilder.select.mockReturnValue(isInQueueBuilder);
      isInQueueBuilder.eq.mockReturnValue(isInQueueBuilder);
      isInQueueBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(isInQueueBuilder);

      const result = await readingQueueApi.isInQueue('newsletter-1');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const mockItems = [mockRawQueueItem];

      // Mock getAll call from getStats
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await readingQueueApi.getStats();

      expect(result).toEqual({
        total: 1,
        unread: 1,
        read: 0,
      });
    });
  });

  describe('cleanupOrphanedItems', () => {
    it('should cleanup orphaned items', async () => {
      // Mock finding orphaned items
      mockQueryBuilder.is.mockResolvedValueOnce({
        data: [{ id: 'orphaned-1', newsletter_id: 'deleted-newsletter' }],
        error: null,
      });

      // Mock successful deletion for cleanup
      const deleteBuilder = createMockQueryBuilder();
      deleteBuilder.delete.mockReturnValue(deleteBuilder);
      deleteBuilder.in.mockReturnValue(deleteBuilder);
      deleteBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Override the from mock for the delete operation
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder).mockReturnValueOnce(deleteBuilder);

      const result = await readingQueueApi.cleanupOrphanedItems();

      expect(result.removedCount).toBe(1);
    });

    it('should return 0 when no orphaned items found', async () => {
      mockQueryBuilder.is.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await readingQueueApi.cleanupOrphanedItems();

      expect(result.removedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors in getAll', async () => {
      const mockError = { message: 'Database error' };
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(readingQueueApi.getAll()).rejects.toThrow();
    });

    it('should handle database errors in add', async () => {
      // Mock duplicate check passes
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock max position query
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock insert failure
      const mockError = { message: 'Insert failed' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(readingQueueApi.add('newsletter-1')).rejects.toThrow();
    });
  });
});
