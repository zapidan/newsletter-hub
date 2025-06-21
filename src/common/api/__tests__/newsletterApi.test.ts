import { NewsletterWithRelations } from '@common/types';
import { vi } from 'vitest';

// Create hoisted mocks using IIFE pattern
const {
  createMockNewsletter,
  createQueryBuilder,
  mockUser,
} = vi.hoisted(() => {
  // Helper function to create a mock newsletter
  const createMockNewsletter = (overrides: Partial<NewsletterWithRelations> = {}): NewsletterWithRelations => ({
    id: 'newsletter-1',
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
      id: 'source-1',
      name: 'Test Source',
      from: 'test@example.com',
      user_id: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    tags: [],
    newsletter_source_id: 'source-1',
    user_id: 'user-1',
    ...overrides,
  });

  // Create a query builder with all the chainable methods
  const createQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' },
    app_metadata: { provider: 'email' },
    created_at: new Date().toISOString(),
  };

  const mockNewsletter = createMockNewsletter();
  const queryBuilder = createQueryBuilder();

  return {
    createMockNewsletter,
    createQueryBuilder,
    mockUser,
    mockNewsletter,
    queryBuilder,
  };
});

// Mock the supabase client with hoisted values
vi.mock('../supabaseClient', () => {
  const queryBuilder = createQueryBuilder();
  const fromSpy = vi.fn().mockReturnValue(queryBuilder);

  const mockSupabase = {
    from: fromSpy,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      user: vi.fn().mockReturnValue(mockUser),
    },
  };

  return {
    supabase: mockSupabase,
    requireAuth: vi.fn().mockResolvedValue(mockUser),
    handleSupabaseError: vi.fn((error) => {
      throw new Error(error.message);
    }),
    withPerformanceLogging: vi.fn((name, fn) => fn()),
    fromSpy, // Export the spy for testing
  };
});

import { newsletterApi } from '../newsletterApi';
import * as supabaseClient from '../supabaseClient';

// Get the spy from the mocked module
const { fromSpy, requireAuth } = vi.mocked(supabaseClient);

describe('newsletterApi', () => {
  const now = new Date().toISOString();
  let currentQueryBuilder: ReturnType<typeof createQueryBuilder>;
  let currentMockNewsletter: NewsletterWithRelations;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    // Create fresh query builder for each test
    currentQueryBuilder = createQueryBuilder();
    currentMockNewsletter = createMockNewsletter();

    // Reset the fromSpy completely and set default behavior
    fromSpy.mockClear();
    fromSpy.mockReset();
    fromSpy.mockReturnValue(currentQueryBuilder);

    // Reset auth mock
    requireAuth.mockResolvedValue(mockUser);
  });


  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAll', () => {
    it('should fetch all newsletters with default params', async () => {
      const testData = [currentMockNewsletter];
      const mockResponse = {
        data: testData,
        count: testData.length,
        error: null,
      };

      // For default params, the API doesn't call limit() - it ends with order()
      currentQueryBuilder.order.mockResolvedValueOnce(mockResponse);

      const result = await newsletterApi.getAll();

      expect(supabaseClient.supabase.from).toHaveBeenCalledWith('newsletters');
      expect(currentQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(currentQueryBuilder.order).toHaveBeenCalledWith('received_at', { ascending: false });
      // No limit() call expected for default params

      expect(result).toEqual({
        data: testData,
        count: testData.length,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      });
    });
  });

  describe('getById', () => {
    it('should fetch newsletter by id', async () => {
      const mockResponse = {
        data: currentMockNewsletter,
        error: null,
      };

      currentQueryBuilder.single.mockResolvedValueOnce(mockResponse);

      const result = await newsletterApi.getById('newsletter-1');

      expect(supabaseClient.supabase.from).toHaveBeenCalledWith('newsletters');
      expect(currentQueryBuilder.select).toHaveBeenCalledWith(`
          *,
          source:newsletter_sources(*),
          tags:newsletter_tags(tag:tags(*))
        `);
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('id', 'newsletter-1');
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual(currentMockNewsletter);
    });

    it('should return null when newsletter not found', async () => {
      const mockResponse = {
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      };

      currentQueryBuilder.single.mockResolvedValueOnce(mockResponse);

      const result = await newsletterApi.getById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new newsletter', async () => {
      const newNewsletter = {
        title: 'New Newsletter',
        content: 'New content',
        summary: 'New summary',
        image_url: 'https://example.com/new.jpg',
      };

      const createdNewsletter = createMockNewsletter({
        ...newNewsletter,
        id: 'new-id',
        is_read: false,
        is_liked: false,
        is_archived: false,
        received_at: now,
        updated_at: now,
        estimated_read_time: 0,
        word_count: 0,
      });

      // Mock the insert chain
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: createdNewsletter, error: null });

      currentQueryBuilder.insert.mockReturnValue({
        select: selectMock,
        single: singleMock,
      });

      // Mock getById call that happens after creation
      currentQueryBuilder.single.mockResolvedValueOnce({
        data: createdNewsletter,
        error: null,
      });

      const result = await newsletterApi.create(newNewsletter);

      expect(currentQueryBuilder.insert).toHaveBeenCalledWith({
        ...newNewsletter,
        user_id: 'user-1',
        received_at: now,
      });

      expect(result).toEqual(createdNewsletter);
    });

    it('should create newsletter with tags', async () => {
      const newNewsletter = {
        title: 'New Newsletter',
        content: 'New content',
        summary: 'New summary',
        image_url: 'https://example.com/new.jpg',
        tag_ids: ['tag-1', 'tag-2'],
      };

      const createdNewsletter = createMockNewsletter({
        id: 'new-id',
        title: newNewsletter.title,
        content: newNewsletter.content,
      });

      // Mock newsletter creation
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: createdNewsletter, error: null });

      currentQueryBuilder.insert.mockReturnValueOnce({
        select: selectMock,
        single: singleMock,
      });

      // Mock tag association insertion
      currentQueryBuilder.insert.mockReturnValueOnce({
        error: null,
      });

      // Mock getById call
      currentQueryBuilder.single.mockResolvedValueOnce({
        data: createdNewsletter,
        error: null,
      });

      const result = await newsletterApi.create(newNewsletter);

      // Should insert newsletter without tag_ids
      const { tag_ids: _tagIds, ...newsletterData } = newNewsletter;
      expect(currentQueryBuilder.insert).toHaveBeenCalledWith({
        ...newsletterData,
        user_id: 'user-1',
        received_at: now,
      });

      expect(result).toEqual(createdNewsletter);
    });
  });

  describe('update', () => {
    it('should update an existing newsletter', async () => {
      const updates = { title: 'Updated Title' };
      const updatedNewsletter = {
        ...currentMockNewsletter,
        ...updates,
        updated_at: now,
      };

      // Mock getById call for validation
      currentQueryBuilder.single.mockResolvedValueOnce({
        data: currentMockNewsletter,
        error: null,
      });

      // Mock the update response
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: updatedNewsletter, error: null });

      currentQueryBuilder.update.mockReturnValue({
        eq: eqMock,
        select: selectMock,
        single: singleMock,
      });

      // Mock the final getById call
      currentQueryBuilder.single.mockResolvedValueOnce({
        data: updatedNewsletter,
        error: null,
      });

      const result = await newsletterApi.update({ id: 'newsletter-1', ...updates });

      expect(supabaseClient.supabase.from).toHaveBeenCalledWith('newsletters');
      expect(currentQueryBuilder.update).toHaveBeenCalledWith({
        ...updates,
        updated_at: now,
      });
      expect(result).toEqual(updatedNewsletter);
    });
  });

  describe('delete', () => {
    it('should delete a newsletter successfully', async () => {
      // ---- use a valid UUID ----
      const id = '11111111-1111-1111-1111-111111111111';

      // fresh builders for the 3 supabase.from() invocations
      const qb1 = createQueryBuilder();   // ownership check
      const qb2 = createQueryBuilder();   // delete
      const qb3 = createQueryBuilder();   // verification

      // reset and wire the spy
      fromSpy.mockReset();
      fromSpy
        .mockReturnValueOnce(qb1) // 1️⃣ ownership
        .mockReturnValueOnce(qb2) // 2️⃣ delete
        .mockReturnValueOnce(qb3); // 3️⃣ verify

      // 1️⃣ ownership query resolves with matching user
      qb1.maybeSingle.mockResolvedValueOnce({
        data: { id, user_id: 'user-1' },
        error: null,
      });

      // 2️⃣ delete query succeeds
      qb2.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // 3️⃣ verification query returns no row
      qb3.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await newsletterApi.delete(id);

      expect(supabaseClient.supabase.from).toHaveBeenCalledWith('newsletters');
      expect(supabaseClient.supabase.from).toHaveBeenCalledTimes(3);
      expect(result).toBe(true);
    });

    it('should return false when newsletter not found', async () => {
      // Reset to single query builder for simple tests
      fromSpy.mockClear();
      fromSpy.mockReset();
      fromSpy.mockReturnValue(currentQueryBuilder);

      currentQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await newsletterApi.delete('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when newsletter belongs to different user', async () => {
      // Reset to single query builder for simple tests
      fromSpy.mockClear();
      fromSpy.mockReset();
      fromSpy.mockReturnValue(currentQueryBuilder);

      currentQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'newsletter-1', user_id: 'different-user' },
        error: null,
      });

      const result = await newsletterApi.delete('newsletter-1');

      expect(result).toBe(false);
    });
  });



  describe('markAsRead', () => {
    it('should mark a newsletter as read', async () => {
      const updatedNewsletter = {
        ...currentMockNewsletter,
        is_read: true,
        updated_at: now,
      };

      // markAsRead calls update() which calls getById() first for validation
      // Then does the update, then calls getById() again to return the result
      currentQueryBuilder.single
        .mockResolvedValueOnce({ data: currentMockNewsletter, error: null }) // getById validation
        .mockResolvedValueOnce({ data: updatedNewsletter, error: null }); // final getById

      // Mock the update response
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: updatedNewsletter, error: null });

      currentQueryBuilder.update.mockReturnValue({
        eq: eqMock,
        select: selectMock,
        single: singleMock,
      });

      const result = await newsletterApi.markAsRead('newsletter-1');

      expect(currentQueryBuilder.update).toHaveBeenCalledWith({
        is_read: true,
        updated_at: now,
      });
      expect(result).toEqual(updatedNewsletter);
    });
  });

  describe('toggleArchive', () => {
    it('should toggle archive status', async () => {
      const archivedNewsletter = {
        ...currentMockNewsletter,
        is_archived: true,
        updated_at: now,
      };

      // toggleArchive calls getById() first, then update() which also calls getById() twice
      currentQueryBuilder.single
        .mockResolvedValueOnce({ data: currentMockNewsletter, error: null }) // First getById in toggleArchive
        .mockResolvedValueOnce({ data: currentMockNewsletter, error: null }) // getById validation in update
        .mockResolvedValueOnce({ data: archivedNewsletter, error: null }); // final getById in update

      // Mock the update response
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: archivedNewsletter, error: null });

      currentQueryBuilder.update.mockReturnValue({
        eq: eqMock,
        select: selectMock,
        single: singleMock,
      });

      const result = await newsletterApi.toggleArchive('newsletter-1');

      expect(result).toBeDefined();
      expect(result.is_archived).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return newsletter statistics', async () => {
      const mockNewsletters = [
        { is_read: true, is_archived: false, is_liked: true },
        { is_read: false, is_archived: false, is_liked: false },
        { is_read: true, is_archived: true, is_liked: false },
      ];

      // getStats uses select().eq() chain - the result resolves on eq()
      const eqMock = vi.fn().mockResolvedValue({ data: mockNewsletters, error: null });
      currentQueryBuilder.select.mockReturnValue({
        eq: eqMock,
      });

      const result = await newsletterApi.getStats();

      expect(currentQueryBuilder.select).toHaveBeenCalledWith('is_read, is_archived, is_liked');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual({
        total: 3,
        read: 2,
        unread: 1,
        archived: 1,
        liked: 1,
      });
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple newsletters', async () => {
      const ids = ['newsletter-1', 'newsletter-2'];
      const updates = { is_read: true };

      const updatedNewsletters = ids.map((id) =>
        createMockNewsletter({ id, is_read: true, updated_at: now })
      );

      // Mock bulk update
      const inMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockResolvedValue({ data: updatedNewsletters, error: null });

      currentQueryBuilder.update.mockReturnValue({
        in: inMock,
        eq: eqMock,
        select: selectMock,
      });

      const result = await newsletterApi.bulkUpdate({ ids, updates });

      expect(currentQueryBuilder.update).toHaveBeenCalledWith({
        ...updates,
        updated_at: now,
      });
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('should search newsletters by query', async () => {
      const testData = [currentMockNewsletter];
      const mockResponse = {
        data: testData,
        count: testData.length,
        error: null,
      };

      // search() calls getAll() internally, which ends with order() for default params
      currentQueryBuilder.order.mockResolvedValueOnce(mockResponse);

      const result = await newsletterApi.search('test query');

      expect(currentQueryBuilder.or).toHaveBeenCalledWith(
        'title.ilike.%test query%, content.ilike.%test query%, summary.ilike.%test query%'
      );
      expect(result.data).toEqual(testData);
    });
  });
});
