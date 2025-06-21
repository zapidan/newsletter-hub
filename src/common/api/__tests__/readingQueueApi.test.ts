import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readingQueueApi } from '../readingQueueApi';
import { supabase } from '../supabaseClient';
import { ReadingQueueItem } from '../../types';

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
    priority: 'normal',
    notes: 'Important article',
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

  // Mock raw database response for testing
  const mockRawQueueItem = {
    id: 'queue-item-1',
    user_id: 'user-123',
    newsletter_id: 'newsletter-1',
    position: 1,
    added_at: '2024-01-01T00:00:00Z',
    priority: 'normal',
    notes: 'Important article',
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
      newsletter_sources: null,
      tags: [],
    },
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
    it('should fetch all reading queue items', async () => {
      const mockData = [mockRawQueueItem];

      // Mock the final method in the chain to return data
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await readingQueueApi.getAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('reading_queue');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('position', { ascending: true });
      expect(result).toEqual([mockReadingQueueItem]);
    });

    it('should apply limit when provided', async () => {
      const mockData = [mockRawQueueItem];

      // Mock the chain: select().eq().order().limit() should resolve
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: mockData,
        error: null,
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
  });

  describe('getById', () => {
    it('should fetch reading queue item by ID', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockRawQueueItem,
        error: null,
      });

      const result = await readingQueueApi.getById('queue-item-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('reading_queue');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'queue-item-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(result).toEqual(mockReadingQueueItem);
    });

    it('should return null when item not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await readingQueueApi.getById('non-existent');

      expect(result).toBeNull();
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
