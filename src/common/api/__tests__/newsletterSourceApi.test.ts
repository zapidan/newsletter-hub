import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { newsletterSourceApi } from '../newsletterSourceApi';
import { supabase } from '../supabaseClient';
import { NewsletterSource } from '../../types';
import {
  NewsletterSourceQueryParams,
  CreateNewsletterSourceParams,
  UpdateNewsletterSourceParams,
} from '../../types/api';

// Mock dependencies
vi.mock('../supabaseClient');

const mockSupabase = vi.mocked(supabase);

describe('newsletterSourceApi', () => {
  const mockUser = { id: 'user-123' };

  const mockNewsletterSource: NewsletterSource = {
    id: 'source-1',
    name: 'Test Newsletter',
    from: 'test@example.com',
    user_id: 'user-123',
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    newsletter_count: 0,
    unread_count: 0,
  };

  const createMockQueryBuilder = () => {
    const mockQueryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      in: vi.fn(),
      neq: vi.fn(),
      not: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      range: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      then: vi.fn(),
    };

    // Make all methods return this for chaining
    Object.keys(mockQueryBuilder).forEach((key) => {
      if (key !== 'single' && key !== 'then') {
        mockQueryBuilder[key as keyof typeof mockQueryBuilder] = vi
          .fn()
          .mockReturnValue(mockQueryBuilder);
      }
    });

    // Make the query builder thenable so it can be awaited
    mockQueryBuilder.then = vi.fn((resolve, reject) => {
      return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
    });

    return mockQueryBuilder;
  };

  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

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
    it('should fetch all newsletter sources with default parameters', async () => {
      const mockData = [mockNewsletterSource];
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: mockData, error: null, count: 1 }).then(resolve);
      });

      const result = await newsletterSourceApi.getAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_sources');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(1);
    });

    it('should apply search filter when provided', async () => {
      const params: NewsletterSourceQueryParams = { search: 'test' };
      mockQueryBuilder.single.mockResolvedValue({
        data: [mockNewsletterSource],
        error: null,
        count: 1,
      });

      await newsletterSourceApi.getAll(params);

      expect(mockQueryBuilder.or).toHaveBeenCalledWith('name.ilike.%test%, from.ilike.%test%');
    });

    it('should exclude archived when requested', async () => {
      const params: NewsletterSourceQueryParams = { excludeArchived: true };
      mockQueryBuilder.single.mockResolvedValue({
        data: [mockNewsletterSource],
        error: null,
        count: 1,
      });

      await newsletterSourceApi.getAll(params);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_archived', false);
    });

    it('should apply ordering and pagination', async () => {
      const params: NewsletterSourceQueryParams = {
        orderBy: 'name',
        ascending: true,
        limit: 10,
        offset: 20,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: [mockNewsletterSource],
        error: null,
        count: 1,
      });

      await newsletterSourceApi.getAll(params);

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('should include newsletter counts when requested', async () => {
      const params: NewsletterSourceQueryParams = { includeCount: true };

      // Mock newsletter sources query
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [mockNewsletterSource],
          error: null,
          count: 1,
        }).then(resolve);
      });

      // Mock newsletter counts queries with separate query builders
      const totalCountsQueryBuilder = createMockQueryBuilder();
      totalCountsQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ newsletter_source_id: 'source-1' }],
          error: null,
        }).then(resolve);
      });

      const unreadCountsQueryBuilder = createMockQueryBuilder();
      unreadCountsQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ newsletter_source_id: 'source-1' }],
          error: null,
        }).then(resolve);
      });

      // Setup mockSupabase.from to return different query builders for each call
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        callCount++;
        if (table === 'newsletter_sources' && callCount === 1) {
          return mockQueryBuilder;
        } else if (table === 'newsletters' && callCount === 2) {
          return totalCountsQueryBuilder;
        } else if (table === 'newsletters' && callCount === 3) {
          return unreadCountsQueryBuilder;
        }
        return mockQueryBuilder;
      });

      const result = await newsletterSourceApi.getAll(params);

      expect(result.data[0].newsletter_count).toBe(1);
      expect(result.data[0].unread_count).toBe(1);
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database error', code: '42P01' };
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: null, error: mockError }).then(resolve);
      });

      await expect(newsletterSourceApi.getAll()).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should fetch newsletter source by ID', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: mockNewsletterSource,
        error: null,
      });

      const result = await newsletterSourceApi.getById('source-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_sources');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'source-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual(mockNewsletterSource);
    });

    it('should return null when source not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await newsletterSourceApi.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include counts when requested', async () => {
      const mockData = mockNewsletterSource;

      // Mock the single() method for the main query
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      // Mock newsletter counts queries with separate query builders
      const totalCountsQueryBuilder = createMockQueryBuilder();
      totalCountsQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ newsletter_source_id: 'source-1' }],
          error: null,
        }).then(resolve);
      });

      const unreadCountsQueryBuilder = createMockQueryBuilder();
      unreadCountsQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ newsletter_source_id: 'source-1' }],
          error: null,
        }).then(resolve);
      });

      // Setup mockSupabase.from to return different query builders for each call
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        callCount++;
        if (table === 'newsletter_sources' && callCount === 1) {
          return mockQueryBuilder;
        } else if (table === 'newsletters' && callCount === 2) {
          return totalCountsQueryBuilder;
        } else if (table === 'newsletters' && callCount === 3) {
          return unreadCountsQueryBuilder;
        }
        return mockQueryBuilder;
      });

      const result = await newsletterSourceApi.getById('source-1', true);

      expect(result).toBeTruthy();
      expect(result!.newsletter_count).toBe(1);
      expect(result!.unread_count).toBe(1);
    });
  });

  describe('create', () => {
    const createParams: CreateNewsletterSourceParams = {
      name: 'New Newsletter',
      from: 'new@example.com',
    };

    it('should create a new newsletter source', async () => {
      // Mock duplicate check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock insert
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockNewsletterSource,
        error: null,
      });

      const result = await newsletterSourceApi.create(createParams);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_sources');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: createParams.name,
        from: createParams.from.toLowerCase(),
        user_id: mockUser.id,
        is_archived: false,
      });
      expect(result).toEqual(mockNewsletterSource);
    });

    it('should validate required fields', async () => {
      await expect(
        newsletterSourceApi.create({ name: '', from: 'test@example.com' })
      ).rejects.toThrow('Newsletter source name is required');

      await expect(newsletterSourceApi.create({ name: 'Test', from: '' })).rejects.toThrow(
        'Newsletter source from email is required'
      );
    });

    it('should prevent duplicate from emails', async () => {
      // Mock existing source found
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'existing-id' },
        error: null,
      });

      await expect(newsletterSourceApi.create(createParams)).rejects.toThrow(
        'A newsletter source with this from email already exists'
      );
    });
  });

  describe('update', () => {
    const updateParams: UpdateNewsletterSourceParams = {
      id: 'source-1',
      name: 'Updated Newsletter',
      from: 'updated@example.com',
    };

    it('should update newsletter source', async () => {
      // Mock duplicate check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...mockNewsletterSource, ...updateParams },
        error: null,
      });

      const result = await newsletterSourceApi.update(updateParams);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', updateParams.id);
      expect(result.name).toBe(updateParams.name);
    });

    it('should validate update fields', async () => {
      await expect(newsletterSourceApi.update({ id: 'source-1', name: '' })).rejects.toThrow(
        'Newsletter source name cannot be empty'
      );

      await expect(newsletterSourceApi.update({ id: 'source-1', from: '' })).rejects.toThrow(
        'Newsletter source from email cannot be empty'
      );
    });

    it('should check for duplicate emails on update', async () => {
      // Mock existing source with different ID found
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'different-id' },
        error: null,
      });

      await expect(newsletterSourceApi.update(updateParams)).rejects.toThrow(
        'A newsletter source with this from email already exists'
      );
    });
  });

  describe('delete', () => {
    it('should delete newsletter source without associated newsletters', async () => {
      // Mock check for associated newsletters
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock delete
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await newsletterSourceApi.delete('source-1');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'source-1');
      expect(result).toBe(true);
    });

    it('should prevent deletion when newsletters exist', async () => {
      // Mock newsletters found - need to setup separate mock for newsletter check
      const newsletterCheckQueryBuilder = createMockQueryBuilder();
      newsletterCheckQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ id: 'newsletter-1' }],
          error: null,
        }).then(resolve);
      });

      // Setup mockSupabase.from to return different query builders
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        callCount++;
        if (table === 'newsletters' && callCount === 1) {
          return newsletterCheckQueryBuilder;
        }
        return mockQueryBuilder;
      });

      await expect(newsletterSourceApi.delete('source-1')).rejects.toThrow(
        'Cannot delete newsletter source that has associated newsletters'
      );
    });
  });

  describe('toggleArchive', () => {
    it('should toggle archive status', async () => {
      // Mock getById
      const getByIdSpy = vi
        .spyOn(newsletterSourceApi, 'getById')
        .mockResolvedValue(mockNewsletterSource);

      // Mock update
      const updateSpy = vi
        .spyOn(newsletterSourceApi, 'update')
        .mockResolvedValue({ ...mockNewsletterSource, is_archived: true });

      const result = await newsletterSourceApi.toggleArchive('source-1');

      expect(getByIdSpy).toHaveBeenCalledWith('source-1');
      expect(updateSpy).toHaveBeenCalledWith({
        id: 'source-1',
        is_archived: !mockNewsletterSource.is_archived,
      });
      expect(result.is_archived).toBe(true);
    });

    it('should throw error if source not found', async () => {
      vi.spyOn(newsletterSourceApi, 'getById').mockResolvedValue(null);

      await expect(newsletterSourceApi.toggleArchive('nonexistent')).rejects.toThrow(
        'Newsletter source not found'
      );
    });
  });

  describe('bulkArchive', () => {
    it('should archive multiple sources successfully', async () => {
      const ids = ['source-1', 'source-2'];
      const mockData = [
        { ...mockNewsletterSource, id: 'source-1', is_archived: true },
        { ...mockNewsletterSource, id: 'source-2', is_archived: true },
      ];

      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: mockData,
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceApi.bulkArchive(ids);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_archived: true,
        updated_at: expect.any(String),
      });
      expect(mockQueryBuilder.in).toHaveBeenCalledWith('id', ids);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should handle bulk archive errors', async () => {
      const ids = ['source-1', 'source-2'];
      const mockError = { message: 'Database error' };

      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: null,
          error: mockError,
        }).then(resolve);
      });

      const result = await newsletterSourceApi.bulkArchive(ids);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(2);
      expect(result.errors.every((e) => e?.message === 'Database error')).toBe(true);
    });
  });

  describe('bulkUnarchive', () => {
    it('should unarchive multiple sources successfully', async () => {
      const ids = ['source-1', 'source-2'];
      const mockData = [
        { ...mockNewsletterSource, id: 'source-1', is_archived: false },
        { ...mockNewsletterSource, id: 'source-2', is_archived: false },
      ];

      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: mockData,
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceApi.bulkUnarchive(ids);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_archived: false,
        updated_at: expect.any(String),
      });
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple sources successfully', async () => {
      const updates = [
        { id: 'source-1', updates: { name: 'Updated 1' } },
        { id: 'source-2', updates: { name: 'Updated 2' } },
      ];

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { ...mockNewsletterSource, id: 'source-1', name: 'Updated 1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...mockNewsletterSource, id: 'source-2', name: 'Updated 2' },
          error: null,
        });

      const result = await newsletterSourceApi.bulkUpdate(updates);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results[0]?.name).toBe('Updated 1');
      expect(result.results[1]?.name).toBe('Updated 2');
    });

    it('should handle partial failures in bulk update', async () => {
      const updates = [
        { id: 'source-1', updates: { name: 'Updated 1' } },
        { id: 'source-2', updates: { name: 'Updated 2' } },
      ];

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { ...mockNewsletterSource, id: 'source-1', name: 'Updated 1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Update failed' },
        });

      const result = await newsletterSourceApi.bulkUpdate(updates);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results[0]).toBeTruthy();
      expect(result.results[1]).toBeNull();
      expect(result.errors[1]?.message).toBe('Update failed');
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple sources successfully', async () => {
      const ids = ['source-1', 'source-2'];

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await newsletterSourceApi.bulkDelete(ids);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results).toEqual([true, true]);
    });

    it('should handle partial failures in bulk delete', async () => {
      const ids = ['source-1', 'source-2'];

      // Setup mock to return different results for successive calls
      let callCount = 0;
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        } else {
          return Promise.resolve({ data: null, error: { message: 'Delete failed' } }).then(resolve);
        }
      });

      const result = await newsletterSourceApi.bulkDelete(ids);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results[0]).toBe(true);
      expect(result.results[1]).toBeNull();
      expect(result.errors[1]?.message).toBe('Delete failed');
    });
  });

  describe('search', () => {
    it('should delegate to getAll with search params', async () => {
      const getAllSpy = vi.spyOn(newsletterSourceApi, 'getAll').mockResolvedValue({
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      });

      await newsletterSourceApi.search('test query', { limit: 10 });

      expect(getAllSpy).toHaveBeenCalledWith({
        search: 'test query',
        limit: 10,
      });
    });
  });

  describe('getWithCounts', () => {
    it('should delegate to getAll with includeCount=true', async () => {
      const getAllSpy = vi.spyOn(newsletterSourceApi, 'getAll').mockResolvedValue({
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      });

      await newsletterSourceApi.getWithCounts({ limit: 10 });

      expect(getAllSpy).toHaveBeenCalledWith({
        includeCount: true,
        limit: 10,
      });
    });
  });

  describe('getActive', () => {
    it('should delegate to getAll with excludeArchived=true', async () => {
      const getAllSpy = vi.spyOn(newsletterSourceApi, 'getAll').mockResolvedValue({
        data: [mockNewsletterSource],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      });

      await newsletterSourceApi.getActive({ limit: 10 });

      expect(getAllSpy).toHaveBeenCalledWith({
        excludeArchived: true,
        limit: 10,
      });
    });
  });

  describe('getArchived', () => {
    it('should fetch only archived sources', async () => {
      const archivedSource = { ...mockNewsletterSource, is_archived: true, newsletter_count: 0 };

      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: [archivedSource], error: null, count: 1 }).then(resolve);
      });

      const result = await newsletterSourceApi.getArchived();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_archived', true);
      expect(result.data).toEqual([archivedSource]);
    });
  });

  describe('getStats', () => {
    it('should return source statistics', async () => {
      // Mock sources query
      let callCount = 0;
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: [{ is_archived: false }, { is_archived: false }, { is_archived: true }],
            error: null,
          }).then(resolve);
        } else {
          return Promise.resolve({
            data: [{ newsletter_source_id: 'source-1' }, { newsletter_source_id: 'source-2' }],
            error: null,
          }).then(resolve);
        }
      });

      const result = await newsletterSourceApi.getStats();

      expect(result).toEqual({
        total: 3,
        active: 2,
        archived: 1,
        totalNewsletters: 2,
      });
    });

    it('should handle empty stats', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await newsletterSourceApi.getStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        archived: 0,
        totalNewsletters: 0,
      });
    });
  });
});
