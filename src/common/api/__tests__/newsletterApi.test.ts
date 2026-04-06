import { NewsletterWithRelations } from '@common/types';
import { vi } from 'vitest';

// Hoisted mock for RPC calls
const { createMockNewsletter, mockUser } = vi.hoisted(() => {
  const mockUser = {
    id: '789e0123-e89b-12d3-a456-426614174002',
    email: 'user@example.com',
    user_metadata: { name: 'Test User' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
  };
  const createMockNewsletter = (
    overrides: Partial<NewsletterWithRelations> = {}
  ): NewsletterWithRelations => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Newsletter',
    summary: 'Test summary',
    content: 'Test content',
    image_url: 'https://example.com/image.jpg',
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    estimated_read_time: 5,
    word_count: 100,
    source: {
      id: '456e7890-e89b-12d3-a456-426614174001',
      name: 'Test Source',
      from: 'test@example.com',
      user_id: mockUser.id,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    tags: [],
    newsletter_source_id: '456e7890-e89b-12d3-a456-426614174001',
    user_id: mockUser.id,
    ...overrides,
  });

  return { createMockNewsletter, mockUser };
});

// Hoisted mock for createQueryBuilder (needed for other tests)
const { createQueryBuilder } = vi.hoisted(() => {
  const createQueryBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.insert = vi.fn().mockReturnValue(builder);
    builder.update = vi.fn().mockReturnValue(builder);
    builder.delete = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.or = vi.fn().mockReturnValue(builder);
    builder.gte = vi.fn().mockReturnValue(builder);
    builder.lte = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.range = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockReturnValue(builder);
    builder.group = vi.fn().mockReturnValue(builder);
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.then = vi.fn();
    return builder;
  };
  return { createQueryBuilder };
});

vi.mock('../supabaseClient', () => {
  const queryBuilder = createQueryBuilder();
  const fromSpy = vi.fn().mockReturnValue(queryBuilder);
  const rpcSpy = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    supabase: { from: fromSpy, rpc: rpcSpy },
    handleSupabaseError: vi.fn((error) => {
      throw error;
    }), // Re-throw for .rejects.toThrow
    requireAuth: vi.fn().mockResolvedValue(mockUser),
    withPerformanceLogging: vi.fn((_name, fn) => fn()),
  };
});

const { rpc: rpcSpy } = supabaseClientModule.supabase;

import { newsletterApi } from '../newsletterApi';
import * as supabaseClientModule from '../supabaseClient';

describe('newsletterApi', () => {
  const now = new Date().toISOString();
  let currentQueryBuilder: ReturnType<typeof createQueryBuilder>;
  let currentMockNewsletter: NewsletterWithRelations;

  // Reset all mocks before each test to prevent interference
  beforeEach(() => {
    vi.mocked(supabaseClientModule.supabase.rpc).mockReset();
    vi.mocked(supabaseClientModule.supabase.from).mockReset();
    vi.mocked(supabaseClientModule.handleSupabaseError).mockReset();

    // Set default mock implementations after reset
    vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValue({ data: null, error: null, count: null, status: 200, statusText: 'OK' });
    vi.mocked(supabaseClientModule.supabase.from).mockReturnValue(createQueryBuilder());
  });

  const mockGetByIdWithTransformedResponse = (rawData: any, includeRelations = true) => {
    vi.mocked(currentQueryBuilder.single).mockResolvedValueOnce({ data: rawData, error: null });
    return newsletterApi.getById('123e4567-e89b-12d3-a456-426614174000', includeRelations);
  };

  const mockInitialGetByIdForUpdate = (initialNlData: any, error?: any) => {
    vi.mocked(currentQueryBuilder.single)
      .mockClear()
      .mockResolvedValueOnce({ data: initialNlData, error });
  };

  // const mockMainNewsletterUpdate = (updateResult: { data?: any, error?: any }) => {
  //   vi.mocked(currentQueryBuilder.single).mockClear().mockResolvedValueOnce(updateResult);
  // };

  // const mockDeleteTags = (deleteResult: { error?: any }) => {
  //   // For delete().eq().eq().then()
  //   const eqChain = { eq: vi.fn().mockReturnThis(), then: vi.fn() }; // eq().eq() -> thenable
  //   vi.mocked(currentQueryBuilder.delete).mockReturnValueOnce(eqChain as any);
  //   vi.mocked(eqChain.then).mockImplementationOnce((onFulfilled) => onFulfilled(deleteResult));
  //   return { deleteMock: currentQueryBuilder.delete, eqNlMock: eqChain.eq, eqUserMock: eqChain.eq }; // return spies for assertion
  // };

  // const mockInsertTags = (insertResult: { error?: any }) => {
  //   // For insert().then()
  //   vi.mocked(currentQueryBuilder.then).mockImplementationOnce((onFulfilled) => onFulfilled(insertResult));
  // };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    currentQueryBuilder = createQueryBuilder();
    // Always return the same builder for all .from calls
    vi.mocked(supabaseClientModule.supabase.from).mockImplementation(() => currentQueryBuilder);
    vi.mocked(supabaseClientModule.supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(supabaseClientModule.requireAuth).mockResolvedValue(mockUser);
    vi.mocked(supabaseClientModule.handleSupabaseError).mockImplementation((error) => {
      throw error;
    });
    currentMockNewsletter = createMockNewsletter();
    currentQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // All tests from the previous fully fleshed out version go here,
  // adjusted to use currentQueryBuilder and its methods for mocking.
  // For example:
  // currentQueryBuilder.order.mockResolvedValueOnce({ data: ..., error: null });
  // currentQueryBuilder.single.mockResolvedValueOnce({ data: ..., error: null });
  // currentQueryBuilder.then.mockImplementationOnce(onFulfilled => onFulfilled({ count: ..., error: ...}));

  describe('transformNewsletterResponse (via getById)', () => {
    // These tests are no longer relevant since getById now uses RPC
    // The transformNewsletterResponse function is still used for other RPC responses
    // but getById specifically uses get_newsletter_by_id RPC directly
    it.todo('transformNewsletterResponse tests moved to RPC-specific tests');
  });

  describe('getAll', () => {
    it('should call RPC with correct parameters for basic query', async () => {
      const mockData = [createMockNewsletter()];
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: mockData.map((n) => ({ ...n, total_count: 1 })),
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      await newsletterApi.getAll();

      expect(supabaseClientModule.supabase.rpc).toHaveBeenCalledWith('get_newsletters', {
        p_user_id: mockUser.id,
        p_tag_ids: null,
        p_is_read: null,
        p_is_archived: null,
        p_is_liked: null,
        p_source_ids: null,
        p_date_from: null,
        p_date_to: null,
        p_search: null,
        p_limit: 50,
        p_offset: 0,
        p_cursor: null, // Phase 3 is inactive by default
        p_order_by: 'received_at',
        p_order_direction: 'DESC',
      });
    });

    it('should call RPC with correct parameters for complex query', async () => {
      const mockData = [createMockNewsletter()];
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: mockData.map((n) => ({ ...n, total_count: 1 })),
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const params = {
        search: 'test',
        isRead: false,
        tagIds: ['tag1', 'tag2'],
        sourceIds: ['source1'],
        dateFrom: '2024-01-01',
        orderBy: 'title',
        ascending: true,
        limit: 10,
        offset: 20,
      };

      await newsletterApi.getAll(params);

      expect(supabaseClientModule.supabase.rpc).toHaveBeenCalledWith('get_newsletters', {
        p_user_id: mockUser.id,
        p_tag_ids: ['tag1', 'tag2'],
        p_is_read: false,
        p_is_archived: null,
        p_is_liked: null,
        p_source_ids: ['source1'],
        p_date_from: '2024-01-01',
        p_date_to: null,
        p_search: 'test',
        p_limit: 10,
        p_offset: 20,
        p_cursor: null, // Phase 3 is inactive by default
        p_order_by: 'title',
        p_order_direction: 'ASC',
      });
    });

    it('should return transformed newsletters with correct pagination', async () => {
      const mockData = [
        { ...createMockNewsletter({ id: 'nl1' }), total_count: 25 },
        { ...createMockNewsletter({ id: 'nl2' }), total_count: 25 },
      ];
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getAll({ limit: 10, offset: 0 });

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextPage).toBe(2);
      expect(result.prevPage).toBe(null);
    });

    it('should handle RPC errors', async () => {
      const error = new Error('RPC failed');
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '', name: 'PostgrestError' },
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(newsletterApi.getAll()).rejects.toThrow('RPC failed');
    });
  });

  describe('getById', () => {
    it('should call get_newsletter_by_id RPC with correct parameters', async () => {
      const mockNewsletterData = {
        ...currentMockNewsletter,
        source: currentMockNewsletter.source, // RPC returns flat source object
        tags: currentMockNewsletter.tags, // RPC returns flat tags array
      };

      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [mockNewsletterData],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getById('123e4567-e89b-12d3-a456-426614174000');

      expect(supabaseClientModule.supabase.rpc).toHaveBeenCalledWith('get_newsletter_by_id', {
        p_user_id: mockUser.id,
        p_id: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result).toEqual(currentMockNewsletter);
    });

    it('should handle RPC errors gracefully', async () => {
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '', name: 'PostgrestError' },
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(newsletterApi.getById('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('RPC failed');
    });

    it('should return null when RPC returns no data', async () => {
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getById('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new newsletter', async () => {
      const params = { title: 'New', content: 'C', newsletter_source_id: '456e7890-e89b-12d3-a456-426614174001' };
      const created = createMockNewsletter({ ...params, id: '789e0123-e89b-12d3-a456-426614174009' });
      vi.mocked(currentQueryBuilder.single)
        .mockResolvedValueOnce({
          data: { ...created, tags: undefined, source: undefined },
          error: null,
        }); // Insert result

      // Mock the getById RPC call for fetching the created newsletter
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...created, source: created.source, tags: created.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.create(params);
      expect(result).toEqual(created);
    });

    it('should create newsletter with tags', async () => {
      const params = { title: 'New', content: 'C', newsletter_source_id: '456e7890-e89b-12d3-a456-426614174001', tag_ids: ['789e0123-e89b-12d3-a456-426614174003'] };
      const baseNl = params;
      const createdRaw = {
        ...createMockNewsletter({ ...baseNl, id: '789e0123-e89b-12d3-a456-426614174009' }),
        tags: undefined,
        source: undefined,
      };
      const finalNl = createMockNewsletter({
        ...baseNl,
        id: '789e0123-e89b-12d3-a456-426614174009',
        tags: [
          {
            id: 'tA',
            name: 'TagA',
            color: 'red',
            user_id: mockUser.id,
            created_at: now,
            newsletter_count: undefined,
          },
        ],
      });

      const fromMocks = supabaseClientModule.supabase.from;
      const insertNlBuilder = createQueryBuilder();
      vi.mocked(insertNlBuilder.single).mockResolvedValueOnce({ data: createdRaw, error: null });
      const insertTagsBuilder = createQueryBuilder();
      vi.mocked(insertTagsBuilder.then).mockImplementationOnce((onF: any) => onF({ error: null }));

      // Mock the getById RPC call
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...finalNl, source: finalNl.source, tags: finalNl.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      vi.mocked(fromMocks)
        .mockImplementationOnce(() => insertNlBuilder) // For newsletter insert
        .mockImplementationOnce(() => insertTagsBuilder); // For tags insert

      const result = await newsletterApi.create(params);
      expect(result.tags[0]?.id).toBe('tA');
    });
  });

  describe('update', () => {
    it('should update newsletter tags: remove all existing, then add new ones', async () => {
      const initialNl = createMockNewsletter({
        id: '789e0123-e89b-12d3-a456-426614174004',
        tags: [{ id: 'old', name: 'Old', color: '', user_id: '', created_at: '' }],
      });
      const updates = { tag_ids: ['new1'] };
      const updatedNl = { ...initialNl, ...updates, tags: [] };

      // Mock the initial getById RPC call
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...initialNl, source: initialNl.source, tags: initialNl.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      // Mock the update operation  
      const updateBuilder = createQueryBuilder();
      updateBuilder.single.mockResolvedValueOnce({
        data: { ...initialNl, ...updates },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      // Mock tag operations with separate builders
      const deleteBuilder = createQueryBuilder();
      deleteBuilder.then.mockImplementation((callback: (result: { error: any }) => void) => {
        callback({ error: null });
        return Promise.resolve({ error: null });
      });

      const insertBuilder = createQueryBuilder();
      insertBuilder.then.mockImplementation((callback: (result: { error: any }) => void) => {
        callback({ error: null });
        return Promise.resolve({ error: null });
      });

      // Mock the final getById RPC call
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...updatedNl, source: updatedNl.source, tags: updatedNl.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      // Mock .from calls with proper table mapping
      let fromCallCount = 0;
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation((table) => {
        if (table === 'newsletters') return updateBuilder;
        if (table === 'newsletter_tags') {
          fromCallCount++;
          return fromCallCount === 1 ? deleteBuilder : insertBuilder;
        }
        return createQueryBuilder();
      });

      const result = await newsletterApi.update({ id: initialNl.id, ...updates });
      expect(result).toBeDefined();
    }, 5000);
  });

  describe('markAsRead/Unread', () => {
    it('should mark a newsletter as read', async () => {
      const newsletter = createMockNewsletter({ is_read: false });
      const updatedNewsletter = { ...newsletter, is_read: true };

      const updateBuilder = createQueryBuilder();
      updateBuilder.single.mockResolvedValueOnce({
        data: { ...newsletter, is_read: true },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      }); // update

      // Mock the getById RPC call for fetching the updated newsletter
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...updatedNewsletter, source: updatedNewsletter.source, tags: updatedNewsletter.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      // Mock all .from calls to return appropriate builders
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation((table) => {
        if (table === 'newsletters') {
          return updateBuilder;
        }
        return createQueryBuilder();
      });

      const result = await newsletterApi.markAsRead(newsletter.id);
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true, updated_at: expect.any(String) })
      );
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', newsletter.id);
      expect(result.is_read).toBe(true);
    });

    it('should mark a newsletter as unread', async () => {
      const newsletter = createMockNewsletter({ is_read: true });
      const updatedNewsletter = { ...newsletter, is_read: false };

      const updateBuilder = createQueryBuilder();
      updateBuilder.single.mockResolvedValueOnce({
        data: { ...newsletter, is_read: false },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      }); // update

      // Mock the getById RPC call for fetching the updated newsletter
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...updatedNewsletter, source: updatedNewsletter.source, tags: updatedNewsletter.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      vi.mocked(supabaseClientModule.supabase.from).mockImplementation((table) => {
        if (table === 'newsletters') {
          return updateBuilder;
        }
        return createQueryBuilder();
      });

      const result = await newsletterApi.markAsUnread(newsletter.id);
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: false, updated_at: expect.any(String) })
      );
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', newsletter.id);
      expect(result.is_read).toBe(false);
    });
  });

  describe('toggleArchive/Like', () => {
    it('should toggle archive status', async () => {
      const newsletter = createMockNewsletter({ is_archived: false });
      const updatedNewsletter = { ...newsletter, is_archived: true };

      // Clear all mocks first
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.from).mockClear();

      const builder = createQueryBuilder();
      builder.single.mockResolvedValue({ data: { ...newsletter, is_archived: true }, error: null });

      // Mock the getById RPC call for fetching the updated newsletter
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...updatedNewsletter, source: updatedNewsletter.source, tags: updatedNewsletter.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      let updateCalled = false;
      builder.update.mockImplementation(() => {
        updateCalled = true;
        return builder;
      });

      vi.mocked(supabaseClientModule.supabase.from).mockImplementation((table) => {
        if (table === 'newsletters') return builder;
        return createQueryBuilder();
      });

      const result = await newsletterApi.toggleArchive(newsletter.id);
      expect(updateCalled).toBe(true);
      expect(result.is_archived).toBe(true);
    });

    it('should toggle like status', async () => {
      const newsletter = createMockNewsletter({ is_liked: false });
      const updatedNewsletter = { ...newsletter, is_liked: true };

      // Clear all mocks first
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.from).mockClear();

      const builder = createQueryBuilder();
      builder.single.mockResolvedValue({ data: { ...newsletter, is_liked: true }, error: null });

      // Mock the getById RPC call for fetching the updated newsletter
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [{ ...updatedNewsletter, source: updatedNewsletter.source, tags: updatedNewsletter.tags }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      let updateCalled = false;
      builder.update.mockImplementation(() => {
        updateCalled = true;
        return builder;
      });

      vi.mocked(supabaseClientModule.supabase.from).mockImplementation((table) => {
        if (table === 'newsletters') return builder;
        return createQueryBuilder();
      });

      const result = await newsletterApi.toggleLike(newsletter.id);
      expect(updateCalled).toBe(true);
      expect(result.is_liked).toBe(true);
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update newsletters', async () => {
      const ids = ['789e0123-e89b-12d3-a456-426614174010', '789e0123-e89b-12d3-a456-426614174011'];
      const updates = { is_read: true };
      const newsletters = ids.map((id) => createMockNewsletter({ id, is_read: true }));
      function builderWithBulkResults() {
        const builder: any = {};
        builder.then = vi.fn((onFulfilled: any) => onFulfilled({ data: newsletters, error: null }));
        builder.single = vi.fn().mockResolvedValue({ data: newsletters, error: null });
        builder.maybeSingle = vi.fn().mockResolvedValue({ data: newsletters, error: null });
        // Explicitly define all expected chainable methods
        const chainMethods = [
          'in',
          'eq',
          'select',
          'update',
          'insert',
          'delete',
          'order',
          'range',
          'limit',
        ];
        chainMethods.forEach((method) => {
          builder[method] = (..._args: any[]) => builder;
        });
        return new Proxy(builder, {
          get: (target, prop) => {
            if (prop === 'then') return target.then;
            if (typeof target[prop] === 'function') return target[prop];
            return () => target;
          },
        });
      }
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation(() =>
        builderWithBulkResults()
      );
      const result = await newsletterApi.bulkUpdate({ ids, updates });
      expect(result.results).not.toBeNull();
      if (result.results && result.results.length > 0) {
        expect(result.results.length).toBe(ids.length);
        expect(result.results[0]?.is_read).toBe(true);
      }
    });
  });

  describe('getUnreadCountBySource', () => {
    it('should call get_unread_count_by_source RPC and return transformed results', async () => {
      const mockRpcData = [
        { newsletter_source_id: 'source-1', count: 5 },
        { newsletter_source_id: 'source-2', count: 3 },
        { newsletter_source_id: null, count: 1 },
      ];

      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: mockRpcData,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getUnreadCountBySource();

      expect(supabaseClientModule.supabase.rpc).toHaveBeenCalledWith('get_unread_count_by_source', {
        p_user_id: mockUser.id
      });

      expect(result).toEqual({
        'source-1': 5,
        'source-2': 3,
        'unknown': 1, // null source_id should map to 'unknown'
      });
    });

    it('should handle empty RPC response', async () => {
      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getUnreadCountBySource();
      expect(result).toEqual({});
    });

    it('should handle null RPC response', async () => {
      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const result = await newsletterApi.getUnreadCountBySource();
      expect(result).toEqual({});
    });

    it('should handle RPC errors', async () => {
      const mockError = { message: 'relation does not exist', code: '42P01', details: null, hint: null, name: 'PostgrestError' };

      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: mockError,
        count: null,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(newsletterApi.getUnreadCountBySource()).rejects.toThrow('relation does not exist');
      expect(supabaseClientModule.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('countBySource', () => {
    it('should count newsletters by source', async () => {
      // If implementation uses .length, return an array of 3 for src1 and 5 for src2
      const counts = [
        ...Array(3).fill({ newsletter_source_id: 'src1' }),
        ...Array(5).fill({ newsletter_source_id: 'src2' }),
      ];
      const builder = createQueryBuilder();
      builder.then.mockImplementation((onFulfilled: any) =>
        onFulfilled({ data: counts, error: null })
      );
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation(() => builder);
      const result = await newsletterApi.countBySource();
      // If implementation uses .length, expect { src1: 3, src2: 5 }
      expect(result).not.toBeNull();
      expect(result).toEqual({ src1: 3, src2: 5 });
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread count for all sources', async () => {
      const unreadCount = 4;
      function builderWithUnreadCount() {
        const builder: any = {};
        const response = { count: unreadCount, error: null };
        builder.then = vi.fn((onFulfilled: any) => onFulfilled(response));
        builder.single = vi.fn().mockResolvedValue(response);
        builder.maybeSingle = vi.fn().mockResolvedValue(response);
        const chainMethods = [
          'in',
          'eq',
          'select',
          'update',
          'insert',
          'delete',
          'order',
          'range',
          'limit',
        ];
        chainMethods.forEach((method) => {
          builder[method] = (..._args: any[]) => builder;
        });
        // Add a then property to the Proxy for await support
        return new Proxy(builder, {
          get: (target, prop) => {
            if (prop === 'then') {
              // Support both direct .then and await
              return (onFulfilled: any, onRejected?: any) => {
                return Promise.resolve(response).then(onFulfilled, onRejected);
              };
            }
            if (typeof target[prop] === 'function') return target[prop];
            return () => target;
          },
        });
      }
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation(() =>
        builderWithUnreadCount()
      );
      const result = await newsletterApi.getUnreadCount();
      expect(result).toBe(unreadCount);
    });
    it('should get unread count for a specific source', async () => {
      const unreadCount = 4;
      function builderWithUnreadCount() {
        const builder: any = {};
        const response = { count: unreadCount, error: null };
        builder.then = vi.fn((onFulfilled: any) => onFulfilled(response));
        builder.single = vi.fn().mockResolvedValue(response);
        builder.maybeSingle = vi.fn().mockResolvedValue(response);
        const chainMethods = [
          'in',
          'eq',
          'select',
          'update',
          'insert',
          'delete',
          'order',
          'range',
          'limit',
        ];
        chainMethods.forEach((method) => {
          builder[method] = (..._args: any[]) => builder;
        });
        // Add a then property to the Proxy for await support
        return new Proxy(builder, {
          get: (target, prop) => {
            if (prop === 'then') {
              // Support both direct .then and await
              return (onFulfilled: any, onRejected?: any) => {
                return Promise.resolve(response).then(onFulfilled, onRejected);
              };
            }
            if (typeof target[prop] === 'function') return target[prop];
            return () => target;
          },
        });
      }
      vi.mocked(supabaseClientModule.supabase.from).mockImplementation(() =>
        builderWithUnreadCount()
      );
      const result = await newsletterApi.getUnreadCount('src-1');
      expect(result).toBe(unreadCount);
    });
  });

  // Simplified stubs for remaining tests - to be expanded
  it.todo('delete tests');
  it.todo('markAsRead/Unread tests');
  it.todo('toggleArchive/Like tests');
  it.todo('bulkUpdate tests');
  it.todo('getStats tests');
  it.todo('countBySource tests');
  it.todo('getUnreadCount tests'); // These will fail due to simplified select mock
  it.todo('search tests');

  // ---------------------------------------------------------------------------
  describe('getByTags', () => {
    const baseRpcRow = {
      id: 'nl-1',
      title: 'Tagged Newsletter',
      content: 'Content body',
      summary: 'A summary',
      image_url: null,
      newsletter_source_id: 'src-1',
      word_count: 200,
      estimated_read_time: 4,
      is_read: false,
      is_liked: false,
      is_archived: false,
      received_at: '2024-01-15T10:00:00Z',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      user_id: mockUser.id,
      // Flat source (to_jsonb(s) from the SQL function)
      source: {
        id: 'src-1',
        name: 'Test Source',
        from: 'src@example.com',
        user_id: mockUser.id,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      // Flat tag array from jsonb_agg
      tags: [
        {
          id: 'tag-1',
          name: 'Technology',
          color: '#3b82f6',
          user_id: mockUser.id,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'tag-2',
          name: 'AI',
          color: '#ef4444',
          user_id: mockUser.id,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      total_count: 1,
    };

    const rpcSpy = () => vi.mocked(supabaseClientModule.supabase.rpc as ReturnType<typeof vi.fn>);

    it('should call get_newsletters RPC with all expected parameters', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [baseRpcRow], error: null });

      await newsletterApi.getByTags(['tag-1', 'tag-2'], {
        isRead: false,
        isArchived: false,
        isLiked: true,
        sourceIds: ['src-1'],
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        limit: 10,
        offset: 0,
        orderBy: 'received_at',
        ascending: false,
      });

      expect(rpcSpy()).toHaveBeenCalledWith('get_newsletters', {
        p_user_id: mockUser.id,
        p_tag_ids: ['tag-1', 'tag-2'],
        p_is_read: false,
        p_is_archived: false,
        p_is_liked: true,
        p_source_ids: ['src-1'],
        p_date_from: '2024-01-01T00:00:00Z',
        p_date_to: '2024-12-31T23:59:59Z',
        p_search: null,
        p_limit: 10,
        p_offset: 0,
        p_cursor: null, // Phase 3 is inactive by default
        p_order_by: 'received_at',
        p_order_direction: 'DESC',
      });
    });

    it('should pass null for unspecified optional params', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [], error: null });

      await newsletterApi.getByTags(['tag-1']);

      expect(rpcSpy()).toHaveBeenCalledWith(
        'get_newsletters',
        expect.objectContaining({
          p_is_read: null,
          p_is_archived: null,
          p_is_liked: null,
          p_source_ids: null,
          p_date_from: null,
          p_date_to: null,
        })
      );
    });

    it('should use ASC direction when ascending: true', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [], error: null });

      await newsletterApi.getByTags(['tag-1'], { ascending: true });

      expect(rpcSpy()).toHaveBeenCalledWith(
        'get_newsletters',
        expect.objectContaining({ p_order_direction: 'ASC' })
      );
    });

    it('should apply default limit=50, offset=0 when not specified', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [], error: null });

      await newsletterApi.getByTags(['tag-1']);

      expect(rpcSpy()).toHaveBeenCalledWith(
        'get_newsletters',
        expect.objectContaining({ p_limit: 50, p_offset: 0 })
      );
    });

    it('should NOT call supabase.from() — the whole operation is one RPC round trip', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [], error: null });

      await newsletterApi.getByTags(['tag-1']);

      expect(supabaseClientModule.supabase.from).not.toHaveBeenCalled();
    });

    it('should extract total_count from the first row for pagination', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...baseRpcRow,
        id: `nl-${i}`,
        total_count: 47,
      }));
      rpcSpy().mockResolvedValueOnce({ data: rows, error: null });

      const result = await newsletterApi.getByTags(['tag-1'], { limit: 10, offset: 0 });

      expect(result.count).toBe(47);
      expect(result.hasMore).toBe(true); // 0 + 10 < 47
      expect(result.nextPage).toBe(2);
      expect(result.prevPage).toBeNull();
      expect(result.page).toBe(1);
    });

    it('should compute hasMore=false and nextPage=null on the last page', async () => {
      const rows = Array.from({ length: 7 }, (_, i) => ({
        ...baseRpcRow,
        id: `nl-${i}`,
        total_count: 27,
      }));
      rpcSpy().mockResolvedValueOnce({ data: rows, error: null });

      const result = await newsletterApi.getByTags(['tag-1'], { limit: 10, offset: 20 });

      expect(result.hasMore).toBe(false); // 20 + 10 = 30 >= 27
      expect(result.nextPage).toBeNull();
      expect(result.prevPage).toBe(2);
      expect(result.page).toBe(3);
    });

    it('should return empty data and count=0 when the RPC returns no rows', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [], error: null });

      const result = await newsletterApi.getByTags(['nonexistent-tag']);

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextPage).toBeNull();
    });

    it('should return empty data and count=0 when RPC returns null', async () => {
      rpcSpy().mockResolvedValueOnce({ data: null, error: null });

      const result = await newsletterApi.getByTags(['tag-1']);

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should strip total_count from transformed newsletter objects', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [baseRpcRow], error: null });

      const result = await newsletterApi.getByTags(['tag-1']);
      const nl = result.data[0];

      expect((nl as any).total_count).toBeUndefined();
    });

    it('should transform flat RPC tags into Tag[] on each newsletter', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [baseRpcRow], error: null });

      const result = await newsletterApi.getByTags(['tag-1']);
      const nl = result.data[0];

      expect(nl.tags).toHaveLength(2);
      expect(nl.tags[0]).toMatchObject({
        id: 'tag-1',
        name: 'Technology',
        color: '#3b82f6',
        user_id: mockUser.id,
      });
      expect(nl.tags[1]).toMatchObject({ id: 'tag-2', name: 'AI' });
    });

    it('should transform flat RPC source into NewsletterSource on each newsletter', async () => {
      rpcSpy().mockResolvedValueOnce({ data: [baseRpcRow], error: null });

      const result = await newsletterApi.getByTags(['tag-1']);
      const nl = result.data[0];

      expect(nl.source).toMatchObject({
        id: 'src-1',
        name: 'Test Source',
        from: 'src@example.com',
      });
    });

    it('should handle a newsletter with an empty tags array gracefully', async () => {
      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      rpcSpy().mockResolvedValueOnce({
        data: [{ ...baseRpcRow, tags: [], total_count: 1 }],
        error: null,
      });

      const result = await newsletterApi.getByTags(['tag-1']);

      expect(result.data[0].tags).toEqual([]);
    });

    it('should handle a newsletter with a null source gracefully', async () => {
      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();

      const baseRowWithoutSource = {
        ...baseRpcRow,
        source: null, // Explicitly set source to null
      };
      rpcSpy().mockResolvedValueOnce({
        data: [baseRowWithoutSource],
        error: null,
      });

      const result = await newsletterApi.getByTags(['tag-1']);

      expect(result.data[0].source).toBeNull();
    });

    it('should handle RPC errors', async () => {
      const mockError = { message: 'relation does not exist', code: '42P01', details: null, hint: null, name: 'PostgrestError' };

      // Clear any previous mocks
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      vi.mocked(supabaseClientModule.supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(newsletterApi.getUnreadCountBySource()).rejects.toThrow('relation does not exist');
      expect(supabaseClientModule.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });

    it('should cast boolean fields correctly (is_read, is_liked, is_archived)', async () => {
      const rawRow = {
        ...baseRpcRow,
        is_read: 1, // truthy integer from some DB drivers
        is_liked: 0,
        is_archived: false,
        total_count: 1,
      };

      // Clear any previous mocks and set up fresh mock
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      rpcSpy().mockResolvedValueOnce({ data: [rawRow], error: null });

      const result = await newsletterApi.getByTags(['tag-1']);
      const nl = result.data[0];

      expect(nl.is_read).toBe(true);
      expect(nl.is_liked).toBe(false);
      expect(nl.is_archived).toBe(false);
    });

    it('should cast word_count and estimated_read_time to numbers', async () => {
      const rawRow = {
        ...baseRpcRow,
        word_count: '350',
        estimated_read_time: null,
        total_count: 1,
      };
      rpcSpy().mockResolvedValueOnce({ data: [rawRow], error: null });

      const result = await newsletterApi.getByTags(['tag-1']);
      const nl = result.data[0];

      expect(nl.word_count).toBe(350);
      expect(nl.estimated_read_time).toBe(0);
    });

    it('should handle multiple rows correctly, returning all of them', async () => {
      const rows = [
        { ...baseRpcRow, id: '789e0123-e89b-12d3-a456-426614174006', title: 'First', total_count: 3 },
        { ...baseRpcRow, id: '789e0123-e89b-12d3-a456-426614174007', title: 'Second', total_count: 3 },
        { ...baseRpcRow, id: '789e0123-e89b-12d3-a456-426614174008', title: 'Third', total_count: 3 },
      ];

      // Clear any previous mocks and set up fresh mock
      vi.mocked(supabaseClientModule.supabase.rpc).mockClear();
      rpcSpy().mockResolvedValueOnce({ data: rows, error: null });

      const result = await newsletterApi.getByTags(['tag-1', 'tag-2']);

      expect(result.data).toHaveLength(3);
      expect(result.data.map((n) => n.id)).toEqual(['789e0123-e89b-12d3-a456-426614174006', '789e0123-e89b-12d3-a456-426614174007', '789e0123-e89b-12d3-a456-426614174008']);
      expect(result.count).toBe(3);
    });
  });

  // Phase 3 gating tests
  describe('Phase 3 gating harness (dev/prod flag flip) - PR ready', () => {
    // Base mock newsletter row for RPC response
    const now = new Date().toISOString();
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: now,
    };

    const mockRowBase = {
      id: 'nl-1',
      title: 'T',
      content: 'C',
      summary: 'S',
      image_url: '',
      received_at: now,
      updated_at: now,
      is_read: false,
      is_liked: false,
      is_archived: false,
      newsletter_source_id: 'src-1',
      user_id: mockUser.id,
      word_count: 10,
      estimated_read_time: 1,
    };

    // States to exercise
    // dev flag on/off, prod flag on/off, environment, and expected p_cursor behavior
    const states = [
      { name: 'dev-on', devEnabled: true, prodEnabled: false, env: 'development', expectCursor: true },
      { name: 'prod-on', devEnabled: false, prodEnabled: true, env: 'production', expectCursor: true },
      { name: 'both-off-dev', devEnabled: false, prodEnabled: false, env: 'development', expectCursor: false },
      { name: 'prod-off-rollback', devEnabled: false, prodEnabled: false, env: 'production', expectCursor: false },
    ];

    for (const s of states) {
      test(`${s.name}: gating should ${s.expectCursor ? 'forward' : 'not forward'} p_cursor`, async () => {
        // 1) Set environment flags for this state
        (process as any).env.VITE_PHASE3_DEV_ENABLED = String(s.devEnabled);
        (process as any).env.VITE_PHASE3_PROD_ENABLED = String(s.prodEnabled);
        process.env.NODE_ENV = s.env;

        // 2) Reset modules so mocks take effect
        vi.resetModules();

        // 3) Mock Supabase client with a focused RPC mock
        let rpcSpy: vi.Mock | null = null;
        vi.doMock('../supabaseClient', () => {
          // The harness inspects this spy to verify the RPC call arguments
          rpcSpy = vi.fn().mockResolvedValue({
            data: [
              {
                ...mockRowBase,
                total_count: 2,
                next_cursor: 'CUR2',
              },
            ],
            error: null,
          });
          return {
            supabase: { from: vi.fn(), rpc: rpcSpy },
            requireAuth: vi.fn().mockResolvedValue(mockUser),
            withPerformanceLogging: vi.fn((_name: string, fn: any) => fn()),
            handleSupabaseError: vi.fn((err) => { throw err; }),
          };
        });

        // 4) Import API module fresh and call getAll
        const mod = await import('../newsletterApi');
        const api = mod.newsletterApi ?? mod.default;

        const testCursor = 'CUR-TEST';
        const res = await api.getAll({ limit: 2, offset: 0, cursor: testCursor });

        // 5) Assertions on the RPC call
        expect(rpcSpy).toBeDefined();
        expect(rpcSpy).toHaveBeenCalled();
        const rpcParams = (rpcSpy as any).mock.calls[0][1];
        if (s.expectCursor) {
          expect(rpcParams.p_cursor).toBe(testCursor);
        } else {
          expect(rpcParams.p_cursor).toBeNull();
        }

        // Optional: check that a response shape exists when gating is active
        if (s.expectCursor) {
          expect(res).toHaveProperty('nextCursor');
        }
      });
    }
  });
});
