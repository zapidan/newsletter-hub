import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizedTagsApi } from '../optimizedTagsApi';
import { supabase } from '../supabaseClient';

// Define the structure of our mock query builder
type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  data: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
};

// Create a mock query builder with proper typing - chain must be thenable for update/delete awaits
const createMockQueryBuilder = (): MockQueryBuilder & { then: (resolve: (v: any) => void) => void } => {
  const resolveValue = { data: null, error: null };
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    contains: vi.fn().mockReturnThis(),
    match: vi.fn().mockResolvedValue({ data: [], error: null }),
    data: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    then: (resolve: (v: any) => void) => resolve(resolveValue),
  };
  return chain as MockQueryBuilder & { then: (resolve: (v: any) => void) => void };
};

// Create the mock instance first
const mockQueryBuilder = createMockQueryBuilder();

// Then mock the supabase client
vi.mock('../supabaseClient', () => {
  return {
    supabase: {
      rpc: vi.fn().mockReturnThis(),
      from: vi.fn().mockImplementation(() => mockQueryBuilder),
    },
    withPerformanceLogging: vi.fn((name, fn) => fn()),
    requireAuth: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  };
});

// Now we can safely get the mocked supabase client
const mockSupabase = vi.mocked(supabase);

describe('OptimizedTagsApi', () => {
  const mockUserId = 'test-user-id';
  const mockTags = [
    {
      id: 'tag-1',
      name: 'Technology',
      color: '#3b82f6',
      user_id: mockUserId,
      created_at: '2024-01-01T00:00:00Z',
      newsletter_count: 10,
    },
    {
      id: 'tag-2',
      name: 'AI',
      color: '#ef4444',
      user_id: mockUserId,
      created_at: '2024-01-01T00:00:00Z',
      newsletter_count: 5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply from mock since clearAllMocks can affect chained mock return values
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => mockQueryBuilder);
  });

  describe('getAll', () => {
    it('should get all tags for the user', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockTags,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await optimizedTagsApi.getAll();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_tags', {
        p_user_id: mockUserId,
      });
      expect(result).toEqual(mockTags);
    });

    it('should handle empty results', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await optimizedTagsApi.getAll();

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Database error',
          details: '',
          hint: '',
          code: '',
          name: 'PostgrestError'
        },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      } as any);

      await expect(optimizedTagsApi.getAll()).rejects.toThrow('Database error');
    });
  });

  describe('getNewslettersByTagsAny', () => {
    it('should get newsletters with ANY of the specified tags', async () => {
      const mockNewsletters = [
        {
          id: 'newsletter-1',
          title: 'Newsletter 1',
          tags_json: mockTags,
          total_count: 1,
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockNewsletters,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await optimizedTagsApi.getNewslettersByTagsAny(['Technology', 'AI'], {
        limit: 10,
        offset: 0,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_newsletters_by_tags_any', {
        p_user_id: mockUserId,
        p_tag_names: ['Technology', 'AI'],
        p_limit: 10,
        p_offset: 0,
        p_order_by: 'received_at',
        p_order_direction: 'DESC',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tags).toEqual(mockTags);
      expect(result.count).toBe(1);
    });
  });

  describe('getNewslettersByTagsAll', () => {
    it('should get newsletters with ALL of the specified tags', async () => {
      const mockNewsletters = [
        {
          id: 'newsletter-1',
          title: 'Newsletter 1',
          tags_json: mockTags,
          total_count: 1,
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockNewsletters,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await optimizedTagsApi.getNewslettersByTagsAll(['Technology', 'AI']);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_newsletters_by_tags_all', {
        p_user_id: mockUserId,
        p_tag_names: ['Technology', 'AI'],
        p_limit: 50,
        p_offset: 0,
        p_order_by: 'received_at',
        p_order_direction: 'DESC',
      });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getTagUsageStats', () => {
    it('should get tag usage statistics', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockTags,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as any);

      const result = await optimizedTagsApi.getTagUsageStats();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_tag_usage_stats', {
        p_user_id: mockUserId,
      });
      expect(result).toEqual(mockTags);
    });
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const newTag = {
        name: 'New Tag',
        color: '#10b981',
      };

      const result = await optimizedTagsApi.createTag(newTag);

      expect(result).toEqual({
        id: expect.any(String),
        name: 'New Tag',
        color: '#10b981',
        user_id: mockUserId,
        created_at: expect.any(String),
      });
    });
  });

  describe('updateNewsletterTags', () => {
    it('should update newsletter tags', async () => {
      const newsletterId = 'newsletter-1';
      const tags = mockTags;

      await optimizedTagsApi.updateNewsletterTags(newsletterId, tags);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', newsletterId);
    });
  });

  describe('addTagToNewsletter', () => {
    it('should add a tag to a newsletter', async () => {
      const newsletterId = 'newsletter-1';
      const tag = mockTags[0];

      // Mock getting current tags
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { tags_json: [] },
        error: null,
      });

      await optimizedTagsApi.addTagToNewsletter(newsletterId, tag);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('tags_json');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', newsletterId);
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });
  });

  describe('removeTagFromNewsletter', () => {
    it('should remove a tag from a newsletter', async () => {
      const newsletterId = 'newsletter-1';
      const tagId = 'tag-1';

      // Mock getting current tags
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { tags_json: [mockTags[0]] },
        error: null,
      });

      await optimizedTagsApi.removeTagFromNewsletter(newsletterId, tagId);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('tags_json');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', newsletterId);
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag from all newsletters', async () => {
      const tagId = 'tag-1';

      await optimizedTagsApi.deleteTag(tagId);

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith('tags_json', `[{"id": "${tagId}"}]`);
    });
  });

  describe('searchTags', () => {
    it('should search tags by name', async () => {
      const mockNewsletters = [
        {
          id: 'newsletter-1',
          tags_json: [mockTags[0]],
        },
        {
          id: 'newsletter-2',
          tags_json: [mockTags[0]],
        },
      ];

      // Mock the chain to resolve with our data (implementation uses select().eq().contains())
      (mockQueryBuilder as any).then = (resolve: (v: any) => void) =>
        resolve({ data: mockNewsletters, error: null });

      const result = await optimizedTagsApi.searchTags('Technology');

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletters');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('tags_json');
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith('tags_json', '[{"name": "Technology"}]');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Technology');
    });
  });
});
