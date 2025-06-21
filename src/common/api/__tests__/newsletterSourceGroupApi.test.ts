import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSourceGroup } from '../../types';
import {
  UpdateNewsletterSourceGroupParams
} from '../../types/api';
import { newsletterSourceGroupApi } from '../newsletterSourceGroupApi';
import { supabase } from '../supabaseClient';

// Mock dependencies
vi.mock('../supabaseClient');

const mockSupabase = vi.mocked(supabase);

describe('newsletterSourceGroupApi', () => {
  const mockUser = { id: 'user-123' };

  const mockNewsletterSourceGroup: NewsletterSourceGroup = {
    id: 'group-1',
    name: 'Tech Newsletters',
    user_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    sources: [],
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
      ilike: vi.fn(),
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
    it('should fetch all newsletter source groups with default parameters', async () => {
      const mockData = [mockNewsletterSourceGroup];
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: mockData, error: null }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.getAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(`
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual(mockData);
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database error', code: '42P01' };
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: null, error: mockError }).then(resolve);
      });

      await expect(newsletterSourceGroupApi.getAll()).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should fetch newsletter source group by ID', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: mockNewsletterSourceGroup,
        error: null,
      });

      const result = await newsletterSourceGroupApi.getById('group-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'group-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual(mockNewsletterSourceGroup);
    });

    it('should return null when group not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await newsletterSourceGroupApi.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database error', code: 'OTHER_ERROR' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(newsletterSourceGroupApi.getById('group-1')).rejects.toThrow();
    });
  });

  describe('create', () => {

    it('should create a new newsletter source group', async () => {
      const createParams = { name: 'New Group', sourceIds: ['source-1'] };

      // Mock insert operation
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: 'new-group-id', name: 'New Group', user_id: 'user-123' },
        error: null,
      });

      // Mock getById call that happens after creation
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(mockNewsletterSourceGroup);

      const result = await newsletterSourceGroupApi.create(createParams);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: createParams.name,
        user_id: mockUser.id,
      });
      expect(result).toEqual(mockNewsletterSourceGroup);
    });

    it('should create group without source_ids', async () => {
      const paramsWithoutSources = { name: 'Empty Group', sourceIds: [] };

      // Mock insert operation
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: 'new-group-id', name: 'Empty Group', user_id: 'user-123' },
        error: null,
      });

      // Mock getById call that happens after creation
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue({
        ...mockNewsletterSourceGroup,
        name: 'Empty Group',
      });

      const result = await newsletterSourceGroupApi.create(paramsWithoutSources);

      expect(result.name).toBe('Empty Group');
    });
  });

  describe('update', () => {
    const updateParams: UpdateNewsletterSourceGroupParams = {
      id: 'group-1',
      name: 'Updated Tech Group',
      sourceIds: ['source-1', 'source-3'],
    };

    it('should update newsletter source group', async () => {
      // Mock update operation that uses .select().single()
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: updateParams.id, name: updateParams.name, user_id: 'user-123' },
        error: null,
      });

      // Mock the members query chain
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        callCount++;
        if (table === 'newsletter_source_groups' && callCount === 1) {
          return mockQueryBuilder;
        }
        // For members queries, return a simple mock
        return createMockQueryBuilder();
      });

      // Mock getById call that happens at the end
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue({
        ...mockNewsletterSourceGroup,
        ...updateParams,
      });

      const result = await newsletterSourceGroupApi.update(updateParams);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ name: updateParams.name });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', updateParams.id);
      expect(result.name).toBe(updateParams.name);
    });

    it('should update only provided fields', async () => {
      const partialUpdate = { id: 'group-1', name: 'New Name Only', sourceIds: [] };

      // Mock update operation that uses .select().single()
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: partialUpdate.id, name: partialUpdate.name, user_id: 'user-123' },
        error: null,
      });

      // Mock the members query chain
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation((table) => {
        callCount++;
        if (table === 'newsletter_source_groups' && callCount === 1) {
          return mockQueryBuilder;
        }
        // For members queries, return a simple mock
        return createMockQueryBuilder();
      });

      // Mock getById call that happens at the end
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue({
        ...mockNewsletterSourceGroup,
        name: 'New Name Only',
      });

      await newsletterSourceGroupApi.update(partialUpdate);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ name: 'New Name Only' });
    });
  });

  describe('delete', () => {
    it('should delete newsletter source group', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await newsletterSourceGroupApi.delete('group-1');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'group-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const mockError = { message: 'Delete failed', code: '42P01' };
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: null, error: mockError }).then(resolve);
      });

      await expect(newsletterSourceGroupApi.delete('group-1')).rejects.toThrow();
    });
  });

  describe('addSources', () => {
    it('should add sources to group', async () => {
      const sourcesToAdd = ['source-3', 'source-4'];

      // Mock getById for group verification
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(mockNewsletterSourceGroup);

      // Mock the insert operation
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: sourcesToAdd.map((id) => ({ source: { id } })),
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.addSources({
        groupId: 'group-1',
        sourceIds: sourcesToAdd,
      });

      expect(result).toHaveLength(2);
    });

    it('should handle duplicate sources gracefully', async () => {
      const sourcesToAdd = ['source-1', 'source-3']; // source-1 already exists

      // Mock getById for group verification
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(mockNewsletterSourceGroup);

      // Mock the insert operation (will handle duplicates internally)
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [{ source: { id: 'source-3' } }], // only new sources returned
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.addSources({
        groupId: 'group-1',
        sourceIds: sourcesToAdd,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('source-3');
    });

    it('should throw error if group not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(null);

      await expect(
        newsletterSourceGroupApi.addSources({ groupId: 'nonexistent', sourceIds: ['source-1'] })
      ).rejects.toThrow('Group not found');
    });
  });

  describe('removeSources', () => {
    it('should remove sources from group', async () => {
      const sourcesToRemove = ['source-1'];

      // Mock getById for group verification
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(mockNewsletterSourceGroup);

      // Mock the delete operation
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: null,
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.removeSources({
        groupId: 'group-1',
        sourceIds: sourcesToRemove,
      });

      expect(result).toBe(true);
    });

    it('should handle non-existent sources gracefully', async () => {
      const sourcesToRemove = ['source-999']; // doesn't exist

      // Mock getById for group verification
      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue(mockNewsletterSourceGroup);

      // Mock the delete operation (still succeeds even if sources don't exist)
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: null,
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.removeSources({
        groupId: 'group-1',
        sourceIds: sourcesToRemove,
      });

      expect(result).toBe(true);
    });
  });

  describe('getSourceGroups', () => {
    it('should return groups containing specific source', async () => {
      const mockGroups = [mockNewsletterSourceGroup];
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: mockGroups.map((group) => ({ group })),
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.getSourceGroups('source-1');

      expect(result).toEqual(mockGroups);
    });

    it('should return empty array if no groups contain the source', async () => {
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.getSourceGroups('nonexistent-source');

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should search groups by name', async () => {
      const mockGroups = [mockNewsletterSourceGroup];
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: mockGroups,
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.search('tech');

      expect(result).toEqual(mockGroups);
    });
  });

  describe('input validation', () => {
    it('should validate group name length', async () => {
      const longName = 'x'.repeat(201); // Assuming 200 char limit

      // Mock insert with database constraint error
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'value too long', code: '22001' },
      });

      await expect(
        newsletterSourceGroupApi.create({ name: longName, sourceIds: [] })
      ).rejects.toThrow();
    });

    it('should validate source IDs format', async () => {
      const invalidSourceIds = ['', '  ', null, undefined] as any;

      // Mock insert success but getById with error
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: 'test-id', name: 'Test Group', user_id: 'user-123' },
        error: null,
      });

      vi.spyOn(newsletterSourceGroupApi, 'getById').mockResolvedValue({
        ...mockNewsletterSourceGroup,
        name: 'Test Group',
      });

      // This should not throw since the API doesn't validate source IDs format
      const result = await newsletterSourceGroupApi.create({
        name: 'Test Group',
        sourceIds: invalidSourceIds,
      });

      expect(result.name).toBe('Test Group');
    });
  });

  describe('edge cases', () => {
    it('should handle empty search queries', async () => {
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: [],
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.search('');

      expect(result).toEqual([]);
    });

    it('should handle large source arrays', async () => {
      const largeSourceArray = Array.from({ length: 1000 }, (_, i) => `source-${i}`);

      // Mock getById call
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockNewsletterSourceGroup,
        error: null,
      });

      // Mock addSources call
      mockQueryBuilder.then = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve({
          data: largeSourceArray.map((id) => ({ source: { id } })),
          error: null,
        }).then(resolve);
      });

      const result = await newsletterSourceGroupApi.addSources({
        groupId: 'group-1',
        sourceIds: largeSourceArray,
      });

      expect(result.length).toBe(1000);
    });
  });
});
